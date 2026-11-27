# Specter Engine — Architecture

## Module responsibilities

- **engine.js** — generic state machine. Owns all game logic: action dispatch,
  condition evaluation, effect application, event chains, timer, save/load, and
  the `getState()` snapshot. Zero knowledge of any specific game.
- **renderer.js** — generic DOM renderer. Reads the state snapshot from the
  engine and updates the UI. No game logic lives here.
- **schema.js** — content validator. Checks that a game JSON file matches the
  shape the engine understands. No game-specific identifiers or rules.

## Separation rule

No game-specific identifier (room id, item id, event id, flag name, theme
name, or any string that only makes sense for one game) may appear in
engine.js, renderer.js, or schema.js. These files must work unchanged for
every game.

## Adding new mechanics

New mechanics go into the engine as generic features (new condition type, new
effect type, or new action type). Never hard-code a specific game's behaviour.
If a mechanic is too narrow to be generic, implement it in the content file
through flags and effects instead.

## Games are pure JSON

A game is entirely defined by its `game.json` content file. No game-specific
JavaScript is needed or allowed. The three engine files plus a game.json are
sufficient to run any game.

## Top-level content keys (schema-enforced)

`meta`, `rooms`, `items`, `clues`, `hints`, `events`, `endings`,
`deductions`, `suspects`
