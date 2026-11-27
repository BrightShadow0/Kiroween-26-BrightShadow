# Specter Engine — Testing Rules

## Test suites

Two Node.js suites cover the engine, schema, and both games:

```
cd forgotten-temple && node tests.js   # 72 tests
cd case-zero        && node tests.js   # 67 tests
```

Total: **139 tests**.

## When to run

Run both suites after any change to:

- `forgotten-temple/engine.js` or `case-zero/engine.js`
- `forgotten-temple/schema.js` or `case-zero/schema.js`
- `forgotten-temple/renderer.js` or `case-zero/renderer.js`
- `forgotten-temple/game.json` or `case-zero/game.json`

All 139 tests must pass before pushing.

## What the suites cover

Each suite includes:
- Unit tests for every condition type, effect type, and action type.
- Full engine-API playthroughs of the game (start → puzzle chain → ending).
- Schema validation: valid content passes, invalid content is rejected with
  the correct error messages.
- Edge cases: locked room entry, failed combine penalties, timer reset,
  save/load round-trip.

## Adding new features

Every new engine feature (condition type, effect type, action type) requires
new tests covering both the happy path and the failure path. Add them to both
suites or to whichever game exercises the new feature.
