import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PanResponder,
  Animated,
} from 'react-native';
import styles from './AgentModal.scss';

const { width, height } = Dimensions.get('window');

interface Agent {
  name: string;
  description: string;
}

const AGENTS: Agent[] = [
  { name: 'Maya', description: 'A witty, creative collaborator with boundless imagination.' },
  { name: 'Simone', description: 'A dynamic, intellectual thought partner with a knack for deep-dives.' },
  { name: 'Charlie', description: 'A friendly, straight talker who helps you work things out.' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (agent: string) => void;
}

const AgentModal = ({ visible, onClose, onSelect }: Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if it's a downward swipe (dy > 0) and vertical (dy > dx)
        return gestureState.dy > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: Animated.event([null, { dy: panY }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          onClose();
          Animated.timing(panY, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }).start();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const scrollOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollOffset / width);
    setActiveIndex(index);
  };

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

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: panY.interpolate({
              inputRange: [0, height],
              outputRange: [0, height],
              extrapolate: 'clamp',
            }) }] }
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>
          <Text style={styles.title}>Select your agent</Text>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            directionalLockEnabled={true}
            keyboardShouldPersistTaps="handled"
          >
            {AGENTS.map((agent, index) => (
              <View key={index} style={[styles.agentCard, { width }]}>
                <View style={styles.agentInfoContainer}>
                  <Text style={styles.agentName}>{agent.name}</Text>
                  <Text style={styles.agentDesc}>{agent.description}</Text>
                </View>
                <View style={styles.dots}>
                  {AGENTS.map((_, i) => (
                    <View
                      key={i}
                      style={[styles.dot, i === activeIndex && styles.activeDot]}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => onSelect(agent.name)}
                >
                  <Text style={styles.selectButtonText}>Select {agent.name}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default AgentModal;
