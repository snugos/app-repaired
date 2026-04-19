# Snaw (snugos/snaw) — Comprehensive Bug & Issue Catalog
**Branch:** LWB-with-Bugs | **Last updated:** 2026-04-19

## Status: AUTOMATION ACTIVE 🤖

The Snaw Repair & Enhancement Agent runs every 15 minutes:
1. Checks for bugs (syntax + runtime)
2. Fixes any bugs found
3. If no bugs → adds a new feature or upgrade
4. Commits, pushes, verifies deployment

## Recently Fixed

| Commit | Fix |
|--------|-----|
| `dcd82bb` | Add missing closing braces in synthPresetsGlobal preset definitions (state.js:75) |
| `f30a86c` | Add missing DESKTOP_BG_TYPE_KEY and DESKTOP_BACKGROUND_KEY constants |
| `cfda329` | Prevent null effectNode crash in rebuildMasterEffectChain |
| `74df3dc` | Correct getIsReconstructingDAW typo (triple-g → double-g) |

---

## Timeline Ruler with Bar Numbers and Click-to-Seek (`js/ui.js`)

Added `renderTimelineRuler()` that draws bar numbers (1-16) and beat subdivision tick marks on the timeline ruler. Added `setupTimelineRulerSeek()` for click-to-seek — clicking anywhere on the ruler jumps the transport position to that bar. Also fixed the missing `#timeline-ruler` DOM element that was being queried but never existed in the template.

_Last scan: 2026-04-19 12:20 UTC — no new bugs detected._

## FX Effect Count Badge on Mixer Channel Strips (`js/ui.js`)

Added a red badge showing the number of active effects on each mixer track's FX button. The badge appears as a small red circle with a white count number in the top-right corner of the FX button. The FX button tooltip also now shows "Effects Rack (N effects)" when effects are present, or just "Effects Rack" when none are on the track.

The `effectCount` variable was already being computed but unused. The fix wires it into a styled badge and updates the button's title attribute dynamically.

---

## Dynamic Timeline Ruler Bar Count and 1/8 Note Subdivision (`js/ui.js`)

The timeline ruler now dynamically adjusts its bar count based on the loop region's end bar. Previously it was hardcoded to 16 bars, which caused misalignment when the loop region extended beyond 16 bars — the extra bars wouldn't have tick marks or labels. Now:

1. **Dynamic bar count**: `totalBars` is computed by reading `localAppServices.getLoopEndBars()`, falling back to 16 with a +4 padding for lookahead.
2. **1/8 note subdivision ticks**: Instead of only quarter-note beat marks (1/4), the ruler now shows 1/8 note ticks for finer visual guidance. Quarter-note positions (every 2 eighths) render taller (8px) ticks at `top:0`, while 1/8 note positions render shorter (4px) ticks at `top:4`. This creates a hierarchical beat indicator without cluttering the display.
3. **Consistent seek logic**: `setupTimelineRulerSeek()` now uses the same dynamic `totalBars` calculation as `renderTimelineRuler()` so click-to-seek positioning is consistent with the rendered bar labels.

_Last scan: 2026-04-19 08:25 UTC — no bugs detected. Added dynamic ruler feature._

