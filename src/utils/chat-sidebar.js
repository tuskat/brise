/**
 * Chat sidebar — conversation list, search, select, DOM refs for sidebar area.
 * Sidebar is now on the right side; toggle works on both desktop and mobile.
 */

import {
  chatState, $,
} from './chat-state.js';
import {
  buildConversationItemHtml,
  renderMessages,
} from './chat-dom.js';
import {
  fetchConversations,
  fetchConversation,
  loadDropdowns,
} from './chat-api.js';
import { handleDelete } from './chat-manage.js';

function showToast(opts) { window.showToast?.(opts); }

// ═══════════════════════════════════════════════════════════
// DOM REFS (sidebar area only)
// ═══════════════════════════════════════════════════════════

function getRefs() {
  return {
    chatSearch:        $('chat-search'),
    conversationList:  $('conversation-list'),
    chatPersonaSelect: $('chat-persona-select'),
    chatProxySelect:   $('chat-proxy-select'),
    chatEmptyState:    $('chat-empty-state'),
    chatThread:        $('chat-thread'),
    conversationTitle: $('conversation-title'),
    conversationModel: $('conversation-model'),
    conversationPersona: $('conversation-persona'),
    chatSidebar:       $('chat-sidebar'),
    chatSidebarToggle: $('chat-sidebar-toggle'),
    chatInput:         $('chat-input'),
    chatConfigSection: $('chat-config-section'),
    chatConfigToggle:  $('chat-config-toggle'),
  };
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR TOGGLE (desktop: collapse/expand, mobile: slide)
// ═══════════════════════════════════════════════════════════

function toggleSidebar() {
  const refs = getRefs();
  const sidebar = refs.chatSidebar;
  const toggleBtn = refs.chatSidebarToggle;
  if (!sidebar || !toggleBtn) return;

  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (isMobile) {
    // Mobile: slide overlay
    const isOpen = sidebar.classList.contains('js-open');
    sidebar.classList.toggle('js-open', !isOpen);
    toggleBtn.classList.toggle('js-active', !isOpen);
  } else {
    // Desktop: collapse/expand
    const isCollapsed = sidebar.classList.contains('js-collapsed');
    sidebar.classList.toggle('js-collapsed', !isCollapsed);
    toggleBtn.classList.toggle('js-active', !isCollapsed);
  }
}

function closeMobileSidebar() {
  const refs = getRefs();
  refs.chatSidebar?.classList.remove('js-open');
  refs.chatSidebarToggle?.classList.remove('js-active');
}

// ═══════════════════════════════════════════════════════════
// CONFIG SECTION TOGGLE
// ═══════════════════════════════════════════════════════════

function toggleConfigSection() {
  const refs = getRefs();
  refs.chatConfigSection?.classList.toggle('js-minimized');
}

// ═══════════════════════════════════════════════════════════
// CONVERSATION LIST
// ═══════════════════════════════════════════════════════════

export async function loadConversations() {
  try {
    chatState.conversations = await fetchConversations();
    renderConversationList();
  } catch (err) {
    console.error('Failed to load conversations:', err);
    showToast({ message: 'Failed to load conversations: ' + err.message, variant: 'error' });
  }
}

export function renderConversationList() {
  const { conversationList } = getRefs();
  if (!conversationList) return;

  const filtered = chatState.conversations.filter(c =>
    (c.title || '').toLowerCase().includes(chatState.searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    conversationList.innerHTML =
      '<p style="text-align:center;color:var(--text-tertiary);font-size:0.875rem;padding:1rem;">' +
      (chatState.searchQuery ? 'No conversations found' : 'No conversations yet') + '</p>';
    return;
  }

  conversationList.innerHTML = filtered.map(conv =>
    buildConversationItemHtml(conv, conv.id === chatState.activeConversationId)
  ).join('');

  // Click handlers
  conversationList.querySelectorAll('.chat-conv-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      selectConversation(parseInt(item.dataset.id));
    });
  });
  conversationList.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDelete(parseInt(btn.dataset.id));
    });
  });
}

// ═══════════════════════════════════════════════════════════
// SELECT / LOAD CONVERSATION
// ═══════════════════════════════════════════════════════════

export async function selectConversation(id) {
  if (chatState.isLoading) return;
  chatState.activeConversationId = id;
  renderConversationList();

  const refs = getRefs();

  try {
    const conv = await fetchConversation(id);
    refs.chatEmptyState?.classList.add('js-hidden');
    refs.chatThread?.classList.remove('js-hidden');
    if (refs.conversationTitle) refs.conversationTitle.textContent = conv.title;
    if (refs.conversationModel)  refs.conversationModel.textContent  = conv.model        || 'No model';
    if (refs.conversationPersona) {
      refs.conversationPersona.textContent = conv.persona_name || '';
      refs.conversationPersona.style.display = conv.persona_name ? '' : 'none';
    }
    if (refs.chatPersonaSelect) refs.chatPersonaSelect.value = conv.persona_id || '';
    if (refs.chatProxySelect)   refs.chatProxySelect.value   = conv.proxy_id   || '';
    const messageList = $('message-list');
    renderMessages(messageList, conv.messages || []);
    refs.chatInput?.focus();
    closeMobileSidebar();
  } catch (err) {
    console.error('Failed to load conversation:', err);
    showToast({ message: 'Error: ' + err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// DROPDOWN LOADER (called by init and by tab-nav after CRUD)
// ═══════════════════════════════════════════════════════════

export async function loadChatDropdowns() {
  const refs = getRefs();
  await loadDropdowns(refs.chatPersonaSelect, refs.chatProxySelect);
}

// ═══════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════

export function initSidebarEvents() {
  const refs = getRefs();

  refs.chatSearch?.addEventListener('input', (e) => {
    chatState.searchQuery = e.target.value;
    renderConversationList();
  });

  // Sidebar toggle — works on both desktop (collapse) and mobile (slide)
  refs.chatSidebarToggle?.addEventListener('click', toggleSidebar);

  // Config section toggle
  refs.chatConfigToggle?.addEventListener('click', toggleConfigSection);

  // Backdrop click closes chat sidebar on mobile
  const backdrop = $('chat-sidebar-backdrop');
  backdrop?.addEventListener('click', closeMobileSidebar);
}
