import { vaultStore } from '../../../db/index.js';
import { deriveKey, checkVerifier } from '../../../lib/vault-crypto.js';
import { openSession } from '../../../lib/vault-session.js';
import { migrateInlineProxiesToVault } from '../../../lib/vault-migrate-proxies.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** POST /api/vault/unlock { passphrase } */
export async function POST({ request }) {
  try {
    const salt = vaultStore.getMeta('kdf_salt');
    const verifier = vaultStore.getMeta('verifier');
    if (!salt || !verifier) {
      return json({ error: 'Vault not initialized', code: 'vault_uninitialized' }, 400);
    }

    const { passphrase } = await request.json();
    if (typeof passphrase !== 'string' || !passphrase) {
      return json({ error: 'Passphrase is required' }, 400);
    }

    const key = deriveKey(passphrase, salt);
    if (!checkVerifier(key, verifier)) {
      key.fill(0);
      return json({ error: 'Wrong passphrase', code: 'vault_bad_passphrase' }, 401);
    }

    const migrated = migrateInlineProxiesToVault(key);

    const { token, expiresInMs } = openSession(key);
    return json({ status: 'success', token, expiresInMs, migratedProxies: migrated });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
