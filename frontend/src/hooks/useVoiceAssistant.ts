import { useState, useCallback, useEffect, useRef } from 'react';
import geminiLiveService, { LiveAssistantState } from '../services/geminiLiveService';

export enum AssistantState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  INTERRUPTED = 'INTERRUPTED',
  ERROR = 'ERROR',
}

export const useVoiceAssistant = (conversationId: string | null) => {
  const [state, setState] = useState<AssistantState>(AssistantState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string>('');

  const isCallActiveRef = useRef(false);

  // Map internal Live state to AssistantState enum
  const handleStateChange = useCallback((liveState: LiveAssistantState) => {
    switch (liveState) {
      case 'CONNECTING':
        setState(AssistantState.CONNECTING);
        break;
      case 'LISTENING':
        setState(AssistantState.LISTENING);
        break;
      case 'PROCESSING':
        setState(AssistantState.PROCESSING);
        break;
      case 'THINKING':
        setState(AssistantState.THINKING);
        break;
      case 'SPEAKING':
        setState(AssistantState.SPEAKING);
        break;
      case 'INTERRUPTED':
        setState(AssistantState.INTERRUPTED);
        break;
      case 'ERROR':
        setState(AssistantState.ERROR);
        break;
      case 'IDLE':
      default:
        setState(AssistantState.IDLE);
        break;
    }
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    console.error('[VoiceAssistant] Error:', errorMessage);
    setError(errorMessage);
    setState(AssistantState.ERROR);
  }, []);

  const handleTranscript = useCallback(
    (transcript: { role: 'USER' | 'ASSISTANT'; content: string; isComplete: boolean }) => {
      if (transcript.role === 'USER') {
        setRecognizedText(transcript.content);
      } else if (transcript.role === 'ASSISTANT') {
        setLastResponse(transcript.content);
      }
    },
    []
  );

  const handleInterrupted = useCallback(() => {
    console.log('[VoiceAssistant] Barge-in detected. Resetting assistant playback.');
    setState(AssistantState.LISTENING);
  }, []);

  /**
   * Start a real-time Gemini Live voice call
   */
  const startListening = useCallback(async () => {
    console.log('[VoiceAssistant] Starting Gemini Live voice call...');
    isCallActiveRef.current = true;
    setError(null);
    setRecognizedText('');
    setLastResponse(null);

    const success = await geminiLiveService.startSession(conversationId, {
      onStateChange: handleStateChange,
      onError: handleError,
      onTranscript: handleTranscript,
      onInterrupted: handleInterrupted,
    });

    if (!success) {
      isCallActiveRef.current = false;
    }
  }, [conversationId, handleStateChange, handleError, handleTranscript, handleInterrupted]);

  /**
   * Stop the active voice call cleanly
   */
  const stopListening = useCallback(async () => {
    console.log('[VoiceAssistant] Stopping Gemini Live voice call...');
    isCallActiveRef.current = false;
    await geminiLiveService.closeSession();
    setState(AssistantState.IDLE);
    setError(null);
  }, []);

  /**
   * Send a text message turn to the live session
   */
  const sendTextMessage = useCallback(async (message: string) => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;

    setRecognizedText(cleanMessage);
    geminiLiveService.sendTextMessage(cleanMessage);
  }, []);

  /**
   * Stop assistant speaking (manual interruption)
   */
  const stopSpeaking = useCallback(() => {
    console.log('[VoiceAssistant] Manual stopSpeaking called');
    geminiLiveService.stopSpeaking();
    if (isCallActiveRef.current) {
      setState(AssistantState.LISTENING);
    }
  }, []);

  // Clean up session when hook unmounts
  useEffect(() => {
    return () => {
      if (isCallActiveRef.current) {
        console.log('[VoiceAssistant] Unmounting: closing voice session');
        geminiLiveService.closeSession();
      }
    };
  }, []);

  return {
    state,
    error,
    lastResponse,
    recognizedText,
    startListening,
    stopListening,
    sendTextMessage,
    stopSpeaking,
  };
};