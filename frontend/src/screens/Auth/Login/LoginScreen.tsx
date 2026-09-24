import React, { useState } from 'react';
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
import styles from './LoginScreen.scss';
import { useAuth } from '../../../context/AuthContext';
import authApi from '../../../services/api/authApi';

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();

  const handleLogin = async () => {
    setErrorMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: cleanEmail, password });
    } catch (e: any) {
      // Map error to user-friendly message
      const msg = e.message || '';
      if (msg.includes('Invalid email or password') || msg.includes('Bad credentials') || msg.includes('User not found')) {
        setErrorMessage('Unable to sign in. Please check your email and password.');
      } else if (msg.includes('connection') || msg.includes('network')) {
        setErrorMessage('Unable to reach FellowGrad. Please check your internet connection.');
      } else {
        setErrorMessage('Unable to sign in. Please check your credentials and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt
      ? Alert.prompt(
          'Reset Password',
          'Enter your email address to receive password reset instructions:',
          async (inputEmail) => {
            if (inputEmail && inputEmail.trim()) {
              try {
                await authApi.forgotPassword(inputEmail.trim());
                Alert.alert('Instructions Dispatched', 'If an account exists with that email, instructions have been sent.');
              } catch (_) {
                Alert.alert('Notice', 'Password reset instructions have been dispatched.');
              }
            }
          },
          'plain-text',
          email
        )
      : Alert.alert(
          'Reset Password',
          'Password reset instructions can be dispatched to your registered email address.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Send to ' + (email || 'Email'),
              onPress: async () => {
                if (email) {
                  await authApi.forgotPassword(email.trim()).catch(() => {});
                  Alert.alert('Dispatched', 'Password reset instructions dispatched.');
                } else {
                  Alert.alert('Email Required', 'Please enter your email in the field first.');
                }
              },
            },
          ]
        );
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
          {/* Back button to Welcome */}
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
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to continue speaking with your personal assistant.
            </Text>
          </View>

          {/* Inline Error Display */}
          {!!errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <View style={styles.formCard}>
            {/* Email Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
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
              <View style={styles.passwordLabelRow}>
                <Text style={styles.inputLabel}>Password</Text>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.passwordInputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor="#5C6682"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Sign In"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Switch to Register */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New to FellowGrad? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
