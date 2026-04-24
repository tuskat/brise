import { loadProxy, touchProxy } from './proxy-loader.js';
import { dbOperations } from '../db/index.js';

/**
 * Build OpenAI-compatible URL from a base URL.
 * Handles common patterns: removes trailing slashes, ensures /v1/chat/completions path.
 * @param {string} baseUrl - Base URL (e.g., https://api.groq.com/openai/v1 or https://api.openai.com/v1)
 * @returns {string} - Complete chat completions URL
 */
export function buildOpenAIUrl(baseUrl) {
  let url = baseUrl.trim().replace(/\/$/, '');

  // Already has the chat/completions path
  if (url.includes('/chat/completions')) {
    return url;
  }

  // Has /v1 prefix but missing /chat/completions
  if (url.includes('/v1')) {
    return `${url}/chat/completions`;
  }

  // No /v1 prefix — append standard path
  return `${url}/v1/chat/completions`;
}

/**
 * Forward request to a specific proxy backend using /api/generate endpoint
 * @param {string} proxyId - ID of the proxy config to use
 * @param {string} prompt - User prompt
 * @param {object} parameters - Persona parameters (temperature, top_p, max_tokens)
 * @returns {Promise<{success: boolean, data?: string, error?: string, latency?: number}>}
 */
export async function forwardToProxy(proxyId, prompt, parameters = {}) {
  const proxy = await loadProxy(proxyId);

  if (!proxy) {
    return {
      success: false,
      error: `Proxy '${proxyId}' not found`
    };
  }

  const schema = proxy.api_schema || 'ollama';
  const startTime = Date.now();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (!proxy.is_local_network && proxy.api_key) {
    headers['Authorization'] = `Bearer ${proxy.api_key}`;
  }

  let payload, targetUrl;

  if (schema === 'openai') {
    // OpenAI-compatible format
    targetUrl = buildOpenAIUrl(proxy.url);
    payload = {
      model: proxy.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: parameters.max_tokens ?? 2000,
      temperature: parameters.temperature ?? 0.7,
      top_p: parameters.top_p ?? 0.9,
    };
  } else {
    // Ollama /api/generate format
    targetUrl = proxy.url;
    payload = {
      model: proxy.model,
      prompt,
      stream: false,
      options: {
        temperature: parameters.temperature ?? 0.7,
        top_p: parameters.top_p ?? 0.9,
        num_predict: parameters.max_tokens ?? 2000,
      }
    };
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Proxy error: ${response.status} - ${errorText}`,
        latency: Date.now() - startTime
      };
    }

    const data = await response.json();
    await touchProxy(proxyId);

    let content;
    if (schema === 'openai') {
      content = data.choices?.[0]?.message?.content || '';
    } else {
      content = data.response || '';
    }

    return {
      success: true,
      data: content,
      latency: Date.now() - startTime
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      latency: Date.now() - startTime
    };
  }
}

/**
 * Test connection to a proxy using its configured schema.
 * Supports both Ollama and OpenAI-compatible APIs.
 * @param {Object} proxy - Proxy config { url, model, is_local_network, api_key, api_schema }
 * @returns {Promise<{success: boolean, error?: string, latency?: number}>}
 */
export async function testProxyConnection(proxy) {
  const startTime = Date.now();
  const schema = proxy.api_schema || 'ollama';

  const headers = {
    'Content-Type': 'application/json',
  };

  if (!proxy.is_local_network && proxy.api_key) {
    headers['Authorization'] = `Bearer ${proxy.api_key}`;
  }

  // Schema-aware test payload
  const payload = schema === 'openai'
    ? {
        model: proxy.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      }
    : {
        model: proxy.model,
        prompt: 'Hi',
        stream: false,
        options: { temperature: 0.1, num_predict: 5 },
      };

  // Schema-aware URL
  const testUrl = schema === 'openai'
    ? buildOpenAIUrl(proxy.url)
    : proxy.url;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(testUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        latency: Date.now() - startTime,
      };
    }

    return {
      success: true,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.name === 'AbortError' ? 'Connection timeout (10s)' : error.message,
      latency: Date.now() - startTime,
    };
  }
}

// Legacy export for backward compatibility during migration
export async function forwardToOllama(prompt, parameters = {}) {
  return forwardToProxy('ollama-local', prompt, parameters);
}

/**
 * Send a chat completion request to a proxy.
 * Supports both Ollama (/api/chat) and OpenAI-compatible schemas.
 * @param {string} proxyId - Proxy config ID
 * @param {Array<{role:string, content:string}>} messages - Message history
 * @param {object} parameters - Persona parameters (temperature, top_p, max_tokens)
 * @param {object} options - { stream: boolean, systemPrompt: string }
 * @returns {Promise<{success: boolean, data?: string, stream?: boolean, error?: string, latency?: number}>}
 */
export async function chatWithProxy(proxyId, messages, parameters = {}, options = {}) {
  const proxy = await loadProxy(proxyId);

  if (!proxy) {
    return { success: false, error: `Proxy '${proxyId}' not found` };
  }

  const schema = proxy.api_schema || 'ollama';
  const startTime = Date.now();

  const headers = {
    'Content-Type': 'application/json',
  };

  if (!proxy.is_local_network && proxy.api_key) {
    headers['Authorization'] = `Bearer ${proxy.api_key}`;
  }

  let payload, targetUrl;

  if (schema === 'openai') {
    // OpenAI-compatible chat completions format
    targetUrl = buildOpenAIUrl(proxy.url);
    const formattedMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role,
      content: m.content,
    }));
    if (options.systemPrompt) {
      formattedMessages.unshift({ role: 'system', content: options.systemPrompt });
    }
    payload = {
      model: proxy.model,
      messages: formattedMessages,
      stream: options.stream ?? false,
      temperature: parameters.temperature ?? 0.7,
      top_p: parameters.top_p ?? 0.9,
      max_tokens: parameters.max_tokens ?? 2000,
    };
  } else {
    // Ollama /api/chat format
    targetUrl = proxy.url.replace('/api/generate', '/api/chat');
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    if (options.systemPrompt) {
      formattedMessages.unshift({ role: 'system', content: options.systemPrompt });
    }
    payload = {
      model: proxy.model,
      messages: formattedMessages,
      stream: options.stream ?? false,
      options: {
        temperature: parameters.temperature ?? 0.7,
        top_p: parameters.top_p ?? 0.9,
        num_predict: parameters.max_tokens ?? 2000,
      },
    };
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Ollama fallback: try /api/generate if /api/chat returns 404
      if (schema === 'ollama' && response.status === 404) {
        return await chatWithProxyGenerateFallback(proxy, messages, parameters, options, startTime);
      }
      const errorText = await response.text();
      return {
        success: false,
        error: `Proxy error: ${response.status} - ${errorText}`,
        latency: Date.now() - startTime,
      };
    }

    await touchProxy(proxy.id);

    if (options.stream) {
      return {
        success: true,
        stream: true,
        response,
        schema,
        latency: Date.now() - startTime,
      };
    }

    let content;
    if (schema === 'openai') {
      const data = await response.json();
      content = data.choices?.[0]?.message?.content || '';
    } else {
      const data = await response.json();
      content = data.message?.content || data.response || '';
    }

    return {
      success: true,
      data: content,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Fallback to /api/generate when /api/chat is not available.
 * Concatenates message history into a single prompt.
 * Only used for Ollama proxies that lack the chat endpoint.
 */
async function chatWithProxyGenerateFallback(proxy, messages, parameters, options, startTime) {
  const headers = { 'Content-Type': 'application/json' };

  if (!proxy.is_local_network && proxy.api_key) {
    headers['Authorization'] = `Bearer ${proxy.api_key}`;
  }

  // Build prompt from message history
  let prompt = '';
  for (const msg of messages) {
    if (msg.role === 'system') continue; // Already handled via options.systemPrompt
    prompt += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n\n`;
  }
  if (options.systemPrompt) {
    prompt = `${options.systemPrompt}\n\n${prompt}`;
  }

  const payload = {
    model: proxy.model,
    prompt,
    stream: options.stream ?? false,
    options: {
      temperature: parameters.temperature ?? 0.7,
      top_p: parameters.top_p ?? 0.9,
      num_predict: parameters.max_tokens ?? 2000,
    }
  };

  try {
    const response = await fetch(proxy.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Proxy error: ${response.status} - ${errorText}`,
        latency: Date.now() - startTime,
      };
    }

    await touchProxy(proxy.id);

    if (options.stream) {
      return {
        success: true,
        stream: true,
        response,
        schema: 'ollama',
        latency: Date.now() - startTime,
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.response,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      latency: Date.now() - startTime,
    };
  }
}

/**
 * Stream helper - processes streaming response from Ollama NDJSON.
 * Yields delta strings to the callback.
 */
export async function* streamOllamaResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            yield { delta: parsed.message.content, done: parsed.done ?? false };
          }
          if (parsed.done) {
            return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}

/**
 * Stream helper - processes streaming response from OpenAI-compatible SSE.
 * Yields delta strings to the callback.
 */
export async function* streamOpenAIResponse(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          return;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield { delta, done: false };
          }
          if (parsed.choices?.[0]?.finish_reason) {
            yield { delta: '', done: true };
            return;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
}
