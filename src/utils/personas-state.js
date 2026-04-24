/**
 * Personas state — CRUD operations, modal management, list rendering.
 * Called by tab-nav.js when the personas tab becomes active.
 */

import { escapeHtml } from './helpers.js';

const showToast = () => window.showToast;

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

let personas = [];
let editingPersonaId = null;
let deletingPersonaId = null;

/** Expose current personas so tab-nav can sync dropdowns */
export function getPersonas() { return personas; }

// ═══════════════════════════════════════════════════════════
// DOM REFS (resolved lazily)
// ═══════════════════════════════════════════════════════════

function getRefs() {
  return {
    personasList:        document.getElementById('personas-list'),
    newPersonaBtn:       document.getElementById('new-persona-btn'),
    personaFormModal:    document.getElementById('persona-form-modal'),
    personaForm:         document.getElementById('persona-form'),
    personaFormTitle:    document.getElementById('persona-form-title'),
    personaFormSubmit:   document.getElementById('persona-form-submit'),
    personaFormClose:    document.getElementById('persona-form-close'),
    personaFormCancel:   document.getElementById('persona-form-cancel'),
    personaDeleteModal:  document.getElementById('persona-delete-modal'),
    deletePersonaName:   document.getElementById('delete-persona-name'),
    confirmPersonaDeleteBtn: document.getElementById('confirm-delete-btn'),
    cancelPersonaDeleteBtn:  document.getElementById('cancel-delete-btn'),
  };
}

// ═══════════════════════════════════════════════════════════
// LIST RENDERING
// ═══════════════════════════════════════════════════════════

