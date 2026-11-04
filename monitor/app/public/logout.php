<?php
declare(strict_types=1);

require __DIR__ . '/../src/web.php';

web_init();
if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_check()) {
    $_SESSION = [];
    session_regenerate_id(true);
    session_destroy();
}
header('Location: login.php');
