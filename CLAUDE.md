# CLAUDE.md

Guidance for working on **Conquista: The New World (1492–1600)**, a browser strategy game about the Spanish voyages to and conquest of the Americas.

## Running

- Plain HTML/CSS/JavaScript. There is no build step for development, no bundler, no npm dependencies and no framework.
- Open `index.html` in a browser, or serve the folder: `npx http-server -p 8123 -c-1 .` and visit `http://localhost:8123`.
- Scripts are classic `<script>` tags (not ES modules) loaded in a fixed order in `index.html`: `data.js` → `world.js` → `game.js` → `battle.js` → `raids.js` → `audio.js` → `ui.js` → `main.js`. Each file defines globals (`World`, `Game`, `Battle`, `Raids`, `Sound`, `UI`, `Render`, `Input`, `Main`) used by later files. Keep that order when adding files.

## Testing

- Run `node tests/smoke.js` after every change. It boots the game headlessly with Playwright (Chromium is at `/opt/pw-browsers`), sails the ship, lands a party, fights one battle, saves and reloads, and fails on any `pageerror`. When you add a major system, extend the smoke test to touch it.
- `window.__ready` becomes true once the map is generated. Game objects can be called from `page.evaluate` (for example `Game.s`, `Input.order(x, y)`, `Battle.start({...})`).
- **Debug mode**: load the game with URL flags to make runs repeatable:
  - `?seed=N` fixes the random number generator, so the same seed gives the same map and rolls.
  - `?noevents=1` turns off random sea and land events (storms and hurricanes, corsairs, ambushes, jungle fever).
  Always use both in automated tests. All randomness must go through the seeded RNG, never `Math.random()` directly.
- Without debug flags, random events like storms can interrupt scripted runs, so don't treat one timeout as a bug.

## Architecture

| File | Responsibility |
|---|---|
| `js/data.js` | All static content: map bounds (`GEO`), land polygons, islands, rivers, mountains, biomes, `CULTURES`, `SETTLEMENTS`, `RUIN_SITES`, `ARTIFACTS`, `DISCOVERIES`, `SHIPS`, `PRICES`, `TITLES`, `MONARCHS`, `CHRONICLE`, `DISEASES`. |
| `js/world.js` | Tile map generated from `data.js` (`World.generate()`), terrain types `TT`, terrain info `TERRAIN`, foraging yields `FORAGE`, connected components, A* pathfinding (`World.findPath`), and the pre-rendered terrain canvas (`World.render()`). |
| `js/game.js` | Game state `Game.s` and rules: new game setup, time and provisions (`advance`, `monthly`), ship and party movement (`shipStep`, `partyStep`), sea and land events, discoveries, ruins, diplomacy, disease, conquest, foraging, friars (`preach`), Sevilla's treasury, scoring, save/load. |
| `js/battle.js` | Turn-based combat: `TACTICS`, per-culture `WAR_STYLES`, terrain effects (`battleGround`), wounds, fatigue, morale. |
| `js/raids.js` | Native counter-attacks: war parties (`Game.s.warParties`) that spawn monthly, march across the map, attack the expedition or colonies; raid resolution against garrisons and walls; counter-offensives after a city falls; colonial revolts. Battles that start mid-move go through `Game.pendingBattle`, which `Input.update` starts once no dialog is open. |
| `js/audio.js` | `Sound`: all audio synthesised with the Web Audio API, with no audio files. Procedural music per mood (`MOODS`: title, sea, land, battle, town) in Iberian modes and progressions (La Folía, the Andalusian cadence), ambience (waves, wind, jungle, birds, gulls) and sound effects (`Sound.sfx`). Named `Sound` because `Audio` is a browser global. It starts on the first user gesture. Game events trigger sounds mainly through `Sound.onLog` (called from `Game.log`), plus direct hooks in battles and movement. Volume settings are stored in `localStorage` key `conquista-audio`. |
| `js/ui.js` | HUD, ship's log, toasts and banners, and every dialog: encounters, colonies, the Sevilla port, codex, atlas, help, end screen. |
| `js/main.js` | Canvas rendering (`Render`), sprites, fog of war, minimap, mouse/keyboard input and click-to-move orders (`Input`), the main loop and boot (`Main`). |
| `css/style.css` | All styling. Parchment dialogs on a dark map, with gold accents. |
| `manifest.webmanifest`, `sw.js`, `icons/` | The installable app: web app manifest, a network-first service worker for offline play, and the app icons. **When you add a game file, add it to `FILES` in `sw.js`** (and bump `CACHE`), and if it lives in a new folder, add that folder to the copy step in the Pages workflow. |
| `tools/make-icons.js` | Regenerates `icons/` from the game's own caravel sprite (needs the local server running). |
| `.github/workflows/pages.yml` | Deploys the game to GitHub Pages on every push to the default branch. |
| `build.js` | Produces the single-file artifact bundle (see Publishing). |
| `tests/smoke.js` | Headless end-to-end smoke test (see Testing). |

### Key concepts

