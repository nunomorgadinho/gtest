<?php
declare(strict_types=1);

/**
 * Gestão de utilizadores do dashboard (corre como master, por SSH).
 * Cada utilizador entra com um PIN de 6 dígitos, que também o identifica.
 *
 *   php bin/user.php list
 *   php bin/user.php add <utilizador> <admin|cliente> [nome] [--gerar]
 *   php bin/user.php pin <utilizador> [--gerar]
 *   php bin/user.php del <utilizador>
 *
 * Sem --gerar, o PIN é pedido (sem aparecer no ecrã). Com --gerar, é criado um PIN
 * aleatório e mostrado uma única vez.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/../src/bootstrap.php';

$file = MON_ROOT . '/config/users.php';
$users = mon_users();
$args = array_values(array_filter(array_slice($argv, 1), static fn($a) => $a !== '--gerar'));
$generate = in_array('--gerar', $argv, true);
[$cmd, $id, $role, $name] = array_pad($args, 4, null);
$id = $id !== null ? trim($id) : null;

function fail(string $msg): never
{
    fwrite(STDERR, $msg . "\n");
    exit(1);
}

function save_users(string $file, array $users): void
{
    $tmp = $file . '.tmp';
    file_put_contents($tmp, "<?php\n// Gerado por bin/user.php. Não editar à mão.\nreturn " . var_export($users, true) . ";\n");
    chmod($tmp, 0644);
    rename($tmp, $file);
}

/** Pede ou gera um PIN válido, forte e diferente dos PINs dos outros utilizadores. */
function choose_pin(bool $generate, ?string $except): string
{
    if ($generate) {
        do {
            $pin = mon_pin_generate();
        } while (mon_user_by_pin($pin, $except) !== null);
        return $pin;
    }
    for ($try = 0; $try < 3; $try++) {
        fwrite(STDOUT, 'PIN (' . MON_PIN_LEN . ' dígitos): ');
        shell_exec('stty -echo 2>/dev/null');
        $p1 = trim((string) fgets(STDIN));
        fwrite(STDOUT, "\nRepetir: ");
        $p2 = trim((string) fgets(STDIN));
        shell_exec('stty echo 2>/dev/null');
        fwrite(STDOUT, "\n");
        if (!mon_pin_valid($p1)) {
            fwrite(STDERR, 'O PIN tem de ter exatamente ' . MON_PIN_LEN . " dígitos.\n");
        } elseif ($p1 !== $p2) {
            fwrite(STDERR, "Não coincidem.\n");
        } elseif (mon_pin_weak($p1)) {
            fwrite(STDERR, "PIN demasiado fácil (repetições ou sequências). Escolhe outro.\n");
        } elseif (mon_user_by_pin($p1, $except) !== null) {
            fwrite(STDERR, "Esse PIN já está a ser usado por outro utilizador. Escolhe outro.\n");
        } else {
            return $p1;
        }
    }
    fail('Cancelado.');
}

switch ($cmd) {
    case 'list':
        if (!$users) {
            echo "Sem utilizadores.\n";
        }
        foreach ($users as $uid => $u) {
            printf("%-25s %-8s %-25s %s\n", $uid, $u['role'], $u['name'] ?? '', empty($u['pin']) ? '(sem PIN)' : 'PIN definido');
        }
        break;

    case 'add':
        if (!$id || !preg_match('/^[\w.@+-]{2,64}$/u', $id) || !in_array($role, ['admin', 'cliente'], true)) {
            fail('Uso: php bin/user.php add <utilizador> <admin|cliente> [nome] [--gerar]');
        }
        if (isset($users[$id])) {
            fail("Já existe. Usa 'pin' para mudar o PIN.");
        }
        $pin = choose_pin($generate, null);
        $users[$id] = ['role' => $role, 'name' => $name ?? '', 'pin' => password_hash($pin, PASSWORD_DEFAULT)];
        save_users($file, $users);
        echo "Criado: $id ($role)\n";
        if ($generate) {
            echo "PIN: $pin  (guarda-o agora; não volta a ser mostrado)\n";
        }
        break;

    case 'pin':
        if (!isset($users[$id])) {
            fail('Utilizador não existe.');
        }
        $pin = choose_pin($generate, $id);
        $users[$id]['pin'] = password_hash($pin, PASSWORD_DEFAULT);
        unset($users[$id]['hash']); // password antiga (versões anteriores)
        save_users($file, $users);
        echo "PIN alterado para $id.\n";
        if ($generate) {
            echo "PIN: $pin  (guarda-o agora; não volta a ser mostrado)\n";
        }
        break;

    case 'del':
        if (!isset($users[$id])) {
            fail('Utilizador não existe.');
        }
        unset($users[$id]);
        save_users($file, $users);
        echo "Removido: $id\n";
        break;

    default:
        fail("Comandos:\n  list\n  add <utilizador> <admin|cliente> [nome] [--gerar]\n  pin <utilizador> [--gerar]\n  del <utilizador>");
}
