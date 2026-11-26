# Specter Engine

> Kiroween 2026 submission by BrightShadow0 (solo entry).

- **Category:** Skeleton Crew
- **Demo video (YouTube, under 3 min):** [link]
- **App URL:** https://brightshadow0.github.io/Kiroween-26-BrightShadow/

## What it does

Specter Engine is a reusable puzzle-progression engine. Every game on it is defined as pure content in a single JSON game file: rooms, events, clues, unlock conditions, hints, timers and items. All game logic lives in the engine; a game file is data, never code.

To prove one skeleton can drive games that play nothing alike, it ships with two:

- **The Forgotten Temple** (`games/forgotten-temple.json`) - a timed survival escape. A visible 10-minute countdown runs while you combine ancient objects and work multi-step mechanisms across 4 linearly unlocking rooms. When the timer expires, the chamber resets.
- **Case Zero** (`games/case-zero.json`) - an untimed, branching detective investigation. Move freely between 4 locations, gather evidence, link related evidence into deductions on the evidence board, and accuse a suspect. 2 endings, no punishment for wrong guesses.

## How Kiro was used

Built with the Kiro CLI (v3) agent in a single one-shot session: the full spec (engine responsibilities, game file format, both games, separation tests) was given as one prompt and the agent generated the engine, both content files, the test suite and its own spec documents. The spec artifacts live in `.kiro/specs/specter-engine/` (requirements.md, design.md, tasks.md).

## Setup and run

No build step, no dependencies - it is a static site.

```bash
# serve locally
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open the live GitHub Pages deployment above.

Run the tests (also runnable in the browser via tests/tests.html):

```bash
node tests/tests.js
```

## Project structure

```
.kiro/              Kiro specs, steering and hooks (required, do not gitignore)
engine/             The engine: state machine (engine.js), generic UI (renderer.js), content validation (schema.js)
game.html           Generic player: loads a game file by ?game=<name> and runs it entirely through the engine
games/              Pure-content game files (JSON): forgotten-temple.json, case-zero.json
tests/              Schema validation, engine/game separation proofs, full-game walkthrough smoke tests (65 tests)
index.html          Landing page
LICENSE             MIT
```

## License

MIT - see LICENSE.
