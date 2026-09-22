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
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalBackground} />
        </TouchableWithoutFeedback>

        <View style={styles.modalContainer}>
          {/* Top sheet handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Companion Voice</Text>
              <Text style={styles.subtitle}>Choose Maya's tone of voice</Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close voice selector"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

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
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${voice.label} voice, ${voice.subtitle}.${isSelected ? ' Currently selected.' : ''}`}
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
                        <Text
                          style={[
                            styles.voiceLabel,
                            isSelected && styles.voiceLabelSelected,
                          ]}
                        >
                          {voice.label}
                        </Text>
                        {voice.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.voiceSubtitle}>{voice.subtitle}</Text>
                    </View>
                  </View>

                  {/* Radio checkmark indicator */}
                  <View
                    style={[
                      styles.radioCircle,
                      isSelected && styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && (
                      <View style={styles.radioInnerDot} />
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