export async function loadPersonasList() {
  const { personasList } = getRefs();
  if (!personasList) return;
  personasList.innerHTML = '<p class="placeholder">Loading personas...</p>';

  try {
    const response = await fetch('/api/personas');
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error('Failed to load personas');
    }

    personas = data;

    if (personas.length === 0) {
      personasList.innerHTML = '<p class="placeholder">No personas yet. Create one to get started.</p>';
      return;
    }

    personasList.innerHTML = '';
    personas.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'card card-hover';
      card.innerHTML = `
        <div class="flex-grow">
          <div class="row-between">
            <h3 class="t-card-title">${escapeHtml(p.name)}</h3>
            <span class="badge badge-persona">${escapeHtml(p.id)}</span>
          </div>
          <p class="flex-row flex-wrap gap-sm" style="font-size:0.8125rem;color:var(--text-secondary);margin:0.5rem 0 0">
            <span class="badge badge-caps badge-accent">Temp: ${p.parameters?.temperature ?? 0.7}</span>
            <span class="badge badge-caps badge-accent">TopP: ${p.parameters?.top_p ?? 0.9}</span>
            <span class="badge badge-caps badge-accent">Max: ${p.parameters?.max_tokens ?? 2000}</span>
          </p>
        </div>
        <div class="flex-row gap-sm mt-md pt-md border-t">
          <button class="btn btn-primary" data-id="${escapeHtml(p.id)}">Edit</button>
          <button class="btn btn-danger" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">Delete</button>
        </div>
      `;

      card.querySelector('.btn-primary')?.addEventListener('click', () => openEditPersonaModal(p.id));
      card.querySelector('.btn-danger')?.addEventListener('click', (e) => {
        const target = e.currentTarget;
        openDeletePersonaModal(target.dataset.name || '', target.dataset.id || '');
      });

      personasList.appendChild(card);
    });
  } catch (err) {
    personasList.innerHTML = `<p class="placeholder">Error: ${escapeHtml(err.message)}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════
// MODAL MANAGEMENT
// ═══════════════════════════════════════════════════════════

function openNewPersonaModal() {
  const refs = getRefs();
  editingPersonaId = null;
  refs.personaForm?.reset();
  if (refs.personaFormTitle) refs.personaFormTitle.textContent = 'New Persona';
  if (refs.personaFormSubmit) refs.personaFormSubmit.textContent = 'Create Persona';
  const idInput = document.getElementById('pf-id');
  if (idInput) idInput.disabled = false;
  refs.personaFormModal?.classList.add('js-open');
}

function openEditPersonaModal(id) {
  const refs = getRefs();
  const persona = personas.find(p => p.id === id);
  if (!persona) return;

  editingPersonaId = id;

  const idInput = document.getElementById('pf-id');
  const nameInput = document.getElementById('pf-name');
  const promptInput = document.getElementById('pf-prompt');
  const tempInput = document.getElementById('pf-temp');
  const topPInput = document.getElementById('pf-topp');
  const maxTokensInput = document.getElementById('pf-maxtokens');

  if (idInput)         { idInput.value = persona.id; idInput.disabled = true; }
  if (nameInput)        nameInput.value = persona.name;
  if (promptInput)      promptInput.value = persona.system_prompt;
  if (tempInput)        tempInput.value = persona.parameters?.temperature?.toString() ?? '0.7';
  if (topPInput)        topPInput.value = persona.parameters?.top_p?.toString() ?? '0.9';
  if (maxTokensInput)   maxTokensInput.value = persona.parameters?.max_tokens?.toString() ?? '2000';

  if (refs.personaFormTitle)  refs.personaFormTitle.textContent = 'Edit Persona';
  if (refs.personaFormSubmit) refs.personaFormSubmit.textContent = 'Save Changes';
  refs.personaFormModal?.classList.add('js-open');
}

function openDeletePersonaModal(name, id) {
  const refs = getRefs();
  deletingPersonaId = id;
  if (refs.deletePersonaName) refs.deletePersonaName.textContent = name;
  refs.personaDeleteModal?.classList.add('js-open');
}

// ═══════════════════════════════════════════════════════════
// FORM SUBMIT + DELETE
// ═══════════════════════════════════════════════════════════

async function handlePersonaFormSubmit(e) {
  e.preventDefault();

  const idInput        = document.getElementById('pf-id');
  const nameInput      = document.getElementById('pf-name');
  const promptInput    = document.getElementById('pf-prompt');
  const tempInput      = document.getElementById('pf-temp');
  const topPInput      = document.getElementById('pf-topp');
  const maxTokensInput = document.getElementById('pf-maxtokens');

  const id            = idInput?.value?.trim();
  const name          = nameInput?.value?.trim();
  const system_prompt = promptInput?.value?.trim();
  const temperature   = parseFloat(tempInput?.value) || 0.7;
  const top_p         = parseFloat(topPInput?.value) || 0.9;
  const max_tokens    = parseInt(maxTokensInput?.value) || 2000;

  if (!id || !name || !system_prompt) {
    showToast()?.({ message: 'Please fill in all required fields', variant: 'warning' });
    return;
  }

  const payload = { id, name, system_prompt, parameters: { temperature, top_p, max_tokens } };

  try {
    const method = editingPersonaId ? 'PUT' : 'POST';
    const response = await fetch('/api/personas', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showToast()?.({ message: result.error || 'Failed to save persona', variant: 'error' });
      return;
    }

    showToast()?.({ message: editingPersonaId ? 'Persona updated' : 'Persona created', variant: 'success' });
    const { personaFormModal } = getRefs();
    personaFormModal?.classList.remove('js-open');
    loadPersonasList();
    // Notify tab-nav to refresh dropdowns
    if (window.loadChatDropdowns) window.loadChatDropdowns();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

async function handlePersonaDelete() {
  if (!deletingPersonaId) return;

  try {
    const response = await fetch('/api/personas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deletingPersonaId })
    });

    const result = await response.json();

    if (!response.ok) {
      showToast()?.({ message: result.error || 'Failed to delete persona', variant: 'error' });
      return;
    }

    showToast()?.({ message: 'Persona deleted', variant: 'success' });
    const { personaDeleteModal } = getRefs();
    personaDeleteModal?.classList.remove('js-open');
    loadPersonasList();
    if (window.loadChatDropdowns) window.loadChatDropdowns();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════

export function initPersonasEvents() {
  const refs = getRefs();

  refs.newPersonaBtn?.addEventListener('click', openNewPersonaModal);
  refs.personaForm?.addEventListener('submit', handlePersonaFormSubmit);
  refs.confirmPersonaDeleteBtn?.addEventListener('click', handlePersonaDelete);

  // Modal close buttons
  refs.personaFormClose?.addEventListener('click', () => refs.personaFormModal?.classList.remove('js-open'));
  refs.personaFormCancel?.addEventListener('click', () => refs.personaFormModal?.classList.remove('js-open'));
  refs.cancelPersonaDeleteBtn?.addEventListener('click', () => refs.personaDeleteModal?.classList.remove('js-open'));

  // Click-outside-to-close
  refs.personaFormModal?.addEventListener('click', (e) => {
    if (e.target === refs.personaFormModal) refs.personaFormModal.classList.remove('js-open');
  });
  refs.personaDeleteModal?.addEventListener('click', (e) => {
    if (e.target === refs.personaDeleteModal) refs.personaDeleteModal.classList.remove('js-open');
  });
}
