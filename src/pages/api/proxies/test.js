import { loadProxy } from '../../../lib/proxy-loader.js';
import { testProxyConnection } from '../../../lib/proxy-client.js';

/**
 * POST /api/proxies/test - Test connection to a proxy
 * Body: { id?: string, url?: string, model?: string, is_local_network?: boolean, api_key?: string, api_schema?: string }
 * If id is provided, loads existing proxy. Otherwise uses provided fields.
 */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { id, url, model, is_local_network, api_key, api_schema } = body;
    
    let proxy;
    
    if (id) {
      // Test existing proxy
      proxy = await loadProxy(id);
      if (!proxy) {
        return new Response(JSON.stringify({ 
          success: false,
          error: `Proxy '${id}' not found` 
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Test with provided fields (for testing before save)
      if (!url || !model) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'URL and Model are required for testing' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      proxy = {
        url,
        model,
        is_local_network: is_local_network ?? true,
        api_key: api_key || null,
        api_schema: api_schema || 'ollama'
      };
    }
    
    const result = await testProxyConnection(proxy);
    
    return new Response(JSON.stringify({
      success: result.success,
      error: result.error || null,
      latency: result.latency
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
