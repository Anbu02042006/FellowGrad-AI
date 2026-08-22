import {
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import Tts from 'react-native-tts';

import aiApi from '../services/api/aiApi';
import conversationApi from '../services/api/conversationApi';
import { useAuth } from '../context/AuthContext';

const { SpeechRecognizer } = NativeModules;

export enum AssistantState {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  THINKING = 'THINKING',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR',
}

export const useVoiceAssistant = (
  conversationId: string | null
) => {
  const { user } = useAuth();

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [state, setState] = useState<AssistantState>(
    AssistantState.IDLE
  );

  const [error, setError] = useState<string | null>(
    null
  );

  const [lastResponse, setLastResponse] =
    useState<string | null>(null);

  const [recognizedText, setRecognizedText] =
    useState<string>('');

  // --------------------------------------------------
  // REFS
  // --------------------------------------------------

  /**
   * True while the user has an active voice call.
   *
   * This is different from AssistantState.LISTENING.
   *
   * Example:
   *
   * CALL ACTIVE
   *      ↓
   * LISTENING
   *      ↓
   * THINKING
   *      ↓
   * SPEAKING
   *      ↓
   * LISTENING
   *
   * The call remains active during all of these states.
   */
  const isCallActiveRef = useRef(false);

  /**
   * Prevent duplicate speech results from creating
   * multiple AI requests.
   */
  const isProcessingRef = useRef(false);

  /**
   * Prevent multiple SpeechRecognizer.startListening()
   * calls at the same time.
   */
  const isStartingListeningRef = useRef(false);

  /**
   * Used to prevent old delayed restart timers from
   * starting recognition after the user ended the call.
   */
  const restartTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // --------------------------------------------------
  // CLEAR RESTART TIMER
  // --------------------------------------------------

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  // --------------------------------------------------
  // REQUEST MICROPHONE PERMISSION
  // --------------------------------------------------

  const requestPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      const granted =
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',

            message:
              'FellowGrad needs access to your microphone to hear you.',

            buttonNeutral: 'Ask Me Later',

            buttonNegative: 'Cancel',

            buttonPositive: 'OK',
          }
        );

      return (
        granted ===
        PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn(
        'Microphone permission error:',
        err
      );

      return false;
    }
  }, []);

  // --------------------------------------------------
  // START LISTENING
  // --------------------------------------------------

  const startNativeListening = useCallback(
    async () => {
      /**
       * Do nothing if the call has already ended.
       */
      if (!isCallActiveRef.current) {
        console.log(
          'Call is not active. Not starting speech recognition.'
        );

        return;
      }

      /**
       * Do not start another recognition session while
       * one is already being started.
       */
      if (isStartingListeningRef.current) {
        console.log(
          'Speech recognition start already in progress.'
        );

        return;
      }

      if (!SpeechRecognizer) {
        console.error(
          'SpeechRecognizer native module not found.'
        );

        setError(
          'Speech recognition is not available.'
        );

        setState(AssistantState.ERROR);

        return;
      }

      isStartingListeningRef.current = true;

      try {
        console.log(
          'Starting native speech recognition...'
        );

        setState(AssistantState.LISTENING);

        await SpeechRecognizer.startListening();

        console.log(
          'Native speech recognition started.'
        );
      } catch (err: any) {
        console.error(
          'Failed to start speech recognition:',
          err
        );

        /**
         * Don't show an error if the user already ended
         * the call while the recognizer was starting.
         */
        if (isCallActiveRef.current) {
          setError(
            err?.message ||
              'Unable to start speech recognition.'
          );

          setState(AssistantState.ERROR);
        }
      } finally {
        isStartingListeningRef.current = false;
      }
    },
    []
  );

  // --------------------------------------------------
  // RESTART LISTENING
  // --------------------------------------------------

  const restartListening = useCallback(() => {
    /**
     * If call is no longer active, don't restart.
     */
    if (!isCallActiveRef.current) {
      console.log(
        'Call ended. Not restarting speech recognition.'
      );

      return;
    }

    /**
     * Don't create multiple restart timers.
     */
    clearRestartTimer();

    console.log(
      'Scheduling speech recognition restart...'
    );

    restartTimerRef.current = setTimeout(
      async () => {
        restartTimerRef.current = null;

        if (!isCallActiveRef.current) {
          console.log(
            'Call ended before restart. Skipping.'
          );

          return;
        }

        await startNativeListening();
      },
      700
    );
  }, [
    clearRestartTimer,
    startNativeListening,
  ]);

  // --------------------------------------------------
  // PROCESS RECOGNIZED TEXT
  // --------------------------------------------------

  const processRecognizedText = useCallback(
    async (text: string) => {
      const cleanText = text.trim();

      // -----------------------------------------------
      // Empty text
      // -----------------------------------------------

      if (!cleanText) {
        console.log(
          'Empty speech result received.'
        );

        if (isCallActiveRef.current) {
          restartListening();
        }

        return;
      }

      // -----------------------------------------------
      // Prevent duplicate requests
      // -----------------------------------------------

      if (isProcessingRef.current) {
        console.log(
          'Already processing speech. Ignoring duplicate result.'
        );

        return;
      }

      // -----------------------------------------------
      // Check session
      // -----------------------------------------------

      if (!user || !conversationId) {
        console.error(
          'Voice assistant session is not initialized.'
        );

        setError('Session not initialized');

        setState(AssistantState.ERROR);

        return;
      }

      isProcessingRef.current = true;

      setRecognizedText(cleanText);

      setError(null);

      setState(AssistantState.THINKING);

      console.log(
        'Processing recognized text:',
        cleanText
      );

      try {
        // ---------------------------------------------
        // 1. Save USER message
        // ---------------------------------------------

        await conversationApi.sendMessage(
          conversationId,
          {
            role: 'USER',
            content: cleanText,
            messageType: 'TEXT',
          }
        );

        console.log(
          'User message saved.'
        );

        // ---------------------------------------------
        // 2. Send message to AI
        // ---------------------------------------------

        const aiResponse =
          await aiApi.chat({
            userId: user.userId,
            conversationId,
            message: cleanText,
          });

        const reply =
          aiResponse.data.reply;

        console.log(
          'AI response:',
          reply
        );

        setLastResponse(reply);

        // ---------------------------------------------
        // 3. Save ASSISTANT message
        // ---------------------------------------------

        await conversationApi.sendMessage(
          conversationId,
          {
            role: 'ASSISTANT',
            content: reply,
            messageType: 'TEXT',
          }
        );

        console.log(
          'AI message saved.'
        );

        // ---------------------------------------------
        // 4. Speak AI response
        // ---------------------------------------------

        setState(
          AssistantState.SPEAKING
        );

        console.log(
          'Starting Android TTS...'
        );

        /**
         * Stop any previous TTS before speaking.
         */
        Tts.stop();

        /**
         * Android TTS speaks the AI response.
         */
        Tts.speak(reply);

        /**
         * IMPORTANT:
         *
         * We DO NOT start listening here.
         *
         * We wait for:
         *
         *     tts-finish
         *
         * and then restart SpeechRecognizer.
         */
      } catch (e: any) {
        console.error(
          'Voice assistant processing error:',
          e
        );

        const message =
          e?.response?.data?.message ||
          e?.message ||
          'Something went wrong.';

        setError(message);

        setState(
          AssistantState.ERROR
        );

        /**
         * If the call is still active, try listening
         * again after the error.
         */
        if (isCallActiveRef.current) {
          restartListening();
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      user,
      conversationId,
      restartListening,
    ]
  );

  // --------------------------------------------------
  // INITIALIZE TTS + SPEECH EVENTS
  // --------------------------------------------------

  useEffect(() => {
    // ==================================================
    // TTS INITIALIZATION
    // ==================================================

    Tts.getInitStatus()
      .then(() => {
        console.log(
          'TTS initialized.'
        );

        Tts.setDefaultLanguage(
          'en-US'
        );

        Tts.setDefaultRate(0.5);
      })
      .catch((err) => {
        console.error(
          'TTS initialization error:',
          err
        );
      });

    // ==================================================
    // TTS FINISHED
    // ==================================================

    const finishListener =
      Tts.addListener(
        'tts-finish',
        () => {
          console.log(
            'TTS finished.'
          );

          setState(
            AssistantState.IDLE
          );

          /**
           * IMPORTANT:
           *
           * If the call is still active,
           * start listening for the next user
           * message.
           */
          if (
            isCallActiveRef.current
          ) {
            console.log(
              'Call still active. Restarting microphone...'
            );

            restartListening();
          }
        }
      );

    // ==================================================
    // TTS CANCELLED
    // ==================================================

    const cancelListener =
      Tts.addListener(
        'tts-cancel',
        () => {
          console.log(
            'TTS cancelled.'
          );

          /**
           * If the call is active, listen again.
           *
           * If the user ended the call,
           * don't restart.
           */
          if (
            isCallActiveRef.current
          ) {
            restartListening();
          } else {
            setState(
              AssistantState.IDLE
            );
          }
        }
      );

    // ==================================================
    // TTS ERROR
    // ==================================================

    const ttsErrorListener =
      Tts.addListener(
        'tts-error',
        (event) => {
          console.error(
            'TTS error:',
            event
          );

          setError(
            'TTS error occurred'
          );

          setState(
            AssistantState.ERROR
          );

          /**
           * Try listening again if
           * call is still active.
           */
          if (
            isCallActiveRef.current
          ) {
            restartListening();
          }
        }
      );

    // ==================================================
    // SPEECH RECOGNIZER READY
    // ==================================================

    const readyListener =
      DeviceEventEmitter.addListener(
        'SpeechRecognizerReady',
        () => {
          console.log(
            'Speech recognizer ready.'
          );

          if (
            isCallActiveRef.current
          ) {
            setState(
              AssistantState.LISTENING
            );
          }
        }
      );

    // ==================================================
    // SPEECH BEGINNING
    // ==================================================

    const beginningListener =
      DeviceEventEmitter.addListener(
        'SpeechRecognizerBeginning',
        () => {
          console.log(
            'Speech started.'
          );

          if (
            isCallActiveRef.current
          ) {
            setState(
              AssistantState.LISTENING
            );
          }
        }
      );

    // ==================================================
    // PARTIAL SPEECH RESULT
    // ==================================================

    const partialResultListener =
      DeviceEventEmitter.addListener(
        'SpeechRecognizerPartialResult',
        (event) => {
          const text =
            event?.text;

          if (text) {
            console.log(
              'Partial speech:',
              text
            );

            setRecognizedText(
              text
            );
          }
        }
      );

    // ==================================================
    // FINAL SPEECH RESULT
    // ==================================================

    const resultListener =
      DeviceEventEmitter.addListener(
        'SpeechRecognizerResult',
        async (event) => {
          const text =
            event?.text?.trim();

          console.log(
            'Final speech result:',
            text
          );

          /**
           * Ignore results after the call
           * has been ended.
           */
          if (
            !isCallActiveRef.current
          ) {
            console.log(
              'Call is inactive. Ignoring speech result.'
            );

            return;
          }

          if (!text) {
            console.log(
              'Empty final speech result.'
            );

            restartListening();

            return;
          }

          setRecognizedText(
            text
          );

          await processRecognizedText(
            text
          );
        }
      );

    // ==================================================
    // SPEECH ERROR
    // ==================================================

    const speechErrorListener =
      DeviceEventEmitter.addListener(
        'SpeechRecognizerError',
        (event) => {
          const errorCode =
            event?.error;

          console.error(
            'Speech recognition error:',
            errorCode
          );

          /**
           * If user ended the call,
           * don't restart recognition.
           */
          if (
            !isCallActiveRef.current
          ) {
            return;
          }

          /**
           * Don't permanently enter ERROR state
           * for normal Android recognition lifecycle
           * errors.
           */
          setError(
            'Speech recognition interrupted. Listening again...'
          );

          /**
           * Retry automatically.
           */
          restartListening();
        }
      );

    // ==================================================
    // SPEECH END
    // ==================================================

    const endListener =
      DeviceEventEmitter.addListener(
        'SpeechRecognizerEnd',
        () => {
          console.log(
            'Speech ended.'
          );

          /**
           * IMPORTANT:
           *
           * SpeechRecognizerEnd does NOT mean
           * the CALL ended.
           *
           * It only means the current speech
           * recognition session ended.
           *
           * We wait for SpeechRecognizerResult
           * and AI/TTS processing before restarting.
           */
        }
      );

    // ==================================================
    // CLEANUP
    // ==================================================

    return () => {
      console.log(
        'Cleaning up voice assistant.'
      );

      /**
       * Stop all automatic restarting.
       */
      isCallActiveRef.current =
        false;

      isProcessingRef.current =
        false;

      isStartingListeningRef.current =
        false;

      clearRestartTimer();

      // Remove TTS listeners
      finishListener.remove();
      cancelListener.remove();
      ttsErrorListener.remove();

      // Remove SpeechRecognizer listeners
      readyListener.remove();
      beginningListener.remove();
      partialResultListener.remove();
      resultListener.remove();
      speechErrorListener.remove();
      endListener.remove();

      // Stop TTS
      Tts.stop();

      // Stop native SpeechRecognizer
      try {
        SpeechRecognizer?.cancelListening();
      } catch (err) {
        console.log(
          'Speech recognizer cleanup:',
          err
        );
      }
    };
  }, [
    processRecognizedText,
    restartListening,
    clearRestartTimer,
  ]);

  // --------------------------------------------------
  // START CALL / LISTENING
  // --------------------------------------------------

  const startListening =
    useCallback(async () => {
      console.log(
        'Starting voice call...'
      );

      /**
       * Mark call as ACTIVE.
       */
      isCallActiveRef.current =
        true;

      /**
       * Reset processing state.
       */
      isProcessingRef.current =
        false;

      clearRestartTimer();

      setError(null);

      setRecognizedText('');

      setLastResponse(null);

      // -----------------------------------------------
      // Permission
      // -----------------------------------------------

      const hasPermission =
        await requestPermission();

      if (!hasPermission) {
        console.error(
          'Microphone permission denied.'
        );

        isCallActiveRef.current =
          false;

        setError(
          'Microphone permission denied'
        );

        setState(
          AssistantState.ERROR
        );

        return;
      }

      // -----------------------------------------------
      // Native module
      // -----------------------------------------------

      if (!SpeechRecognizer) {
        console.error(
          'SpeechRecognizer native module not found.'
        );

        isCallActiveRef.current =
          false;

        setError(
          'Speech recognition is not available.'
        );

        setState(
          AssistantState.ERROR
        );

        return;
      }

      // -----------------------------------------------
      // Start recognition
      // -----------------------------------------------

      await startNativeListening();
    }, [
      requestPermission,
      startNativeListening,
      clearRestartTimer,
    ]);

  // --------------------------------------------------
  // STOP CALL
  // --------------------------------------------------

  const stopListening =
    useCallback(async () => {
      console.log(
        'Stopping voice call...'
      );

      /**
       * IMPORTANT:
       *
       * Set this FIRST.
       *
       * Otherwise a pending TTS finish event
       * could restart the microphone.
       */
      isCallActiveRef.current =
        false;

      isProcessingRef.current =
        false;

      isStartingListeningRef.current =
        false;

      clearRestartTimer();

      // -----------------------------------------------
      // Stop native SpeechRecognizer
      // -----------------------------------------------

      try {
        if (SpeechRecognizer) {
          await SpeechRecognizer.cancelListening();
        }
      } catch (err) {
        console.error(
          'Failed to stop speech recognition:',
          err
        );
      }

      // -----------------------------------------------
      // Stop TTS
      // -----------------------------------------------

      try {
        Tts.stop();
      } catch (err) {
        console.error(
          'Failed to stop TTS:',
          err
        );
      }

      setState(
        AssistantState.IDLE
      );

      setError(null);

      console.log(
        'Voice call stopped.'
      );
    }, [
      clearRestartTimer,
    ]);

  // --------------------------------------------------
  // SEND TEXT MESSAGE
  // --------------------------------------------------

  const sendTextMessage =
    useCallback(
      async (message: string) => {
        if (!user || !conversationId) {
          setError(
            'Session not initialized'
          );

          return;
        }

        const cleanMessage =
          message.trim();

        if (!cleanMessage) {
          return;
        }

        setRecognizedText(
          cleanMessage
        );

        await processRecognizedText(
          cleanMessage
        );
      },
      [
        user,
        conversationId,
        processRecognizedText,
      ]
    );

  // --------------------------------------------------
  // STOP SPEAKING
  // --------------------------------------------------

  const stopSpeaking =
    useCallback(() => {
      console.log(
        'Stopping TTS...'
      );

      Tts.stop();

      /**
       * If the call is still active,
       * the tts-cancel listener will restart
       * speech recognition.
       *
       * If the call isn't active,
       * it will simply remain IDLE.
       */
    }, []);

  // --------------------------------------------------
  // RETURN
  // --------------------------------------------------

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