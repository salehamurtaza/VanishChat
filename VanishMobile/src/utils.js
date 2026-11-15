
// Formats a number with two digits.
export const pad = (n) => String(n).padStart(2, '0');

// Converts seconds into MM:SS.
export const mmss = (s) =>
  `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

// Converts milliseconds into HH:MM.
export const clock = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Accepts seconds or milliseconds and returns milliseconds.
export const toMs = (t) => {
  const value = Number(t);

  if (!Number.isFinite(value)) return 0;

  return value < 1e12 ? value * 1000 : value;
};

// Generates a valid RFC 4122 version 4 UUID.
export const newDeviceId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
    /[xy]/g,
    (c) => {
      const r = Math.floor(Math.random() * 16);
      const v = c === 'x' ? r : (r & 0x3) | 0x8;

      return v.toString(16);
    }
  );
};

// Generates a unique local message ID.
export const uid = () =>
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 8);

// Normalizes relay addresses into WebSocket URLs.
export const normalizeRelay = (value) => {
  let url = (value || '').trim();

  if (!url) return '';

  if (/^https:\/\//i.test(url)) {
    url = url.replace(/^https:/i, 'wss:');
  } else if (/^http:\/\//i.test(url)) {
    url = url.replace(/^http:/i, 'ws:');
  } else if (!/^wss?:\/\//i.test(url)) {
    url = `wss://${url}`;
  }

  return url.replace(/\/+$/, '');
};
