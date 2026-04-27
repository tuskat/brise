/**
 * Proxies state — CRUD operations, modal management, status checks,
 * connection testing, list rendering.
 * Called by tab-nav.js when the proxies tab becomes active.
 */

import { escapeHtml, formatTime } from './helpers.js';
import { t } from '../i18n/index.js';
import { withVaultHeader, getVaultToken } from './vault-token.js';
import { checkVaultLockedResponse } from './vault-indicator.js';

const showToast = () => window.showToast;

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

let proxies = [];
let editingProxyId = null;
let deletingProxyId = null;
let vaultEntries = [];

/** Expose current proxies so tab-nav can sync dropdowns */
export function getProxies() { return proxies; }

// ═══════════════════════════════════════════════════════════
// DOM REFS (resolved lazily)
// ═══════════════════════════════════════════════════════════

function getRefs() {
  return {
    proxiesList:         document.getElementById('proxies-list'),
    newProxyBtn:         document.getElementById('new-proxy-btn'),
    proxyFormModal:      document.getElementById('proxy-form-modal'),
    proxyForm:           document.getElementById('proxy-form'),
    proxyFormTitle:      document.getElementById('proxy-form-title'),
    proxyFormSubmit:     document.getElementById('proxy-form-submit'),
    proxyFormClose:      document.getElementById('proxy-form-close'),
    proxyFormCancel:     document.getElementById('proxy-form-cancel'),
    proxyDeleteModal:    document.getElementById('proxy-delete-modal'),
    deleteProxyName:     document.getElementById('delete-proxy-name'),
    confirmProxyDeleteBtn: document.getElementById('confirm-proxy-delete-btn'),
    cancelProxyDeleteBtn:  document.getElementById('cancel-proxy-delete-btn'),
    localCheckbox:       document.getElementById('px-local'),
    apiKeyField:         document.getElementById('api-key-field'),
    apiSchemaSelect:     document.getElementById('px-schema'),
    urlHint:             document.getElementById('px-url-hint'),
    vaultEntrySelect:    document.getElementById('px-vault-entry'),
    vaultHint:           document.getElementById('px-vault-hint'),
    exportBtn:           document.getElementById('export-proxies-btn'),
    importBtn:           document.getElementById('import-proxies-btn'),
    importFile:          document.getElementById('import-proxies-file'),
    importModal:         document.getElementById('proxy-import-modal'),
    importMode:          document.getElementById('proxy-import-mode'),
    importFilename:      document.getElementById('proxy-import-filename'),
    importConfirm:       document.getElementById('proxy-import-confirm'),
    importCancel:        document.getElementById('proxy-import-cancel'),
    importClose:         document.getElementById('proxy-import-close'),
  };
}

let pendingProxyImport = null;

// ═══════════════════════════════════════════════════════════
// VAULT PICKER
// ═══════════════════════════════════════════════════════════

async function loadVaultEntries() {
  vaultEntries = [];
  if (!getVaultToken()) return;
  try {
    const r = await fetch('/api/vault/entries', { headers: withVaultHeader() });
    if (!r.ok) return;
    const data = await r.json();
    if (Array.isArray(data)) vaultEntries = data;
  } catch { /* ignore */ }
}

function populateVaultPicker(selectedId, providerHint) {
  const refs = getRefs();
  const select = refs.vaultEntrySelect;
  if (!select) return;

  const filtered = providerHint
    ? vaultEntries.filter(e => e.provider === providerHint || e.provider === 'other')
    : vaultEntries;

  // Preserve the placeholder option
  select.innerHTML = '';
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = t('proxies.form.vaultEntryNone');
  select.appendChild(blank);

  for (const e of filtered) {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = `${e.label} (${e.provider})`;
    select.appendChild(opt);
  }
  if (selectedId) select.value = selectedId;

  if (refs.vaultHint) {
    if (!getVaultToken()) {
      refs.vaultHint.textContent = t('proxies.form.vaultLocked');
    } else if (filtered.length === 0) {
      refs.vaultHint.textContent = t('proxies.form.vaultEmpty');
    } else {
      refs.vaultHint.textContent = t('proxies.form.vaultEntryHint');
    }
  }
}

// ═══════════════════════════════════════════════════════════
// LIST RENDERING
// ═══════════════════════════════════════════════════════════

