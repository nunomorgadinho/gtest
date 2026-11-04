<?php
declare(strict_types=1);

/**
 * Análise de cada WordPress: base de dados, ficheiros, configuração e uploads.
 *
 * Só leitura. Liga-se à base de dados com as credenciais do wp-config.php (lidas no
 * momento, nunca guardadas), sem carregar o WordPress nem os plugins. Cada consulta
 * tem um limite de tempo para nunca pesar no servidor.
 */
final class WpScan
{
    /** Valores de autoload que o WordPress carrega em cada pedido (inclui os do WP 6.6+). */
    private const AUTOLOAD_ON = "('yes','on','auto-on','auto')";

    public static function migrate(PDO $db): void
    {
        $db->exec('CREATE TABLE IF NOT EXISTS wp_scan (app TEXT, kind TEXT, day TEXT, ts INTEGER, data TEXT,
            PRIMARY KEY (app, kind, day)) WITHOUT ROWID;');
    }

    /* ======================= Base de dados ======================= */

    public static function db(string $root): array
    {
        $c = Apps::wpDbConfig($root);
        if (!$c) {
            return ['error' => 'Não foi possível ler as credenciais do wp-config.php'];
        }
        if (!extension_loaded('mysqli')) {
            return ['error' => 'Extensão mysqli não disponível no PHP da linha de comandos'];
        }
        mysqli_report(MYSQLI_REPORT_OFF);
        $m = mysqli_init();
        $m->options(MYSQLI_OPT_CONNECT_TIMEOUT, 10);
        [$host, $port] = array_pad(explode(':', $c['host'], 2), 2, null);
        $socket = null;
        if ($port !== null && !ctype_digit($port)) {
            [$socket, $port] = [$port, null];
        }
        if (!@$m->real_connect($host ?: 'localhost', $c['user'], $c['pass'], $c['name'], $port ? (int) $port : null, $socket)) {
            return ['error' => 'Ligação à base de dados falhou: ' . mysqli_connect_error()];
        }
        $m->set_charset('utf8mb4');
        // Limites de segurança: só leitura e no máximo 30 s por consulta (MariaDB).
        @$m->query('SET SESSION max_statement_time = 30');
        @$m->query('SET SESSION TRANSACTION READ ONLY');

        $p = preg_replace('/[^A-Za-z0-9_]/', '', $c['prefix']);
        $q = static function (string $sql) use ($m): array {
            $r = @$m->query($sql);
            return $r instanceof mysqli_result ? $r->fetch_all(MYSQLI_ASSOC) : [];
        };
        $one = static fn(string $sql) => ($q($sql)[0] ?? []);
        $out = ['prefix' => $p, 'errors' => []];

        // Tabelas
        $tables = $q("SELECT table_name AS name, engine, table_rows AS rows_est,
                data_length + index_length AS bytes, data_free AS free
            FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY bytes DESC");
        $out['tables'] = array_map(static fn($t) => [
            'name' => $t['name'], 'engine' => $t['engine'], 'rows' => (int) $t['rows_est'],
            'bytes' => (int) $t['bytes'], 'free' => (int) $t['free'],
        ], $tables);
        $names = array_flip(array_column($out['tables'], 'name'));
        $out['db_bytes'] = array_sum(array_column($out['tables'], 'bytes'));
        $out['db_free'] = array_sum(array_column($out['tables'], 'free'));
        $out['myisam'] = count(array_filter($out['tables'], static fn($t) => strcasecmp((string) $t['engine'], 'MyISAM') === 0));

        if (!isset($names["{$p}options"])) {
            $out['errors'][] = "Tabela {$p}options não encontrada";
            $m->close();
            return $out;
        }

        // Opções com autoload: carregadas em todos os pedidos
        $a = $one("SELECT COUNT(*) n, COALESCE(SUM(LENGTH(option_value)), 0) b FROM {$p}options WHERE autoload IN " . self::AUTOLOAD_ON);
        $out['autoload'] = ['count' => (int) ($a['n'] ?? 0), 'bytes' => (int) ($a['b'] ?? 0)];
        $out['autoload_top'] = array_map(static fn($r) => ['name' => $r['option_name'], 'bytes' => (int) $r['b']],
            $q("SELECT option_name, LENGTH(option_value) b FROM {$p}options WHERE autoload IN " . self::AUTOLOAD_ON . ' ORDER BY b DESC LIMIT 15'));

        // Transients
        $t = $one("SELECT COUNT(*) n, COALESCE(SUM(LENGTH(option_value)), 0) b FROM {$p}options
            WHERE (option_name LIKE '\\_transient\\_%' OR option_name LIKE '\\_site\\_transient\\_%')
              AND option_name NOT LIKE '\\_transient\\_timeout\\_%' AND option_name NOT LIKE '\\_site\\_transient\\_timeout\\_%'");
        $e = $one("SELECT COUNT(*) n FROM {$p}options
            WHERE (option_name LIKE '\\_transient\\_timeout\\_%' OR option_name LIKE '\\_site\\_transient\\_timeout\\_%')
              AND CAST(option_value AS UNSIGNED) < UNIX_TIMESTAMP()");
        $out['transients'] = ['count' => (int) ($t['n'] ?? 0), 'bytes' => (int) ($t['b'] ?? 0), 'expired' => (int) ($e['n'] ?? 0)];

        // Opções-chave (lidas como texto; arrays serializados nunca instanciam classes)
        $opts = [];
        foreach ($q("SELECT option_name, option_value FROM {$p}options
                WHERE option_name IN ('home','siteurl','active_plugins','stylesheet','template','cron','db_version','blog_public')") as $r) {
            $opts[$r['option_name']] = $r['option_value'];
        }
        $un = static fn(?string $v) => is_string($v) ? @unserialize($v, ['allowed_classes' => false]) : false;
        $out['home'] = $opts['home'] ?? null;
        $out['theme'] = ['stylesheet' => $opts['stylesheet'] ?? null, 'template' => $opts['template'] ?? null];
        $out['blog_public'] = isset($opts['blog_public']) ? (int) $opts['blog_public'] : null;
        $active = $un($opts['active_plugins'] ?? null);
        $out['active_plugins'] = is_array($active) ? array_values(array_map('strval', $active)) : [];
        $out['cron'] = self::cronSummary($un($opts['cron'] ?? null), strlen($opts['cron'] ?? ''));

        // Conteúdo e lixo acumulado
        if (isset($names["{$p}posts"])) {
            $rows = $q("SELECT post_type, post_status, COUNT(*) n FROM {$p}posts GROUP BY post_type, post_status");
            $sum = static fn(callable $f) => array_sum(array_map(static fn($r) => $f($r) ? (int) $r['n'] : 0, $rows));
            $out['posts'] = [
                'total' => $sum(static fn($r) => true),
                'revisions' => $sum(static fn($r) => $r['post_type'] === 'revision'),
                'auto_drafts' => $sum(static fn($r) => $r['post_status'] === 'auto-draft'),
                'trash' => $sum(static fn($r) => $r['post_status'] === 'trash'),
                'published' => $sum(static fn($r) => $r['post_status'] === 'publish'),
            ];
            $types = [];
            foreach ($rows as $r) {
                if ($r['post_status'] === 'publish') {
                    $types[$r['post_type']] = ($types[$r['post_type']] ?? 0) + (int) $r['n'];
                }
            }
            arsort($types);
            $out['posts']['types'] = array_slice($types, 0, 10, true);
            if (isset($names["{$p}postmeta"])) {
                $o = $one("SELECT COUNT(*) n FROM {$p}postmeta pm LEFT JOIN {$p}posts po ON po.ID = pm.post_id WHERE po.ID IS NULL");
                $out['posts']['orphan_meta'] = isset($o['n']) ? (int) $o['n'] : null;
                $o = $one("SELECT COUNT(*) n FROM {$p}postmeta pm JOIN {$p}posts po ON po.ID = pm.post_id WHERE po.post_type = 'revision'");
                $out['posts']['revision_meta'] = isset($o['n']) ? (int) $o['n'] : null;
            }
        }
        if (isset($names["{$p}comments"])) {
            $c2 = [];
            foreach ($q("SELECT comment_approved s, COUNT(*) n FROM {$p}comments GROUP BY comment_approved") as $r) {
                $c2[(string) $r['s']] = (int) $r['n'];
            }
            $out['comments'] = ['approved' => $c2['1'] ?? 0, 'pending' => $c2['0'] ?? 0,
                'spam' => $c2['spam'] ?? 0, 'trash' => ($c2['trash'] ?? 0) + ($c2['post-trashed'] ?? 0)];
        }

        // Action Scheduler (WooCommerce e muitos plugins)
        if (isset($names["{$p}actionscheduler_actions"])) {
            $st = [];
            foreach ($q("SELECT status, COUNT(*) n FROM {$p}actionscheduler_actions GROUP BY status") as $r) {
                $st[$r['status']] = (int) $r['n'];
            }
            $late = $one("SELECT COUNT(*) n FROM {$p}actionscheduler_actions WHERE status = 'pending'
                AND scheduled_date_gmt < UTC_TIMESTAMP() - INTERVAL 10 MINUTE");
            $hooks = $q("SELECT hook, COUNT(*) n FROM {$p}actionscheduler_actions WHERE status IN ('pending','failed')
                GROUP BY hook ORDER BY n DESC LIMIT 8");
            $out['action_scheduler'] = ['status' => $st, 'late' => (int) ($late['n'] ?? 0),
                'hooks' => array_map(static fn($h) => ['hook' => $h['hook'], 'n' => (int) $h['n']], $hooks)];
        }

        $m->close();
        return $out;
    }

    /** Resume o array "cron" do WordPress: eventos, atrasos e os hooks mais frequentes. */
    public static function cronSummary(mixed $cron, int $bytes): array
    {
        $out = ['events' => 0, 'overdue' => 0, 'bytes' => $bytes, 'hooks' => [], 'frequent' => 0];
        if (!is_array($cron)) {
            return $out;
        }
        $now = time();
        $hooks = [];
        foreach ($cron as $ts => $byHook) {
            if (!is_int($ts) || !is_array($byHook)) {
                continue;
            }
            foreach ($byHook as $hook => $events) {
                foreach ((array) $events as $ev) {
                    $out['events']++;
                    if ($ts < $now - 600) {
                        $out['overdue']++;
                    }
                    $h = &$hooks[(string) $hook];
                    $h ??= ['hook' => (string) $hook, 'n' => 0, 'interval' => null, 'overdue' => 0];
                    $h['n']++;
                    $iv = is_array($ev) && isset($ev['interval']) ? (int) $ev['interval'] : null;
                    if ($iv && ($h['interval'] === null || $iv < $h['interval'])) {
                        $h['interval'] = $iv;
                    }
                    if ($ts < $now - 600) {
                        $h['overdue']++;
                    }
                    unset($h);
                }
            }
        }
        usort($hooks, static fn($a, $b) => [$b['overdue'], $b['n']] <=> [$a['overdue'], $a['n']]);
        $out['frequent'] = count(array_filter($hooks, static fn($h) => $h['interval'] !== null && $h['interval'] < 300));
        $out['hooks'] = array_slice($hooks, 0, 15);
        return $out;
    }

    /* ======================= Ficheiros e configuração ======================= */

    public static function fs(string $root): array
    {
        $wpc = (string) @file_get_contents("$root/wp-config.php");
        $content = "$root/wp-content";
        $out = [
            'wp_version' => preg_match("/wp_version\\s*=\\s*'([^']+)'/", (string) @file_get_contents("$root/wp-includes/version.php"), $m) ? $m[1] : null,
            'config' => self::configFlags($wpc),
            'object_cache' => self::dropIn("$content/object-cache.php"),
            'page_cache' => self::dropIn("$content/advanced-cache.php"),
            'debug_log' => is_file("$content/debug.log") ? (int) filesize("$content/debug.log") : null,
            'plugins' => self::plugins("$content/plugins"),
            'mu_plugins' => array_values(array_map('basename', glob("$content/mu-plugins/*.php") ?: [])),
            'themes' => array_values(array_map('basename', glob("$content/themes/*", GLOB_ONLYDIR) ?: [])),
        ];
        return $out;
    }

    /** Constantes relevantes definidas no wp-config.php (sem o executar). */
    public static function configFlags(string $src): array
    {
        $keys = ['WP_DEBUG', 'WP_DEBUG_LOG', 'WP_DEBUG_DISPLAY', 'DISABLE_WP_CRON', 'WP_CACHE', 'WP_POST_REVISIONS',
            'WP_MEMORY_LIMIT', 'WP_MAX_MEMORY_LIMIT', 'AUTOSAVE_INTERVAL', 'EMPTY_TRASH_DAYS', 'WP_CRON_LOCK_TIMEOUT',
            'WP_ENVIRONMENT_TYPE', 'DISALLOW_FILE_EDIT', 'WP_REDIS_HOST', 'WP_CACHE_KEY_SALT'];
        $out = [];
        foreach ($keys as $k) {
            if (preg_match("/^[^\\/#\\n]*define\\(\\s*['\"]{$k}['\"]\\s*,\\s*(.+?)\\s*\\)\\s*;/mi", $src, $m)) {
                $v = trim($m[1]);
                $out[$k] = match (true) {
                    strcasecmp($v, 'true') === 0 => true,
                    strcasecmp($v, 'false') === 0 => false,
                    is_numeric($v) => $v + 0,
                    (bool) preg_match('/^([\'"])(.*)\1$/s', $v, $q) => $q[2],
                    default => $v,
                };
            }
        }
        return $out;
    }

    /** Identifica um drop-in (object-cache.php, advanced-cache.php) pelo cabeçalho ou conteúdo. */
    public static function dropIn(string $file): ?string
    {
        if (!is_file($file)) {
            return null;
        }
        $head = (string) @file_get_contents($file, false, null, 0, 8192);
        if (preg_match('/Plugin Name:\s*(.+)/i', $head, $m)) {
            return trim($m[1]);
        }
        foreach (['Redis' => 'Redis', 'Memcache' => 'Memcached', 'WP Rocket' => 'WP Rocket', 'W3 Total Cache' => 'W3 Total Cache',
                     'LiteSpeed' => 'LiteSpeed Cache', 'Breeze' => 'Breeze', 'WP Super Cache' => 'WP Super Cache',
                     'wp-fastest-cache' => 'WP Fastest Cache', 'Batcache' => 'Batcache', 'Object Cache Pro' => 'Object Cache Pro'] as $needle => $name) {
            if (stripos($head, $needle) !== false) {
                return $name;
            }
        }
        return 'Desconhecido';
    }

    /** Plugins instalados: pasta, nome e versão, lidos do cabeçalho do ficheiro principal. */
    public static function plugins(string $dir): array
    {
        $out = [];
        $read = static function (string $file): ?array {
            $head = (string) @file_get_contents($file, false, null, 0, 8192);
            if (!preg_match('/^[ \t\/*#@]*Plugin Name:\s*(.+)$/mi', $head, $n)) {
                return null;
            }
            $v = preg_match('/^[ \t\/*#@]*Version:\s*(.+)$/mi', $head, $vm) ? trim($vm[1]) : null;
            return ['name' => trim($n[1]), 'version' => $v];
        };
        foreach (glob("$dir/*", GLOB_ONLYDIR) ?: [] as $d) {
            foreach (glob("$d/*.php") ?: [] as $f) {
                if ($info = $read($f)) {
                    $out[] = ['file' => basename($d) . '/' . basename($f)] + $info;
                    break;
                }
            }
        }
        foreach (glob("$dir/*.php") ?: [] as $f) {
            if ($info = $read($f)) {
                $out[] = ['file' => basename($f)] + $info;
            }
        }
        return $out;
    }

    /* ======================= Uploads ======================= */

    /**
     * Composição da pasta de uploads: originais, miniaturas geradas pelo WordPress,
     * cópias WebP/AVIF, vídeo e documentos; por ano; e os maiores ficheiros.
     * Percorre todos os ficheiros, por isso corre no máximo uma vez por semana.
     */
    public static function uploads(string $root): array
    {
        $dir = "$root/wp-content/uploads";
        $out = ['bytes' => 0, 'files' => 0, 'cats' => [], 'years' => [], 'big' => [], 'big_count' => 0, 'big_bytes' => 0];
        if (!is_dir($dir)) {
            return $out;
        }
        $cat = static function (string $name): string {
            if (preg_match('/-\d+x\d+\.(jpe?g|png|gif|webp|avif)$/i', $name)) {
                return 'thumbs';
            }
            if (preg_match('/\.(jpe?g|png|gif)\.(webp|avif)$/i', $name)) {
                return 'converted';
            }
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            return match (true) {
                in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg', 'bmp', 'tif', 'tiff', 'heic'], true) => 'images',
                in_array($ext, ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v', 'mp3', 'wav', 'm4a', 'ogg'], true) => 'media',
                in_array($ext, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'csv', 'txt'], true) => 'docs',
                default => 'other',
            };
        };
        $big = new SplMinHeap();
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY,
            RecursiveIteratorIterator::CATCH_GET_CHILD
        );
        $prefix = strlen($dir) + 1;
        foreach ($it as $f) {
            if (!$f->isFile() || $f->isLink()) {
                continue;
            }
            $size = $f->getSize();
            $rel = substr($f->getPathname(), $prefix);
            $c = $cat($f->getFilename());
            $out['files']++;
            $out['bytes'] += $size;
            $out['cats'][$c]['files'] = ($out['cats'][$c]['files'] ?? 0) + 1;
            $out['cats'][$c]['bytes'] = ($out['cats'][$c]['bytes'] ?? 0) + $size;
            $year = preg_match('#^(\d{4})/#', $rel, $m) ? $m[1] : 'outros';
            $out['years'][$year] = ($out['years'][$year] ?? 0) + $size;
            if ($size >= 5 * 1048576) {
                $out['big_count']++;
                $out['big_bytes'] += $size;
                $big->insert([$size, $rel]);
                if ($big->count() > 15) {
                    $big->extract();
                }
            }
        }
        foreach ($big as [$size, $rel]) {
            $out['big'][] = ['path' => $rel, 'bytes' => $size];
        }
        usort($out['big'], static fn($a, $b) => $b['bytes'] <=> $a['bytes']);
        ksort($out['years']);
        return $out;
    }

    /* ======================= Armazenamento e leitura ======================= */

    public static function save(Store $s, string $app, string $kind, array $data): void
    {
        $now = time();
        $s->tx(function () use ($s, $app, $kind, $data, $now) {
            $s->db->prepare('INSERT OR REPLACE INTO wp_scan (app, kind, day, ts, data) VALUES (?,?,?,?,?)')
                ->execute([$app, $kind, date('Y-m-d', $now), $now, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]);
            $s->db->prepare('DELETE FROM wp_scan WHERE day < ?')->execute([date('Y-m-d', $now - 90 * 86400)]);
        });
    }

    public static function lastTs(Store $s, string $app, string $kind): int
    {
        $q = $s->db->prepare('SELECT MAX(ts) FROM wp_scan WHERE app = ? AND kind = ?');
        $q->execute([$app, $kind]);
        $v = (int) $q->fetchColumn();
        $q->closeCursor();
        return $v;
    }

    public static function latest(Store $s, string $app, string $kind): ?array
    {
        $q = $s->db->prepare('SELECT ts, data FROM wp_scan WHERE app = ? AND kind = ? ORDER BY ts DESC LIMIT 1');
        $q->execute([$app, $kind]);
        $r = $q->fetch(PDO::FETCH_ASSOC);
        $q->closeCursor();
        return $r ? ['ts' => (int) $r['ts']] + (json_decode($r['data'], true) ?: []) : null;
    }

    /** Evolução diária do tamanho da base de dados e do autoload (últimos 90 dias). */
    public static function trend(Store $s, string $app): array
    {
        $q = $s->db->prepare("SELECT day, data FROM wp_scan WHERE app = ? AND kind = 'wp' ORDER BY day");
        $q->execute([$app]);
        $out = [];
        foreach ($q as $r) {
            $d = json_decode($r['data'], true) ?: [];
            $out[] = ['day' => $r['day'], 'db' => $d['db']['db_bytes'] ?? null, 'autoload' => $d['db']['autoload']['bytes'] ?? null];
        }
        return $out;
    }
}
