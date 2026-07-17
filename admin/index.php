<?php
declare(strict_types=1);

require_once __DIR__ . '/_admin_bootstrap.php';

$db = database();
$error = '';
$notice = (string)($_SESSION['admin_notice'] ?? '');
unset($_SESSION['admin_notice']);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['login'])) {
    verifyAdminCsrf();
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $statement = $db->prepare('SELECT * FROM admins WHERE singleton_key = 1 AND username = ? AND is_active = 1 LIMIT 1');
    $statement->execute([$username]);
    $admin = $statement->fetch();
    $validPassword = password_verify($password, (string)($admin['password_hash'] ?? '$2y$10$invalidhashinvalidhashinvalidhashinvalidhashinvalidhash12'));
    if ($admin && $validPassword) {
        session_regenerate_id(true);
        $_SESSION['admin_id'] = (int)$admin['id'];
        $_SESSION['admin_name'] = $admin['display_name'];
        $_SESSION['admin_username'] = $admin['username'];
        $_SESSION['admin_last_activity'] = time();
        $_SESSION['admin_csrf'] = bin2hex(random_bytes(24));
        $db->prepare('UPDATE admins SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([(int)$admin['id']]);
        auditAdmin($db, (int)$admin['id'], 'login', null, 'Singleton administrator login');
        header('Location: index.php');
        exit;
    }
    usleep(300000);
    $error = 'Invalid administrator credentials.';
}

$admin = currentAdmin($db);
if ($admin && $_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_POST['login'])) {
    verifyAdminCsrf();
    $action = (string)($_POST['action'] ?? '');
    if ($action === 'logout') {
        auditAdmin($db, (int)$admin['id'], 'logout', null, 'Administrator logout');
        $_SESSION = [];
        session_destroy();
        header('Location: index.php');
        exit;
    }
    if ($action === 'delete_player') {
        $playerId = (int)($_POST['player_id'] ?? 0);
        $statement = $db->prepare('SELECT nickname FROM players WHERE id = ?');
        $statement->execute([$playerId]);
        $player = $statement->fetch();
        if ($player) {
            $db->beginTransaction();
            try {
                auditAdmin($db, (int)$admin['id'], 'delete_player', $playerId, 'Deleted player: ' . $player['nickname']);
                $db->prepare('DELETE FROM players WHERE id = ?')->execute([$playerId]);
                $db->commit();
                $_SESSION['admin_notice'] = 'Player deleted. Permanent course totals were preserved.';
            } catch (Throwable $exception) {
                $db->rollBack();
                throw $exception;
            }
        }
        header('Location: index.php');
        exit;
    }
    if ($action === 'change_password') {
        $current = (string)($_POST['current_password'] ?? '');
        $next = (string)($_POST['new_password'] ?? '');
        $statement = $db->prepare('SELECT password_hash FROM admins WHERE id = ? AND singleton_key = 1');
        $statement->execute([(int)$admin['id']]);
        $passwordRow = $statement->fetch();
        if (!$passwordRow || !password_verify($current, $passwordRow['password_hash'])) {
            $error = 'Current password is incorrect.';
        } elseif (strlen($next) < 10) {
            $error = 'New administrator password must contain at least 10 characters.';
        } else {
            $db->prepare('UPDATE admins SET password_hash = ? WHERE id = ? AND singleton_key = 1')->execute([password_hash($next, PASSWORD_DEFAULT), (int)$admin['id']]);
            auditAdmin($db, (int)$admin['id'], 'change_password', null, 'Singleton administrator changed password');
            $notice = 'Administrator password changed.';
        }
    }
}

$loggedIn = $admin !== null;
$stats = [];
$courseScores = [];
$players = [];
$topPlayers = [];
$scoreEvents = [];
$auditEvents = [];
$query = trim((string)($_GET['q'] ?? ''));

