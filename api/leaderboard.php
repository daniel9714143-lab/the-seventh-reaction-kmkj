<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
requireMethod('GET');

$courseNames = [
    'basic' => 'Basic Engineering',
    'civil' => 'Civil Engineering',
    'mechanical' => 'Mechanical Engineering',
    'electrical' => 'Electrical & Electronic Engineering',
];

try {
    $db = database();
    $courseTotals = array_fill_keys(array_keys($courseNames), 0);
    foreach ($db->query('SELECT course_id, total_score FROM course_scores')->fetchAll() as $row) {
        if (array_key_exists($row['course_id'], $courseTotals)) {
            $courseTotals[$row['course_id']] = (int)$row['total_score'];
        }
    }
    $courseRanking = [];
    foreach ($courseNames as $courseId => $courseName) {
        $courseRanking[] = [
            'courseId' => $courseId,
            'courseName' => $courseName,
            'score' => $courseTotals[$courseId],
        ];
    }
    usort($courseRanking, static fn(array $left, array $right): int =>
        ($right['score'] <=> $left['score']) ?: ($left['courseName'] <=> $right['courseName'])
    );

    $courseLeaders = [];
    $leaderStatement = $db->prepare(
        'SELECT nickname, class_name, course_id, total_score
         FROM players
         WHERE course_id = ?
         ORDER BY total_score DESC, updated_at ASC, id ASC
         LIMIT 1'
    );
    foreach ($courseNames as $courseId => $courseName) {
        $leaderStatement->execute([$courseId]);
        $row = $leaderStatement->fetch();
        $courseLeaders[] = [
            'courseId' => $courseId,
            'courseName' => $courseName,
            'nickname' => $row ? $row['nickname'] : null,
            'className' => $row ? $row['class_name'] : null,
            'score' => $row ? (int)$row['total_score'] : 0,
        ];
    }

    $playerRows = $db->query('SELECT nickname, class_name, course_id, total_score FROM players ORDER BY total_score DESC, updated_at ASC LIMIT 20')->fetchAll();
    $topPlayers = array_map(fn(array $row): array => [
        'nickname' => $row['nickname'],
        'className' => $row['class_name'],
        'courseId' => $row['course_id'],
        'courseName' => $courseNames[$row['course_id']] ?? 'Unselected',
        'score' => (int)$row['total_score'],
    ], $playerRows);

    jsonResponse([
        'ok' => true,
        'courseRanking' => $courseRanking,
        'courseLeaders' => $courseLeaders,
        'topPlayers' => $topPlayers,
    ]);
} catch (Throwable $error) {
    error_log('Seventh Reaction leaderboard error: ' . $error->getMessage());
    jsonResponse(['ok' => false, 'error' => 'Leaderboard unavailable.'], 503);
}
