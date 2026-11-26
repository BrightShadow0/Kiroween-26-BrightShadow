# Specter Engine — Tasks

All tasks are complete. This file documents what was built and in what order.

---

## Completed Tasks

### T-1: Project scaffold
- Created directory structure: `engine/`, `games/`, `tests/`, `.kiro/specs/specter-engine/`.
- All paths relative for GitHub Pages compatibility.

### T-2: Schema validator (`engine/schema.js`)
- Validates top-level keys against `TOP_LEVEL_KEYS` whitelist.
- Validates `meta`, `rooms`, `items`, `clues`, `hints`, `events`, `endings`.
- Validates condition types against `SUPPORTED_CONDITION_TYPES`.
- Validates action types against `SUPPORTED_ACTION_TYPES`.
- Validates effect types against `SUPPORTED_EFFECT_TYPES`.
- Returns `{ valid, errors }`.
- Exports for both CommonJS (Node) and browser global.

### T-3: Engine state machine (`engine/engine.js`)
- Implemented `load(gameData, options)` with optional save-state resume.
- Implemented `getState()` returning an immutable-ish renderer snapshot.
- Implemented `performAction(action)` dispatcher for all action types:
  - `move`, `pickup`, `examine`, `use`, `combine`, `trigger`, `accuse`, `link`.
- Implemented event chain: step-by-step progression with per-step actions, effects, and `onComplete`.
- Implemented `resetRooms` effect for timer expiry.
- Implemented timer: `startTimer(onTick, onExpire)` / `stopTimer()`.
- Implemented `saveState()` / `loadSavedState()` via `localStorage`.
- Implemented `resetState()`.
- Implemented `getHint(puzzleId)`.
- Exports for both CommonJS and browser global.

### T-4: Renderer (`engine/renderer.js`)
- Implemented `init(rootElementId)` and `render(state)`.
- Renders: header (with timer, save, restart), room, exits, items, events, room actions, inventory, combine panel, navigation map, evidence board (clues, deductions, link panel, accusation panel), message log, ending overlay.
- Zero game-specific strings or identifiers.
- Exports for both CommonJS and browser global.

### T-5: Game content — The Forgotten Temple (`games/forgotten-temple.json`)
- 4 rooms: Entrance Hall, Mirror Chamber, Altar Room, Reliquary.
- 3 multi-step events: Serpent Lock, Mirror Alignment, Star Pedestal.
- 7 items including 2 combinable pairs.
- 3 hints, 2 endings (escape victory, timer doom).
- Passes schema validation.

### T-6: Game content — Case Zero (`games/case-zero.json`)
- 4 locations: Detective's Office, Harbour Docks, Riverside Manor, Noir Café.
- 9 collectable evidence items.
- 3 events (interview/investigation chains).
- 5 deduction definitions.
- 3 suspects; correct accusation requires 3 specific deductions.
- 2 endings (correct accusation, wrong accusation).
- Passes schema validation.

### T-7: Generic game player (`game.html`)
- Loads game JSON by `?game=` query parameter via `fetch()`.
- Sets `window._specterGameData` for renderer's accusation panel.
- Initialises engine and renderer.
- Starts timer with tick/expire callbacks for timed games.
- Handles load errors gracefully.
- Full responsive CSS with dark atmospheric theme.
- "← All Games" back link.

### T-8: Landing page (`index.html`)
- Lists both games with banners, descriptions, metadata tags.
- Links to `game.html?game=<id>` for each game.
- Consistent dark theme, responsive grid.

### T-9: Test suite (`tests/tests.js`, `tests/tests.html`)
- **Group A** — Schema validation: 7 tests covering valid files and malformed inputs.
- **Group B** — Separation: engine source scanned for game-specific terms; content files checked for unsupported type values.
- **Group C** — Engine logic: 20 unit tests covering every major behaviour.
- **Group D** — Game walkthrough smoke tests: complete playthrough of both games.
- Runs in Node.js (`node tests/tests.js`) and browser (`tests/tests.html`).

### T-10: Kiro specs
- `requirements.md`: functional and non-functional requirements.
- `design.md`: architecture, data flow, state machine, content format, renderer layout, separation guarantee, save strategy, game design notes.
- `tasks.md`: this file.

---

## Verification

Run in Node.js:
```sh
node tests/tests.js
```

Open in browser (via static server or `file://` with CORS disabled):
```
tests/tests.html
```

Expected: all tests pass.
