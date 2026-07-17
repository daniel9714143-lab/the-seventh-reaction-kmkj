<?php
declare(strict_types=1);

function bondBotSettings(): array
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

    $geminiApiKey = trim((string)(getenv('GEMINI_API_KEY') ?: ($local['gemini_api_key'] ?? '')));
    if (str_contains(strtoupper($geminiApiKey), 'REPLACE_WITH')) {
        $geminiApiKey = '';
    }

    $directApiKey = trim((string)(getenv('OPENAI_API_KEY') ?: ($local['api_key'] ?? '')));
    if (str_contains(strtoupper($directApiKey), 'REPLACE_WITH')) {
        $directApiKey = '';
    }

    if ($geminiApiKey !== '') {
        $apiKey = $geminiApiKey;
        $model = trim((string)(getenv('GEMINI_MODEL') ?: ($local['gemini_model'] ?? 'gemini-3.5-flash')));
        if (!preg_match('/^gemini-[a-zA-Z0-9._-]{3,80}$/', $model)) {
            $model = 'gemini-3.5-flash';
        }
        $baseUrl = rtrim(trim((string)(getenv('GEMINI_BASE_URL') ?: ($local['gemini_base_url'] ?? 'https://generativelanguage.googleapis.com/v1beta'))), '/');
        if (!str_starts_with($baseUrl, 'https://')) {
            $baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        }
        $provider = 'google-gemini';
    } elseif ($directApiKey !== '') {
        $apiKey = $directApiKey;
        $model = trim((string)(getenv('OPENAI_MODEL') ?: ($local['model'] ?? 'gpt-5.6-sol')));
        if (!preg_match('/^[a-zA-Z0-9._-]{3,80}$/', $model)) {
            $model = 'gpt-5.6-sol';
        }
        $baseUrl = rtrim(trim((string)(getenv('OPENAI_BASE_URL') ?: ($local['base_url'] ?? 'https://api.openai.com/v1'))), '/');
        if (!str_starts_with($baseUrl, 'https://')) {
            $baseUrl = 'https://api.openai.com/v1';
        }
        $provider = 'openai';
    } else {
        // Vercel supplies a short-lived project identity token to deployments. It can
        // authenticate AI Gateway without storing a long-lived provider key in code.
        $gatewayApiKey = trim((string)(getenv('AI_GATEWAY_API_KEY') ?: ''));
        $vercelOidcToken = trim((string)(getenv('VERCEL_OIDC_TOKEN') ?: ($_SERVER['HTTP_X_VERCEL_OIDC_TOKEN'] ?? '')));
        $apiKey = $gatewayApiKey !== '' ? $gatewayApiKey : $vercelOidcToken;
        $model = trim((string)(getenv('AI_GATEWAY_MODEL') ?: ($local['gateway_model'] ?? 'openai/gpt-5.4-mini')));
        if (!str_contains($model, '/')) {
            $model = 'openai/' . $model;
        }
        if (!preg_match('/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:-]{3,100}$/', $model)) {
            $model = 'openai/gpt-5.4-mini';
        }
        $baseUrl = rtrim(trim((string)(getenv('AI_GATEWAY_BASE_URL') ?: 'https://ai-gateway.vercel.sh/v1')), '/');
        if (!str_starts_with($baseUrl, 'https://')) {
            $baseUrl = 'https://ai-gateway.vercel.sh/v1';
        }
        $provider = 'vercel-ai-gateway';
    }

    $settings = [
        'api_key' => $apiKey,
        'model' => $model,
        'base_url' => $baseUrl,
        'provider' => $provider,
        'configured' => $apiKey !== '',
    ];
    return $settings;
}

// Backward-compatible name for older entry points and local integrations.
function openAiSettings(): array
{
    return bondBotSettings();
}
