# The Seventh Reaction

An EC015 Chemistry pixel RPG set on the registered KMKJ campus map. The player begins as a Ghost at Pondok Security, meets the Lecturer in Makmal Chemistry, chooses an Engineering Hero, and stabilises seven reactions through exploration, fixed questions, and mini-games.

## Live XAMPP URLs

- Player application: `http://localhost/kmkj-chemistry-quest/`
- Separate Admin Website: `http://localhost/kmkj-chemistry-quest/admin/`

The separate Admin Website is available at `http://localhost/kmkj-chemistry-quest/admin/`. It uses one database-enforced singleton account (`admin_kmkj` by default); no administrator registration route exists. New installations must provide the initial administrator password through `SEVENTH_REACTION_ADMIN_PASSWORD`, so no deployable source file contains a production credential. The password is stored only as a bcrypt hash and can be changed after login.

## Architecture

The application intentionally has no build-tool dependency. XAMPP serves the PHP shell, APIs, and JavaScript directly.

- `game.js`: immutable registered KMKJ geometry and map rendering.
- `map-data.js`: traced road and pedestrian-path run data.
- `content.js`: hero mapping, explicit location anchors, seven EC015 chapters, and 21 fixed questions.
- `state.js`: local-first game state, migration-safe defaults, autosave, and remote synchronization.
- `runtime.js`: exterior input, movement, building collision, camera follow, labels, NPCs, and pixel sprites.
- `interiors.js`: reusable walkable pixel interiors, interior collision, mission stations, and building exits.
- `minigames.js`: seven reusable chapter activities, including the Library Treasure Hunt, office Boss/key battle, course workshop, and Escape Runner.
- `app.js`: locked-location progression, physical letters, dialogue, hero selection, quiz rules, AI menu, fast travel, leaderboard, and ending.
- `api/`: player authentication, session restore, autosave, leaderboard, and the server-side Bond Bot AI endpoint.
- `admin/`: completely separate authenticated administration website.
- `database/schema.sql`: MySQL tables, constraints, indexes, permanent score events, and admin audit log.
- `manifest.webmanifest` and `sw.js`: installable/offline-capable application shell for Android and Windows.

Map geometry and game state are separate boundaries. Game systems refer to buildings by stable IDs and never rewrite their footprints.

## Campus scale and character ratio

The verified `1280 × 995` registration frame remains the immutable source of truth. Runtime Build 69 applies exactly one uniform `8×` transform, producing a `10240 × 7960` playable world. Buildings, courts, parking, roads, pedestrian paths and their spacing therefore retain the same coordinates and proportions; there are no per-object scale or placement adjustments.

Build 69 retains the registered exterior map geometry, original chibi pixel heroes, procedural chiptune and seven distinct chapter challenges. It adds a TLS-capable MySQL/TiDB cloud connector so public accounts, saves, leaderboards and the Admin Website can share one persistent database while local XAMPP continues to work unchanged. Player registration and login identify accounts as Matric Card / Student ID, while preserving the existing database username field for backward compatibility; registration also requires a matching Confirm Password value in both the browser and PHP API. Every accessible KMKJ interior remains a `1600 × 900` scrolling room with a following camera, realistic player-to-building scale, room minimap, direction indicator and a visible Mdm. Balqis teacher NPC. The Cafeteria is a dedicated walkable pixel restaurant with a kitchen pass, serving counters, cashier, food trays, dining islands, students, staff and an unobstructed central aisle. It is unlocked from the Ghost prologue onward and now has a dedicated always-visible Kafeteria fast-travel button in Settings, allowing every player to visit the restaurant and inspect its live leaderboards without changing story progress. All other mission buildings remain locked until their preceding chapter objective and destination letter are completed. The interactive board displays the best player from each of the four engineering courses, the permanent cumulative course ranking and the five highest-scoring players. After Chapter 7, a persistent “Congrats! You are a chemistry master!” result screen displays the final score and course ranking. Its FINISH button saves Chemistry Master status, unlocks every KMKJ gameplay location, clears the route marker and returns the player to Pondok Security for unrestricted campus exploration, question practice and mini-game replays. The blue Bond Bot follows the player outdoors and through every interior, remembers the latest wrong answer, and becomes a real general conversational assistant through a secure server-side OpenAI connection. Public Vercel deployments automatically authenticate to AI Gateway with their short-lived project identity and use `openai/gpt-5.4-mini`; local XAMPP can use a private `OPENAI_API_KEY`. Bond Bot receives a short recent conversation for follow-up questions while the fixed quiz answers and marks remain authoritative. Its verified offline fallback covers core EC015 topics, including shell capacity, oxygen configuration, and sodium ion formation. Completed chapters can be revisited inside their original building to replay all fixed questions and the complete mini-game without awarding duplicate leaderboard points or altering saved chapter progress. Chapter 6 remains a forgiving four-lane Piano Tiles challenge with direct tap controls, D/F/J/K keyboard input, a large early/late timing window, a 20-tile target and no shield loss for missed tiles. No registered polygon, road, path, court, or label anchor was changed.

