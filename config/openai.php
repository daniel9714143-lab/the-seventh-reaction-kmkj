<?php
declare(strict_types=1);

function openAiSettings(): array
{
    static $settings = null;
    if (is_array($settings)) {
        return $settings;
    }

    $local = [];
    $localPath = __DIR__ . '/openai.local.php';
    if (is_readable($localPath)) {
        $loaded = require $localPath;
        if (is_array($loaded)) {
            $local = $loaded;
        }
    }

    $apiKey = trim((string)(getenv('OPENAI_API_KEY') ?: ($local['api_key'] ?? '')));
    if (str_contains(strtoupper($apiKey), 'REPLACE_WITH')) {
        $apiKey = '';
    }

    $model = trim((string)(getenv('OPENAI_MODEL') ?: ($local['model'] ?? 'gpt-5.6-sol')));
    if (!preg_match('/^[a-zA-Z0-9._-]{3,80}$/', $model)) {
        $model = 'gpt-5.6-sol';
    }

    $baseUrl = rtrim(trim((string)(getenv('OPENAI_BASE_URL') ?: ($local['base_url'] ?? 'https://api.openai.com/v1'))), '/');
    if (!str_starts_with($baseUrl, 'https://')) {
        $baseUrl = 'https://api.openai.com/v1';
    }

    $settings = ['api_key' => $apiKey, 'model' => $model, 'base_url' => $baseUrl];
    return $settings;
}
