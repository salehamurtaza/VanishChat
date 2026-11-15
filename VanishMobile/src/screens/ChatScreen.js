
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Background,
  Glass,
  Logo,
  RoundBtn,
  StatusPill,
  TextButton,
  Wordmark,
} from '../ui';

import { C, shadow } from '../theme';
import { clock, mmss, toMs } from '../utils';

import { MAX_TEXT_LENGTH } from '../config';

// --------------------------------------------------
// RELAY TIMESTAMP
// --------------------------------------------------

function timestampMs(value) {
  if (value == null || value === '') return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return toMs(number);
}

// --------------------------------------------------
// RELAY-CORRECTED CLOCK
// --------------------------------------------------

function useNow(skewRef) {
  const [now, setNow] = useState(
    Date.now() + (skewRef?.current ?? 0)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now() + (skewRef?.current ?? 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [skewRef]);

  return now;
}

// --------------------------------------------------
// MESSAGE VISIBILITY
// --------------------------------------------------

function alive(message, now) {
  if (message.state === 'queued') return true;

  const expiresAt = timestampMs(message.expires_at);

  if (expiresAt == null) return true;

  return expiresAt > now;
}

function sortKey(message) {
  return (
    timestampMs(message.sent_at) ??
    Number(message.created_at ?? 0)
  );
}

// --------------------------------------------------
// MESSAGE BUBBLE
// --------------------------------------------------

function Message({ m, mine, now }) {
  const queued = m.state === 'queued';

  const sent = timestampMs(m.sent_at);
  const expires = timestampMs(m.expires_at);

  const hasExpiry =
    !queued &&
    sent != null &&
    expires != null &&
    expires > sent;

  const total = hasExpiry ? expires - sent : 1;

  const left = hasExpiry
    ? Math.max(0, Math.ceil((expires - now) / 1000))
    : 0;

  const pct = hasExpiry
    ? Math.max(0, Math.min(1, (expires - now) / total))
    : 0;

  const urgent = hasExpiry && left <= 5;

  const soft = mine
    ? 'rgba(255,255,255,0.8)'
    : C.muted;

  const body = (
    <>
      <Text style={[s.msgText, mine && { color: '#fff' }]}>
        {m.text}
      </Text>

      <View style={s.msgFoot}>
        {queued ? (
          <Text style={[s.msgMeta, { color: soft }]}>
            Queued · sends when online
          </Text>
        ) : hasExpiry ? (
          <>
            <Text style={[s.msgMeta, { color: soft }]}>
              {clock(sent)}
            </Text>

            <Text
              style={[
                s.msgMeta,
                {
                  color: urgent
                    ? mine
                      ? '#FFE4F1'
                      : C.rose
                    : soft,
                  fontWeight: '700',
                },
              ]}
            >
              {mine ? '' : 'Delivered • '}
              {mmss(left)}
            </Text>
          </>
        ) : (
          <Text style={[s.msgMeta, { color: soft }]}>
            Waiting for relay timestamps
          </Text>
        )}
      </View>

      {hasExpiry && (
        <View
          style={[
            s.bar,
            {
              backgroundColor: mine
                ? 'rgba(255,255,255,0.25)'
                : C.purpleSoft,
            },
          ]}
        >
          <View
            style={{
              width: `${pct * 100}%`,
              height: 3,
              borderRadius: 2,
              backgroundColor: urgent
                ? C.rose
                : mine
                  ? '#fff'
                  : C.purple,
            }}
          />
        </View>
      )}
    </>
  );

  if (mine) {
    return (
      <View
        style={[
          s.row,
          {
            justifyContent: 'flex-end',
            opacity: queued ? 0.75 : 1,
          },
        ]}
      >
        <LinearGradient
          colors={C.grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            s.bubble,
            { borderBottomRightRadius: 6 },
          ]}
        >
          <Text
            style={[
              s.sender,
              {
                color: 'rgba(255,255,255,0.85)',
                textAlign: 'right',
              },
            ]}
          >
            You
          </Text>

          {body}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={s.row}>
      <Avatar name={m.name} />

      <View style={[s.bubble, s.bubbleOther]}>
        <Text style={s.sender}>
          {m.name || 'Student'}
        </Text>

        {body}
      </View>
    </View>
  );
}

// --------------------------------------------------
// CONNECTION BANNER
// --------------------------------------------------

function Banner({ relay, onChangeDetails }) {
  if (relay.status === 'connected') return null;

  const { status, pending } = relay;

  let text =
    status === 'connecting'
      ? 'Connecting to the relay…'
      : status === 'error'
        ? relay.error || 'The relay refused the connection.'
        : status === 'offline'
          ? 'You’re offline. Reconnecting automatically…'
          : 'You’re not connected.';

  if (pending) {
    text += ` ${pending} message${pending > 1 ? 's' : ''} queued.`;
  }

  return (
    <View style={s.banner}>
      <Ionicons
        name="cloud-offline-outline"
        size={18}
        color={C.rose}
        style={{ marginTop: 1 }}
      />

      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={s.bannerText}>{text}</Text>

        {status !== 'connecting' && (
          <View style={s.bannerActions}>
            <TextButton
              label="Retry now"
              onPress={relay.reconnect}
            />

            {status === 'error' && (
              <TextButton
                label="Change details"
                onPress={onChangeDetails}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// --------------------------------------------------
// CHAT SCREEN
// --------------------------------------------------

export default function ChatScreen({
  profile,
  relay,
  onSettings,
  onChangeDetails,
}) {
  const ins = useSafeAreaInsets();

  const now = useNow(relay.skew);

  const [text, setText] = useState('');

  const visible = (relay.messages || [])
    .filter((message) => alive(message, now))
    .sort((a, b) => sortKey(a) - sortKey(b))
    .reverse();

  // ------------------------------------------------
  // SEND MESSAGE
  // ------------------------------------------------

  const submit = () => {
    const message = text.trim();

    if (!message) return;

    if (message.length > MAX_TEXT_LENGTH) return;

    if (typeof relay.send !== 'function') return;

    const accepted = relay.send(message);

    if (accepted) {
      setText('');
    }
  };

  const canSend =
    text.trim().length > 0 &&
    text.trim().length <= MAX_TEXT_LENGTH;

  return (
    <Background>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* HEADER */}

        <View
          style={[
            s.header,
            { paddingTop: ins.top + 8 },
          ]}
        >
          <Logo size={40} />

          <View style={{ flex: 1, marginLeft: 12 }}>
            <Wordmark small />
            <Text style={s.headSub}>Class Network</Text>
          </View>

          <RoundBtn
            icon="settings-outline"
            onPress={onSettings}
          />
        </View>

        {/* CONNECTION STATUS */}

        <View style={s.status}>
          <StatusPill
            status={relay.status}
            extra={
              relay.status === 'connected'
                ? `${relay.online} online`
                : undefined
            }
          />
        </View>

        <Banner
          relay={relay}
          onChangeDetails={onChangeDetails}
        />

        {/* MESSAGE LIST */}

        <FlatList
          style={{ flex: 1 }}
          inverted
          data={visible}
          keyExtractor={(message) => message.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <Message
              m={item}
              now={now}
              mine={
                !!item.local ||
                item.device_id === profile.deviceId
              }
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>
                Hello, {profile.name || 'there'}
              </Text>

              <Text style={s.emptySub}>
                Say something. It will vanish in 30 seconds.
              </Text>
            </View>
          }
        />

        {/* MESSAGE COMPOSER */}

        <Glass
          style={[
            s.composer,
            { marginBottom: ins.bottom + 10 },
          ]}
        >
          <View style={s.inputContainer}>
            <TextInput
              style={s.composerInput}
              placeholder="Type a message…"
              placeholderTextColor="#B2AEC2"
              value={text}
              onChangeText={(value) =>
                setText(value.slice(0, MAX_TEXT_LENGTH))
              }
              multiline
              maxLength={MAX_TEXT_LENGTH}
            />

            <Text style={s.characterCount}>
              {text.length}/{MAX_TEXT_LENGTH}
            </Text>
          </View>

          <Pressable
            onPress={submit}
            disabled={!canSend}
            style={{ opacity: canSend ? 1 : 0.5 }}
          >
            <LinearGradient
              colors={C.grad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.sendBtn}
            >
              <Ionicons
                name="send"
                size={18}
                color="#fff"
                style={{ marginLeft: 2 }}
              />
            </LinearGradient>
          </Pressable>
        </Glass>
      </KeyboardAvoidingView>
    </Background>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },

  headSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 1,
  },

  status: {
    alignItems: 'center',
    marginBottom: 6,
  },

  banner: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },

  bannerText: {
    fontSize: 12.5,
    lineHeight: 17,
    color: C.ink,
  },

  bannerActions: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 4,
  },

  listContent: {
    padding: 16,
    gap: 12,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },

  bubble: {
    maxWidth: '78%',
    minWidth: 120,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderBottomLeftRadius: 6,
    ...shadow,
    shadowOpacity: 0.07,
  },

  sender: {
    fontSize: 12,
    fontWeight: '700',
    color: C.purple,
    marginBottom: 3,
  },

  msgText: {
    fontSize: 15.5,
    lineHeight: 21,
    color: C.ink,
  },

  msgFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 6,
  },

  msgMeta: {
    fontSize: 11.5,
  },

  bar: {
    height: 3,
    borderRadius: 2,
    marginTop: 7,
    overflow: 'hidden',
  },

  empty: {
    alignItems: 'center',
    paddingTop: 60,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.muted,
  },

  emptySub: {
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
    marginTop: 6,
    textAlign: 'center',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: 14,
    padding: 8,
    paddingLeft: 16,
    borderRadius: 30,
  },

  inputContainer: {
    flex: 1,
  },

  composerInput: {
    maxHeight: 110,
    fontSize: 15.5,
    color: C.ink,
    paddingVertical: 10,
    textAlign: 'left',
    textAlignVertical: 'top',
    writingDirection: 'auto',
  },

  characterCount: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'right',
    marginBottom: 3,
    marginRight: 8,
  },

  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
