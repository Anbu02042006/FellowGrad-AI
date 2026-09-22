import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { AssistantState } from '../../hooks/useVoiceAssistant';

interface VoiceOrbProps {
  state: AssistantState;
  isIncognito?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, isIncognito = false }) => {
  // Animation drivers
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const outerRippleAnim1 = useRef(new Animated.Value(1)).current;
  const outerRippleOpacity1 = useRef(new Animated.Value(0)).current;
  const outerRippleAnim2 = useRef(new Animated.Value(1)).current;
  const outerRippleOpacity2 = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const counterRotationAnim = useRef(new Animated.Value(0)).current;

  // Active composite animation reference for clean teardown
  const currentAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Teardown previous loop cleanly
    if (currentAnimation.current) {
      currentAnimation.current.stop();
    }

    // Reset rotation values
    rotationAnim.setValue(0);
    counterRotationAnim.setValue(0);

    switch (state) {
      case AssistantState.LISTENING: {
        // Subtle, responsive expanding pulse with soft expanding ripples
        const listeningLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.14,
                duration: 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 1.0,
                duration: 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.85,
                duration: 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.4,
                duration: 1000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.parallel([
                Animated.timing(outerRippleAnim1, {
                  toValue: 1.45,
                  duration: 2000,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0.4,
                    duration: 400,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0,
                    duration: 1600,
                    useNativeDriver: true,
                  }),
                ]),
              ]),
              Animated.timing(outerRippleAnim1, {
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

      case AssistantState.THINKING:
      case AssistantState.PROCESSING: {
        // Continuous smooth dual-orbit rotation and organic breathing
        const thinkingLoop = Animated.loop(
          Animated.parallel([
            Animated.timing(rotationAnim, {
              toValue: 1,
              duration: 3200,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(counterRotationAnim, {
              toValue: 1,
              duration: 2400,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.08,
                duration: 1200,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.94,
                duration: 1200,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.8,
                duration: 1200,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.35,
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
        // Dynamic rhythmic pulse with dual staggered audio waveform ripples
        const speakingLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.20,
                duration: 380,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.96,
                duration: 360,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 1.15,
                duration: 380,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 1.0,
                duration: 380,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 1.0,
                duration: 380,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.5,
                duration: 360,
                useNativeDriver: true,
              }),
            ]),
            // Ripple 1
            Animated.sequence([
              Animated.parallel([
                Animated.timing(outerRippleAnim1, {
                  toValue: 1.6,
                  duration: 750,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0.5,
                    duration: 180,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0,
                    duration: 570,
                    useNativeDriver: true,
                  }),
                ]),
              ]),
              Animated.timing(outerRippleAnim1, {
                toValue: 1.0,
                duration: 0,
                useNativeDriver: true,
              }),
            ]),
            // Staggered Ripple 2
            Animated.sequence([
              Animated.delay(350),
              Animated.parallel([
                Animated.timing(outerRippleAnim2, {
                  toValue: 1.5,
                  duration: 750,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity2, {
                    toValue: 0.4,
                    duration: 180,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity2, {
                    toValue: 0,
                    duration: 570,
                    useNativeDriver: true,
                  }),
                ]),
              ]),
              Animated.timing(outerRippleAnim2, {
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
              toValue: 0.75,
              duration: 550,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.2,
              duration: 550,
              easing: Easing.inOut(Easing.ease),
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
        // Soft floating idle breathing glow
        const idleLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.05,
                duration: 2500,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.97,
                duration: 2500,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.55,
                duration: 2500,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.25,
                duration: 2500,
                easing: Easing.inOut(Easing.sin),
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

  const counterSpin = counterRotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  // State colors
  let orbCoreColor = '#6C63FF';
  let orbAuraColor = 'rgba(108, 99, 255, 0.45)';
  let rippleColor = 'rgba(108, 99, 255, 0.3)';
  let ringBorderColor = '#8E59FF';

  if (isIncognito) {
    orbCoreColor = '#9E77ED';
    orbAuraColor = 'rgba(158, 119, 237, 0.45)';
    rippleColor = 'rgba(158, 119, 237, 0.3)';
    ringBorderColor = '#B692F6';
  } else if (state === AssistantState.LISTENING || state === AssistantState.INTERRUPTED) {
    orbCoreColor = '#5B8DEF';
    orbAuraColor = 'rgba(91, 141, 239, 0.55)';
    rippleColor = 'rgba(91, 141, 239, 0.35)';
    ringBorderColor = '#7DA9F5';
  } else if (state === AssistantState.THINKING || state === AssistantState.PROCESSING) {
    orbCoreColor = '#7F56D9';
    orbAuraColor = 'rgba(127, 86, 217, 0.55)';
    rippleColor = 'rgba(127, 86, 217, 0.35)';
    ringBorderColor = '#9E77ED';
  } else if (state === AssistantState.SPEAKING) {
    orbCoreColor = '#8E59FF';
    orbAuraColor = 'rgba(142, 89, 255, 0.65)';
    rippleColor = 'rgba(142, 89, 255, 0.4)';
    ringBorderColor = '#B692F6';
  } else if (state === AssistantState.ERROR) {
    orbCoreColor = '#F04438';
    orbAuraColor = 'rgba(240, 68, 56, 0.5)';
    rippleColor = 'rgba(240, 68, 56, 0.3)';
    ringBorderColor = '#F97066';
  }

  const isThinking = state === AssistantState.THINKING || state === AssistantState.PROCESSING;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Maya AI Companion, state is ${state.toLowerCase()}${isIncognito ? ', incognito mode' : ''}`}
    >
      {/* Primary Expanding Outer Ripple (Audio Waveform) */}
      <Animated.View
        style={[
          styles.outerRipple,
          {
            backgroundColor: rippleColor,
            borderColor: orbCoreColor,
            opacity: outerRippleOpacity1,
            transform: [{ scale: outerRippleAnim1 }],
          },
        ]}
      />

      {/* Secondary Staggered Ripple */}
      <Animated.View
        style={[
          styles.outerRipple,
          {
            backgroundColor: rippleColor,
            borderColor: orbCoreColor,
            opacity: outerRippleOpacity2,
            transform: [{ scale: outerRippleAnim2 }],
          },
        ]}
      />

      {/* Atmospheric Luminous Aura */}
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

      {/* Primary Rotating Ring for Thinking state */}
      {isThinking && (
        <Animated.View
          style={[
            styles.thinkingRingOuter,
            {
              borderColor: ringBorderColor,
              transform: [{ rotate: spin }],
            },
          ]}
        />
      )}

      {/* Counter-Rotating Inner Ring for Thinking state */}
      {isThinking && (
        <Animated.View
          style={[
            styles.thinkingRingInner,
            {
              borderColor: orbCoreColor,
              transform: [{ rotate: counterSpin }],
            },
          ]}
        />
      )}

      {/* Core Luminous Orb */}
      <Animated.View
        style={[
          styles.coreOrb,
          {
            backgroundColor: orbCoreColor,
            shadowColor: orbCoreColor,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {/* Soft Glass Highlight */}
        <View style={styles.innerGlassHighlight} />
        <View style={styles.innerCoreDot} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerRipple: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1.5,
  },
  auraGlow: {
    position: 'absolute',
    width: 165,
    height: 165,
    borderRadius: 82.5,
  },
  thinkingRingOuter: {
    position: 'absolute',
    width: 156,
    height: 156,
    borderRadius: 78,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  thinkingRingInner: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderStyle: 'dotted',
  },
  coreOrb: {
    width: 124,
    height: 124,
    borderRadius: 62,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 24,
    elevation: 14,
  },
  innerGlassHighlight: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    top: 6,
    left: 8,
  },
  innerCoreDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
});

export default VoiceOrb;
