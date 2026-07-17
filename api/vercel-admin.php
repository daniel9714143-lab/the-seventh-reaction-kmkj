<?php
declare(strict_types=1);

try {
    require dirname(__DIR__) . '/admin/index.php';
} catch (Throwable $error) {
    error_log('Seventh Reaction admin deployment error: ' . $error->getMessage());
    http_response_code(503);
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin Database Required</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;background:#06141b;color:#dffcf2;font:16px monospace}main{max-width:620px;padding:32px;border:2px solid #64d8cb;background:#081d26}h1{color:#ffdf60}a{color:#64d8cb}</style><main><h1>ADMIN DATABASE REQUIRED</h1><p>The separate Admin Website will become available after a network-accessible MySQL database is configured in the Vercel environment.</p><p><a href="/">Return to The Seventh Reaction</a></p></main></html>';
}
