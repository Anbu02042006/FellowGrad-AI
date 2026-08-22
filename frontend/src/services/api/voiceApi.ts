import apiClient from './apiClient';

export interface TextToSpeechRequest {
  text: string;
}

const voiceApi = {
  stt: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    return apiClient.post('/api/voice/speech-to-text', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  tts: (data: TextToSpeechRequest) =>
    apiClient.post('/api/voice/text-to-speech', data, {
      responseType: 'arraybuffer',
    }),
};

export default voiceApi;
