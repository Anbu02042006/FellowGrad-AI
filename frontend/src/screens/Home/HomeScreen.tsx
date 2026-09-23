import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

import styles from './HomeScreen.scss';
import VoiceOrb from '../../components/VoiceOrb/VoiceOrb';
import VoiceDropdown from '../../components/VoiceDropdown/VoiceDropdown';
import VoiceStatusWave from '../../components/VoiceStatusWave/VoiceStatusWave';
import { VOICES, DEFAULT_VOICE_ID, VOICE_STORAGE_KEY } from '../../constants/voices';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import {
  useVoiceAssistant,
  AssistantState,
} from '../../hooks/useVoiceAssistant';
import conversationApi from '../../services/api/conversationApi';
import audioInputService from '../../services/audioInputService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const HomeScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();

  const [selectedVoice, setSelectedVoice] = useState<string>(DEFAULT_VOICE_ID);
  const [isCalling, setIsCalling] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(
    route?.params?.conversationId || null
  );

  // Active voice session timer state
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --------------------------------------------------
  // Voice Assistant Hook (Voice-First Engine)
  // --------------------------------------------------
  const {
    state: assistantState,
    error: assistantError,
    startListening,
    stopListening,
    stopSpeaking,
  } = useVoiceAssistant(conversationId);

  // --------------------------------------------------
  // Pre-check Microphone Permission on Screen Mount
  // --------------------------------------------------
  useEffect(() => {
    audioInputService.prepare().catch(() => {});
  }, []);

  // --------------------------------------------------
  // Persistent Voice Preference
  // --------------------------------------------------
  useEffect(() => {
    const loadVoice = async () => {
      try {
        const saved = await AsyncStorage.getItem(VOICE_STORAGE_KEY);
        if (saved && VOICES.some((v) => v.id === saved)) {
          setSelectedVoice(saved);
        }
      } catch (err) {
        console.warn('[HomeScreen] Error loading saved voice preference:', err);
      }
    };
    loadVoice();
  }, []);

  // --------------------------------------------------
  // Initialize Conversation (Normal Mode Only)
  // --------------------------------------------------
  useEffect(() => {
    const initConversation = async () => {
      if (!user || isIncognito) return;

      try {
        const existing = await conversationApi.getByUser(user.userId);
        if (existing.data && existing.data.length > 0) {
          setConversationId(existing.data[0].id);
        } else {
          const created = await conversationApi.create({
            userId: user.userId,
            title: 'Voice Session',
          });
          setConversationId(created.data.id);
        }
      } catch (e) {
        console.error('Failed to init conversation:', e);
      }
    };

    initConversation();
  }, [user, isIncognito]);

  // --------------------------------------------------
  // Assistant Errors
  // --------------------------------------------------
  useEffect(() => {
    if (assistantError) {
      Alert.alert('Voice Assistant', assistantError);
    }
  }, [assistantError]);

  // --------------------------------------------------
  // Active Timer Management
  // --------------------------------------------------
  useEffect(() => {
    if (isCalling) {
      setSessionSeconds(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setSessionSeconds(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCalling]);

  // --------------------------------------------------
  // Start Voice Session (Immediately starts Listening & Timer)
  // --------------------------------------------------
  const handleStartSession = async () => {
    if (isCalling) return;

    try {
      setIsCalling(true);
      await startListening(selectedVoice, isIncognito);
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsCalling(false);
    }
  };

  // --------------------------------------------------
  // Stop Voice Session (Explicit User Stop Action)
  // --------------------------------------------------
  const handleStopSession = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSessionSeconds(0);
    setIsCalling(false);

    try {
      await stopListening();
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
    stopSpeaking();
  };

  // --------------------------------------------------
  // Orb Press: Tap to Start or Tap to Barge-In
  // --------------------------------------------------
  const handleOrbPress = () => {
    if (!isCalling) {
      handleStartSession();
    } else if (assistantState === AssistantState.SPEAKING) {
      // User can tap orb to interrupt assistant speech
      stopSpeaking();
    }
  };

  // --------------------------------------------------
  // Voice Selection with Immediate Active-Call Switching
  // --------------------------------------------------
  const handleSelectVoice = async (voiceId: string) => {
    if (voiceId === selectedVoice) return;

    setSelectedVoice(voiceId);
    try {
      await AsyncStorage.setItem(VOICE_STORAGE_KEY, voiceId);
    } catch (err) {
      console.warn('[HomeScreen] Error saving voice preference:', err);
    }

    // Seamless active call reconnect with new voice
    if (isCalling) {
      console.log(`[HomeScreen] Switching active call to voice: ${voiceId}`);
      try {
        await stopListening();
        stopSpeaking();
        await startListening(voiceId, isIncognito);
      } catch (err) {
        console.error('[HomeScreen] Reconnect error on voice change:', err);
      }
    }
  };

  // --------------------------------------------------
  // Toggle Incognito Mode
  // --------------------------------------------------
  const toggleIncognito = () => {
    if (isCalling) {
      Alert.alert('Incognito Mode', 'Please end the current voice session before changing Incognito mode.');
      return;
    }

    setIsIncognito((prev) => !prev);
  };

  // Format seconds into MM:SS (e.g. 00:07)
  const formatTimer = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (totalSeconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const isSpeaking = assistantState === AssistantState.SPEAKING;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050814" />

      {/* ========================================== */}
      {/* FLOWING COSMIC WAVY BACKGROUND             */}
      {/* ========================================== */}
      <View style={styles.backgroundWaves} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} viewBox={`0 0 ${SCREEN_WIDTH} ${SCREEN_HEIGHT}`}>
          <Defs>
            <LinearGradient id="waveGradMid1" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#1E3A8A" stopOpacity="0" />
              <Stop offset="25%" stopColor="#2563EB" stopOpacity="0.45" />
              <Stop offset="65%" stopColor="#38BDF8" stopOpacity="0.7" />
              <Stop offset="85%" stopColor="#6366F1" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#1E3A8A" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="waveGradMid2" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#0284C7" stopOpacity="0" />
              <Stop offset="40%" stopColor="#38BDF8" stopOpacity="0.6" />
              <Stop offset="75%" stopColor="#818CF8" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="waveGradBottom" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#1E3A8A" stopOpacity="0" />
              <Stop offset="30%" stopColor="#2563EB" stopOpacity="0.5" />
              <Stop offset="70%" stopColor="#38BDF8" stopOpacity="0.65" />
              <Stop offset="100%" stopColor="#1E3A8A" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Middle Wave Ribbon (Sweeps behind Orb) */}
          <Path
            d={`M -40,${SCREEN_HEIGHT * 0.46} C ${SCREEN_WIDTH * 0.25},${SCREEN_HEIGHT * 0.40} ${SCREEN_WIDTH * 0.6},${SCREEN_HEIGHT * 0.54} ${SCREEN_WIDTH + 40},${SCREEN_HEIGHT * 0.44}`}
            fill="none"
            stroke="url(#waveGradMid1)"
            strokeWidth="3.5"
          />
          <Path
            d={`M -40,${SCREEN_HEIGHT * 0.48} C ${SCREEN_WIDTH * 0.3},${SCREEN_HEIGHT * 0.42} ${SCREEN_WIDTH * 0.65},${SCREEN_HEIGHT * 0.56} ${SCREEN_WIDTH + 40},${SCREEN_HEIGHT * 0.47}`}
            fill="none"
            stroke="url(#waveGradMid2)"
            strokeWidth="2"
          />

          {/* Bottom Wave Ribbon */}
          <Path
            d={`M -40,${SCREEN_HEIGHT * 0.82} C ${SCREEN_WIDTH * 0.3},${SCREEN_HEIGHT * 0.85} ${SCREEN_WIDTH * 0.7},${SCREEN_HEIGHT * 0.77} ${SCREEN_WIDTH + 40},${SCREEN_HEIGHT * 0.83}`}
            fill="none"
            stroke="url(#waveGradBottom)"
            strokeWidth="3.2"
          />
        </Svg>
      </View>

      <View style={styles.contentWrapper}>
        {/* ========================================== */}
        {/* 1. TOP BAR: PROFILE + VOICE SELECTOR       */}
        {/* ========================================== */}
        <View style={styles.topHeader}>
          {/* Profile / Settings Button (Left) */}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Open settings and profile"
            activeOpacity={0.75}
          >
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Compact Voice Selector at Top Center */}
          <VoiceDropdown
            selectedVoiceId={selectedVoice}
            onSelect={handleSelectVoice}
          />

          {/* Incognito Shield Button (Right) */}
          <TouchableOpacity
            style={[styles.shieldHeaderButton, isIncognito && styles.shieldHeaderButtonActive]}
            onPress={toggleIncognito}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Toggle incognito mode"
            accessibilityState={{ selected: isIncognito }}
            activeOpacity={0.75}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2L4 5V11C4 16.55 7.42 21.74 12 23C16.58 21.74 20 16.55 20 11V5L12 2Z"
                fill={isIncognito ? '#C084FC' : '#60A5FA'}
                fillOpacity={isIncognito ? 0.45 : 0.15}
                stroke={isIncognito ? '#C084FC' : '#94A3B8'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M12 7V17M12 17C14 15.5 16 13.5 16 11V7L12 7Z"
                fill={isIncognito ? '#A855F7' : '#38BDF8'}
                fillOpacity={isIncognito ? 0.75 : 0.3}
              />
            </Svg>
            {isIncognito && <View style={styles.incognitoDot} />}
          </TouchableOpacity>
        </View>

        {/* ========================================== */}
        {/* 2. CENTER STAGE: ORB + STATUS + TIMER + STOP*/}
        {/* ========================================== */}
        <View style={styles.centerStage}>
          {/* Main Focal Point: Central ORB */}
          <TouchableOpacity
            style={styles.orbWrapper}
            onPress={handleOrbPress}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={
              !isCalling
                ? 'Start voice assistant'
                : isSpeaking
                ? 'AI is speaking, tap to interrupt'
                : 'AI is listening'
            }
          >
            <VoiceOrb
              state={isCalling ? assistantState : AssistantState.IDLE}
              isIncognito={isIncognito}
            />
          </TouchableOpacity>

          {/* Active Voice Controls: Animated Waveform + Timer + Stop */}
          {isCalling ? (
            <View style={styles.activeSessionControls}>
              {/* 3 & 4: Animated Status below ORB */}
              <VoiceStatusWave isSpeaking={isSpeaking} />

              {/* 5: Continuous Session Timer */}
              <Text style={styles.timerText} accessibilityLabel={`Session duration: ${formatTimer(sessionSeconds)}`}>
                {formatTimer(sessionSeconds)}
              </Text>

              {/* 6: Explicit User Stop Button */}
              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopSession}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Stop voice session"
              >
                <Text style={styles.stopButtonText}>[ Stop ]</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.activeSessionControls} />
          )}
        </View>

        {/* Bottom subtle spacer to preserve vertical balance */}
        <View style={styles.bottomSpacer} />
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;