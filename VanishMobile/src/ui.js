// Shared UI pieces: background, logo, buttons, status pill, avatar, text field.
import React, { forwardRef } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { C, shadow } from './theme';

export function Background({ children }) {
  return (
    <LinearGradient colors={C.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />
      {children}
    </LinearGradient>
  );
}

// Speech bubble whose dots dissolve — "messages that disappear"
export function Logo({ size = 96 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96">
      <Defs>
        <SvgGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A78BFA" />
          <Stop offset="0.55" stopColor="#8B5CF6" />
          <Stop offset="1" stopColor="#60A5FA" />
        </SvgGradient>
        <SvgGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d="M26 70 L20 90 L46 74 Z" fill="url(#g)" />
      <Rect x="6" y="8" width="84" height="68" rx="28" fill="url(#g)" />
      <Rect x="6" y="8" width="84" height="34" rx="28" fill="url(#gloss)" />
      <Circle cx="30" cy="42" r="7" fill="#fff" />
      <Circle cx="50" cy="42" r="5.5" fill="#fff" opacity="0.65" />
      <Circle cx="68" cy="42" r="4" fill="#fff" opacity="0.3" />
    </Svg>
  );
}

export function Wordmark({ small }) {
  return (
    <Text style={{ fontSize: small ? 18 : 34, fontWeight: '800', letterSpacing: small ? 2 : 6, color: C.ink }}>VANISH</Text>
  );
}

export const Glass = ({ style, children }) => <View style={[s.glass, style]}>{children}</View>;

export function GradButton({ label, onPress, icon, disabled, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [{ opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      <LinearGradient colors={C.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gradBtn}>
        {icon && <Ionicons name={icon} size={18} color="#fff" style={{ marginRight: 8 }} />}
        <Text style={s.gradBtnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export const RoundBtn = ({ icon, onPress }) => (
  <Pressable onPress={onPress} style={s.roundBtn}>
    <Ionicons name={icon} size={20} color={C.ink} />
  </Pressable>
);

export const STATUS = {
  idle: { label: 'Not connected', color: C.muted },
  connecting: { label: 'Connecting…', color: C.amber },
  connected: { label: 'Connected', color: C.green },
  offline: { label: 'Offline · retrying', color: C.rose },
  error: { label: 'Connection failed', color: C.danger },
};

export const StatusPill = ({ status, extra }) => (
  <View style={s.pill}>
    <View style={[s.dot, { backgroundColor: STATUS[status].color }]} />
    <Text style={s.pillText}>{STATUS[status].label}{extra ? `  ·  ${extra}` : ''}</Text>
  </View>
);

export function Avatar({ name, size = 34 }) {
  return (
    <LinearGradient
      colors={['#93C5FD', '#C4B5FD', '#FBCFE8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </Text>
    </LinearGradient>
  );
}

export const Field = forwardRef(function Field({ label, icon, ...props }, ref) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.input}>
        {icon && <Ionicons name={icon} size={18} color={C.muted} style={{ marginRight: 10 }} />}
        <TextInput ref={ref} style={s.inputText} placeholderTextColor="#B2AEC2" autoCapitalize="none" autoCorrect={false} {...props} />
      </View>
    </View>
  );
});

export function TextButton({ label, onPress, color = C.purple, style }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, paddingVertical: 4 }, style]}>
      <Text style={{ color, fontWeight: '700', fontSize: 13.5 }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  glass: { backgroundColor: C.card, borderRadius: 26, borderWidth: 1, borderColor: C.cardBorder, ...shadow },
  gradBtn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: C.purple, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  gradBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.08 },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.cardBorder },
  pillText: { fontSize: 13, fontWeight: '600', color: C.ink },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  label: { fontSize: 13, fontWeight: '600', color: C.muted, marginBottom: 6, marginLeft: 4 },
  input: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 16, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: '#EEEAFB' },
  inputText: { flex: 1, fontSize: 15, color: C.ink },
});
