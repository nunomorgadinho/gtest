<?php
declare(strict_types=1);

/**
 * Carregamento comum ao coletor (CLI) e ao dashboard (web).
 */

const MON_ROOT = __DIR__ . '/..';
const MON_VERSION = '0.2.0';

require __DIR__ . '/procfs.php';
require __DIR__ . '/store.php';
require __DIR__ . '/logs.php';
require __DIR__ . '/traffic.php';

function mon_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $defaults = [
        'apps_root'             => '/home/master/applications',
        'data_dir'              => MON_ROOT . '/data',
        'timezone'              => 'Europe/Lisbon',
        'server_name'           => 'Servidor',
        'labels'                => [],
        'hidden_apps'           => [],
        'sample_interval'       => 10,
        'retention_raw_hours'   => 48,
        'retention_rollup_days' => 90,
    ];
    $file = MON_ROOT . '/config/config.php';
    $user = is_file($file) ? require $file : [];
    $cfg = array_replace($defaults, is_array($user) ? $user : []);
    date_default_timezone_set($cfg['timezone']);
    return $cfg;
}

/** Nome da app Cloudways onde o próprio monitor está instalado (ou null). */
function mon_self_app(): ?string
{
    $root = realpath(mon_config()['apps_root']);
    $me = realpath(MON_ROOT);
    if ($root === false || $me === false || !str_starts_with($me, $root . '/')) {
        return null;
    }
    $rel = substr($me, strlen($root) + 1);
    return explode('/', $rel)[0] ?: null;
}

function mon_users(): array
{
    $file = MON_ROOT . '/config/users.php';
    if (!is_file($file)) {
        return [];
    }
    $users = require $file;
    return is_array($users) ? $users : [];
}
