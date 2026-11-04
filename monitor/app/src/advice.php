<?php
declare(strict_types=1);

/**
 * Motor de recomendações: junta métricas do servidor, tráfego (logs) e a análise do
 * WordPress e produz uma lista de oportunidades de melhoria, ordenada por impacto.
 *
 * Cada recomendação tem:
 *   key, app (id ou null = servidor), severity (crit|warn|info), impact (alto|médio|baixo),
 *   area, effort, title, simple (para o cliente), tech (para a equipa), evidence[], actions[].
 */
final class Advice
{
    private const SEV = ['crit' => 3, 'warn' => 2, 'info' => 1];
    private const IMP = ['alto' => 3, 'médio' => 2, 'baixo' => 1];

    private const AI_BOTS = ['GPTBot (OpenAI)', 'ClaudeBot (Anthropic)', 'PerplexityBot', 'Bytespider (TikTok)', 'CCBot', 'Amazonbot', 'Meta (Facebook)'];
    private const SEO_BOTS = ['AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot (Moz)', 'DataForSeoBot', 'PetalBot', 'BLEXBot', 'Barkrowler'];

    private array $out = [];

    private function __construct(private Store $s, private int $now)
    {
    }

    /** Todas as recomendações (servidor e sites), ordenadas da mais à menos importante. */
    public static function all(Store $s, int $now, array $hidden = []): array
    {
        $a = new self($s, $now);
        $apps = $s->apps();
        $server = $a->serverStats();
        $a->serverRules($server, $apps);
        foreach ($apps as $id => $app) {
            if ($app['type'] !== 'wordpress' || isset($hidden[$id])) {
                continue;
            }
            $a->siteRules($id, $app, $server);
        }
        usort($a->out, static fn($x, $y) => self::score($y) <=> self::score($x) ?: strcmp($x['key'], $y['key']));
        return $a->out;
    }

    public static function score(array $r): int
    {
        return self::SEV[$r['severity']] * 10 + self::IMP[$r['impact']] * 5 + (int) ($r['weight'] ?? 0);
    }

    private function add(array $r): void
    {
        $this->out[] = $r + ['app' => null, 'effort' => 'baixo', 'evidence' => [], 'actions' => [], 'tech' => '', 'weight' => 0];
    }

    /* ---------------- Formatação ---------------- */

    private static function n(float|int|null $v, int $dec = 0): string
    {
        return number_format((float) $v, $dec, ',', ' ');
    }

    private static function b(float|int|null $v): string
    {
        $v = (float) $v;
        $u = ['B', 'KB', 'MB', 'GB', 'TB'];
        $i = 0;
        while ($v >= 1024 && $i < 4) {
            $v /= 1024;
            $i++;
        }
        return self::n($v, $i >= 2 && $v < 10 ? 1 : 0) . ' ' . $u[$i];
    }

    private static function plural(int $n, string $one, string $many): string
    {
        return self::n($n) . ' ' . ($n === 1 ? $one : $many);
    }

    /** "plugin: x" -> "o plugin x", "tema: x" -> "o tema x". */
    private static function component(string $c): string
    {
        if (preg_match('/^(plugin|mu-plugin|tema): (.+)$/', $c, $m)) {
            return "o {$m[1]} {$m[2]}";
        }
        return 'o núcleo do WordPress';
    }

    private static function secs(float $s): string
    {
        if ($s < 1) {
            return self::n($s * 1000) . ' ms';
        }
        if ($s < 120) {
            return self::n($s, 1) . ' s';
        }
        if ($s < 7200) {
            return self::n($s / 60) . ' min';
        }
        return self::n($s / 3600, 1) . ' h';
    }

    /* ---------------- Dados ---------------- */

