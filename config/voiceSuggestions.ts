import { VoiceSettings } from '../types';

export interface LanguageOption {
  code: string;
  label: string;
}

export interface VoiceSuggestion {
  name: string;
  voiceId: string;
  description: string;
  voiceSettings?: VoiceSettings;
}

export interface RoleSuggestion {
  role: string;
  description: string;
  voices: VoiceSuggestion[];
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' }
];

const defaultVoiceSettings: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.1,
  speed: 1
};

const createSuggestion = (name: string, voiceId: string, description: string, voiceSettings?: Partial<VoiceSettings>): VoiceSuggestion => ({
  name,
  voiceId,
  description,
  voiceSettings: voiceSettings ? { ...defaultVoiceSettings, ...voiceSettings } : defaultVoiceSettings
});

export const ROLE_SUGGESTIONS: Record<string, RoleSuggestion[]> = {
  en: [
    {
      role: 'Narrator',
      description: 'Warm, clear narration for descriptive lines and stage directions.',
      voices: [
        createSuggestion('Adam', 'pNInz6obpgDQGcFmaJgB', 'Deep and authoritative.'),
        createSuggestion('Rachel', '21m00Tcm4TlvDq8ikWAM', 'Empathetic female narration.')
      ]
    },
    {
      role: 'Hero',
      description: 'Energetic protagonists or optimistic leads.',
      voices: [
        createSuggestion('Josh', 'TxGEqnHWrfWFTfGW9XjX', 'Younger male hero.'),
        createSuggestion('Gigi', 'jBpfuIE2acCO8z3wKNLl', 'Spirited female lead.', { stability: 0.45, style: 0.2 })
      ]
    },
    {
      role: 'Villain',
      description: 'Antagonists, cosmic horrors, or intense monologues.',
      voices: [
        createSuggestion('Daniel', 'onwK4e9ZLuTAKqWW03F9', 'Commanding lower register.'),
        createSuggestion('Domi', 'AZnzlk1XvdvUeBnXmlld', 'Poised antagonist tone.', { stability: 0.65 })
      ]
    }
  ],
  es: [
    {
      role: 'Narrador',
      description: 'Narración clara en español.',
      voices: [
        createSuggestion('Clara (español)', 'EXAVITQu4vr4xnSDxMaL', 'Narración suave para descripciones.', { speed: 0.95 }),
        createSuggestion('Antoni (español)', 'ErXwobaYiN019PkySvjV', 'Narración masculina neutra.')
      ]
    },
    {
      role: 'Héroe',
      description: 'Personajes principales y protagonistas optimistas.',
      voices: [
        createSuggestion('Ethan', 'g5CIjZEefAph4nQFvHAz', 'Tono juvenil adaptable.'),
        createSuggestion('Bella', 'EXAVITQu4vr4xnSDxMaL', 'Heroína cálida.', { stability: 0.4 })
      ]
    }
  ],
  fr: [
    {
      role: 'Narrateur',
      description: 'Narration française neutre pour scènes descriptives.',
      voices: [
        createSuggestion('Aria', '9BWtsMINqrJLrRacOk9x', 'Narration claire.', { speed: 0.95 }),
        createSuggestion('George (FR)', 'JBFqnCBsd6RMkjVDRZzb', 'Narrateur masculin posé.')
      ]
    },
    {
      role: 'Antagoniste',
      description: 'Voix profondes pour rôles mystérieux.',
      voices: [
        createSuggestion('Callum (FR)', 'N2lVS1w4EtoT3dr4eOWO', 'Accents européens bien articulés.')
      ]
    }
  ],
  de: [
    {
      role: 'Stimme',
      description: 'Empfohlene Stimmen für klare deutsche Dialoge.',
      voices: [
        createSuggestion('Charlotte', 'XB0fDUnXU5powFXDhCwa', 'Erzählung oder Mentor.', { speed: 0.9 }),
        createSuggestion('Liam', 'TX3LPaxmHKxFdv7VOQHJ', 'Neutrale männliche Stimme.')
      ]
    }
  ],
  ja: [
    {
      role: '語り手',
      description: 'ナレーションや説明文に適した優しい声。',
      voices: [
        createSuggestion('Serena', 'pMsXgVXv3BLzUgSXRplE', '柔らかな語り。', { speed: 0.9 }),
        createSuggestion('Elli', 'MF3mGyEYCl7XYWbV9V6O', '若い女性主人公にも最適。', { stability: 0.4 })
      ]
    }
  ]
};
