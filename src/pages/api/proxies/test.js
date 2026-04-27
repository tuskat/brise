import { loadProxy } from '../../../lib/proxy-loader.js';
import { testProxyConnection } from '../../../lib/proxy-client.js';
import { vaultErrorResponse } from '../../../lib/proxy-resolver.js';
import { vaultStore } from '../../../db/index.js';
import { decrypt } from '../../../lib/vault-crypto.js';
import { useSession, getTokenFromRequest } from '../../../lib/vault-session.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * POST /api/proxies/test
 * Body: { id?, url?, model?, is_local_network?, vault_entry_id?, api_schema? }
 *  - With id: test a saved proxy. If it has vault_entry_id, vault must be unlocked.
 *  - Without id: test ad-hoc fields. vault_entry_id resolved if vault unlocked.
 */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { id, url, model, is_local_network, vault_entry_id, api_schema } = body;

    let proxy;
    if (id) {
      proxy = await loadProxy(id);
      if (!proxy) return json({ success: false, error: `Proxy '${id}' not found` }, 404);
    } else {
      if (!url || !model) {
        return json({ success: false, error: 'URL and Model are required for testing' }, 400);
      }
      proxy = {
        url, model,
        is_local_network: is_local_network ?? true,
        api_key: null,
        vault_entry_id: vault_entry_id || null,
        api_schema: api_schema || 'ollama',
      };
    }

    let resolved = proxy;
    if (proxy.vault_entry_id && !proxy.is_local_network) {
      const key = useSession(getTokenFromRequest(request));
      if (!key) return vaultErrorResponse({ code: 'vault_locked', message: 'Vault must be unlocked to test this proxy' });
      const row = vaultStore.getCiphertext(proxy.vault_entry_id);
      if (!row) return vaultErrorResponse({ code: 'missing_entry', message: 'Vault entry not found' });
      try {
        resolved = { ...proxy, api_key: decrypt(key, row.ciphertext) };
      } catch (err) {
        return vaultErrorResponse({ code: 'decrypt_failed', message: err.message });
      }
    }

    const result = await testProxyConnection(resolved);
    return json({ success: result.success, error: result.error || null, latency: result.latency });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}
