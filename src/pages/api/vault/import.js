import { vaultStore } from '../../../db/index.js';
import { deriveKey, checkVerifier } from '../../../lib/vault-crypto.js';
import { openSession } from '../../../lib/vault-session.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * POST /api/vault/import { bundle, passphrase, mode: 'replace' | 'merge' }
 *
 * - `replace` (default): vault must be uninitialized OR an explicit confirm; wipes existing
 *   meta + entries and adopts the bundle's salt/verifier. The supplied passphrase must
 *   verify against the bundle.
 * - `merge`: vault must be initialized AND the bundle must have been encrypted under the
 *   *same* passphrase (i.e. its verifier must check under the current key). Imports each
 *   entry by id; existing ids are skipped.
 *
 * Returns a fresh session token on success.
 */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { bundle, passphrase, mode = 'replace' } = body;

    if (!bundle || bundle.kind !== 'brise.vault' || !bundle.kdf_salt || !bundle.verifier || !Array.isArray(bundle.entries)) {
      return json({ error: 'Invalid bundle: expected kind="brise.vault" with kdf_salt, verifier, entries' }, 400);
    }
    if (bundle.version !== 1) return json({ error: `Unsupported bundle version: ${bundle.version}` }, 400);
    if (typeof passphrase !== 'string' || !passphrase) return json({ error: 'Passphrase is required' }, 400);

    // Derive bundle key + verify the bundle.
    const bundleKey = deriveKey(passphrase, bundle.kdf_salt);
    if (!checkVerifier(bundleKey, bundle.verifier)) {
      return json({ error: 'Wrong passphrase for the imported bundle', code: 'bundle_bad_passphrase' }, 401);
    }

    const initialized = !!vaultStore.getMeta('verifier');

    if (mode === 'merge') {
      if (!initialized) return json({ error: 'Cannot merge into an empty vault — use mode=replace' }, 400);
      const currentSalt = vaultStore.getMeta('kdf_salt');
      const currentVerifier = vaultStore.getMeta('verifier');
      const currentKey = deriveKey(passphrase, currentSalt);
      if (!checkVerifier(currentKey, currentVerifier)) {
        return json({ error: 'Bundle was encrypted under a different passphrase than the current vault', code: 'passphrase_mismatch' }, 400);
      }
      const existingIds = new Set(vaultStore.listEntries().map(e => e.id));
      let imported = 0, skipped = 0;
      for (const e of bundle.entries) {
        if (existingIds.has(e.id)) { skipped++; continue; }
        vaultStore.create({
          id: e.id, label: e.label, provider: e.provider,
          ciphertext: e.ciphertext, preview: e.preview ?? null,
        });
        imported++;
      }
      const { token, expiresInMs } = openSession(currentKey);
      return json({ status: 'success', mode: 'merge', imported, skipped, token, expiresInMs });
    }

    // replace mode
    if (initialized && body.confirmReplace !== true) {
      return json({ error: 'Vault already initialized — set confirmReplace=true to wipe and replace', code: 'replace_requires_confirm' }, 409);
    }

    // Wipe existing entries (meta is overwritten by setMeta)
    for (const e of vaultStore.listEntries()) vaultStore.delete(e.id);

    vaultStore.setMeta('kdf_salt', bundle.kdf_salt);
    vaultStore.setMeta('verifier', bundle.verifier);
    for (const e of bundle.entries) {
      vaultStore.create({
        id: e.id, label: e.label, provider: e.provider,
        ciphertext: e.ciphertext, preview: e.preview ?? null,
      });
    }

    const { token, expiresInMs } = openSession(bundleKey);
    return json({ status: 'success', mode: 'replace', imported: bundle.entries.length, token, expiresInMs });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
