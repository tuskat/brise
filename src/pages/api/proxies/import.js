import { loadAllProxies, saveProxy } from '../../../lib/proxy-loader.js';
import { vaultStore } from '../../../db/index.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ID_RE = /^[a-z0-9-]+$/;

function validate(p) {
  if (!p || typeof p !== 'object') return 'not an object';
  if (!p.id || !ID_RE.test(p.id)) return `invalid id: ${p.id}`;
  if (!p.name || typeof p.name !== 'string') return 'missing name';
  if (!p.url || typeof p.url !== 'string') return 'missing url';
  if (!p.model || typeof p.model !== 'string') return 'missing model';
  return null;
}

function uniqueId(baseId, existingIds) {
  let i = 2;
  while (existingIds.has(`${baseId}-${i}`)) i++;
  return `${baseId}-${i}`;
}

/**
 * POST /api/proxies/import { bundle, mode: 'skip'|'overwrite'|'rename' }
 */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const bundle = body?.bundle;
    const mode = body?.mode || 'skip';

    if (!['skip', 'overwrite', 'rename'].includes(mode)) {
      return json({ error: `Unknown mode: ${mode}` }, 400);
    }
    if (!bundle || bundle.kind !== 'brise.proxies' || !Array.isArray(bundle.proxies)) {
      return json({ error: 'Invalid bundle: expected kind="brise.proxies" with proxies array' }, 400);
    }
    if (bundle.version !== 1) {
      return json({ error: `Unsupported bundle version: ${bundle.version}` }, 400);
    }

    const existing = await loadAllProxies();
    const existingIds = new Set(existing.map(p => p.id));
    const knownVaultIds = new Set(vaultStore.listEntries().map(e => e.id));

    const result = { imported: 0, skipped: 0, overwritten: 0, renamed: 0, danglingRefs: 0, errors: [] };

    for (const raw of bundle.proxies) {
      const err = validate(raw);
      if (err) { result.errors.push({ id: raw?.id ?? '<unknown>', error: err }); continue; }

      let id = raw.id;
      const conflict = existingIds.has(id);
      if (conflict && mode === 'skip') { result.skipped++; continue; }
      if (conflict && mode === 'rename') {
        id = uniqueId(id, existingIds);
        existingIds.add(id);
      }

      const proxy = {
        id,
        name: raw.name,
        url: raw.url,
        model: raw.model,
        is_local_network: raw.is_local_network ?? true,
        api_key: null,
        vault_entry_id: raw.vault_entry_id || null,
        api_schema: raw.api_schema === 'openai' ? 'openai' : 'ollama',
      };

      if (proxy.vault_entry_id && !knownVaultIds.has(proxy.vault_entry_id)) {
        result.danglingRefs++;
      }

      await saveProxy(proxy);
      if (conflict && mode === 'overwrite') result.overwritten++;
      if (mode === 'rename' && conflict) result.renamed++;
      if (!conflict) existingIds.add(proxy.id);
      result.imported++;
    }

    return json({ status: 'success', ...result });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