if ($loggedIn) {
    $stats = $db->query(
        'SELECT COUNT(*) AS player_count,
                COALESCE(AVG(progress_percent), 0) AS average_progress,
                SUM(CASE WHEN progress_percent = 100 THEN 1 ELSE 0 END) AS completed_players,
                SUM(CASE WHEN last_login_at >= CURRENT_TIMESTAMP - INTERVAL 7 DAY THEN 1 ELSE 0 END) AS active_players,
                SUM(CASE WHEN EXISTS (SELECT 1 FROM player_progress pp WHERE pp.player_id = players.id) THEN 1 ELSE 0 END) AS saved_players
         FROM players'
    )->fetch();
    $courseScores = $db->query('SELECT course_id, total_score FROM course_scores ORDER BY total_score DESC, course_id')->fetchAll();
    $stats['permanent_points'] = array_sum(array_map(static fn(array $row): int => (int)$row['total_score'], $courseScores));

    $sql = 'SELECT p.id, p.username, p.full_name, p.nickname, p.class_name, p.course_id,
                   p.current_chapter, p.current_run_score, p.total_score, p.progress_percent,
                   p.created_at, p.updated_at, p.last_login_at,
                   pp.run_id, pp.position_x, pp.position_y, pp.completed_chapters,
                   pp.state_json, pp.updated_at AS save_updated_at,
                   (SELECT COUNT(*) FROM score_events se WHERE se.player_id = p.id) AS scored_answers,
                   (SELECT COUNT(*) FROM chapter_attempts ca WHERE ca.player_id = p.id) AS challenge_attempts
            FROM players p
            LEFT JOIN player_progress pp ON pp.player_id = p.id';
    $parameters = [];
    if ($query !== '') {
        $sql .= ' WHERE p.username LIKE ? OR p.full_name LIKE ? OR p.nickname LIKE ? OR p.class_name LIKE ? OR p.course_id LIKE ?';
        $term = '%' . $query . '%';
        $parameters = [$term, $term, $term, $term, $term];
    }
    $sql .= ' ORDER BY p.updated_at DESC LIMIT 200';
    $statement = $db->prepare($sql);
    $statement->execute($parameters);
    $players = $statement->fetchAll();

    foreach ($players as &$player) {
        $state = json_decode((string)($player['state_json'] ?? ''), true);
        $state = is_array($state) ? $state : [];
        $completed = json_decode((string)($player['completed_chapters'] ?? ''), true);
        $completed = is_array($completed) ? $completed : ($state['completedChapters'] ?? []);
        $player['_state'] = $state;
        $player['_completed'] = array_values(array_filter(array_map('intval', is_array($completed) ? $completed : []), static fn(int $chapter): bool => $chapter >= 1 && $chapter <= 7));
        $weakTopics = is_array($state['weakTopics'] ?? null) ? $state['weakTopics'] : [];
        $player['_weak_topics'] = $weakTopics;
        $player['_awarded_count'] = count(is_array($state['awardedQuestions'] ?? null) ? $state['awardedQuestions'] : []);
    }
    unset($player);

    $topPlayers = $db->query('SELECT nickname, class_name, course_id, total_score FROM players ORDER BY total_score DESC, updated_at ASC LIMIT 8')->fetchAll();
    $scoreEvents = $db->query(
        'SELECT se.question_id, se.course_id, se.points, se.created_at, COALESCE(p.nickname, "Deleted player") AS nickname
         FROM score_events se LEFT JOIN players p ON p.id = se.player_id
         ORDER BY se.created_at DESC LIMIT 10'
    )->fetchAll();
    $auditEvents = $db->query('SELECT action, target_player_id, details, created_at FROM admin_audit_logs ORDER BY created_at DESC LIMIT 10')->fetchAll();
}

$courseNames = [
    'basic' => 'Basic Engineering · Spider-Man',
    'civil' => 'Civil Engineering · Captain America',
    'mechanical' => 'Mechanical Engineering · Thor',
    'electrical' => 'Electrical & Electronic Engineering · Iron Man',
];

function displayList(array $items, string $empty = 'None recorded'): string
{
    return $items ? implode(', ', array_map(static fn($item): string => (string)$item, $items)) : $empty;
}
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>The Seventh Reaction · Admin</title>
  <link rel="stylesheet" href="admin.css?v=54">
</head>
<body class="<?= $loggedIn ? 'dashboard-body' : 'login-body' ?>">
<?php if (!$loggedIn): ?>
  <main class="login-shell">
    <section class="login-card">
      <span class="admin-mark">VII</span>
      <p>SINGLE SECURE ADMINISTRATOR</p>
      <h1>The Seventh Reaction</h1>
      <h2>KMKJ Admin Login</h2>
      <?php if ($error): ?><div class="alert error"><?= e($error) ?></div><?php endif; ?>
      <form method="post" autocomplete="on">
        <input type="hidden" name="login" value="1">
        <input type="hidden" name="csrf" value="<?= e(adminCsrf()) ?>">
        <label>USERNAME<input name="username" autocomplete="username" required autofocus></label>
        <label>PASSWORD<input type="password" name="password" autocomplete="current-password" required></label>
        <button type="submit">SECURE LOGIN</button>
      </form>
      <div class="security-note"><strong>ONE ADMIN ONLY</strong><span>No administrator registration or second account is available.</span></div>
      <a href="../">← Return to Player Application</a>
    </section>
  </main>
