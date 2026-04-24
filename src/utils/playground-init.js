/**
 * Playground init — orchestrator that wires send + dropdowns.
 * History is now in history-state.js (separate History tab).
 */

import { pgState, $ } from './pg-state.js';
import { loadPlaygroundDropdowns as apiLoadDropdowns } from './playground-api.js';
import { initSendEvents } from './playground-send.js';

// ═══════════════════════════════════════════════════════════
// DROPDOWN WRAPPER
// ═══════════════════════════════════════════════════════════

function loadDropdownsLocal() {
  const personaSelect = $('pg-persona-select');
  const proxySelect   = $('pg-proxy-select');
  return apiLoadDropdowns(personaSelect, proxySelect);
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

export async function initPlaygroundView() {
  await loadDropdownsLocal();
  initSendEvents();
}

// Expose for tab switching
window.loadPlaygroundDropdowns = loadDropdownsLocal;
