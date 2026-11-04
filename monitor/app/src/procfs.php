<?php
declare(strict_types=1);

/**
 * Leitura de métricas a partir de /proc e /sys. Não precisa de root:
 * tudo o que é lido aqui é legível por qualquer utilizador no servidor.
 */
final class Procfs
{
    public const CLK_TCK = 100;
    public const PAGE = 4096;

    /** Fotografia instantânea do servidor. Os valores são acumulados; as taxas saem de rates(). */
    public static function snapshot(): array
    {
        return [
            't'     => microtime(true),
            'cpu'   => self::cpuTimes(),
            'ncpu'  => self::ncpu(),
            'mem'   => self::meminfo(),
            'load'  => self::loadavg(),
            'psi'   => [
                'cpu' => self::pressure('cpu'),
                'mem' => self::pressure('memory'),
                'io'  => self::pressure('io'),
            ],
            'disk'  => self::diskIo(),
            'net'   => self::netIo(),
            'fs'    => [
                'total' => (int) @disk_total_space('/'),
                'free'  => (int) @disk_free_space('/'),
            ],
            'procs' => self::processes(),
        ];
    }

    /** Converte duas fotografias em taxas (percentagens, bytes/s) e consumo por app/serviço. */
    public static function rates(array $a, array $b): array
    {
        $dt = max(0.001, $b['t'] - $a['t']);
        $ca = $a['cpu'];
        $cb = $b['cpu'];
        $tot = max(1, array_sum($cb) - array_sum($ca));
        $d = static fn(string $k): float => max(0, ($cb[$k] ?? 0) - ($ca[$k] ?? 0));
        $idle = $d('idle') + $d('iowait');

        $m = $b['mem'];
        $server = [
            'cpu'        => round(100 * (1 - $idle / $tot), 2),
            'iowait'     => round(100 * $d('iowait') / $tot, 2),
            'steal'      => round(100 * $d('steal') / $tot, 2),
            'load1'      => $b['load'][0],
            'load5'      => $b['load'][1],
            'load15'     => $b['load'][2],
            'mem_total'  => $m['MemTotal'],
            'mem_used'   => $m['MemTotal'] - $m['MemAvailable'],
            'mem_cache'  => $m['Cached'] + $m['Buffers'],
            'swap_total' => $m['SwapTotal'],
            'swap_used'  => $m['SwapTotal'] - $m['SwapFree'],
            'psi_cpu'    => $b['psi']['cpu'],
            'psi_mem'    => $b['psi']['mem'],
            'psi_io'     => $b['psi']['io'],
            'disk_r'     => round(max(0, $b['disk'][0] - $a['disk'][0]) / $dt),
            'disk_w'     => round(max(0, $b['disk'][1] - $a['disk'][1]) / $dt),
            'net_rx'     => round(max(0, $b['net'][0] - $a['net'][0]) / $dt),
            'net_tx'     => round(max(0, $b['net'][1] - $a['net'][1]) / $dt),
            'disk_total' => $b['fs']['total'],
            'disk_used'  => $b['fs']['total'] - $b['fs']['free'],
        ];

        $ncpu = max(1, $b['ncpu']);
        $consumers = [];
        foreach ($b['procs'] as $key => $p) {
            $prevTicks = $a['procs'][$key]['ticks'] ?? null;
            // Processo novo: nasceu durante o intervalo, conta todo o seu tempo de CPU.
            $ticks = $prevTicks === null ? $p['ticks'] : max(0, $p['ticks'] - $prevTicks);
            [$kind, $name] = self::classify($p);
            $id = $kind . ':' . $name;
            $c = $consumers[$id] ?? ['kind' => $kind, 'name' => $name, 'cpu' => 0.0, 'rss' => 0, 'procs' => 0];
            $c['cpu'] += $ticks;
            $c['rss'] += $p['rss'];
            $c['procs']++;
            $consumers[$id] = $c;
        }
        foreach ($consumers as &$c) {
            // % do servidor inteiro (100% = todos os CPUs ocupados).
            $c['cpu'] = round(100 * $c['cpu'] / self::CLK_TCK / $dt / $ncpu, 2);
        }
        unset($c);

        return ['server' => $server, 'consumers' => array_values($consumers), 'ncpu' => $ncpu];
    }

    /** Decide a que app ou serviço pertence um processo. */
    public static function classify(array $p): array
    {
        $comm = $p['comm'];
        if (str_starts_with($comm, 'php-fpm')) {
            if (preg_match('/pool\s+(\S+)/', $p['cmd'], $mm)) {
                $pool = $mm[1];
                // Pools da Cloudways chamam-se <app>-<versão PHP>, por exemplo bxkffgxjyc-84.
                $app = preg_replace('/-\d+$/', '', $pool);
                return ['app', $app];
            }
            return ['service', 'PHP-FPM (master)'];
        }
        static $map = [
            'mariadbd' => 'MariaDB', 'mysqld' => 'MariaDB',
            'varnishd' => 'Varnish', 'cache-main' => 'Varnish',
            'nginx' => 'Nginx', 'apache2' => 'Apache', 'httpd' => 'Apache',
            'redis-server' => 'Redis', 'memcached' => 'Memcached',
            'elasticsearch' => 'Elasticsearch', 'java' => 'Elasticsearch',
            'php' => 'PHP CLI (cron, wp-cli)', 'php8.1' => 'PHP CLI (cron, wp-cli)',
            'php8.2' => 'PHP CLI (cron, wp-cli)', 'php8.3' => 'PHP CLI (cron, wp-cli)',
            'php8.4' => 'PHP CLI (cron, wp-cli)', 'wp' => 'PHP CLI (cron, wp-cli)',
        ];
        if (isset($map[$comm])) {
            return ['service', $map[$comm]];
        }
        if (str_starts_with($comm, 'imunify') || str_starts_with($comm, 'i360') || str_starts_with($comm, 'aibolit')) {
            return ['service', 'Imunify360'];
        }
        return ['service', 'Sistema e outros'];
    }

