
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  PROTOCOL_VERSION,
  RETRY_BASE_MS,
  RETRY_MAX_MS,
  MAX_QUEUE_AGE_MS,
  MAX_TEXT_LENGTH,
  HEARTBEAT_INTERVAL_MS,
} from '../config';

import { toMs } from '../utils';

import {
  initDatabase,
  getStoredMessages,
  getQueuedMessages,
  saveMessage,
  updateMessageState,
  deleteMessage,
  deleteExpiredMessages,
  clearStoredMessages,
} from '../storage';

const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * 2.5;
const CONNECT_TIMEOUT_MS = 10_000;
const WS_OPEN = 1;

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (character) => {
      const random = Math.floor(Math.random() * 16);

      const value =
        character === 'x'
          ? random
          : (random & 0x3) | 0x8;

      return value.toString(16);
    }
  );
}

function packet(type, payload = {}) {
  return JSON.stringify({
    version: PROTOCOL_VERSION,
    type,
    payload,
  });
}

function timestampMs(value) {
  if (value == null || value === '') return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return toMs(number);
}

function isSocketOpen(socket) {
  return socket && socket.readyState === WS_OPEN;
}

export default function useRelay() {
  const ws = useRef(null);
  const profile = useRef(null);

  const queue = useRef([]);
  const inFlight = useRef(new Set());

  const retry = useRef(null);
  const connectTimeout = useRef(null);
  const heartbeat = useRef(null);

  const databaseReady = useRef(Promise.resolve());

  const attempts = useRef(0);
  const manual = useRef(false);
  const fatal = useRef(false);
  const mounted = useRef(true);

  const skew = useRef(0);
  const clockSynced = useRef(false);
  const lastHeartbeatAck = useRef(0);
  const statusRef = useRef('idle');

  const seenIds = useRef(new Set());

  const [status, setStatusState] = useState('idle');
  const [error, setError] = useState('');
  const [online, setOnline] = useState(0);
  const [messages, setMessages] = useState([]);

  // --------------------------------------------------
  // STATE HELPERS
  // --------------------------------------------------

  const setStatus = useCallback((value) => {
    statusRef.current = value;

    if (mounted.current) {
      setStatusState(value);
    }
  }, []);

  const updateMessages = useCallback((callback) => {
    if (mounted.current) {
      setMessages(callback);
    }
  }, []);

  const clearTimers = useCallback(() => {
    clearTimeout(retry.current);
    clearTimeout(connectTimeout.current);
    clearInterval(heartbeat.current);

    retry.current = null;
    connectTimeout.current = null;
    heartbeat.current = null;
  }, []);

  // --------------------------------------------------
  // SQLITE INITIALIZATION AND RESTORATION
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        await initDatabase();

        const stored = await getStoredMessages();
        const queued = await getQueuedMessages();

        if (cancelled) return;

        const now = Date.now();

        const validQueue = queued.filter((item) => {
          const age = now - Number(item.created_at);

          return age >= 0 && age <= MAX_QUEUE_AGE_MS;
        });

        // Delete queue entries older than the allowed age.
        for (const item of queued) {
          if (!validQueue.some((valid) => valid.id === item.id)) {
            await deleteMessage(item.id);
          }
        }

        if (cancelled) return;

        const restored = stored
          .filter((item) => {
            if (item.state === 'queued') {
              return validQueue.some(
                (queuedItem) => queuedItem.id === item.id
              );
            }

            if (item.expires_at == null) {
              return item.state === 'sent';
            }

            return (
              !clockSynced.current ||
              timestampMs(item.expires_at) >
                Date.now() + skew.current
            );
          })
          .map((item) => ({
            id: item.id,
            sender: item.sender,
            name: item.sender,
            device_id: item.device_id,
            text: item.text,
            sent_at: item.sent_at,
            expires_at: item.expires_at,
            state: item.state,
            local: Boolean(item.local),
            created_at: Number(item.created_at),
          }));

        queue.current = validQueue.map((item) => ({
          id: item.id,
          text: item.text,
          name: item.sender,
          device_id: item.device_id,
          local: true,
          created_at: Number(item.created_at),
        }));

        for (const item of restored) {
          seenIds.current.add(item.id);
        }

        updateMessages(() => restored);

      } catch (error) {
        console.warn('Database restoration failed:', error);
      }
    };

    databaseReady.current = restore();

    return () => {
      cancelled = true;
    };
  }, [updateMessages]);

  // --------------------------------------------------
  // WEBSOCKET HELPERS
  // --------------------------------------------------

  const sendPacket = useCallback((socket, type, payload = {}) => {
    if (!isSocketOpen(socket)) return false;

    try {
      socket.send(packet(type, payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  const removeFromQueue = useCallback((id) => {
    queue.current = queue.current.filter(
      (item) => item.id !== id
    );

    inFlight.current.delete(id);
  }, []);

  // --------------------------------------------------
  // HEARTBEAT
  // --------------------------------------------------

  const startHeartbeat = useCallback((socket) => {
    clearInterval(heartbeat.current);

    lastHeartbeatAck.current = Date.now();

    heartbeat.current = setInterval(() => {
      if (ws.current !== socket || !isSocketOpen(socket)) {
        return;
      }

      const elapsed =
        Date.now() - lastHeartbeatAck.current;

      if (elapsed > HEARTBEAT_TIMEOUT_MS) {
        try {
          socket.close();
        } catch {}

        return;
      }

      // The relay requires client_time in HEARTBEAT.
      sendPacket(socket, 'HEARTBEAT', {
        client_time: Date.now(),
      });
    }, HEARTBEAT_INTERVAL_MS);
  }, [sendPacket]);

  // --------------------------------------------------
  // OFFLINE QUEUE
  // --------------------------------------------------

  const flushQueue = useCallback(async (socket) => {
    try {
      await databaseReady.current;

      if (
        ws.current !== socket ||
        !isSocketOpen(socket)
      ) {
        return;
      }

      const now = Date.now();

      // Read the persisted queue as the source of truth.
      const savedQueue = await getQueuedMessages();

      for (const item of savedQueue) {
        if (
          ws.current !== socket ||
          !isSocketOpen(socket)
        ) {
          break;
        }

        const age = Math.max(
          0,
          now - Number(item.created_at)
        );

        if (age > MAX_QUEUE_AGE_MS) {
          removeFromQueue(item.id);

          await deleteMessage(item.id);

          updateMessages((previous) =>
            previous.filter((message) => message.id !== item.id)
          );

          continue;
        }

        // Do not send the same message twice on one connection.
        if (inFlight.current.has(item.id)) {
          continue;
        }

        const sent = sendPacket(socket, 'MESSAGE_SEND', {
          id: item.id,
          sender: item.sender,
          device_id: item.device_id,
          text: item.text,
          queued_ms: age,
        });

        if (!sent) break;

        inFlight.current.add(item.id);

        updateMessages((previous) =>
          previous.map((message) =>
            message.id === item.id
              ? { ...message, state: 'sent' }
              : message
          )
        );

        // Keep it in SQLite as queued until DELIVERY_ACK.
      }
    } catch (error) {
      console.warn('Queue restoration/send failed:', error);
    }
  }, [
    removeFromQueue,
    sendPacket,
    updateMessages,
  ]);

  // --------------------------------------------------
  // CONNECTION
  // --------------------------------------------------

  const open = useCallback(function openSocket() {
    clearTimers();

    if (manual.current || fatal.current) return;

    const p = profile.current;

    if (!p) return;

    // Validate the JOIN information before contacting the relay.
    const validUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!validUUID.test(p.deviceId || '')) {
      setError('Invalid device ID. Please reconnect with a valid device ID.');
      setStatus('error');
      manual.current = true;
      return;
    }

    const displayName = String(p.name || '').trim();

    if (displayName.length < 2 || displayName.length > 24) {
      setError('Name must contain 2–24 characters.');
      setStatus('error');
      manual.current = true;
      return;
    }

    if (
      p.code != null &&
      (typeof p.code !== 'string' || p.code.length > 64)
    ) {
      setError('Room code must not exceed 64 characters.');
      setStatus('error');
      manual.current = true;
      return;
    }

    if (ws.current) {
      const old = ws.current;
      ws.current = null;

      try {
        old.close();
      } catch {}
    }

    inFlight.current.clear();

    setStatus('connecting');

    let socket;

    try {
      socket = new WebSocket(p.relay.trim());
    } catch {
      setError('Invalid relay address');
      setStatus('error');
      manual.current = true;
      return;
    }

    ws.current = socket;

    connectTimeout.current = setTimeout(() => {
      if (
        ws.current === socket &&
        statusRef.current === 'connecting'
      ) {
        console.log('[VANISH] Connection timed out');

        try {
          socket.close();
        } catch {}
      }
    }, CONNECT_TIMEOUT_MS);

    socket.onopen = () => {
      if (ws.current !== socket) return;

      console.log('[VANISH] WebSocket opened');

      const sent = sendPacket(socket, 'JOIN', {
        device_id: p.deviceId,
        display_name: displayName,
        room_code: p.code || undefined,
      });

      if (!sent) {
        console.log('[VANISH] Could not send JOIN packet');

        try {
          socket.close();
        } catch {}
      } else {
        console.log('[VANISH] JOIN packet sent');
      }
    };

    // ------------------------------------------------
    // INCOMING PACKETS
    // ------------------------------------------------

    socket.onmessage = (event) => {
      if (ws.current !== socket) return;

      console.log('[VANISH] Server response:', event.data);

      let message;

      try {
        message = JSON.parse(event.data);
      } catch {
        console.log('[VANISH] Received invalid JSON');
        return;
      }

      if (
        !message ||
        message.version !== PROTOCOL_VERSION ||
        typeof message.type !== 'string'
      ) {
        console.log('[VANISH] Received an invalid protocol packet');
        return;
      }

      const payload = message.payload || {};

      switch (message.type) {

        // --------------------------------------------
        // JOIN ACKNOWLEDGEMENT
        // --------------------------------------------

        case 'JOIN_ACK': {
          clearTimeout(connectTimeout.current);
          connectTimeout.current = null;

          const serverTime = timestampMs(payload.server_time);

          if (serverTime != null) {
            skew.current = serverTime - Date.now();
            clockSynced.current = true;

            const relayNow = Date.now() + skew.current;

            updateMessages((previous) =>
              previous.filter((item) => {
                if (item.state === 'queued') return true;

                const expiresAt = timestampMs(item.expires_at);

                return expiresAt == null || expiresAt > relayNow;
              })
            );

            deleteExpiredMessages(relayNow).catch((error) => {
              console.warn('SQLite expiry cleanup failed:', error);
            });
          }

          // Never treat a rejected JOIN as a successful connection.
          if (payload.ok !== true) {
            const reason =
              payload.error || 'The relay rejected the connection';

            console.log('[VANISH] JOIN rejected:', reason);

            setError(reason);

            fatal.current = true;
            manual.current = true;

            clearTimers();

            setStatus('error');

            try {
              socket.close();
            } catch {}

            break;
          }

          console.log('[VANISH] JOIN accepted');

          attempts.current = 0;
          setError('');
          setStatus('connected');

          // The relay sends online_count, not online.
          if (Number.isFinite(payload.online_count)) {
            setOnline(payload.online_count);
          }

          startHeartbeat(socket);

          flushQueue(socket);

          break;
        }

        // --------------------------------------------
        // HEARTBEAT ACKNOWLEDGEMENT
        // --------------------------------------------

        case 'HEARTBEAT_ACK': {
          lastHeartbeatAck.current = Date.now();

          if (Number.isFinite(payload.online_count)) {
            setOnline(payload.online_count);
          }

          break;
        }

        // --------------------------------------------
        // MESSAGE DELIVERY
        // --------------------------------------------

        case 'MESSAGE_DELIVER': {
          const id = payload.id;

          if (
            !id ||
            typeof payload.text !== 'string'
          ) {
            break;
          }

          const sentAt = timestampMs(payload.sent_at);
          const expiresAt = timestampMs(payload.expires_at);

          if (
            sentAt == null ||
            expiresAt == null ||
            expiresAt <= sentAt
          ) {
            break;
          }

          if (expiresAt <= Date.now() + skew.current) {
            break;
          }

          if (seenIds.current.has(id)) {
            break;
          }

          seenIds.current.add(id);

          const delivered = {
            id,
            sender: payload.sender,
            name: payload.sender,
            device_id: payload.device_id,
            text: payload.text,
            sent_at: payload.sent_at,
            expires_at: payload.expires_at,
            state: 'delivered',
            local: payload.device_id === p.deviceId,
            created_at: Date.now(),
          };

          updateMessages((previous) => {
            if (previous.some((item) => item.id === id)) {
              return previous.map((item) =>
                item.id === id
                  ? { ...item, ...delivered }
                  : item
              );
            }

            return [...previous, delivered];
          });

          saveMessage(delivered).catch((error) => {
            console.warn('Could not save delivered message:', error);
          });

          break;
        }

        // --------------------------------------------
        // DELIVERY ACKNOWLEDGEMENT
        // --------------------------------------------

        case 'DELIVERY_ACK': {
          const id = payload.message_id;

          if (!id) break;

          if (payload.status === 'DROPPED') {
            removeFromQueue(id);

            deleteMessage(id).catch((error) => {
              console.warn('Could not delete rejected message:', error);
            });

            updateMessages((previous) =>
              previous.filter((item) => item.id !== id)
            );

            break;
          }

          if (payload.status === 'DELIVERED') {
            const sentAt = timestampMs(payload.sent_at);
            const expiresAt = timestampMs(payload.expires_at);

            removeFromQueue(id);

            const validTimestamps =
              sentAt != null &&
              expiresAt != null &&
              expiresAt > sentAt;

            const newState = validTimestamps
              ? 'delivered'
              : 'sent';

            updateMessages((previous) =>
              previous.map((item) => {
                if (item.id !== id) return item;

                return {
                  ...item,
                  state: newState,
                  sent_at: validTimestamps
                    ? payload.sent_at
                    : item.sent_at,
                  expires_at: validTimestamps
                    ? payload.expires_at
                    : item.expires_at,
                };
              })
            );

            updateMessageState(
              id,
              newState,
              validTimestamps ? sentAt : null,
              validTimestamps ? expiresAt : null
            ).catch((error) => {
              console.warn('Could not update message acknowledgement:', error);
            });
          }

          break;
        }

        // --------------------------------------------
        // MESSAGE EXPIRY
        // --------------------------------------------

        case 'MESSAGE_EXPIRED': {
          const id = payload.message_id || payload.id;

          if (!id) break;

          removeFromQueue(id);

          deleteMessage(id).catch((error) => {
            console.warn('Could not delete expired message:', error);
          });

          updateMessages((previous) =>
            previous.filter((item) => item.id !== id)
          );

          break;
        }

        // --------------------------------------------
        // RELAY ERROR
        // --------------------------------------------

        case 'ERROR': {
          const reason =
            payload.message ||
            'The relay rejected the connection';

          console.log('[VANISH] Relay error:', reason);

          setError(reason);

          fatal.current = true;
          manual.current = true;

          clearTimers();

          try {
            socket.close();
          } catch {}

          setStatus('error');

          break;
        }

        // --------------------------------------------
        // RELAY DISCONNECT
        // --------------------------------------------

        case 'DISCONNECT': {
          const reason =
            payload.reason || 'Disconnected by the relay';

          console.log('[VANISH] Relay disconnected:', reason);

          setError(reason);

          fatal.current = true;
          manual.current = true;

          clearTimers();

          try {
            socket.close();
          } catch {}

          setStatus('error');

          break;
        }

        default:
          break;
      }
    };

    socket.onerror = () => {
      if (ws.current !== socket) return;

      console.log('[VANISH] WebSocket error');

      setError('Could not reach the relay');
    };

    // ----------------------------------------------
    // CONNECTION CLOSED
    // ----------------------------------------------

    socket.onclose = (event) => {
      if (ws.current !== socket) return;

      console.log('[VANISH] WebSocket closed:', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      ws.current = null;

      clearTimers();

      inFlight.current.clear();

      setOnline(0);

      if (manual.current || fatal.current) return;

      setStatus('offline');

      const delay = Math.min(
        RETRY_MAX_MS,
        RETRY_BASE_MS * 2 ** attempts.current
      );

      attempts.current += 1;

      console.log('[VANISH] Reconnecting in:', delay, 'ms');

      retry.current = setTimeout(openSocket, delay);
    };
  }, [
    clearTimers,
    flushQueue,
    sendPacket,
    setStatus,
    startHeartbeat,
    updateMessages,
    removeFromQueue,
  ]);

  // --------------------------------------------------
  // CONNECT / RECONNECT
  // --------------------------------------------------

  const reconnect = useCallback(() => {
    if (!profile.current) return;

    manual.current = false;
    fatal.current = false;
    attempts.current = 0;

    setError('');

    open();
  }, [open]);

  const connect = useCallback((newProfile) => {
    profile.current = newProfile;

    reconnect();
  }, [reconnect]);

  // --------------------------------------------------
  // DISCONNECT
  // --------------------------------------------------

  const disconnect = useCallback((clear = false) => {
    manual.current = true;
    fatal.current = false;

    clearTimers();

    if (ws.current) {
      const socket = ws.current;
      ws.current = null;

      sendPacket(socket, 'DISCONNECT', {});

      try {
        socket.close();
      } catch {}
    }

    inFlight.current.clear();

    setStatus('idle');
    setOnline(0);
    setError('');

    if (clear) {
      queue.current = [];
      seenIds.current.clear();

      updateMessages(() => []);

      clearStoredMessages().catch((error) => {
        console.warn('Could not clear stored messages:', error);
      });
    }
  }, [
    clearTimers,
    sendPacket,
    setStatus,
    updateMessages,
  ]);

  // --------------------------------------------------
  // SEND MESSAGE
  // --------------------------------------------------

  const send = useCallback((value) => {
    const text = String(value || '').trim();

    if (!text || text.length > MAX_TEXT_LENGTH) {
      return false;
    }

    const p = profile.current;

    if (!p) return false;

    const now = Date.now();

    const message = {
      id: makeUUID(),
      text,
      name: p.name,
      sender: p.name,
      device_id: p.deviceId,
      local: true,
      created_at: now,
      state: 'queued',
      sent_at: null,
      expires_at: null,
    };

    // Keep the message in the queue until the relay ACK.
    queue.current.push(message);

    updateMessages((previous) => [
      ...previous,
      {
        ...message,
        state: isSocketOpen(ws.current) &&
          statusRef.current === 'connected'
          ? 'sent'
          : 'queued',
      },
    ]);

    seenIds.current.add(message.id);

    // Persist before relying on the queue after a restart.
    saveMessage(message).then(() => {
      const socket = ws.current;

      if (
        isSocketOpen(socket) &&
        statusRef.current === 'connected'
      ) {
        flushQueue(socket);
      }
    }).catch((error) => {
      console.warn('Could not persist outgoing message:', error);

      removeFromQueue(message.id);

      updateMessages((previous) =>
        previous.filter((item) => item.id !== message.id)
      );
    });

    return true;
  }, [
    flushQueue,
    removeFromQueue,
    updateMessages,
  ]);

  // --------------------------------------------------
  // PERIODIC EXPIRY AND QUEUE CLEANUP
  // --------------------------------------------------

  useEffect(() => {
    const timer = setInterval(() => {
      if (clockSynced.current) {
        const relayNow = Date.now() + skew.current;

        updateMessages((previous) => {
          const next = previous.filter((message) => {
            if (message.state === 'queued') {
              return true;
            }

            const expiresAt = timestampMs(message.expires_at);

            // Messages without relay expiry timestamps are
            // not assigned a fabricated local expiry.
            return expiresAt == null || expiresAt > relayNow;
          });

          return next.length === previous.length
            ? previous
            : next;
        });

        deleteExpiredMessages(relayNow).catch((error) => {
          console.warn('SQLite expiry cleanup failed:', error);
        });
      }

      const localNow = Date.now();

      const expiredQueue = queue.current.filter((message) => {
        return localNow - message.created_at > MAX_QUEUE_AGE_MS;
      });

      for (const message of expiredQueue) {
        removeFromQueue(message.id);

        deleteMessage(message.id).catch((error) => {
          console.warn('Could not delete old queued message:', error);
        });
      }

      if (expiredQueue.length > 0) {
        const expiredIds = new Set(
          expiredQueue.map((item) => item.id)
        );

        updateMessages((previous) =>
          previous.filter((item) => !expiredIds.has(item.id))
        );
      }

    }, 1000);

    return () => clearInterval(timer);
  }, [removeFromQueue, updateMessages]);

  // --------------------------------------------------
  // RECONNECT WHEN APP RETURNS TO FOREGROUND
  // --------------------------------------------------

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (state) => {
        if (
          state !== 'active' ||
          !profile.current ||
          manual.current ||
          fatal.current
        ) {
          return;
        }

        if (!isSocketOpen(ws.current)) {
          attempts.current = 0;
          open();
        }
      }
    );

    return () => subscription.remove();
  }, [open]);

  // --------------------------------------------------
  // CLEANUP ON UNMOUNT
  // --------------------------------------------------

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;

      clearTimers();

      inFlight.current.clear();

      if (ws.current) {
        const socket = ws.current;
        ws.current = null;

        try {
          socket.close();
        } catch {}
      }
    };
  }, [clearTimers]);

  // --------------------------------------------------
  // RETURN VALUES
  // --------------------------------------------------

  const pending = messages.filter(
    (message) => message.state === 'queued'
  ).length;

  return {
    status,
    error,
    online,
    messages,
    pending,
    skew,
    connect,
    reconnect,
    disconnect,
    send,
  };
}
