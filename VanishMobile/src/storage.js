
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';

import { DEFAULT_RELAY, STORAGE_KEY } from './config';
import { newDeviceId, toMs } from './utils';

// ==================================================
// PROFILE STORAGE
// ==================================================

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const defaultProfile = () => ({
  name: '',
  relay: DEFAULT_RELAY,
  code: '',
  deviceId: newDeviceId(),
  joined: false,
});

export async function loadProfile() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (raw) {
      const saved = JSON.parse(raw);

      if (
        !saved ||
        typeof saved !== 'object' ||
        Array.isArray(saved)
      ) {
        throw new Error('Invalid saved profile');
      }

      const validDeviceId =
        typeof saved.deviceId === 'string' &&
        UUID_REGEX.test(saved.deviceId);

      const profile = {
        ...defaultProfile(),
        ...saved,

        // Keep a valid saved ID, otherwise generate a new one.
        deviceId: validDeviceId
          ? saved.deviceId
          : newDeviceId(),
      };

      // Persist the corrected profile.
      if (!validDeviceId) {
        await saveProfile(profile);
      }

      return profile;
    }
  } catch (error) {
    console.warn('Profile loading failed:', error);
  }

  const profile = defaultProfile();

  await saveProfile(profile);

  return profile;
}

export async function saveProfile(profile) {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(profile)
    );
  } catch (error) {
    console.warn('Profile saving failed:', error);
  }
}

// ==================================================
// TIMESTAMP NORMALIZATION
// SQLite stores timestamps in milliseconds.
// ==================================================

function normalizeTimestamp(value) {
  if (value == null || value === '') {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return toMs(number);
}

// ==================================================
// SQLITE DATABASE
// ==================================================

let database = null;
let databasePromise = null;

export async function initDatabase() {
  if (database) {
    return database;
  }

  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = (async () => {
    const db = await SQLite.openDatabaseAsync('vanish.db');

    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        sender TEXT,
        device_id TEXT,
        text TEXT NOT NULL,
        sent_at INTEGER,
        expires_at INTEGER,
        state TEXT NOT NULL,
        local INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_expiry
      ON messages(expires_at);

      CREATE INDEX IF NOT EXISTS idx_messages_state
      ON messages(state);

      CREATE INDEX IF NOT EXISTS idx_messages_created
      ON messages(created_at);
    `);

    database = db;

    return db;
  })();

  try {
    return await databasePromise;
  } catch (error) {
    databasePromise = null;
    throw error;
  }
}

// ==================================================
// PREPARE MESSAGE FOR DATABASE
// ==================================================

function prepareMessage(message) {
  if (!message.id || typeof message.text !== 'string') {
    throw new Error('Invalid message: ID and text are required');
  }

  return {
    id: message.id,
    sender: message.sender ?? message.name ?? null,
    device_id: message.device_id ?? null,
    text: message.text,
    sent_at: normalizeTimestamp(message.sent_at),
    expires_at: normalizeTimestamp(message.expires_at),
    state: message.state || 'queued',
    local: message.local ? 1 : 0,
    created_at: Number(message.created_at ?? Date.now()),
  };
}

// ==================================================
// SAVE OR UPDATE ONE MESSAGE
// ==================================================

export async function saveMessage(message) {
  const db = await initDatabase();
  const item = prepareMessage(message);

  await db.runAsync(
    `INSERT OR REPLACE INTO messages
    (
      id,
      sender,
      device_id,
      text,
      sent_at,
      expires_at,
      state,
      local,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.sender,
      item.device_id,
      item.text,
      item.sent_at,
      item.expires_at,
      item.state,
      item.local,
      item.created_at,
    ]
  );
}

// ==================================================
// SAVE MULTIPLE MESSAGES
// ==================================================

export async function saveMessages(messages) {
  const db = await initDatabase();

  await db.withTransactionAsync(async () => {
    for (const message of messages) {
      const item = prepareMessage(message);

      await db.runAsync(
        `INSERT OR REPLACE INTO messages
        (
          id,
          sender,
          device_id,
          text,
          sent_at,
          expires_at,
          state,
          local,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.sender,
          item.device_id,
          item.text,
          item.sent_at,
          item.expires_at,
          item.state,
          item.local,
          item.created_at,
        ]
      );
    }
  });
}

// ==================================================
// LOAD ACTIVE MESSAGES
// ==================================================

export async function getStoredMessages() {
  const db = await initDatabase();
  const now = Date.now();

  return db.getAllAsync(
    `SELECT *
     FROM messages
     WHERE state = 'queued'
        OR (
          expires_at IS NOT NULL
          AND expires_at > ?
        )
     ORDER BY created_at ASC`,
    [now]
  );
}

// ==================================================
// UPDATE MESSAGE STATE
// ==================================================

export async function updateMessageState(
  id,
  state,
  sentAt = null,
  expiresAt = null
) {
  const db = await initDatabase();

  await db.runAsync(
    `UPDATE messages
     SET state = ?,
         sent_at = COALESCE(?, sent_at),
         expires_at = COALESCE(?, expires_at)
     WHERE id = ?`,
    [
      state,
      sentAt == null ? null : normalizeTimestamp(sentAt),
      expiresAt == null ? null : normalizeTimestamp(expiresAt),
      id,
    ]
  );
}

// ==================================================
// OFFLINE QUEUE
// ==================================================

export async function getQueuedMessages() {
  const db = await initDatabase();

  return db.getAllAsync(
    `SELECT *
     FROM messages
     WHERE state = 'queued'
     ORDER BY created_at ASC`
  );
}

export async function saveQueuedMessage(message) {
  await saveMessage({
    ...message,
    state: 'queued',
  });
}

export async function removeQueuedMessage(id) {
  const db = await initDatabase();

  await db.runAsync(
    `DELETE FROM messages
     WHERE id = ? AND state = 'queued'`,
    [id]
  );
}

// ==================================================
// DELETE EXPIRED MESSAGES
// Only relay-timestamped messages are deleted here.
// ==================================================

export async function deleteExpiredMessages(now = Date.now()) {
  const db = await initDatabase();

  const result = await db.runAsync(
    `DELETE FROM messages
     WHERE state IN ('delivered', 'sent')
       AND expires_at IS NOT NULL
       AND expires_at <= ?`,
    [now]
  );

  return result.changes;
}

// ==================================================
// DELETE ONE MESSAGE
// ==================================================

export async function deleteMessage(id) {
  const db = await initDatabase();

  await db.runAsync(
    `DELETE FROM messages WHERE id = ?`,
    [id]
  );
}

// ==================================================
// CLEAR ALL MESSAGES
// ==================================================

export async function clearStoredMessages() {
  const db = await initDatabase();

  await db.runAsync('DELETE FROM messages');
}
