<?php
declare(strict_types=1);

require __DIR__ . '/../src/web.php';

web_init();
$user = require_user(true);
session_write_close(); // não bloquear outros pedidos da mesma sessão

$cfg = mon_config();
$store = Store::openRead();
$apps = $store ? $store->apps() : [];
$hidden = array_flip($cfg['hidden_apps']);
$isAdmin = $user['role'] === 'admin';

$visible = static fn(array $c): bool => !($c['kind'] === 'app' && isset($hidden[$c['name']]));

/** Junta label, URL e versão PHP a cada app. O cliente não vê os identificadores internos. */
$describe = static function (array $c) use ($apps, $cfg, $isAdmin): array {
    $c['label'] = $c['name'];
    if ($c['kind'] === 'app') {
        $a = $apps[$c['name']] ?? null;
        $c['label'] = $cfg['labels'][$c['name']] ?? $a['label'] ?? $c['name'];
        $c['url'] = $a['url'] ?? null;
        $c['php'] = $a['php'] ?? null;
        $c['type'] = $a['type'] ?? null;
        $c['id'] = $isAdmin ? $c['name'] : null;
        $c['name'] = $c['label'];
    }
    return $c;
};

$action = $_GET['a'] ?? 'live';

if ($action === 'live') {
    $r = live_rates();
    $list = array_filter($r['consumers'], $visible);
    // Apps sem processos PHP neste instante continuam a aparecer, com zero.
    $seen = array_column(array_filter($list, fn($c) => $c['kind'] === 'app'), 'name', 'name');
    foreach ($apps as $id => $a) {
        if (!isset($seen[$id]) && !isset($hidden[$id])) {
            $list[] = ['kind' => 'app', 'name' => $id, 'cpu' => 0, 'rss' => 0, 'procs' => 0];
        }
    }
    $last = $store ? (int) $store->meta('last_sample') : 0;
    json_out([
        'ts' => time(),
        'ncpu' => $r['ncpu'],
        'server_name' => $cfg['server_name'],
        'server' => $r['server'],
        'consumers' => array_map($describe, array_values($list)),
        'collector' => ['last_sample' => $last ?: null, 'age' => $last ? time() - $last : null],
    ]);
}

if ($action === 'history') {
    if (!$store) {
        json_out(['ts' => [], 'server' => [], 'consumers' => [], 'empty' => true]);
    }
    $h = $store->history((string) ($_GET['range'] ?? '1h'), time());
    $h['consumers'] = array_map($describe, array_values(array_filter($h['consumers'], $visible)));
    json_out($h);
}

http_response_code(400);
json_out(['error' => 'ação desconhecida']);
