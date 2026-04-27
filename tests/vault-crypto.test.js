import { describe, it, expect } from 'vitest';
import { generateSalt, deriveKey, encrypt, decrypt, makeVerifier, checkVerifier, buildPreview } from '../src/lib/vault-crypto.js';

// Use a low scrypt cost for tests via env override (set in package.json or run config).
// If not set, real cost still applies but tests still pass — just slower.

describe('vault-crypto', () => {
  it('round-trips a secret', () => {
    const salt = generateSalt();
    const key = deriveKey('correct horse battery staple', salt);
    const blob = encrypt(key, 'sk-very-secret-12345');
    expect(decrypt(key, blob)).toBe('sk-very-secret-12345');
  });

  it('rejects wrong key', () => {
    const salt = generateSalt();
    const key1 = deriveKey('passA', salt);
    const key2 = deriveKey('passB', salt);
    const blob = encrypt(key1, 'hello');
    expect(() => decrypt(key2, blob)).toThrow();
  });

  it('verifier check passes only with correct key', () => {
    const salt = generateSalt();
    const key1 = deriveKey('right', salt);
    const key2 = deriveKey('wrong', salt);
    const v = makeVerifier(key1);
    expect(checkVerifier(key1, v)).toBe(true);
    expect(checkVerifier(key2, v)).toBe(false);
  });

  it('produces a masked preview', () => {
    expect(buildPreview('sk-abcdef1234')).toBe('sk-…1234');
    expect(buildPreview('short')).toBe('');
  });
});
