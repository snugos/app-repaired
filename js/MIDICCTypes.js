// js/MIDICCTypes.js - MIDI CC Number Definitions
// Standard MIDI CC numbers with names for the CC Step Sequencer

export const MIDICC_LIST = [
    { number: 0, name: 'Bank Select MSB', category: 'control' },
    { number: 1, name: 'Modulation Wheel', category: 'expression' },
    { number: 2, name: 'Breath Controller', category: 'expression' },
    { number: 4, name: 'Foot Controller', category: 'control' },
    { number: 5, name: 'Portamento Time', category: 'time' },
    { number: 6, name: 'Data Entry MSB', category: 'control' },
    { number: 7, name: 'Channel Volume', category: 'volume' },
    { number: 8, name: 'Balance', category: 'pan' },
    { number: 10, name: 'Pan', category: 'pan' },
    { number: 11, name: 'Expression', category: 'expression' },
    { number: 12, name: 'Effect Control 1', category: 'fx' },
    { number: 13, name: 'Effect Control 2', category: 'fx' },
    { number: 64, name: 'Sustain Pedal', category: 'control' },
    { number: 65, name: 'Portamento On/Off', category: 'control' },
    { number: 66, name: 'Sostenuto', category: 'control' },
    { number: 67, name: 'Soft Pedal', category: 'control' },
    { number: 68, name: 'Legato Footswitch', category: 'control' },
    { number: 69, name: 'Hold 2', category: 'control' },
    { number: 70, name: 'Sound Controller 1', category: 'sound' },
    { number: 71, name: 'Sound Controller 2', category: 'sound' },
    { number: 72, name: 'Sound Controller 3', category: 'sound' },
    { number: 73, name: 'Sound Controller 4', category: 'sound' },
    { number: 74, name: 'Sound Controller 5 (Brightness)', category: 'sound' },
    { number: 75, name: 'Sound Controller 6', category: 'sound' },
    { number: 76, name: 'Sound Controller 7', category: 'sound' },
    { number: 77, name: 'Sound Controller 8', category: 'sound' },
    { number: 78, name: 'Sound Controller 9', category: 'sound' },
    { number: 79, name: 'Sound Controller 10', category: 'sound' },
    { number: 80, name: 'General Purpose CC1', category: 'control' },
    { number: 81, name: 'General Purpose CC2', category: 'control' },
    { number: 82, name: 'General Purpose CC3', category: 'control' },
    { number: 83, name: 'General Purpose CC4', category: 'control' },
    { number: 91, name: 'Reverb Level', category: 'fx' },
    { number: 92, name: 'Tremolo Depth', category: 'fx' },
    { number: 93, name: 'Chorus Level', category: 'fx' },
    { number: 94, name: 'Celeste (Detune)', category: 'fx' },
    { number: 95, name: 'Phaser Depth', category: 'fx' },
    { number: 96, name: 'Data Increment', category: 'control' },
    { number: 97, name: 'Data Decrement', category: 'control' },
    { number: 98, name: 'Non-Registered Parameter', category: 'control' },
    { number: 99, name: 'Non-Registered Parameter', category: 'control' },
    { number: 100, name: 'Registered Parameter', category: 'control' },
    { number: 101, name: 'Registered Parameter', category: 'control' },
    { number: 120, name: 'All Sound Off', category: 'control' },
    { number: 121, name: 'Reset All Controllers', category: 'control' },
    { number: 123, name: 'All Notes Off', category: 'control' }
];

export function getMIDICCList() {
    return MIDICC_LIST;
}

export function getCCName(ccNumber) {
    const cc = MIDICC_LIST.find(c => c.number === ccNumber);
    return cc ? cc.name : `CC#${ccNumber}`;
}

export function getCCsByCategory(category) {
    return MIDICC_LIST.filter(c => c.category === category);
}