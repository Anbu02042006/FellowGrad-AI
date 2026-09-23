import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
} from 'react-native';
import styles from './VoiceSelectorModal.scss';
import { VOICES, VoiceOption } from '../../constants/voices';

interface Props {
  visible: boolean;
  selectedVoiceId: string;
  onClose: () => void;
  onSelect: (voiceId: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.72, 280);

const VoiceSelectorModal: React.FC<Props> = ({
  visible,
  selectedVoiceId,
  onClose,
  onSelect,
}) => {
  const [filterGender, setFilterGender] = useState<'all' | 'female' | 'male'>('all');

  const filteredVoices = VOICES.filter((voice) => {
    if (filterGender === 'all') return true;
    return voice.gender === filterGender;
  });

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
          {/* Top sheet pull handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Assistant Voice</Text>
              <Text style={styles.subtitle}>Choose your personal assistant's voice</Text>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Close voice picker"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Gender Filter Tabs */}
          <View style={styles.filterTabsRow}>
            <TouchableOpacity
              style={[styles.filterTab, filterGender === 'all' && styles.filterTabActive]}
              onPress={() => setFilterGender('all')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterGender === 'all' }}
            >
              <Text style={[styles.filterTabText, filterGender === 'all' && styles.filterTabTextActive]}>
                All Voices
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, filterGender === 'female' && styles.filterTabActive]}
              onPress={() => setFilterGender('female')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterGender === 'female' }}
            >
              <Text style={[styles.filterTabText, filterGender === 'female' && styles.filterTabTextActive]}>
                Female (2)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterTab, filterGender === 'male' && styles.filterTabActive]}
              onPress={() => setFilterGender('male')}
              activeOpacity={0.75}
              accessibilityRole="tab"
              accessibilityState={{ selected: filterGender === 'male' }}
            >
              <Text style={[styles.filterTabText, filterGender === 'male' && styles.filterTabTextActive]}>
                Male (2)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal Swiping Voice Carousel */}
          <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
            snapToInterval={CARD_WIDTH + 14}
            decelerationRate="fast"
            style={styles.carouselContainer}
          >
            {filteredVoices.map((voice: VoiceOption) => {
              const isSelected = voice.id === selectedVoiceId;
              const displayName = voice.displayName || voice.label;
              const genderLabel = voice.gender === 'female' ? 'Female voice' : 'Male voice';

              return (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceCard,
                    { width: CARD_WIDTH },
                    isSelected && styles.voiceCardSelected,
                  ]}
                  onPress={() => onSelect(voice.id)}
                  activeOpacity={0.82}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${displayName}, ${genderLabel}, ${voice.subtitle}.${isSelected ? ' Currently selected.' : ' Tap to select.'}`}
                >
                  {/* Top Gender & Default Tag */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.genderTag}>
                      <Text style={styles.genderTagText}>{genderLabel}</Text>
                    </View>
                    {voice.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>

                  {/* Luminous Avatar Icon */}
                  <View
                    style={[
                      styles.avatarCircle,
                      isSelected && styles.avatarCircleSelected,
                    ]}
                  >
                    <Text style={styles.avatarIcon}>{voice.icon}</Text>
                  </View>

                  {/* Voice Display Name */}
                  <Text style={[styles.voiceName, isSelected && styles.voiceNameSelected]}>
                    {displayName}
                  </Text>

                  {/* Voice Tone Subtitle */}
                  <Text style={styles.voiceSubtitle}>{voice.subtitle}</Text>

                  {/* Tone Full Description */}
                  <Text style={styles.voiceDescription}>{voice.description}</Text>

                  {/* Selection Button / Status Indicator */}
                  <View
                    style={[
                      styles.selectBadge,
                      isSelected ? styles.selectBadgeActive : styles.selectBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectBadgeText,
                        isSelected ? styles.selectBadgeTextActive : styles.selectBadgeTextInactive,
                      ]}
                    >
                      {isSelected ? '✓ Selected' : 'Select Voice'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Swipe Hint Indicator */}
          <View style={styles.swipeHintContainer}>
            <Text style={styles.swipeHintText}>← swipe to explore voices →</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default VoiceSelectorModal;
