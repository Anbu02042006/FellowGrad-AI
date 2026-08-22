import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import styles from './AccountScreen.scss';
import { useAuth } from '../../context/AuthContext';
import userApi, { UserProfile } from '../../services/api/userApi';

const AccountScreen = ({ navigation }: any) => {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const response = await userApi.getProfile(user.userId);
        setProfile(response.data);
      } catch (e) {
        console.error('Failed to fetch profile', e);
        // If profile doesn't exist, we'll use the user info from auth
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: async () => await logout() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0E21' }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <Text style={styles.profileName}>{profile?.name || user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.label}>Nickname</Text>
          <TouchableOpacity style={styles.nicknameButton}>
            <Text style={styles.nicknameText}>{profile?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Nithish'}</Text>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>A nickname helps keep the chat natural and personal.</Text>

        <View style={styles.settingRow}>
          <Text style={styles.label}>Email me about new features</Text>
          <Switch
            value={emailEnabled}
            onValueChange={setEmailEnabled}
            trackColor={{ false: '#2A2E45', true: '#4CAF50' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Text style={styles.helpText}>
          We'll occasionally email you about new features, product updates, and helpful content.
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete my account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountScreen;
