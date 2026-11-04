<?php
declare(strict_types=1);

require __DIR__ . '/../src/web.php';

web_init();
$user = require_user(true);
session_write_close(); // não bloquear outros pedidos da mesma sessão

// Qualquer falha (por exemplo a base de dados momentaneamente ocupada) devolve um
// erro curto em JSON; o dashboard volta a tentar no ciclo seguinte.
set_exception_handler(static function (Throwable $e): void {
    $busy = str_contains($e->getMessage(), 'database is locked') || str_contains($e->getMessage(), 'busy');
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    header('Retry-After: 5');
    echo json_encode(['error' => $busy ? 'ocupado' : 'erro interno']);
    error_log('wlmon api: ' . $e->getMessage());
});

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
    $logs = $store ? (int) $store->meta('logs_last_run') : 0;
    json_out([
        'ts' => time(),
        'ncpu' => $r['ncpu'],
        'server_name' => $cfg['server_name'],
        'server' => $r['server'],
        'consumers' => array_map($describe, array_values($list)),
        'collector' => ['last_sample' => $last ?: null, 'age' => $last ? time() - $last : null,
            'logs_age' => $logs ? time() - $logs : null],
    ]);
}

if ($action === 'history') {
    if (!$store) {
        json_out(['ts' => [], 'server' => [], 'consumers' => [], 'empty' => true]);
    }
    $h = $store->history((string) ($_GET['range'] ?? '1h'), time());
    $h['consumers'] = array_map($describe, array_values(array_filter($h['consumers'], $visible)));
    // Tráfego de cada site no mesmo período, com a mesma chave que os consumidores.
    $spans = ['1h' => 3600, '6h' => 21600, '24h' => 86400, '7d' => 604800, '30d' => 2592000];
    $h['traffic'] = [];
    foreach (Traffic::summary($store, time() - ($spans[$h['range']] ?? 3600)) as $id => $t) {
        if (isset($hidden[$id])) {
            continue;
        }
        $key = $describe(['kind' => 'app', 'name' => $id]);
        $h['traffic'][$key['id'] ?? $key['label']] = $t;
    }
    json_out($h);
}

/** Resolve o site pedido: o admin usa o id interno, o cliente o nome (domínio). */
$findSite = static function () use ($store, $apps, $cfg, $hidden, $isAdmin): string {
    $key = (string) ($_GET['app'] ?? '');
    foreach ($apps as $aid => $a) {
        $label = $cfg['labels'][$aid] ?? $a['label'];
        if (!isset($hidden[$aid]) && $a['type'] !== 'monitor' && (($isAdmin && $aid === $key) || $label === $key)) {
            return $aid;
        }
    }
    http_response_code(404);
    json_out(['error' => 'site desconhecido']);
};

if ($action === 'site') {
    if (!$store) {
        json_out(['error' => 'sem dados']);
    }
    $id = $findSite();
    $range = in_array($_GET['range'] ?? '', ['today', 'yesterday', '7d', '30d'], true) ? $_GET['range'] : 'today';
    $data = Traffic::site($store, $id, $range, time(), $isAdmin);
    $data['app'] = $describe(['kind' => 'app', 'name' => $id]);
    $data['ncpu'] = (int) $store->meta('ncpu') ?: 1;
    $logs = (int) $store->meta('logs_last_run');
    $data['logs_age'] = $logs ? time() - $logs : null;
    json_out($data);
}

if ($action === 'wp') {
    if (!$store) {
        json_out(['error' => 'sem dados']);
    }
    $id = $findSite();
    $wp = WpScan::latest($store, $id, 'wp');
    $up = WpScan::latest($store, $id, 'uploads');
    if (!$isAdmin) {
        // O cliente vê tamanhos e contagens; nomes de opções e caminhos de ficheiros ficam para a equipa.
        unset($wp['db']['autoload_top'], $up['big'], $wp['db']['errors']);
    }
    json_out([
        'now' => time(),
        'app' => $describe(['kind' => 'app', 'name' => $id]),
        'wp' => $wp,
        'uploads' => $up,
        'trend' => WpScan::trend($store, $id),
    ]);
}

if ($action === 'advice') {
    if (!$store) {
        json_out(['items' => []]);
    }
    $only = isset($_GET['app']) && $_GET['app'] !== '' ? $findSite() : null;
    $items = [];
    foreach (Advice::all($store, time(), $hidden) as $r) {
        if ($only !== null && $r['app'] !== $only) {
            continue;
        }
        if ($r['app'] !== null) {
            $d = $describe(['kind' => 'app', 'name' => $r['app']]);
            $r['site'] = ['label' => $d['label'], 'key' => $d['id'] ?? $d['label']];
        }
        unset($r['app']);
        $items[] = $isAdmin ? $r : Advice::forClient($r);
    }
    $count = array_count_values(array_column($items, 'severity'));
    json_out(['items' => $items, 'counts' => ['crit' => $count['crit'] ?? 0, 'warn' => $count['warn'] ?? 0, 'info' => $count['info'] ?? 0]]);
}

http_response_code(400);
json_out(['error' => 'ação desconhecida']);
