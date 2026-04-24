/**
 * Chat manage — new conversation, delete conversation, rename conversation.
 */

import { chatState, $ } from './chat-state.js';
import {
  createConversation,
  deleteConversation as apiDeleteConversation,
  renameConversation,
} from './chat-api.js';
import { loadConversations, selectConversation, renderConversationList } from './chat-sidebar.js';
import { updateSendButton } from './chat-thread.js';

function showToast(opts) { window.showToast?.(opts); }

// ═══════════════════════════════════════════════════════════
// NEW CONVERSATION
// ═══════════════════════════════════════════════════════════

export async function handleNewConversation() {
  const chatPersonaSelect = $('chat-persona-select');
  const chatProxySelect   = $('chat-proxy-select');
  const chatInput         = $('chat-input');

  const persona_id = chatPersonaSelect?.value || null;
  const proxy_id = chatProxySelect?.value || null;

  if (!proxy_id) {
    showToast({ message: 'Please select a proxy first', variant: 'warning' });
    return;
  }

  try {
    const data = await createConversation({ persona_id, proxy_id });
    await loadConversations();
    await selectConversation(data.id);
    chatInput?.focus();
  } catch (err) {
    console.error('Failed to create conversation:', err);
    showToast({ message: 'Error: ' + err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// DELETE CONVERSATION
// ═══════════════════════════════════════════════════════════

export async function handleDelete(id) {
  if (!confirm('Are you sure you want to delete this conversation?')) return;

  const chatEmptyState = $('chat-empty-state');
  const chatThread     = $('chat-thread');

  try {
    await apiDeleteConversation(id);
    if (id === chatState.activeConversationId) {
      chatState.activeConversationId = null;
      chatEmptyState?.classList.remove('js-hidden');
      chatThread?.classList.add('js-hidden');
    }
    await loadConversations();
    showToast({ message: 'Conversation deleted', variant: 'success' });
  } catch (err) {
    console.error('Failed to delete conversation:', err);
    showToast({ message: 'Error: ' + err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// RENAME CONVERSATION
// ═══════════════════════════════════════════════════════════

function openTitleEditModal() {
  const conversationTitle = $('conversation-title');
  const titleEditModal    = $('title-edit-modal');
  const titleInput        = $('title-input');

  if (!chatState.activeConversationId || !conversationTitle) return;
  if (titleInput) titleInput.value = conversationTitle.textContent || '';
  titleEditModal?.classList.add('js-open');
  titleInput?.focus();
  titleInput?.select();
}

async function handleSaveTitle() {
  const titleInput        = $('title-input');
  const conversationTitle = $('conversation-title');
  const titleEditModal    = $('title-edit-modal');

  const newTitle = titleInput?.value.trim();
  if (!newTitle || !chatState.activeConversationId) return;

  try {
    await renameConversation(chatState.activeConversationId, newTitle);
    if (conversationTitle) conversationTitle.textContent = newTitle;
    await loadConversations();
    titleEditModal?.classList.remove('js-open');
    showToast({ message: 'Title updated', variant: 'success' });
  } catch (err) {
    console.error('Failed to rename:', err);
    showToast({ message: 'Error: ' + err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════

export function initManageEvents() {
  const newChatBtn     = $('new-chat-btn');
  const editTitleBtn   = $('edit-title-btn');
  const cancelTitleBtn = $('cancel-title-btn');
  const saveTitleBtn   = $('save-title-btn');
  const titleInput     = $('title-input');
  const titleEditModal = $('title-edit-modal');
  const chatInput      = $('chat-input');
  const chatProxySelect = $('chat-proxy-select');

  newChatBtn?.addEventListener('click', handleNewConversation);

  // Open-sidebar CTA button
  const openSidebarBtn = $('chat-open-sidebar-btn');
  openSidebarBtn?.addEventListener('click', () => {
    const sidebar = $('chat-sidebar');
    const toggleBtn = $('chat-sidebar-toggle');
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      sidebar?.classList.add('js-open');
      toggleBtn?.classList.add('js-active');
    } else {
      sidebar?.classList.remove('js-collapsed');
      toggleBtn?.classList.add('js-active');
    }
  });

  editTitleBtn?.addEventListener('click', openTitleEditModal);

  cancelTitleBtn?.addEventListener('click', () => {
    titleEditModal?.classList.remove('js-open');
  });

  saveTitleBtn?.addEventListener('click', handleSaveTitle);

  titleInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSaveTitle();
    if (e.key === 'Escape') titleEditModal?.classList.remove('js-open');
  });

  titleEditModal?.addEventListener('click', (e) => {
    if (e.target === titleEditModal) titleEditModal.classList.remove('js-open');
  });
}
