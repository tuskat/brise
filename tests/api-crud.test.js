import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startServer } from './helpers/ssr-server.js';

let server;
let baseUrl;

beforeAll(async () => {
  server = await startServer();
  baseUrl = server.baseUrl;
}, 30000);

afterAll(async () => {
  await server?.stop();
});

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function req(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: JSON_HEADERS,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, json };
}

describe('Conversations CRUD', () => {
  let id;

  it('creates a conversation', async () => {
    const { status, json } = await req('POST', '/api/chat/conversations', { title: 'crud-test' });
    expect(status).toBe(201);
    expect(json.status).toBe('success');
    expect(json.data.id).toBeTypeOf('number');
    id = json.data.id;
  });

  it('lists the conversation', async () => {
    const { status, json } = await req('GET', '/api/chat/conversations');
    expect(status).toBe(200);
    expect(json.data.some((c) => c.id === id)).toBe(true);
  });

  it('reads the conversation', async () => {
    const { status, json } = await req('GET', `/api/chat/${id}`);
    expect(status).toBe(200);
    expect(json.data.id).toBe(id);
  });

  it('renames the conversation', async () => {
    const { status, json } = await req('PUT', `/api/chat/${id}/title`, { title: 'renamed' });
    expect(status).toBe(200);
    expect(json.status).toBe('success');
  });

  // Regression guard: Astro v6 returns 403 ("Cross-site DELETE form submissions are forbidden")
  // for DELETE without a Content-Type header. Client must send application/json.
  it('deletes the conversation', async () => {
    const { status, json } = await req('DELETE', `/api/chat/${id}`);
    expect(status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it('rejects bare DELETE without Content-Type (Astro security)', async () => {
    const res = await fetch(`${baseUrl}/api/chat/${id}`, { method: 'DELETE' });
    expect(res.status).toBe(403);
  });

  it('list no longer contains the conversation', async () => {
    const { json } = await req('GET', '/api/chat/conversations');
    expect(json.data.some((c) => c.id === id)).toBe(false);
  });
});

describe('Personas CRUD', () => {
  const personaId = 'crud-test-persona';

  it('creates a persona', async () => {
    const { status, json } = await req('POST', '/api/personas', {
      id: personaId,
      name: 'CRUD Test',
      system_prompt: 'You are a test.'
    });
    expect(status).toBe(201);
    expect(json.data.id).toBe(personaId);
  });

  it('lists personas', async () => {
    const { status, json } = await req('GET', '/api/personas');
    expect(status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    expect(json.some((p) => p.id === personaId)).toBe(true);
  });

  it('updates a persona', async () => {
    const { status, json } = await req('PUT', '/api/personas', {
      id: personaId,
      name: 'CRUD Test Updated'
    });
    expect(status).toBe(200);
    expect(json.data.name).toBe('CRUD Test Updated');
  });

  it('deletes a persona', async () => {
    const { status, json } = await req('DELETE', '/api/personas', { id: personaId });
    expect(status).toBe(200);
    expect(json.status).toBe('success');
  });

  it('persona is gone', async () => {
    const { json } = await req('GET', '/api/personas');
    expect(json.some((p) => p.id === personaId)).toBe(false);
  });
});

describe('Proxies CRUD', () => {
  const proxyName = 'crud-test-proxy';
  const proxyId = 'crud-test-proxy';

  it('creates a proxy', async () => {
    const { status, json } = await req('POST', '/api/proxies', {
      name: proxyName,
      url: 'http://example.com',
      model: 'test-model',
      is_local_network: true,
      api_schema: 'openai'
    });
    expect(status).toBe(201);
    expect(json.data.id).toBe(proxyId);
  });

  it('lists proxies', async () => {
    const { status, json } = await req('GET', '/api/proxies');
    expect(status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    expect(json.some((p) => p.id === proxyId)).toBe(true);
  });

  it('updates a proxy', async () => {
    const { status, json } = await req('PUT', '/api/proxies', {
      id: proxyId,
      name: proxyName,
      url: 'http://example.com',
      model: 'updated-model',
      is_local_network: true,
      api_schema: 'openai'
    });
    expect(status).toBe(200);
    expect(json.data.model).toBe('updated-model');
  });

  it('deletes a proxy', async () => {
    const { status, json } = await req('DELETE', '/api/proxies', { id: proxyId });
    expect(status).toBe(200);
    expect(json.status).toBe('success');
  });

  it('proxy is gone', async () => {
    const { json } = await req('GET', '/api/proxies');
    expect(json.some((p) => p.id === proxyId)).toBe(false);
  });
});
