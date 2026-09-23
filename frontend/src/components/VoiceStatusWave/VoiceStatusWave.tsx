import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import styles from './VoiceStatusWave.scss';

interface VoiceStatusWaveProps {
  isSpeaking: boolean;
}

export const VoiceStatusWave: React.FC<VoiceStatusWaveProps> = ({ isSpeaking }) => {
  // 4 wave bars on each side
  const barAnim1 = useRef(new Animated.Value(0.4)).current;
  const barAnim2 = useRef(new Animated.Value(0.7)).current;
  const barAnim3 = useRef(new Animated.Value(0.5)).current;
  const barAnim4 = useRef(new Animated.Value(0.8)).current;

  // Text fade / breathing animation
  const textPulse = useRef(new Animated.Value(0.85)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (animRef.current) {
      animRef.current.stop();
    }

    if (isSpeaking) {
      // Dynamic, varied speech cadence animation
      const speakingAnim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(barAnim1, {
              toValue: 1.0,
              duration: 280,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim1, {
              toValue: 0.25,
              duration: 250,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(120),
            Animated.timing(barAnim2, {
              toValue: 0.95,
              duration: 320,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim2, {
              toValue: 0.3,
              duration: 260,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(60),
            Animated.timing(barAnim3, {
              toValue: 1.15,
              duration: 290,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim3, {
              toValue: 0.2,
              duration: 310,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(180),
            Animated.timing(barAnim4, {
              toValue: 0.85,
              duration: 300,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim4, {
              toValue: 0.25,
              duration: 270,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(textPulse, {
              toValue: 1.0,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(textPulse, {
              toValue: 0.9,
              duration: 400,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animRef.current = speakingAnim;
      speakingAnim.start();
    } else {
      // Gentle, smooth undulating listening wave
      const listeningAnim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(barAnim1, {
              toValue: 0.85,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim1, {
              toValue: 0.35,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(200),
            Animated.timing(barAnim2, {
              toValue: 0.95,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim2, {
              toValue: 0.4,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(barAnim3, {
              toValue: 0.8,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim3, {
              toValue: 0.3,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(100),
            Animated.timing(barAnim4, {
              toValue: 0.7,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(barAnim4, {
              toValue: 0.25,
              duration: 700,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(textPulse, {
              toValue: 1.0,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(textPulse, {
              toValue: 0.8,
              duration: 800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animRef.current = listeningAnim;
      listeningAnim.start();
    }

    return () => {
      if (animRef.current) {
        animRef.current.stop();
      }
    };
  }, [isSpeaking]);

  const barStyle = isSpeaking ? styles.waveBarSpeaking : styles.waveBarListening;
  const wavyStyle = isSpeaking ? styles.wavySymbolSpeaking : styles.wavySymbolListening;
  const textStyle = isSpeaking ? styles.statusTextSpeaking : styles.statusTextListening;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={isSpeaking ? 'Assistant is speaking' : 'Assistant is listening'}
    >
      <View style={styles.statusRow}>
        <Text style={[styles.wavySymbol, wavyStyle]}>〰</Text>

        <View style={styles.barsContainer}>
          <Animated.View style={[styles.waveBar, barStyle, { transform: [{ scaleY: barAnim1 }] }]} />
          <Animated.View style={[styles.waveBar, barStyle, { transform: [{ scaleY: barAnim2 }] }]} />
          <Animated.View style={[styles.waveBar, barStyle, { transform: [{ scaleY: barAnim3 }] }]} />
        </View>

        <Animated.Text style={[styles.statusText, textStyle, { opacity: textPulse }]}>
          {isSpeaking ? 'Speaking...' : 'Listening...'}
        </Animated.Text>

        <View style={styles.barsContainer}>
          <Animated.View style={[styles.waveBar, barStyle, { transform: [{ scaleY: barAnim3 }] }]} />
          <Animated.View style={[styles.waveBar, barStyle, { transform: [{ scaleY: barAnim2 }] }]} />
          <Animated.View style={[styles.waveBar, barStyle, { transform: [{ scaleY: barAnim1 }] }]} />
        </View>

        <Text style={[styles.wavySymbol, wavyStyle]}>〰</Text>
      </View>
    </View>
  );
};

export default VoiceStatusWave;
