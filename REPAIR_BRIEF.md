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

