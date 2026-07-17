<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once dirname(__DIR__) . '/config/database.php';

$db = database();
$username = trim((string)(getenv('SEVENTH_REACTION_ADMIN_USER') ?: 'admin_kmkj'));
$password = (string)(getenv('SEVENTH_REACTION_ADMIN_PASSWORD') ?: '');
if (mb_strlen($username) < 3 || strlen($password) < 10) {
    fwrite(STDERR, "Set SEVENTH_REACTION_ADMIN_PASSWORD to at least 10 characters before provisioning the administrator.\n");
    exit(1);
}
$passwordHash = password_hash($password, PASSWORD_DEFAULT);
$displayName = 'KMKJ Administrator';

$db->beginTransaction();
try {
    $statement = $db->prepare('SELECT id FROM admins WHERE username = ? ORDER BY id LIMIT 1');
    $statement->execute([$username]);
    $adminId = (int)($statement->fetchColumn() ?: 0);
    if ($adminId < 1) {
        $adminId = (int)($db->query('SELECT id FROM admins ORDER BY id LIMIT 1')->fetchColumn() ?: 0);
    }
    if ($adminId < 1) {
        $insert = $db->prepare('INSERT INTO admins (username, password_hash, display_name, is_active) VALUES (?, ?, ?, TRUE)');
        $insert->execute([$username, $passwordHash, $displayName]);
        $adminId = (int)$db->lastInsertId();
    } else {
        $update = $db->prepare('UPDATE admins SET username = ?, password_hash = ?, display_name = ?, is_active = TRUE WHERE id = ?');
        $update->execute([$username, $passwordHash, $displayName, $adminId]);
    }

    $db->prepare('UPDATE admin_audit_logs SET admin_id = ? WHERE admin_id <> ?')->execute([$adminId, $adminId]);
    $db->prepare('DELETE FROM admins WHERE id <> ?')->execute([$adminId]);
    $db->commit();
} catch (Throwable $exception) {
    $db->rollBack();
    throw $exception;
}

$column = $db->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'singleton_key'")->fetchColumn();
if ((int)$column === 0) {
    $db->exec('ALTER TABLE admins ADD COLUMN singleton_key TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER id');
}

$db->exec('UPDATE admins SET singleton_key = 1');

$unique = $db->query("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND INDEX_NAME = 'uq_admin_singleton'")->fetchColumn();
if ((int)$unique === 0) {
    $db->exec('ALTER TABLE admins ADD UNIQUE KEY uq_admin_singleton (singleton_key)');
}

$check = $db->query("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND CONSTRAINT_NAME = 'chk_admin_singleton'")->fetchColumn();
if ((int)$check === 0) {
    $db->exec('ALTER TABLE admins ADD CONSTRAINT chk_admin_singleton CHECK (singleton_key = 1)');
}

$admin = $db->query('SELECT id, singleton_key, username, display_name, is_active FROM admins')->fetchAll();
echo json_encode(['ok' => count($admin) === 1, 'admins' => $admin], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), PHP_EOL;
