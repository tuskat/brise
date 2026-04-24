/**
 * Chat thread — send message, SSE streaming, optimistic UI, send button.
 */

import { chatState, $ } from './chat-state.js';
import {
  appendMessage,
  appendErrorMessage,
  addLoadingMessage,
  updateStreamingMessage,
  removeStreamingMessage,
} from './chat-dom.js';
import { sendMessageStream } from './chat-api.js';
import { loadConversations } from './chat-sidebar.js';
import { t } from '../i18n/index.js';

function showToast(opts) { window.showToast?.(opts); }

// ═══════════════════════════════════════════════════════════
// SEND MESSAGE
// ═══════════════════════════════════════════════════════════

export async function handleSendMessage() {
  if (!chatState.activeConversationId || chatState.isLoading) return;

  const chatInput     = $('chat-input');
  const sendMessageBtn = $('send-message-btn');
  const messageList    = $('message-list');

  const content = chatInput?.value.trim();
  if (!content) return;

  chatState.isLoading = true;
  updateSendButton();

  // Optimistic user message
  appendMessage(messageList, {
    id: Date.now(), role: 'user', content, created_at: new Date().toISOString()
  });
  chatInput.value = '';
  chatInput.style.height = 'auto';

  const loadingId = addLoadingMessage(messageList);

  try {
    const res = await sendMessageStream(chatState.activeConversationId, content);
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    removeStreamingMessage(loadingId);

    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith('event:')) continue;
          if (!line.startsWith('data:')) continue;

          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.delta) {
              fullContent += data.delta;
              updateStreamingMessage(loadingId, fullContent);
            }
            if (data.done) {
              removeStreamingMessage(loadingId);
              appendMessage(messageList, {
                id: data.message_id,
                role: 'assistant',
                content: fullContent,
                latency: data.latency,
                status: data.status,
                persona_name: data.persona_name,
                created_at: new Date().toISOString()
              });
            }
            if (data.error) throw new Error(data.error);
          } catch (e) {
            if (e.message && !e.message.includes('JSON')) throw e;
          }
        }
      }
    }

    // Finalize if stream ended without done event
    if (fullContent && document.getElementById('streaming-msg-' + loadingId)) {
      removeStreamingMessage(loadingId);
      appendMessage(messageList, {
        id: Date.now(), role: 'assistant', content: fullContent,
        created_at: new Date().toISOString()
      });
    }

    loadConversations();
  } catch (err) {
    console.error('Failed to send message:', err);
    removeStreamingMessage(loadingId);
    appendErrorMessage(messageList, err.message);
    showToast({ message: 'Error: ' + err.message, variant: 'error' });
  } finally {
    chatState.isLoading = false;
    updateSendButton();
  }
}

// ═══════════════════════════════════════════════════════════
// SEND BUTTON STATE
// ═══════════════════════════════════════════════════════════

export function updateSendButton() {
  const chatInput      = $('chat-input');
  const sendMessageBtn = $('send-message-btn');
  if (!sendMessageBtn) return;

  const hasContent = chatInput?.value.trim();
  const hasConv = chatState.activeConversationId;
  sendMessageBtn.disabled = !hasContent || !hasConv || chatState.isLoading;
  sendMessageBtn.innerHTML = chatState.isLoading
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" class="spin"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
}

// ═══════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════

export function initThreadEvents() {
  const chatInput      = $('chat-input');
  const sendMessageBtn = $('send-message-btn');

  sendMessageBtn?.addEventListener('click', handleSendMessage);

  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  chatInput?.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
    updateSendButton();
  });
}
