# Specter Engine — Design

## Architecture

```
index.html          Landing page — links to both games
game.html           Generic game player (single page for all games)
engine/
  engine.js         State machine — all game logic
  renderer.js       Generic DOM UI driven by state snapshots
  schema.js         Content file validator
games/
  forgotten-temple.json   Game 1 content
  case-zero.json          Game 2 content
tests/
  tests.js          Test suite (Node + browser)
  tests.html        Browser test runner
.kiro/specs/specter-engine/
  requirements.md
  design.md
  tasks.md
```

---

## Data Flow

```
Content JSON  ──load()──▶  SpecterEngine  ──getState()──▶  SpecterRenderer
                                │                               │
                   performAction(action) ◀──── user interaction ─┘
                                │
                           getState() ──▶ SpecterRenderer.render()
```

The renderer never reads engine internals. The engine never reads the DOM. Content files never contain code.

---

## Engine State Machine

### Internal state shape

```js
{
  currentRoomId  : string,
  inventory      : string[],          // item ids
  flags          : { [name]: bool },
  solvedPuzzles  : string[],
  eventProgress  : { [eventId]: number },
  deductions     : string[],
  ended          : boolean,
  endingId       : string | null,
  timerRemaining : number,
  roomStates     : { [roomId]: { itemsPickedUp: string[] } }
}
```

### Condition evaluation

| Type           | Passes when…                                      |
|----------------|---------------------------------------------------|
| `hasItem`      | `inventory` contains `cond.id`                    |
| `solvedPuzzle` | `solvedPuzzles` contains `cond.id`                |
| `flag`         | `flags[cond.name]` is truthy                      |
| `hasDeduction` | `deductions` contains `cond.id`                   |
| `null`         | Always passes (unconditionally unlocked)          |

### Effect types

| Type            | Action                                                                 |
|-----------------|------------------------------------------------------------------------|
| `setFlag`       | Set `flags[name] = value`                                              |
| `giveItem`      | Add `itemId` to `inventory`                                            |
| `removeItem`    | Remove `itemId` from `inventory`                                       |
| `solveRoom`     | Add `puzzleId` to `solvedPuzzles`                                      |
| `triggerEnding` | Set `ended = true`, `endingId = endingId`, stop timer                  |
| `resetRooms`    | Clear inventory, flags, puzzles, event progress, room states; reset timer |
| `addDeduction`  | Add `deductionId` to `deductions`                                      |

### Action dispatch

The `performAction(action)` method is the single entry point for all player interactions. It returns `{ ok, message, state }`.

```
action.type
├── move      → validate unlock condition → set currentRoomId
├── pickup    → mark item picked up in roomStates → push to inventory
├── examine   → return item.examineText
├── use       → check inventory → apply item.useEffects
├── combine   → check both in inventory → find rule → swap items
├── trigger   → advance event one step → apply effects → check completion
├── accuse    → check requiresDeductions → set ended + endingId
├── link      → find matching deduction def → check clues in hand → push deduction
└── (default) → match room.actions by id/type → _executeAction
```

### Event chain

Each event has a `steps` array. `eventProgress[eventId]` tracks the index of the next step to execute. Calling `trigger` runs the current step's optional `action` (if its condition passes), then applies the step's `effects`, then increments the counter. When all steps complete, `onComplete` effects fire and the event id is added to `solvedPuzzles`.

### Timer

`startTimer(onTick, onExpire)` sets a 1-second `setInterval`. Each tick decrements `timerRemaining`. At zero: applies `meta.onTimerEnd` effects (typically `resetRooms`) and calls the `onExpire` callback. The renderer re-renders after each tick to update the displayed countdown.

---

## Content File Format

```jsonc
{
  "meta": {
    "title": string,
    "description": string,
    "timed": boolean,
    "timeLimitSeconds": number,         // required if timed
    "onTimerEnd": Effect[],             // applied on expiry
    "accuseRequires": number            // min deductions before accuse
  },
  "rooms": [{
    "id": string,
    "name": string,
    "description": string,
    "exits": string[],                  // room ids
    "items": string[],                  // item ids present in room
    "events": string[],                 // event ids active in room
    "actions": Action[],                // room-level actions
    "unlockCondition": Condition | null
  }],
  "items": [{
    "id": string,
    "name": string,
    "icon": string,                     // emoji
    "description": string,
    "examineText": string,
    "useText": string,
    "useEffects": Effect[],
    "onPickup": Effect[],
    "combinesWith": { [itemId]: { result, message, effects? } }
  }],
  "clues": [{ "id", "name", "description" }],
  "hints": [{ "id", "forPuzzle", "text" }],
  "events": [{
    "id": string,
    "name": string,
    "description": string,
    "steps": [{
      "id": string,
      "description": string,
      "actionLabel": string,
      "action": Action?,               // optional guard with condition
      "effects": Effect[]
    }],
    "onComplete": Effect[]
  }],
  "deductions": [{                     // detective games only
    "id": string,
    "sources": string[],               // exactly 2 clue ids
    "text": string,
    "message": string,
    "effects": Effect[]
  }],
  "suspects": [{                       // detective games only
    "id": string,
    "name": string,
    "requiresDeductions": string[],
    "notReadyMessage": string,
    "accuseMessage": string,
    "endingId": string
  }],
  "endings": [{ "id", "title", "text", "isWin", "icon" }]
}
```

