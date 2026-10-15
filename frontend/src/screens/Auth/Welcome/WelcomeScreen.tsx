import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import styles from './WelcomeScreen.scss';
import { useAuth } from '../../../context/AuthContext';

interface WelcomeScreenProps {
  navigation: any;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { signInWithGoogle } = useAuth();

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);

    try {
      Alert.prompt
        ? Alert.prompt(
            'Google Sign-In',
            'Enter your verified Google email address:',
            async (inputEmail) => {
              if (inputEmail && inputEmail.trim()) {
                try {
                  const googleEmail = inputEmail.trim().toLowerCase();
                  await signInWithGoogle({
                    token: `mock_google_${Date.now()}`,
                    email: googleEmail,
                    name: googleEmail.split('@')[0],
                  });
                } catch (gErr: any) {
                  Alert.alert('Google Sign-In Error', gErr.message || 'Could not complete sign in.');
                } finally {
                  setIsGoogleLoading(false);
                }
              } else {
                setIsGoogleLoading(false);
              }
            },
            'plain-text',
            'student@gmail.com'
          )
        : Alert.alert(
            'Google Sign-In',
            'Connect your Google Account to sign in seamlessly with FellowGrad.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
                onPress: () => setIsGoogleLoading(false),
              },
              {
                text: 'Continue with Google',
                onPress: async () => {
                  try {
                    const googleEmail = 'student@gmail.com';
                    await signInWithGoogle({
                      token: `mock_google_${Date.now()}`,
                      email: googleEmail,
                      name: googleEmail.split('@')[0],
                    });
                  } catch (gErr: any) {
                    Alert.alert('Google Sign-In Error', gErr.message || 'Could not complete sign in.');
                  } finally {
                    setIsGoogleLoading(false);
                  }
                },
              },
            ]
          );
    } catch (e: any) {
      Alert.alert('Google Sign-In Error', e.message || 'Google Sign-In failed');
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070913" />

      {/* Decorative ambient background glows */}
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <View style={styles.content}>
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>FellowGrad AI</Text>
          <Text style={styles.tagline}>
            Your personal AI assistant.
          </Text>
        </View>

        {/* Central Ambient Orb Visual */}
        <View style={styles.orbContainer}>
          <View style={styles.orbOuterRing}>
            <View style={styles.orbMiddleRing}>
              <View style={styles.orbCore}>
                <Text style={styles.avatarEmojiText}>✨</Text>
              </View>
            </View>
          </View>
          <Text style={styles.companionLabel}>Powered by Gemini Live</Text>
        </View>

        {/* Value Proposition Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            Speak naturally, brainstorm concepts, prepare for interviews, plan your day, and get answers to whatever you ask through continuous real-time voice.
          </Text>
        </View>

        {/* Call to Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('Register')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Get Started with FellowGrad AI"
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.googleButton, isGoogleLoading && { opacity: 0.65 }]}
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#1F2937" size="small" />
            ) : (
              <>
                <Svg width="20" height="20" viewBox="0 0 24 24">
                  <Path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <Path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <Path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <Path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </Svg>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Sign into existing account"
          >
            <Text style={styles.secondaryButtonText}>Sign In with Email</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Assurance Footer */}
        <Text style={styles.privacyNote}>
          Voice-first · Ephemeral incognito support · Private & secure
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;
