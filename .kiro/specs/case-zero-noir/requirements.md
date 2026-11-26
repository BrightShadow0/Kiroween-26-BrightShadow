# Case Zero — Noir Visual Upgrade (Round 3)

## Context
Round 2 gave The Forgotten Temple generated scene art with diegetic hint
elements baked in (murals, friezes, carvings that show, not tell). Case Zero
has noir scene art, but one scene mismatches its description, hint coverage is
incomplete, and the copy is thinner than the temple's. This round raises Case
Zero to the temple's quality bar, plus leftover polish from the reference
study and two live-site fixes.

## References carried forward
- Doors: Paradox / Castle Claymount: the scene image IS the game board; every
  interactive element should be visible in it.
- Enigmap: clues hidden everywhere; environmental storytelling over exposition.
- Strange Case 1 & 2: narrative beats delivered through the environment
  (the phone that rings twice, the decanter that was smashed).

## Requirements
1. riverside-manor scene image must depict the STUDY INTERIOR described in the
   room text (overturned desk, smashed decanter, rain at the window), not an
   exterior. The hint elements must be visible in the art, temple-mural style.
2. All four Case Zero room descriptions rewritten to full noir voice, each
   weaving its hint elements into the prose as environmental detail. Existing
   highlightText substrings must survive verbatim inside the new text (the
   hint highlight mechanism depends on exact matches).
3. Add a fourth hint so every location has hint coverage (the office/start
   currently has none). Same rules: highlightText from the description, glow
   the scene, never reveal the answer.
4. Fix the "All Games" back link in BOTH game.html files: href="index.html"
   resolves to a 404 inside the app folders; it must point at ../index.html.
5. Engine/content separation stays absolute: this round is content + assets +
   one HTML attribute. No engine.js/renderer.js/schema.js logic changes unless
   a genuinely generic gap appears (none is expected).
6. Both test suites stay green (case-zero 62, forgotten-temple 67). If new
   content breaks a test, update the test expectation only where the content
   contract legitimately changed.
