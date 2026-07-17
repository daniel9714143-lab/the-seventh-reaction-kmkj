<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
requireMethod('POST');
$input = jsonInput();
$action = (string)($input['action'] ?? '');

try {
    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $parameters = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $parameters['path'], $parameters['domain'] ?? '', $parameters['secure'], $parameters['httponly']);
        }
        session_destroy();
        jsonResponse(['ok' => true]);
    }

    $db = database();
    if ($action === 'register') {
        $fullName = trim((string)($input['fullName'] ?? ''));
        $nickname = trim((string)($input['nickname'] ?? ''));
        $className = trim((string)($input['className'] ?? ''));
        $username = trim((string)($input['login'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $confirmPassword = (string)($input['confirmPassword'] ?? '');

        if (mb_strlen($fullName) < 2 || mb_strlen($fullName) > 120
            || mb_strlen($nickname) < 2 || mb_strlen($nickname) > 32
            || mb_strlen($className) < 2 || mb_strlen($className) > 40
            || mb_strlen($username) < 3 || mb_strlen($username) > 120
            || strlen($password) < 8) {
            jsonResponse(['ok' => false, 'error' => 'Complete every field. Password must contain at least 8 characters.'], 422);
        }
        if (!hash_equals($password, $confirmPassword)) {
            jsonResponse(['ok' => false, 'error' => 'Confirm Password must match Password.'], 422);
        }

        $db->beginTransaction();
        try {
            $statement = $db->prepare('INSERT INTO players (username, password_hash, full_name, nickname, class_name) VALUES (?, ?, ?, ?, ?)');
            $statement->execute([$username, password_hash($password, PASSWORD_DEFAULT), $fullName, $nickname, $className]);
            $playerId = (int)$db->lastInsertId();
            $player = fetchPlayer($db, $playerId);
            $state = defaultGameState($player);
            $statement = $db->prepare('INSERT INTO player_progress (player_id, state_json, run_id, position_x, position_y, completed_chapters) VALUES (?, ?, ?, 4936, 7592, JSON_ARRAY())');
            $statement->execute([$playerId, json_encode($state, JSON_UNESCAPED_UNICODE), $state['runId']]);
            $db->commit();
        } catch (PDOException $error) {
            $db->rollBack();
            if ((string)$error->getCode() === '23000') {
                jsonResponse(['ok' => false, 'error' => 'That Matric Card / Student ID or nickname is already registered.'], 409);
            }
            throw $error;
        }
    } elseif ($action === 'login') {
        $login = trim((string)($input['login'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $statement = $db->prepare('SELECT * FROM players WHERE username = ? OR nickname = ? LIMIT 1');
        $statement->execute([$login, $login]);
        $player = $statement->fetch();
        if (!$player || !password_verify($password, $player['password_hash'])) {
            jsonResponse(['ok' => false, 'error' => 'Matric Card / Student ID or password is incorrect.'], 401);
        }
        $playerId = (int)$player['id'];
        $state = loadPlayerState($db, $player);
        $db->prepare('UPDATE players SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$playerId]);
    } else {
        jsonResponse(['ok' => false, 'error' => 'Unknown authentication action.'], 400);
    }

    session_regenerate_id(true);
    $_SESSION['player_id'] = $playerId;
    jsonResponse(['ok' => true, 'player' => publicPlayer($player), 'state' => $state]);
} catch (Throwable $error) {
    error_log('Seventh Reaction authentication error: ' . $error->getMessage());
    jsonResponse(['ok' => false, 'error' => 'The player database is unavailable. Try offline demo mode.'], 503);
}
