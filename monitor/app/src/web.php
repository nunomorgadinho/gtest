<?php
declare(strict_types=1);

/**
 * Comum a todas as páginas web: cabeçalhos de segurança, sessão, login e CSRF.
 */

require __DIR__ . '/bootstrap.php';

function web_init(): void
{
    mon_config();
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    // Nunca deixar o Varnish nem o browser guardar estas páginas.
    header('Cache-Control: no-store, private, max-age=0');

    web_check_docroot();

    $secure = (($_SERVER['HTTPS'] ?? '') === 'on') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('wlmon');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
    // Sessão expira após 12 h de inatividade.
    if (isset($_SESSION['seen']) && time() - $_SESSION['seen'] > 43200) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['seen'] = time();
}

/**
 * A pasta pública tem de ser a raiz do site. Se a Cloudways estiver a servir
 * public_html inteiro, config/ e data/ ficariam expostos: recusamos servir.
 */
function web_check_docroot(): void
{
    $doc = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
    $pub = realpath(MON_ROOT . '/public');
    if ($doc !== false && $pub !== false && $doc !== $pub) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "Configuração incompleta: na Cloudways, em Application Settings > Webroot, define a pasta pública como public_html/public.\n";
        exit;
    }
}

/**
 * O pedido passou pelo Varnish? O Varnish acrescenta o cabeçalho X-Varnish aos
 * pedidos que envia ao servidor de trás. Na Cloudways, o Varnish retira cookies
 * que não conhece (como o da sessão deste painel), o que impede o login.
 */
function behind_varnish(): bool
{
    return !empty($_SERVER['HTTP_X_VARNISH']);
}

function h(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_check(): bool
{
    $t = $_POST['csrf'] ?? '';
    return is_string($t) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t);
}

function current_user(): ?array
{
    $email = $_SESSION['user'] ?? null;
    if (!$email) {
        return null;
    }
    $users = mon_users();
    if (!isset($users[$email])) {
        return null; // utilizador removido entretanto
    }
    return ['email' => $email] + $users[$email];
}

function require_user(bool $json = false): array
{
    $u = current_user();
    if ($u) {
        return $u;
    }
    if ($json) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo '{"error":"auth"}';
    } else {
        header('Location: login.php');
    }
    exit;
}

/* ---------- Limite de tentativas de login (ficheiros em tmp) ---------- */

function throttle_file(string $key): string
{
    return sys_get_temp_dir() . '/wlmon-login-' . hash('sha256', $key);
}

function throttle_blocked(string ...$keys): bool
{
    foreach ($keys as $k) {
        $d = @json_decode((string) @file_get_contents(throttle_file($k)), true);
        if (is_array($d) && $d['n'] >= 5 && time() - $d['t'] < 900) {
            return true;
        }
    }
    return false;
}

function throttle_fail(string ...$keys): void
{
    foreach ($keys as $k) {
        $f = throttle_file($k);
        $d = @json_decode((string) @file_get_contents($f), true);
        if (!is_array($d) || time() - $d['t'] >= 900) {
            $d = ['n' => 0, 't' => time()];
        }
        $d['n']++;
        @file_put_contents($f, json_encode($d), LOCK_EX);
    }
}

function throttle_clear(string ...$keys): void
{
    foreach ($keys as $k) {
        @unlink(throttle_file($k));
    }
}

/* ---------- Métricas ao vivo ---------- */

/**
 * Taxas atuais a partir de /proc. Guarda a fotografia anterior num ficheiro
 * temporário: se for recente, calcula a diferença sem esperar; caso contrário
 * tira duas fotografias com 0,5 s de intervalo.
 */
function live_rates(): array
{
    $file = sys_get_temp_dir() . '/wlmon-live.json';
    $fh = fopen($file, 'c+');
    if ($fh) {
        flock($fh, LOCK_EX);
    }
    $prev = $fh ? json_decode((string) stream_get_contents($fh), true) : null;
    $age = is_array($prev) ? microtime(true) - (float) ($prev['t'] ?? 0) : INF;

    if ($age < 1.0 && isset($prev['_rates'])) {
        // Pedido muito próximo do anterior (vários separadores abertos): reutiliza.
        if ($fh) {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
        return $prev['_rates'];
    }
    if ($age > 30) {
        $prev = Procfs::snapshot();
        usleep(500_000);
    }
    unset($prev['_rates']);
    $cur = Procfs::snapshot();
    $rates = Procfs::rates($prev, $cur);
    if ($fh) {
        $cur['_rates'] = $rates;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($cur));
        flock($fh, LOCK_UN);
        fclose($fh);
    }
    return $rates;
}

function json_out(array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
