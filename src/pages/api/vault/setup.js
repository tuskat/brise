import { vaultStore } from '../../../db/index.js';
import { generateSalt, deriveKey, makeVerifier } from '../../../lib/vault-crypto.js';
import { openSession } from '../../../lib/vault-session.js';
import { migrateInlineProxiesToVault } from '../../../lib/vault-migrate-proxies.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** POST /api/vault/setup { passphrase } — first-time vault initialization. */
export async function POST({ request }) {
  try {
    if (vaultStore.getMeta('verifier')) {
      return json({ error: 'Vault already initialized' }, 409);
    }
    const { passphrase } = await request.json();
    if (typeof passphrase !== 'string' || passphrase.length < 8) {
      return json({ error: 'Passphrase must be at least 8 characters' }, 400);
    }

    const salt = generateSalt();
    const key = deriveKey(passphrase, salt);
    const verifier = makeVerifier(key);

    vaultStore.setMeta('kdf_salt', salt);
    vaultStore.setMeta('verifier', verifier);

    const migrated = migrateInlineProxiesToVault(key);

    const { token, expiresInMs } = openSession(key);
    return json({ status: 'success', token, expiresInMs, migratedProxies: migrated }, 201);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
