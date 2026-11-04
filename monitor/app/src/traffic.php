<?php
declare(strict_types=1);

/**
 * Tráfego por site a partir dos logs: agregação, armazenamento e consultas.
 *
 *  traffic_5m  contadores por site em blocos de 5 minutos
 *  url_1d      custo PHP por URL e por dia
 *  bot_1d      pedidos por robô e por dia
 *  err_1d      erros PHP por mensagem e por dia
 *  slow_1d     entradas do slow log por plugin/tema e por dia
 */
final class Traffic
{
    public const SUM_COLS = [
        'front', 'backend', 'php', 'static', 's3xx', 's4xx', 's5xx', 'bytes', 'bot_front', 'bot_backend',
        'ajax', 'login', 'xmlrpc', 'cron', 'rest', 'feed', 'search', 'admin',
        'php_time', 'php_cpu', 'php_slow', 'err_fatal', 'err_warning', 'err_notice', 'err_deprecated', 'slow_n',
    ];

    private array $t5 = [];
    private array $url = [];
    private array $bot = [];
    private array $err = [];
    private array $slow = [];

    public function __construct(private Store $s)
    {
    }

    public static function migrate(PDO $db): void
    {
        $cols = implode(', ', array_map(fn($c) => "$c REAL DEFAULT 0", self::SUM_COLS));
        $db->exec("
            CREATE TABLE IF NOT EXISTS traffic_5m (ts INTEGER, app TEXT, $cols, php_mem_max INTEGER DEFAULT 0,
                PRIMARY KEY (ts, app)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS url_1d (day TEXT, app TEXT, path TEXT, n INTEGER, time REAL, cpu REAL,
                mem_max INTEGER, slow INTEGER, PRIMARY KEY (day, app, path)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS bot_1d (day TEXT, app TEXT, bot TEXT, front INTEGER, backend INTEGER,
                ajax INTEGER, PRIMARY KEY (day, app, bot)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS err_1d (day TEXT, app TEXT, sig TEXT, level TEXT, msg TEXT, file TEXT,
                line INTEGER, n INTEGER, last INTEGER, PRIMARY KEY (day, app, sig)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS slow_1d (day TEXT, app TEXT, comp TEXT, n INTEGER, example TEXT,
                PRIMARY KEY (day, app, comp)) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS logpos (file TEXT PRIMARY KEY, inode INTEGER, pos INTEGER, updated INTEGER);
        ");
    }

    /* ---------------- Agregação ---------------- */

    private function &t(int $ts, string $app): array
    {
        $b = intdiv($ts, 300) * 300;
        if (!isset($this->t5[$b][$app])) {
            $this->t5[$b][$app] = array_fill_keys(self::SUM_COLS, 0) + ['php_mem_max' => 0];
        }
        return $this->t5[$b][$app];
    }

    private static function day(int $ts): string
    {
        return date('Y-m-d', $ts);
    }

    private function addBot(int $ts, string $app, string $bot, string $field): void
    {
        $d = self::day($ts);
        $this->bot[$d][$app][$bot] ??= ['front' => 0, 'backend' => 0, 'ajax' => 0];
        $this->bot[$d][$app][$bot][$field]++;
    }

    /** Pedido que entrou pelo Nginx da frente (antes do Varnish). */
    public function front(string $app, array $r): void
    {
        $t = &$this->t($r['ts'], $app);
        $t['front']++;
        $t['bytes'] += $r['bytes'];
        $st = $r['status'];
        if ($st >= 500) {
            $t['s5xx']++;
        } elseif ($st >= 400) {
            $t['s4xx']++;
        } elseif ($st >= 300) {
            $t['s3xx']++;
        }
        $type = LogParse::reqType($r['path'], $r['query']);
        if ($type) {
            $t[$type]++;
        }
        $bot = LogParse::bot($r['ua']);
        if ($bot !== '') {
            $t['bot_front']++;
        }
        $this->addBot($r['ts'], $app, $bot, 'front');
        if ($type === 'ajax') {
            $this->addBot($r['ts'], $app, $bot, 'ajax');
        }
    }

    /** Pedido que passou o Varnish e chegou ao servidor web de trás (não veio da cache). */
    public function backend(string $app, array $r): void
    {
        $t = &$this->t($r['ts'], $app);
        $t['backend']++;
        $bot = LogParse::bot($r['ua']);
        if ($bot !== '') {
            $t['bot_backend']++;
        }
        $this->addBot($r['ts'], $app, $bot, 'backend');
    }

    /** Ficheiro estático servido diretamente pelo Nginx. */
    public function staticReq(string $app, array $r): void
    {
        $t = &$this->t($r['ts'], $app);
        $t['static']++;
        $t['bytes'] += $r['bytes'];
    }

    /** Pedido executado pelo PHP-FPM, com duração, memória e CPU. */
    public function php(string $app, array $r): void
    {
        $t = &$this->t($r['ts'], $app);
        $t['php']++;
        $t['php_time'] += $r['dur'];
        $t['php_cpu'] += $r['cpu'];
        $slow = $r['dur'] >= 1.0 ? 1 : 0;
        $t['php_slow'] += $slow;
        $t['php_mem_max'] = max($t['php_mem_max'], $r['mem']);

        $path = LogParse::normPath($r['path']);
        if (LogParse::reqType($r['path'], $r['query']) === 'search') {
            $path .= '?s=…';
        }
        $d = self::day($r['ts']);
        $u = &$this->url[$d][$app][$path];
        $u ??= ['n' => 0, 'time' => 0.0, 'cpu' => 0.0, 'mem_max' => 0, 'slow' => 0];
        $u['n']++;
        $u['time'] += $r['dur'];
        $u['cpu'] += $r['cpu'];
        $u['mem_max'] = max($u['mem_max'], $r['mem']);
        $u['slow'] += $slow;
        unset($u);
    }

    public function errors(string $app, int $ts, array $list): void
    {
        $t = &$this->t($ts, $app);
        $d = self::day($ts);
        foreach ($list as [$level, $msg, $file, $line]) {
            $t['err_' . $level]++;
            $sig = substr(sha1("$level|$msg|$file|$line"), 0, 16);
            $e = &$this->err[$d][$app][$sig];
            $e ??= ['level' => $level, 'msg' => $msg, 'file' => $file, 'line' => $line, 'n' => 0, 'last' => 0];
            $e['n']++;
            $e['last'] = max($e['last'], $ts);
            unset($e);
        }
    }

    public function slowEntry(string $app, int $ts, string $comp, string $example): void
    {
        $t = &$this->t($ts, $app);
        $t['slow_n']++;
        $d = self::day($ts);
        $this->slow[$d][$app][$comp] ??= ['n' => 0, 'example' => $example];
        $this->slow[$d][$app][$comp]['n']++;
    }

    /** Grava o que foi agregado (soma aos valores já existentes). Chamar dentro de uma transação. */
    public function flush(): void
    {
        $db = $this->s->db;
        if ($this->t5) {
            $cols = self::SUM_COLS;
            $all = array_merge(['ts', 'app'], $cols, ['php_mem_max']);
            $set = implode(', ', array_map(fn($c) => "$c = $c + excluded.$c", $cols));
            $st = $db->prepare('INSERT INTO traffic_5m (' . implode(',', $all) . ') VALUES (' . implode(',', array_fill(0, count($all), '?'))
                . ") ON CONFLICT(ts, app) DO UPDATE SET $set, php_mem_max = MAX(php_mem_max, excluded.php_mem_max)");
            foreach ($this->t5 as $b => $apps) {
                foreach ($apps as $app => $t) {
                    $st->execute(array_merge([$b, $app], array_map(fn($c) => $t[$c], $cols), [$t['php_mem_max']]));
                }
            }
        }
        $st = $db->prepare('INSERT INTO url_1d (day, app, path, n, time, cpu, mem_max, slow) VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(day, app, path) DO UPDATE SET n = n + excluded.n, time = time + excluded.time,
            cpu = cpu + excluded.cpu, mem_max = MAX(mem_max, excluded.mem_max), slow = slow + excluded.slow');
        foreach ($this->url as $d => $apps) {
            foreach ($apps as $app => $paths) {
                foreach ($paths as $p => $u) {
                    $st->execute([$d, $app, $p, $u['n'], $u['time'], $u['cpu'], $u['mem_max'], $u['slow']]);
                }
            }
        }
        $st = $db->prepare('INSERT INTO bot_1d (day, app, bot, front, backend, ajax) VALUES (?,?,?,?,?,?)
            ON CONFLICT(day, app, bot) DO UPDATE SET front = front + excluded.front,
            backend = backend + excluded.backend, ajax = ajax + excluded.ajax');
        foreach ($this->bot as $d => $apps) {
            foreach ($apps as $app => $bots) {
                foreach ($bots as $bot => $b) {
                    $st->execute([$d, $app, $bot, $b['front'], $b['backend'], $b['ajax']]);
                }
            }
        }
        $st = $db->prepare('INSERT INTO err_1d (day, app, sig, level, msg, file, line, n, last) VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(day, app, sig) DO UPDATE SET n = n + excluded.n, last = MAX(last, excluded.last)');
        foreach ($this->err as $d => $apps) {
            foreach ($apps as $app => $sigs) {
                foreach ($sigs as $sig => $e) {
                    $st->execute([$d, $app, $sig, $e['level'], $e['msg'], $e['file'], $e['line'], $e['n'], $e['last']]);
                }
            }
        }
        $st = $db->prepare('INSERT INTO slow_1d (day, app, comp, n, example) VALUES (?,?,?,?,?)
            ON CONFLICT(day, app, comp) DO UPDATE SET n = n + excluded.n, example = excluded.example');
        foreach ($this->slow as $d => $apps) {
            foreach ($apps as $app => $comps) {
                foreach ($comps as $c => $v) {
                    $st->execute([$d, $app, $c, $v['n'], $v['example']]);
                }
            }
        }
        $this->t5 = $this->url = $this->bot = $this->err = $this->slow = [];
    }

    /** Retenção: tráfego 90 dias; URLs e erros 30 dias, só os 200/100 mais relevantes de cada dia fechado. */
    public static function prune(Store $s, int $now): void
    {
        if ($now - (int) $s->meta('traffic_pruned_at') < 3600) {
            return;
        }
        $days = (int) mon_config()['retention_rollup_days'];
        $old = date('Y-m-d', $now - $days * 86400);
        $old30 = date('Y-m-d', $now - 30 * 86400);
        $today = date('Y-m-d', $now);
        $db = $s->db;
        $db->prepare('DELETE FROM traffic_5m WHERE ts < ?')->execute([$now - $days * 86400]);
        foreach (['bot_1d', 'slow_1d'] as $t) {
            $db->prepare("DELETE FROM $t WHERE day < ?")->execute([$old]);
        }
        foreach (['url_1d', 'err_1d'] as $t) {
            $db->prepare("DELETE FROM $t WHERE day < ?")->execute([$old30]);
        }
        $db->prepare('DELETE FROM url_1d WHERE day < :t AND (day, app, path) IN (
            SELECT day, app, path FROM (SELECT day, app, path,
              ROW_NUMBER() OVER (PARTITION BY day, app ORDER BY cpu DESC) rn FROM url_1d WHERE day < :t) WHERE rn > 200)')
            ->execute([':t' => $today]);
        $db->prepare('DELETE FROM err_1d WHERE day < :t AND (day, app, sig) IN (
            SELECT day, app, sig FROM (SELECT day, app, sig,
              ROW_NUMBER() OVER (PARTITION BY day, app ORDER BY n DESC) rn FROM err_1d WHERE day < :t) WHERE rn > 100)')
            ->execute([':t' => $today]);
        $s->setMeta('traffic_pruned_at', (string) $now);
    }

    /* ---------------- Consultas ---------------- */

    /** Totais por site entre dois instantes (para os cartões da página principal). */
    public static function summary(Store $s, int $from): array
    {
        $sum = implode(', ', array_map(fn($c) => "SUM($c) AS $c", self::SUM_COLS));
        $q = $s->db->prepare("SELECT app, $sum FROM traffic_5m WHERE ts >= ? GROUP BY app");
        $q->execute([$from]);
        $out = [];
        foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $out[$r['app']] = self::derive($r);
        }
        return $out;
    }

    /** Acrescenta indicadores calculados a uma linha de totais. */
    public static function derive(array $r): array
    {
        foreach (self::SUM_COLS as $c) {
            $r[$c] = isset($r[$c]) ? (float) $r[$c] : 0.0;
        }
        $front = $r['front'];
        $r['cache_pct'] = $front > 0 ? max(0, min(100, 100 * (1 - $r['backend'] / $front))) : null;
        $r['bot_pct'] = $front > 0 ? 100 * $r['bot_front'] / $front : null;
        $r['php_avg'] = $r['php'] > 0 ? $r['php_time'] / $r['php'] : null;
        $r['errors'] = $r['err_fatal'] + $r['err_warning'] + $r['err_notice'] + $r['err_deprecated'];
        return $r;
    }

    /** Intervalo de dias e de tempo para um período do ecrã de site. */
    public static function period(string $range, int $now): array
    {
        $today = strtotime('today', $now);
        return match ($range) {
            'yesterday' => ['from' => $today - 86400, 'to' => $today, 'bucket' => 300,
                'd1' => date('Y-m-d', $today - 86400), 'd2' => date('Y-m-d', $today - 86400)],
            '7d' => ['from' => $today - 6 * 86400, 'to' => $now, 'bucket' => 3600,
                'd1' => date('Y-m-d', $today - 6 * 86400), 'd2' => date('Y-m-d', $now)],
            '30d' => ['from' => $today - 29 * 86400, 'to' => $now, 'bucket' => 14400,
                'd1' => date('Y-m-d', $today - 29 * 86400), 'd2' => date('Y-m-d', $now)],
            default => ['from' => $today, 'to' => $now, 'bucket' => 300,
                'd1' => date('Y-m-d', $now), 'd2' => date('Y-m-d', $now)],
        };
    }

    public static function site(Store $s, string $app, string $range, int $now, bool $detail): array
    {
        $p = self::period($range, $now);
        $db = $s->db;
        $sum = implode(', ', array_map(fn($c) => "SUM($c) AS $c", self::SUM_COLS));

        $q = $db->prepare("SELECT $sum, MAX(php_mem_max) AS php_mem_max FROM traffic_5m WHERE app = ? AND ts >= ? AND ts < ?");
        $q->execute([$app, $p['from'], $p['to'] + 1]);
        $totals = self::derive($q->fetch(PDO::FETCH_ASSOC) ?: []);

        // Séries com todos os blocos do período (blocos sem tráfego ficam a zero).
        $b = $p['bucket'];
        $q = $db->prepare("SELECT (ts / $b) * $b AS t, SUM(front) front, SUM(backend) backend, SUM(php) php, SUM(php_cpu) cpu
            FROM traffic_5m WHERE app = ? AND ts >= ? AND ts < ? GROUP BY t");
        $q->execute([$app, $p['from'], $p['to'] + 1]);
        $rows = [];
        foreach ($q as $r) {
            $rows[(int) $r['t']] = $r;
        }
        $series = ['ts' => [], 'front' => [], 'backend' => [], 'php' => [], 'cpu' => []];
        $start = intdiv($p['from'], $b) * $b;
        $end = min($p['to'], $now);
        for ($t = $start; $t < $end; $t += $b) {
            $r = $rows[$t] ?? null;
            $series['ts'][] = $t;
            $series['front'][] = (int) ($r['front'] ?? 0);
            $series['backend'][] = (int) ($r['backend'] ?? 0);
            $series['php'][] = (int) ($r['php'] ?? 0);
            // CPU média do PHP no bloco, em % do servidor.
            $series['cpu'][] = $r ? round(100 * (float) $r['cpu'] / $b / max(1, (int) $s->meta('ncpu')), 2) : 0;
        }

        $q = $db->prepare('SELECT path, SUM(n) n, SUM(time) time, SUM(cpu) cpu, MAX(mem_max) mem_max, SUM(slow) slow
            FROM url_1d WHERE app = ? AND day BETWEEN ? AND ? GROUP BY path ORDER BY SUM(cpu) DESC LIMIT 25');
        $q->execute([$app, $p['d1'], $p['d2']]);
        $urls = $q->fetchAll(PDO::FETCH_ASSOC);

        $q = $db->prepare('SELECT bot, SUM(front) front, SUM(backend) backend, SUM(ajax) ajax
            FROM bot_1d WHERE app = ? AND day BETWEEN ? AND ? GROUP BY bot ORDER BY SUM(front) DESC');
        $q->execute([$app, $p['d1'], $p['d2']]);
        $bots = $q->fetchAll(PDO::FETCH_ASSOC);

        $q = $db->prepare('SELECT comp, SUM(n) n, MAX(example) example FROM slow_1d
            WHERE app = ? AND day BETWEEN ? AND ? GROUP BY comp ORDER BY SUM(n) DESC LIMIT 15');
        $q->execute([$app, $p['d1'], $p['d2']]);
        $slow = $q->fetchAll(PDO::FETCH_ASSOC);

        $errors = [];
        if ($detail) {
            $q = $db->prepare('SELECT level, msg, file, line, SUM(n) n, MAX(last) last FROM err_1d
                WHERE app = ? AND day BETWEEN ? AND ? GROUP BY sig ORDER BY SUM(n) DESC LIMIT 20');
            $q->execute([$app, $p['d1'], $p['d2']]);
            $errors = $q->fetchAll(PDO::FETCH_ASSOC);
        }

        $cast = static function (array $rows): array {
            return array_map(static fn($r) => array_map(static fn($v) => is_numeric($v) ? $v + 0 : $v, $r), $rows);
        };
        return [
            'range' => $range, 'from' => $p['from'], 'to' => $p['to'], 'bucket' => $b,
            'totals' => $totals, 'series' => $series,
            'urls' => $cast($urls), 'bots' => $cast($bots), 'slow' => $cast($slow), 'errors' => $cast($errors),
        ];
    }
}
