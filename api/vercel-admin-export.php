<?php
declare(strict_types=1);

try {
    require dirname(__DIR__) . '/admin/export.php';
} catch (Throwable $error) {
    error_log('Seventh Reaction admin export deployment error: ' . $error->getMessage());
    http_response_code(503);
    header('Content-Type: text/plain; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    echo 'Admin database is not configured.';
}
