import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import styles from './RegisterScreen.scss';
import { useAuth } from '../../../context/AuthContext';

interface RegisterScreenProps {
  navigation: any;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const { register, signInWithGoogle } = useAuth();

  // Dynamic Password Strength Evaluation
  const passwordStrength = useMemo(() => {
    if (!password) return { level: 0, label: '', color: '#374151' };

    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) {
      return { level: 1, label: 'Weak', color: '#EF4444' };
    } else if (score <= 4) {
      return { level: 2, label: 'Medium', color: '#F59E0B' };
    } else {
      return { level: 3, label: 'Strong', color: '#10B981' };
    }
  }, [password]);

  const handleRegister = async () => {
    setErrorMessage('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    if (cleanName.length < 2) {
      setErrorMessage('Name must be at least 2 characters');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must contain at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage('Password must include uppercase, lowercase, and a number');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        fullName: cleanName,
        name: cleanName,
        email: cleanEmail,
        password,
        confirmPassword,
      });
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('already registered') || msg.includes('duplicate')) {
        setErrorMessage('An account with this email already exists. Please sign in instead.');
      } else if (msg.includes('connection') || msg.includes('network')) {
        setErrorMessage('Unable to connect to server. Please check your internet connection.');
      } else {
        setErrorMessage(msg || 'Registration failed. Please review your details.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
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
                    name: fullName.trim() || googleEmail.split('@')[0],
                  });
                } catch (gErr: any) {
                  setErrorMessage(gErr.message || 'Google Sign-In could not be completed.');
                } finally {
                  setIsGoogleLoading(false);
                }
              } else {
                setIsGoogleLoading(false);
              }
            },
            'plain-text',
            email || 'student@gmail.com'
          )
        : Alert.alert(
            'Google Sign-In',
            'Connect your Google Account to create your FellowGrad account seamlessly.',
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
                    const googleEmail = (email || 'student@gmail.com').trim().toLowerCase();
                    await signInWithGoogle({
                      token: `mock_google_${Date.now()}`,
                      email: googleEmail,
                      name: fullName.trim() || googleEmail.split('@')[0],
                    });
                  } catch (gErr: any) {
                    setErrorMessage(gErr.message || 'Google Sign-In could not be completed.');
                  } finally {
                    setIsGoogleLoading(false);
                  }
                },
              },
            ]
          );
    } catch (e: any) {
      setErrorMessage(e.message || 'Google Sign-In failed');
      setIsGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070913" />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Welcome')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backIcon}>❮</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Set up your profile to start voice conversations with your personal assistant.
            </Text>
          </View>

          {/* Inline Error Display */}
          {!!errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.formCard}>
            {/* Full Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Anbu Selvan"
                placeholderTextColor="#5C6682"
                value={fullName}
                onChangeText={(text) => {
                  setFullName(text);
                  if (errorMessage) setErrorMessage('');
                }}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>

            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>College or Personal Email</Text>
              <TextInput
                style={styles.input}
                placeholder="student@college.edu"
                placeholderTextColor="#5C6682"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage('');
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="At least 8 characters"
                  placeholderTextColor="#5C6682"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                <TouchableOpacity
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBars}>
                    <View
                      style={[
                        styles.strengthSegment,
                        passwordStrength.level >= 1 && { backgroundColor: passwordStrength.color },
                      ]}
                    />
                    <View
                      style={[
                        styles.strengthSegment,
                        passwordStrength.level >= 2 && { backgroundColor: passwordStrength.color },
                      ]}
                    />
                    <View
                      style={[
                        styles.strengthSegment,
                        passwordStrength.level >= 3 && { backgroundColor: passwordStrength.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </Text>
                </View>
              )}
            </View>

            {/* Confirm Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Repeat password"
                placeholderTextColor="#5C6682"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errorMessage) setErrorMessage('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, (isLoading || isGoogleLoading) && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading || isGoogleLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Create Account"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or sign up with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[styles.googleButton, isGoogleLoading && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={isLoading || isGoogleLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Sign up with Google"
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
                  <Text style={styles.googleButtonText}>Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Switch to Login */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;
