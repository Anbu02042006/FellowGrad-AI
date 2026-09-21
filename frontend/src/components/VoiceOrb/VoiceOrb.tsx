import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { AssistantState } from '../../hooks/useVoiceAssistant';

interface VoiceOrbProps {
  state: AssistantState;
  isIncognito?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, isIncognito = false }) => {
  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const outerRippleAnim = useRef(new Animated.Value(1)).current;
  const outerRippleOpacity = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  // Active loop reference for cleanup
  const currentAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Stop any existing loop
    if (currentAnimation.current) {
      currentAnimation.current.stop();
    }

    switch (state) {
      case AssistantState.LISTENING: {
        // Subtle, responsive expanding pulse
        const listeningLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.15,
                duration: 900,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 1.0,
                duration: 900,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.9,
                duration: 900,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.45,
                duration: 900,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.parallel([
                Animated.timing(outerRippleAnim, {
                  toValue: 1.45,
                  duration: 1800,
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity, {
                    toValue: 0.35,
                    duration: 400,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity, {
                    toValue: 0,
                    duration: 1400,
                    useNativeDriver: true,
                  }),
                ]),
              ]),
              Animated.timing(outerRippleAnim, {
                toValue: 1.0,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ])
        );
        currentAnimation.current = listeningLoop;
        listeningLoop.start();
        break;
      }

      case AssistantState.THINKING: {
        // Continuous smooth rotation & breathing
        const thinkingLoop = Animated.loop(
          Animated.parallel([
            Animated.timing(rotationAnim, {
              toValue: 1,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.06,
                duration: 1200,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.96,
                duration: 1200,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.75,
                duration: 1200,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.3,
                duration: 1200,
                useNativeDriver: true,
              }),
            ]),
          ])
        );
        currentAnimation.current = thinkingLoop;
        thinkingLoop.start();
        break;
      }

      case AssistantState.SPEAKING: {
        // Energetic waveform / rhythmic pulses
        const speakingLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.22,
                duration: 420,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.98,
                duration: 380,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 1.14,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 1.0,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 1.0,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.5,
                duration: 400,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.parallel([
                Animated.timing(outerRippleAnim, {
                  toValue: 1.6,
                  duration: 800,
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity, {
                    toValue: 0.45,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                  }),
                ]),
              ]),
              Animated.timing(outerRippleAnim, {
                toValue: 1.0,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
          ])
        );
        currentAnimation.current = speakingLoop;
        speakingLoop.start();
        break;
      }

      case AssistantState.CONNECTING: {
        const connectingLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 0.8,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.2,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        );
        currentAnimation.current = connectingLoop;
        connectingLoop.start();
        break;
      }

      case AssistantState.IDLE:
      default: {
        // Soft floating idle glow
        const idleLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.04,
                duration: 2400,
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.98,
                duration: 2400,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.5,
                duration: 2400,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.25,
                duration: 2400,
                useNativeDriver: true,
              }),
            ]),
          ])
        );
        currentAnimation.current = idleLoop;
        idleLoop.start();
        break;
      }
    }

    return () => {
      if (currentAnimation.current) {
        currentAnimation.current.stop();
      }
    };
  }, [state]);

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // State colors
  let orbCoreColor = '#6C63FF';
  let orbAuraColor = 'rgba(108, 99, 255, 0.45)';
  let rippleColor = 'rgba(108, 99, 255, 0.3)';

  if (isIncognito) {
    orbCoreColor = '#9E77ED';
    orbAuraColor = 'rgba(158, 119, 237, 0.45)';
    rippleColor = 'rgba(158, 119, 237, 0.3)';
  } else if (state === AssistantState.LISTENING) {
    orbCoreColor = '#5B8DEF';
    orbAuraColor = 'rgba(91, 141, 239, 0.55)';
    rippleColor = 'rgba(91, 141, 239, 0.35)';
  } else if (state === AssistantState.THINKING) {
    orbCoreColor = '#7F56D9';
    orbAuraColor = 'rgba(127, 86, 217, 0.55)';
    rippleColor = 'rgba(127, 86, 217, 0.35)';
  } else if (state === AssistantState.SPEAKING) {
    orbCoreColor = '#8E59FF';
    orbAuraColor = 'rgba(142, 89, 255, 0.65)';
    rippleColor = 'rgba(142, 89, 255, 0.4)';
  } else if (state === AssistantState.ERROR) {
    orbCoreColor = '#F04438';
    orbAuraColor = 'rgba(240, 68, 56, 0.5)';
    rippleColor = 'rgba(240, 68, 56, 0.3)';
  }

  return (
    <View style={styles.container}>
      {/* Expanding Outer Ripple Waveform */}
      <Animated.View
        style={[
          styles.outerRipple,
          {
            backgroundColor: rippleColor,
            borderColor: orbCoreColor,
            opacity: outerRippleOpacity,
            transform: [{ scale: outerRippleAnim }],
          },
        ]}
      />

      {/* Atmospheric Outer Glow */}
      <Animated.View
        style={[
          styles.auraGlow,
          {
            backgroundColor: orbAuraColor,
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Rotating Ring for Thinking state */}
      {state === AssistantState.THINKING && (
        <Animated.View
          style={[
            styles.thinkingRing,
            {
              borderColor: orbCoreColor,
              transform: [{ rotate: spin }],
            },
          ]}
        />
      )}

      {/* Core Orb */}
      <Animated.View
        style={[
          styles.coreOrb,
          {
            backgroundColor: orbCoreColor,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        <View style={styles.innerGlassHighlight} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerRipple: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
  },
  auraGlow: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 77.5,
  },
  thinkingRing: {
    position: 'absolute',
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 2.5,
    borderStyle: 'dashed',
  },
  coreOrb: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 12,
  },
  innerGlassHighlight: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    top: -8,
    left: -4,
  },
});

export default VoiceOrb;
