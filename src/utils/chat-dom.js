/**
 * DOM helpers for ChatView — message rendering, streaming placeholders, etc.
 * All functions assume the DOM elements exist (callers guard with &&).
 */

import { escapeHtml, formatTime } from './helpers.js';

// ── SVG fragments (kept here to avoid inline noise in the component) ──

const SVG_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const SVG_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

// ── Messages ──

/**
 * Build an HTML string for a chat message bubble.
 */
export function buildMessageHtml(msg) {
  const isUser = msg.role === 'user';
  const isError = msg.status === 'error';
  const time = formatTime(msg.created_at);
  return '<div class="chat-msg flex-col' +
    (isUser ? ' chat-msg-user self-end' : ' chat-msg-assistant self-start') +
    (isError ? ' chat-msg-error' : '') +
    '" data-id="' + msg.id + '">' +
    '<div class="chat-msg-bubble">' + escapeHtml(msg.content) + '</div>' +
    '<div class="flex-row gap-sm">' +
      (!isUser && msg.persona_name ? '<span class="t-micro t-weight-500 c-accent">' + escapeHtml(msg.persona_name) + '</span>' : '') +
      '<span class="t-micro c-tertiary">' + time + '</span>' +
      (!isUser && msg.latency ? '<span class="t-caption-mono c-tertiary">' + msg.latency + 'ms</span>' : '') +
      '<button class="icon-btn chat-msg-copy" data-content="' + escapeHtml(msg.content) + '" title="Copy">' +
        SVG_COPY +
      '</button>' +
    '</div>' +
  '</div>';
}

/**
 * Render a full message list into a container, filtering system messages.
 */
export function renderMessages(container, messages) {
  if (!container) return;
  const visible = messages.filter(m => m.role !== 'system');
  container.innerHTML = visible.length ? visible.map(buildMessageHtml).join('') : '';
  bindCopyButtons(container);
  scrollToBottom(container);
}

/**
 * Append a single message to the container.
 */
export function appendMessage(container, msg) {
  if (!container) return;
  container.insertAdjacentHTML('beforeend', buildMessageHtml(msg));
  bindCopyButtons(container.lastElementChild);
  scrollToBottom(container);
}

/**
 * Append an error bubble.
 */
export function appendErrorMessage(container, error) {
  if (!container) return;
  container.insertAdjacentHTML('beforeend',
    '<div class="chat-msg flex-col chat-msg-assistant self-start chat-msg-error">' +
    '<div class="chat-msg-bubble">Error: ' + escapeHtml(error) + '</div></div>');
  scrollToBottom(container);
}

// ── Streaming ──

let streamingCounter = 0;

/**
 * Insert a loading-dots placeholder; returns the unique ID for later update/removal.
 */
export function addLoadingMessage(container) {
  const id = ++streamingCounter;
  if (!container) return id;
  container.insertAdjacentHTML('beforeend',
    '<div class="chat-msg flex-col chat-msg-assistant self-start js-chat-msg-loading" id="streaming-msg-' + id + '">' +
    '<div class="chat-msg-bubble">' +
      '<span class="chat-msg-dot"></span>' +
      '<span class="chat-msg-dot"></span>' +
      '<span class="chat-msg-dot"></span>' +
    '</div></div>');
  scrollToBottom(container);
  return id;
}

/**
 * Replace the loading dots with actual streamed content.
 */
export function updateStreamingMessage(id, content) {
  const el = document.getElementById('streaming-msg-' + id);
  if (!el) return;
  const bubble = el.querySelector('.chat-msg-bubble');
  if (bubble) {
    bubble.textContent = content;
    el.classList.remove('js-chat-msg-loading');
  }
  // Scroll the nearest messages container
  const container = el.closest('.chat-messages');
  if (container) scrollToBottom(container);
}

/**
 * Remove the streaming placeholder entirely.
 */
export function removeStreamingMessage(id) {
  const el = document.getElementById('streaming-msg-' + id);
  if (el) el.remove();
}

// ── Conversation list items ──

/**
 * Build an HTML string for a sidebar conversation list item.
 */
export function buildConversationItemHtml(conv, isActive) {
  const preview = conv.last_message ? (conv.last_message.length > 40 ? conv.last_message.substring(0, 40) + '...' : conv.last_message) : 'No messages';
  const timeAgo = formatTime(conv.updated_at || conv.created_at);
  return '<div class="chat-conv-item' + (isActive ? ' chat-conv-item-active' : '') + '" data-id="' + conv.id + '">' +
    '<div class="truncate t-caption c-primary">' + escapeHtml(conv.title) + '</div>' +
    '<div class="truncate t-micro c-tertiary">' + escapeHtml(preview) + '</div>' +
    '<div class="t-micro c-tertiary">' + timeAgo + '</div>' +
    '<button class="icon-btn" data-id="' + conv.id + '" title="Delete">' +
      SVG_DELETE +
    '</button>' +
  '</div>';
}

// ── Internal ──

function bindCopyButtons(root) {
  if (!root) return;
  root.querySelectorAll('.chat-msg-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.dataset.content || '';
      navigator.clipboard.writeText(content).then(() => {
        if (window.showToast) window.showToast({ message: 'Copied!', variant: 'success' });
      });
    });
  });
}

function scrollToBottom(container) {
  if (container) container.scrollTop = container.scrollHeight;
}
