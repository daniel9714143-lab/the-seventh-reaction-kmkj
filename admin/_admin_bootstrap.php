<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/config/database.php';
ini_set('serialize_precision', '-1');

if (session_status() !== PHP_SESSION_ACTIVE) {
    $scriptDirectory = str_replace('\\', '/', dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/admin/index.php')));
    $adminCookiePath = getenv('VERCEL')
        ? '/admin/'
        : rtrim($scriptDirectory, '/') . '/';
    session_name('SEVENTH_REACTION_ADMIN');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => $adminCookiePath,
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

function adminCsrf(): string
{
    if (empty($_SESSION['admin_csrf'])) {
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['admin_csrf'];
}

function verifyAdminCsrf(): void
{
    $token = (string)($_POST['csrf'] ?? '');
    if ($token === '' || !hash_equals((string)($_SESSION['admin_csrf'] ?? ''), $token)) {
        http_response_code(419);
        exit('Session token expired. Return to the dashboard and try again.');
    }
}

function adminId(): int
{
    return (int)($_SESSION['admin_id'] ?? 0);
}

function clearAdminSession(): void
{
    unset($_SESSION['admin_id'], $_SESSION['admin_name'], $_SESSION['admin_username'], $_SESSION['admin_last_activity'], $_SESSION['admin_csrf']);
}

function currentAdmin(PDO $db): ?array
{
    $id = adminId();
    if ($id < 1) {
        return null;
    }
    $lastActivity = (int)($_SESSION['admin_last_activity'] ?? 0);
    if ($lastActivity > 0 && time() - $lastActivity > 7200) {
        clearAdminSession();
        return null;
    }
    $statement = $db->prepare('SELECT id, username, display_name, is_active, last_login_at FROM admins WHERE id = ? AND singleton_key = 1 AND is_active = 1 LIMIT 1');
    $statement->execute([$id]);
    $admin = $statement->fetch();
    if (!$admin) {
        clearAdminSession();
        return null;
    }
    $_SESSION['admin_last_activity'] = time();
    return $admin;
}

function requireAdmin(): int
{
    $admin = currentAdmin(database());
    if (!$admin) {
        header('Location: index.php');
        exit;
    }
    return (int)$admin['id'];
}

function e(?string $value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function auditAdmin(PDO $db, int $adminId, string $action, ?int $playerId = null, ?string $details = null): void
{
    $statement = $db->prepare('INSERT INTO admin_audit_logs (admin_id, action, target_player_id, details) VALUES (?, ?, ?, ?)');
    $statement->execute([$adminId, $action, $playerId, $details]);
}