**Condition**: `{ type: "hasItem"|"solvedPuzzle"|"flag"|"hasDeduction", id?, name? }`

**Action**: `{ type, label, condition?, failMessage?, successMessage?, effects? }`

**Effect**: `{ type, name?, value?, itemId?, puzzleId?, endingId?, deductionId?, message? }`

---

## Renderer Architecture

The renderer is a pure function of the engine's state snapshot. It tears down and rebuilds the entire DOM on each `render(state)` call. This keeps state management trivially simple at the cost of some repaint cost — acceptable for a text-based puzzle game.

### Layout

```
┌──────────────────────────────────────────────┐
│  [Timer] Game Title                [Save][Restart] │  ← header
├──────────────────┬───────────────────────────┤
│  Room name       │  Locations (map)           │
│  Room desc       │  Inventory grid            │
│  Exits           │    + Combine panel         │
│  Items here      │  Evidence board (if any)   │
│  Mechanisms      │    + Deductions            │
│  Room actions    │    + Link panel            │
│  Message log     │    + Accusation panel      │
└──────────────────┴───────────────────────────┘
```

On screens ≤ 768 px wide the grid collapses to a single column.

### Evidence board visibility

The evidence board section renders only when the loaded game's content file contains a non-empty `deductions` array. This keeps The Forgotten Temple's UI uncluttered.

### Accusation panel

The accusation panel reads `window._specterGameData.suspects` (set by `game.html` on load) rather than the state snapshot, since suspect definitions are content metadata rather than mutable state.

---

## Separation Guarantee

The separation invariant (FR-9) is maintained structurally:

- `engine.js` contains only generic identifiers: `item`, `room`, `event`, `suspect`, `deduction`, `clue`, `flag`, `pickup`, `combine`, `move`, `trigger`, `accuse`, `link`, etc.
- `renderer.js` renders whatever labels, names, and descriptions the engine's snapshot provides — it never hard-codes strings from either game.
- `schema.js` validates structural shape, not semantic content.
- The test suite (Group B) verifies this mechanically by scanning the engine source for a list of game-specific terms.

---

## Save / Restore Strategy

State is serialised as JSON to `localStorage` under the key `specter_save_<game-title-slug>`. On load, `game.html` calls `SpecterEngine.load(data, { resumeSaved: true })`, which attempts to restore saved state before falling back to a fresh state. The timer, if applicable, resumes from the saved `timerRemaining` value.

---

## Game Design Notes

### The Forgotten Temple

Dependency graph:
```
Entrance Hall
  ├── [Serpent Lock] ──► unlocks Mirror Chamber
  └── [Altar Room] always accessible
        └── [ancient-staff item]
Mirror Chamber
  ├── [Mirror Alignment] ──► unlocks Reliquary exit from Altar Room
  └── [bronze-key item]
Altar Room
  ├── [ancient-staff item]
  └── Reliquary ──► [requires mirror-alignment solved]
Reliquary
  └── [Star Pedestal] ──► win ending
```

Combine chain: `torch` + `flint-shard` (found via serpent event) → `lit-torch` → enables serpent step 3. `sun-disc` + `ancient-staff` → `charged-staff` → enables pedestal step 1.

### Case Zero

All 4 locations accessible from the start. Evidence must be physically collected before it can be linked. Deduction dependencies:

| Deduction            | Sources                              |
|----------------------|--------------------------------------|
| voss-in-study        | monogrammed-cufflink + case-file     |
| voss-financial-motive| ledger-page + shipping-manifest      |
| voss-planned-murder  | matchbook + witness-statement        |
| roland-at-docks      | broken-watch + dock-testimony        |
| roland-had-motive    | threatening-letter + case-file       |

Accusing Nadia Voss requires all three `voss-*` deductions. Accusing Roland or Ash requires no deductions and immediately triggers the wrong ending.
