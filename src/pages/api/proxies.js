import { loadAllProxies, saveProxy, deleteProxy } from '../../lib/proxy-loader.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function publicProxy(p) {
  // Never expose any secret material — the api_key column is a legacy field
  // that gets migrated into the vault on first vault unlock.
  const { api_key, ...rest } = p;
  return rest;
}

/** GET /api/proxies */
export async function GET() {
  try {
    const proxies = await loadAllProxies();
    return json(proxies.map(publicProxy));
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** POST /api/proxies */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { name, url, model, is_local_network, vault_entry_id, api_schema } = body;

    if (!name || !url || !model) {
      return json({ error: 'Name, URL, and Model are required' }, 400);
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!id) return json({ error: 'Invalid name - must contain alphanumeric characters' }, 400);

    const existing = await loadAllProxies();
    if (existing.find(p => p.id === id)) {
      return json({ error: `Proxy with ID '${id}' already exists` }, 400);
    }

    try { new URL(url); } catch { return json({ error: 'Invalid URL format' }, 400); }

    const proxy = {
      id, name, url, model,
      is_local_network: is_local_network ?? true,
      api_key: null,
      vault_entry_id: is_local_network ? null : (vault_entry_id || null),
      api_schema: api_schema === 'openai' ? 'openai' : 'ollama',
    };

    await saveProxy(proxy);
    return json({ status: 'success', data: publicProxy(proxy) }, 201);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** PUT /api/proxies */
export async function PUT({ request }) {
  try {
    const body = await request.json();
    const { id, name, url, model, is_local_network, vault_entry_id, api_schema } = body;

    if (!id) return json({ error: 'Proxy ID is required' }, 400);

    const existing = await loadAllProxies();
    const proxy = existing.find(p => p.id === id);
    if (!proxy) return json({ error: `Proxy '${id}' not found` }, 404);

    if (url) {
      try { new URL(url); } catch { return json({ error: 'Invalid URL format' }, 400); }
    }

    const updated = {
      ...proxy,
      name: name ?? proxy.name,
      url: url ?? proxy.url,
      model: model ?? proxy.model,
      is_local_network: is_local_network ?? proxy.is_local_network,
      api_key: is_local_network === true ? null : proxy.api_key,
      vault_entry_id: is_local_network === true ? null : (vault_entry_id !== undefined ? (vault_entry_id || null) : proxy.vault_entry_id),
      api_schema: (api_schema === 'openai' || api_schema === 'ollama') ? api_schema : (proxy.api_schema || 'ollama'),
    };

    await saveProxy(updated);
    return json({ status: 'success', data: publicProxy(updated) });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

/** DELETE /api/proxies */
export async function DELETE({ request }) {
  try {
    const { id } = await request.json();
    if (!id) return json({ error: 'Proxy ID is required' }, 400);
    const ok = await deleteProxy(id);
    if (!ok) return json({ error: `Proxy '${id}' not found` }, 404);
    return json({ status: 'success', message: `Proxy '${id}' deleted` });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
