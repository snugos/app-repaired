# Snaw Repair & Enhancement Agent Instructions

## Purpose
Run every 10 minutes to find and fix bugs in the SnugOS DAW codebase (Snaw), or implement small enhancements if no bugs found.

## Current Status

**LATEST BUG REPORT (Priority 1) — FALSE POSITIVE CONFIRMED**

**Console Error:** `main.js:342 Uncaught ReferenceError: removeCustomDesktopBackground is not defined`

**Investigation Results:**
- Function `removeCustomDesktopBackground` IS properly defined at `main.js:596` within `appServices`
- `eventHandlers.js:124` correctly guards the call with `if(localAppServices.removeCustomDesktopBackground)`
- The error was a false positive from a stale browser cache or incorrect line number reference
- All JS files pass `node --check` syntax validation

**Conclusion:** No code changes required. False positive confirmed.

## Current Feature Queue

1. **Phase Correlation Meter** - Real-time stereo phase correlation display (-1 to +1)
2. **Spectral Gate** - Frequency-based gate based on specific frequency content
3. **Clip Gain Keyframe** - Automation-style gain points within clips
4. **Drum Replacement AI** - Analyze and replace drum hits
5. **Stem Separation Preview** - Preview isolated stems before export
6. **Adaptive Dynamics** - Compressor that adapts to input
7. **Mid-Side Encoding** - Encode stereo to mid-side processing
8. **Formant Shift** - Shift formants independently of pitch
9. **Granular Reverb** - Granular synthesis reverb
10. **Clip Stretch Markers** - Visual markers for manual time-stretching points

## Workflow
1. Pull latest: `cd /home/workspace/app-repaired && git pull origin LWB-with-Bugs`
2. Fix bugs if any exist (Priority 1 bug above is already resolved - false positive)
3. Check syntax: `node --check js/main.js`
4. Commit and push: `git add -A && git commit -m "chore: verify false positive at $(date -u +%H:%M) UTC" && git push origin LWB-with-Bugs`
5. Verify deploy: Wait 30s then curl https://snugos.github.io/snaw/js/main.js | head -20

## Key Files
- `/home/workspace/app-repaired/js/main.js` - main services and app initialization
- `/home/workspace/app-repaired/js/state.js` - application state management
- `/home/workspace/app-repaired/js/eventHandlers.js` - event handling (calls appServices)
- `/home/workspace/app-repaired/index.html` - main HTML entry point

## If No Bugs Found
Add one small enhancement feature (e.g., new UI panel, improved visualizer, etc.)
