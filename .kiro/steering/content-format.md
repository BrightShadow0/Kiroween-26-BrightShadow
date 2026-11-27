# Specter Engine — Content Format Conventions

## IDs

All ids use **kebab-case** (e.g. `entrance-hall`, `sun-disc`, `idol-scales`).

## Rooms

- `rooms[0]` is the start room.
- `room.exits` is an array of target room ids (not objects).
- `room.unlockCondition` gates entry; `null` means always accessible.
- `room.sceneImage` is optional. Value is a registry key or a URL; if absent
  the renderer falls back to built-in generated art.

## Items

- Combinable items carry a `combinesWith` map keyed by the other item's id:
  `{ result: "result-id", message: "..." }`.
- Combine journal text follows the pattern:
  `"Combining <A name> and <B name>, you obtained <result name>. <flavour>."`
- Every action type (`pickup`, `examine`, `use`, `combine`, `move`, `trigger`,
  `accuse`, `link`) must have its own distinct journal/result text.

## Events

Events are multi-step sequences. Each step may carry:
- `action` — with `condition` and `failMessage`; a failed condition applies
  `penaltySeconds` on timed games.
- `effects` — applied after the action passes.
- `onComplete` — effects applied when all steps are done; this also marks the
  event solved in `solvedPuzzles`.

## Hints

```json
{ "id": "...", "forPuzzle": "<event-id>", "text": "...", "highlightText": "..." }
```

- `highlightText` **must be a verbatim substring** of the room's `description`.
  The renderer uses it to highlight the clue in the room text.
- Hints light up environmental clues; they never state the answer outright.

## Endings

Triggered via an effect `{ "type": "triggerEnding", "endingId": "..." }`.
Each ending object requires `id`, `title`, `text`, and `isWin` (boolean).