<?php else: ?>
  <header class="admin-header">
    <div><p>KMKJ · EC015 · SINGLETON ADMIN</p><h1>ADMIN CONTROL CENTRE</h1></div>
    <div class="admin-actions"><span><?= e($admin['display_name']) ?> · <?= e($admin['username']) ?></span><a href="../">PLAYER APP</a><form method="post"><input type="hidden" name="csrf" value="<?= e(adminCsrf()) ?>"><input type="hidden" name="action" value="logout"><button type="submit">LOGOUT</button></form></div>
  </header>
  <main class="dashboard">
    <?php if ($notice): ?><div class="alert success"><?= e($notice) ?></div><?php endif; ?>
    <?php if ($error): ?><div class="alert error"><?= e($error) ?></div><?php endif; ?>

    <section class="stats-grid" aria-label="Dashboard statistics">
      <article><span>REGISTERED PLAYERS</span><strong><?= number_format((int)$stats['player_count']) ?></strong></article>
      <article><span>PERMANENT POINTS</span><strong><?= number_format((int)$stats['permanent_points']) ?></strong></article>
      <article><span>AVERAGE PROGRESS</span><strong><?= number_format((float)$stats['average_progress'], 1) ?>%</strong></article>
      <article><span>COMPLETED GAME</span><strong><?= number_format((int)$stats['completed_players']) ?></strong></article>
      <article><span>ACTIVE · 7 DAYS</span><strong><?= number_format((int)$stats['active_players']) ?></strong></article>
      <article><span>SAVED JOURNEYS</span><strong><?= number_format((int)$stats['saved_players']) ?></strong></article>
    </section>

    <section class="dashboard-grid">
      <article class="panel players-panel">
        <div class="panel-title"><div><span>COMPLETE PLAYER DATA</span><h2>Registered Players</h2></div><a class="export-button" href="export.php">EXPORT CSV</a></div>
        <form class="search" method="get"><input name="q" value="<?= e($query) ?>" placeholder="Search username, name, nickname, class, or course"><button type="submit">SEARCH</button><?php if ($query !== ''): ?><a href="index.php">CLEAR</a><?php endif; ?></form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID / Account</th><th>Player</th><th>Class</th><th>Course</th><th>Chapter</th><th>Run Score</th><th>Total Score</th><th>Progress</th><th>Last Login</th><th>Action</th></tr></thead>
            <tbody>
            <?php if (!$players): ?><tr><td colspan="10" class="empty">No matching registered players. Player records appear here after database registration.</td></tr><?php endif; ?>
            <?php foreach ($players as $player): $state = $player['_state']; ?>
              <tr>
                <td><strong>#<?= (int)$player['id'] ?></strong><small>@<?= e($player['username']) ?></small></td>
                <td><strong><?= e($player['nickname']) ?></strong><small><?= e($player['full_name']) ?></small></td>
                <td><?= e($player['class_name']) ?></td>
                <td><?= e($courseNames[$player['course_id']] ?? 'Not selected') ?></td>
                <td><?= (int)$player['current_chapter'] ?> / 7</td>
                <td><?= number_format((int)$player['current_run_score']) ?></td>
                <td><?= number_format((int)$player['total_score']) ?></td>
                <td><progress max="100" value="<?= e((string)$player['progress_percent']) ?>"></progress><small><?= number_format((float)$player['progress_percent'], 0) ?>%</small></td>
                <td><time><?= e($player['last_login_at'] ?: 'Never') ?></time></td>
                <td><form method="post" class="delete-form" data-player="<?= e($player['nickname']) ?>"><input type="hidden" name="csrf" value="<?= e(adminCsrf()) ?>"><input type="hidden" name="action" value="delete_player"><input type="hidden" name="player_id" value="<?= (int)$player['id'] ?>"><button class="delete" type="submit">DELETE</button></form></td>
              </tr>
              <tr class="player-detail-row"><td colspan="10">
                <details>
                  <summary>VIEW COMPLETE SAVE DATA</summary>
                  <div class="player-data-grid">
                    <section><span>ACCOUNT</span><dl><dt>Created</dt><dd><?= e($player['created_at']) ?></dd><dt>Player updated</dt><dd><?= e($player['updated_at']) ?></dd><dt>Save updated</dt><dd><?= e($player['save_updated_at'] ?: 'No database save') ?></dd></dl></section>
                    <section><span>GAME STATE</span><dl><dt>Run ID</dt><dd><?= e($player['run_id'] ?: 'Not started') ?></dd><dt>Phase</dt><dd><?= e((string)($state['phase'] ?? 'Not saved')) ?></dd><dt>Inside location</dt><dd><?= e((string)($state['interiorLocationId'] ?? 'Campus exterior')) ?></dd></dl></section>
                    <section><span>LOCATION</span><dl><dt>Position X</dt><dd><?= e((string)($player['position_x'] ?? '—')) ?></dd><dt>Position Y</dt><dd><?= e((string)($player['position_y'] ?? '—')) ?></dd><dt>Facing</dt><dd><?= e((string)($state['position']['facing'] ?? '—')) ?></dd></dl></section>
                    <section><span>LEARNING</span><dl><dt>Completed chapters</dt><dd><?= e(displayList($player['_completed'])) ?></dd><dt>Awarded questions</dt><dd><?= (int)$player['_awarded_count'] ?></dd><dt>Score events</dt><dd><?= (int)$player['scored_answers'] ?></dd><dt>Challenge attempts</dt><dd><?= (int)$player['challenge_attempts'] ?></dd></dl></section>
                    <section><span>WEAK TOPICS</span><dl><?php if (!$player['_weak_topics']): ?><dt>Status</dt><dd>None detected</dd><?php else: ?><?php foreach ($player['_weak_topics'] as $topic => $misses): ?><dt><?= e((string)$topic) ?></dt><dd><?= (int)$misses ?> miss<?= (int)$misses === 1 ? '' : 'es' ?></dd><?php endforeach; ?><?php endif; ?></dl></section>
                    <section><span>SETTINGS</span><dl><dt>Movement speed</dt><dd><?= e((string)($state['settings']['movementSpeed'] ?? 'Default')) ?></dd><dt>Map zoom</dt><dd><?= e((string)($state['settings']['mapZoom'] ?? 'Default')) ?></dd><dt>Music</dt><dd><?= !empty($state['settings']['music']) ? 'On' : 'Off' ?></dd></dl></section>
                  </div>
                </details>
              </td></tr>
            <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </article>

      <aside class="side-stack">
        <article class="panel">
          <div class="panel-title"><div><span>NEVER RESETS</span><h2>Course Ranking</h2></div></div>
          <ol class="ranking-list"><?php foreach ($courseScores as $row): ?><li><span><?= e($courseNames[$row['course_id']] ?? $row['course_id']) ?></span><strong><?= number_format((int)$row['total_score']) ?></strong></li><?php endforeach; ?></ol>
          <p class="note">Course totals are permanent. Deleting a player does not reduce a course score.</p>
        </article>

        <article class="panel">
          <div class="panel-title"><div><span>INDIVIDUAL</span><h2>Top Players</h2></div></div>
          <ol class="ranking-list"><?php if (!$topPlayers): ?><li><span>No registered scores yet</span><strong>0</strong></li><?php endif; ?><?php foreach ($topPlayers as $row): ?><li><span><?= e($row['nickname']) ?><small><?= e($row['class_name']) ?></small></span><strong><?= number_format((int)$row['total_score']) ?></strong></li><?php endforeach; ?></ol>
        </article>

        <article class="panel">
          <div class="panel-title"><div><span>QUESTION AWARDS</span><h2>Recent Score Data</h2></div></div>
          <ul class="audit-list"><?php if (!$scoreEvents): ?><li><span>No database score events yet.</span></li><?php endif; ?><?php foreach ($scoreEvents as $event): ?><li><strong><?= e($event['nickname']) ?> · +<?= (int)$event['points'] ?></strong><span><?= e($event['question_id']) ?> · <?= e($event['course_id']) ?></span><time><?= e($event['created_at']) ?></time></li><?php endforeach; ?></ul>
        </article>

        <article class="panel">
          <div class="panel-title"><div><span>SINGLE ACCOUNT SECURITY</span><h2>Change Password</h2></div></div>
          <p class="note">Only <strong><?= e($admin['username']) ?></strong> can access this website. The database prevents a second administrator row.</p>
          <form class="password-form" method="post"><input type="hidden" name="csrf" value="<?= e(adminCsrf()) ?>"><input type="hidden" name="action" value="change_password"><label>CURRENT<input type="password" name="current_password" autocomplete="current-password" required></label><label>NEW (10+ CHARACTERS)<input type="password" name="new_password" autocomplete="new-password" minlength="10" required></label><button type="submit">UPDATE PASSWORD</button></form>
        </article>

        <article class="panel">
          <div class="panel-title"><div><span>RECENT SECURITY</span><h2>Admin Audit Log</h2></div></div>
          <ul class="audit-list"><?php foreach ($auditEvents as $event): ?><li><strong><?= e($event['action']) ?></strong><span><?= e($event['details']) ?></span><time><?= e($event['created_at']) ?></time></li><?php endforeach; ?></ul>
        </article>
      </aside>
    </section>
  </main>
  <script>
    document.querySelectorAll('.delete-form').forEach(form => form.addEventListener('submit', event => {
      if (!confirm(`Delete player ${form.dataset.player}? Permanent course totals will be preserved.`)) event.preventDefault();
    }));
  </script>
<?php endif; ?>
</body>
</html>
