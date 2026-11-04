<?php
declare(strict_types=1);

/**
 * Armazenamento em SQLite. O coletor escreve; o dashboard só lê.
 */
final class Store
{
    public const SERVER_COLS = [
        'cpu', 'iowait', 'steal', 'load1', 'load5', 'load15',
        'mem_total', 'mem_used', 'mem_cache', 'swap_total', 'swap_used',
        'psi_cpu', 'psi_mem', 'psi_io', 'disk_r', 'disk_w', 'net_rx', 'net_tx',
        'disk_total', 'disk_used',
    ];

    public PDO $db;

    private function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public static function path(): string
    {
        return rtrim(mon_config()['data_dir'], '/') . '/metrics.sqlite';
    }

    public static function openWrite(): self
    {
        $path = self::path();
        $dir = dirname($path);
        if (!is_dir($dir)) {
            mkdir($dir, 02775, true);
        }
        $db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $db->exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=20000;');
        $s = new self($db);
        $s->migrate();
        @chmod($path, 0664);
        return $s;
    }

    public static function openRead(): ?self
    {
        $path = self::path();
        if (!is_readable($path)) {
            return null;
        }
        $opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];
        if (defined('PDO::SQLITE_ATTR_OPEN_FLAGS')) {
            $opts[PDO::SQLITE_ATTR_OPEN_FLAGS] = PDO::SQLITE_OPEN_READONLY;
        }
        try {
            $db = new PDO('sqlite:' . $path, null, null, $opts);
            $db->exec('PRAGMA busy_timeout=3000;');
            return new self($db);
        } catch (Throwable) {
            return null;
        }
    }

    private function migrate(): void
    {
        $cols = implode(', ', array_map(fn($c) => "$c REAL", self::SERVER_COLS));
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS server    (ts INTEGER PRIMARY KEY, $cols);
            CREATE TABLE IF NOT EXISTS server_5m (ts INTEGER PRIMARY KEY, $cols, cpu_max REAL);
            CREATE TABLE IF NOT EXISTS consumer (
                ts INTEGER, kind TEXT, name TEXT, cpu REAL, rss INTEGER, procs INTEGER,
                PRIMARY KEY (ts, kind, name)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS consumer_5m (
                ts INTEGER, kind TEXT, name TEXT, cpu REAL, cpu_max REAL, rss INTEGER, procs REAL,
                PRIMARY KEY (ts, kind, name)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS apps (
                id TEXT PRIMARY KEY, label TEXT, url TEXT, php TEXT, type TEXT, updated INTEGER);
            CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
        ");
        Traffic::migrate($this->db);
    }

    public function insertSample(int $ts, array $rates): void
    {
        $cols = self::SERVER_COLS;
        $ph = implode(',', array_fill(0, count($cols) + 1, '?'));
        $this->db->beginTransaction();
        $st = $this->db->prepare('INSERT OR REPLACE INTO server (ts,' . implode(',', $cols) . ") VALUES ($ph)");
        $st->execute(array_merge([$ts], array_map(fn($c) => $rates['server'][$c], $cols)));
        $st = $this->db->prepare('INSERT OR REPLACE INTO consumer (ts,kind,name,cpu,rss,procs) VALUES (?,?,?,?,?,?)');
        foreach ($rates['consumers'] as $c) {
            $st->execute([$ts, $c['kind'], $c['name'], $c['cpu'], $c['rss'], $c['procs']]);
        }
        $this->db->commit();
    }

    /** Agrega amostras de 10 s em blocos de 5 minutos e apaga o que passou da retenção. */
    public function rollupAndPrune(int $now): void
    {
        $cfg = mon_config();
        $done = (int) $this->meta('rollup_until');
        $until = intdiv($now, 300) * 300; // só blocos completos
        if ($until > $done) {
            $avg = implode(', ', array_map(fn($c) => "AVG($c)", self::SERVER_COLS));
            $cols = implode(',', self::SERVER_COLS);
            $this->db->beginTransaction();
            $this->db->prepare("INSERT OR REPLACE INTO server_5m (ts,$cols,cpu_max)
                SELECT (ts/300)*300 AS b, $avg, MAX(cpu) FROM server WHERE ts >= ? AND ts < ? GROUP BY b")
                ->execute([$done, $until]);
            $this->db->prepare("INSERT OR REPLACE INTO consumer_5m (ts,kind,name,cpu,cpu_max,rss,procs)
                SELECT (ts/300)*300 AS b, kind, name, AVG(cpu), MAX(cpu), AVG(rss), AVG(procs)
                FROM consumer WHERE ts >= ? AND ts < ? GROUP BY b, kind, name")
                ->execute([$done, $until]);
            $this->setMeta('rollup_until', (string) $until);
            $this->db->commit();
        }
        // Limpeza no máximo uma vez por hora.
        if ($now - (int) $this->meta('pruned_at') > 3600) {
            $raw = $now - (int) $cfg['retention_raw_hours'] * 3600;
            $old = $now - (int) $cfg['retention_rollup_days'] * 86400;
            $this->db->prepare('DELETE FROM server WHERE ts < ?')->execute([$raw]);
            $this->db->prepare('DELETE FROM consumer WHERE ts < ?')->execute([$raw]);
            $this->db->prepare('DELETE FROM server_5m WHERE ts < ?')->execute([$old]);
            $this->db->prepare('DELETE FROM consumer_5m WHERE ts < ?')->execute([$old]);
            $this->setMeta('pruned_at', (string) $now);
        }
    }

    public function meta(string $k): ?string
    {
        $st = $this->db->prepare('SELECT v FROM meta WHERE k = ?');
        $st->execute([$k]);
        $v = $st->fetchColumn();
        return $v === false ? null : (string) $v;
    }

    public function setMeta(string $k, string $v): void
    {
        $this->db->prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)')->execute([$k, $v]);
    }

    public function apps(): array
    {
        $out = [];
        foreach ($this->db->query('SELECT * FROM apps ORDER BY id') as $r) {
            $out[$r['id']] = $r;
        }
        return $out;
    }

    /**
     * Séries históricas. Até 6 h usa as amostras de 10 s; acima disso os blocos de 5 min
     * (e de 1 h para 30 dias, para não enviar milhares de pontos).
     */
    public function history(string $range, int $now): array
    {
        $ranges = ['1h' => 3600, '6h' => 21600, '24h' => 86400, '7d' => 604800, '30d' => 2592000];
        $span = $ranges[$range] ?? 3600;
        $from = $now - $span;
        if ($span <= 21600) {
            [$st, $ct, $bucket] = ['server', 'consumer', 0];
        } else {
            [$st, $ct, $bucket] = ['server_5m', 'consumer_5m', $span > 604800 ? 3600 : 0];
        }
        $b = $bucket ? "(ts/$bucket)*$bucket" : 'ts';

        $q = $this->db->prepare("SELECT $b AS t, AVG(cpu) cpu, AVG(mem_used) mem_used, AVG(mem_total) mem_total,
            AVG(load1) load1, AVG(iowait) iowait, AVG(net_rx) net_rx, AVG(net_tx) net_tx,
            AVG(disk_r) disk_r, AVG(disk_w) disk_w
            FROM $st WHERE ts >= ? GROUP BY t ORDER BY t");
        $q->execute([$from]);
        $ts = [];
        $series = ['cpu' => [], 'mem' => [], 'load1' => [], 'iowait' => [], 'net_rx' => [], 'net_tx' => [], 'disk_r' => [], 'disk_w' => []];
        foreach ($q as $r) {
            $ts[] = (int) $r['t'];
            $series['cpu'][] = round((float) $r['cpu'], 2);
            $series['mem'][] = $r['mem_total'] > 0 ? round(100 * $r['mem_used'] / $r['mem_total'], 2) : null;
            $series['load1'][] = round((float) $r['load1'], 2);
            $series['iowait'][] = round((float) $r['iowait'], 2);
            foreach (['net_rx', 'net_tx', 'disk_r', 'disk_w'] as $k) {
                $series[$k][] = (int) $r[$k];
            }
        }

        $idx = array_flip($ts);
        $n = count($ts);
        $q = $this->db->prepare("SELECT $b AS t, kind, name, AVG(cpu) cpu, AVG(rss) rss
            FROM $ct WHERE ts >= ? GROUP BY t, kind, name");
        $q->execute([$from]);
        $consumers = [];
        foreach ($q as $r) {
            if (!isset($idx[$r['t']])) {
                continue;
            }
            $key = $r['kind'] . ':' . $r['name'];
            if (!isset($consumers[$key])) {
                $consumers[$key] = ['kind' => $r['kind'], 'name' => $r['name'],
                    'cpu' => array_fill(0, $n, null), 'rss' => array_fill(0, $n, null)];
            }
            $consumers[$key]['cpu'][$idx[$r['t']]] = round((float) $r['cpu'], 2);
            $consumers[$key]['rss'][$idx[$r['t']]] = (int) $r['rss'];
        }
        // Uma app sem processos FPM num instante consumiu 0, não "sem dados".
        foreach ($consumers as &$c) {
            foreach ($c['cpu'] as $i => $v) {
                if ($v === null) {
                    $c['cpu'][$i] = 0;
                    $c['rss'][$i] = 0;
                }
            }
        }
        unset($c);

        return ['range' => $range, 'ts' => $ts, 'server' => $series, 'consumers' => array_values($consumers)];
    }
}
