// Staff PIN hashing and session tokens. Uses WebCrypto, so this file runs both
// in the browser and in the Node scripts under server/ (no database access here).

const ITERATIONS = 100000;

const toHex = (bytes) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');

export const isValidPin = (pin) => /^\d{4,8}$/.test(String(pin ?? ''));

export function randomHex(byteCount) {
  return toHex(globalThis.crypto.getRandomValues(new Uint8Array(byteCount)));
}

export async function hashPin(pin, saltHex) {
  const subtle = globalThis.crypto.subtle;
  const key = await subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}
