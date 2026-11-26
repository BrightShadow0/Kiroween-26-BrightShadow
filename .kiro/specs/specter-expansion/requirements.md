# Specter Engine — Expansion & Visual Rebuild (Round 2)

## Context
Playtest feedback on the one-shot build: temple too easy (blind spam wins),
timer too generous, text-log too small, panels jump around, combine text
duplicates, landing page bland, repo must follow the Skeleton Crew 2-folder
rule.

## References studied
- Escape Room: Strange Case 1 & 2 (Labeledman): item-on-object interactions,
  item combination, ordered sequence puzzles, dialogue gating, day/narrative beats.
- Trace (Coolmath): interconnected map, codes from environmental clues.
- Doors: Paradox: self-contained scenes, one exit door per scene, optional
  collectibles (gems), non-verbal environmental storytelling.
- Castle Claymount / Everytown / Mirror Room Escape (CrazyGames): scene imagery
  as the game board.
- Enigmap online escape rooms: story-first framing, clues hidden everywhere.
- "Making a Virtual Escape Room in 48 hours" (candlesan, Ludum Dare 52):
  layout before puzzles, puzzle variety per room, sequence puzzles.

## Requirements
1. Temple expands to 6-8 rooms with interlocked puzzle chains; exits stay
   locked until their chain is solved; wrong/premature actions cost time.
2. Timer re-timed to fit the new content and stay tense (chosen: 8 minutes).
3. Every room gets a generated scene image with diegetic hint elements baked
   in (murals, friezes, carvings that show, not tell).
4. Hints are environmental: the hint button highlights the relevant element in
   the room (description span + scene glow) and never reveals the answer.
   Engine feature; content declares `highlightText` per hint.
5. Every action's journal text is unique: combines read
   "Combining A and B, you obtained X"; insert/activate/unlock/pickup each
   have distinct wording.
6. Both games get distinct visual identities (temple ember-gold, noir blue-rain)
   with per-room scene imagery; panels keep dedicated fixed space.
7. Repo follows Skeleton Crew: exactly two self-contained app folders
   (/forgotten-temple, /case-zero), .kiro + LICENSE at root.
8. Landing page redesign: generated hero art, byline (Sheldon Menezes → GitHub
   + Devpost), richer layout.
9. Optional collectibles in the temple (3 relic shards), Doors: Paradox style.
10. All tests green in both app folders; visual verification in the browser.
