// js/ClipRippleDelete.js - Clip Ripple Delete Feature
// Deletes clips and automatically closes gaps in the timeline

export function createClipRippleDelete(services) {
    const {
        getTracksState,
        captureStateForUndoInternal,
        updateTimeline,
        renderTimeline,
        updateTransport
    } = services;

    function rippleDeleteClip(trackId, clipId) {
        const tracks = getTracksState();
        const track = tracks.find(t => t.id === trackId);
        if (!track || !track.clips) return;

        const clipIndex = track.clips.findIndex(c => c.id === clipId);
        if (clipIndex === -1) return;

        const deletedClip = track.clips[clipIndex];
        const deletedStartTime = deletedClip.startTime;
        const deletedEndTime = deletedClip.startTime + (deletedClip.duration || 0);

        captureStateForUndoInternal('Ripple delete clip');

        track.clips.splice(clipIndex, 1);

        for (let i = clipIndex; i < track.clips.length; i++) {
            const clip = track.clips[i];
            if (clip.startTime > deletedStartTime) {
                clip.startTime -= (deletedEndTime - deletedStartTime);
            }
        }

        if (typeof updateTimeline === 'function') updateTimeline();
        if (typeof renderTimeline === 'function') renderTimeline();
        if (typeof updateTransport === 'function') updateTransport();

        console.log(`[ClipRippleDelete] Ripple deleted clip ${clipId} from track ${trackId}`);
    }

    function rippleDeleteClips(trackId, clipIds) {
        const tracks = getTracksState();
        const track = tracks.find(t => t.id === trackId);
        if (!track || !track.clips) return;

        captureStateForUndoInternal(`Ripple delete ${clipIds.length} clips`);

        const clipsToDelete = track.clips.filter(c => clipIds.includes(c.id));
        let totalGapDuration = 0;

        clipsToDelete.sort((a, b) => a.startTime - b.startTime).forEach(clip => {
            totalGapDuration += clip.duration || 0;
        });

        track.clips = track.clips.filter(c => !clipIds.includes(c.id));

        track.clips.forEach(clip => {
            if (clip.startTime > clipsToDelete[0]?.startTime) {
                clip.startTime -= totalGapDuration;
            }
        });

        if (typeof updateTimeline === 'function') updateTimeline();
        if (typeof renderTimeline === 'function') renderTimeline();
    }

    function rippleDeleteSelectedClips(selectedClips) {
        if (!selectedClips || selectedClips.length === 0) return;

        const trackClipMap = {};
        selectedClips.forEach(({ trackId, clipId }) => {
            if (!trackClipMap[trackId]) trackClipMap[trackId] = [];
            trackClipMap[trackId].push(clipId);
        });

        Object.entries(trackClipMap).forEach(([trackId, clipIds]) => {
            rippleDeleteClips(trackId, clipIds);
        });
    }

    return {
        rippleDeleteClip,
        rippleDeleteClips,
        rippleDeleteSelectedClips
    };
}

export default { createClipRippleDelete };