export async function loadProxiesList() {
  const { proxiesList } = getRefs();
  if (!proxiesList) return;
  proxiesList.innerHTML = '<p class="placeholder">' + t('proxies.loading') + '</p>';

  try {
    const response = await fetch('/api/proxies');
    const data = await response.json();

    if (!response.ok || !Array.isArray(data)) {
      throw new Error('Failed to load proxies');
    }

    proxies = data;

    if (proxies.length === 0) {
      proxiesList.innerHTML = '<p class="placeholder">' + t('proxies.noneYet') + '</p>';
      return;
    }

    proxiesList.innerHTML = '';
    proxies.forEach((p) => {
      const card = document.createElement('div');
      card.className = 'card card-hover';
      card.dataset.proxyId = p.id;

      const localBadge = p.is_local_network
        ? '<span class="badge badge-caps badge-local">' + t('proxies.local') + '</span>'
        : '<span class="badge badge-caps badge-remote">' + t('proxies.remote') + '</span>';

      card.innerHTML = `
        <div class="row-between" style="margin-bottom:0.75rem">
          <div class="flex-row gap-sm t-caption t-weight-600" id="status-${escapeHtml(p.id)}">
            <span class="status-dot status-dot-unknown"></span>
            <span class="status-text">${t('proxies.status.checking')}</span>
          </div>
          ${localBadge}
        </div>
        <div class="flex-grow">
          <h3 class="t-card-title" style="margin-bottom:0.25rem">${escapeHtml(p.name)}</h3>
          <p class="t-caption-mono c-tertiary" style="margin:0 0 0.5rem">${escapeHtml(p.url)}</p>
          <div class="flex-row flex-wrap gap-sm" style="font-size:0.75rem;color:var(--text-tertiary)">
            <span class="badge badge-caps badge-accent">${escapeHtml(p.model)}</span>
            ${p.last_used ? `<span>• ${t('proxies.lastUsed')}: ${formatTime(p.last_used)}</span>` : ''}
          </div>
        </div>
        <div class="flex-row gap-sm mt-md pt-md border-t">
          <button class="btn btn-secondary" data-id="${escapeHtml(p.id)}">${t('general.test')}</button>
          <button class="btn btn-primary" data-id="${escapeHtml(p.id)}">${t('general.edit')}</button>
          <button class="btn btn-danger" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">${t('general.delete')}</button>
        </div>
      `;

      const buttons = card.querySelectorAll('button');
      buttons.forEach(btn => {
        if (btn.textContent === t('general.test')) btn.addEventListener('click', () => testProxyById(btn.dataset.id || ''));
        if (btn.textContent === t('general.edit')) btn.addEventListener('click', () => openEditProxyModal(btn.dataset.id || ''));
        if (btn.textContent === t('general.delete')) btn.addEventListener('click', () => openDeleteProxyModal(btn.dataset.name || '', btn.dataset.id || ''));
      });

      proxiesList.appendChild(card);
    });

    // Check status of all proxies after rendering
    setTimeout(() => checkAllProxyStatuses(), 100);
  } catch (err) {
    proxiesList.innerHTML = `<p class="placeholder">${t('general.error')}: ${escapeHtml(err.message)}</p>`;
  }
}

// ═══════════════════════════════════════════════════════════
// STATUS CHECK
// ═══════════════════════════════════════════════════════════

