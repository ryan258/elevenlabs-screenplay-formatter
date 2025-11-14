import { ProjectConfig } from '../types';

const demoScript = `Characters:
- NARRATOR
- ALEX
- JORDAN

INT. PODCAST STUDIO - DAY

NARRATOR
Welcome to the Future Frequencies show, broadcasting live from downtown.

ALEX
Jordan, you brought the AI-generated screenplay, right?

JORDAN
Of course. It's queued up and ready for ElevenLabs.

ALEX
Then let's fire it up and let the voices fly.
`;

export const demoProject: ProjectConfig = {
  version: '0.3.0',
  scriptText: demoScript,
  characterConfigs: {
    'NARRATOR': {
      voiceId: 'demo_voice_narrator',
      voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.2,
        speed: 1.0
      }
    },
    'ALEX': {
      voiceId: 'demo_voice_alex',
      voiceSettings: {
        stability: 0.4,
        similarity_boost: 0.7,
        style: 0.3,
        speed: 1.0
      }
    },
    'JORDAN': {
      voiceId: 'demo_voice_jordan',
      voiceSettings: {
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0.15,
        speed: 1.1
      }
    }
  },
  projectSettings: {
    model: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
    concatenate: true,
    speakParentheticals: false
  },
  voicePresets: {
    Narrator: {
      voiceId: 'demo_voice_narrator',
      voiceSettings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.2,
        speed: 1.0
      }
    },
    Host: {
      voiceId: 'demo_voice_alex',
      voiceSettings: {
        stability: 0.4,
        similarity_boost: 0.7,
        style: 0.3,
        speed: 1.0
      }
    }
  },
  metadata: {
    name: 'Future Frequencies Demo',
    description: 'A quick start project demonstrating presets and concatenation.'
  }
};
