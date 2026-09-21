import apiClient from './apiClient';

export interface TextToSpeechRequest {
  text: string;
}

export interface LiveSessionResponse {
  success: boolean;
  sessionId: string;
  sessionToken: string;
  wsEndpoint: string;
  model: string;
  audioConfig: {
    inputSampleRate: number;
    inputChannels: number;
    outputSampleRate: number;
    outputChannels: number;
  };
  profileLoaded: boolean;
}

export interface LiveHealthResponse {
  success: boolean;
  service: string;
  configured: boolean;
  model: string;
  project: string;
}

const voiceApi = {
  /**
   * Provision a short-lived Gemini Live session (Active voice pipeline)
   * POST /api/voice/live/session
   */
  createLiveSession: (conversationId?: string | null) =>
    apiClient.post<LiveSessionResponse>('/api/voice/live/session', {
      conversationId: conversationId || undefined,
    }),

  /**
   * Gemini Live health check
   * GET /api/voice/live/health
   */
  getLiveHealth: () =>
    apiClient.get<LiveHealthResponse>('/api/voice/live/health'),

  /**
   * Legacy REST STT
   * @deprecated
   */
  stt: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    return apiClient.post('/api/voice/speech-to-text', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Legacy REST TTS
   * @deprecated
   */
  tts: (data: TextToSpeechRequest) =>
    apiClient.post('/api/voice/text-to-speech', data, {
      responseType: 'arraybuffer',
    }),
};

export default voiceApi;
