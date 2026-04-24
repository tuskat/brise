/**
 * Chat API client — all network calls for the ChatView feature.
 * Returns parsed JSON; callers handle UI state.
 */

/**
 * GET /api/chat/conversations — list all conversations.
 */
export async function fetchConversations() {
  const res = await fetch('/api/chat/conversations');
  const result = await res.json();
  if (!res.ok || result.status !== 'success') {
    throw new Error(result.error || 'Failed to load conversations');
  }
  return result.data || [];
}

/**
 * GET /api/chat/:id — load a single conversation with messages.
 */
export async function fetchConversation(id) {
  const res = await fetch('/api/chat/' + id);
  const result = await res.json();
  if (!res.ok || result.status !== 'success') {
    throw new Error(result.error || 'Failed to load conversation');
  }
  return result.data;
}

/**
 * POST /api/chat/conversations — create a new conversation.
 */
export async function createConversation({ persona_id, proxy_id }) {
  const res = await fetch('/api/chat/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'New Conversation', persona_id, proxy_id })
  });
  const result = await res.json();
  if (!res.ok || result.status !== 'success') {
    throw new Error(result.error || 'Failed to create conversation');
  }
  return result.data;
}

/**
 * DELETE /api/chat/:id — delete a conversation.
 */
export async function deleteConversation(id) {
  const res = await fetch('/api/chat/' + id, { method: 'DELETE' });
  const result = await res.json();
  if (!res.ok || result.status !== 'success') {
    throw new Error(result.error || 'Delete failed');
  }
  return result.data;
}

/**
 * PUT /api/chat/:id/title — rename a conversation.
 */
export async function renameConversation(id, title) {
  const res = await fetch('/api/chat/' + id + '/title', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  const result = await res.json();
  if (!res.ok || result.status !== 'success') {
    throw new Error(result.error || 'Rename failed');
  }
  return result.data;
}

/**
 * POST /api/chat/:id/messages — send a message with SSE streaming.
 * Returns the raw Response for the caller to consume the stream.
 */
export async function sendMessageStream(conversationId, content) {
  const res = await fetch('/api/chat/' + conversationId + '/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, stream: true })
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errData.error || 'Failed to send message');
  }
  return res;
}

/**
 * Populate <select> elements with personas and proxies.
 */
export async function loadDropdowns(personaSelect, proxySelect) {
  try {
    const res = await fetch('/api/personas');
    const data = await res.json();
    if (res.ok && Array.isArray(data) && personaSelect) {
      personaSelect.innerHTML = '<option value="">Default</option>';
      data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        personaSelect.appendChild(opt);
      });
    }
  } catch (err) { console.error('Failed to load personas', err); }

  try {
    const res = await fetch('/api/proxies');
    const data = await res.json();
    if (res.ok && Array.isArray(data) && proxySelect) {
      proxySelect.innerHTML = '<option value="">Select proxy...</option>';
      data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        proxySelect.appendChild(opt);
      });
    }
  } catch (err) { console.error('Failed to load proxies', err); }
}
