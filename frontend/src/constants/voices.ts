/**
 * Supported Gemini Live Prebuilt Voices for FellowGrad AI
 * Powered by Google Gemini 2.5 Live Native-Audio API.
 */

export interface VoiceOption {
  id: string; // Gemini technical prebuilt voiceName: 'Aoede' | 'Kore' | 'Puck' | 'Charon'
  displayName: string; // User-facing identity name: 'Nila' | 'Yazhi' | 'Viyan' | 'Aran'
  label: string; // Compatible with existing UI components
  name: string; // Prebuilt voice identifier
  gender: 'male' | 'female';
  icon: string; // Display emoji
  subtitle: string; // Secondary description
  description: string; // Full natural tone description
  isDefault?: boolean;
}

export const VOICES: VoiceOption[] = [
  {
    id: 'Aoede',
    displayName: 'Nila',
    label: 'Nila',
    name: 'Aoede',
    gender: 'female',
    icon: '🌙',
    subtitle: 'Natural & conversational',
    description: 'Natural & conversational tone (Default)',
    isDefault: true,
  },
  {
    id: 'Kore',
    displayName: 'Yazhi',
    label: 'Yazhi',
    name: 'Kore',
    gender: 'female',
    icon: '🎵',
    subtitle: 'Warm & articulate',
    description: 'Warm, articulate & confident tone',
  },
  {
    id: 'Puck',
    displayName: 'Viyan',
    label: 'Viyan',
    name: 'Puck',
    gender: 'male',
    icon: '🚀',
    subtitle: 'Upbeat & energetic',
    description: 'Upbeat & energetic tone for active discussions',
  },
  {
    id: 'Charon',
    displayName: 'Aran',
    label: 'Aran',
    name: 'Charon',
    gender: 'male',
    icon: '🧠',
    subtitle: 'Deep & calm',
    description: 'Deep, calm & reassuring tone for steady focus',
  },
];

export const DEFAULT_VOICE_ID = 'Aoede';
export const VOICE_STORAGE_KEY = '@fellowgrad_selected_voice';
