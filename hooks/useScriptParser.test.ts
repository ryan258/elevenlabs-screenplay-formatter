/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScriptParser } from './useScriptParser';

describe('useScriptParser', () => {
  it('should return empty arrays for empty scriptText', () => {
    const { result } = renderHook(() => useScriptParser(''));
    expect(result.current.characters).toEqual([]);
    expect(result.current.dialogueChunks).toEqual([]);
  });

  it('should parse a simple script with defined characters', () => {
    const script = `Characters:
- JOHN
- JANE

INT. ROOM - DAY

JOHN
Hello, Jane.

JANE
Hello, John.
`;
    const { result } = renderHook(() => useScriptParser(script));
    expect(result.current.characters).toEqual(['JANE', 'JOHN']);
    expect(result.current.dialogueChunks).toEqual([
      expect.objectContaining({ character: 'JOHN', text: 'Hello, Jane.', originalText: 'Hello, Jane.' }),
      expect.objectContaining({ character: 'JANE', text: 'Hello, John.', originalText: 'Hello, John.' }),
    ]);
  });

  it('should dynamically detect characters not in the list', () => {
    const script = `INT. ROOM - DAY

ALEX
Hi there.
`;
    const { result } = renderHook(() => useScriptParser(script));
    expect(result.current.characters).toEqual(['ALEX']);
    expect(result.current.dialogueChunks).toEqual([
      expect.objectContaining({ character: 'ALEX', text: 'Hi there.', originalText: 'Hi there.' }),
    ]);
  });

  it('should handle parentheticals and stage directions', () => {
    const script = `Characters:
- JOHN

INT. ROOM - DAY

JOHN (V.O.)
(sadly)
This is a test. [He sighs].
`;
    const { result } = renderHook(() => useScriptParser(script));
    expect(result.current.characters).toEqual(['JOHN']);
    expect(result.current.dialogueChunks).toEqual([
      expect.objectContaining({ character: 'JOHN', text: 'This is a test.', originalText: '(sadly) This is a test. [He sighs].' }),
    ]);
  });

  it('should handle same-line dialogue', () => {
    const script = `Characters:
- JOHN

INT. ROOM - DAY

JOHN: This is a test.
`;
    const { result } = renderHook(() => useScriptParser(script));
    expect(result.current.characters).toEqual(['JOHN']);
    expect(result.current.dialogueChunks).toEqual([
      expect.objectContaining({ character: 'JOHN', text: 'This is a test.', originalText: 'This is a test.' }),
    ]);
  });

  it('should handle multi-line dialogue', () => {
    const script = `Characters:
- JOHN

INT. ROOM - DAY

JOHN
This is the first line.
This is the second line.
`;
    const { result } = renderHook(() => useScriptParser(script));
    expect(result.current.characters).toEqual(['JOHN']);
    expect(result.current.dialogueChunks).toEqual([
      expect.objectContaining({ character: 'JOHN', text: 'This is the first line. This is the second line.', originalText: 'This is the first line. This is the second line.' }),
    ]);
  });

  it('should extract emotion tags', () => {
    const script = `Characters:
- JOHN

INT. ROOM - DAY

JOHN
[EXCITED] Hello there!
`;
    const { result } = renderHook(() => useScriptParser(script));
    expect(result.current.characters).toEqual(['JOHN']);
    expect(result.current.dialogueChunks).toEqual([
      expect.objectContaining({ character: 'JOHN', text: 'Hello there!', originalText: '[EXCITED] Hello there!', emotion: 'EXCITED' }),
    ]);
  });
});
