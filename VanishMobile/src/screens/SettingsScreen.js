import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Background, Field, Glass, GradButton, RoundBtn, STATUS, StatusPill } from '../ui';
import { APP_VERSION, PROTOCOL_VERSION } from '../config';
import { C } from '../theme';

function InfoRow({ icon, label, value, last }) {
  return (
    <View style={[s.infoRow, !last && s.infoDivider]}>
      <View style={s.infoIcon}><Ionicons name={icon} size={18} color={C.purple} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} selectable numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

export default function SettingsScreen({ profile, relay, onBack, onSaveName, onReconnect, onLeave }) {
  const ins = useSafeAreaInsets();
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  const dirty = name.trim().length > 0 && name.trim() !== profile.name;
  const busy = relay.status === 'connecting';

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(t);
  }, [saved]);

  const save = () => { onSaveName(name.trim()); setSaved(true); };
  const confirmLeave = () =>
    Alert.alert('Leave class?', 'You’ll disconnect and the messages on screen will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onLeave },
    ]);

  return (
    <Background>
      <View style={[s.header, { paddingTop: ins.top + 8 }]}>
        <RoundBtn icon="chevron-back" onPress={onBack} />
        <Text style={s.headTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: ins.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <Avatar name={profile.name} size={84} />
          <View style={{ marginTop: 12 }}><StatusPill status={relay.status} /></View>
          {relay.error ? <Text style={s.error}>{relay.error}</Text> : null}
        </View>

        <Glass style={{ padding: 18 }}>
          <Field label="Display name" value={name} onChangeText={setName} autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => dirty && save()} />
          {dirty ? <GradButton label="Save name" icon="checkmark" onPress={save} /> : null}
          {saved && !dirty ? <Text style={s.savedText}>Name updated</Text> : null}
        </Glass>

        <Glass style={{ marginTop: 14, paddingHorizontal: 18 }}>
          <InfoRow icon="phone-portrait-outline" label="Device ID" value={profile.deviceId} />
          <InfoRow icon="globe-outline" label="Relay address" value={profile.relay} />
          <InfoRow icon="pulse-outline" label="Connection" value={STATUS[relay.status].label} />
          <InfoRow icon="information-circle-outline" label="Version" value={`VANISH ${APP_VERSION} · Protocol v${PROTOCOL_VERSION}`} last />
        </Glass>

        <GradButton label={busy ? 'Reconnecting…' : 'Reconnect'} icon="refresh" disabled={busy} style={{ marginTop: 20 }} onPress={onReconnect} />
        <Pressable onPress={confirmLeave} style={({ pressed }) => [s.leaveBtn, pressed && { opacity: 0.7 }]}>
          <Ionicons name="log-out-outline" size={18} color={C.danger} style={{ marginRight: 8 }} />
          <Text style={{ color: C.danger, fontWeight: '700', fontSize: 16 }}>Leave class</Text>
        </Pressable>
      </ScrollView>
    </Background>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  headTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.ink },
  error: { marginTop: 8, fontSize: 13, color: C.danger, textAlign: 'center' },
  savedText: { textAlign: 'center', color: C.green, fontWeight: '700', fontSize: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  infoDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(139,92,246,0.1)' },
  infoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  infoLabel: { fontSize: 12, color: C.muted },
  infoValue: { fontSize: 15, fontWeight: '600', color: C.ink, marginTop: 2 },
  leaveBtn: { marginTop: 12, height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.8)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
});
