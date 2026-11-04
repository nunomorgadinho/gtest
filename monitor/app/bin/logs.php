<?php
declare(strict_types=1);

/**
 * Leitura dos logs de cada site. Corre a cada 5 minutos pelo crontab do master:
 *   *\/5 * * * * php /caminho/para/public_html/bin/logs.php >/dev/null 2>&1
 *
 * Na primeira execução lê o log atual de cada tipo (normalmente as últimas
 * horas); depois só lê as linhas novas.
 *
 * Opções:
 *   --verbose   mostra o que foi lido
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';

umask(0002);
$cfg = mon_config();
$verbose = isset(getopt('', ['verbose'])['verbose']);
$dataDir = rtrim($cfg['data_dir'], '/');
if (!is_dir($dataDir)) {
    mkdir($dataDir, 02775, true);
}

$lock = fopen("$dataDir/logs.lock", 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
    exit(0);
}

$t0 = microtime(true);
try {
    $store = Store::openWrite();
    $apps = array_keys($store->apps());
    if (!$apps) {
        $apps = array_map('basename', glob(rtrim($cfg['apps_root'], '/') . '/*', GLOB_ONLYDIR) ?: []);
    }

    foreach ($apps as $app) {
        $dir = rtrim($cfg['apps_root'], '/') . "/$app/logs";
        if (!is_dir($dir)) {
            continue;
        }
        $agg = new Traffic($store);
        $units = LogParse::fpmUnits($app);
        $first = static fn(string $pattern): ?string => (glob("$dir/$pattern") ?: [null])[0];

        // Cada tipo de log: [ficheiro, função que trata cada linha].
        $sources = [
            'front'   => [$first('nginx-app.status.log'), function (string $l) use ($agg, $app) {
                if ($r = LogParse::combined($l)) {
                    $agg->front($app, $r);
                }
            }],
            'backend' => [$first('backend_*.access.log') ?? $first('apache_*.access.log'), function (string $l) use ($agg, $app) {
                if ($r = LogParse::combined($l)) {
                    $agg->backend($app, $r);
                }
            }],
            'static'  => [$first('static_*.access.log'), function (string $l) use ($agg, $app) {
                if ($r = LogParse::combined($l)) {
                    $agg->staticReq($app, $r);
                }
            }],
            'php'     => [$first('php-app.access.log'), function (string $l) use ($agg, $app, $units) {
                if ($r = LogParse::fpm($l, $units)) {
                    $agg->php($app, $r);
                }
            }],
            'errors'  => [$first('backend_*.error.log') ?? $first('apache_*.error.log'), function (string $l) use ($agg, $app) {
                if ($r = LogParse::phpErrors($l)) {
                    $agg->errors($app, $r[0], $r[1]);
                }
            }],
        ];

        foreach ($sources as $kind => [$file, $handle]) {
            if (!$file) {
                continue;
            }
            $lines = 0;
            // Análise sem locks; depois uma transação curta grava totais e posição juntos.
            $state = LogReader::read($store, $file, function (string $text) use ($handle, &$lines) {
                foreach (explode("\n", rtrim($text, "\n")) as $l) {
                    if ($l !== '') {
                        $handle($l);
                        $lines++;
                    }
                }
                return strlen($text);
            });
            if ($state === null) {
                continue;
            }
            $store->tx(function () use ($agg, $store, $state) {
                $agg->flush();
                LogReader::save($store, $state);
            });
            if ($verbose) {
                printf("%-12s %-8s %8d linhas %10d bytes\n", $app, $kind, $lines, $state['bytes']);
            }
        }

        // Slow log: blocos separados por linha em branco; um bloco incompleto fica para a próxima.
        $slowFile = $first('php-app.slow.log');
        if ($slowFile) {
            $n = 0;
            $state = LogReader::read($store, $slowFile, function (string $text) use ($agg, $app, &$n) {
                $end = strrpos($text, "\n\n");
                if ($end === false) {
                    return 0;
                }
                foreach (preg_split('/\n\s*\n/', substr($text, 0, $end)) as $block) {
                    if ($r = LogParse::slowBlock($block)) {
                        $agg->slowEntry($app, $r[0], $r[1], $r[2]);
                        $n++;
                    }
                }
                return $end + 2;
            });
            if ($state !== null) {
                $store->tx(function () use ($agg, $store, $state) {
                    $agg->flush();
                    LogReader::save($store, $state);
                });
            }
            if ($verbose) {
                printf("%-12s %-8s %8d blocos\n", $app, 'slow', $n);
            }
        }
    }

    Traffic::prune($store, time());
    $store->setMeta('logs_last_run', (string) time());
    $store->setMeta('logs_duration', (string) round(microtime(true) - $t0, 2));
    if ($verbose) {
        printf("Concluído em %.2f s\n", microtime(true) - $t0);
    }
} catch (Throwable $e) {
    @file_put_contents("$dataDir/collect.log", date('c') . ' ERRO logs: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . "\n", FILE_APPEND);
    if ($verbose) {
        fwrite(STDERR, $e->getMessage() . "\n");
    }
    exit(1);
}
