<?php
declare(strict_types=1);

/**
 * Coletor. Corre a cada minuto pelo crontab do master:
 *   * * * * * php /caminho/para/public_html/bin/collect.php >/dev/null 2>&1
 *
 * Em cada execução tira 6 amostras (uma a cada 10 s) e depois agrega e limpa.
 *
 * Opções:
 *   --once       uma única amostra (útil para testar)
 *   --discover   força a descoberta das apps e dos URLs
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';
require __DIR__ . '/../src/apps.php';

umask(0002);
$cfg = mon_config();
$opts = getopt('', ['once', 'discover']);
$interval = max(5, (int) $cfg['sample_interval']);

$dataDir = rtrim($cfg['data_dir'], '/');
if (!is_dir($dataDir)) {
    mkdir($dataDir, 02775, true);
}
$logFile = "$dataDir/collect.log";
$log = static function (string $msg) use ($logFile): void {
    if (@filesize($logFile) > 1_000_000) {
        @rename($logFile, "$logFile.1");
    }
    @file_put_contents($logFile, date('c') . " $msg\n", FILE_APPEND);
};

// Impede execuções sobrepostas.
$lock = fopen("$dataDir/collect.lock", 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
    exit(0);
}

$start = time();
try {
    $store = Store::openWrite();

    if (isset($opts['discover']) || $start - (int) $store->meta('apps_at') > 6 * 3600) {
        Apps::save($store, Apps::discover());
        $store->setMeta('apps_at', (string) $start);
    }
    $store->setMeta('ncpu', (string) Procfs::ncpu());
    $store->setMeta('hostname', (string) gethostname());

    $prev = Procfs::snapshot();
    $samples = isset($opts['once']) ? 1 : intdiv(60, $interval);
    for ($i = 0; $i < $samples; $i++) {
        // Alinha cada amostra ao múltiplo seguinte do intervalo (…:00, :10, :20…).
        $next = (intdiv((int) floor(microtime(true)), $interval) + 1) * $interval;
        if (isset($opts['once'])) {
            usleep(1_000_000);
        } else {
            if ($next - $start > 58) {
                break; // não invadir a execução do minuto seguinte
            }
            time_sleep_until((float) $next);
        }
        $cur = Procfs::snapshot();
        $ts = isset($opts['once']) ? time() : $next;
        try {
            $store->insertSample($ts, Procfs::rates($prev, $cur));
            $store->setMeta('last_sample', (string) $ts);
        } catch (PDOException $e) {
            // Base de dados ocupada além do busy_timeout: perde-se só esta amostra.
            $log('AVISO amostra perdida: ' . $e->getMessage());
        }
        $prev = $cur;
    }

    $store->rollupAndPrune(time());
    $store->setMeta('last_run', (string) time());
    $store->setMeta('version', MON_VERSION);
} catch (Throwable $e) {
    $log('ERRO ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    exit(1);
}
