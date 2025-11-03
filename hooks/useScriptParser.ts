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

const emotionTagRegex = /\[(.*?)\]/g; // Regex to find [EMOTION] tags

export const useScriptParser = (scriptText: string): { characters: string[], dialogueChunks: DialogueChunk[] } => {
    return useMemo(() => {
        if (!scriptText) {
            return { characters: [], dialogueChunks: [] };
        }

        const lines = scriptText.split('\n');
        const chunks: DialogueChunk[] = [];
        const definedCharacters: DefinedCharacter[] = [];
        const potentialCharacters = new Set<string>();
        
        let currentCharacterFullName: string | null = null;
        let currentDialogue: string[] = [];
        let currentEmotion: string | undefined = undefined;
        
        type ParsingMode = 'metadata' | 'characterList' | 'scriptBody';
        let mode: ParsingMode = 'metadata';

        // Regexes
        const sceneHeadingRegex = /^(INT\.?|EXT\.?|I\/E\.?|SCENE \d+)|^\./i;
        const sameLineDialogueRegex = /^([A-Z0-9\s()'-]+):\s*(.*)/;
        const characterNameRegex = /^[A-Z0-9\s()'-]+$/;
        const transitionRegex = /^(CUT TO:|FADE OUT\.|SMASH TO:|DISSOLVE TO:)/i;

        const findCharacter = (name: string): DefinedCharacter | undefined => {
            const upperName = name.toUpperCase();
            // Try exact match first
            let found = definedCharacters.find(c => c.fullName === upperName);
            if (found) return found;

            // Try matching by first name
            found = definedCharacters.find(c => c.firstName === upperName.split(' ')[0]);
            if (found) return found;

            // Try matching by full name ignoring parentheticals (e.g., JOHN (V.O.))
            const cleanedUpperName = upperName.replace(/\([^)]+\)/g, '').trim();
            found = definedCharacters.find(c => c.fullName.replace(/\([^)]+\)/g, '').trim() === cleanedUpperName);
            if (found) return found;

            return undefined;
        };

        const flushDialogue = () => {
            if (currentCharacterFullName && currentDialogue.length > 0) {
                let text = currentDialogue.join(' ');
                let emotion: string | undefined;

                const emotionMatch = text.match(emotionTagRegex);
                if (emotionMatch) {
                    emotion = emotionMatch[1]; // Capture the content inside the brackets
                    text = text.replace(emotionTagRegex, '').trim(); // Remove the tag from the text
                }

                text = cleanDialogue(text);
                if (text) {
                    chunks.push({ character: currentCharacterFullName, text, emotion });
                }
            }
            currentDialogue = [];
            currentEmotion = undefined;
        };
        
        const parseScriptBodyLine = (trimmedLine: string) => {
             // Logic for handling lines within the script body
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

            // Check for parenthetical
            if (trimmedLine.startsWith('(') && trimmedLine.endsWith(')')) {
                if (currentCharacterFullName) {
                    currentDialogue.push(trimmedLine);
                }
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
                    currentCharacterFullName = foundCharacter.fullName; // Keep character for potential multi-line dialogue
                    return;
                } else if (characterNameRegex.test(potentialCharacterName)) {
                    // Dynamically add character if not found but matches character name pattern
                    potentialCharacters.add(potentialCharacterName.toUpperCase());
                    flushDialogue();
                    const text = cleanDialogue(dialoguePart);
                    if (text) {
                        chunks.push({ character: potentialCharacterName.toUpperCase(), text });
                    }
                    currentCharacterFullName = potentialCharacterName.toUpperCase();
                    return;
                }
            }
            
            // Check for multi-line dialogue character name
            const foundCharacterForMultiLine = findCharacter(trimmedLine);
            if (foundCharacterForMultiLine) {
                 flushDialogue();
                 currentCharacterFullName = foundCharacterForMultiLine.fullName;
            } else if (characterNameRegex.test(trimmedLine) && trimmedLine.toUpperCase() === trimmedLine) {
                // Dynamically add character if not found but matches character name pattern (all caps)
                potentialCharacters.add(trimmedLine.toUpperCase());
                flushDialogue();
                currentCharacterFullName = trimmedLine.toUpperCase();
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
                if (sceneHeadingRegex.test(trimmedLine) || sameLineDialogueRegex.test(trimmedLine) || characterNameRegex.test(trimmedLine) || transitionRegex.test(trimmedLine)) {
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
                        potentialCharacters.add(fullName);
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
        
        // Combine explicitly defined characters with dynamically found ones
        const allCharacters = Array.from(new Set([...definedCharacters.map(c => c.fullName), ...Array.from(potentialCharacters)]));
        const characterNames = allCharacters.sort();

        return { characters: characterNames, dialogueChunks: chunks };
    }, [scriptText]);
};