    public static function cpuTimes(): array
    {
        $line = strtok((string) @file_get_contents('/proc/stat'), "\n");
        $v = array_map('intval', array_slice(preg_split('/\s+/', trim((string) $line)), 1));
        $keys = ['user', 'nice', 'system', 'idle', 'iowait', 'irq', 'softirq', 'steal'];
        $out = [];
        foreach ($keys as $i => $k) {
            $out[$k] = $v[$i] ?? 0;
        }
        return $out;
    }

    public static function ncpu(): int
    {
        return max(1, preg_match_all('/^cpu\d+\s/m', (string) @file_get_contents('/proc/stat')));
    }

    public static function meminfo(): array
    {
        $out = ['MemTotal' => 0, 'MemAvailable' => 0, 'Cached' => 0, 'Buffers' => 0, 'SwapTotal' => 0, 'SwapFree' => 0];
        foreach (file('/proc/meminfo', FILE_IGNORE_NEW_LINES) ?: [] as $l) {
            if (preg_match('/^(\w+):\s+(\d+)/', $l, $m) && array_key_exists($m[1], $out)) {
                $out[$m[1]] = (int) $m[2] * 1024;
            }
        }
        return $out;
    }

    public static function loadavg(): array
    {
        $p = explode(' ', (string) @file_get_contents('/proc/loadavg'));
        return [(float) ($p[0] ?? 0), (float) ($p[1] ?? 0), (float) ($p[2] ?? 0)];
    }

    /** PSI "some avg10": % do tempo em que algum processo esperou pelo recurso. */
    public static function pressure(string $res): ?float
    {
        $s = @file_get_contents("/proc/pressure/$res");
        return ($s !== false && preg_match('/some avg10=([\d.]+)/', $s, $m)) ? (float) $m[1] : null;
    }

    /** Bytes lidos/escritos acumulados nos discos físicos (sem partições). */
    public static function diskIo(): array
    {
        static $disks = null;
        if ($disks === null) {
            $disks = [];
            foreach (@scandir('/sys/block') ?: [] as $d) {
                if ($d[0] !== '.' && !preg_match('/^(loop|ram|sr|zram|dm-|md|nbd)/', $d)) {
                    $disks[$d] = true;
                }
            }
        }
        $r = $w = 0;
        foreach (file('/proc/diskstats', FILE_IGNORE_NEW_LINES) ?: [] as $l) {
            $f = preg_split('/\s+/', trim($l));
            if (isset($f[9], $disks[$f[2]])) {
                $r += (int) $f[5] * 512;
                $w += (int) $f[9] * 512;
            }
        }
        return [$r, $w];
    }

    public static function netIo(): array
    {
        $rx = $tx = 0;
        foreach (array_slice(file('/proc/net/dev', FILE_IGNORE_NEW_LINES) ?: [], 2) as $l) {
            [$ifc, $rest] = array_pad(explode(':', $l, 2), 2, '');
            if (trim($ifc) === 'lo') {
                continue;
            }
            $f = preg_split('/\s+/', trim($rest));
            $rx += (int) ($f[0] ?? 0);
            $tx += (int) ($f[8] ?? 0);
        }
        return [$rx, $tx];
    }

    /**
     * Todos os processos visíveis: [chave => [comm, cmd, ticks, rss]].
     * A chave junta pid e starttime para não confundir pids reutilizados.
     */
    public static function processes(): array
    {
        $out = [];
        foreach (glob('/proc/[0-9]*/stat', GLOB_NOSORT) ?: [] as $file) {
            $s = @file_get_contents($file);
            if ($s === false) {
                continue;
            }
            $l = strpos($s, '(');
            $r = strrpos($s, ')');
            if ($l === false || $r === false) {
                continue;
            }
            $pid = (int) substr($s, 0, $l);
            $comm = substr($s, $l + 1, $r - $l - 1);
            $f = explode(' ', substr($s, $r + 2));
            // Depois de ")": [0]=state ... [11]=utime [12]=stime [19]=starttime [21]=rss (páginas)
            if (!isset($f[21])) {
                continue;
            }
            if ((int) $f[21] === 0 && (int) $f[11] === 0) {
                continue; // threads do kernel
            }
            $cmd = '';
            if (str_starts_with($comm, 'php-fpm')) {
                $cmd = trim(str_replace("\0", ' ', (string) @file_get_contents("/proc/$pid/cmdline")));
            }
            $out[$pid . '.' . $f[19]] = [
                'comm'  => $comm,
                'cmd'   => $cmd,
                'ticks' => (int) $f[11] + (int) $f[12],
                'rss'   => (int) $f[21] * self::PAGE,
            ];
        }
        return $out;
    }
}