Player and NPC sprites are approximately 20–25 world pixels tall, so they remain human-sized against the enlarged architecture. Map zoom ranges from `0.125×` (the complete campus) to `3×`, and movement speed ranges from `60` to `600`. Version-1 local and MySQL saves migrate positions automatically by the same `8×` factor.

## Database setup

MySQL must be running in XAMPP. Import once:

```bash
/Applications/XAMPP/xamppfiles/bin/mysql -u root < database/schema.sql
SEVENTH_REACTION_ADMIN_PASSWORD='choose-a-private-password' /Applications/XAMPP/xamppfiles/bin/php database/migrate_single_admin.php
```

Database connection defaults match a standard macOS XAMPP installation. Override them with the variables shown in `.env.example` when needed.

Course ranking is append-only. Each newly recorded correct answer creates one immutable 300-point event for the player's current run and course. Deleting a player does not decrement permanent course totals.

## Gameplay rules implemented

- WASD, arrow keys, touch controls, camera follow, adjustable speed and zoom.
- Ghost prologue, one Lecturer, four hero transformations.
- Iron Man → Electrical & Electronic Engineering.
- Thor → Mechanical Engineering.
- Spider-Man → Basic Engineering.
- Captain America → Civil Engineering.
- Seven reusable chapter stages with three fixed questions per chapter.
- Correct answer: 300 points; wrong answer: immediate retry; three failures: chapter restart with encouragement.
- Locked building sequence, walkable interiors, physical destination letters, and unlocked-only fast travel.
- A distinct mini-game in every chapter.
- Chapter 4 Library Treasure Hunt; Chapter 5 snowball Boss/key challenge plus an 80/100 assessment threshold.
- Chapter 6 course-specific workshop for Basic, Civil, Mechanical, or Electrical & Electronic Engineering.
- Chapter 7 begins and ends at Pondok Security with the Escape Runner chase.
- Final Ionic Equilibria question appears at the Escape Runner finish line.
- Preset-only Reaction Assistant for hints, summaries, progress, and weak-topic review.
- Server-side OpenAI-powered Bond Bot for typed EC015 questions and personalised wrong-answer explanations; the API key is never sent to the browser.
- Local autosave plus MySQL account synchronization.
- Permanent course ranking and top-player ranking.

## Verification

The project contains regression scripts under `tmp/`:

```bash
node tmp/render-map.mjs
node tmp/qa-gameplay-anchors.mjs
node tmp/qa-gameplay-reachability.mjs
node tmp/qa-content.mjs
node tmp/qa-world-runtime.mjs
```

Expected map result: 24 building groups, zero building/building overlap, and zero road/path/parking/court intrusion into building interiors. All nine accessible gameplay anchors must be collision-free and connected.

## Bond Bot AI setup

Bond Bot first reads `OPENAI_API_KEY` from the web-server environment. For local XAMPP development, copy `config/openai.local.php.example` to `config/openai.local.php` and insert the API key there. Never commit that local file. `OPENAI_MODEL` is optional; the direct-provider default is `gpt-5.6-sol`. When no direct key exists on Vercel, Bond Bot uses the deployment's automatic `VERCEL_OIDC_TOKEN` with Vercel AI Gateway and the free-tier `openai/gpt-5.4-mini` model. `AI_GATEWAY_API_KEY`, `AI_GATEWAY_MODEL`, and `AI_GATEWAY_BASE_URL` remain optional overrides.

## Vercel deployment

`vercel.json` uses the community `vercel-php` runtime for the PHP APIs and thin Vercel entry bridges in `api/`; static game assets are served directly. Direct web access to configuration, database and private Admin bootstrap source paths is blocked. Configure `SEVENTH_REACTION_DB_HOST`, `SEVENTH_REACTION_DB_PORT`, `SEVENTH_REACTION_DB_NAME`, `SEVENTH_REACTION_DB_USER`, `SEVENTH_REACTION_DB_PASS` and `SEVENTH_REACTION_DB_TLS=true` with a network-accessible MySQL-compatible database in Vercel before enabling registration, login, cloud saves, leaderboards or the Admin Website. TiDB's standard `TIDB_HOST`, `TIDB_PORT`, `TIDB_DATABASE`, `TIDB_USER` and `TIDB_PASSWORD` variables are also accepted. Without those variables, the public game remains playable through **PLAY OFFLINE DEMO**, but database features intentionally report that the server is unavailable. Vercel's automatic OIDC identity enables Bond Bot without a committed API secret; a direct `OPENAI_API_KEY` remains supported as an override.

Without either a direct OpenAI key or a Vercel deployment identity, the game automatically uses its verified EC015 offline explanations and clearly labels that response as a fallback.
