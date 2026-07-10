import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// A local, random key file (never committed - alongside db.json under
// server/data/, already gitignored). Not a hardware-backed vault like
// Electron's safeStorage, but it keeps credentials out of db.json in
// cleartext: reading the settings file alone no longer hands over live
// Twilio/Gmail/Android Gateway credentials.
const KEY_FILE = process.env.SKBOT_KEY_FILE || path.join(__dirname, '..', '..', 'data', '.secret-key');
const PREFIX = 'enc:v1:';

let cachedKey = null;

function loadOrCreateKey() {
  try {
    return Buffer.from(fs.readFileSync(KEY_FILE, 'utf8').trim(), 'base64');
  } catch {
    const key = crypto.randomBytes(32);
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, key.toString('base64'), { mode: 0o600 });
    return key;
  }
}

function getKey() {
  if (!cachedKey) cachedKey = loadOrCreateKey();
  return cachedKey;
}

export function encryptSecret(plaintext) {
  if (!plaintext) return plaintext ?? '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
}

// Passes plain, unencrypted strings through unchanged - this is what lets
// a db.json written before this feature existed keep working: values are
// treated as "already decrypted" until the next save re-encrypts them.
export function decryptSecret(value) {
  if (!value || !value.startsWith(PREFIX)) return value ?? '';
  try {
    const [ivB64, ciphertextB64, tagB64] = value.slice(PREFIX.length).split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, 'base64')), decipher.final()]);
    return plaintext.toString('utf8');
  } catch {
    // Corrupt ciphertext or a key file that no longer matches - fail safe
    // to empty rather than throwing and taking down the whole app.
    return '';
  }
}
