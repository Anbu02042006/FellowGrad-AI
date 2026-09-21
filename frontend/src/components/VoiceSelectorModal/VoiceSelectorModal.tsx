import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import styles from './VoiceSelectorModal.scss';
import { VOICES, VoiceOption } from '../../constants/voices';

interface Props {
  visible: boolean;
  selectedVoiceId: string;
  onClose: () => void;
  onSelect: (voiceId: string) => void;
}

const VoiceSelectorModal: React.FC<Props> = ({
  visible,
  selectedVoiceId,
  onClose,
  onSelect,
}) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackground} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContainer}>
          {/* Top drag handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Assistant Voice</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Close voice selector"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Choose Maya's tone of voice
          </Text>

          {/* 4 Selectable Voice Cards */}
          <ScrollView
            style={styles.voiceList}
            showsVerticalScrollIndicator={false}
          >
            {VOICES.map((voice: VoiceOption) => {
              const isSelected = voice.id === selectedVoiceId;

              return (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceCard,
                    isSelected && styles.voiceCardSelected,
                  ]}
                  onPress={() => onSelect(voice.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.voiceLeft}>
                    <View
                      style={[
                        styles.avatarCircle,
                        isSelected && styles.avatarCircleSelected,
                      ]}
                    >
                      <Text style={styles.avatarIcon}>{voice.icon}</Text>
                    </View>

                    <View style={styles.voiceInfo}>
                      <View style={styles.voiceNameRow}>
                        <Text style={styles.voiceLabel}>{voice.label}</Text>
                        {voice.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.voiceSubtitle}>{voice.subtitle}</Text>
                      <Text style={styles.voiceDescription}>
                        {voice.description}
                      </Text>
                    </View>
                  </View>

                  {/* Radio indicator */}
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && (
                      <Text style={styles.radioCheckmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default VoiceSelectorModal;
