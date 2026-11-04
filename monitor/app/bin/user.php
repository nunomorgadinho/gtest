<?php
declare(strict_types=1);

/**
 * Gestão de utilizadores do dashboard (corre como master, por SSH).
 *
 *   php bin/user.php list
 *   php bin/user.php add <email> <admin|cliente> [nome]
 *   php bin/user.php passwd <email>
 *   php bin/user.php del <email>
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';

$file = MON_ROOT . '/config/users.php';
$users = mon_users();
[$cmd, $email, $role, $name] = array_pad(array_slice($argv, 1), 4, null);
$email = $email !== null ? strtolower(trim($email)) : null;

function ask_password(): string
{
    for ($try = 0; $try < 3; $try++) {
        fwrite(STDOUT, 'Password (mínimo 12 caracteres): ');
        shell_exec('stty -echo');
        $p1 = rtrim((string) fgets(STDIN), "\r\n");
        fwrite(STDOUT, "\nRepetir: ");
        $p2 = rtrim((string) fgets(STDIN), "\r\n");
        shell_exec('stty echo');
        fwrite(STDOUT, "\n");
        if (mb_strlen($p1) < 12) {
            fwrite(STDERR, "Demasiado curta.\n");
        } elseif ($p1 !== $p2) {
            fwrite(STDERR, "Não coincidem.\n");
        } else {
            return $p1;
        }
    }
    fwrite(STDERR, "Cancelado.\n");
    exit(1);
}

function save_users(string $file, array $users): void
{
    $tmp = $file . '.tmp';
    file_put_contents($tmp, "<?php\n// Gerado por bin/user.php. Não editar à mão.\nreturn " . var_export($users, true) . ";\n");
    chmod($tmp, 0644);
    rename($tmp, $file);
}

switch ($cmd) {
    case 'list':
        if (!$users) {
            echo "Sem utilizadores.\n";
        }
        foreach ($users as $e => $u) {
            printf("%-35s %-8s %s\n", $e, $u['role'], $u['name'] ?? '');
        }
        break;

    case 'add':
        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL) || !in_array($role, ['admin', 'cliente'], true)) {
            fwrite(STDERR, "Uso: php bin/user.php add <email> <admin|cliente> [nome]\n");
            exit(1);
        }
        if (isset($users[$email])) {
            fwrite(STDERR, "Já existe. Usa 'passwd' para mudar a password.\n");
            exit(1);
        }
        $users[$email] = ['role' => $role, 'name' => $name ?? '', 'hash' => password_hash(ask_password(), PASSWORD_DEFAULT)];
        save_users($file, $users);
        echo "Criado: $email ($role)\n";
        break;

    case 'passwd':
        if (!isset($users[$email])) {
            fwrite(STDERR, "Utilizador não existe.\n");
            exit(1);
        }
        $users[$email]['hash'] = password_hash(ask_password(), PASSWORD_DEFAULT);
        save_users($file, $users);
        echo "Password alterada.\n";
        break;

    case 'del':
        if (!isset($users[$email])) {
            fwrite(STDERR, "Utilizador não existe.\n");
            exit(1);
        }
        unset($users[$email]);
        save_users($file, $users);
        echo "Removido: $email\n";
        break;

    default:
        fwrite(STDERR, "Comandos: list | add <email> <admin|cliente> [nome] | passwd <email> | del <email>\n");
        exit(1);
}
