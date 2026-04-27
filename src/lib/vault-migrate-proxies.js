import { randomUUID } from 'node:crypto';
import { proxyStore, vaultStore } from '../db/index.js';
import { encrypt, buildPreview } from './vault-crypto.js';

const PROVIDER_FROM_SCHEMA = { ollama: 'ollama', openai: 'openai' };

/**
 * One-shot: move every proxy with an inline api_key into the vault under the given key.
 * Idempotent — proxies already linked to a vault entry are skipped.
 * Returns the number of migrated proxies.
 */
export function migrateInlineProxiesToVault(key) {
  const proxies = proxyStore.listInlineKeyed();
  for (const p of proxies) {
    const id = randomUUID();
    const ciphertext = encrypt(key, p.api_key);
    const preview = buildPreview(p.api_key);
    const provider = PROVIDER_FROM_SCHEMA[p.api_schema] || 'other';
    vaultStore.create({ id, label: `Migrated: ${p.name}`, provider, ciphertext, preview });
    proxyStore.linkVaultEntry(p.id, id);
  }
  return proxies.length;
}
