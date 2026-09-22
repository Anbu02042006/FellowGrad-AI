import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import styles from './WelcomeScreen.scss';

interface WelcomeScreenProps {
  navigation: any;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ navigation }) => {
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
            Your personal academic & emotional companion.
          </Text>
        </View>

        {/* Central Ambient Maya Orb Visual */}
        <View style={styles.orbContainer}>
          <View style={styles.orbOuterRing}>
            <View style={styles.orbMiddleRing}>
              <View style={styles.orbCore}>
                <Text style={styles.mayaAvatarText}>✨</Text>
              </View>
            </View>
          </View>
          <Text style={styles.companionLabel}>Powered by Gemini Live</Text>
        </View>

        {/* Value Proposition Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            Speak naturally with Maya, brainstorm course concepts, prepare for placement interviews, and navigate college life through continuous real-time voice.
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
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Sign into existing account"
          >
            <Text style={styles.secondaryButtonText}>Sign In</Text>
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
