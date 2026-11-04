<?php
// Copiar para config.php e ajustar. O install.sh faz isto automaticamente.
return [
    // Nome mostrado no topo do dashboard.
    'server_name' => 'Servidor Cloudways',

    // Onde estão as aplicações Cloudways.
    'apps_root' => '/home/master/applications',

    // Pasta dos dados (SQLite). Tem de ficar FORA da pasta pública.
    'data_dir' => __DIR__ . '/../data',

    'timezone' => 'Europe/Lisbon',

    // Nomes amigáveis por app (por omissão usa o domínio do WordPress).
    // 'labels' => ['bxkffgxjyc' => 'Pumpkin'],
    'labels' => [],

    // Apps a esconder do dashboard (por exemplo, staging).
    'hidden_apps' => [],

    // Intervalo entre amostras, em segundos.
    'sample_interval' => 10,

    // Retenção: amostras de 10 s e agregados de 5 minutos.
    'retention_raw_hours' => 48,
    'retention_rollup_days' => 90,
];
