import { describe, expect, it } from 'vitest';
import { parseScript } from './useScriptParser';

describe('parseScript', () => {
  it('parses multi-line dialogue blocks with declared characters', () => {
    const sample = `
Characters:
- JOHN SMITH
- SARAH

INT. ROOM - DAY

JOHN SMITH
This is line one.
And this is line two.

SARAH: Inline reply handled here.
`;

    const result = parseScript(sample);
    expect(result.characters).toEqual(['JOHN SMITH', 'SARAH']);
    expect(result.dialogueChunks).toHaveLength(2);
    expect(result.dialogueChunks[0]).toEqual({
      character: 'JOHN SMITH',
      text: 'This is line one. And this is line two.',
      originalText: 'This is line one. And this is line two.'
    });
    expect(result.dialogueChunks[1]).toEqual({
      character: 'SARAH',
      text: 'Inline reply handled here.',
      originalText: 'Inline reply handled here.'
    });
  });

  it('matches inline alias variations and strips parentheticals', () => {
    const sample = `
Characters:
- DETECTIVE SARAH MILLER

DETECTIVE MILLER: Alias detection works.
SARAH: First name works.
SARAH (V.O.): Parenthetical names are handled.
`;

    const result = parseScript(sample);
    expect(result.dialogueChunks).toHaveLength(3);
    expect(result.dialogueChunks.map(chunk => chunk.character)).toEqual([
      'DETECTIVE SARAH MILLER',
      'DETECTIVE SARAH MILLER',
      'DETECTIVE SARAH MILLER'
    ]);
  });

  it('handles mixed inline and block dialogue', () => {
    const sample = `
Characters:
- NARRATOR
- LUKE
- MARIA

NARRATOR: Once upon a time...

LUKE
We have to turn back.

MARIA: Not yet!
`;

    const result = parseScript(sample);
    expect(result.dialogueChunks).toHaveLength(3);
    expect(result.dialogueChunks[0].character).toBe('NARRATOR');
    expect(result.dialogueChunks[1].character).toBe('LUKE');
    expect(result.dialogueChunks[2].character).toBe('MARIA');
  });
});
