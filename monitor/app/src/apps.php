<?php
declare(strict_types=1);

/**
 * Descobre as aplicações Cloudways e o URL de cada WordPress.
 * Corre só no coletor (como master). As credenciais da base de dados são lidas
 * do wp-config.php no momento e nunca são guardadas.
 */
final class Apps
{
    public static function discover(): array
    {
        $cfg = mon_config();
        $self = mon_self_app();
        $out = [];
        foreach (glob(rtrim($cfg['apps_root'], '/') . '/*', GLOB_ONLYDIR) ?: [] as $dir) {
            $id = basename($dir);
            $wpConfig = "$dir/public_html/wp-config.php";
            $type = $id === $self ? 'monitor' : (is_file($wpConfig) ? 'wordpress' : 'php');
            $url = $type === 'wordpress' ? self::wpHome("$dir/public_html") : null;
            $label = $cfg['labels'][$id] ?? null;
            if ($label === null) {
                $label = $type === 'monitor' ? 'Monitor (esta app)'
                    : ($url ? preg_replace('/^www\./', '', (string) parse_url($url, PHP_URL_HOST)) : $id);
            }
            $out[$id] = [
                'id' => $id, 'label' => $label, 'url' => $url,
                'php' => self::phpVersion($id), 'type' => $type, 'updated' => time(),
            ];
        }
        return $out;
    }

    /** Versão de PHP a partir do ficheiro do pool FPM (/etc/php/8.4/fpm/pool.d/<app>-84.conf). */
    public static function phpVersion(string $id): ?string
    {
        foreach (glob('/etc/php/*/fpm/pool.d/' . $id . '-*.conf') ?: [] as $f) {
            if (preg_match('#/etc/php/([\d.]+)/#', $f, $m)) {
                return $m[1];
            }
        }
        return null;
    }

    public static function wpHome(string $root): ?string
    {
        $c = self::wpDbConfig($root);
        if ($c && extension_loaded('mysqli')) {
            mysqli_report(MYSQLI_REPORT_OFF);
            $db = mysqli_init();
            $db->options(MYSQLI_OPT_CONNECT_TIMEOUT, 5);
            [$host, $port] = array_pad(explode(':', $c['host'], 2), 2, null);
            if (@$db->real_connect($host ?: 'localhost', $c['user'], $c['pass'], $c['name'], $port ? (int) $port : null)) {
                $prefix = preg_replace('/[^A-Za-z0-9_]/', '', $c['prefix']);
                $res = $db->query("SELECT option_value FROM {$prefix}options WHERE option_name = 'home' LIMIT 1");
                $row = $res ? $res->fetch_row() : null;
                $db->close();
                if ($row && $row[0]) {
                    return rtrim($row[0], '/');
                }
            }
        }
        // Alternativa: wp-cli a partir da pasta do site (o wp-config.php usa require relativo).
        if (function_exists('shell_exec')) {
            $cmd = 'cd ' . escapeshellarg($root) . ' && timeout 30 wp option get home --skip-plugins --skip-themes 2>/dev/null';
            $v = trim((string) shell_exec($cmd));
            if (preg_match('#^https?://\S+$#', $v)) {
                return rtrim($v, '/');
            }
        }
        return null;
    }

    /** Lê DB_NAME/USER/PASSWORD/HOST e table_prefix sem executar o wp-config.php. */
    public static function wpDbConfig(string $root): ?array
    {
        $src = @file_get_contents("$root/wp-config.php");
        if ($src === false) {
            return null;
        }
        $get = static function (string $k) use ($src): ?string {
            return preg_match("/define\(\s*['\"]{$k}['\"]\s*,\s*(['\"])(.*?)\\1\s*\)/s", $src, $m) ? $m[2] : null;
        };
        $prefix = preg_match('/\$table_prefix\s*=\s*([\'"])(.*?)\1/', $src, $m) ? $m[2] : 'wp_';
        $c = ['name' => $get('DB_NAME'), 'user' => $get('DB_USER'), 'pass' => $get('DB_PASSWORD'),
              'host' => $get('DB_HOST') ?? 'localhost', 'prefix' => $prefix];
        return ($c['name'] && $c['user'] !== null) ? $c : null;
    }

    public static function save(Store $s, array $apps): void
    {
        $s->db->beginTransaction();
        $s->db->exec('DELETE FROM apps');
        $st = $s->db->prepare('INSERT INTO apps (id,label,url,php,type,updated) VALUES (?,?,?,?,?,?)');
        foreach ($apps as $a) {
            $st->execute([$a['id'], $a['label'], $a['url'], $a['php'], $a['type'], $a['updated']]);
        }
        $s->db->commit();
    }
}
