import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';

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

const HomeScreen = ({ navigation, route }: any) => {
  const { user } = useAuth();

  const [selectedAgent] = useState('Maya');
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
  // Voice Assistant Hook
  // --------------------------------------------------
  const {
    state: assistantState,
    error: assistantError,
    startListening,
    stopListening,
    stopSpeaking,
  } = useVoiceAssistant(conversationId);

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
            title: `Voice with ${selectedAgent}`,
          });
          setConversationId(created.data.id);
        }
      } catch (e) {
        console.error('Failed to init conversation:', e);
      }
    };

    initConversation();
  }, [user, selectedAgent, isIncognito]);

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
  // Greeting Helper
  // --------------------------------------------------
  const getGreeting = () => {
    const hour = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon';
    } else if (hour >= 17 || hour < 4) {
      timeGreeting = 'Good evening';
    }

    const firstName = user?.name ? user.name.split(' ')[0] : 'there';
    return `${timeGreeting}, ${firstName}`;
  };

  // --------------------------------------------------
  // Status Text
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
        return 'Tap to talk';
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
      // END CALL
      try {
        await stopListening();
      } catch (error) {
        console.error('Failed to stop listening:', error);
      }
      stopSpeaking();
      setIsCalling(false);
      return;
    }

    // START CALL
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
  // Voice Selection
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

    // Active call reconnect with new voice
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
      setTimeout(() => setShowIncognitoNotice(false), 3200);
    } else {
      setShowIncognitoNotice(false);
    }
  };

  const currentVoiceObj =
    VOICES.find((v) => v.id === selectedVoice) || VOICES[2];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E21" />

      {/* ========================================== */}
      {/* TOP HEADER */}
      {/* ========================================== */}
      <View style={styles.topHeader}>
        {/* Profile Avatar Button */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Open settings and profile"
          activeOpacity={0.7}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Greeting & Dynamic Subtitle */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle} numberOfLines={1}>
            {getGreeting()}
          </Text>
          <Text style={styles.greetingSubtitle}>
            {isIncognito ? 'Private session · Nothing saved' : 'Ready when you are.'}
          </Text>
        </View>

        {/* Incognito Mode Toggle Button */}
        <TouchableOpacity
          style={[styles.incognitoButton, isIncognito && styles.incognitoButtonActive]}
          onPress={toggleIncognito}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={isIncognito ? 'Disable incognito mode' : 'Enable incognito mode'}
          activeOpacity={0.7}
        >
          <Text style={styles.incognitoIcon}>
            {isIncognito ? '👻' : '🛡️'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Incognito Notice Tooltip */}
      {showIncognitoNotice && (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>
            🔒 Incognito active: Your conversation won't be saved or remembered.
          </Text>
        </View>
      )}

      {/* ========================================== */}
      {/* CENTER AI AVATAR / ORB */}
      {/* ========================================== */}
      <View style={styles.centerStage}>
        <View style={styles.orbWrapper}>
          <VoiceOrb state={assistantState} isIncognito={isIncognito} />
        </View>

        {/* Agent Name & Status */}
        <View style={styles.statusContainer}>
          <Text style={styles.agentName}>Maya</Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>

          {/* Active Call Duration */}
          {isCalling && (
            <View style={styles.timerBadge}>
              <View style={styles.timerDot} />
              <Text style={styles.timerValue}>{formatTime(timer)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ========================================== */}
      {/* BOTTOM ACTION BAR */}
      {/* ========================================== */}
      <View style={styles.bottomBar}>
        <View style={styles.controlsRow}>
          {/* Secondary Control: Voice Selector */}
          <TouchableOpacity
            style={styles.voiceSelectorPill}
            onPress={() => setVoiceModalVisible(true)}
            accessibilityLabel={`Selected voice: ${currentVoiceObj.label}. Tap to change voice.`}
            activeOpacity={0.75}
          >
            <Text style={styles.voiceIcon}>{currentVoiceObj.icon}</Text>
            <Text style={styles.voiceLabel}>{currentVoiceObj.label}</Text>
            <Text style={styles.voiceChevron}>▾</Text>
          </TouchableOpacity>

          {/* Primary Action: Voice Call Button */}
          <TouchableOpacity
            style={[
              styles.micButton,
              isCalling && styles.micButtonActive,
              assistantState === AssistantState.LISTENING && styles.micButtonListening,
            ]}
            onPress={handleCallPress}
            accessibilityLabel={isCalling ? 'End voice call' : 'Start voice call'}
            activeOpacity={0.8}
          >
            <Text style={[styles.micIcon, isCalling && styles.micIconActive]}>
              {isCalling ? '✕' : '🎙️'}
            </Text>
          </TouchableOpacity>

          {/* Secondary Control: Incognito Badge / Mode */}
          <TouchableOpacity
            style={[styles.incognitoPill, isIncognito && styles.incognitoPillActive]}
            onPress={toggleIncognito}
            accessibilityLabel={`Incognito mode is ${isIncognito ? 'on' : 'off'}`}
            activeOpacity={0.75}
          >
            <Text style={styles.pillIcon}>{isIncognito ? '👻' : '🛡️'}</Text>
            <Text style={[styles.pillLabel, isIncognito && styles.pillLabelActive]}>
              {isIncognito ? 'Incognito' : 'Private'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ========================================== */}
      {/* VOICE SELECTOR MODAL */}
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