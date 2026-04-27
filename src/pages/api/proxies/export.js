import { loadAllProxies } from '../../../lib/proxy-loader.js';

/**
 * GET /api/proxies/export — download a proxies bundle.
 * Proxies carry their vault_entry_id reference; no secrets are included.
 * Pair this with /api/vault/export to fully migrate to a new instance.
 */
export async function GET() {
  try {
    const proxies = await loadAllProxies();
    const sanitized = proxies.map(({ api_key, created_at, last_used, ...rest }) => rest);

    const bundle = {
      version: 1,
      kind: 'brise.proxies',
      exported_at: new Date().toISOString(),
      proxies: sanitized,
    };

    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="brise-proxies-${date}.json"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
