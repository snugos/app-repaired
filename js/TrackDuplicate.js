// TrackDuplicate.js - Duplicate tracks with all clips, effects, and settings
(function() {
    'use strict';

    function duplicateTrack(trackId, newName) {
        const tracks = getTracksState();
        const sourceTrack = tracks.find(t => t.id === trackId);
        if (!sourceTrack) {
            console.warn('TrackDuplicate: Source track not found:', trackId);
            return null;
        }

        const newTrack = JSON.parse(JSON.stringify(sourceTrack));
        newTrack.id = generateId();
        newTrack.name = newName || (sourceTrack.name + ' Copy');
        newTrack.clips = newTrack.clips.map(clip => ({...clip, id: generateId()}));

        if (newTrack.effects && Array.isArray(newTrack.effects)) {
            newTrack.effects = newTrack.effects.map(effect => ({...effect, id: generateId()}));
        }

        tracks.push(newTrack);
        renderTracks();
        saveState();

        console.log('TrackDuplicate: Duplicated track', sourceTrack.name, '->', newTrack.name);
        return newTrack;
    }

    window.duplicateTrack = duplicateTrack;
    window.duplicateCurrentTrack = () => {
        const selected = getSelectedTrackId();
        if (selected) duplicateTrack(selected);
    };

    console.log('[TrackDuplicate] Loaded - Use duplicateTrack(trackId) or duplicateCurrentTrack()');
})();