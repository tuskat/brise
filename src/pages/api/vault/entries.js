import { randomUUID } from 'node:crypto';
import { vaultStore } from '../../../db/index.js';
import { encrypt, buildPreview } from '../../../lib/vault-crypto.js';
import { useSession, getTokenFromRequest } from '../../../lib/vault-session.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const locked = () => json({ error: 'Vault is locked', code: 'vault_locked' }, 401);

const VALID_PROVIDERS = ['anthropic', 'openai', 'groq', 'ollama', 'openrouter', 'azure', 'other'];

function validate({ label, provider, secret }, requireSecret) {
  if (!label || typeof label !== 'string') return 'label is required';
  if (!provider || !VALID_PROVIDERS.includes(provider)) return `provider must be one of: ${VALID_PROVIDERS.join(', ')}`;
  if (requireSecret && (!secret || typeof secret !== 'string')) return 'secret is required';
  return null;
}

/** GET /api/vault/entries — metadata only (no ciphertext). */
export async function GET({ request }) {
  if (!useSession(getTokenFromRequest(request))) return locked();
  return json(vaultStore.listEntries());
}

/** POST /api/vault/entries { label, provider, secret } */
export async function POST({ request }) {
  const key = useSession(getTokenFromRequest(request));
  if (!key) return locked();
  try {
    const body = await request.json();
    const err = validate(body, true);
    if (err) return json({ error: err }, 400);

    const id = randomUUID();
    const ciphertext = encrypt(key, body.secret);
    const preview = buildPreview(body.secret);
    const entry = vaultStore.create({ id, label: body.label, provider: body.provider, ciphertext, preview });
    return json({ status: 'success', entry }, 201);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** PUT /api/vault/entries { id, label?, provider?, secret? } */
export async function PUT({ request }) {
  const key = useSession(getTokenFromRequest(request));
  if (!key) return locked();
  try {
    const body = await request.json();
    if (!body?.id) return json({ error: 'id is required' }, 400);

    const existing = vaultStore.getCiphertext(body.id);
    if (!existing) return json({ error: 'Entry not found' }, 404);

    const patch = {};
    if (body.label !== undefined) patch.label = body.label;
    if (body.provider !== undefined) {
      if (!VALID_PROVIDERS.includes(body.provider)) return json({ error: `bad provider` }, 400);
      patch.provider = body.provider;
    }
    if (body.secret !== undefined) {
      patch.ciphertext = encrypt(key, body.secret);
      patch.preview = buildPreview(body.secret);
    }

    const entry = vaultStore.update(body.id, patch);
    return json({ status: 'success', entry });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** DELETE /api/vault/entries { id } */
export async function DELETE({ request }) {
  if (!useSession(getTokenFromRequest(request))) return locked();
  try {
    const { id } = await request.json();
    if (!id) return json({ error: 'id is required' }, 400);
    const ok = vaultStore.delete(id);
    if (!ok) return json({ error: 'Entry not found' }, 404);
    return json({ status: 'success' });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