- **Coordinates**: the map is equirectangular, from longitude −118 to −4 and latitude 45 to −56, at 2 tiles per degree (228 × 202 tiles). Convert with `World.tx(lon)`, `World.ty(lat)`, `World.lon(x)` and `World.lat(y)`. Content in `data.js` is written in real longitude/latitude and snapped to the nearest land tile at game start.
- **Old World**: land east of `GEO.OLD_WORLD_LON` (−32) is Europe, Africa and the Atlantic isles. It cannot be explored on foot. Sevilla is the home port there.
- **Units**: there is one ship (`s.ship`) and at most one land expedition (`s.party`). `Game.active()` returns whichever one the player controls. Soldiers, horses, food and the rest are a single shared pool.
- **Time** only advances when units move or the player takes timed actions (foraging, preaching, careening). `Game.advance(days)` eats provisions and triggers `monthly()` ticks, which run epidemics, colony income and chronicle events. The game ends in 1600.
- **Sites**: settlements, ruins and the port are indexed by tile in `Game.siteAt`. Rebuild it with `Game.buildSiteIndex()` after loading.
- **Saves**: `localStorage` key `conquista-save-v1`, holding JSON of `Game.s` plus a bit-packed explored mask. When you add a new state field, give it a default in `Game.load()` so older saves still work (see the `priests`, `converted` and `foodReadyDay` backfills).
- **Storage can fail**: in the published artifact, `localStorage` may be empty or throw (private windows, previews, blocked site data). Wrap every read and write in try/catch, and the game must stay fully playable without saving. If saving fails, tell the player once in the log instead of crashing.

## Conventions

- Match the existing style: 2-space indentation, single quotes, semicolons, `'use strict'` at the top of each file, plain objects as namespaces, no classes.
- Gameplay numbers (prices, rates, combat multipliers) live next to the logic or in `data.js`. Keep new content data-driven in `data.js` where possible.
- Dialogs are built with `UI.dialog(title, html, buttons, noBgClose, actions)`. A button is `[label, fn, disabled, tooltip]`, and inline `data-act` elements map to the `actions` object. Re-render a dialog by calling its builder again.
- Write log messages with `Game.log(msg, cls)`. The classes are `good`, `bad`, `warn`, `discovery`, `artifact`, `fame`, `disease`, `chron`, `big` and `hint`.
- **Battle wording**: the user likes the battle log's tone and format ("**Round N** — 💥 Arquebus & Cannon Volley: X warriors fall, *panic spreads…*. You lose N soldiers…"). Keep the tactic names, descriptions and this line format when changing combat.
- **Tone**: the game takes a historical, non-glorifying view. Disease, war deaths and forced labour are shown plainly, and the end screen tallies the human cost. Native peoples are described respectfully and accurately. Keep new content in that spirit.

## Workflow

- For changes that touch two or more files, propose a short plan before writing code and wait for approval.
- One feature or fix per task. Don't bundle unrelated changes.
- After each change: run the smoke test, fix any failures, then commit with a clear message.
- After gameplay changes, rebuild the artifact with `node build.js`.
- When a feature is finished, update **Current status** below.
- If something in this file is out of date or wrong, say so and fix it.

## Publishing

**Phone app (GitHub Pages):** every push to the default branch is deployed to https://gbismpik-create.github.io/Spanish-game/, where it can be installed with "Add to Home Screen". This requires the one-time repo setting Settings → Pages → Source: "GitHub Actions".

**Mobile layout:** the phone layout is driven by the `@media (max-width: 800px), (max-height: 500px)` block in `css/style.css`. HUD items marked minor, buttons with class `sec` (shown under ⋯) and the log ticker are all handled there. Touch input (pinch, two-finger pan, press-and-hold info) lives in `Input.init` in `main.js`. Check new UI at phone sizes in both orientations.


The playable claude.ai artifact is a single bundled HTML file: the `<body>` of `index.html` with `css/style.css` and the eight JS files inlined in load order, without its own `<html>`/`<head>` tags. Generate it with `node build.js` (plain Node, no dependencies). Never edit the bundle by hand.

## Current status

> Keep this section short and current. It tells each new session what matters now.

**Done**
- Map, ship and party movement, fog of war, minimap
- Detailed sprites: a distinct look per ship type with a wake; the expedition drawn as a marching formation built from the real army
- Sea and land events, discoveries, ruins and artifacts
- Diplomacy, disease, conquest, friars
- Colony city screen (Grepolis-style): 8 buildings with levels 1–5, a 2-slot construction queue paid in gold and real (wall-clock) time — 1m, 5m, 20m, 1h, 3h by level (`BUILD_MINUTES`), continuing while the game is closed — monthly production, garrisons; colonies grow on the map
- Native counter-attacks: visible war parties, raids on colonies (garrison and walls auto-resolve, or the player leads the defence), counter-offensives, revolts
- After a conquest: press warriors into service as auxiliaries (permanent, paid, take berths), garrison them, or release them
- Turn-based battles with tactics and per-culture war styles; a battle report with force tables (now / start / last-round change), a balance-of-power bar and a one-line round summary
- Sevilla port and treasury, scoring, end screen with human cost
- Save/load
- Installable phone app: mobile layout, touch controls (pinch, hold for info), offline service worker, icons, GitHub Pages deployment
- Audio: procedural music that follows the situation, ambience, sound effects, and a 🔊 settings panel

**Next**
1. Create `build.js` and switch Publishing to use it.
2. Add the seeded RNG and the `?seed=` / `?noevents=` debug flags.
3. Write `tests/smoke.js` using those flags.
4. Tell the player once in the log when an autosave fails. (All `localStorage` access is already wrapped in try/catch; a failed autosave is currently silent.)
5. New-player experience: a guided first voyage with hints in the log.

**Known bugs**
- (none recorded yet)
