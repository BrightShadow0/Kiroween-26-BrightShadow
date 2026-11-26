# Specter Engine — Kiroween 2026 (Skeleton Crew)

A general puzzle-progression game engine plus two complete games built as pure
content on top of it. **Zero bespoke code per game**: every rule, room, item,
puzzle, hint and ending lives in a JSON content file the engine interprets.

## The two applications (Skeleton Crew layout)

| Folder | App | Kind |
| --- | --- | --- |
| `/forgotten-temple` | The Forgotten Temple | Timed escape room (8-minute countdown, wrong moves cost time) |
| `/case-zero` | Case Zero | Untimed detective game (4 locations, evidence board, 2 endings) |

Each folder is fully self-contained: `engine.js` + `renderer.js` + `schema.js`
(the Specter Engine), `game.html` (the player), `game.json` (all game content),
`tests.js` (node test suite), and `assets/scenes/` (per-room scene art).

## Run them

Everything is static. Either open the live site:

- Landing: https://brightshadow0.github.io/Kiroween-26-BrightShadow/
- Temple: https://brightshadow0.github.io/Kiroween-26-BrightShadow/forgotten-temple/game.html
- Case Zero: https://brightshadow0.github.io/Kiroween-26-BrightShadow/case-zero/game.html

or serve the repo locally (`npx serve .` or any static server) and open
`index.html` — pages fetch their JSON, so they need HTTP, not `file://`.

## Run the tests

```
cd forgotten-temple && node tests.js   # 67 tests
cd case-zero && node tests.js          # 62 tests
```

The suites include full playthroughs of both games driven entirely through the
engine's public API, proving the games never bypass the engine.

## Built with Kiro

Spec-driven development: see `/.kiro/specs/` for the engine spec and the
expansion spec (requirements, design, tasks). The engine, both content files,
the test suites and this layout were generated and refined in Kiro CLI
sessions from those specs.

Built by [Sheldon Menezes](https://github.com/BrightShadow0) ·
[Devpost](https://devpost.com/sheldonpmenezes)
