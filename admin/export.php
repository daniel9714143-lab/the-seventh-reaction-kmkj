<?php
declare(strict_types=1);

require_once __DIR__ . '/_admin_bootstrap.php';
$adminId = requireAdmin();
$db = database();
auditAdmin($db, $adminId, 'export_players', null, 'Exported player CSV');

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="seventh-reaction-players-' . gmdate('Y-m-d') . '.csv"');
header('Cache-Control: no-store');

$output = fopen('php://output', 'wb');
fputcsv($output, [
    'Player ID', 'Username', 'Full Name', 'Nickname', 'Class', 'Course', 'Current Chapter',
    'Current Run Score', 'Permanent Total Score', 'Progress %', 'Run ID', 'Position X', 'Position Y',
    'Completed Chapters', 'Account Created', 'Player Updated', 'Last Login', 'Save Updated'
]);
$statement = $db->query(
    'SELECT p.id, p.username, p.full_name, p.nickname, p.class_name, p.course_id,
            p.current_chapter, p.current_run_score, p.total_score, p.progress_percent,
            p.created_at, p.updated_at, p.last_login_at,
            pp.run_id, pp.position_x, pp.position_y, pp.completed_chapters, pp.updated_at AS save_updated_at
     FROM players p LEFT JOIN player_progress pp ON pp.player_id = p.id ORDER BY p.id'
);
while ($row = $statement->fetch()) {
    fputcsv($output, [
        $row['id'], $row['username'], $row['full_name'], $row['nickname'], $row['class_name'], $row['course_id'],
        $row['current_chapter'], $row['current_run_score'], $row['total_score'], $row['progress_percent'],
        $row['run_id'], $row['position_x'], $row['position_y'], $row['completed_chapters'],
        $row['created_at'], $row['updated_at'], $row['last_login_at'], $row['save_updated_at'],
    ]);
}
fclose($output);
