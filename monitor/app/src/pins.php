<?php
declare(strict_types=1);

/**
 * PINs de acesso: 6 dígitos por utilizador, guardados só como hash (password_hash).
 * O PIN identifica o utilizador, por isso dois utilizadores nunca podem ter o mesmo.
 */

const MON_PIN_LEN = 6;

function mon_pin_valid(string $pin): bool
{
    return (bool) preg_match('/^\d{' . MON_PIN_LEN . '}$/', $pin);
}

/** PINs fáceis de adivinhar: dígitos repetidos, sequências e padrões comuns. */
function mon_pin_weak(string $pin): bool
{
    if (!mon_pin_valid($pin)) {
        return true;
    }
    if (count(array_unique(str_split($pin))) <= 2) {
        return true; // 000000, 111222, 121212…
    }
    if (str_contains('01234567890', $pin) || str_contains('09876543210', $pin)) {
        return true; // 123456, 654321, 345678…
    }
    if (substr($pin, 0, 3) === substr($pin, 3, 3)) {
        return true; // 123123, 258258…
    }
    return in_array($pin, ['112233', '147258', '159753', '102030', '696969', '142536', '147852', '963852', '987654'], true);
}

function mon_pin_generate(): string
{
    do {
        $pin = str_pad((string) random_int(0, 999999), MON_PIN_LEN, '0', STR_PAD_LEFT);
    } while (mon_pin_weak($pin));
    return $pin;
}

/**
 * Utilizador a quem pertence o PIN, ou null. Verifica o PIN contra todos os
 * utilizadores (sem parar no primeiro), para o tempo de resposta não revelar nada.
 */
function mon_user_by_pin(string $pin, ?string $except = null): ?string
{
    $found = null;
    $checked = false;
    foreach (mon_users() as $id => $u) {
        if ($id === $except || empty($u['pin'])) {
            continue;
        }
        $checked = true;
        if (password_verify($pin, $u['pin']) && $found === null) {
            $found = (string) $id;
        }
    }
    if (!$checked) {
        // Sem utilizadores com PIN: gastar o mesmo tempo de uma verificação.
        password_verify($pin, '$2y$10$mQldEGVvIV1D60c7Zjl4UO931e57kvrY5nad6VeTka5vRlbeMipwC');
    }
    return $found;
}
