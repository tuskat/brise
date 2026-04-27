import { vaultStore } from '../../../db/index.js';
import { useSession, getTokenFromRequest } from '../../../lib/vault-session.js';

/**
 * GET /api/vault/export — download an encrypted vault bundle.
 * Requires the vault to be unlocked (so we know the caller knows the passphrase).
 * The bundle ships salt + verifier + entry ciphertexts as-is — they're already encrypted
 * under the user's passphrase, so re-import on a fresh instance just needs that same passphrase.
 */
export async function GET({ request }) {
  if (!useSession(getTokenFromRequest(request))) {
    return new Response(JSON.stringify({ error: 'Vault is locked', code: 'vault_locked' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const salt = vaultStore.getMeta('kdf_salt');
    const verifier = vaultStore.getMeta('verifier');
    if (!salt || !verifier) {
      return new Response(JSON.stringify({ error: 'Vault not initialized' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const entries = vaultStore.listAllForRotation().map(e => {
      const meta = vaultStore.getCiphertext(e.id);
      return {
        id: meta.id,
        label: meta.label,
        provider: meta.provider,
        ciphertext: meta.ciphertext,
        preview: meta.preview ?? null,
      };
    });

    const bundle = {
      version: 1,
      kind: 'brise.vault',
      exported_at: new Date().toISOString(),
      kdf_salt: salt,
      verifier,
      entries,
    };

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="brise-vault-${date}.json"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
}
