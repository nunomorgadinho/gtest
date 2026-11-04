<?php
declare(strict_types=1);

/**
 * Análise do WordPress de cada site. Corre de hora a hora pelo crontab do master
 * e só faz trabalho quando os dados estão desatualizados:
 *   - base de dados, plugins e configuração: uma vez por dia;
 *   - composição dos uploads (percorre todos os ficheiros): uma vez por semana.
 *
 *   17 * * * * nice -n 15 ionice -c3 php /caminho/para/public_html/bin/wpscan.php >/dev/null 2>&1
 *
 * Opções:
 *   --app=<id>   só este site
 *   --force      ignora a idade dos dados (base de dados e ficheiros)
 *   --uploads    força também a análise dos uploads
 *   --no-uploads não analisa os uploads nesta execução
 *   --verbose    mostra o que está a fazer
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';

umask(0002);
set_time_limit(0);
$cfg = mon_config();
$opt = getopt('', ['app:', 'force', 'uploads', 'no-uploads', 'verbose']);
$verbose = isset($opt['verbose']);
$say = static function (string $m) use ($verbose): void {
    if ($verbose) {
        echo $m, "\n";
    }
};
$dataDir = rtrim($cfg['data_dir'], '/');
$lock = fopen("$dataDir/wpscan.lock", 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
    $say('Já está a correr.');
    exit(0);
}

$store = Store::openWrite();
$apps = $store->apps();
$now = time();
$failed = false;

foreach ($apps as $id => $a) {
    if ($a['type'] !== 'wordpress' || (isset($opt['app']) && $opt['app'] !== $id)) {
        continue;
    }
    $root = rtrim($cfg['apps_root'], '/') . "/$id/public_html";
    try {
        // A análise corre sem nenhuma transação aberta; só a gravação é transacional.
        if (isset($opt['force']) || $now - WpScan::lastTs($store, $id, 'wp') > 20 * 3600) {
            $t = microtime(true);
            $data = ['db' => WpScan::db($root), 'fs' => WpScan::fs($root)];
            $data['duration'] = round(microtime(true) - $t, 2);
            WpScan::save($store, $id, 'wp', $data);
            $say(sprintf('%-12s base de dados e ficheiros em %.2f s%s', $id, $data['duration'],
                isset($data['db']['error']) ? ' (ERRO: ' . $data['db']['error'] . ')' : ''));
        }
        if (!isset($opt['no-uploads']) && (isset($opt['uploads']) || $now - WpScan::lastTs($store, $id, 'uploads') > 7 * 86400)) {
            $t = microtime(true);
            $data = WpScan::uploads($root);
            $data['duration'] = round(microtime(true) - $t, 2);
            WpScan::save($store, $id, 'uploads', $data);
            $say(sprintf('%-12s uploads: %d ficheiros em %.1f s', $id, $data['files'], $data['duration']));
        }
    } catch (Throwable $e) {
        $failed = true;
        @file_put_contents("$dataDir/collect.log", date('c') . " ERRO wpscan $id: " . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . "\n", FILE_APPEND);
        $say("$id ERRO: " . $e->getMessage());
    }
}
$store->setMeta('wpscan_last_run', (string) time());
exit($failed ? 1 : 0);
