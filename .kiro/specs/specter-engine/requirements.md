# Specter Engine — Requirements

## Overview

Specter Engine is a reusable puzzle-progression game engine delivered as a static web application (vanilla HTML/CSS/JavaScript, no frameworks, no build step) deployable directly to GitHub Pages from the repository root.

---

## Functional Requirements

### FR-1: Deployable static web app
The project must run entirely from the filesystem or via a static HTTP server (GitHub Pages). No build step, no bundler, no server-side logic, no external CDN assets.

### FR-2: Landing page
`index.html` lists all available games with descriptions, metadata tags, and links to play each game.

### FR-3: Generic game player
`game.html` loads a content JSON file identified by the `?game=<id>` query parameter and renders a fully playable game using the engine. The same HTML/JS file drives both games.

### FR-4: Engine — state machine (`engine/engine.js`)
The engine must implement:
- **Rooms**: load and navigate rooms; track the current room.
- **Inventory**: pick up items; display items in the current room (minus picked-up ones).
- **Item combining**: combine two items per content-defined rules; consume source items; grant result.
- **Unlock conditions**: rooms and events unlock when their condition (`hasItem`, `solvedPuzzle`, `flag`, `hasDeduction`) is satisfied.
- **Events**: multi-step mechanism chains; each step unlocks only after the previous one completes; event marks solved on final step; `onComplete` effects fire.
- **Hints**: return contextual hint text keyed to a puzzle/event id.
- **Timer mode**: countdown from `timeLimitSeconds`; fires `onTimerEnd` effects on expiry; expiry restarts the game state.
- **Endings**: apply `triggerEnding` effect; block further actions after the game ends.
- **Accusation**: match a suspect to an ending; enforce required deductions before allowing accusation.
- **Deduction linking**: match two clue ids against deduction definitions; form the deduction on success.
- **Save/restore**: persist and restore state via `localStorage`.
- **Reset**: clear state and restart.

### FR-5: Renderer (`engine/renderer.js`)
A generic UI renderer driven entirely by the engine's state snapshot. Must render:
- Room name and description.
- Available exits (locked exits shown but disabled).
- Items visible in the current room with a "Pick Up" action.
- Multi-step event panels with progress bar, current-step description, and "Hint" button.
- Room-level actions.
- Inventory grid with Examine and Use buttons.
- Item-combining panel (shown when ≥ 2 items in inventory).
- Navigation map (untimed games) or timer display (timed games).
- Evidence board with clue chips, formed deductions, linking panel, and accusation panel (when deduction definitions exist).
- Message log showing the last several action outcomes.
- Ending overlay (win/lose screen with "Play Again" button).
- Save and Restart controls in the header.

The renderer must have zero game-specific knowledge.

### FR-6: Schema validator (`engine/schema.js`)
Validates a parsed game JSON object against the engine's supported feature set. Returns `{ valid, errors }`. Must detect:
- Missing required fields (`meta.title`, `meta.description`, `room.id`, etc.).
- Unsupported condition types, action types, effect types.
- Unrecognised top-level keys.
- Structural violations (empty steps array, etc.).

### FR-7: Game content — The Forgotten Temple (`games/forgotten-temple.json`)
- Timed: 10-minute countdown; on expiry all state resets.
- 4 linearly-unlocking rooms: Entrance Hall → Mirror Chamber (requires serpent-lock solved) → (and separately) Altar Room → Reliquary (requires mirror-alignment solved).
- Multi-step mechanism chains: Serpent Lock (3 steps), Mirror Alignment (3 steps), Star Pedestal (3 steps).
- Item combining: torch + flint shard → lit torch; sun disc + ancient staff → charged staff.
- One win ending (escape) and one implicit loss via timer reset.

### FR-8: Game content — Case Zero (`games/case-zero.json`)
- Untimed; free movement between all 4 locations from the start.
- 9 collectable evidence items across 4 locations.
- 5 deduction definitions; forming deductions requires linking specific pairs of clues.
- 3 suspects; correct accusation requires 3 specific deductions; wrong accusation triggers immediately.
- 2 endings: correct accusation (win) and wrong accusation (lose).

### FR-9: Separation invariant
The engine source (`engine/engine.js`, `engine/renderer.js`, `engine/schema.js`) must contain no game-specific identifiers (character names, location names, object names specific to either game). Content files must only use engine-supported feature keys.

### FR-10: Tests (`tests/`)
- `tests.html`: runs the full test suite in-browser.
- `tests.js`: runs in both Node.js and browser.
- Test groups:
  - **A** — Schema validation: both content files pass; malformed inputs are caught.
  - **B** — Separation: engine source contains no game-specific terms; content uses only supported types.
  - **C** — Engine logic: unit tests for every major behaviour (pickup, move, combine, trigger, accuse, link, endings, timer reset, save/reset).
  - **D** — Game walkthrough smoke tests: complete playthrough of both games to their win endings.

---

## Non-functional Requirements

### NFR-1: No external dependencies
No CDN links, no npm packages, no external fonts or images. All visuals via CSS and emoji.

### NFR-2: Responsive layout
Usable on desktop and mobile. Two-column layout on wide screens; single column on narrow screens.

### NFR-3: Dark atmospheric theme
Consistent dark colour palette with amber accent, readable contrast, atmospheric feel appropriate to both games.

### NFR-4: Readable code
Comments explaining non-obvious logic. Consistent code style throughout.

### NFR-5: GitHub Pages deployable
All paths are relative. No server-side routing. `index.html` at repo root.
