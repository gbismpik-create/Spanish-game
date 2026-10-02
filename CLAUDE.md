# CLAUDE.md

Guidance for working on **Conquista: The New World (1492–1600)**, a browser strategy game about the Spanish voyages to and conquest of the Americas.

## Running

- Plain HTML/CSS/JavaScript. There is no build step, no bundler, no npm dependencies and no framework.
- Open `index.html` in a browser, or serve the folder: `npx http-server -p 8123 -c-1 .` and visit `http://localhost:8123`.
- Scripts are classic `<script>` tags (not ES modules) loaded in a fixed order in `index.html`: `data.js` → `world.js` → `game.js` → `battle.js` → `ui.js` → `main.js`. Each file defines globals (`World`, `Game`, `Battle`, `UI`, `Render`, `Input`, `Main`) used by later files. Keep that order when adding files.
- There is no test suite. Verify changes by driving the game headlessly with Playwright (Chromium is at `/opt/pw-browsers`). `window.__ready` becomes true once the map is generated, and game objects can be called from `page.evaluate` (for example `Game.s`, `Input.order(x, y)`, `Battle.start({...})`). Watch for `pageerror` events. Random events like storms can interrupt scripted runs, so don't treat one timeout as a bug.

## Architecture

| File | Responsibility |
|---|---|
| `js/data.js` | All static content: map bounds (`GEO`), land polygons, islands, rivers, mountains, biomes, `CULTURES`, `SETTLEMENTS`, `RUIN_SITES`, `ARTIFACTS`, `DISCOVERIES`, `SHIPS`, `PRICES`, `TITLES`, `MONARCHS`, `CHRONICLE`, `DISEASES`. |
| `js/world.js` | Tile map generated from `data.js` (`World.generate()`), terrain types `TT`, terrain info `TERRAIN`, foraging yields `FORAGE`, connected components, A* pathfinding (`World.findPath`), and the pre-rendered terrain canvas (`World.render()`). |
| `js/game.js` | Game state `Game.s` and rules: new game setup, time and provisions (`advance`, `monthly`), ship and party movement (`shipStep`, `partyStep`), sea and land events, discoveries, ruins, diplomacy, disease, conquest, foraging, friars (`preach`), Sevilla's treasury, scoring, save/load. |
| `js/battle.js` | Turn-based combat: `TACTICS`, per-culture `WAR_STYLES`, terrain effects (`battleGround`), wounds, fatigue, morale. |
| `js/ui.js` | HUD, ship's log, toasts and banners, and every dialog: encounters, colonies, the Sevilla port, codex, atlas, help, end screen. |
| `js/main.js` | Canvas rendering (`Render`), sprites, fog of war, minimap, mouse/keyboard input and click-to-move orders (`Input`), the main loop and boot (`Main`). |
| `css/style.css` | All styling. Parchment dialogs on a dark map, with gold accents. |

### Key concepts

- **Coordinates**: the map is equirectangular, from longitude −118 to −4 and latitude 45 to −56, at 2 tiles per degree (228 × 202 tiles). Convert with `World.tx(lon)`, `World.ty(lat)`, `World.lon(x)` and `World.lat(y)`. Content in `data.js` is written in real longitude/latitude and snapped to the nearest land tile at game start.
- **Old World**: land east of `GEO.OLD_WORLD_LON` (−32) is Europe, Africa and the Atlantic isles. It cannot be explored on foot. Sevilla is the home port there.
- **Units**: there is one ship (`s.ship`) and at most one land expedition (`s.party`). `Game.active()` returns whichever one the player controls. Soldiers, horses, food and the rest are a single shared pool.
- **Time** only advances when units move or the player takes timed actions (foraging, preaching, careening). `Game.advance(days)` eats provisions and triggers `monthly()` ticks, which run epidemics, colony income and chronicle events. The game ends in 1600.
- **Sites**: settlements, ruins and the port are indexed by tile in `Game.siteAt`. Rebuild it with `Game.buildSiteIndex()` after loading.
- **Saves**: `localStorage` key `conquista-save-v1`, holding JSON of `Game.s` plus a bit-packed explored mask. When you add a new state field, give it a default in `Game.load()` so older saves still work (see the `priests`, `converted` and `foodReadyDay` backfills).

## Conventions

- Match the existing style: 2-space indentation, single quotes, semicolons, `'use strict'` at the top of each file, plain objects as namespaces, no classes.
- Gameplay numbers (prices, rates, combat multipliers) live next to the logic or in `data.js`. Keep new content data-driven in `data.js` where possible.
- Dialogs are built with `UI.dialog(title, html, buttons, noBgClose, actions)`. A button is `[label, fn, disabled, tooltip]`, and inline `data-act` elements map to the `actions` object. Re-render a dialog by calling its builder again.
- Write log messages with `Game.log(msg, cls)`. The classes are `good`, `bad`, `warn`, `discovery`, `artifact`, `fame`, `disease`, `chron`, `big` and `hint`.
- **Battle wording**: the user likes the battle log's tone and format ("**Round N** — 💥 Arquebus & Cannon Volley: X warriors fall, *panic spreads…*. You lose N soldiers…"). Keep the tactic names, descriptions and this line format when changing combat.
- **Tone**: the game takes a historical, non-glorifying view. Disease, war deaths and forced labour are shown plainly, and the end screen tallies the human cost. Native peoples are described respectfully and accurately. Keep new content in that spirit.

## Publishing

The playable claude.ai artifact is a single bundled HTML file: the `<body>` of `index.html` with `css/style.css` and the six JS files inlined in load order, without its own `<html>`/`<head>` tags. Regenerate it from the source files after gameplay changes rather than editing the bundle by hand.
