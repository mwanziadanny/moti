// WebCrypto helpers for the mock backend. Production uses Argon2id server-side;
// PBKDF2 here keeps the same "never store plaintext" contract in the browser.

const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export function randomToken(bytes = 32) {
  const arr = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(arr)
  return toHex(arr)
}

export async function hashPassword(password, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 10_000 }, key, 256)
  return `pbkdf2$${salt}$${toHex(bits)}`
}

export async function verifyPassword(password, stored = '') {
  const [, salt] = stored.split('$')
  if (!salt) return false
  const candidate = await hashPassword(password, salt)
  // constant-time-ish compare
  let diff = candidate.length ^ stored.length
  for (let i = 0; i < Math.min(candidate.length, stored.length); i++) diff |= candidate.charCodeAt(i) ^ stored.charCodeAt(i)
  return diff === 0
}

export async function hmacSha256(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

export async function sha256(message) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(message)))
}
