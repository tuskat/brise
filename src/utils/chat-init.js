/**
 * Chat init — thin orchestrator that wires sidebar, thread, and manage modules.
 * Exposes window.initChatView for tab-nav.js to call on tab switch.
 */

import { loadChatDropdowns, loadConversations, initSidebarEvents } from './chat-sidebar.js';
import { initThreadEvents } from './chat-thread.js';
import { initManageEvents } from './chat-manage.js';

let initialized = false;

export async function initChatView() {
  await loadChatDropdowns();
  await loadConversations();

  if (!initialized) {
    initSidebarEvents();
    initThreadEvents();
    initManageEvents();
    initialized = true;
  }
}
