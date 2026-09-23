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
import Svg, { Path, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

import styles from './HomeScreen.scss';
import VoiceOrb from '../../components/VoiceOrb/VoiceOrb';
import VoiceSelectorModal from '../../components/VoiceSelectorModal/VoiceSelectorModal';
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

const QUICK_PROMPTS = [
  {
    id: 'studies',
    icon: '🎓',
    label: 'Ask about\nStudies',
    color: '#A855F7',
    prompt: 'Can you help me with my studies and coursework?',
  },
  {
    id: 'colleges',
    icon: '🏛️',
    label: 'Colleges\nin Coimbatore',
    color: '#38BDF8',
    prompt: 'Tell me about the best colleges and universities in Coimbatore.',
  },
  {
    id: 'notes',
    icon: '📑',
    label: 'Notes &\nResources',
    color: '#22C55E',
    prompt: 'Where can I find study notes and learning resources?',
  },
  {
    id: 'guidance',
    icon: '💡',
    label: 'Get\nGuidance',
    color: '#FBBF24',
    prompt: 'I need career and academic guidance for my future.',
  },
];

const HomeScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();

  const [selectedVoice, setSelectedVoice] = useState<string>(DEFAULT_VOICE_ID);
  const [isVoiceModalVisible, setVoiceModalVisible] = useState<boolean>(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isIncognito, setIsIncognito] = useState(false);
  const [showIncognitoNotice, setShowIncognitoNotice] = useState(false);
  const [timer, setTimer] = useState(0);
  const [conversationId, setConversationId] = useState<string | null>(
    route?.params?.conversationId || null
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --------------------------------------------------
  // Voice Assistant Hook (Voice-First Engine)
  // --------------------------------------------------
  const {
    state: assistantState,
    error: assistantError,
    startListening,
    stopListening,
    sendTextMessage,
    stopSpeaking,
  } = useVoiceAssistant(conversationId);

  // --------------------------------------------------
  // Pre-check Microphone Permission on Screen Mount
  // Avoids OS permission dialog latency when Maya is tapped
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
            title: 'Voice with Maya',
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
  // Call Timer
  // --------------------------------------------------
  useEffect(() => {
    if (isCalling) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimer(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isCalling]);

  // --------------------------------------------------
  // Assistant Errors
  // --------------------------------------------------
  useEffect(() => {
    if (assistantError) {
      Alert.alert('Voice Assistant', assistantError);
    }
  }, [assistantError]);

  // --------------------------------------------------
  // Greeting Helpers
  // --------------------------------------------------
  const getGreetingPrefix = () => {
    const hour = new Date().getHours();
    if (hour >= 12 && hour < 17) {
      return 'Good afternoon';
    } else if (hour >= 17 || hour < 4) {
      return 'Good evening';
    }
    return 'Good morning';
  };

  const getUserFirstName = () => {
    if (user?.name) {
      return user.name.split(' ')[0];
    }
    return 'Anbu';
  };

  // --------------------------------------------------
  // Clean State-Only Status Text
  // --------------------------------------------------
  const getStatusText = () => {
    switch (assistantState) {
      case AssistantState.CONNECTING:
        return 'Connecting...';
      case AssistantState.LISTENING:
        return 'Listening...';
      case AssistantState.PROCESSING:
      case AssistantState.THINKING:
        return 'Thinking...';
      case AssistantState.SPEAKING:
        return 'Speaking...';
      case AssistantState.INTERRUPTED:
        return 'Listening...';
      case AssistantState.ERROR:
        return 'Tap to retry';
      case AssistantState.IDLE:
      default:
        return isCalling ? 'Listening...' : 'Tap to talk';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --------------------------------------------------
  // Start / End Call
  // --------------------------------------------------
  const handleCallPress = async () => {
    if (isCalling) {
      // End Call
      try {
        await stopListening();
      } catch (error) {
        console.error('Failed to stop listening:', error);
      }
      stopSpeaking();
      setIsCalling(false);
      return;
    }

    // Start Call
    try {
      setTimer(0);
      setIsCalling(true);
      await startListening(selectedVoice, isIncognito);
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsCalling(false);
    }
  };

  // --------------------------------------------------
  // Maya Orb Press: Tap to Start or Tap to Barge-In
  // --------------------------------------------------
  const handleOrbPress = () => {
    if (!isCalling) {
      handleCallPress();
    } else if (assistantState === AssistantState.SPEAKING) {
      // User can tap orb to interrupt Maya
      stopSpeaking();
    }
  };

  // --------------------------------------------------
  // Quick Prompt Action Handler
  // --------------------------------------------------
  const handleQuickPromptPress = async (promptText: string) => {
    if (!isCalling) {
      try {
        setTimer(0);
        setIsCalling(true);
        await startListening(selectedVoice, isIncognito);
        setTimeout(() => {
          sendTextMessage(promptText);
        }, 1200);
      } catch (err) {
        console.error('Failed to start call with prompt:', err);
        setIsCalling(false);
      }
    } else {
      sendTextMessage(promptText);
    }
  };

  // --------------------------------------------------
  // Voice Selection with Active-Call Switching
  // --------------------------------------------------
  const handleSelectVoice = async (voiceId: string) => {
    setVoiceModalVisible(false);
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
      Alert.alert('Incognito Mode', 'Please end the current call before changing Incognito mode.');
      return;
    }

    const nextState = !isIncognito;
    setIsIncognito(nextState);

    if (nextState) {
      setShowIncognitoNotice(true);
      setTimeout(() => setShowIncognitoNotice(false), 3500);
    } else {
      setShowIncognitoNotice(false);
    }
  };

  const currentVoiceObj =
    VOICES.find((v) => v.id === selectedVoice) || VOICES[2];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050814" />

      {/* ========================================== */}
      {/* FLOWING COSMIC NEON WAVY BACKGROUND */}
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

          {/* Middle Wave Ribbon 1 (Sweeps behind Maya Orb) */}
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
          <Path
            d={`M -40,${SCREEN_HEIGHT * 0.44} C ${SCREEN_WIDTH * 0.22},${SCREEN_HEIGHT * 0.38} ${SCREEN_WIDTH * 0.55},${SCREEN_HEIGHT * 0.52} ${SCREEN_WIDTH + 40},${SCREEN_HEIGHT * 0.42}`}
            fill="none"
            stroke="url(#waveGradMid1)"
            strokeWidth="1.5"
            strokeOpacity="0.4"
          />

          {/* Bottom Wave Ribbon 2 (Flows across bottom dock) */}
          <Path
            d={`M -40,${SCREEN_HEIGHT * 0.82} C ${SCREEN_WIDTH * 0.3},${SCREEN_HEIGHT * 0.85} ${SCREEN_WIDTH * 0.7},${SCREEN_HEIGHT * 0.77} ${SCREEN_WIDTH + 40},${SCREEN_HEIGHT * 0.83}`}
            fill="none"
            stroke="url(#waveGradBottom)"
            strokeWidth="3.2"
          />
          <Path
            d={`M -40,${SCREEN_HEIGHT * 0.84} C ${SCREEN_WIDTH * 0.35},${SCREEN_HEIGHT * 0.87} ${SCREEN_WIDTH * 0.75},${SCREEN_HEIGHT * 0.79} ${SCREEN_WIDTH + 40},${SCREEN_HEIGHT * 0.85}`}
            fill="none"
            stroke="url(#waveGradBottom)"
            strokeWidth="1.8"
            strokeOpacity="0.5"
          />
        </Svg>
      </View>

      <View style={styles.contentWrapper}>
        {/* ========================================== */}
        {/* TOP HEADER */}
        {/* ========================================== */}
        <View style={styles.topHeader}>
          {/* Profile Avatar Button */}
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

          {/* Greeting & Subtitle */}
          <View style={styles.greetingContainer}>
            <View style={styles.greetingTitleRow}>
              <Text style={styles.greetingTitle}>
                {getGreetingPrefix()},{' '}
              </Text>
              <Text style={styles.greetingName}>{getUserFirstName()}</Text>
              <Text style={styles.greetingEmoji}> ☀️</Text>
            </View>
            <Text style={styles.greetingSubtitle}>
              {isIncognito ? '🕶 Incognito · Ephemeral session' : 'Your AI study & life companion'}
            </Text>
          </View>

          {/* Shield Status / Quick Toggle Button with Emerald Dot */}
          <TouchableOpacity
            style={[styles.shieldHeaderButton, isIncognito && styles.shieldHeaderButtonActive]}
            onPress={toggleIncognito}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={isIncognito ? 'Disable incognito mode' : 'Enable incognito mode'}
            activeOpacity={0.75}
          >
            <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2L4 5V11C4 16.55 7.42 21.74 12 23C16.58 21.74 20 16.55 20 11V5L12 2Z"
                fill={isIncognito ? '#C084FC' : '#60A5FA'}
                fillOpacity="0.25"
                stroke={isIncognito ? '#A855F7' : '#93C5FD'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M12 7V17M12 17C14 15.5 16 13.5 16 11V7L12 7Z"
                fill={isIncognito ? '#A855F7' : '#38BDF8'}
                fillOpacity="0.4"
              />
            </Svg>
            {/* Green glowing indicator dot */}
            <View style={styles.shieldDot} />
          </TouchableOpacity>
        </View>

        {/* Incognito Notice Banner */}
        {showIncognitoNotice && (
          <View style={styles.noticeBanner}>
            <Text style={styles.noticeText}>
              🕶 Incognito active: Nothing from this conversation will be remembered.
            </Text>
          </View>
        )}

        {/* ========================================== */}
        {/* QUICK SUGGESTION / PROMPT CARDS (4-GRID)  */}
        {/* ========================================== */}
        <View style={styles.quickCardsContainer}>
          {QUICK_PROMPTS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.quickCard}
              onPress={() => handleQuickPromptPress(item.prompt)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={item.label.replace('\n', ' ')}
            >
              <View
                style={[
                  styles.quickCardIconContainer,
                  { backgroundColor: `${item.color}22` },
                ]}
              >
                <Text style={styles.quickCardIcon}>{item.icon}</Text>
              </View>
              <Text style={styles.quickCardLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ========================================== */}
        {/* CENTER STAGE: ORB, MAYA & STATUS BADGES    */}
        {/* ========================================== */}
        <View style={styles.centerStage}>
          {/* Central Fluid Voice Orb */}
          <TouchableOpacity
            style={styles.orbWrapper}
            onPress={handleOrbPress}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              !isCalling
                ? 'Start voice conversation with Maya'
                : assistantState === AssistantState.SPEAKING
                ? 'Tap to interrupt Maya'
                : 'Maya is listening'
            }
          >
            <VoiceOrb state={assistantState} isIncognito={isIncognito} />
          </TouchableOpacity>

          {/* Agent Title & Status Section */}
          <View style={styles.statusContainer}>
            <Text style={styles.agentName}>Maya</Text>

            {/* Radiant Gradient Status Pill */}
            <View
              style={[
                styles.gradientStatusPill,
                assistantState === AssistantState.SPEAKING && styles.gradientStatusPillSpeaking,
                assistantState === AssistantState.LISTENING && styles.gradientStatusPillListening,
              ]}
            >
              {/* Animated Soundwave Bars Icon */}
              <View style={styles.statusWaveIcon}>
                <Svg width="16" height="14" viewBox="0 0 16 14" fill="none">
                  <Rect x="1" y="4" width="2" height="6" rx="1" fill="#FFFFFF" />
                  <Rect x="5" y="1" width="2" height="12" rx="1" fill="#FFFFFF" />
                  <Rect x="9" y="3" width="2" height="8" rx="1" fill="#FFFFFF" />
                  <Rect x="13" y="5" width="2" height="4" rx="1" fill="#FFFFFF" />
                </Svg>
              </View>
              <Text style={styles.statusPillText}>{getStatusText()}</Text>
            </View>

            {/* Prompt Subtitle */}
            <Text style={styles.promptSubtitleLine1}>Speak naturally...</Text>
            <Text style={styles.promptSubtitleLine2}>I'm here to help you.</Text>

            {/* Active Call Duration Pill [ 🔴 00:02 ] */}
            <View style={styles.timerBadge}>
              <View style={styles.timerDot} />
              <Text style={styles.timerValue}>{formatTime(timer)}</Text>
            </View>
          </View>
        </View>

        {/* ========================================== */}
        {/* BOTTOM ACTION BAR (FLOATING DOCK)          */}
        {/* ========================================== */}
        <View style={styles.bottomBar}>
          <View style={styles.controlsRow}>
            {/* Left Pill: Voice Selector (e.g. 🌸 Aoede ⌄) */}
            <TouchableOpacity
              style={styles.voiceSelectorPill}
              onPress={() => setVoiceModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Selected voice: ${currentVoiceObj.label}. Tap to change voice.`}
              activeOpacity={0.75}
            >
              <Text style={styles.voiceIcon}>{currentVoiceObj.icon}</Text>
              <Text style={styles.voiceLabel}>{currentVoiceObj.label}</Text>
              <Text style={styles.voiceChevron}>▾</Text>
            </TouchableOpacity>

            {/* Center: Large Glowing Call Action Button */}
            <View style={styles.micButtonWrapper}>
              <View
                style={[
                  styles.micOuterRing,
                  !isCalling && styles.micOuterRingInactive,
                ]}
              />
              <TouchableOpacity
                style={[
                  styles.micButton,
                  isCalling && styles.micButtonActive,
                ]}
                onPress={handleCallPress}
                accessibilityRole="button"
                accessibilityLabel={isCalling ? 'End voice call' : 'Start voice call with Maya'}
                activeOpacity={0.8}
              >
                <Text style={[styles.micIcon, isCalling && styles.micIconActive]}>
                  {isCalling ? '✕' : '🎙️'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Right Pill: Private Toggle Switch (🛡️ Private [==O]) */}
            <TouchableOpacity
              style={[styles.privatePill, isIncognito && styles.privatePillActive]}
              onPress={toggleIncognito}
              accessibilityRole="switch"
              accessibilityState={{ checked: isIncognito }}
              accessibilityLabel={`Private mode is ${isIncognito ? 'on' : 'off'}`}
              activeOpacity={0.75}
            >
              <View style={styles.privatePillLeft}>
                <Text style={styles.privateIcon}>🛡️</Text>
                <Text style={[styles.privateLabel, isIncognito && styles.privateLabelActive]}>
                  Private
                </Text>
              </View>

              {/* iOS Style Miniature Toggle Switch */}
              <View style={[styles.miniSwitch, isIncognito && styles.miniSwitchActive]}>
                <View
                  style={[
                    styles.miniSwitchThumb,
                    isIncognito && styles.miniSwitchThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ========================================== */}
      {/* VOICE SELECTOR BOTTOM SHEET MODAL          */}
      {/* ========================================== */}
      <VoiceSelectorModal
        visible={isVoiceModalVisible}
        selectedVoiceId={selectedVoice}
        onClose={() => setVoiceModalVisible(false)}
        onSelect={handleSelectVoice}
      />
    </SafeAreaView>
  );
};

export default HomeScreen;