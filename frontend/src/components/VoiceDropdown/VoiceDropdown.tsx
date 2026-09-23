import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import styles from './VoiceDropdown.scss';
import { VOICES } from '../../constants/voices';

interface VoiceDropdownProps {
  selectedVoiceId: string;
  onSelect: (voiceId: string) => void;
  disabled?: boolean;
}

export const VoiceDropdown: React.FC<VoiceDropdownProps> = ({
  selectedVoiceId,
  onSelect,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentVoice = VOICES.find((v) => v.id === selectedVoiceId) || VOICES[0];

  const handleItemPress = (voiceId: string) => {
    onSelect(voiceId);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.dropdownButton, isOpen && styles.dropdownButtonActive]}
        onPress={() => !disabled && setIsOpen((prev) => !prev)}
        activeOpacity={0.75}
        disabled={disabled}
        accessibilityRole="combobox"
        accessibilityLabel={`Voice selector. Currently selected voice: ${currentVoice.displayName}. Double tap to choose another voice.`}
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={styles.labelPrefix}>Voice: </Text>
        <Text style={styles.labelVoiceName}>{currentVoice.displayName}</Text>
        <Text style={styles.arrowIcon}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownMenu}>
                {VOICES.map((voice) => {
                  const isSelected = voice.id === selectedVoiceId;
                  return (
                    <TouchableOpacity
                      key={voice.id}
                      style={[
                        styles.voiceItem,
                        isSelected && styles.voiceItemActive,
                      ]}
                      onPress={() => handleItemPress(voice.id)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Select voice ${voice.displayName}`}
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.voiceName,
                          isSelected && styles.voiceNameActive,
                        ]}
                      >
                        {voice.displayName}
                      </Text>
                      {isSelected && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default VoiceDropdown;
