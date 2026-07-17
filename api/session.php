<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
requireMethod('GET');

$playerId = (int)($_SESSION['player_id'] ?? 0);
if ($playerId < 1) {
    jsonResponse(['ok' => true, 'authenticated' => false]);
}

try {
    $db = database();
    $player = fetchPlayer($db, $playerId);
    jsonResponse([
        'ok' => true,
        'authenticated' => true,
        'player' => publicPlayer($player),
        'state' => loadPlayerState($db, $player),
    ]);
} catch (Throwable $error) {
    error_log('Seventh Reaction session error: ' . $error->getMessage());
    jsonResponse(['ok' => false, 'authenticated' => false, 'error' => 'Session service unavailable.'], 503);
}
