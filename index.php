<?php
declare(strict_types=1);
require_once __DIR__ . '/config/openai.php';
$bondBotConfigured = openAiSettings()['configured'];
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-cache, must-revalidate');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'");
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#06141b">
  <meta name="description" content="The Seventh Reaction — an EC015 Chemistry adventure across the real KMKJ campus.">
  <link rel="manifest" href="manifest.webmanifest?v=69">
  <link rel="icon" href="assets/seventh-reaction-icon.svg" type="image/svg+xml">
  <title>The Seventh Reaction · KMKJ Chemistry RPG</title>
  <link rel="stylesheet" href="styles.css?v=69">
</head>
<body>
  <main id="app-root" class="game-shell" data-build="69" data-ai-configured="<?= $bondBotConfigured ? 'true' : 'false' ?>">
    <header class="topbar pixel-panel">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true">VII</span>
        <div>
          <p class="eyebrow">KMKJ · EC015 CHEMISTRY RPG</p>
          <h1>THE SEVENTH REACTION</h1>
        </div>
      </div>
      <div class="hud-summary" aria-label="Player status">
        <div class="hud-item"><span>IDENTITY</span><strong id="hud-player">GHOST</strong></div>
        <div class="hud-item"><span>CHAPTER</span><strong id="hud-chapter">PROLOGUE</strong></div>
        <div class="hud-item score"><span>SCORE</span><strong id="hud-score">000000</strong></div>
        <button id="ai-toggle" class="ai-orb hidden" type="button" aria-expanded="false" aria-controls="ai-panel" aria-label="Open Bond Bot Chemistry companion" title="Open Bond Bot">
          <span class="bot-avatar" aria-hidden="true"><i>&gt;_</i></span><b>ASK BOT</b>
        </button>
        <button id="settings-toggle" class="icon-button" type="button" aria-expanded="false" aria-controls="settings-panel" title="Settings">⚙</button>
      </div>
    </header>

    <section class="game-layout">
      <aside class="quest-card pixel-panel" aria-label="Current mission">
        <span class="panel-kicker">ACTIVE MISSION</span>
        <strong id="quest-title">THE FIRST FOOTSTEP</strong>
        <p id="quest-text">Enter the campus and find the Chemistry Laboratory.</p>
        <div class="chapter-track" id="chapter-track" aria-label="Chapter progress"></div>
        <div class="save-status"><i id="save-light"></i><span id="save-status">LOCAL SAVE READY</span></div>
      </aside>

      <section class="game-frame" aria-label="Playable KMKJ campus">
        <canvas id="game" width="1280" height="995" tabindex="0" aria-label="Pixel-art KMKJ campus map. Use WASD or arrow keys to move and E to interact."></canvas>
        <div class="scanlines" aria-hidden="true"></div>
        <div id="location-banner" class="location-banner" aria-live="polite">KMKJ MAIN GATE</div>
        <div id="interaction-prompt" class="interaction-prompt hidden"><kbd>E</kbd><span>INTERACT</span></div>

        <section id="dialogue" class="dialogue pixel-panel hidden" role="dialog" aria-live="polite" aria-label="Dialogue">
          <div id="dialogue-portrait" class="portrait" aria-hidden="true">L</div>
          <div class="dialogue-copy">
            <p id="dialogue-speaker" class="speaker">MDM. BALQIS</p>
            <p id="dialogue-text"></p>
          </div>
          <button id="dialogue-next" class="dialogue-next" type="button">NEXT ▸</button>
        </section>

        <div class="mobile-controls" aria-label="Touch controls">
          <button type="button" data-move="arrowup" aria-label="Move up">▲</button>
          <button type="button" data-move="arrowleft" aria-label="Move left">◀</button>
          <button type="button" data-move="arrowdown" aria-label="Move down">▼</button>
          <button type="button" data-move="arrowright" aria-label="Move right">▶</button>
          <button class="mobile-action" type="button" data-action="interact" aria-label="Interact">E</button>
        </div>

      </section>
    </section>

    <footer class="controls pixel-panel">
      <div><kbd>WASD</kbd><span>or</span><kbd>ARROWS</kbd><span>Move</span></div>
      <div><kbd>E</kbd><span>Inspect / interact</span></div>
      <div class="route"><i></i><span id="route-label">DESTINATION: CHEMISTRY LABORATORY</span></div>
    </footer>

    <aside id="settings-panel" class="side-panel pixel-panel hidden" aria-label="Game settings">
      <div class="panel-heading"><div><span class="panel-kicker">GAME OPTIONS</span><strong>SETTINGS</strong></div><button id="settings-close" class="close-button" type="button" aria-label="Close settings">×</button></div>
      <label class="range-control" for="movement-speed"><span>MOVEMENT SPEED</span><output id="movement-speed-value">120</output><input id="movement-speed" type="range" min="60" max="600" step="20" value="120"></label>
      <label class="range-control" for="map-zoom"><span>MAP ZOOM</span><output id="map-zoom-value">1×</output><input id="map-zoom" type="range" min="0.125" max="3" step="0.125" value="1"></label>
      <label class="toggle-row" for="sound-toggle"><span>BACKGROUND MUSIC</span><input id="sound-toggle" type="checkbox"><i></i></label>
      <label class="teleport-control" for="teleport-destination"><span>FAST TRAVEL · UNLOCKED ONLY</span><select id="teleport-destination"></select></label>
      <button id="teleport-cafeteria" class="pixel-button primary settings-teleport" type="button">TELEPORT TO KAFETERIA · ALWAYS OPEN</button>
      <button id="teleport-objective" class="pixel-button primary settings-teleport" type="button">TELEPORT TO SELECTED PLACE</button>
      <button id="return-gate" class="pixel-button secondary" type="button">RETURN TO MAIN GATE</button>
      <button id="open-map-key" class="pixel-button secondary" type="button">SHOW ALL MAP LABELS</button>
      <button id="full-map-view" class="pixel-button secondary" type="button">FULL CAMPUS VIEW</button>
      <button id="logout-player" class="pixel-button logout-button hidden" type="button">LOGOUT</button>
      <p class="panel-note">The registered KMKJ plan is enlarged uniformly to an 8× world. Buildings, courts, roads and pathways keep their original coordinates and ratios.</p>
    </aside>

    <aside id="ai-panel" class="side-panel ai-panel pixel-panel hidden" aria-label="Bond Bot Chemistry Companion">
      <div class="panel-heading"><div><span class="panel-kicker">FOLLOWS YOU EVERYWHERE</span><strong>BOND BOT · GENERAL AI</strong><span class="ai-status <?= $bondBotConfigured ? 'online' : 'offline' ?>"><?= $bondBotConfigured ? 'REAL AI ONLINE' : 'REAL AI SETUP REQUIRED' ?></span></div><button id="ai-close" class="close-button" type="button" aria-label="Close assistant">×</button></div>
      <div id="ai-chat" class="assistant-chat" role="log" aria-live="polite" aria-label="Conversation with Bond Bot">
        <div class="assistant-message bot-message"><span class="mini-robot" aria-hidden="true"><i>&gt;_</i></span><p>Ask me anything. I can help with EC015 Chemistry, mathematics, science, writing, coding, general knowledge, or your current KMKJ mission when the real AI connection is online.</p></div>
      </div>
      <div class="assistant-options">
        <button type="button" data-ai-action="explain">EXPLAIN MY LAST ANSWER</button>
        <button type="button" data-ai-action="hint">CURRENT HINT</button>
        <button type="button" data-ai-action="summary">CHAPTER SUMMARY</button>
        <button type="button" data-ai-action="progress">MY PROGRESS</button>
        <button type="button" data-ai-action="weak">WEAK TOPICS</button>
      </div>
      <form id="ai-form" class="assistant-form">
        <label for="ai-question">ASK BOND BOT ANYTHING</label>
        <textarea id="ai-question" rows="3" maxlength="300" placeholder="Ask a question or continue the conversation…" autocomplete="off"></textarea>
        <button class="pixel-button primary" type="submit">ASK COMPANION</button>
      </form>
      <p class="assistant-note">General AI answers use a secure server-side connection. The official EC015 question bank, accepted answers and marks always remain unchanged.</p>
    </aside>

    <section id="splash-screen" class="screen-overlay splash-screen" role="dialog" aria-modal="true" aria-labelledby="splash-title">
      <div class="splash-art" aria-hidden="true"><span class="reaction-ring ring-one"></span><span class="reaction-ring ring-two"></span><span class="ghost-sprite"><i></i><b></b></span><span class="reaction-seven">7</span></div>
      <div class="splash-content pixel-panel">
        <p class="eyebrow">AN EC015 CHEMISTRY ADVENTURE</p>
        <h2 id="splash-title">THE SEVENTH<br>REACTION</h2>
        <p class="splash-lead">Enter the real KMKJ campus as a Ghost. Discover your engineering identity and restore seven unstable reactions through exploration.</p>
        <div class="splash-actions">
          <button id="new-player" class="pixel-button primary" type="button">NEW JOURNEY</button>
          <button id="login-player" class="pixel-button" type="button">LOGIN / CONTINUE</button>
          <button id="local-continue" class="pixel-button secondary hidden" type="button">CONTINUE LOCAL SAVE</button>
          <button id="demo-player" class="text-button" type="button">PLAY OFFLINE DEMO</button>
        </div>
        <small>BUILD 68 · CLOUD ACCOUNTS READY</small>
      </div>
    </section>

    <section id="auth-screen" class="screen-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <form id="auth-form" class="modal-card pixel-panel" novalidate>
        <button id="auth-back" class="close-button modal-close" type="button" aria-label="Back">×</button>
        <span class="panel-kicker">PLAYER ACCESS</span>
        <h2 id="auth-title">CREATE PLAYER</h2>
        <p id="auth-subtitle">Your engineering identity will be chosen inside the Chemistry Laboratory.</p>
        <input id="auth-mode" type="hidden" value="register">
        <div id="register-fields">
          <label>FULL NAME<input name="fullName" autocomplete="name" maxlength="120" required></label>
          <label>NICKNAME<input name="nickname" autocomplete="nickname" maxlength="32" required></label>
          <label>CLASS<input name="className" maxlength="40" placeholder="Example: 1K1S1" required></label>
        </div>
        <label>MATRIC CARD / STUDENT ID<input name="login" autocomplete="username" maxlength="120" placeholder="Example: JM123456" required></label>
        <label>PASSWORD<input id="player-password" name="password" type="password" autocomplete="new-password" minlength="8" required></label>
        <label id="confirm-password-field">CONFIRM PASSWORD<input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label>
        <p id="auth-error" class="form-error" aria-live="polite"></p>
        <button id="auth-submit" class="pixel-button primary" type="submit">REGISTER & ENTER</button>
        <button id="auth-switch" class="text-button" type="button">I ALREADY HAVE A PLAYER ACCOUNT</button>
      </form>
    </section>

    <section id="course-screen" class="screen-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="course-title">
      <div class="wide-modal pixel-panel">
        <span class="panel-kicker">CHOOSE YOUR ENGINEERING IDENTITY</span>
        <h2 id="course-title">FOUR HEROES. ONE CHEMISTRY JOURNEY.</h2>
        <p>Course choice changes your hero and permanent course ranking. All heroes complete the same EC015 chapters.</p>
        <div id="course-grid" class="course-grid"></div>
      </div>
    </section>

    <section id="interior-screen" class="screen-overlay interior-screen hidden" aria-labelledby="interior-title">
      <div class="interior-shell pixel-panel">
        <header class="interior-header">
          <div><span class="panel-kicker">INSIDE KMKJ</span><h2 id="interior-title">CHEMISTRY LABORATORY</h2></div>
          <button id="interior-exit" class="pixel-button secondary" type="button">EXIT TO CAMPUS</button>
        </header>
        <div class="interior-stage">
          <canvas id="interior-canvas" width="800" height="450" tabindex="0" aria-label="Large scrolling KMKJ building interior. Follow the room minimap to Mdm. Balqis, use WASD or arrow keys to walk, and press E to interact."></canvas>
          <div id="interior-prompt" class="interior-prompt hidden"><kbd>E</kbd><span id="interior-prompt-text">START MISSION</span></div>
          <div class="interior-touch" aria-label="Interior touch controls">
            <button type="button" data-interior-move="up" aria-label="Walk up">▲</button>
            <button type="button" data-interior-move="left" aria-label="Walk left">◀</button>
            <button type="button" data-interior-move="down" aria-label="Walk down">▼</button>
            <button type="button" data-interior-move="right" aria-label="Walk right">▶</button>
            <button type="button" data-interior-action="interact" aria-label="Interact">E</button>
          </div>
        </div>
        <footer class="interior-footer">
          <p id="interior-objective">Walk to the glowing mission station and press E.</p>
          <div><kbd>WASD</kbd><span>WALK</span><kbd>E</kbd><span>INTERACT</span></div>
        </footer>
      </div>
    </section>

    <section id="cafeteria-leaderboard" class="screen-overlay cafeteria-board-screen hidden" role="dialog" aria-modal="true" aria-labelledby="cafeteria-board-title">
      <article class="restaurant-leaderboard pixel-panel">
        <header class="cafeteria-board-header">
          <div>
            <span class="panel-kicker">KAFETERIA KMKJ · PERMANENT SCOREBOARD</span>
            <h2 id="cafeteria-board-title">CAMPUS CHAMPIONS</h2>
            <p>Every correct EC015 answer permanently contributes 300 points to the player's engineering course.</p>
          </div>
          <button id="cafeteria-board-close" class="close-button" type="button" aria-label="Close cafeteria leaderboard">×</button>
        </header>
        <div id="cafeteria-board-status" class="board-live-status" role="status" aria-live="polite"><i></i>LIVE FROM THE KMKJ DATABASE</div>
        <div class="cafeteria-board-grid">
          <section class="scoreboard-panel champions-panel" aria-labelledby="course-champions-title">
            <div class="scoreboard-title"><span aria-hidden="true">★</span><h3 id="course-champions-title">BEST PLAYER FROM EACH COURSE</h3></div>
            <div id="course-leader-list" class="scoreboard-list course-leaders"></div>
          </section>
          <section class="scoreboard-panel ranking-panel" aria-labelledby="course-ranking-title">
            <div class="scoreboard-title"><span aria-hidden="true">◆</span><h3 id="course-ranking-title">RANKING OF COURSES</h3></div>
            <div id="course-ranking-list" class="scoreboard-list course-ranking"></div>
          </section>
        </div>
        <section class="scoreboard-panel overall-panel" aria-labelledby="overall-players-title">
          <div class="scoreboard-title"><span aria-hidden="true">▲</span><h3 id="overall-players-title">TOP PLAYERS · ALL COURSES</h3></div>
          <div id="overall-player-list" class="scoreboard-list overall-players"></div>
        </section>
        <footer class="cafeteria-board-actions">
          <button id="cafeteria-board-refresh" class="pixel-button secondary" type="button">REFRESH LIVE SCORES</button>
          <button id="cafeteria-board-return" class="pixel-button primary" type="button">RETURN TO RESTAURANT</button>
        </footer>
      </article>
    </section>

    <section id="letter-screen" class="screen-overlay letter-screen hidden" role="dialog" aria-modal="true" aria-labelledby="letter-title">
      <div class="letter-envelope" aria-hidden="true"><i></i><b>VII</b></div>
      <article class="mission-letter pixel-panel">
        <span class="panel-kicker">A LETTER HAS APPEARED</span>
        <h2 id="letter-title">NEXT DESTINATION</h2>
        <strong id="letter-destination">DEWAN TEKNOKRAT</strong>
        <p id="letter-message">Travel across the real KMKJ campus. The next building is now unlocked.</p>
        <div class="letter-seal" aria-hidden="true">7</div>
        <button id="letter-continue" class="pixel-button primary" type="button">KEEP LETTER & TRAVEL</button>
      </article>
    </section>

    <section id="quiz-screen" class="screen-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="quiz-topic">
      <div class="quiz-card pixel-panel">
        <div class="quiz-topline"><div><span id="quiz-chapter" class="panel-kicker">CHAPTER 1</span><h2 id="quiz-topic">MATTER</h2></div><div class="attempt-lights" id="attempt-lights" aria-label="Attempts remaining"></div></div>
        <div class="quiz-progress"><i id="quiz-progress-bar"></i></div>
        <p id="quiz-prompt" class="quiz-prompt"></p>
        <div id="quiz-answer-area" class="answer-area"></div>
        <div id="quiz-feedback" class="quiz-feedback hidden" aria-live="polite"></div>
        <div class="quiz-actions"><button id="quiz-submit" class="pixel-button primary" type="button">LOCK ANSWER</button><button id="quiz-continue" class="pixel-button primary hidden" type="button">CONTINUE</button><button id="quiz-ai" class="quiz-ai-button" type="button">ASK BOND BOT</button></div>
      </div>
    </section>

    <section id="mini-game-screen" class="screen-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="mini-game-title">
      <div class="mini-game-card pixel-panel">
        <div class="mini-game-header">
          <div><span id="mini-game-kicker" class="panel-kicker">SPECIAL ACTIVITY</span><h2 id="mini-game-title">TREASURE HUNT</h2></div>
          <div class="mini-stats"><span>TIME <b id="mini-time">60</b></span><span>PROGRESS <b id="mini-progress">0/5</b></span></div>
        </div>
        <p id="mini-game-instructions">Find the hidden chemistry keys.</p>
        <div class="mini-canvas-wrap"><canvas id="mini-game-canvas" width="640" height="360" aria-label="Pixel mini-game. Use the arrow keys and Space or the on-screen controls."></canvas><div id="mini-countdown" class="mini-countdown">READY</div></div>
        <div class="mini-controls"><button id="mini-left" type="button" aria-label="Move left">◀</button><button id="mini-start" class="pixel-button primary" type="button">START ACTIVITY</button><button id="mini-right" type="button" aria-label="Move right">▶</button></div>
        <div id="rhythm-controls" class="rhythm-controls hidden" aria-label="Piano tile controls">
          <button id="rhythm-lane-0" type="button" aria-label="Tap piano tile lane 1"><kbd>D</kbd><span>LANE 1</span></button>
          <button id="rhythm-lane-1" type="button" aria-label="Tap piano tile lane 2"><kbd>F</kbd><span>LANE 2</span></button>
          <button id="rhythm-lane-2" type="button" aria-label="Tap piano tile lane 3"><kbd>J</kbd><span>LANE 3</span></button>
          <button id="rhythm-lane-3" type="button" aria-label="Tap piano tile lane 4"><kbd>K</kbd><span>LANE 4</span></button>
        </div>
      </div>
    </section>

    <section id="ending-screen" class="screen-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="ending-title">
      <div class="modal-card ending-card pixel-panel">
        <div class="master-badge" aria-hidden="true">⚗</div>
        <span class="panel-kicker">ALL SEVEN REACTIONS STABILISED</span>
        <h2 id="ending-title">Congrats! You are a chemistry master!</h2>
        <p id="ending-copy"></p>
        <div class="final-score"><span>FINAL SCORE</span><strong id="ending-score">0</strong></div>
        <div id="ending-rankings" class="rankings"></div>
        <div class="ending-actions">
          <button id="finish-game" class="pixel-button primary" type="button">FINISH · EXPLORE KMKJ</button>
          <button id="replay-game" class="pixel-button secondary" type="button">REPLAY JOURNEY</button>
        </div>
      </div>
    </section>

    <div id="toast" class="toast pixel-panel hidden" role="status" aria-live="polite"></div>
  </main>

  <script src="map-data.js?v=69"></script>
  <script src="content.js?v=69"></script>
  <script src="state.js?v=69"></script>
  <script src="sprites.js?v=69"></script>
  <script src="game.js?v=69"></script>
  <script src="runtime.js?v=69"></script>
  <script src="interiors.js?v=69"></script>
  <script src="minigames.js?v=69"></script>
  <script src="audio.js?v=69"></script>
  <script src="assistant.js?v=69"></script>
  <script src="app.js?v=69"></script>
</body>
</html>
