import { vaultStore } from '../../../db/index.js';
import { decrypt } from '../../../lib/vault-crypto.js';
import { useSession, getTokenFromRequest } from '../../../lib/vault-session.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** POST /api/vault/reveal { id } — returns plaintext secret. */
export async function POST({ request }) {
  const key = useSession(getTokenFromRequest(request));
  if (!key) return json({ error: 'Vault is locked', code: 'vault_locked' }, 401);

  try {
    const { id } = await request.json();
    if (!id) return json({ error: 'id is required' }, 400);

    const row = vaultStore.getCiphertext(id);
    if (!row) return json({ error: 'Entry not found' }, 404);

    const secret = decrypt(key, row.ciphertext);
    vaultStore.touch(id);
    return json({ id, label: row.label, provider: row.provider, secret });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
