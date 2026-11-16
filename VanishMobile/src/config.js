
export const APP_VERSION = '1.0.0';

export const PROTOCOL_VERSION = '1.0';

export const DEFAULT_RELAY = 'wss://vanish-backend-mcls.onrender.com/ws';

export const DEFAULT_TTL_MS = 30_000;

export const STORAGE_KEY = 'vanish.profile';

export const RETRY_BASE_MS = 2_000;

export const RETRY_MAX_MS = 15_000;

// Shared protocol limits
export const MESSAGE_LIFETIME_MS = 30_000;
export const MAX_QUEUE_AGE_MS = 60_000;
export const MAX_TEXT_LENGTH = 280;
export const MAX_NAME_LENGTH = 24;
export const HEARTBEAT_INTERVAL_MS = 15_000;
