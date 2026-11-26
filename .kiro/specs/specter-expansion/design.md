# Design — Expansion & Visual Rebuild

## Engine additions (generic, content-agnostic)
- Conditions: allOf / anyOf / not composition.
- penaltySeconds on any failed action; meta.combineFailPenaltySeconds on
  failed combines. Timed games subtract from the countdown.
- Hints: content declares highlightText (a substring of the room description).
  The hint button wraps that span in .hint-flash and glows the scene header.
  Multiple hints per puzzle cycle. Answer text is never shown when a
  highlightText exists.
- meta.theme stamps data-theme on the root; CSS re-skins per game.
- room.sceneImage: generated art per room, rendered as the scene header with a
  scrim; SVG fallback kept. Images ship as local JS data-URI bundles
  (assets/scenes/*.js) — no hotlinks, no binary-asset pipeline needed.

## Temple content (7 rooms, ~25 required actions, 8:00 timer)
entrance-hall (hub; serpent lock: flint + torch→lit-torch)
→ gallery-of-idols (scales: sun→moon→star, mural shows order; reward: rope)
→ crypt (locked by scales; iron-hook + sacred-oil; Moon Shard)
→ collapsed-passage (cross chasm with climbing-line = rope+hook; cleaning-cloth)
→ mirror-chamber (locked by serpent lock; clean mirrors with cloth, then
  left→centre→right per frieze; bronze-key)
→ altar-room (light sconces with lit-torch; unlock gate with bronze-key;
  mural shows staff+disc+oil anointing)
→ reliquary (locked by altar-lit AND gate-open; insert anointed-staff =
  staff+sun-disc then +sacred-oil; activate needs mirrors solved; escape)
Optional: Sun/Moon/Star relic shards (collectibles).

## Case Zero
Unchanged logic; noir scene images, environmental hint highlights, readable
evidence cards, dedicated panel space.
