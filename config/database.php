<?php
declare(strict_types=1);

function database(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $database = getenv('SEVENTH_REACTION_DB_NAME') ?: (getenv('TIDB_DATABASE') ?: 'seventh_reaction');
    $username = getenv('SEVENTH_REACTION_DB_USER') ?: (getenv('TIDB_USER') ?: 'root');
    $password = getenv('SEVENTH_REACTION_DB_PASS') ?: (getenv('TIDB_PASSWORD') ?: '');
    $networkHost = getenv('SEVENTH_REACTION_DB_HOST') ?: (getenv('TIDB_HOST') ?: '');
    $port = getenv('SEVENTH_REACTION_DB_PORT') ?: (getenv('TIDB_PORT') ?: '3306');
    $socket = getenv('SEVENTH_REACTION_DB_SOCKET') ?: '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock';

    if ($networkHost === '' && is_readable($socket)) {
        $dsn = "mysql:unix_socket={$socket};dbname={$database};charset=utf8mb4";
    } else {
        $host = $networkHost !== '' ? $networkHost : '127.0.0.1';
        $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 12,
    ];

    $tlsRequested = filter_var(getenv('SEVENTH_REACTION_DB_TLS') ?: false, FILTER_VALIDATE_BOOLEAN)
        || str_contains(strtolower($networkHost), 'tidbcloud.com');
    if ($tlsRequested && defined('PDO::MYSQL_ATTR_SSL_CA')) {
        $configuredCa = trim((string)(getenv('SEVENTH_REACTION_DB_SSL_CA') ?: ''));
        $caCandidates = array_filter([
            $configuredCa,
            '/etc/ssl/certs/ca-certificates.crt',
            '/etc/pki/tls/certs/ca-bundle.crt',
            '/etc/ssl/cert.pem',
            function_exists('openssl_get_cert_locations')
                ? (openssl_get_cert_locations()['default_cert_file'] ?? '')
                : '',
        ]);
        foreach ($caCandidates as $caFile) {
            if (is_readable($caFile)) {
                $options[PDO::MYSQL_ATTR_SSL_CA] = $caFile;
                if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
                    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = true;
                }
                break;
            }
        }
    }

    $connection = new PDO($dsn, $username, $password, $options);
    return $connection;
}
