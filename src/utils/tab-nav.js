/**
 * Tab navigation — sidebar switching, theme toggle, tab state management.
 * This is the central orchestrator that wires all *-state modules together.
 */

import { loadMetrics } from './dashboard-state.js';
import { loadPersonasList, initPersonasEvents } from './personas-state.js';
import { loadProxiesList, initProxiesEvents, getProxies } from './proxies-state.js';
import { applyTranslations } from '../i18n/index.js';

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

let currentTab = 'dashboard';
let eventsInitialized = false;

// ═══════════════════════════════════════════════════════════
// DOM REFS (resolved lazily)
// ═══════════════════════════════════════════════════════════

function getRefs() {
  return {
    sidebar:       document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebarLinks:  document.querySelectorAll('.sidebar-link'),
    themeToggle:   document.getElementById('theme-toggle'),
    dashboardView: document.getElementById('dashboard-view'),
    chatView:      document.getElementById('chat-view'),
    playgroundView: document.getElementById('playground-view'),
    historyView:      document.getElementById('history-view'),
    personasView:  document.getElementById('personas-view'),
    proxiesView:   document.getElementById('proxies-view'),
    mainContent: document.querySelector('.main-content'),
  };
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ═══════════════════════════════════════════════════════════

function toggleSidebar() {
  const refs = getRefs();
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  if (isMobile) {
    // Mobile: slide overlay open/close
    const isOpen = refs.sidebar?.classList.contains('js-open');
    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  } else {
    // Desktop: collapse/expand, always togglable
    const isCollapsed = refs.sidebar?.classList.contains('js-collapsed');
    refs.sidebar?.classList.toggle('js-collapsed', !isCollapsed);
    refs.mainContent?.classList.toggle('js-sidebar-collapsed', !isCollapsed);
  }
}

function openMobileMenu() {
  const refs = getRefs();
  refs.sidebar?.classList.add('js-open');
  refs.mobileMenuBtn?.classList.add('js-menu-open');
}

function closeMobileMenu() {
  const refs = getRefs();
  refs.sidebar?.classList.remove('js-open');
  refs.mobileMenuBtn?.classList.remove('js-menu-open');
}

// ═══════════════════════════════════════════════════════════
// DROPDOWN SYNC
// ═══════════════════════════════════════════════════════════

/**
 * Refresh persona/proxy dropdowns in all views after a CRUD operation.
 * Each view exposes its own refresh function on window.
 */
function refreshAllDropdowns() {
  if (window.loadPlaygroundDropdowns) window.loadPlaygroundDropdowns();
  // ChatView re-loads dropdowns on initChatView, which is called on tab switch
}

// ═══════════════════════════════════════════════════════════
// TAB SWITCHING
// ═══════════════════════════════════════════════════════════

function switchTab(tab) {
  currentTab = tab;
  localStorage.setItem('brise_active_tab', tab);

  const refs = getRefs();

  // Update sidebar active state
  refs.sidebarLinks.forEach(link => {
    const linkTab = link.getAttribute('data-tab');
    if (linkTab === tab) {
      link.classList.add('js-sidebar-link-active');
    } else {
      link.classList.remove('js-sidebar-link-active');
    }
  });

  // Hide all views with a micro-fade reset so re-showing triggers animation
  [refs.dashboardView, refs.chatView, refs.playgroundView, refs.historyView, refs.personasView, refs.proxiesView].forEach(v => {
    if (v) {
      v.classList.add('js-hidden');
      v.classList.remove('js-view-visible');
    }
  });

  if (tab == 'chat') {
    refs.mainContent?.classList.add('chat-content');
  } else {
    refs.mainContent?.classList.remove('chat-content');
  }

  // Show active view with fade-in
  switch (tab) {
    case 'dashboard':
      refs.dashboardView?.classList.remove('js-hidden');
      requestAnimationFrame(() => refs.dashboardView?.classList.add('js-view-visible'));
      loadMetrics();
      break;
    case 'chat':
      refs.chatView?.classList.remove('js-hidden');
      requestAnimationFrame(() => refs.chatView?.classList.add('js-view-visible'));
      if (window.initChatView) window.initChatView();
      break;
    case 'playground':
      refs.playgroundView?.classList.remove('js-hidden');
      requestAnimationFrame(() => refs.playgroundView?.classList.add('js-view-visible'));
      if (window.loadPlaygroundDropdowns) window.loadPlaygroundDropdowns();
      break;
    case 'history':
      refs.historyView?.classList.remove('js-hidden');
      requestAnimationFrame(() => refs.historyView?.classList.add('js-view-visible'));
      if (window.loadHistoryList) window.loadHistoryList();
      break;
    case 'personas':
      refs.personasView?.classList.remove('js-hidden');
      requestAnimationFrame(() => refs.personasView?.classList.add('js-view-visible'));
      loadPersonasList();
      break;
    case 'proxies':
      refs.proxiesView?.classList.remove('js-hidden');
      requestAnimationFrame(() => refs.proxiesView?.classList.add('js-view-visible'));
      loadProxiesList();
      break;
  }

  // Close mobile menu after tab switch
  closeMobileMenu();
}



// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

export function initTabNav() {
  const refs = getRefs();

  // Desktop: sidebar toggle in brand row
  refs.sidebarToggle?.addEventListener('click', toggleSidebar);

  // Mobile: external hamburger button
  refs.mobileMenuBtn?.addEventListener('click', toggleSidebar);

  // Mobile: close button inside sidebar
  const mobileCloseBtn = document.getElementById('mobile-close-btn');
  mobileCloseBtn?.addEventListener('click', closeMobileMenu);

  // Sidebar link clicks
  refs.sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = e.currentTarget.getAttribute('data-tab');
      if (tab) switchTab(tab);
    });
  });

  // Theme toggle
  refs.themeToggle?.addEventListener('click', () => {
    document.documentElement.classList.toggle('js-light');
    const isLight = document.documentElement.classList.contains('js-light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  });

  // Wire sub-module events (only once)
  if (!eventsInitialized) {
    initPersonasEvents();
    initProxiesEvents();

    eventsInitialized = true;
  }

  // Expose dropdown loader so personas/proxies-state can call it after CRUD
  window.loadChatDropdowns = refreshAllDropdowns;

  // Initial dropdown load — playground loads its own on tab switch
  if (window.loadPlaygroundDropdowns) window.loadPlaygroundDropdowns();

  // Restore saved tab or default to dashboard
  const savedTab = localStorage.getItem('brise_active_tab');
  if (savedTab && ['dashboard','chat','playground','history','personas','proxies'].includes(savedTab)) {
    switchTab(savedTab);
  } else {
    switchTab('dashboard');
  }

  // Apply i18n to sidebar (already done by Layout init, but safe to re-apply)
  applyTranslations();
}
