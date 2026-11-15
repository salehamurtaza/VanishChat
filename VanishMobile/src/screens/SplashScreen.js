
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Background, Logo, Wordmark } from '../ui';
import { C } from '../theme';

export default function SplashScreen() {
  const ins = useSafeAreaInsets();

  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    Animated.timing(fade, {
      toValue: 1,
      duration: 900,
      delay: 300,
      useNativeDriver: true,
    }).start();

    return () => animation.stop();
  }, [pulse, fade]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  const glow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0.9],
  });

  return (
    <Background>
      <View style={s.center}>
        <View style={s.center}>
          <Animated.View
            style={[
              s.orb,
              {
                transform: [{ scale }],
                opacity: glow,
              },
            ]}
          >
            <LinearGradient
              colors={['#93C5FD', '#C4B5FD', '#FBCFE8']}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={{
                flex: 1,
                borderRadius: 999,
              }}
            />
          </Animated.View>

          <View style={s.logoWrap}>
            <Logo size={110} />
          </View>
        </View>

        <Animated.View
          style={{
            alignItems: 'center',
            opacity: fade,
            marginTop: 44,
          }}
        >
          <Wordmark />
          <Animated.Text style={s.tagline}>
            Messages that disappear.
          </Animated.Text>
        </Animated.View>
      </View>

      <Animated.Text
        style={[
          s.foot,
          {
            opacity: fade,
            paddingBottom: ins.bottom + 16,
          },
        ]}
      >
        Class Network
      </Animated.Text>
    </Background>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  orb: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
  },

  logoWrap: {
    shadowColor: C.purple,
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 12,
    },
  },

  tagline: {
    marginTop: 10,
    fontSize: 16,
    color: C.muted,
    letterSpacing: 0.4,
  },

  foot: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 13,
    paddingTop: 8,
  },
});
