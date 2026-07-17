<?php
declare(strict_types=1);

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $database = getenv('SEVENTH_REACTION_DB_NAME') ?: 'seventh_reaction';
    $username = getenv('SEVENTH_REACTION_DB_USER') ?: 'root';
    $password = getenv('SEVENTH_REACTION_DB_PASS') ?: '';
    $socket = getenv('SEVENTH_REACTION_DB_SOCKET') ?: '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock';

    if (is_readable($socket)) {
        $dsn = "mysql:unix_socket={$socket};dbname={$database};charset=utf8mb4";
    } else {
        $host = getenv('SEVENTH_REACTION_DB_HOST') ?: '127.0.0.1';
        $port = getenv('SEVENTH_REACTION_DB_PORT') ?: '3306';
        $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
    }

    $connection = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $connection;
}
