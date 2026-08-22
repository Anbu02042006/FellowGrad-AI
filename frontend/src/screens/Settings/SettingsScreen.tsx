import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Switch,
} from 'react-native';
import styles from './SettingsScreen.scss';
import { useAuth } from '../../context/AuthContext';

const SettingsScreen = ({ navigation }: any) => {
  const [isShakeEnabled, setShakeEnabled] = useState(true);
  const { user } = useAuth();

  const SettingItem = ({ icon, label, onPress, value, onValueChange, showArrow = true }: any) => (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      disabled={onValueChange !== undefined}
    >
      <View style={styles.itemLeft}>
        <Text style={styles.itemIcon}>{icon}</Text>
        <Text style={styles.itemLabel}>{label}</Text>
      </View>
      {onValueChange ? (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#2A2E45', true: '#4CAF50' }}
          thumbColor="#FFFFFF"
        />
      ) : (
        showArrow && <Text style={styles.arrow}>❯</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>❮</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={styles.profileSection}
          onPress={() => navigation.navigate('Account')}
        >
          <View>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'email@example.com'}</Text>
          </View>
          <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <SettingItem icon="👋" label="What's New" />
          <SettingItem icon="📞" label="Calls" />
          <SettingItem icon="🔒" label="Privacy" />
          <SettingItem icon="🔑" label="Permissions" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <SettingItem icon="💬" label="Share Feedback" />
          <SettingItem
            icon="📱"
            label="Shake to Report"
            value={isShakeEnabled}
            onValueChange={setShakeEnabled}
          />
          <SettingItem icon="📄" label="Terms of Use" />
          <SettingItem icon="🛡️" label="Privacy Policy" />
        </View>

        <View style={styles.versionInfo}>
          <Text style={styles.versionLabel}>FellowGrad</Text>
          <Text style={styles.versionNumber}>1.0.0 (1)</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
