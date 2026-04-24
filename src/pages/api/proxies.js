import { loadAllProxies, saveProxy, deleteProxy } from '../../lib/proxy-loader.js';
import { testProxyConnection } from '../../lib/proxy-client.js';

/**
 * GET /api/proxies - List all proxies
 */
export async function GET() {
  try {
    const proxies = await loadAllProxies();
    
    // Mask API keys in response
    const sanitized = proxies.map(p => ({
      ...p,
      api_key: p.api_key ? '********' : null
    }));
    
    return new Response(JSON.stringify(sanitized), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /api/proxies - Create new proxy
 */
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { name, url, model, is_local_network, api_key, api_schema } = body;
    
    // Validation
    if (!name || !url || !model) {
      return new Response(JSON.stringify({ 
        error: 'Name, URL, and Model are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate ID from name
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Invalid name - must contain alphanumeric characters' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check for duplicate ID
    const existing = await loadAllProxies();
    if (existing.find(p => p.id === id)) {
      return new Response(JSON.stringify({ 
        error: `Proxy with ID '${id}' already exists` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch {
      return new Response(JSON.stringify({ 
        error: 'Invalid URL format' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const proxy = {
      id,
      name,
      url,
      model,
      is_local_network: is_local_network ?? true,
      api_key: is_local_network ? null : (api_key || null),
      api_schema: api_schema === 'openai' ? 'openai' : 'ollama'
    };
    
    await saveProxy(proxy);
    
    return new Response(JSON.stringify({ 
      status: 'success', 
      data: { ...proxy, api_key: proxy.api_key ? '********' : null }
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PUT /api/proxies - Update existing proxy
 */
export async function PUT({ request }) {
  try {
    const body = await request.json();
    const { id, name, url, model, is_local_network, api_key, api_schema } = body;
    
    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Proxy ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check proxy exists
    const existing = await loadAllProxies();
    const proxy = existing.find(p => p.id === id);
    
    if (!proxy) {
      return new Response(JSON.stringify({ 
        error: `Proxy '${id}' not found` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return new Response(JSON.stringify({ 
          error: 'Invalid URL format' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Update fields — never accept the masked placeholder as a real api_key
    const isMaskedKey = api_key && /^[*]+$/.test(api_key);
    const updated = {
      ...proxy,
      name: name ?? proxy.name,
      url: url ?? proxy.url,
      model: model ?? proxy.model,
      is_local_network: is_local_network ?? proxy.is_local_network,
      api_key: is_local_network === true ? null : (isMaskedKey ? proxy.api_key : (api_key ?? proxy.api_key)),
      api_schema: (api_schema === 'openai' || api_schema === 'ollama') ? api_schema : (proxy.api_schema || 'ollama')
    };
    
    await saveProxy(updated);
    
    return new Response(JSON.stringify({ 
      status: 'success', 
      data: { ...updated, api_key: updated.api_key ? '********' : null }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * DELETE /api/proxies - Delete a proxy
 */
export async function DELETE({ request }) {
  try {
    const body = await request.json();
    const { id } = body;
    
    if (!id) {
      return new Response(JSON.stringify({ 
        error: 'Proxy ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const deleted = await deleteProxy(id);
    
    if (!deleted) {
      return new Response(JSON.stringify({ 
        error: `Proxy '${id}' not found` 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      status: 'success',
      message: `Proxy '${id}' deleted`
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
