<?php
declare(strict_types=1);

require __DIR__ . '/../src/web.php';

web_init();

if (current_user()) {
    header('Location: ./');
    exit;
}

$error = null;
$wait = throttle_wait();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pin = preg_replace('/\D/', '', (string) ($_POST['pin'] ?? ''));

    if (!csrf_check()) {
        if (!isset($_COOKIE[session_name()]) && behind_varnish()) {
            // O browser enviou o cookie, mas o Varnish retirou-o pelo caminho.
            $error = 'O Varnish está ativo nesta aplicação e está a retirar o cookie de sessão. '
                . 'Na Cloudways, em Application Settings, desativa o Varnish para esta aplicação '
                . '(ou acrescenta o cookie "' . session_name() . '" às exclusões do Varnish) e tenta de novo.';
        } elseif (!isset($_COOKIE[session_name()])) {
            $error = 'O browser não enviou o cookie de sessão. Confirma que os cookies estão permitidos para este endereço e tenta de novo.';
        } else {
            $error = 'A sessão expirou. Tenta novamente.';
        }
    } elseif ($wait > 0) {
        $error = 'Demasiadas tentativas erradas. Tenta de novo daqui a ' . max(1, (int) ceil($wait / 60)) . ' min.';
    } elseif (!mon_pin_valid($pin)) {
        $error = 'O PIN tem ' . MON_PIN_LEN . ' dígitos.';
    } else {
        $id = mon_user_by_pin($pin);
        if ($id !== null) {
            throttle_clear_ip();
            session_regenerate_id(true);
            $_SESSION['user'] = $id;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            header('Location: ./');
            exit;
        }
        throttle_fail();
        $wait = throttle_wait();
        $error = $wait > 0
            ? 'PIN incorreto. Demasiadas tentativas erradas: tenta de novo daqui a ' . max(1, (int) ceil($wait / 60)) . ' min.'
            : 'PIN incorreto.';
    }
}
$users = mon_users();
$withoutPin = array_keys(array_filter($users, static fn($u) => empty($u['pin'])));
?><!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<script src="assets/theme.js?v=<?= MON_VERSION ?>"></script>
<title>Entrar · Monitor de recursos</title>
<link rel="stylesheet" href="assets/app.css?v=<?= MON_VERSION ?>">
</head>
<body class="login-page">
<main class="login-card">
  <div class="brand"><span class="brand-mark" aria-hidden="true"></span>Monitor de recursos</div>
  <h1>Entrar</h1>
  <?php if (!$users): ?>
    <p class="note">Ainda não há utilizadores. Cria o primeiro por SSH:<br><code>php bin/user.php add nuno admin "Nuno"</code></p>
  <?php elseif ($withoutPin): ?>
    <p class="note">Há contas ainda sem PIN. Para as ver e definir o PIN, por SSH:<br><code>php bin/user.php list</code><br><code>php bin/user.php pin &lt;utilizador&gt; --gerar</code></p>
  <?php endif; ?>
  <?php if ($error): ?><p class="error" role="alert"><?= h($error) ?></p><?php endif; ?>
  <form method="post" id="pin-form" autocomplete="off">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
    <label for="pin">PIN de <?= MON_PIN_LEN ?> dígitos</label>
    <input type="password" id="pin" name="pin" class="pin-input" inputmode="numeric" pattern="[0-9]{<?= MON_PIN_LEN ?>}"
           maxlength="<?= MON_PIN_LEN ?>" minlength="<?= MON_PIN_LEN ?>" required autofocus autocomplete="off"
           aria-describedby="pin-help"<?= $wait > 0 ? ' disabled' : '' ?>>
    <p class="note" id="pin-help">Entra automaticamente ao sexto dígito.</p>
    <button type="submit" class="btn-primary"<?= $wait > 0 ? ' disabled' : '' ?>>Entrar</button>
  </form>
</main>
<script src="assets/login.js?v=<?= MON_VERSION ?>"></script>
</body>
</html>
