import { DialogueChunk, ParserDiagnostics } from '../types';

interface DefinedCharacter {
  fullName: string;
  aliases: Set<string>;
}

const cleanDialogue = (text: string) => {
  return text.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
};

const normalizeCharacterName = (value: string) => {
  return value
    .replace(/\([^)]*\)/g, '')
    .replace(/\bCONT'D\b/gi, '')
    .replace(/[^A-Z0-9\s'"-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
};

const generateAliases = (fullName: string) => {
  const aliases = new Set<string>();
  const tokens = fullName.split(' ').filter(Boolean);

  if (!tokens.length) {
    return aliases;
  }

  const addAlias = (parts: string[]) => {
    if (parts.length) {
      aliases.add(parts.join(' '));
    }
  };

  addAlias(tokens);
  tokens.forEach(token => addAlias([token]));

  for (let start = 0; start < tokens.length; start++) {
    for (let end = start + 1; end < tokens.length; end++) {
      addAlias(tokens.slice(start, end + 1));
    }
  }

  if (tokens.length >= 2) {
    addAlias([tokens[0], tokens[tokens.length - 1]]);
  }

  return aliases;
};

export interface ParsedScript {
  characters: string[];
  dialogueChunks: DialogueChunk[];
  diagnostics: ParserDiagnostics;
}

export const parseScript = (scriptText: string): ParsedScript => {
  if (!scriptText) {
    return { characters: [], dialogueChunks: [], diagnostics: { unmatchedLines: [] } };
  }

  const lines = scriptText.split('\n');
  const chunks: DialogueChunk[] = [];
  const definedCharacters: DefinedCharacter[] = [];
  const aliasMap = new Map<string, DefinedCharacter>();
  const fullNameMap = new Map<string, DefinedCharacter>();
  const unmatchedLines: ParserDiagnostics['unmatchedLines'] = [];

  const sceneHeadingRegex = /^(INT\.?|EXT\.?|I\/E\.?|SCENE \d+|EST\.|INT\/EXT\.?|\.)/i;
  const transitionRegex = /(CUT TO:|FADE (IN|OUT)|SMASH CUT|MATCH CUT|DISSOLVE TO:|IRIS OUT|WIPE TO:)/i;
  const sameLineDialogueRegex = /^([A-Z0-9\s()."'-]+):\s*(.*)/;
  const uppercaseCharacterRegex = /^[A-Z][A-Z0-9\s.'"()-]*$/;

  const addCharacter = (fullName: string): DefinedCharacter => {
    const existing = fullNameMap.get(fullName);
    if (existing) {
      return existing;
    }
    const newCharacter: DefinedCharacter = {
      fullName,
      aliases: generateAliases(fullName)
    };
    definedCharacters.push(newCharacter);
    fullNameMap.set(fullName, newCharacter);
    newCharacter.aliases.forEach(alias => aliasMap.set(alias, newCharacter));
    return newCharacter;
  };

  const findCharacter = (name: string) => {
    const normalized = normalizeCharacterName(name);
    if (!normalized) {
      return undefined;
    }
    return aliasMap.get(normalized);
  };

  const registerCharacter = (rawName: string): DefinedCharacter | undefined => {
    const fullName = normalizeCharacterName(rawName);
    if (!fullName) {
      return undefined;
    }
    return addCharacter(fullName);
  };

  let currentCharacterFullName: string | null = null;
  let currentDialogue: string[] = [];

  const flushDialogue = () => {
    if (currentCharacterFullName && currentDialogue.length > 0) {
      const raw = currentDialogue.join(' ').trim();
      const text = cleanDialogue(raw);
      if (text) {
        chunks.push({ character: currentCharacterFullName, text, originalText: raw });
      }
    }
    currentDialogue = [];
  };

  type ParsingMode = 'metadata' | 'characterList' | 'scriptBody';
  let mode: ParsingMode = 'metadata';

  const recordUnmatched = (lineNumber: number, content: string) => {
    if (content.trim()) {
      unmatchedLines.push({ lineNumber, content });
    }
  };

  const parseScriptBodyLine = (trimmedLine: string, lineNumber: number) => {
    if (!trimmedLine) {
      flushDialogue();
      currentCharacterFullName = null;
      return;
    }

    if (sceneHeadingRegex.test(trimmedLine) || transitionRegex.test(trimmedLine)) {
      flushDialogue();
      currentCharacterFullName = null;
      return;
    }

    const sameLineMatch = trimmedLine.match(sameLineDialogueRegex);
    if (sameLineMatch) {
      const potentialCharacterName = sameLineMatch[1].trim();
      const dialoguePart = sameLineMatch[2];
      let foundCharacter = findCharacter(potentialCharacterName);
      if (!foundCharacter && uppercaseCharacterRegex.test(potentialCharacterName)) {
        foundCharacter = registerCharacter(potentialCharacterName);
      }

      if (foundCharacter) {
        flushDialogue();
        const rawLine = dialoguePart.trim();
        const text = cleanDialogue(rawLine);
        if (text) {
          chunks.push({ character: foundCharacter.fullName, text, originalText: rawLine });
        }
        currentCharacterFullName = null;
        return;
      }
    }

    let foundCharacterForMultiLine = findCharacter(trimmedLine);
    if (!foundCharacterForMultiLine && uppercaseCharacterRegex.test(trimmedLine)) {
      foundCharacterForMultiLine = registerCharacter(trimmedLine);
    }
    if (foundCharacterForMultiLine) {
      flushDialogue();
      currentCharacterFullName = foundCharacterForMultiLine.fullName;
    } else if (currentCharacterFullName) {
      currentDialogue.push(trimmedLine);
    } else {
      flushDialogue();
      currentCharacterFullName = null;
      recordUnmatched(lineNumber, trimmedLine);
    }
  };

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = lines[index];
    const trimmedLine = line.trim();

    if (mode === 'metadata') {
      if (trimmedLine.toLowerCase().startsWith('characters:')) {
        mode = 'characterList';
        continue;
      }
      if (sceneHeadingRegex.test(trimmedLine) || sameLineDialogueRegex.test(trimmedLine)) {
        mode = 'scriptBody';
      } else {
        continue;
      }
    }

    if (mode === 'characterList') {
      if (trimmedLine.startsWith('-')) {
        const characterDef = trimmedLine.substring(1).trim();
        if (!/[a-zA-Z]/.test(characterDef)) {
          continue;
        }
        const openParenIndex = characterDef.indexOf('(');
        const rawName = openParenIndex !== -1 ? characterDef.substring(0, openParenIndex) : characterDef;
        const fullName = normalizeCharacterName(rawName);
        if (fullName) {
          addCharacter(fullName);
        }
        continue;
      } else if (trimmedLine !== '' && !trimmedLine.startsWith('-')) {
        mode = 'scriptBody';
      } else {
        continue;
      }
    }

    if (mode === 'scriptBody') {
      parseScriptBodyLine(trimmedLine, lineNumber);
    }
  }

  flushDialogue();
  const characterNames = definedCharacters.map(c => c.fullName).sort();

  return {
    characters: characterNames,
    dialogueChunks: chunks,
    diagnostics: { unmatchedLines }
  };
};
