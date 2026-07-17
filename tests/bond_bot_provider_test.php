<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/config/bond_bot_provider.php';

function expect(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$settings = [
    'provider' => 'google-gemini',
    'api_key' => 'test-secret',
    'model' => 'gemini-3.5-flash',
    'base_url' => 'https://generativelanguage.googleapis.com/v1beta',
];
$request = bondBotProviderRequest(
    $settings,
    'Explain clearly.',
    'Why does sodium form Na+?',
    ['chapter_topic' => 'Atomic Structure'],
    [['role' => 'user', 'text' => 'Let us discuss ions.'], ['role' => 'assistant', 'text' => 'Sure.']]
);
$body = json_decode($request['body'], true, 512, JSON_THROW_ON_ERROR);
expect($request['endpoint'] === 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', 'Unexpected Gemini endpoint.');
expect(in_array('x-goog-api-key: test-secret', $request['headers'], true), 'Gemini API key header missing.');
expect(($body['systemInstruction']['parts'][0]['text'] ?? '') === 'Explain clearly.', 'System instruction missing.');
expect(($body['contents'][1]['role'] ?? '') === 'model', 'Assistant history must use the Gemini model role.');
expect(str_contains((string)($body['contents'][2]['parts'][0]['text'] ?? ''), 'Why does sodium form Na+?'), 'Student question missing.');

$answer = bondBotProviderAnswer($settings, [
    'candidates' => [['content' => ['parts' => [['text' => 'Sodium loses'], ['text' => 'one electron.']]]]],
]);
expect($answer === "Sodium loses\none electron.", 'Gemini response parsing failed.');
[$status, $message] = bondBotProviderErrorMessage($settings, 429, 'RESOURCE_EXHAUSTED');
expect($status === 429 && str_contains($message, 'free-tier'), 'Gemini rate-limit message failed.');

$openAiSettings = [
    'provider' => 'openai',
    'api_key' => 'test-secret',
    'model' => 'gpt-test',
    'base_url' => 'https://api.openai.com/v1',
];
$openAiRequest = bondBotProviderRequest($openAiSettings, 'Explain clearly.', 'What is pH?', [], []);
$openAiBody = json_decode($openAiRequest['body'], true, 512, JSON_THROW_ON_ERROR);
expect($openAiRequest['endpoint'] === 'https://api.openai.com/v1/responses', 'Unexpected OpenAI endpoint.');
expect(($openAiBody['model'] ?? '') === 'gpt-test', 'OpenAI model missing.');
expect(bondBotProviderAnswer($openAiSettings, ['output_text' => 'pH measures acidity.']) === 'pH measures acidity.', 'OpenAI response parsing failed.');

echo "Bond Bot provider tests passed.\n";
