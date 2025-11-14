import { ManifestEntry } from '../types';

const seconds = (ms?: number) => ((ms ?? 0) / 1000).toFixed(6);

const escapeName = (value: string) => value.replace(/"/g, "'");

const buildItem = (entry: ManifestEntry) => {
  const start = entry.startTimeMs ?? 0;
  const end = entry.endTimeMs ?? (start + entry.estimatedDurationMs);
  const length = Math.max(0.001, (end - start) / 1000);
  return [
    '    <ITEM',
    `      POSITION ${seconds(start)}`,
    `      LENGTH ${length.toFixed(6)}`,
    '      MUTE 0',
    '      SEL 0',
    `      NAME "${escapeName(entry.character)} - ${escapeName(entry.filename)}"`,
    '      SOFFS 0.000000',
    '      PLAYRATE 1.000000',
    '      SOURCETIME 0.000000',
    '      FADEIN 0 0 0 0 0 0',
    '      FADEOUT 0 0 0 0 0 0',
    '      SNAPOFFS 0.000000',
    '      LOOP 0',
    '      ALLTAKES 0',
    '      <TAKE',
    '        NAME ""',
    '        MUTE 0',
    '        PAN 0.000000',
    '        VOL 1.000000',
    '        PITCH 0.000000',
    '        PLAYRATE 1.000000',
    '        SOFFS 0.000000',
    '        STARTOFFS 0.000000',
    '        SEL 1',
    `        <SOURCE WAV`,
    `          FILE "${escapeName(entry.filename)}"`,
    '        >',
    '      >',
    '    >'
  ].join('\n');
};

export const buildReaperProject = (entries: ManifestEntry[], projectName = 'ElevenLabs Session') => {
  const tracks = new Map<string, ManifestEntry[]>();
  entries.forEach(entry => {
    const key = entry.character || 'Dialogue';
    if (!tracks.has(key)) {
      tracks.set(key, []);
    }
    tracks.get(key)?.push(entry);
  });

  const trackBlocks = Array.from(tracks.entries()).map(([character, items]) => {
    const sorted = [...items].sort((a, b) => (a.startTimeMs ?? 0) - (b.startTimeMs ?? 0));
    const itemBlocks = sorted.map(buildItem).join('\n');
    return [
      '  <TRACK',
      '    MUTE 0',
      '    SOLO 0',
      '    VOLPAN 1.000000 0.000000 -1.000000 -1.000000 1',
      `    NAME "${escapeName(character)}"`,
      '    PEAKCOL 16576',
      '    <ITEMS',
      itemBlocks,
      '    >',
      '  >'
    ].join('\n');
  }).join('\n');

  return [
    `<REAPER_PROJECT 0.1 "6.0/x64" 0`,
    `  NAME "${escapeName(projectName)}"`,
    '  RIPPLE 0',
    '  GROUPOVERRIDE 0 0 0',
    '  AUTOXFADE 1',
    '  ENVATTACH 1',
    '  PROJOFFS 0 0 0',
    '  PLAYRATE 1 0 0.25 4',
    '  SELECTION 0 0',
    '  SEQSEL 0 0',
    trackBlocks,
    '>'
  ].join('\n');
};
