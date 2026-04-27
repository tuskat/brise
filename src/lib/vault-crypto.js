import { scryptSync, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

// scrypt N=2^17 → ~100ms on a laptop; tune via VAULT_SCRYPT_COST env if needed.
const SCRYPT_COST = Number(process.env.VAULT_SCRYPT_COST) || 17;
const SCRYPT_OPTS = { N: 2 ** SCRYPT_COST, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const KEY_LEN = 32;
const NONCE_LEN = 12;
const TAG_LEN = 16;
const VERIFIER_PLAINTEXT = 'brise-vault-v1';

export function generateSalt() {
  return randomBytes(16).toString('hex');
}

export function deriveKey(passphrase, saltHex) {
  return scryptSync(passphrase, Buffer.from(saltHex, 'hex'), KEY_LEN, SCRYPT_OPTS);
}

/** Encrypt plaintext under key. Returns base64(nonce || ciphertext || tag). */
export function encrypt(key, plaintext) {
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, enc, tag]).toString('base64');
}

/** Decrypt the base64 blob produced by encrypt(). Throws if tampered/wrong key. */
export function decrypt(key, blobB64) {
  const blob = Buffer.from(blobB64, 'base64');
  if (blob.length < NONCE_LEN + TAG_LEN) throw new Error('Ciphertext too short');
  const nonce = blob.subarray(0, NONCE_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ct = blob.subarray(NONCE_LEN, blob.length - TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

export function makeVerifier(key) {
  return encrypt(key, VERIFIER_PLAINTEXT);
}

/** Returns true iff the verifier decrypts to the known plaintext under this key. */
export function checkVerifier(key, verifierB64) {
  try {
    const got = decrypt(key, verifierB64);
    const a = Buffer.from(got);
    const b = Buffer.from(VERIFIER_PLAINTEXT);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** UI-safe preview: "sk-...4f2a" style (last 4 chars). Empty for very short secrets. */
export function buildPreview(secret) {
  if (typeof secret !== 'string' || secret.length < 8) return '';
  return `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}
