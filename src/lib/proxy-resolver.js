import { vaultStore } from '../db/index.js';
import { decrypt } from './vault-crypto.js';
import { useSession, getTokenFromRequest } from './vault-session.js';

/**
 * Resolve a proxy's runtime api_key from the vault, given the request.
 * - Local-network proxies (no key needed) pass through.
 * - Inline api_key (legacy, pre-migration) passes through.
 * - vault_entry_id requires an unlocked vault session.
 *
 * @returns { proxy, error?: { code: 'vault_locked'|'missing_entry'|'decrypt_failed', message } }
 */
export function resolveProxyForCall(proxy, request) {
  if (!proxy) return { proxy };
  if (proxy.is_local_network) return { proxy };
  if (proxy.api_key && !proxy.vault_entry_id) return { proxy };

  if (!proxy.vault_entry_id) return { proxy };

  const key = useSession(getTokenFromRequest(request));
  if (!key) {
    return { error: { code: 'vault_locked', message: 'Vault must be unlocked to use this proxy' } };
  }

  const row = vaultStore.getCiphertext(proxy.vault_entry_id);
  if (!row) {
    return { error: { code: 'missing_entry', message: `Vault entry ${proxy.vault_entry_id} not found` } };
  }

  try {
    const secret = decrypt(key, row.ciphertext);
    vaultStore.touch(proxy.vault_entry_id);
    return { proxy: { ...proxy, api_key: secret } };
  } catch (err) {
    return { error: { code: 'decrypt_failed', message: err.message } };
  }
}

export function vaultErrorResponse(error) {
  const status = error.code === 'vault_locked' ? 401 : 400;
  return new Response(JSON.stringify({ error: error.message, code: error.code }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
