<?php
declare(strict_types=1);

final class DatabaseSessionHandler implements SessionHandlerInterface
{
    public function __construct(
        private readonly PDO $db,
        private readonly string $namespace,
        private readonly int $ttlSeconds
    ) {
    }

    public function open(string $path, string $name): bool
    {
        return true;
    }

    public function close(): bool
    {
        return true;
    }

    public function read(string $id): string|false
    {
        $statement = $this->db->prepare(
            'SELECT session_data FROM web_sessions
             WHERE session_namespace = ? AND session_id = ? AND expires_at > CURRENT_TIMESTAMP
             LIMIT 1'
        );
        $statement->execute([$this->namespace, $id]);
        $row = $statement->fetch();
        return $row ? (string)$row['session_data'] : '';
    }

    public function write(string $id, string $data): bool
    {
        $statement = $this->db->prepare(
            'INSERT INTO web_sessions (session_namespace, session_id, session_data, expires_at)
             VALUES (?, ?, ?, TIMESTAMPADD(SECOND, ?, CURRENT_TIMESTAMP))
             ON DUPLICATE KEY UPDATE session_data = VALUES(session_data), expires_at = VALUES(expires_at)'
        );
        return $statement->execute([$this->namespace, $id, $data, $this->ttlSeconds]);
    }

    public function destroy(string $id): bool
    {
        $statement = $this->db->prepare('DELETE FROM web_sessions WHERE session_namespace = ? AND session_id = ?');
        return $statement->execute([$this->namespace, $id]);
    }

    public function gc(int $max_lifetime): int|false
    {
        return $this->db->exec('DELETE FROM web_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
    }
}

function configureDatabaseSessions(string $namespace, int $ttlSeconds): bool
{
    try {
        $db = database();
        $db->exec(
            'CREATE TABLE IF NOT EXISTS web_sessions (
                session_namespace VARCHAR(32) NOT NULL,
                session_id VARCHAR(128) NOT NULL,
                session_data MEDIUMBLOB NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (session_namespace, session_id),
                KEY idx_web_sessions_expiry (expires_at)
            ) ENGINE=InnoDB'
        );
        session_set_save_handler(new DatabaseSessionHandler($db, $namespace, max(300, $ttlSeconds)), true);
        return true;
    } catch (Throwable $error) {
        error_log('Database session storage unavailable: ' . $error->getMessage());
        return false;
    }
}