async function checkAllProxyStatuses() {
  const { proxiesList } = getRefs();
  const cards = proxiesList?.querySelectorAll('.card[data-proxy-id]');
  if (!cards) return;

  for (const card of Array.from(cards)) {
    const proxyId = card.dataset.proxyId;
    if (!proxyId) continue;

    try {
      let response = await fetch('/api/proxies/test', {
        method: 'POST',
        headers: withVaultHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: proxyId })
      });
      response = await checkVaultLockedResponse(response);

      const result = await response.json();
      const statusEl = document.getElementById(`status-${proxyId}`);

      if (statusEl) {
        if (result.success) {
          statusEl.innerHTML = `
            <span class="status-dot status-dot-online"></span>
            <span class="status-text c-success">${t('proxies.status.online')}</span>
          `;
        } else {
          statusEl.innerHTML = `
            <span class="status-dot status-dot-offline"></span>
            <span class="status-text c-error">${t('proxies.status.offline')}</span>
          `;
        }
      }
    } catch {
      const statusEl = document.getElementById(`status-${proxyId}`);
      if (statusEl) {
        statusEl.innerHTML = `
          <span class="status-dot status-dot-offline"></span>
          <span class="status-text c-error">${t('proxies.status.offline')}</span>
        `;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// CONNECTION TEST (from card)
// ═══════════════════════════════════════════════════════════

async function testProxyById(id) {
  showToast()?.({ message: t('proxies.status.testing'), variant: 'info' });

  try {
    const response = await fetch('/api/proxies/test', {
      method: 'POST',
      headers: withVaultHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id })
    });

    const result = await response.json();

    if (result.success) {
      showToast()?.({ message: t('proxies.status.success', { ms: result.latency }), variant: 'success' });
    } else {
      showToast()?.({ message: t('proxies.status.failed', { error: result.error }), variant: 'error' });
    }
  } catch (err) {
    showToast()?.({ message: t('proxies.status.testFailed', { error: err.message }), variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// MODAL MANAGEMENT
// ═══════════════════════════════════════════════════════════

async function openNewProxyModal() {
  const refs = getRefs();
  editingProxyId = null;
  refs.proxyForm?.reset();
  if (refs.localCheckbox) refs.localCheckbox.checked = true;
  if (refs.apiKeyField) refs.apiKeyField.classList.add('js-hidden');
  if (refs.proxyFormTitle) refs.proxyFormTitle.textContent = t('proxies.form.newTitle');
  if (refs.proxyFormSubmit) refs.proxyFormSubmit.textContent = t('proxies.form.createBtn');
  if (refs.apiSchemaSelect) {
    refs.apiSchemaSelect.value = 'ollama';
    refs.apiSchemaSelect.dispatchEvent(new Event('change'));
  }
  await loadVaultEntries();
  populateVaultPicker(null, refs.apiSchemaSelect?.value);
  refs.proxyFormModal?.classList.add('js-open');
}

async function openEditProxyModal(id) {
  const refs = getRefs();
  const proxy = proxies.find(p => p.id === id);
  if (!proxy) return;

  editingProxyId = id;

  const nameInput  = document.getElementById('px-name');
  const urlInput   = document.getElementById('px-url');
  const modelInput = document.getElementById('px-model');

  if (nameInput)  nameInput.value = proxy.name;
  if (urlInput)   urlInput.value = proxy.url;
  if (modelInput) modelInput.value = proxy.model;
  if (refs.localCheckbox) {
    refs.localCheckbox.checked = proxy.is_local_network;
    refs.localCheckbox.dispatchEvent(new Event('change'));
  }
  if (refs.apiSchemaSelect) {
    refs.apiSchemaSelect.value = proxy.api_schema || 'ollama';
    refs.apiSchemaSelect.dispatchEvent(new Event('change'));
  }
  await loadVaultEntries();
  populateVaultPicker(proxy.vault_entry_id, refs.apiSchemaSelect?.value);

  if (refs.proxyFormTitle)  refs.proxyFormTitle.textContent = t('proxies.form.editTitle');
  if (refs.proxyFormSubmit) refs.proxyFormSubmit.textContent = t('proxies.form.saveBtn');
  refs.proxyFormModal?.classList.add('js-open');
}

function openDeleteProxyModal(name, id) {
  const refs = getRefs();
  deletingProxyId = id;
  // Set the delete confirmation text with the name interpolated
  const confirmText = document.getElementById('proxy-delete-confirm-text');
  if (confirmText) {
    confirmText.innerHTML = t('proxies.delete.confirm', { name: '<strong id="delete-proxy-name">' + escapeHtml(name) + '</strong>' });
  }
  refs.proxyDeleteModal?.classList.add('js-open');
}

// ═══════════════════════════════════════════════════════════
// FORM SUBMIT + DELETE
// ═══════════════════════════════════════════════════════════

async function handleProxyFormSubmit(e) {
  e.preventDefault();
  const refs = getRefs();

  const nameInput  = document.getElementById('px-name');
  const urlInput   = document.getElementById('px-url');
  const modelInput = document.getElementById('px-model');

  const name             = nameInput?.value?.trim();
  const url              = urlInput?.value?.trim();
  const model            = modelInput?.value?.trim();
  const is_local_network = refs.localCheckbox?.checked ?? true;
  const api_schema       = refs.apiSchemaSelect?.value || 'ollama';
  const vault_entry_id   = refs.vaultEntrySelect?.value || null;

  if (!name || !url || !model) {
    showToast()?.({ message: t('proxies.form.required'), variant: 'warning' });
    return;
  }

  const payload = { name, url, model, is_local_network, api_schema, vault_entry_id };
  if (editingProxyId) payload.id = editingProxyId;

  try {
    const method = editingProxyId ? 'PUT' : 'POST';
    const response = await fetch('/api/proxies', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showToast()?.({ message: result.error || t('proxies.form.saveFailed'), variant: 'error' });
      return;
    }

    showToast()?.({ message: editingProxyId ? t('proxies.form.updated') : t('proxies.form.created'), variant: 'success' });
    refs.proxyFormModal?.classList.remove('js-open');
    loadProxiesList();
    if (window.loadChatDropdowns) window.loadChatDropdowns();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

async function handleProxyDelete() {
  if (!deletingProxyId) return;

  try {
    const response = await fetch('/api/proxies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: deletingProxyId })
    });

    const result = await response.json();

    if (!response.ok) {
      showToast()?.({ message: result.error || t('proxies.delete.failed'), variant: 'error' });
      return;
    }

    showToast()?.({ message: t('proxies.delete.success'), variant: 'success' });
    const { proxyDeleteModal } = getRefs();
    proxyDeleteModal?.classList.remove('js-open');
    loadProxiesList();
    if (window.loadChatDropdowns) window.loadChatDropdowns();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════

function handleProxyExport() {
  window.location.href = '/api/proxies/export';
}

function handleProxyImportClick() {
  getRefs().importFile?.click();
}

async function handleProxyImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const bundle = JSON.parse(text);
    if (bundle.kind !== 'brise.proxies' || !Array.isArray(bundle.proxies)) {
      throw new Error(t('proxies.import.invalidBundle'));
    }
    pendingProxyImport = bundle;
    const refs = getRefs();
    if (refs.importFilename) {
      refs.importFilename.textContent = t('proxies.import.fileSummary', { name: file.name, count: String(bundle.proxies.length) });
    }
    refs.importModal?.classList.add('js-open');
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  } finally {
    e.target.value = '';
  }
}

async function handleProxyImportConfirm() {
  if (!pendingProxyImport) return;
  const refs = getRefs();
  const mode = refs.importMode?.value || 'skip';
  try {
    const r = await fetch('/api/proxies/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundle: pendingProxyImport, mode }),
    });
    const result = await r.json();
    if (!r.ok) throw new Error(result.error || t('proxies.import.failed'));

    let msg = t('proxies.import.success', {
      imported: String(result.imported),
      skipped: String(result.skipped),
      overwritten: String(result.overwritten),
      renamed: String(result.renamed),
    });
    if (result.danglingRefs > 0) {
      msg += ' ' + t('proxies.import.dangling', { count: String(result.danglingRefs) });
    }
    showToast()?.({ message: msg, variant: 'success' });
    refs.importModal?.classList.remove('js-open');
    pendingProxyImport = null;
    loadProxiesList();
    if (window.loadChatDropdowns) window.loadChatDropdowns();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

export function initProxiesEvents() {
  const refs = getRefs();

  refs.newProxyBtn?.addEventListener('click', openNewProxyModal);
  refs.proxyForm?.addEventListener('submit', handleProxyFormSubmit);
  refs.confirmProxyDeleteBtn?.addEventListener('click', handleProxyDelete);

  refs.exportBtn?.addEventListener('click', handleProxyExport);
  refs.importBtn?.addEventListener('click', handleProxyImportClick);
  refs.importFile?.addEventListener('change', handleProxyImportFile);
  refs.importConfirm?.addEventListener('click', handleProxyImportConfirm);
  refs.importCancel?.addEventListener('click', () => refs.importModal?.classList.remove('js-open'));
  refs.importClose?.addEventListener('click', () => refs.importModal?.classList.remove('js-open'));
  refs.importModal?.addEventListener('click', (e) => {
    if (e.target === refs.importModal) refs.importModal.classList.remove('js-open');
  });

  // Re-filter vault picker when api_schema changes
  refs.apiSchemaSelect?.addEventListener('change', () => {
    const cur = refs.vaultEntrySelect?.value || null;
    populateVaultPicker(cur, refs.apiSchemaSelect?.value);
  });

  // Toggle API key field visibility
  refs.localCheckbox?.addEventListener('change', () => {
    if (refs.localCheckbox.checked) {
      refs.apiKeyField?.classList.add('js-hidden');
    } else {
      refs.apiKeyField?.classList.remove('js-hidden');
    }
  });

  // Update URL placeholder based on API schema
  refs.apiSchemaSelect?.addEventListener('change', () => {
    if (refs.urlHint) {
      if (refs.apiSchemaSelect.value === 'openai') {
        refs.urlHint.textContent = t('proxies.form.urlHintOpenai');
      } else {
        refs.urlHint.textContent = t('proxies.form.urlHintOllama');
      }
    }
  });

  // Modal close buttons
  refs.proxyFormClose?.addEventListener('click', () => refs.proxyFormModal?.classList.remove('js-open'));
  refs.proxyFormCancel?.addEventListener('click', () => refs.proxyFormModal?.classList.remove('js-open'));
  refs.cancelProxyDeleteBtn?.addEventListener('click', () => refs.proxyDeleteModal?.classList.remove('js-open'));

  // Click-outside-to-close
  refs.proxyFormModal?.addEventListener('click', (e) => {
    if (e.target === refs.proxyFormModal) refs.proxyFormModal.classList.remove('js-open');
  });
  refs.proxyDeleteModal?.addEventListener('click', (e) => {
    if (e.target === refs.proxyDeleteModal) refs.proxyDeleteModal.classList.remove('js-open');
  });
}
