/**
 * DOM helpers for ChatView — message rendering, streaming placeholders, etc.
 * All functions assume the DOM elements exist (callers guard with &&).
 */

import { escapeHtml, formatTime } from './helpers.js';
import { t } from '../i18n/index.js';

// ── SVG fragments (kept here to avoid inline noise in the component) ──

const SVG_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const SVG_DELETE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const SVG_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';

// ── Think content extraction ──

/**
 * Extract <think>/<thinking> content from raw text.
 * Returns { display: string, think: string|null }.
 * Handles both closed and unclosed (streaming) tags.
 */
export function extractThinkContent(raw) {
  if (raw == null) return { display: '', think: null };
  const str = String(raw);
  let think = null;
  let display = str;

  // Extract all complete <think>...</think> or <thinking>...</thinking> blocks
  const thinkRe = /<(?:think|thinking)>([\s\S]*?)<\/(?:think|thinking)>/gi;
  const thinkParts = [];
  let m;
  while ((m = thinkRe.exec(str)) !== null) {
    thinkParts.push(m[1]);
  }
  // Remove complete blocks
  display = display.replace(thinkRe, '');

  // Handle unclosed <think> or <thinking> (streaming mid-think)
  const unclosedRe = /<(?:think|thinking)>([\s\S]*)$/i;
  const unclosed = unclosedRe.exec(display);
  if (unclosed) {
    thinkParts.push(unclosed[1]);
    display = display.substring(0, unclosed.index);
  }

  if (thinkParts.length > 0) {
    think = thinkParts.join('\n\n');
  }

  return { display: display.trim(), think };
}

// ── Messages ──

/**
 * Build an HTML string for a chat message bubble.
 * Strips <think>/<thinking> from the bubble; adds info icon if think content exists.
 */
export function buildMessageHtml(msg) {
  const isUser = msg.role === 'user';
  const isError = msg.status === 'error';
  const time = formatTime(msg.created_at);
  const { display, think } = isUser ? { display: msg.content, think: null } : extractThinkContent(msg.content);
  const copyContent = display || msg.content;
  const hasThink = !!think;

  return '<div class="chat-msg flex-col' +
    (isUser ? ' chat-msg-user self-end' : ' chat-msg-assistant self-start') +
    (isError ? ' chat-msg-error' : '') +
    '" data-id="' + msg.id + '">' +
    '<div class="chat-msg-bubble">' + escapeHtml(display) + '</div>' +
    '<div class="flex-row gap-sm">' +
      (!isUser && msg.persona_name ? '<span class="t-micro t-weight-500 c-accent">' + escapeHtml(msg.persona_name) + '</span>' : '') +
      '<span class="t-micro c-tertiary">' + time + '</span>' +
      (!isUser && msg.latency ? '<span class="t-caption-mono c-tertiary">' + msg.latency + 'ms</span>' : '') +
      (hasThink ? '<button class="icon-btn chat-msg-think" data-think="' + escapeHtml(think) + '" title="' + t('chat.thinkTooltip') + '">' + SVG_INFO + '</button>' : '') +
      '<button class="icon-btn chat-msg-copy" data-content="' + escapeHtml(copyContent) + '" title="' + t('general.copy') + '">' +
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
    '<div class="chat-msg-bubble">' + t('general.error') + ': ' + escapeHtml(error) + '</div></div>');
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
 * Strips <think>/<thinking> blocks from the displayed text.
 */
export function updateStreamingMessage(id, content) {
  const el = document.getElementById('streaming-msg-' + id);
  if (!el) return;
  const bubble = el.querySelector('.chat-msg-bubble');
  if (bubble) {
    const { display } = extractThinkContent(content);
    // Show loading dots if still inside a think block (display is empty)
    if (!display && /<(?:think|thinking)>/i.test(content)) {
      bubble.innerHTML =
        '<span class="chat-msg-dot"></span>' +
        '<span class="chat-msg-dot"></span>' +
        '<span class="chat-msg-dot"></span>';
      el.classList.add('js-chat-msg-loading');
    } else {
      bubble.textContent = display || content;
      el.classList.remove('js-chat-msg-loading');
    }
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
  const preview = conv.last_message ? (conv.last_message.length > 40 ? conv.last_message.substring(0, 40) + '...' : conv.last_message) : t('chat.noMessages');
  const timeAgo = formatTime(conv.updated_at || conv.created_at);
  return '<div class="chat-conv-item' + (isActive ? ' chat-conv-item-active' : '') + '" data-id="' + conv.id + '">' +
    '<div class="truncate t-caption c-primary">' + escapeHtml(conv.title) + '</div>' +
    '<div class="truncate t-micro c-tertiary">' + escapeHtml(preview) + '</div>' +
    '<div class="t-micro c-tertiary">' + timeAgo + '</div>' +
    '<button class="icon-btn" data-id="' + conv.id + '" title="' + t('general.delete') + '">' +
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
        if (window.showToast) window.showToast({ message: t('general.copied'), variant: 'success' });
      });
    });
  });
  root.querySelectorAll('.chat-msg-think').forEach(btn => {
    btn.addEventListener('click', () => {
      const thinkContent = btn.dataset.think || '';
      openThinkModal(thinkContent);
    });
  });
}

/**
 * Open the think-content modal and populate it.
 */
function openThinkModal(content) {
  const modal = document.getElementById('think-modal');
  const body = document.getElementById('think-modal-body');
  if (!modal || !body) return;
  body.textContent = content;
  modal.classList.add('js-open');
}

function closeThinkModal() {
  const modal = document.getElementById('think-modal');
  if (modal) modal.classList.remove('js-open');
}

function scrollToBottom(container) {
  if (container) container.scrollTop = container.scrollHeight;
}
