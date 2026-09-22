import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import styles from './SettingsScreen.scss';
import { useAuth } from '../../context/AuthContext';
import VoiceSelectorModal from '../../components/VoiceSelectorModal/VoiceSelectorModal';
import { VOICES, DEFAULT_VOICE_ID, VOICE_STORAGE_KEY } from '../../constants/voices';
import userApi from '../../services/api/userApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsScreenProps {
  navigation: any;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { user, logout, updatePreferences, deleteAccount } = useAuth();

  // Settings State
  const [selectedVoice, setSelectedVoice] = useState<string>(
    user?.preferences?.voice || DEFAULT_VOICE_ID
  );
  const [isVoiceModalVisible, setVoiceModalVisible] = useState(false);
  const [language, setLanguage] = useState<string>(user?.preferences?.language || 'en');
  const [isMemoryEnabled, setIsMemoryEnabled] = useState<boolean>(
    user?.preferences?.memoryEnabled !== false
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    user?.preferences?.notificationsEnabled ?? true
  );
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'system' | 'light'>(
    user?.preferences?.theme || 'dark'
  );

  // Sync state when user preferences update
  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.voice) setSelectedVoice(user.preferences.voice);
      if (user.preferences.language) setLanguage(user.preferences.language);
      if (user.preferences.memoryEnabled !== undefined) setIsMemoryEnabled(user.preferences.memoryEnabled);
      if (user.preferences.notificationsEnabled !== undefined) setNotificationsEnabled(user.preferences.notificationsEnabled);
      if (user.preferences.theme) setSelectedTheme(user.preferences.theme);
    }
  }, [user]);

  // Voice Selection Handler
  const handleSelectVoice = async (voiceId: string) => {
    setSelectedVoice(voiceId);
    setVoiceModalVisible(false);
    try {
      await AsyncStorage.setItem(VOICE_STORAGE_KEY, voiceId);
      await updatePreferences({ voice: voiceId });
    } catch (err) {
      console.warn('[SettingsScreen] Error updating voice preference:', err);
    }
  };

  // Memory Toggle Handler
  const handleToggleMemory = async (value: boolean) => {
    setIsMemoryEnabled(value);
    try {
      await updatePreferences({ memoryEnabled: value });
    } catch (err: any) {
      setIsMemoryEnabled(!value);
      Alert.alert('Error', 'Failed to update memory setting');
    }
  };

  // Notifications Toggle
  const handleToggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await updatePreferences({ notificationsEnabled: value });
    } catch (err: any) {
      setNotificationsEnabled(!value);
    }
  };

  // Language Cycle Handler
  const handleCycleLanguage = async () => {
    const langs = ['en', 'ta', 'tanglish'];
    const nextIdx = (langs.indexOf(language) + 1) % langs.length;
    const nextLang = langs[nextIdx];
    setLanguage(nextLang);
    try {
      await updatePreferences({ language: nextLang });
    } catch (err: any) {
      console.warn('[SettingsScreen] Error updating language:', err);
    }
  };

  const getLanguageLabel = (lang: string) => {
    if (lang === 'ta') return 'Tamil';
    if (lang === 'tanglish') return 'Tanglish';
    return 'English';
  };

  // Privacy Actions
  const handleClearConversations = () => {
    Alert.alert(
      'Clear Conversations',
      'Are you sure you want to delete all conversation history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await userApi.clearAllConversations();
              Alert.alert('Success', `Cleared ${res.data?.deletedCount ?? 0} conversations.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not clear conversations');
            }
          },
        },
      ]
    );
  };

  const handleClearMemories = () => {
    Alert.alert(
      'Clear Long-Term Memories',
      'Are you sure you want to delete all stored personal memories? Maya will no longer recall them in future conversations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Memories',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await userApi.clearAllMemories();
              Alert.alert('Success', `Cleared ${res.data?.deletedCount ?? 0} memories.`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not clear memories');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => await logout() },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Permanently delete your account, conversations, and memories? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  const currentVoiceObj = VOICES.find((v) => v.id === selectedVoice) || VOICES[2];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070913" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
        >
          <Text style={styles.backIcon}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Account Profile Card */}
        <TouchableOpacity
          style={styles.accountCard}
          onPress={() => navigation.navigate('Account')}
          activeOpacity={0.75}
        >
          <View style={styles.accountCardLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitial}>
                {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
              </Text>
            </View>
            <View>
              <Text style={styles.profileName}>{user?.name || 'Student'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>
            </View>
          </View>
          <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>

        {/* Section 1: AI Personalization */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AI PERSONALIZATION</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingTitle}>AI Companion</Text>
              <Text style={styles.settingSubtitle}>Default Persona</Text>
            </View>
            <Text style={styles.valueBadge}>Maya</Text>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => setVoiceModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingTitle}>Voice</Text>
              <Text style={styles.settingSubtitle}>{currentVoiceObj.description}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.valueText}>{currentVoiceObj.name}</Text>
              <Text style={styles.arrow}>❯</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleCycleLanguage}
            activeOpacity={0.7}
          >
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingTitle}>Language</Text>
              <Text style={styles.settingSubtitle}>Primary communication style</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.valueText}>{getLanguageLabel(language)}</Text>
              <Text style={styles.arrow}>❯</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingTitle}>Memory</Text>
              <Text style={styles.settingSubtitle}>
                Maya remembers key details across conversations to personalize answers.
              </Text>
            </View>
            <Switch
              value={isMemoryEnabled}
              onValueChange={handleToggleMemory}
              trackColor={{ false: '#242D4A', true: '#6C63FF' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section 2: Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>PRIVACY & CONTROLS</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoTitle}>Incognito Mode</Text>
            <Text style={styles.infoSubtitle}>
              Activate incognito directly from the top of the Home screen to run ephemeral calls where nothing is saved.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleClearConversations}
            activeOpacity={0.7}
          >
            <Text style={styles.actionRowTitle}>Clear All Conversations</Text>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleClearMemories}
            activeOpacity={0.7}
          >
            <Text style={styles.actionRowTitle}>Clear All Memories</Text>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>
        </View>

        {/* Section 3: App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>APP PREFERENCES</Text>

          <View style={styles.switchRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingTitle}>Notifications</Text>
              <Text style={styles.settingSubtitle}>Study reminders and placement tips</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: '#242D4A', true: '#6C63FF' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={styles.settingTitle}>Theme</Text>
              <Text style={styles.settingSubtitle}>Appearance mode</Text>
            </View>
            <Text style={styles.valueBadge}>Dark Mode</Text>
          </View>
        </View>

        {/* Section 4: About */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ABOUT</Text>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('FellowGrad AI', 'FellowGrad AI is your personal academic and emotional companion powered by Gemini Live native audio.')}
            activeOpacity={0.7}
          >
            <Text style={styles.actionRowTitle}>About FellowGrad</Text>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://fellowgrad-ai.web.app/privacy').catch(() => Alert.alert('Privacy Policy', 'Private, encrypted, and isolated to your user ID.'))}
            activeOpacity={0.7}
          >
            <Text style={styles.actionRowTitle}>Privacy Policy</Text>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Linking.openURL('https://fellowgrad-ai.web.app/terms').catch(() => Alert.alert('Terms of Service', 'Standard academic assistant terms of service.'))}
            activeOpacity={0.7}
          >
            <Text style={styles.actionRowTitle}>Terms of Service</Text>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>

          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version</Text>
            <Text style={styles.versionValue}>1.0.0 (Release)</Text>
          </View>
        </View>

        {/* Section 5: Account Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Voice Selector Modal */}
      <VoiceSelectorModal
        visible={isVoiceModalVisible}
        selectedVoiceId={selectedVoice}
        onSelect={handleSelectVoice}
        onClose={() => setVoiceModalVisible(false)}
      />
    </SafeAreaView>
  );
};

export default SettingsScreen;
