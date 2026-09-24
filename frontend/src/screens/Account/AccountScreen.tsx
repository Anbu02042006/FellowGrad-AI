import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import styles from './AccountScreen.scss';
import { useAuth } from '../../context/AuthContext';
import userApi from '../../services/api/userApi';

interface AccountScreenProps {
  navigation: any;
}

const AccountScreen: React.FC<AccountScreenProps> = ({ navigation }) => {
  const { user, logout, updateProfile, changePassword, deleteAccount } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [interests, setInterests] = useState('');
  const [goals, setGoals] = useState('');

  // Change Password Modal
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Load existing profile details
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await userApi.getMeProfile();
        const data = res.data;
        if (data) {
          setFullName(data.fullName || data.name || user?.name || '');
          setEmail(data.email || user?.email || '');
          setCollege(data.academicProfile?.college || data.college || '');
          setCourse(data.academicProfile?.course || data.course || '');
          setYear(data.academicProfile?.year || data.educationLevel || '');
          const intList = data.academicProfile?.interests || (typeof data.interests === 'string' ? [data.interests] : []);
          setInterests(Array.isArray(intList) ? intList.join(', ') : '');
          const goalList = data.academicProfile?.goals || (typeof data.careerGoals === 'string' ? [data.careerGoals] : []);
          setGoals(Array.isArray(goalList) ? goalList.join(', ') : '');
        }
      } catch (e) {
        // Fallback to auth user state
        setFullName(user?.name || '');
        setEmail(user?.email || '');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleSaveChanges = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation', 'Full name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        name: fullName.trim(),
        academicProfile: {
          college: college.trim(),
          course: course.trim(),
          year: year.trim(),
          interests: interests.split(',').map((s) => s.trim()).filter(Boolean),
          goals: goals.split(',').map((s) => s.trim()).filter(Boolean),
        },
      });
      Alert.alert('Success', 'Profile and academic details updated successfully.');
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePasswordSubmit = async () => {
    setPasswordError('');
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must contain at least 8 characters');
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError('New password must contain uppercase, lowercase, and numbers');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert('Success', 'Your password has been changed successfully.');
    } catch (e: any) {
      setPasswordError(e.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to end your session?',
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
              Alert.alert('Error', err.message || 'Failed to delete account.');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#070913" />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.backIcon}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account & Profile</Text>
        <TouchableOpacity
          onPress={handleSaveChanges}
          disabled={isSaving}
          activeOpacity={0.7}
        >
          <Text style={styles.saveHeaderButton}>{isSaving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Avatar Hero */}
        <View style={styles.avatarHero}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {fullName ? fullName.charAt(0).toUpperCase() : '👤'}
            </Text>
          </View>
          <Text style={styles.heroName}>{fullName || 'Student'}</Text>
          <Text style={styles.heroEmail}>{email}</Text>
        </View>

        {/* Section 1: Personal Details */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>PERSONAL INFORMATION</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor="#5C6682"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address (Verified)</Text>
            <TextInput
              style={[styles.input, styles.inputReadOnly]}
              value={email}
              editable={false}
              placeholderTextColor="#5C6682"
            />
            <Text style={styles.fieldNote}>Email cannot be changed directly for security reasons.</Text>
          </View>
        </View>

        {/* Section 2: Academic Profile */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>ACADEMIC PROFILE</Text>
          <Text style={styles.sectionDescription}>
            Your assistant uses your background profile to naturally calibrate explanations, project ideas, and advice.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>College / University</Text>
            <TextInput
              style={styles.input}
              value={college}
              onChangeText={setCollege}
              placeholder="e.g. Anna University, IIT Madras"
              placeholderTextColor="#5C6682"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Degree & Course</Text>
            <TextInput
              style={styles.input}
              value={course}
              onChangeText={setCourse}
              placeholder="e.g. B.Tech Computer Science"
              placeholderTextColor="#5C6682"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Year / Semester</Text>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder="e.g. 3rd Year / 6th Sem"
              placeholderTextColor="#5C6682"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Interests & Topics (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={interests}
              onChangeText={setInterests}
              placeholder="e.g. Machine Learning, Distributed Systems, Web3"
              placeholderTextColor="#5C6682"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Academic & Career Goals</Text>
            <TextInput
              style={styles.input}
              value={goals}
              onChangeText={setGoals}
              placeholder="e.g. Prepare for product placement interviews"
              placeholderTextColor="#5C6682"
            />
          </View>
        </View>

        {/* Section 3: Security & Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>SECURITY</Text>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => setPasswordModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.menuRowLeft}>
              <Text style={styles.menuIcon}>🔑</Text>
              <Text style={styles.menuTitle}>Change Password</Text>
            </View>
            <Text style={styles.arrow}>❯</Text>
          </TouchableOpacity>
        </View>

        {/* Section 4: Account Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.saveActionButton}
            onPress={handleSaveChanges}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveActionText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={isPasswordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {!!passwordError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{passwordError}</Text>
              </View>
            )}

            <View style={styles.modalInputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="••••••••"
                placeholderTextColor="#5C6682"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.inputLabel}>New Password (min 8 chars)</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor="#5C6682"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                secureTextEntry
                value={confirmNewPassword}
                onChangeText={setConfirmNewPassword}
                placeholder="••••••••"
                placeholderTextColor="#5C6682"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setPasswordModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitButton}
                onPress={handleChangePasswordSubmit}
                disabled={isChangingPassword}
              >
                {isChangingPassword ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default AccountScreen;
