import { describe, it, expect } from 'vitest';
import { extractVoiceIdsFromScript } from './voiceExtraction';

describe('extractVoiceIdsFromScript', () => {
    it('should extract voice IDs from a standard character list', () => {
        const script = `
Characters:
- CELESTE (Voice ID: 21m00Tcm4TlvDq8ikWAM - Rachel: opera singer)
- MAESTRO VINCENT (Voice ID: bVMeCyTHy58xNoL34h3p - Jeremy: conductor)
    `;
        const result = extractVoiceIdsFromScript(script);
        expect(result).toEqual({
            'CELESTE': '21m00Tcm4TlvDq8ikWAM',
            'MAESTRO VINCENT': 'bVMeCyTHy58xNoL34h3p'
        });
    });

    it('should handle multiple lines and extra whitespace', () => {
        const script = `
    - ARIA    (Voice ID: cgSgspJ2msm6clMCkdW9)
    - THOMAS (Voice ID: pNInz6obpgDQGcFmaJgB - Adam)
    `;
        const result = extractVoiceIdsFromScript(script);
        expect(result).toEqual({
            'ARIA': 'cgSgspJ2msm6clMCkdW9',
            'THOMAS': 'pNInz6obpgDQGcFmaJgB'
        });
    });

    it('should return an empty object if no voice IDs are found', () => {
        const script = `
    INT. ROOM - DAY
    JOHN
    Hello.
    `;
        const result = extractVoiceIdsFromScript(script);
        expect(result).toEqual({});
    });

    it('should handle character names with numbers', () => {
        const script = `
    - ROBOT 1 (Voice ID: 12345)
    `;
        const result = extractVoiceIdsFromScript(script);
        expect(result).toEqual({
            'ROBOT 1': '12345'
        });
    });
});
