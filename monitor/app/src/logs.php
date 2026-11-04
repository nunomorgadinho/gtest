<?php
declare(strict_types=1);

/**
 * Leitura incremental de logs e parsers dos formatos da Cloudways.
 */
final class LogReader
{
    /**
     * Lê as linhas novas de $file desde a última posição guardada e passa-as a $onText.
     * Lida com a rotação (o ficheiro antigo passa a $file.1) e com truncagens.
     * $onText recebe texto com linhas completas e devolve quantos bytes consumiu
     * (permite ao slow log deixar um bloco incompleto para a próxima leitura).
     */
    public static function read(Store $s, string $file, callable $onText, int $maxBytes = 64 << 20): int
    {
        clearstatcache(true, $file);
        $st = @stat($file);
        if ($st === false || !is_readable($file)) {
            return 0;
        }
        $q = $s->db->prepare('SELECT inode, pos FROM logpos WHERE file = ?');
        $q->execute([$file]);
        $saved = $q->fetch(PDO::FETCH_ASSOC) ?: null;
        $pos = $saved ? (int) $saved['pos'] : 0;

        $segments = [];
        if ($saved && (int) $saved['inode'] !== (int) $st['ino']) {
            // Houve rotação: acabar de ler o ficheiro antigo, se ainda existir.
            $rot = @stat("$file.1");
            if ($rot && (int) $rot['ino'] === (int) $saved['inode'] && $rot['size'] > $pos) {
                $segments[] = ["$file.1", $pos, (int) $rot['size'], false];
            }
            $pos = 0;
        } elseif ($st['size'] < $pos) {
            $pos = 0; // truncado (copytruncate)
        }
        $segments[] = [$file, $pos, (int) $st['size'], true];

        $total = 0;
        $newPos = $pos;
        foreach ($segments as [$path, $start, $end, $isCurrent]) {
            $skipFirst = false;
            if ($end - $start > $maxBytes) {
                $start = $end - $maxBytes; // primeira leitura de um log enorme: só o fim
                $skipFirst = true;
            }
            $fh = @fopen($path, 'rb');
            if (!$fh) {
                continue;
            }
            fseek($fh, $start);
            $carry = '';
            $at = $start;
            while ($at < $end && !feof($fh)) {
                $chunk = fread($fh, (int) min(1 << 20, $end - $at));
                if ($chunk === false || $chunk === '') {
                    break;
                }
                $at += strlen($chunk);
                $buf = $carry . $chunk;
                if ($skipFirst) {
                    $nl = strpos($buf, "\n");
                    if ($nl === false) {
                        $carry = '';
                        continue;
                    }
                    $buf = substr($buf, $nl + 1);
                    $skipFirst = false;
                }
                $cut = strrpos($buf, "\n");
                if ($cut === false) {
                    $carry = $buf;
                    continue;
                }
                $text = substr($buf, 0, $cut + 1);
                $used = $onText($text);
                $used = is_int($used) ? $used : strlen($text);
                $carry = substr($buf, $used);
                $total += $used;
            }
            fclose($fh);
            if ($isCurrent) {
                $newPos = $at - strlen($carry);
            }
        }

        $s->db->prepare('INSERT OR REPLACE INTO logpos (file, inode, pos, updated) VALUES (?,?,?,?)')
            ->execute([$file, (int) $st['ino'], $newPos, time()]);
        return $total;
    }
}

final class LogParse
{
    public const TYPES = ['ajax', 'login', 'xmlrpc', 'cron', 'rest', 'feed', 'search', 'admin'];

