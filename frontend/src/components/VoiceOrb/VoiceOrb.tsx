import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { AssistantState } from '../../hooks/useVoiceAssistant';

interface VoiceOrbProps {
  state: AssistantState;
  isIncognito?: boolean;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, isIncognito = false }) => {
  // Animation drivers
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const outerRippleAnim1 = useRef(new Animated.Value(1)).current;
  const outerRippleOpacity1 = useRef(new Animated.Value(0)).current;
  const outerRippleAnim2 = useRef(new Animated.Value(1)).current;
  const outerRippleOpacity2 = useRef(new Animated.Value(0)).current;
  const rotationAnim1 = useRef(new Animated.Value(0)).current;
  const rotationAnim2 = useRef(new Animated.Value(0)).current;
  const stardustAnim = useRef(new Animated.Value(0.4)).current;

  // Active composite animation reference for clean teardown
  const currentAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Teardown previous loop cleanly
    if (currentAnimation.current) {
      currentAnimation.current.stop();
    }

    rotationAnim1.setValue(0);
    rotationAnim2.setValue(0);

    // Continuous stardust shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(stardustAnim, {
          toValue: 0.9,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(stardustAnim, {
          toValue: 0.35,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Constant slow background rotation for ethereal organic fluid feeling
    Animated.loop(
      Animated.timing(rotationAnim1, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.timing(rotationAnim2, {
        toValue: 1,
        duration: 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    switch (state) {
      case AssistantState.LISTENING: {
        const listeningLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.12,
                duration: 900,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.98,
                duration: 900,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.9,
                duration: 900,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.5,
                duration: 900,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            // Ripple wave 1
            Animated.sequence([
              Animated.parallel([
                Animated.timing(outerRippleAnim1, {
                  toValue: 1.5,
                  duration: 1800,
                  easing: Easing.out(Easing.quad),
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0.5,
                    duration: 400,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0,
                    duration: 1400,
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
        const thinkingLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.08,
                duration: 1100,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.94,
                duration: 1100,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.85,
                duration: 1100,
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.45,
                duration: 1100,
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
                toValue: 0.55,
                duration: 360,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.parallel([
                Animated.timing(outerRippleAnim1, {
                  toValue: 1.65,
                  duration: 800,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0.55,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity1, {
                    toValue: 0,
                    duration: 600,
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
            Animated.sequence([
              Animated.delay(350),
              Animated.parallel([
                Animated.timing(outerRippleAnim2, {
                  toValue: 1.5,
                  duration: 800,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.sequence([
                  Animated.timing(outerRippleOpacity2, {
                    toValue: 0.45,
                    duration: 200,
                    useNativeDriver: true,
                  }),
                  Animated.timing(outerRippleOpacity2, {
                    toValue: 0,
                    duration: 600,
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
              toValue: 0.8,
              duration: 550,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.25,
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
        const idleLoop = Animated.loop(
          Animated.parallel([
            Animated.sequence([
              Animated.timing(pulseAnim, {
                toValue: 1.05,
                duration: 2400,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(pulseAnim, {
                toValue: 0.97,
                duration: 2400,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(glowAnim, {
                toValue: 0.65,
                duration: 2400,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(glowAnim, {
                toValue: 0.35,
                duration: 2400,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const spin1 = rotationAnim1.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spin2 = rotationAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  // Color configurations based on state & incognito
  const isIncognitoMode = isIncognito;
  const primaryAuraColor = isIncognitoMode
    ? 'rgba(168, 85, 247, 0.45)'
    : state === AssistantState.ERROR
    ? 'rgba(239, 68, 68, 0.45)'
    : 'rgba(59, 130, 246, 0.55)';

  const rippleColor = isIncognitoMode
    ? 'rgba(168, 85, 247, 0.3)'
    : state === AssistantState.ERROR
    ? 'rgba(239, 68, 68, 0.3)'
    : 'rgba(37, 99, 235, 0.35)';

  const primaryGradientColors = isIncognitoMode
    ? { stop1: '#C084FC', stop2: '#7E22CE', stop3: '#3B0764' }
    : state === AssistantState.ERROR
    ? { stop1: '#F87171', stop2: '#DC2626', stop3: '#7F1D1D' }
    : { stop1: '#60A5FA', stop2: '#2563EB', stop3: '#1E3A8A' };

  const secondaryGradientColors = isIncognitoMode
    ? { stop1: '#E879F9', stop2: '#9333EA', stop3: '#4C1D95' }
    : { stop1: '#A78BFA', stop2: '#3B82F6', stop3: '#1D4ED8' };

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={`Maya AI Companion, state is ${state.toLowerCase()}${isIncognito ? ', incognito mode' : ''}`}
    >
      {/* Outer Soundwave Ripple 1 */}
      <Animated.View
        style={[
          styles.outerRipple,
          {
            backgroundColor: rippleColor,
            borderColor: primaryGradientColors.stop1,
            opacity: outerRippleOpacity1,
            transform: [{ scale: outerRippleAnim1 }],
          },
        ]}
      />

      {/* Outer Soundwave Ripple 2 */}
      <Animated.View
        style={[
          styles.outerRipple,
          {
            backgroundColor: rippleColor,
            borderColor: primaryGradientColors.stop1,
            opacity: outerRippleOpacity2,
            transform: [{ scale: outerRippleAnim2 }],
          },
        ]}
      />

      {/* Atmospheric Luminous Aura Glow */}
      <Animated.View
        style={[
          styles.auraGlow,
          {
            backgroundColor: primaryAuraColor,
            opacity: glowAnim,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Stardust particles ring */}
      <Animated.View
        style={[
          styles.stardustContainer,
          {
            opacity: stardustAnim,
          },
        ]}
      >
        <Svg width="270" height="270" viewBox="0 0 270 270">
          <Circle cx="135" cy="18" r="1.6" fill="#93C5FD" opacity="0.8" />
          <Circle cx="196" cy="42" r="1.3" fill="#A78BFA" opacity="0.65" />
          <Circle cx="242" cy="100" r="1.8" fill="#60A5FA" opacity="0.9" />
          <Circle cx="248" cy="165" r="1.4" fill="#C4B5FD" opacity="0.75" />
          <Circle cx="215" cy="225" r="1.7" fill="#93C5FD" opacity="0.85" />
          <Circle cx="145" cy="254" r="1.3" fill="#60A5FA" opacity="0.7" />
          <Circle cx="80" cy="246" r="1.6" fill="#A78BFA" opacity="0.8" />
          <Circle cx="30" cy="190" r="1.4" fill="#93C5FD" opacity="0.75" />
          <Circle cx="24" cy="115" r="1.8" fill="#60A5FA" opacity="0.9" />
          <Circle cx="64" cy="52" r="1.5" fill="#C4B5FD" opacity="0.7" />
        </Svg>
      </Animated.View>

      {/* Rotating Fluid Petal Nebula Layer 1 */}
      <Animated.View
        style={[
          styles.petalLayer,
          {
            transform: [{ rotate: spin1 }, { scale: pulseAnim }],
          },
        ]}
      >
        <Svg width="220" height="220" viewBox="0 0 220 220">
          <Defs>
            <LinearGradient id="orbGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={secondaryGradientColors.stop1} stopOpacity="0.7" />
              <Stop offset="50%" stopColor={secondaryGradientColors.stop2} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={secondaryGradientColors.stop3} stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          {/* Organic flowing curved flower petal shapes */}
          <Path
            d="M 110 20 C 145 20, 160 55, 185 75 C 210 95, 205 130, 190 155 C 175 180, 145 195, 110 200 C 75 195, 45 180, 30 155 C 15 130, 10 95, 35 75 C 60 55, 75 20, 110 20 Z"
            fill="url(#orbGrad1)"
          />
        </Svg>
      </Animated.View>

      {/* Counter-Rotating Fluid Petal Nebula Layer 2 */}
      <Animated.View
        style={[
          styles.petalLayer,
          {
            transform: [{ rotate: spin2 }, { scale: pulseAnim }],
          },
        ]}
      >
        <Svg width="200" height="200" viewBox="0 0 200 200">
          <Defs>
            <LinearGradient id="orbGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={primaryGradientColors.stop1} stopOpacity="0.85" />
              <Stop offset="60%" stopColor={primaryGradientColors.stop2} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={primaryGradientColors.stop3} stopOpacity="0.2" />
            </LinearGradient>
          </Defs>
          {/* Interlocking organic petal flower shape */}
          <Path
            d="M 100 15 C 130 15, 150 45, 170 65 C 190 85, 190 120, 175 145 C 160 170, 130 185, 100 185 C 70 185, 40 170, 25 145 C 10 120, 10 85, 30 65 C 50 45, 70 15, 100 15 Z"
            fill="url(#orbGrad2)"
          />
        </Svg>
      </Animated.View>

      {/* Glowing Inner Core Fluid Disk */}
      <Animated.View
        style={[
          styles.innerCoreCircle,
          {
            transform: [{ scale: pulseAnim }],
            shadowColor: primaryGradientColors.stop1,
          },
        ]}
      >
        <Svg width="150" height="150" viewBox="0 0 150 150">
          <Defs>
            <LinearGradient id="innerCoreGrad" x1="20%" y1="0%" x2="80%" y2="100%">
              <Stop offset="0%" stopColor="#93C5FD" stopOpacity="0.95" />
              <Stop offset="35%" stopColor={primaryGradientColors.stop1} stopOpacity="0.85" />
              <Stop offset="80%" stopColor={primaryGradientColors.stop2} stopOpacity="0.9" />
              <Stop offset="100%" stopColor={primaryGradientColors.stop3} stopOpacity="0.95" />
            </LinearGradient>
          </Defs>
          <Circle cx="75" cy="75" r="70" fill="url(#innerCoreGrad)" />
        </Svg>

        {/* Center Microphone Vector Icon */}
        <View style={styles.micCenterIcon}>
          <Svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            {/* Microphone Capsule */}
            <Path
              d="M12 2C10.34 2 9 3.34 9 5V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V5C15 3.34 13.66 2 12 2Z"
              fill="#FFFFFF"
            />
            {/* Microphone Pickup Arc */}
            <Path
              d="M19 10V12C19 15.87 15.87 19 12 19C8.13 19 5 15.87 5 12V10M12 19V22M8 22H16"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 270,
    height: 270,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerRipple: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5,
  },
  auraGlow: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
  },
  stardustContainer: {
    position: 'absolute',
    width: 270,
    height: 270,
    justifyContent: 'center',
    alignItems: 'center',
  },
  petalLayer: {
    position: 'absolute',
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCoreCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
    elevation: 16,
  },
  micCenterIcon: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VoiceOrb;
