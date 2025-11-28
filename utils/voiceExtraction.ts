
/**
 * Extracts Voice IDs from the character list in the screenplay.
 * Expected format: "- CHARACTER NAME (Voice ID: <ID> ...)"
 * 
 * @param scriptText The full text of the screenplay.
 * @returns A map of character names to their Voice IDs.
 */
export const extractVoiceIdsFromScript = (scriptText: string): Record<string, string> => {
    const voiceIds: Record<string, string> = {};

    // Regex to match:
    // ^\s*-\s*       : Start of line, optional whitespace, dash, optional whitespace
    // ([A-Z0-9\s]+)  : Character name (uppercase letters, numbers, spaces) - Capture Group 1
    // \s*\(          : Optional whitespace, opening parenthesis
    // Voice ID:\s*   : Literal "Voice ID:", optional whitespace
    // ([a-zA-Z0-9]+) : Voice ID (alphanumeric) - Capture Group 2
    const regex = /^\s*-\s*([A-Z0-9\s]+?)\s*\(Voice ID:\s*([a-zA-Z0-9]+)/gm;

    let match;
    while ((match = regex.exec(scriptText)) !== null) {
        const characterName = match[1].trim();
        const voiceId = match[2].trim();

        if (characterName && voiceId) {
            voiceIds[characterName] = voiceId;
        }
    }

    return voiceIds;
};
