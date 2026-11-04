<?php
declare(strict_types=1);

require __DIR__ . '/../src/web.php';

web_init();

if (current_user()) {
    header('Location: ./');
    exit;
}

$error = null;
$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim((string) ($_POST['email'] ?? '')));
    $pass = (string) ($_POST['password'] ?? '');
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
    $keys = ['u:' . $email, 'ip:' . $ip];

    if (!csrf_check()) {
        $error = 'A sessão expirou. Tenta novamente.';
    } elseif (throttle_blocked(...$keys)) {
        $error = 'Demasiadas tentativas. Aguarda 15 minutos.';
    } else {
        $users = mon_users();
        $hash = $users[$email]['hash'] ?? null;
        // Verifica sempre um hash, mesmo para utilizadores inexistentes (tempo constante).
        $ok = password_verify($pass, $hash ?? '$2y$10$mQldEGVvIV1D60c7Zjl4UO931e57kvrY5nad6VeTka5vRlbeMipwC');
        if ($ok && $hash) {
            throttle_clear(...$keys);
            session_regenerate_id(true);
            $_SESSION['user'] = $email;
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
            header('Location: ./');
            exit;
        }
        throttle_fail(...$keys);
        $error = 'Email ou password incorretos.';
    }
}
$noUsers = !mon_users();
?><!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Entrar · Monitor de recursos</title>
<link rel="stylesheet" href="assets/app.css?v=<?= MON_VERSION ?>">
</head>
<body class="login-page">
<main class="login-card">
  <div class="brand"><span class="brand-mark" aria-hidden="true"></span>Monitor de recursos</div>
  <h1>Entrar</h1>
  <?php if ($noUsers): ?>
    <p class="note">Ainda não há utilizadores. Cria o primeiro por SSH:<br><code>php bin/user.php add email@exemplo.pt admin</code></p>
  <?php endif; ?>
  <?php if ($error): ?><p class="error" role="alert"><?= h($error) ?></p><?php endif; ?>
  <form method="post" autocomplete="on">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
    <label>Email<input type="email" name="email" value="<?= h($email) ?>" required autofocus autocomplete="username"></label>
    <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
    <button type="submit" class="btn-primary">Entrar</button>
  </form>
</main>
</body>
</html>
