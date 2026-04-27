import { vaultStore } from '../../../db/index.js';
import { generateSalt, deriveKey, encrypt, decrypt, makeVerifier } from '../../../lib/vault-crypto.js';
import { useSession, getTokenFromRequest, openSession, closeSession } from '../../../lib/vault-session.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** POST /api/vault/rotate { newPassphrase } — re-encrypt all entries under a new passphrase. */
export async function POST({ request }) {
  const oldKey = useSession(getTokenFromRequest(request));
  if (!oldKey) return json({ error: 'Vault is locked', code: 'vault_locked' }, 401);

  try {
    const { newPassphrase } = await request.json();
    if (typeof newPassphrase !== 'string' || newPassphrase.length < 8) {
      return json({ error: 'newPassphrase must be at least 8 characters' }, 400);
    }

    const newSalt = generateSalt();
    const newKey = deriveKey(newPassphrase, newSalt);

    // Decrypt + re-encrypt every entry under the new key.
    const entries = vaultStore.listAllForRotation();
    const reEncrypted = entries.map(e => ({ id: e.id, ciphertext: encrypt(newKey, decrypt(oldKey, e.ciphertext)) }));
    for (const e of reEncrypted) vaultStore.replaceCiphertext(e.id, e.ciphertext);

    vaultStore.setMeta('kdf_salt', newSalt);
    vaultStore.setMeta('verifier', makeVerifier(newKey));

    closeSession(getTokenFromRequest(request));
    const { token, expiresInMs } = openSession(newKey);
    return json({ status: 'success', token, expiresInMs, rotated: entries.length });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