    /** "04/Nov/2026:18:45:35 +0000" -> timestamp (com cache por minuto). */
    public static function clfTime(string $s): ?int
    {
        static $cache = [];
        if (strlen($s) < 26) {
            return null;
        }
        $key = substr($s, 0, 17) . substr($s, 20);
        if (!array_key_exists($key, $cache)) {
            if (count($cache) > 5000) {
                $cache = [];
            }
            $dt = DateTime::createFromFormat('d/M/Y:H:i O', substr($s, 0, 17) . ' ' . substr($s, 21));
            $cache[$key] = $dt ? $dt->getTimestamp() : null;
        }
        return $cache[$key] === null ? null : $cache[$key] + (int) substr($s, 18, 2);
    }

    /** Linha no formato "combined" do Nginx (front, backend e static). */
    public static function combined(string $line): ?array
    {
        if (!preg_match('~^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]*)" (\d{3}) (\d+|-) "((?:[^"\\\\]|\\\\.)*)" "((?:[^"\\\\]|\\\\.)*)"~', $line, $m)) {
            return null;
        }
        $ts = self::clfTime($m[2]);
        if ($ts === null) {
            return null;
        }
        $req = explode(' ', $m[3]);
        $uri = $req[1] ?? '';
        [$path, $query] = array_pad(explode('?', $uri, 2), 2, '');
        return [
            'ts' => $ts, 'method' => $req[0] ?? '', 'path' => $path, 'query' => $query,
            'status' => (int) $m[4], 'bytes' => $m[5] === '-' ? 0 : (int) $m[5], 'ua' => $m[7],
        ];
    }

    /**
     * Linha do access log do PHP-FPM da Cloudways, por exemplo:
     * x.x.x.x - [04/Nov/2026:18:45:34 +0000] "POST /wp-admin/admin-ajax.php" 200 766 - 1203420 2708946 0.939 86061056 81.99% 13.84% "/wp-admin/admin-ajax.php"
     * Os campos que interessam (duração, memória, %CPU) são a sequência "<float> <int> <float>%".
     */
    public static function fpm(string $line, array $units = [1.0, 1]): ?array
    {
        if (!preg_match('~^\S+ - \[([^\]]+)\] "(\S+) ([^"]*)" (\d{3}) ~', $line, $m)) {
            return null;
        }
        if (!preg_match('~ (\d+(?:\.\d+)?) (\d+) (\d+(?:\.\d+)?)%~', substr($line, strlen($m[0]) - 1), $n)) {
            return null;
        }
        $ts = self::clfTime($m[1]);
        if ($ts === null) {
            return null;
        }
        $dur = (float) $n[1] / $units[0];
        [$path, $query] = array_pad(explode('?', $m[3], 2), 2, '');
        return [
            'ts' => $ts, 'method' => $m[2], 'path' => $path, 'query' => $query, 'status' => (int) $m[4],
            'dur' => $dur, 'mem' => (int) $n[2] * $units[1], 'cpu' => $dur * (float) $n[3] / 100,
        ];
    }

    /** Unidades do access.format do pool (por omissão: segundos e bytes). */
    public static function fpmUnits(string $app): array
    {
        $div = 1.0;
        $mul = 1;
        foreach (glob('/etc/php/*/fpm/pool.d/' . $app . '-*.conf') ?: [] as $f) {
            $src = (string) @file_get_contents($f);
            if (preg_match('/^\s*access\.format\s*=\s*(.+)$/m', $src, $m)) {
                $fmt = $m[1];
                $div = str_contains($fmt, '%{mili}d') || str_contains($fmt, '%{milli}d') ? 1000.0
                    : (str_contains($fmt, '%{micro}d') ? 1e6 : 1.0);
                $mul = str_contains($fmt, '%{kilo}M') ? 1024 : (str_contains($fmt, '%{mega}M') ? 1048576 : 1);
            }
        }
        return [$div, $mul];
    }