    private function serverStats(): array
    {
        $from = $this->now - 7 * 86400;
        $q = $this->s->db->prepare('SELECT ts, cpu, mem_used, mem_total, swap_used FROM server_5m WHERE ts >= ? ORDER BY ts');
        $q->execute([$from]);
        $rows = $q->fetchAll(PDO::FETCH_ASSOC);
        $cpu = array_map(static fn($r) => (float) $r['cpu'], $rows);
        sort($cpu);
        $n = count($cpu);
        $last = $this->s->db->query('SELECT * FROM server ORDER BY ts DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC) ?: [];
        $memPct = array_map(static fn($r) => $r['mem_total'] > 0 ? 100 * $r['mem_used'] / $r['mem_total'] : 0, $rows);
        $span = $n ? ((int) end($rows)['ts'] - (int) $rows[0]['ts']) / 86400 : 0;

        // CPU média de cada site (pool PHP-FPM) na semana.
        $q = $this->s->db->prepare("SELECT name, AVG(cpu) cpu FROM consumer_5m WHERE kind = 'app' AND ts >= ? GROUP BY name");
        $q->execute([$from]);
        $appCpu = [];
        foreach ($q as $r) {
            $appCpu[$r['name']] = (float) $r['cpu'];
        }
        $q = $this->s->db->prepare("SELECT COUNT(*) FROM consumer WHERE kind = 'service' AND name = 'Redis' AND ts >= ?");
        $q->execute([$this->now - 86400]);
        $redis = (int) $q->fetchColumn() > 0;

        return [
            'span_days' => $span,
            'cpu_avg' => $n ? array_sum($cpu) / $n : null,
            'cpu_p95' => $n ? $cpu[(int) floor(0.95 * ($n - 1))] : null,
            'mem_avg' => $memPct ? array_sum($memPct) / count($memPct) : null,
            'swap_avg' => $rows ? array_sum(array_column($rows, 'swap_used')) / count($rows) : 0,
            'mem_total' => (float) ($last['mem_total'] ?? 0),
            'disk_total' => (float) ($last['disk_total'] ?? 0),
            'disk_used' => (float) ($last['disk_used'] ?? 0),
            'ncpu' => (int) $this->s->meta('ncpu') ?: 1,
            'app_cpu' => $appCpu,
            'redis' => $redis,
        ];
    }

    /** Dias efetivamente cobertos pelos logs de um site nos últimos 7 dias. */
    private function trafficSpan(string $app): float
    {
        $q = $this->s->db->prepare('SELECT MIN(ts), MAX(ts) FROM traffic_5m WHERE app = ? AND ts >= ?');
        $q->execute([$app, $this->now - 7 * 86400]);
        [$a, $b] = $q->fetch(PDO::FETCH_NUM) ?: [null, null];
        return $a ? max(300, (int) $b + 300 - (int) $a) / 86400 : 0.0;
    }

    /* ---------------- Servidor ---------------- */

    private function serverRules(array $sv, array $apps): void
    {
        if ($sv['disk_total'] > 0) {
            $pct = 100 * $sv['disk_used'] / $sv['disk_total'];
            if ($pct >= 80) {
                // Site com mais uploads, para apontar a causa.
                $big = null;
                foreach ($apps as $id => $a) {
                    $up = WpScan::latest($this->s, $id, 'uploads');
                    if ($up && (!$big || $up['bytes'] > $big[1])) {
                        $big = [$a['label'], $up['bytes']];
                    }
                }
                $this->add([
                    'key' => 'server.disk', 'severity' => $pct >= 90 ? 'crit' : 'warn', 'impact' => 'alto', 'area' => 'Disco', 'effort' => 'médio',
                    'title' => 'O disco do servidor está quase cheio',
                    'simple' => 'O disco está a ' . self::n($pct) . '% (' . self::b($sv['disk_total'] - $sv['disk_used']) . ' livres). Se encher, os sites deixam de conseguir gravar dados e podem deixar de funcionar.'
                        . ($big ? " Quem ocupa mais espaço são as imagens e ficheiros de {$big[0]} (" . self::b($big[1]) . ').' : ''),
                    'tech' => 'Usados ' . self::b($sv['disk_used']) . ' de ' . self::b($sv['disk_total']) . '. Ver a composição dos uploads na página de cada site.',
                    'evidence' => ['Disco: ' . self::n($pct) . '% usado', 'Livre: ' . self::b($sv['disk_total'] - $sv['disk_used'])],
                    'actions' => [
                        'Ver na página do site a composição dos uploads (originais, miniaturas e cópias WebP).',
                        'Remover tamanhos de miniatura que o tema não usa e voltar a gerar só os necessários.',
                        'Mover os uploads para armazenamento externo (S3, Cloudflare R2 ou Bunny) com um plugin de offload.',
                        'Aumentar o disco na Cloudways só se as medidas anteriores não chegarem.',
                    ],
                ]);
            }
        }
        if ($sv['cpu_avg'] === null || $sv['span_days'] < 1) {
            return;
        }
        $mem = $sv['mem_avg'] ?? 0;
        if ($sv['cpu_avg'] > 70 || $sv['cpu_p95'] > 90) {
            arsort($sv['app_cpu']);
            $top = array_key_first($sv['app_cpu']);
            $this->add([
                'key' => 'server.cpu', 'severity' => 'warn', 'impact' => 'alto', 'area' => 'CPU', 'effort' => 'médio',
                'title' => 'O servidor está perto do limite de CPU',
                'simple' => 'Na última semana a CPU esteve em média a ' . self::n($sv['cpu_avg']) . '% e nos picos a ' . self::n($sv['cpu_p95']) . '%. Nos picos os sites ficam mais lentos.',
                'tech' => 'CPU média ' . self::n($sv['cpu_avg'], 1) . '%, percentil 95 ' . self::n($sv['cpu_p95'], 1) . '%.' . ($top ? " Maior consumidor: {$apps[$top]['label']}." : ''),
                'evidence' => ['CPU média: ' . self::n($sv['cpu_avg']) . '%', 'Picos (p95): ' . self::n($sv['cpu_p95']) . '%'],
                'actions' => ['Aplicar primeiro as recomendações de cache e de robôs dos sites com mais consumo.', 'Só depois considerar aumentar o plano.'],
            ]);
        }
        if ($mem > 85 || $sv['swap_avg'] > 512 * 1048576) {
            $this->add([
                'key' => 'server.mem', 'severity' => 'warn', 'impact' => 'médio', 'area' => 'Memória', 'effort' => 'médio',
                'title' => 'A memória do servidor está quase toda ocupada',
                'simple' => 'A memória esteve em média a ' . self::n($mem) . '% na última semana. Quando falta memória, o servidor usa o disco (swap) e tudo fica mais lento.',
                'tech' => 'Memória média ' . self::n($mem, 1) . '%, swap médio ' . self::b($sv['swap_avg']) . '.',
                'evidence' => ['Memória média: ' . self::n($mem) . '%', 'Swap: ' . self::b($sv['swap_avg'])],
                'actions' => ['Rever o número máximo de processos PHP por site.', 'Reduzir a memória reservada à MariaDB se estiver sobredimensionada.'],
            ]);
        }
        // O objetivo principal: precisar de menos recursos.
        if ($sv['span_days'] >= 3 && $sv['cpu_avg'] < 15 && $sv['cpu_p95'] < 40 && $mem < 60) {
            $this->add([
                'key' => 'server.oversized', 'severity' => 'info', 'impact' => 'alto', 'area' => 'Custos', 'effort' => 'médio', 'weight' => 4,
                'title' => 'O servidor tem mais recursos do que precisa',
                'simple' => 'Na última semana o servidor usou em média ' . self::n($sv['cpu_avg']) . '% da CPU (nos picos ' . self::n($sv['cpu_p95']) . '%) e '
                    . self::n($mem) . '% da memória. Um plano mais pequeno na Cloudways deve chegar, com poupança todos os meses.',
                'tech' => $sv['ncpu'] . ' CPUs e ' . self::b($sv['mem_total']) . ' de RAM. CPU média ' . self::n($sv['cpu_avg'], 1) . '%, p95 ' . self::n($sv['cpu_p95'], 1)
                    . '%; memória usada (sem cache) ' . self::n($mem, 1) . '%. Dados de ' . self::n($sv['span_days'], 1) . ' dias.',
                'evidence' => ['CPU média: ' . self::n($sv['cpu_avg']) . '%', 'Picos (p95): ' . self::n($sv['cpu_p95']) . '%', 'Memória: ' . self::n($mem) . '%'],
                'actions' => [
                    'Aplicar antes as recomendações de cache e de robôs, que baixam ainda mais o consumo.',
                    'Escolher um plano com cerca de metade da CPU e da RAM e confirmar que o disco desse plano chega (na Cloudways o disco não diminui).',
                    'Fazer a mudança num período calmo e acompanhar este painel nos dias seguintes.',
                ],
            ]);
        }
    }

    /* ---------------- Sites ---------------- */

    private function siteRules(string $id, array $app, array $sv): void
    {
        $label = $app['label'];
        $base = ['app' => $id];
        $staging = (bool) preg_match('/(^|\.)staging\.|^staging|stg\./i', $label . ' ' . ($app['url'] ?? ''));
        $share = $sv['app_cpu'][$id] ?? null;
        $wp = WpScan::latest($this->s, $id, 'wp');
        $db = $wp['db'] ?? [];
        $fs = $wp['fs'] ?? [];
        $cfg = $fs['config'] ?? [];

        /* ---- Tráfego (só com pelo menos 6 h de logs) ---- */
        $span = $this->trafficSpan($id);
        if ($span >= 0.25) {
            $t = Traffic::site($this->s, $id, '7d', $this->now, true);
            $T = $t['totals'];
            $perDay = static fn($v) => (float) $v / $span;
            $phpCpuDay = $perDay($T['php_cpu']);
            $cpuPerReq = $T['php'] > 0 ? $T['php_cpu'] / $T['php'] : 0;

            // Cache
            if ($T['cache_pct'] !== null && $perDay($T['front']) >= 500 && $T['cache_pct'] < 50 && !$staging) {
                $target = 0.7;
                $savedReq = max(0, $perDay($T['backend']) - $perDay($T['front']) * (1 - $target));
                $this->add($base + [
                    'key' => 'site.cache', 'severity' => $T['cache_pct'] < 20 ? 'crit' : 'warn', 'impact' => 'alto', 'area' => 'CPU', 'effort' => 'médio',
                    'weight' => min(5, (int) ($share ?? 0) / 4),
                    'title' => 'Quase nenhuma página vem da cache',
                    'simple' => "Só " . self::n($T['cache_pct']) . "% dos pedidos a {$label} são servidos pela cache. Os restantes obrigam o servidor a gerar a página de novo. "
                        . 'Com a cache a funcionar, o servidor poupava cerca de ' . self::n($savedReq) . ' execuções de PHP por dia.',
                    'tech' => 'Recebidos ' . self::n($perDay($T['front'])) . '/dia, chegam ao servidor de trás ' . self::n($perDay($T['backend'])) . '/dia. '
                        . 'CPU média por pedido PHP ' . self::secs($cpuPerReq) . '; poupança estimada a 70% de cache: ' . self::secs($savedReq * $cpuPerReq) . ' de CPU por dia.',
                    'evidence' => ['Cache: ' . self::n($T['cache_pct'], 1) . '%', self::n($perDay($T['backend'])) . ' pedidos/dia sem cache'],
                    'actions' => [
                        'Confirmar que o Varnish está ativo para esta aplicação na Cloudways.',
                        'Ver que cookies o site define a visitantes anónimos (plugins de consentimento, carrinho, estatísticas): na Cloudways, qualquer cookie não excluído faz o Varnish passar o pedido ao PHP.',
                        'Verificar se o tema ou um plugin envia "Cache-Control: no-cache" ou "private" nas páginas públicas.',
                        'Rever as exclusões de URL e de cookies do Varnish no painel e acrescentar à lista os parâmetros de campanha (utm_*, fbclid, gclid) para serem ignorados.',
                    ],
                ]);
            }

            // Robôs
            $bots = [];
            foreach ($t['bots'] as $b) {
                $bots[$b['bot']] = $b;
            }
            $group = static function (array $names) use ($bots): array {
                $f = $bk = 0;
                $found = [];
                foreach ($names as $n) {
                    if (isset($bots[$n])) {
                        $f += $bots[$n]['front'];
                        $bk += $bots[$n]['backend'];
                        $found[] = $n;
                    }
                }
                return [$f, $bk, $found];
            };
            $front = max(1, $T['front']);
            foreach ([
                ['ai', self::AI_BOTS, 'Robôs de inteligência artificial', 'Robôs de empresas de IA (OpenAI, Anthropic, TikTok, Meta e outras) recolhem o conteúdo do site para treinar modelos. Não trazem visitas.'],
                ['seo', self::SEO_BOTS, 'Robôs de ferramentas de SEO', 'Ferramentas como Ahrefs e Semrush analisam o site para os seus clientes. Se a equipa não as usa, não trazem nada.'],
                ['other', ['Outros robôs e scripts'], 'Robôs e scripts sem identificação', 'Pedidos automáticos sem identificação clara (scripts, scrapers, verificações de vulnerabilidades).'],
            ] as [$k, $names, $what, $why]) {
                [$f, $bk, $found] = $group($names);
                $pct = 100 * $f / $front;
                if ($pct < 3 || $perDay($f) < 200) {
                    continue;
                }
                $this->add($base + [
                    'key' => "site.bots.$k", 'severity' => $pct >= 10 ? 'warn' : 'info', 'impact' => $pct >= 10 ? 'médio' : 'baixo', 'area' => 'Tráfego', 'effort' => 'baixo',
                    'title' => "$what fazem " . self::n($pct) . "% dos pedidos",
                    'simple' => "$why Em {$label} fazem " . self::n($perDay($f)) . ' pedidos por dia, ' . self::n($perDay($bk)) . ' dos quais chegam ao PHP.',
                    'tech' => 'Robôs: ' . implode(', ', $found) . '. ' . self::n($f) . ' pedidos em ' . self::n($span, 1) . ' dias.',
                    'evidence' => [self::n($perDay($f)) . ' pedidos/dia', self::n($pct, 1) . '% do total'],
                    'actions' => $k === 'other'
                        ? ['Ativar uma firewall com desafio a robôs (por exemplo Cloudflare, gratuito) e bloquear user agents de scripts.', 'Limitar o número de pedidos por IP.']
                        : ['Bloquear estes robôs no robots.txt (respeitam-no) e, para garantir, no Cloudflare ou numa regra do servidor.', 'Manter o Googlebot e o Bingbot, que trazem visitas.'],
                ]);
            }

            // Googlebot e admin-ajax
            $gAjax = $perDay($bots['Googlebot']['ajax'] ?? 0);
            $ajaxUrl = null;
            foreach ($t['urls'] as $u) {
                if ($u['path'] === '/wp-admin/admin-ajax.php') {
                    $ajaxUrl = $u;
                }
            }
            $ajaxShare = $ajaxUrl && $T['php_cpu'] > 0 ? 100 * $ajaxUrl['cpu'] / $T['php_cpu'] : 0;
            if ($gAjax >= 300 || $ajaxShare >= 20) {
                $avg = $ajaxUrl ? $ajaxUrl['time'] / max(1, $ajaxUrl['n']) : 0;
                $this->add($base + [
                    'key' => 'site.ajax', 'severity' => 'warn', 'impact' => $ajaxShare >= 20 ? 'alto' : 'médio', 'area' => 'CPU', 'effort' => 'médio',
                    'title' => 'Pedidos AJAX gastam ' . self::n($ajaxShare) . '% da CPU do site',
                    'simple' => "Em {$label}, os pedidos ao admin-ajax.php nunca vêm da cache e cada um demora cerca de " . self::secs($avg) . '.'
                        . ($gAjax >= 300 ? ' O Google faz ' . self::n($gAjax) . ' destes pedidos por dia, provavelmente através de um botão "carregar mais" ou de filtros.' : ''),
                    'tech' => 'admin-ajax: ' . self::n($perDay($ajaxUrl['n'] ?? 0)) . '/dia, ' . self::secs($perDay($ajaxUrl['cpu'] ?? 0)) . ' de CPU por dia, média ' . self::secs($avg)
                        . ', até ' . self::b($ajaxUrl['mem_max'] ?? 0) . ' de memória. Googlebot: ' . self::n($gAjax) . '/dia.',
                    'evidence' => [self::n($ajaxShare, 1) . '% da CPU do site', 'Googlebot: ' . self::n($gAjax) . ' pedidos/dia'],
                    'actions' => [
                        'Identificar a ação AJAX (parâmetro "action" do POST) com o programador do tema.',
                        'Trocar o "carregar mais" por paginação com links normais (/page/2/), que o Varnish guarda em cache, ou por pedidos GET à API REST com cache.',
                        'Se a ação só serve visitantes, não carregar o script para robôs.',
                    ],
                ]);
            }

            // URL caro (que não seja admin-ajax)
            foreach (array_slice($t['urls'], 0, 3) as $u) {
                if ($u['path'] === '/wp-admin/admin-ajax.php' || $T['php_cpu'] <= 0) {
                    continue;
                }
                $us = 100 * $u['cpu'] / $T['php_cpu'];
                $avg = $u['time'] / max(1, $u['n']);
                if ($us < 10 || $avg < 1.0) {
                    continue;
                }
                $sitemap = (bool) preg_match('/sitemap/i', $u['path']);
                $this->add($base + [
                    'key' => 'site.url.' . substr(md5($u['path']), 0, 8), 'severity' => 'warn', 'impact' => $us >= 20 ? 'alto' : 'médio', 'area' => 'CPU', 'effort' => 'médio',
                    'title' => $sitemap ? 'O sitemap demora ' . self::secs($avg) . ' a ser gerado' : 'Uma página gasta ' . self::n($us) . '% da CPU do site',
                    'simple' => $sitemap
                        ? "O sitemap de {$label} é gerado de novo em cada pedido e demora " . self::secs($avg) . '. Os motores de busca pedem-no muitas vezes, o que soma ' . self::n($us) . '% da CPU do site.'
                        : "O endereço {$u['path']} de {$label} demora em média " . self::secs($avg) . ' e soma ' . self::n($us) . '% da CPU gasta pelo site.',
                    'tech' => "{$u['path']}: " . self::n($perDay($u['n'])) . ' pedidos/dia, média ' . self::secs($avg) . ', ' . self::n($u['slow']) . ' acima de 1 s, memória até ' . self::b($u['mem_max']) . '.',
                    'evidence' => [self::n($us, 1) . '% da CPU do site', 'Média: ' . self::secs($avg)],
                    'actions' => $sitemap
                        ? ['Garantir que o sitemap passa pelo Varnish (sem cookies nem Cache-Control: no-cache) ou ativar a cache de sitemaps do plugin de SEO.', 'Verificar o slow log: no Yoast Premium o filtro de redirects percorre todos os redirects por cada entrada do sitemap.']
                        : ['Ver no slow log que função atrasa esta página.', 'Confirmar se a página pode ser guardada em cache.'],
                ]);
            }

            // Slow log
            foreach ($t['slow'] as $sl) {
                if ($perDay($sl['n']) < 5) {
                    continue;
                }
                $who = self::component($sl['comp']);
                $this->add($base + [
                    'key' => 'site.slow.' . substr(md5($sl['comp']), 0, 8), 'severity' => 'warn', 'impact' => 'médio', 'area' => 'CPU', 'effort' => 'médio',
                    'title' => ucfirst($who) . ' provoca pedidos de mais de 5 s',
                    'simple' => "Em {$label}, " . $who . ' está ativo em cerca de ' . self::n($perDay($sl['n'])) . ' pedidos por dia que demoram mais de 5 segundos.',
                    'tech' => 'Exemplo do slow log: ' . ($sl['example'] ?: '–'),
                    'evidence' => [self::n($perDay($sl['n'])) . ' pedidos lentos/dia'],
                    'actions' => ['Ver a pilha completa no php-app.slow.log e a configuração deste componente.', 'Atualizar o plugin ou contactar o autor com o exemplo do slow log.'],
                ]);
            }

            // Erros PHP
            $errDay = $perDay($T['errors']);
            if ($T['err_fatal'] > 0 || $errDay >= 1000) {
                $topFile = $t['errors'][0]['file'] ?? '';
                $comp = preg_match('~wp-content/(plugins|themes)/([^/]+)~', $topFile, $m) ? ($m[1] === 'themes' ? 'o tema ' : 'o plugin ') . $m[2] : 'o código do site';
                $this->add($base + [
                    'key' => 'site.errors', 'severity' => $T['err_fatal'] > 0 ? 'crit' : 'warn', 'impact' => 'médio', 'area' => 'Código', 'effort' => 'baixo',
                    'title' => $T['err_fatal'] > 0 ? 'Há erros fatais de PHP' : self::n($errDay) . ' avisos PHP por dia',
                    'simple' => "O código de {$label} gera " . self::n($errDay) . ' mensagens de erro por dia' . ($T['err_fatal'] > 0 ? ', algumas fatais (páginas que falham)' : '')
                        . '. Cada uma é escrita em disco e atrasa o pedido.',
                    'tech' => "Origem principal: $comp" . ($topFile ? " ({$topFile}:" . ($t['errors'][0]['line'] ?? '') . ', ' . ($t['errors'][0]['msg'] ?? '') . ')' : '') . '.',
                    'evidence' => array_values(array_filter([self::n($errDay) . ' mensagens/dia', $T['err_fatal'] > 0 ? self::n($T['err_fatal']) . ' fatais' : null])),
                    'actions' => ['Corrigir as mensagens mais frequentes (tabela de erros na página do site).', 'Normalmente são variáveis não inicializadas: correções de poucos minutos.'],
                ]);
            }
            if ($T['front'] > 0 && 100 * $T['s5xx'] / $T['front'] >= 1) {
                $this->add($base + [
                    'key' => 'site.5xx', 'severity' => 'warn', 'impact' => 'médio', 'area' => 'Código', 'effort' => 'médio',
                    'title' => self::n(100 * $T['s5xx'] / $T['front'], 1) . '% dos pedidos dão erro do servidor',
                    'simple' => "Cerca de " . self::n($perDay($T['s5xx'])) . " pedidos por dia a {$label} acabam com erro 5xx (página em branco ou de erro).",
                    'tech' => 'Ver os erros PHP fatais e o error log do servidor de trás.',
                    'evidence' => [self::n($perDay($T['s5xx'])) . ' erros 5xx/dia'],
                    'actions' => ['Cruzar as horas dos erros com o error log e com picos de CPU/memória.'],
                ]);
            }

            // Ataques
            if ($perDay($T['xmlrpc']) >= 50) {
                $this->add($base + [
                    'key' => 'site.xmlrpc', 'severity' => 'warn', 'impact' => 'baixo', 'area' => 'Segurança', 'effort' => 'baixo',
                    'title' => 'O xmlrpc.php recebe ' . self::n($perDay($T['xmlrpc'])) . ' pedidos por dia',
                    'simple' => 'O xmlrpc.php é uma porta antiga do WordPress, muito usada em ataques. Quase nenhum site precisa dela.',
                    'tech' => self::n($T['xmlrpc']) . ' pedidos em ' . self::n($span, 1) . ' dias.',
                    'evidence' => [self::n($perDay($T['xmlrpc'])) . ' pedidos/dia'],
                    'actions' => ['Bloquear o xmlrpc.php (Cloudflare, plugin de segurança ou regra do servidor), salvo se o Jetpack ou a app móvel do WordPress forem usados.'],
                ]);
            }
            if ($perDay($T['login']) >= 300) {
                $this->add($base + [
                    'key' => 'site.login', 'severity' => 'warn', 'impact' => 'baixo', 'area' => 'Segurança', 'effort' => 'baixo',
                    'title' => 'Muitas tentativas na página de entrada',
                    'simple' => "A página de entrada de {$label} recebe " . self::n($perDay($T['login'])) . ' pedidos por dia, muito mais do que a equipa usa: são tentativas automáticas de adivinhar passwords.',
                    'tech' => self::n($T['login']) . ' pedidos a wp-login.php em ' . self::n($span, 1) . ' dias.',
                    'evidence' => [self::n($perDay($T['login'])) . ' pedidos/dia'],
                    'actions' => ['Limitar tentativas de login e ativar autenticação de dois fatores.', 'Proteger o wp-login.php no Cloudflare (desafio) ou por IP.'],
                ]);
            }
        }

        /* ---- WordPress ---- */
        if ($db && empty($db['error'])) {
            $al = $db['autoload']['bytes'] ?? 0;
            if ($al > 800 * 1024) {
                $top = $db['autoload_top'][0] ?? null;
                $this->add($base + [
                    'key' => 'site.autoload', 'severity' => $al > 2 * 1048576 ? 'crit' : 'warn', 'impact' => 'médio', 'area' => 'Base de dados', 'effort' => 'baixo',
                    'title' => 'O WordPress carrega ' . self::b($al) . ' de opções em cada pedido',
                    'simple' => "Em cada página de {$label}, o WordPress lê " . self::b($al) . ' de configurações da base de dados, mesmo que não sejam precisas. O recomendado é ficar abaixo de 800 KB.',
                    'tech' => $top ? "Maior opção: {$top['name']} (" . self::b($top['bytes']) . '). Ver a lista completa na página do site.' : '',
                    'evidence' => ['Autoload: ' . self::b($al), self::n($db['autoload']['count'] ?? 0) . ' opções'],
                    'actions' => ['Desligar o autoload das opções grandes que não são usadas em todas as páginas (UPDATE ... SET autoload = \'off\').', 'Apagar opções de plugins já removidos.'],
                ]);
            }
            $p = $db['posts'] ?? [];
            $rev = $cfg['WP_POST_REVISIONS'] ?? null;
            if (($p['revisions'] ?? 0) >= 5000) {
                $this->add($base + [
                    'key' => 'site.revisions', 'severity' => 'info', 'impact' => 'baixo', 'area' => 'Base de dados', 'effort' => 'baixo',
                    'title' => self::n($p['revisions']) . ' revisões guardadas',
                    'simple' => "{$label} guarda todas as versões antigas de cada artigo. Ocupam espaço e tornam a base de dados mais lenta.",
                    'tech' => self::n($p['revisions']) . ' revisões e ' . self::n($p['revision_meta'] ?? 0) . ' metadados de revisões. WP_POST_REVISIONS: ' . ($rev === null ? 'não definido (ilimitado)' : var_export($rev, true)) . '.',
                    'evidence' => [self::n($p['revisions']) . ' revisões'],
                    'actions' => ["Definir define('WP_POST_REVISIONS', 5); no wp-config.php.", 'Apagar as revisões antigas (wp post delete $(wp post list --post_type=revision --format=ids) ou um plugin de limpeza).'],
                ]);
            }
            $clean = [];
            if (($db['transients']['expired'] ?? 0) >= 1000) {
                $clean[] = self::n($db['transients']['expired']) . ' transients expirados';
            }
            if (($p['orphan_meta'] ?? 0) >= 5000) {
                $clean[] = self::n($p['orphan_meta']) . ' metadados órfãos';
            }
            if (($db['comments']['spam'] ?? 0) >= 1000) {
                $clean[] = self::n($db['comments']['spam']) . ' comentários de spam';
            }
            if (($db['db_free'] ?? 0) >= 100 * 1048576) {
                $clean[] = self::b($db['db_free']) . ' de espaço livre por recuperar nas tabelas';
            }
            if ($clean) {
                $this->add($base + [
                    'key' => 'site.cleanup', 'severity' => 'info', 'impact' => 'baixo', 'area' => 'Base de dados', 'effort' => 'baixo',
                    'title' => 'A base de dados acumulou lixo',
                    'simple' => "A base de dados de {$label} tem dados que já não servem: " . implode(', ', $clean) . '.',
                    'tech' => 'Ver a tabela "Limpeza possível" na página do site.',
                    'evidence' => $clean,
                    'actions' => ['wp transient delete --expired', 'Apagar postmeta sem post associado e esvaziar o spam.', 'OPTIMIZE TABLE nas tabelas com mais espaço livre (fora de horas de ponta).'],
                ]);
            }
            $as = $db['action_scheduler'] ?? null;
            if ($as) {
                $old = ($as['status']['complete'] ?? 0) + ($as['status']['failed'] ?? 0) + ($as['status']['canceled'] ?? 0);
                if (($as['late'] ?? 0) >= 100 || ($as['status']['failed'] ?? 0) >= 500 || $old >= 50000) {
                    $hook = $as['hooks'][0]['hook'] ?? '';
                    $this->add($base + [
                        'key' => 'site.as', 'severity' => ($as['late'] ?? 0) >= 100 ? 'warn' : 'info', 'impact' => 'médio', 'area' => 'Tarefas agendadas', 'effort' => 'baixo',
                        'title' => 'A fila de tarefas em segundo plano está atrasada',
                        'simple' => "{$label} tem " . self::n($as['late'] ?? 0) . ' tarefas atrasadas e ' . self::n($as['status']['failed'] ?? 0) . ' falhadas na fila de tarefas (usada pelo WooCommerce e outros plugins).',
                        'tech' => 'Action Scheduler: ' . json_encode($as['status']) . ($hook ? ". Hook mais frequente entre pendentes/falhadas: $hook." : '.'),
                        'evidence' => [self::n($as['late'] ?? 0) . ' em atraso', self::n($as['status']['failed'] ?? 0) . ' falhadas', self::n($old) . ' antigas'],
                        'actions' => ['Correr a fila por um cron do sistema: wp action-scheduler run.', 'Ver porque falha o hook mais frequente.', 'Reduzir a retenção dos registos concluídos (filtro action_scheduler_retention_period).'],
                    ]);
                }
            }
            $cron = $db['cron'] ?? [];
            $sysCron = ($cfg['DISABLE_WP_CRON'] ?? false) === true;
            if (($cron['overdue'] ?? 0) >= 10 || !$sysCron) {
                $this->add($base + [
                    'key' => 'site.wpcron', 'severity' => ($cron['overdue'] ?? 0) >= 10 ? 'warn' : 'info', 'impact' => 'baixo', 'area' => 'Tarefas agendadas', 'effort' => 'baixo',
                    'title' => $sysCron ? self::n($cron['overdue']) . ' tarefas do WordPress em atraso' : 'As tarefas do WordPress correm durante as visitas',
                    'simple' => $sysCron
                        ? "O cron do sistema de {$label} não está a acompanhar as tarefas agendadas."
                        : "Em {$label}, as tarefas agendadas (backups, newsletters, limpezas) são lançadas durante as visitas, o que torna algumas páginas mais lentas e falha quando há pouco tráfego.",
                    'tech' => 'DISABLE_WP_CRON ' . ($sysCron ? 'ativo' : 'não definido') . '; ' . self::n($cron['events'] ?? 0) . ' eventos, ' . self::n($cron['overdue'] ?? 0) . ' em atraso'
                        . (($cron['frequent'] ?? 0) ? ', ' . self::n($cron['frequent']) . ' hooks a repetir a cada menos de 5 min' : '') . '.',
                    'evidence' => [self::n($cron['overdue'] ?? 0) . ' em atraso'],
                    'actions' => ["Definir define('DISABLE_WP_CRON', true); no wp-config.php.", 'Criar na Cloudways (Cron Job Management) uma tarefa a cada 5 minutos: wp cron event run --due-now.'],
                ]);
            }
            $plugins = $fs['plugins'] ?? [];
            $active = array_flip($db['active_plugins'] ?? []);
            $inactive = array_values(array_filter($plugins, static fn($p) => !isset($active[$p['file']])));
            if ($inactive) {
                $this->add($base + [
                    'key' => 'site.plugins.inactive', 'severity' => 'info', 'impact' => 'baixo', 'area' => 'Manutenção', 'effort' => 'baixo',
                    'title' => self::plural(count($inactive), 'plugin instalado mas desativado', 'plugins instalados mas desativados'),
                    'simple' => "Plugins desativados não gastam recursos, mas continuam a ser uma porta de entrada para ataques se ficarem desatualizados.",
                    'tech' => implode(', ', array_map(static fn($p) => $p['name'], array_slice($inactive, 0, 12))) . (count($inactive) > 12 ? '…' : ''),
                    'evidence' => [count($inactive) . ' inativos'],
                    'actions' => ['Remover os que não vão voltar a ser usados.'],
                ]);
            }
            if (count($active) >= 50) {
                $this->add($base + [
                    'key' => 'site.plugins.many', 'severity' => 'info', 'impact' => 'médio', 'area' => 'Manutenção', 'effort' => 'alto',
                    'title' => count($active) . ' plugins ativos',
                    'simple' => "Cada plugin ativo corre em todas as páginas de {$label}. Com tantos plugins, vale a pena rever quais são mesmo necessários.",
                    'tech' => 'Cruzar com a tabela de URLs mais caros e com o slow log para encontrar os que mais pesam.',
                    'evidence' => [count($active) . ' ativos'],
                    'actions' => ['Auditar plugins com funções repetidas ou que só servem uma página.'],
                ]);
            }
            if (!empty($db['myisam'])) {
                $this->add($base + [
                    'key' => 'site.myisam', 'severity' => 'info', 'impact' => 'baixo', 'area' => 'Base de dados', 'effort' => 'baixo',
                    'title' => self::plural((int) $db['myisam'], 'tabela', 'tabelas') . ' no formato antigo MyISAM',
                    'simple' => 'Tabelas MyISAM bloqueiam a tabela inteira em cada escrita e recuperam pior de falhas.',
                    'tech' => implode(', ', array_column(array_filter($db['tables'] ?? [], static fn($t) => strcasecmp((string) $t['engine'], 'MyISAM') === 0), 'name')),
                    'evidence' => [self::plural((int) $db['myisam'], 'tabela', 'tabelas')],
                    'actions' => ['ALTER TABLE <tabela> ENGINE=InnoDB; (fora de horas de ponta, com backup).'],
                ]);
            }
            if ($fs && empty($fs['object_cache']) && $sv['redis'] && !$staging) {
                $this->add($base + [
                    'key' => 'site.redis', 'severity' => 'warn', 'impact' => 'médio', 'area' => 'Base de dados', 'effort' => 'baixo',
                    'title' => 'O Redis está disponível mas este site não o usa',
                    'simple' => "O servidor já tem Redis, uma cache em memória que evita repetir as mesmas consultas à base de dados. {$label} ainda não a usa.",
                    'tech' => 'Não existe wp-content/object-cache.php.',
                    'evidence' => ['Sem cache de objetos'],
                    'actions' => ['Ativar o Redis para a aplicação na Cloudways e instalar o plugin Redis Object Cache (ou o Object Cache Pro).'],
                ]);
            }
            if (($cfg['WP_DEBUG'] ?? false) === true && !$staging) {
                $this->add($base + [
                    'key' => 'site.debug', 'severity' => 'warn', 'impact' => 'baixo', 'area' => 'Código', 'effort' => 'baixo',
                    'title' => 'O modo de depuração está ligado em produção',
                    'simple' => "Com o WP_DEBUG ligado, {$label} escreve todos os avisos em disco e pode mostrar detalhes técnicos aos visitantes.",
                    'tech' => 'WP_DEBUG true' . (($fs['debug_log'] ?? null) ? '; debug.log com ' . self::b($fs['debug_log']) : '') . '.',
                    'evidence' => ($fs['debug_log'] ?? null) ? ['debug.log: ' . self::b($fs['debug_log'])] : [],
                    'actions' => ["define('WP_DEBUG', false); no wp-config.php.", 'Apagar o wp-content/debug.log.'],
                ]);
            } elseif (($fs['debug_log'] ?? 0) > 100 * 1048576) {
                $this->add($base + [
                    'key' => 'site.debuglog', 'severity' => 'info', 'impact' => 'baixo', 'area' => 'Disco', 'effort' => 'baixo',
                    'title' => 'Ficheiro debug.log com ' . self::b($fs['debug_log']),
                    'simple' => 'Um ficheiro de registo de erros esquecido está a ocupar espaço em disco.',
                    'tech' => 'wp-content/debug.log',
                    'evidence' => [self::b($fs['debug_log'])],
                    'actions' => ['Apagar o ficheiro e confirmar que WP_DEBUG_LOG está desligado.'],
                ]);
            }
            if ($staging && ($db['blog_public'] ?? 0) == 1) {
                $this->add($base + [
                    'key' => 'site.staging.public', 'severity' => 'warn', 'impact' => 'médio', 'area' => 'Tráfego', 'effort' => 'baixo',
                    'title' => 'Site de testes aberto aos motores de busca',
                    'simple' => "{$label} é uma cópia de testes, mas está aberta aos motores de busca e aos robôs. Gasta recursos sem necessidade e pode aparecer no Google como conteúdo duplicado.",
                    'tech' => 'blog_public = 1.',
                    'evidence' => ['Visível para motores de busca'],
                    'actions' => ['Em Definições > Leitura, ativar "Desencorajar os motores de busca".', 'Proteger o staging com password (HTTP auth) para que nem robôs nem visitantes lá cheguem.'],
                ]);
            }
        }

        /* ---- PHP ---- */
        if (!empty($app['php']) && version_compare($app['php'], '8.2', '<')) {
            $this->add($base + [
                'key' => 'site.php', 'severity' => 'warn', 'impact' => 'médio', 'area' => 'Segurança', 'effort' => 'médio',
                'title' => "PHP {$app['php']} já não tem suporte",
                'simple' => "{$label} usa uma versão de PHP que já não recebe correções de segurança. As versões novas também são mais rápidas.",
                'tech' => "Pool PHP-FPM em {$app['php']}; os outros sites estão em versões mais recentes.",
                'evidence' => ["PHP {$app['php']}"],
                'actions' => ['Testar o site em PHP 8.3 ou 8.4 numa cópia (staging) e mudar a versão na Cloudways.'],
            ]);
        }

        /* ---- Uploads ---- */
        $up = WpScan::latest($this->s, $id, 'uploads');
        if ($up && $up['bytes'] > 0) {
            $th = $up['cats']['thumbs']['bytes'] ?? 0;
            if ($th > 2 * 1073741824 && $th / $up['bytes'] > 0.3) {
                $this->add($base + [
                    'key' => 'site.uploads.thumbs', 'severity' => 'warn', 'impact' => 'alto', 'area' => 'Disco', 'effort' => 'médio',
                    'title' => 'As miniaturas de imagens ocupam ' . self::b($th),
                    'simple' => "Por cada imagem, o WordPress de {$label} cria várias cópias em tamanhos diferentes. Essas cópias ocupam " . self::b($th) . ' (' . self::n(100 * $th / $up['bytes']) . '% dos uploads), e muitas não são usadas pelo tema.',
                    'tech' => self::n($up['cats']['thumbs']['files']) . ' miniaturas.',
                    'evidence' => [self::b($th) . ' em miniaturas'],
                    'actions' => ['Listar os tamanhos registados (wp media image-size) e desativar os que o tema não usa.', 'Apagar as miniaturas e regenerar só os tamanhos necessários (wp media regenerate --only-missing depois de limpar).'],
                ]);
            }
            if (($up['big_bytes'] ?? 0) > 5 * 1073741824) {
                $this->add($base + [
                    'key' => 'site.uploads.big', 'severity' => 'info', 'impact' => 'médio', 'area' => 'Disco', 'effort' => 'médio',
                    'title' => self::n($up['big_count']) . ' ficheiros com mais de 5 MB',
                    'simple' => "{$label} tem " . self::b($up['big_bytes']) . ' em ficheiros muito grandes (fotos originais em alta resolução, vídeos, PDFs).',
                    'tech' => 'Ver a lista dos maiores ficheiros na página do site.',
                    'evidence' => [self::b($up['big_bytes'])],
                    'actions' => ['Comprimir e reduzir as fotos originais (por exemplo para 2560 px).', 'Alojar vídeos no YouTube/Vimeo ou num serviço de vídeo.'],
                ]);
            }
            if ($up['bytes'] > 50 * 1073741824) {
                $this->add($base + [
                    'key' => 'site.uploads.offload', 'severity' => 'info', 'impact' => 'alto', 'area' => 'Disco', 'effort' => 'médio',
                    'title' => 'Uploads com ' . self::b($up['bytes']) . ' no disco do servidor',
                    'simple' => "Os ficheiros de {$label} ocupam " . self::b($up['bytes']) . '. Guardá-los num armazenamento externo sai muito mais barato do que disco de servidor e liberta espaço para os sites.',
                    'tech' => self::n($up['files']) . ' ficheiros.',
                    'evidence' => [self::b($up['bytes'])],
                    'actions' => ['Mover os uploads para S3, Cloudflare R2 ou Bunny Storage com um plugin de offload (por exemplo WP Offload Media) e servir por CDN.'],
                ]);
            }
        }
    }

    /** Remove do texto para o cliente o que é detalhe interno. */
    public static function forClient(array $r): array
    {
        unset($r['tech'], $r['actions'], $r['weight']);
        return $r;
    }
}
