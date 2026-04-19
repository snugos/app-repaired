# Snaw / app-repaired — Comprehensive Bug & Issue Catalog

**Repo:** `snugos/snaw` (was `snugos/app-repaired`)  
**Branch:** `LWB-with-Bugs`  
**Live:** https://snugos.github.io/app/  
**Tech:** Vanilla JS + Tone.js, static site (GitHub Pages)

---

## 🔴 CRITICAL (breaks core functionality)

### 1. `getIsReconstructingingDAW` typo cascade — STILL BROKEN
**Files:** `js/main.js` lines 194, 214, 252

The function `getIsReconstructingDAW()` is defined correctly at line 290, but all THREE callers use the misspelled name `getIsReconstructingingDAW` (triple "g"). This means master effect add/remove/reorder operations ALWAYS bypass the undo check and corrupt the undo stack.

```js
// Line 194 — BROKEN
const isReconstructing = appServices.getIsReconstructingingDAW ? ...  // ❌ triple "g" — undefined

// Line 214 — BROKEN  
const isReconstructing = appServices.getIsReconstructingDAW ? appServices.getIsReconstructingingDAW() : false; // ❌ mixed

// Line 252 — BROKEN
const isReconstructinging = appServices.getIsReconstructingingDAW ? ...  // ❌ triple "g" — undefined
```

**Fix:** Replace all 3 occurrences with `getIsReconstructingDAW` (double "g").

---

### 2. `updateSequencerCellUI` undefined `j` variable — STILL BROKEN
**File:** `js/ui.js` line ~2660

The AGENTS.md claims this was fixed in Day 48, but the function signature is:
```js
export function updateSequencerCellUI(windowElement, trackType, row, col, isActive, velocity = 0.7)
```
There is no `j` variable anywhere in the function body (lines 2660–2704). The function looks clean. **This bug may have been already fixed** — need to verify against live deployment.

---

### 3. `rebuildMasterEffectChain` early return — CLAIMED FIXED
**File:** `js/audio.js` line ~150–210

The AGENTS.md claims Day 48 fixed early `return` in forEach. Checking the code:
```js
} else {
    console.error(`[Audio rebuildMasterEffectChain] Failed to recreate master effect node... Skipping but continuing...`);
    currentAudioPathEnd = null; // Mark chain as needing bypass
}
// No return statement — falls through ✓
```
**This appears to be fixed.** However, `activeMasterEffectNodes.delete(effectState.id)` is NOT called when recreation fails, leaving stale entries.

**✅ FIXED in snaw-repair-1:** Added `activeMasterEffectNodes.delete(effectState.id)` in the recreation-failed branch.

---

## 🟠 HIGH PRIORITY (significant functional impact)

### 4. Duplicate function definitions in ui.js — UNRESOLVED
**File:** `js/ui.js`

Two complete sets of nearly identical functions:
- `buildSynthSpecificInspectorDOM` — lines 291 AND 603 (identical copies)
- `initializeSynthSpecificControls` — lines 447 AND 759 (identical copies)
- `buildSamplerSpecificInspectorDOM` — lines 314 AND 626 (near-identical)
- `initializeSamplerSpecificControls` — lines 522 AND 834 (near-identical)
- `buildInstrumentSamplerSpecificInspectorDOM` — lines 341 AND 653 (identical)
- `buildDrumSamplerSpecificInspectorDOM` — lines 378 AND 690 (identical)

Total: ~600 lines of dead duplicate code. Both copies are actively referenced by `buildTrackInspectorContentDOM` depending on which code path runs. The second copy (lines 603+) may be leftover from a past merge conflict.

**Fix:** Delete the second set (lines 603–900ish) after auditing all references.

---

### 5. `getSoloedTrackIdState()` missing — UNRESOLVED
**File:** `js/state.js`

This function is referenced throughout `state.js`, `main.js`, and `Track.js` but never defined. The variable `soloedTrackId` in state is referenced via `getSoloedTrackIdState()` but no such export exists. The AGENTS.md claims it was fixed (Day 8), but it still appears to be missing.