    /** Tipo de pedido WordPress que merece atenção (ou null). */
    public static function reqType(string $path, string $query): ?string
    {
        if ($path === '/wp-admin/admin-ajax.php') {
            return 'ajax';
        }
        if ($path === '/wp-login.php') {
            return 'login';
        }
        if ($path === '/xmlrpc.php') {
            return 'xmlrpc';
        }
        if ($path === '/wp-cron.php') {
            return 'cron';
        }
        if (str_starts_with($path, '/wp-json/') || str_contains($query, 'rest_route=')) {
            return 'rest';
        }
        if (str_starts_with($path, '/wp-admin/')) {
            return 'admin';
        }
        if (preg_match('~/feed/?$|/feed/(rss2?|atom|rdf)/?$~', $path)) {
            return 'feed';
        }
        if (preg_match('~(^|&)s=~', $query)) {
            return 'search';
        }
        return null;
    }

    /** Nome do robô a partir do user agent; '' para browsers de pessoas. */
    public static function bot(string $ua): string
    {
        static $cache = [];
        if (isset($cache[$ua])) {
            return $cache[$ua];
        }
        static $known = [
            'Googlebot' => '~googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|storebot-google|google-extended~i',
            'Bingbot' => '~bingbot|bingpreview|msnbot|adidxbot~i',
            'Applebot' => '~applebot~i',
            'YandexBot' => '~yandex~i',
            'Baiduspider' => '~baiduspider~i',
            'DuckDuckBot' => '~duckduckbot|duckassistbot~i',
            'GPTBot (OpenAI)' => '~gptbot|chatgpt-user|oai-searchbot~i',
            'ClaudeBot (Anthropic)' => '~claudebot|claude-user|claude-searchbot|anthropic-ai~i',
            'PerplexityBot' => '~perplexity~i',
            'Bytespider (TikTok)' => '~bytespider~i',
            'CCBot' => '~ccbot~i',
            'Amazonbot' => '~amazonbot~i',
            'Meta (Facebook)' => '~meta-externalagent|meta-externalfetcher|facebookexternalhit|facebookcatalog|facebookbot~i',
            'AhrefsBot' => '~ahrefs~i',
            'SemrushBot' => '~semrush~i',
            'MJ12bot' => '~mj12bot~i',
            'DotBot (Moz)' => '~dotbot|rogerbot~i',
            'DataForSeoBot' => '~dataforseo~i',
            'PetalBot' => '~petalbot~i',
            'BLEXBot' => '~blexbot~i',
            'Barkrowler' => '~barkrowler~i',
            'Twitter/X' => '~twitterbot~i',
            'LinkedInBot' => '~linkedinbot~i',
            'WhatsApp' => '~whatsapp~i',
            'Monitorização' => '~uptimerobot|pingdom|statuscake|site24x7|jetpack|better uptime|uptime-kuma~i',
        ];
        $name = '';
        foreach ($known as $n => $re) {
            if (preg_match($re, $ua)) {
                $name = $n;
                break;
            }
        }
        if ($name === '' && ($ua === '' || $ua === '-' || preg_match('~bot\b|bot/|crawl|spider|slurp|scrapy|python-requests|python-urllib|aiohttp|curl/|wget/|go-http-client|okhttp|java/|libwww|httpclient|headlesschrome|phantomjs|axios/|node-fetch|guzzle~i', $ua))) {
            $name = 'Outros robôs e scripts';
        }
        if (count($cache) > 20000) {
            $cache = [];
        }
        return $cache[$ua] = $name;
    }

    /** Agrupa URLs parecidos: tira a query string e normaliza a paginação. */
    public static function normPath(string $path): string
    {
        $p = preg_replace('~/page/\d+~', '/page/N', $path) ?? $path;
        return substr($p, 0, 200);
    }

    /** Caminho relativo ao public_html (os logs trazem o caminho absoluto). */
    public static function relPath(string $file): string
    {
        return preg_replace('~^/home/[^/]+/[^/]+/public_html/~', '', $file) ?? $file;
    }

