import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_FILE = path.join(os.tmpdir(), `skbot-secret-key-test-${Date.now()}.txt`);
process.env.SKBOT_KEY_FILE = KEY_FILE;

const { encryptSecret, decryptSecret } = await import('../secretCrypto.js');

afterEach(() => {
  fs.rmSync(KEY_FILE, { force: true });
  delete process.env.SKBOT_KEY_FILE;
});

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext value', () => {
    const encrypted = encryptSecret('super-secret-token');
    expect(encrypted).not.toBe('super-secret-token');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(encrypted)).toBe('super-secret-token');
  });

  it('passes empty/undefined values through unchanged', () => {
    expect(encryptSecret('')).toBe('');
    expect(encryptSecret(undefined)).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('treats a plain (non-prefixed) string as already-decrypted legacy data', () => {
    expect(decryptSecret('a-value-saved-before-encryption-existed')).toBe('a-value-saved-before-encryption-existed');
  });

  it('fails safe to an empty string for corrupt ciphertext instead of throwing', () => {
    expect(decryptSecret('enc:v1:not-valid-base64-data')).toBe('');
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const a = encryptSecret('same-value');
    const b = encryptSecret('same-value');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-value');
    expect(decryptSecret(b)).toBe('same-value');
  });
});
