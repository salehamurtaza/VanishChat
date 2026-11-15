
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Background,
  Field,
  Glass,
  GradButton,
  Logo,
  StatusPill,
  TextButton,
  Wordmark,
} from '../ui';
import { DEFAULT_RELAY } from '../config';
import { C } from '../theme';
import { normalizeRelay } from '../utils';

export default function JoinScreen({ profile, relay, onConnect, onCancel }) {
  const ins = useSafeAreaInsets();
  const relayRef = useRef(null);
  const codeRef = useRef(null);

  const [name, setName] = useState(profile.name);
  const [url, setUrl] = useState(profile.relay || DEFAULT_RELAY);
  const [code, setCode] = useState(profile.code);

  const busy = relay.status === 'connecting';
  const ready = name.trim().length > 0 && url.trim().length > 0;

  const submit = () => {
    if (!ready || busy) return;

    const clean = normalizeRelay(url);
    setUrl(clean);

    onConnect({
      ...profile,
      name: name.trim(),
      relay: clean,
      code: code.trim(),
    });
  };

  const msg =
    busy
      ? 'Connecting to the relay… a sleeping server can take up to a minute to wake.'
      : relay.error
        ? relay.error
        : relay.status === 'offline'
          ? 'Can’t reach the relay. Retrying…'
          : 'Not connected yet.';

  return (
    <Background>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 22,
            paddingTop: ins.top + 36,
            paddingBottom: ins.bottom + 24,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', marginBottom: 26 }}>
            <Logo size={72} />
            <View style={{ marginTop: 10 }}>
              <Wordmark small />
            </View>
          </View>

          <Text style={s.h1}>Join Class Network</Text>
          <Text style={s.sub}>
            Connect to your class relay to start chatting.
          </Text>

          <Glass style={{ marginTop: 22, padding: 18 }}>
            <Field
              label="Display name"
              icon="person-outline"
              placeholder="Student 01"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => relayRef.current?.focus()}
            />

            <Field
              ref={relayRef}
              label="Relay address"
              icon="globe-outline"
              placeholder={DEFAULT_RELAY}
              value={url}
              onChangeText={setUrl}
              keyboardType="url"
              returnKeyType="next"
              onSubmitEditing={() => codeRef.current?.focus()}
            />

            {normalizeRelay(url) !== DEFAULT_RELAY && (
              <TextButton
                label="Use default relay"
                onPress={() => setUrl(DEFAULT_RELAY)}
                style={{
                  marginTop: -8,
                  marginBottom: 12,
                  marginLeft: 4,
                }}
              />
            )}

            <Field
              ref={codeRef}
              label="Class code"
              icon="key-outline"
              placeholder="Enter class code"
              value={code}
              onChangeText={setCode}
              returnKeyType="go"
              onSubmitEditing={submit}
            />

            <GradButton
              label={busy ? 'Connecting…' : 'Connect'}
              icon="flash"
              disabled={!ready || busy}
              onPress={submit}
            />

            {busy && (
              <TextButton
                label="Cancel"
                onPress={onCancel}
                color={C.muted}
                style={{ alignSelf: 'center', marginTop: 12 }}
              />
            )}
          </Glass>

          <View style={{ alignItems: 'center', marginTop: 18 }}>
            <StatusPill status={relay.status} />
            <Text style={[s.sub, { marginTop: 10, textAlign: 'center' }]}>
              {msg}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Background>
  );
}

const s = StyleSheet.create({
  h1: {
    fontSize: 28,
    fontWeight: '800',
    color: C.ink,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    marginTop: 6,
  },
});
