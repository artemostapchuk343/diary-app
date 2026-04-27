const SALT_KEY = 'diary_salt'
const IV_LENGTH = 12

function getSalt() {
  let salt = localStorage.getItem(SALT_KEY)
  if (!salt) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    salt = btoa(String.fromCharCode(...bytes))
    localStorage.setItem(SALT_KEY, salt)
  }
  return Uint8Array.from(atob(salt), c => c.charCodeAt(0))
}

async function deriveKey(password) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: getSalt(), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(text, password) {
  const key = await deriveKey(password)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text))
  const buf = new Uint8Array(iv.length + ciphertext.byteLength)
  buf.set(iv)
  buf.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...buf))
}

export async function decrypt(data, password) {
  const key = await deriveKey(password)
  const buf = Uint8Array.from(atob(data), c => c.charCodeAt(0))
  const iv = buf.slice(0, IV_LENGTH)
  const ciphertext = buf.slice(IV_LENGTH)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return new TextDecoder().decode(plain)
}

export async function verifyPassword(password) {
  const stored = localStorage.getItem('diary_verify')
  if (!stored) return true
  try {
    const result = await decrypt(stored, password)
    return result === 'ok'
  } catch {
    return false
  }
}

export async function savePasswordVerifier(password) {
  const token = await encrypt('ok', password)
  localStorage.setItem('diary_verify', token)
}

export function hasPassword() {
  return !!localStorage.getItem('diary_verify')
}

export function getPasswordConfig() {
  return {
    salt: localStorage.getItem(SALT_KEY),
    verify: localStorage.getItem('diary_verify'),
  }
}

export function loadPasswordConfig({ salt, verify }) {
  if (salt) localStorage.setItem(SALT_KEY, salt)
  if (verify) localStorage.setItem('diary_verify', verify)
}
