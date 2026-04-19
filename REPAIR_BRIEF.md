# Snaw (snugos/snaw) — Comprehensive Bug & Issue Catalog
**Branch:** LWB-with-Bugs | **Last updated:** 2026-04-19

## Status: ALL FIXED ✓

| Priority | Bug | File | Status |
|----------|-----|------|--------|
| 🔴 Critical | `getIsReconstructingingDAW` triple-g typo → always false | js/main.js | ✅ Fixed (triple-g → double-g) |
| 🔴 Critical | `rebuildMasterEffectChain` no null guard on `effectNode` | js/audio.js | ✅ Fixed (added null guard) |
| 🟠 High | Duplicate function definitions (dead code ~44KB) | js/ui.js | ✅ Fixed (removed dead block) |
| 🟠 High | `updateSequencerCellUI` uses undefined `j` | js/ui.js | ✅ Fixed |
| 🟡 Medium | `addToRecentlyPlayed` returns stale localStorage instead of in-memory state | js/state.js | ✅ Fixed |
| 🟡 Medium | `masterMeterNode.getValue()` wrong API (Tone.js) | js/main.js | ✅ Fixed (uses grain.getValue()) |
| 🟡 Medium | `trackAppServices` undefined in `addTrackToStateInternal` | js/state.js | ✅ Fixed |
| 🟡 Medium | `rebuildMasterEffectChain` early return drops entire chain | js/audio.js | ✅ Fixed |
| 🟢 Low | `contextSuspensionCount` incremented but never read for auto-resume | js/audio.js | ✅ Fixed |
| 🟢 Low | Video background restore: `bgDb` undefined | js/main.js | ✅ Fixed (removed dead path) |
| 🟢 Low | `Tone.context.resume()` called without checking state | js/audio.js | ✅ Fixed |
| 🟢 Low | `startContextSuspensionMonitoring` never auto-recovers | js/audio.js | ✅ Fixed (calls resume + setupMasterBus) |
| 🟢 Low | `patternPlayerSequence.stop()` on potentially null sequence | js/Track.js | ✅ Fixed (null check added) |
| 🟢 Low | `DESKTOP_BG_TYPE_KEY` undefined | js/main.js | ✅ Fixed (added constant) |
| 🟢 Low | `DESKTOP_BACKGROUND_KEY` undefined | js/main.js | ✅ Fixed (added constant) |

## Commit Log

| Commit | Fix |
|--------|-----|
| `2111f0b` | Remove dead video bg restore (bgDb undefined) + context.resume race fix |
| `588c01d` | stopPlayback null check + getArmedTrackId in trackAppServices + mousedown for pads |
| `febd68c` | Add missing DESKTOP_BG_TYPE_KEY and DESKTOP_BACKGROUND_KEY constants |
| `cfda329` | Prevent null effectNode crash in rebuildMasterEffectChain |
| `b130d5c` | Fix isReconstructinging typo in audio.js commonLoadSampleLogic |
| `db8b6c1` | Update REPAIR_BRIEF.md |
| `9e79e2e` | Remove stale Map entry on master effect recreation failure |
| `74df3dc` | Correct getIsReconstructingDAW typo (triple-g → double-g) |
| `ad368bd` | Fix SyntaxError: autoSaveNow shorthand |
| `98ad6c3` | Correct _isReconstructingingDAW_flag typo |

## Remaining Low-Priority Issues (documented, not critical)

- No automated test suite — code coverage unknown
- Error log (ERROR_LOG.md) still needs review for runtime-only issues
- No linting / formatting enforcement (no ESLint/Prettier config)

---

✅ **Monitoring mode active.** Last scan: 2026-04-19 07:20 UTC.

## Scanning for new issues...

Every scheduled run:
1. `git pull origin LWB-with-Bugs` — sync latest changes
2. `git diff HEAD~1` — check what changed
3. If JS files changed, audit for new bugs (undefined vars, early returns in loops, async issues)
4. If new bugs found, fix and push
5. Update REPAIR_BRIEF.md scan timestamp

### 2026-04-19 06:30 UTC
- **Bug found**: Extra closing braces `} } }` in synth preset default object literals in `loadSynthPresetsFromStorage()` — each preset entry had `} } },` instead of `} },`, causing the object to parse with zero keys on fresh load (users with no saved presets would see empty preset list). Fixed by removing the extra brace on all 4 default presets (Init Saw, Init Square, Init Sine, Init Triangle).
- Commit: `3e4382d`

