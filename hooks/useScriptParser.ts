import { useMemo } from 'react';
import { DialogueChunk } from '../types';

interface DefinedCharacter {
    fullName: string;
    firstName: string;
}

const cleanDialogue = (text: string) => {
    // Remove parentheticals like (To himself) or stage directions in brackets like [Almost inaudible]
    // Then clean up whitespace.
    return text.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').replace(/\s+/g, ' ').trim();
};

export const useScriptParser = (scriptText: string): { characters: string[], dialogueChunks: DialogueChunk[] } => {
    return useMemo(() => {
        if (!scriptText) {
            return { characters: [], dialogueChunks: [] };
        }

        const lines = scriptText.split('\n');
        const chunks: DialogueChunk[] = [];
        const definedCharacters: DefinedCharacter[] = [];
        
        let currentCharacterFullName: string | null = null;
        let currentDialogue: string[] = [];
        
        type ParsingMode = 'metadata' | 'characterList' | 'scriptBody';
        let mode: ParsingMode = 'metadata';

        // Regexes
        const sceneHeadingRegex = /^(INT\.?|EXT\.?|I\/E\.?|SCENE \d+)|^\./i;
        const sameLineDialogueRegex = /^([A-Z0-9\s()'-]+):\s*(.*)/;

        const findCharacter = (name: string): DefinedCharacter | undefined => {
            const upperName = name.toUpperCase();
            return definedCharacters.find(c => c.firstName === upperName || c.fullName === upperName);
        };

        const flushDialogue = () => {
            if (currentCharacterFullName && currentDialogue.length > 0) {
                const text = cleanDialogue(currentDialogue.join(' '));
                if (text) {
                    chunks.push({ character: currentCharacterFullName, text });
                }
            }
            currentDialogue = [];
        };
        
        const parseScriptBodyLine = (trimmedLine: string) => {
             // Logic for handling lines within the script body
            if (!trimmedLine) {
                flushDialogue();
                currentCharacterFullName = null;
                return;
            }

            if (sceneHeadingRegex.test(trimmedLine)) {
                flushDialogue();
                currentCharacterFullName = null;
                return;
            }

            const sameLineMatch = trimmedLine.match(sameLineDialogueRegex);
            if (sameLineMatch) {
                const potentialCharacterName = sameLineMatch[1].trim();
                const dialoguePart = sameLineMatch[2];
                const foundCharacter = findCharacter(potentialCharacterName);

                if (foundCharacter) {
                    flushDialogue();
                    
                    const text = cleanDialogue(dialoguePart);
                    if (text) {
                        chunks.push({ character: foundCharacter.fullName, text });
                    }
                    currentCharacterFullName = null; // This was a one-liner
                    return;
                }
            }
            
            // Check for multi-line dialogue character name
            const foundCharacterForMultiLine = findCharacter(trimmedLine);
            if (foundCharacterForMultiLine) {
                 flushDialogue();
                 currentCharacterFullName = foundCharacterForMultiLine.fullName;
            } else if (currentCharacterFullName) {
                // This line is part of the ongoing dialogue
                currentDialogue.push(trimmedLine);
            } else {
                // Not a character name and not part of any dialogue, so flush just in case
                flushDialogue();
                currentCharacterFullName = null;
            }
        };

        for (const line of lines) {
            const trimmedLine = line.trim();

            if (mode === 'metadata') {
                if (trimmedLine.toLowerCase().startsWith('characters:')) {
                    mode = 'characterList';
                    continue;
                }
                if (sceneHeadingRegex.test(trimmedLine) || sameLineDialogueRegex.test(trimmedLine)) {
                    mode = 'scriptBody';
                    // Fall through to parse this line
                } else {
                    continue; // Skip metadata lines like title, author, etc.
                }
            }
            
            if (mode === 'characterList') {
                if (trimmedLine.startsWith('-')) {
                    const characterDef = trimmedLine.substring(1).trim();
                    
                    // Ignore decorative lines like '- --' or just '-' by ensuring there's an actual name.
                    if (!/[a-zA-Z]/.test(characterDef)) {
                        continue;
                    }

                    const openParenIndex = characterDef.indexOf('(');
                    const fullName = (openParenIndex !== -1 ? characterDef.substring(0, openParenIndex) : characterDef).trim().toUpperCase();
                    if (fullName) {
                        definedCharacters.push({
                            fullName,
                            firstName: fullName.split(' ')[0]
                        });
                    }
                    continue;
                } else if (trimmedLine !== '' && !trimmedLine.startsWith('-')) {
                     // This line is not a character def and not empty, so the list is over
                    mode = 'scriptBody';
                    // Fall through to parse this line
                } else {
                    continue; // It's a blank line, stay in characterList mode
                }
            }

            if (mode === 'scriptBody') {
                parseScriptBodyLine(trimmedLine);
            }
        }

        flushDialogue();
        
        const characterNames = definedCharacters.map(c => c.fullName).sort();

        return { characters: characterNames, dialogueChunks: chunks };
    }, [scriptText]);
};
