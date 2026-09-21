/**
 * Supported Gemini Live Prebuilt Voices for FellowGrad AI
 * Powered by Google Gemini 2.5 Live Native-Audio API.
 */

export interface VoiceOption {
  id: string; // Gemini prebuilt voiceName: 'Puck' | 'Charon' | 'Aoede' | 'Kore'
  label: string; // User-facing title: 'Male Voice 1', 'Male Voice 2', etc.
  name: string; // Prebuilt voice identifier
  gender: 'male' | 'female';
  icon: string; // Display emoji
  subtitle: string; // Secondary description
  description: string; // Full natural tone description
  isDefault?: boolean;
}

export const VOICES: VoiceOption[] = [
  {
    id: 'Puck',
    label: 'Puck',
    name: 'Puck',
    gender: 'male',
    icon: '✨',
    subtitle: 'Upbeat & energetic',
    description: 'Upbeat & energetic tone for active discussions',
  },
  {
    id: 'Charon',
    label: 'Charon',
    name: 'Charon',
    gender: 'male',
    icon: '🎙️',
    subtitle: 'Deep & calm',
    description: 'Deep, calm & reassuring tone for steady focus',
  },
  {
    id: 'Aoede',
    label: 'Aoede',
    name: 'Aoede',
    gender: 'female',
    icon: '🌸',
    subtitle: 'Natural & conversational',
    description: 'Natural & conversational tone (Default)',
    isDefault: true,
  },
  {
    id: 'Kore',
    label: 'Kore',
    name: 'Kore',
    gender: 'female',
    icon: '💫',
    subtitle: 'Warm & articulate',
    description: 'Warm, articulate & confident tone',
  },
];

export const DEFAULT_VOICE_ID = 'Aoede';
export const VOICE_STORAGE_KEY = '@fellowgrad_selected_voice';
