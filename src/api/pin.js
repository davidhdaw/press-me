// Staff PIN hashing and session tokens. Runs in the browser and in the Node
// scripts under server/ (no database access here).
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

const ITERATIONS = 100000;

const toHex = (bytes) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');

export const isValidPin = (pin) => /^\d{4,8}$/.test(String(pin ?? ''));

export function randomHex(byteCount) {
  return toHex(globalThis.crypto.getRandomValues(new Uint8Array(byteCount)));
}

// PBKDF2-HMAC-SHA256. Browsers only provide crypto.subtle on secure origins
// (https or localhost), so on a plain-http LAN address fall back to a pure-JS
// implementation that produces the identical hash.
export async function hashPin(pin, saltHex) {
  const password = new TextEncoder().encode(String(pin));
  const salt = new Uint8Array(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const key = await subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
    return toHex(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256));
  }
  return toHex(await pbkdf2Async(sha256, password, salt, { c: ITERATIONS, dkLen: 32 }));
}