**Fix:** Add `getSoloedTrackIdState: () => soloedTrackId` to state.js exports.

---

### 6. `getRecentlyPlayedSounds()` localStorage reload bug — UNRESOLVED
**File:** `js/state.js`

On every call, it does `recentlyPlayed = JSON.parse(localStorage.getItem(...))` which reloads from disk, discarding the in-memory array that `addToRecentlyPlayed()` just updated. After previewing sounds, the Recent tab shows stale/out-of-order data.

**Fix:** Only load from localStorage once on init; mutations should update the in-memory array and persist to localStorage.

---

## 🟡 MEDIUM PRIORITY

### 7. Netlify artifacts conflict with GitHub Pages
**File:** `.netlify/` directory

The repo has `.netlify/internal/edge-functions/` with an ESzip file, but the README says deployment is via GitHub Pages. This is confusing and could cause accidental Netlify deploys.

**Fix:** Either remove `.netlify/` or update README to clarify the deployment story.

---

### 8. `addMasterEffectToAudio` error handling incomplete
**File:** `js/main.js`

When `createEffectInstance` fails in `addMasterEffectToAudio`, the state has already been updated (`addMasterEffectToState` called first), but the audio node was never created. This leaves the state in an inconsistent position.

**Fix:** Wrap in a try/catch that calls `removeMasterEffectFromState` on failure.

---

### 9. `activeMasterEffectNodes` stale entries on recreation failure
**File:** `js/audio.js` — `rebuildMasterEffectChain`

When `createEffectInstance` fails, the code sets `currentAudioPathEnd = null` but does NOT call `activeMasterEffectNodes.delete(effectState.id)`. The Map keeps a stale disposed/undefined entry.

**Fix:** Add `activeMasterEffectNodes.delete(effectState.id)` in the recreation-failed branch.

**✅ FIXED in snaw-repair-1:** Added `activeMasterEffectNodes.delete(effectState.id)` in the recreation-failed branch.

---

### 10. `handleCustomBackgroundUpload` has no error handling
**File:** `js/main.js`

If the background upload fails (e.g., invalid file type), no notification is shown to the user.

---

## 🟢 LOWER PRIORITY / TECHNICAL DEBT

### 11. `.netlify` path still present in repo
The `.netlify/` directory and `.gitignore` entry suggest Netlify was once configured. Should be cleaned up or documented.

---

### 12. `index.html` and `tetris.html` 
Both files are standalone HTML games that don't integrate with the main DAW. `tetris.html` appears to be a completely unrelated game. Clarify whether these should be in the repo.

---

### 13. Icon files are duplicated
`apple-icon.png`, `apple-icon-precomposed.png`, `ms-icon-*.png`, `android-icon-*.png` — these are manifest icons that could be served from a CDN or generated.

---

### 14. No automated tests
The AGENTS.md itself lists "No automated tests" as a known issue. For a project of this complexity, a basic test suite (even just Playwright smoke tests) would prevent regressions.

---

## 📋 AUTOMATION GAMEPLAN

**Frequency:** Run repair automation multiple times per day (every 4–6 hours)

**Per-run checklist:**
1. Pull latest from `origin/LWB-with-Bugs`
2. Run code quality scan (grep for known bug patterns)
3. Attempt fixes for the above catalog items (prioritized)
4. Run `git diff` to verify changes are surgical
5. Commit with message: `fix: <brief description> [snaw-repair-N]`
6. Push to `origin/LWB-with-Bugs`
7. Report what was fixed in this run

**Files to target (in priority order):**
1. `js/main.js` — triple-g typo (3 line changes)
2. `js/state.js` — missing `getSoloedTrackIdState`, localStorage bug
3. `js/ui.js` — duplicate function definitions (~600 lines to review)
4. `js/audio.js` — stale Map entries, error handling gaps
5. `.netlify/` — clean up or document
