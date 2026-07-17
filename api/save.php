<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
requireMethod('POST');
$playerId = requirePlayerId();
$input = jsonInput();
$state = $input['state'] ?? null;

if (!is_array($state)) {
    jsonResponse(['ok' => false, 'error' => 'Missing game state.'], 422);
}

$allowedCourses = ['basic', 'civil', 'mechanical', 'electrical'];
$course = $state['profile']['course'] ?? null;
if ($course !== null && !in_array($course, $allowedCourses, true)) {
    jsonResponse(['ok' => false, 'error' => 'Invalid course.'], 422);
}

$chapter = max(0, min(7, (int)($state['currentChapter'] ?? 0)));
$runScore = max(0, (int)($state['score'] ?? 0));
$runId = preg_replace('/[^a-zA-Z0-9-]/', '', (string)($state['runId'] ?? ''));
if ($runId === '' || strlen($runId) > 80) {
    jsonResponse(['ok' => false, 'error' => 'Invalid run identifier.'], 422);
}
$state['version'] = 2;
$state['worldScale'] = 8;
$positionX = max(0, min(10240, (float)($state['position']['x'] ?? 4936)));
$positionY = max(0, min(7960, (float)($state['position']['y'] ?? 7592)));
$completed = array_values(array_unique(array_filter(array_map('intval', $state['completedChapters'] ?? []), fn(int $id): bool => $id >= 1 && $id <= 7)));
$awarded = array_values(array_unique(array_filter($state['awardedQuestions'] ?? [], fn($id): bool => is_string($id) && preg_match('/^[a-z0-9-]{3,80}$/', $id))));
$progressPercent = round(count($completed) / 7 * 100, 2);
$state['updatedAt'] = gmdate('c');
$encodedState = json_encode($state, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($encodedState === false || strlen($encodedState) > 1048576) {
    jsonResponse(['ok' => false, 'error' => 'Game state is too large.'], 422);
}

try {
    $db = database();
    $db->beginTransaction();
    $player = fetchPlayer($db, $playerId);

    $newPoints = 0;
    if ($course !== null) {
        $insertEvent = $db->prepare('INSERT IGNORE INTO score_events (player_id, run_id, question_id, course_id, points) VALUES (?, ?, ?, ?, 300)');
        foreach ($awarded as $questionId) {
            $insertEvent->execute([$playerId, $runId, $questionId, $course]);
            if ($insertEvent->rowCount() === 1) {
                $newPoints += 300;
            }
        }
        if ($newPoints > 0) {
            $db->prepare('UPDATE course_scores SET total_score = total_score + ? WHERE course_id = ?')->execute([$newPoints, $course]);
        }
    }

    $statement = $db->prepare('UPDATE players SET course_id = ?, current_chapter = ?, current_run_score = ?, total_score = total_score + ?, progress_percent = ? WHERE id = ?');
    $statement->execute([$course, $chapter, $runScore, $newPoints, $progressPercent, $playerId]);
    $statement = $db->prepare(
        'INSERT INTO player_progress (player_id, state_json, run_id, position_x, position_y, completed_chapters)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE state_json = VALUES(state_json), run_id = VALUES(run_id), position_x = VALUES(position_x), position_y = VALUES(position_y), completed_chapters = VALUES(completed_chapters)'
    );
    $statement->execute([$playerId, $encodedState, $runId, $positionX, $positionY, json_encode($completed)]);
    $db->commit();

    $player = fetchPlayer($db, $playerId);
    jsonResponse(['ok' => true, 'updatedAt' => $state['updatedAt'], 'newPoints' => $newPoints, 'totalScore' => (int)$player['total_score']]);
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) $db->rollBack();
    error_log('Seventh Reaction save error: ' . $error->getMessage());
    jsonResponse(['ok' => false, 'error' => 'Progress could not be synchronized. Local save is safe.'], 503);
}