    /** Fuso horário do sistema (o Nginx e o PHP-FPM escrevem as horas dos seus logs nele). */
    public static function sysTz(): DateTimeZone
    {
        static $tz = null;
        if ($tz === null) {
            $name = trim((string) @file_get_contents('/etc/timezone'));
            try {
                $tz = new DateTimeZone($name !== '' ? $name : 'UTC');
            } catch (Throwable) {
                $tz = new DateTimeZone('UTC');
            }
        }
        return $tz;
    }

    /**
     * Mensagens PHP numa linha do error log do Nginx/Apache.
     * Devolve [ts, [[nível, mensagem, ficheiro, linha], ...]].
     */
    public static function phpErrors(string $line): ?array
    {
        if (!str_contains($line, 'PHP ')) {
            return null;
        }
        $ts = null;
        if (preg_match('~^(\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2})~', $line, $m)) {
            $dt = DateTime::createFromFormat('Y/m/d H:i:s', $m[1], self::sysTz());
            $ts = $dt ? $dt->getTimestamp() : null;
        } elseif (preg_match('~^\[\w{3} (\w{3} \d{2} \d{2}:\d{2}:\d{2})(?:\.\d+)? (\d{4})\]~', $line, $m)) {
            $dt = DateTime::createFromFormat('M d H:i:s Y', $m[1] . ' ' . $m[2], self::sysTz());
            $ts = $dt ? $dt->getTimestamp() : null;
        }
        if ($ts === null) {
            return null;
        }
        preg_match_all(
            '~PHP (Fatal error|Parse error|Recoverable fatal error|Warning|Notice|Deprecated|Strict Standards):\s+(.+?)(?: in (/[^\s;"]+?)(?: on line |:)(\d+))?(?=;\s*PHP message:|;\s*PHP |" while|\\\\n|$)~',
            $line,
            $all,
            PREG_SET_ORDER
        );
        $out = [];
        foreach ($all as $e) {
            $level = match ($e[1]) {
                'Warning' => 'warning',
                'Notice' => 'notice',
                'Deprecated', 'Strict Standards' => 'deprecated',
                default => 'fatal',
            };
            $msg = trim($e[2]);
            if (str_starts_with($msg, 'Stack trace')) {
                continue;
            }
            $out[] = [$level, substr($msg, 0, 300), isset($e[3]) && $e[3] !== '' ? self::relPath($e[3]) : '', (int) ($e[4] ?? 0)];
        }
        return $out ? [$ts, $out] : null;
    }

    /**
     * Um bloco do slow log do PHP-FPM. Atribui a lentidão ao primeiro plugin, tema
     * ou mu-plugin que aparece no topo da pilha (a função que estava a correr).
     */
    public static function slowBlock(string $block): ?array
    {
        if (!preg_match('~^\[(\d{2}-\w{3}-\d{4} \d{2}:\d{2}:\d{2})\]\s+\[pool (\S+)\]~m', $block, $h)) {
            return null;
        }
        $dt = DateTime::createFromFormat('d-M-Y H:i:s', $h[1], self::sysTz());
        if (!$dt) {
            return null;
        }
        preg_match_all('~^\[0x[0-9a-f]+\] (\S+)\(\) (\S+):(\d+)\s*$~m', $block, $frames, PREG_SET_ORDER);
        $comp = 'WordPress (núcleo)';
        $example = '';
        foreach ($frames as $f) {
            if (preg_match('~/wp-content/(plugins|mu-plugins|themes)/([^/]+)~', $f[2], $c)) {
                $kind = ['plugins' => 'plugin', 'mu-plugins' => 'mu-plugin', 'themes' => 'tema'][$c[1]];
                $comp = "$kind: {$c[2]}";
                $example = $f[1] . '() ' . self::relPath($f[2]) . ':' . $f[3];
                break;
            }
        }
        if ($example === '' && isset($frames[0])) {
            $example = $frames[0][1] . '() ' . self::relPath($frames[0][2]) . ':' . $frames[0][3];
        }
        return [$dt->getTimestamp(), $comp, $example];
    }
}
