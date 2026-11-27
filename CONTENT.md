# Specter Engine — Content File Reference

A game is a single JSON file. The engine (`engine.js`) owns all logic; the
renderer (`renderer.js`) owns all UI. Content files are pure data and never
contain code. Validate any content file with
`SpecterSchema.validateGameContent(data)` (the Playground does this for you)
— it returns `{ valid, errors, warnings }`. `errors` block the game;
`warnings` mark things that run but probably are not what you meant.

## Top-level keys

| Key | Required | Purpose |
| --- | --- | --- |
| `meta` | yes | Game identity and rules |
| `rooms` | yes | Places the player can be. Non-empty array |
| `items` | no | Things that can be picked up and combined |
| `events` | no | Multi-step mechanisms/puzzles |
| `endings` | no | Win/lose screens |
| `hints` | no | Environmental hints, one per puzzle |
| `clues` | no | Evidence entries (detective games) |
| `deductions` | no | Conclusions formed by linking clues |
| `suspects` | no | Accusation targets, each mapped to an ending |

Every `id` must be unique within its array, and every reference between parts
is checked by the validator: exits must point at real rooms, room `items` and
`events` at real ids, combine results at real items, `triggerEnding` and
suspect `endingId` at real endings, hint `forPuzzle` at a real event or room,
deduction `sources` at real clues/items, and `requiresDeductions` at real
deductions. A broken link fails validation with its full path.

## meta

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Required. Also derives the default save key |
| `description` | string | Required |
| `theme` | string | `temple`, `noir` or `default`. Unknown values fall back to default art and styling (validator warns) |
| `timed` | boolean | Enables the countdown |
| `timeLimitSeconds` | number | Required when `timed` |
| `combineFailPenaltySeconds` | number | Timed games only; seconds lost per wrong combine |
| `onTimerEnd` | effect[] | Timed games only; runs when the countdown hits zero |
| `startRoom` | string | Room id to start in. Default: `rooms[0]` |
| `accuseRequires` | number | Deductions needed before the accusation panel opens. Default: 1 |

`combineFailPenaltySeconds`, `onTimerEnd` and any `penaltySeconds` are ignored
in untimed games (validator warns).

## rooms[]

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `name`, `description` | string | Required |
| `exits` | string[] | Room ids the player can move to |
| `items` | string[] | Item ids found here |
| `events` | string[] | Event ids available here |
| `actions` | action[] | Room-level interactions (see below) |
| `unlockCondition` | condition | null/absent = always open |
| `lockedMessage` | string | Shown when the player tries a locked exit. Default: "That way is locked." |
| `sceneImage` | string | Scene art: a key in the `SPECTER_SCENES` registry or a direct URL (http/https/data). A bad value logs a console warning and falls back to the built-in scene art |

## items[]

| Field | Type | Notes |
| --- | --- | --- |
| `id`, `name` | string | Required |
| `icon` | string | Emoji shown in the inventory |
| `description` | string | Shown in the room listing |
| `examineText` | string | Shown on Examine |
| `useText` | string | Shown on Use when there are no `useEffects` |
| `useEffects` | effect[] | Applied on Use |
| `onPickup` | effect[] | Applied when picked up |
| `combinesWith` | object | Map of other item id → `{ result, message, effects }`. `result` is the item id granted; `message` overrides the default combine journal line |

## events[] (mechanisms)

An event is a chain of steps; each step unlocks when the previous completes.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Required |
| `name`, `description` | string | Shown in the Mechanisms panel |
| `steps[]` | step[] | Non-empty, in order |
| `onComplete` | effect[] | Applied when the last step finishes |

Step fields: `id`, `description` (required; also the journal line when the
step's action says nothing), `actionLabel` (button text), `action`, `effects`.

`step.action` is a gated interaction: `condition` gates it, `failMessage`
answers a failed attempt, `penaltySeconds` (timed games) punishes it, and
`effects` apply on success. Its `type` must be one of the supported action
types and declares the kind of interaction; behavior comes from the
condition/effects fields, not from the type. Same shape as room `actions`,
which the renderer fires through `SpecterEngine.performRoomAction(id)`.

## conditions

`{ type: 'hasItem', id }`, `{ type: 'solvedPuzzle', id }` (event or room id),
`{ type: 'flag', name }`, `{ type: 'hasDeduction', id }`,
`{ type: 'allOf', conditions: [...] }`, `{ type: 'anyOf', conditions: [...] }`,
`{ type: 'not', condition }`. `null` means always true.

## effects

`{ type: 'setFlag', name, value?, message? }`,
`{ type: 'giveItem', itemId, message? }`,
`{ type: 'removeItem', itemId, message? }`,
`{ type: 'solveRoom', puzzleId, message? }`,
`{ type: 'triggerEnding', endingId, message? }`,
`{ type: 'addDeduction', deductionId, message? }`,
`{ type: 'resetRooms', message? }` (full state reset, for timed loops).

## hints[]

`id`, `forPuzzle` (event or room id), `text`, `highlightText`. Hints point at
something in the environment: when `highlightText` matches part of the room
description, the Hint button flashes that phrase instead of printing the hint.
Never state the answer.

## clues[], deductions[], suspects[] (detective features)

- Clue: `id` (matches the item id that carries it), `description`, `name`.
- Deduction: `id`, `text`, `sources` (clue ids the player links on the
  evidence board), `message`, `effects`.
- Suspect: `id`, `name`, `endingId`, `requiresDeductions`,
  `notReadyMessage`, `accuseMessage`.

## endings[]

`id`, `title`, `text`, `isWin` (boolean; picks the icon tone), `icon` (emoji).

## Engine API (for hosts and tooling)

```
SpecterEngine.load(gameData, { resumeSaved, saveKey })
SpecterEngine.getState()              → StateSnapshot
SpecterEngine.performAction(action)   → { ok, message, state }
SpecterEngine.performRoomAction(id)   → { ok, message, state }
SpecterEngine.getHint(puzzleId)       → string | null
SpecterEngine.getHintDetails(puzzleId)→ hint[]
SpecterEngine.saveState() / loadSavedState() / resetState()
SpecterEngine.startTimer(onTick, onExpire) / stopTimer()
```

Saves live in `localStorage` under `specter_save_<title-slug>`. Hosts running
untrusted or foreign content (the Playground) must pass `saveKey` so a custom
game can never overwrite a real game's save.
