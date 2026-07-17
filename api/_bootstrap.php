<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/config/database.php';
ini_set('serialize_precision', '-1');

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_name('SEVENTH_REACTION_SESSION');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function jsonResponse(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonInput(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > 1048576) {
        jsonResponse(['ok' => false, 'error' => 'Invalid request body.'], 400);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        jsonResponse(['ok' => false, 'error' => 'Expected a JSON object.'], 400);
    }
    return $data;
}

function requireMethod(string $method): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $method) {
        header('Allow: ' . $method);
        jsonResponse(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }
}

function requirePlayerId(): int
{
    $playerId = (int)($_SESSION['player_id'] ?? 0);
    if ($playerId < 1) {
        jsonResponse(['ok' => false, 'error' => 'Authentication required.'], 401);
    }
    return $playerId;
}

function publicPlayer(array $player): array
{
    return [
        'id' => (int)$player['id'],
        'fullName' => $player['full_name'],
        'nickname' => $player['nickname'],
        'className' => $player['class_name'],
        'course' => $player['course_id'] ?: null,
        'totalScore' => (int)$player['total_score'],
    ];
}

function newRunId(): string
{
    return 'run-' . bin2hex(random_bytes(16));
}

function defaultGameState(array $player): array
{
    $now = gmdate('c');
    return [
        'version' => 2,
        'worldScale' => 8,
        'runId' => newRunId(),
        'playerId' => (int)$player['id'],
        'authenticated' => true,
        'profile' => [
            'fullName' => $player['full_name'],
            'nickname' => $player['nickname'],
            'className' => $player['class_name'],
            'course' => $player['course_id'] ?: null,
        ],
        'phase' => 'tutorial',
        'currentChapter' => 0,
        'completedChapters' => [],
        'score' => 0,
        'awardedQuestions' => [],
        'quiz' => ['chapterId' => null, 'questionIndex' => 0, 'attempts' => 0],
        'chapterProgress' => new stdClass(),
        'position' => ['x' => 4936, 'y' => 7592, 'facing' => 'up'],
        'settings' => ['movementSpeed' => 120, 'mapZoom' => 1, 'sound' => false],
        'weakTopics' => new stdClass(),
        'updatedAt' => $now,
    ];
}

function loadPlayerState(PDO $db, array $player): array
{
    $statement = $db->prepare('SELECT state_json FROM player_progress WHERE player_id = ?');
    $statement->execute([(int)$player['id']]);
    $row = $statement->fetch();
    if (!$row) {
        return defaultGameState($player);
    }
    $state = json_decode((string)$row['state_json'], true);
    return is_array($state) ? $state : defaultGameState($player);
}

function fetchPlayer(PDO $db, int $playerId): array
{
    $statement = $db->prepare('SELECT * FROM players WHERE id = ?');
    $statement->execute([$playerId]);
    $player = $statement->fetch();
    if (!$player) {
        unset($_SESSION['player_id']);
        jsonResponse(['ok' => false, 'error' => 'Player not found.'], 404);
    }
    return $player;
}
