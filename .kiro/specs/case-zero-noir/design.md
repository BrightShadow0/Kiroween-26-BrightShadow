# Design — Case Zero Noir Upgrade

## Scene art
- Regenerate ONLY riverside-manor: a rain-soaked noir study interior at night,
  blue-shadow palette matching the other three scenes, with the overturned
  desk and smashed decanter clearly visible in frame. 1024x576 JPEG,
  compressed to <140KB, embedded as a data-URI JS bundle at
  case-zero/assets/scenes/noir-riverside-manor.js (same
  window.SPECTER_SCENES pattern as the existing bundles; the registry key
  'assets/scenes/noir-riverside-manor.jpg' stays unchanged).
- office / docks / cafe scenes stay: they already match their descriptions and
  show their hint elements (corkboard, harbormaster's shack, booths+counter).

## Content (case-zero/game.json only)
- Rewrite the four room descriptions in fuller noir voice (2-4 sentences
  each). Constraints: keep every existing hint's highlightText as an exact
  substring; keep room ids, names, exits, items, events untouched.
- The office has no event, so add one in content: event id "office-start",
  name "Review the Case Board", one step, no condition, a flavor effect
  message. Register it in the office room's events list. Then add hint
  id "hint-office-start", forPuzzle "office-start" - the hint button attaches
  to events automatically. highlightText must come from the office
  description (current phrase to preserve: "A corkboard on the wall holds
  everything you have so far").
- Every hint keeps the philosophy: environmental highlight, never the answer.

## HTML fix (both games)
- forgotten-temple/game.html and case-zero/game.html: back link href becomes
  ../index.html.

## Verification
- cd case-zero && node tests.js; cd forgotten-temple && node tests.js — all green.
- Manual: each Case Zero location shows its scene; each 💡 Hint press flashes
  the description span and glows the scene; back link reaches the landing page.
