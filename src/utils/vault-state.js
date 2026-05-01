/**
 * Vault state — passphrase setup/unlock, entry CRUD, session token management.
 * Token lives in localStorage (survives page reload, dies with the tab).
 */

import { escapeHtml } from './helpers.js';
import { t } from '../i18n/index.js';
import { showVaultLocked, hideVaultLocked } from './vault-indicator.js';

const TOKEN_KEY = 'brise_vault_token';
const showToast = () => window.showToast;

let entries = [];
let editingId = null;
let deletingId = null;

function getRefs() {
  return {
    view:           document.getElementById('vault-view'),
    uninit:         document.getElementById('vault-uninit'),
    locked:         document.getElementById('vault-locked'),
    unlocked:       document.getElementById('vault-unlocked'),
    list:           document.getElementById('vault-entries-list'),
    setupForm:      document.getElementById('vault-setup-form'),
    setupPass:      document.getElementById('vault-setup-pass'),
    setupPass2:     document.getElementById('vault-setup-pass2'),
    unlockForm:     document.getElementById('vault-unlock-form'),
    unlockPass:     document.getElementById('vault-unlock-pass'),
    lockBtn:        document.getElementById('vault-lock-btn'),
    rotateBtn:      document.getElementById('vault-rotate-btn'),
    newBtn:         document.getElementById('vault-new-btn'),
    formModal:      document.getElementById('vault-form-modal'),
    form:           document.getElementById('vault-form'),
    formTitle:      document.getElementById('vault-form-title'),
    formSubmit:     document.getElementById('vault-form-submit'),
    formClose:      document.getElementById('vault-form-close'),
    formCancel:     document.getElementById('vault-form-cancel'),
    fLabel:         document.getElementById('vf-label'),
    fProvider:      document.getElementById('vf-provider'),
    fSecret:        document.getElementById('vf-secret'),
    fSecretHint:    document.getElementById('vf-secret-hint'),
    rotateModal:    document.getElementById('vault-rotate-modal'),
    rotateForm:     document.getElementById('vault-rotate-form'),
    rotatePass:     document.getElementById('vr-pass'),
    rotatePass2:    document.getElementById('vr-pass2'),
    rotateClose:    document.getElementById('vault-rotate-close'),
    rotateCancel:   document.getElementById('vault-rotate-cancel'),
    deleteModal:    document.getElementById('vault-delete-modal'),
    deleteText:     document.getElementById('vault-delete-text'),
    deleteConfirm:  document.getElementById('vault-delete-confirm'),
    deleteCancel:   document.getElementById('vault-delete-cancel'),
    exportBtn:      document.getElementById('vault-export-btn'),
    importBtn:      document.getElementById('vault-import-btn'),
    importFile:     document.getElementById('vault-import-file'),
    importModal:    document.getElementById('vault-import-modal'),
    importMode:     document.getElementById('vault-import-mode'),
    importPass:     document.getElementById('vault-import-pass'),
    importFilename: document.getElementById('vault-import-filename'),
    importReplaceWarn: document.getElementById('vault-import-replace-warn'),
    importConfirm:  document.getElementById('vault-import-confirm'),
    importCancel:   document.getElementById('vault-import-cancel'),
    importClose:    document.getElementById('vault-import-close'),
  };
}

let pendingVaultBundle = null;

// ═══════════════════════════════════════════════════════════
// TOKEN + FETCH
// ═══════════════════════════════════════════════════════════

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(tok) { localStorage.setItem(TOKEN_KEY, tok); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function vaultFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const tok = getToken();
  if (tok) headers['x-vault-token'] = tok;
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(path, { ...opts, headers });
}

// ═══════════════════════════════════════════════════════════
// VIEW STATE
// ═══════════════════════════════════════════════════════════

function showState(which) {
  const refs = getRefs();
  refs.uninit?.classList.toggle('js-hidden', which !== 'uninit');
  refs.locked?.classList.toggle('js-hidden', which !== 'locked');
  refs.unlocked?.classList.toggle('js-hidden', which !== 'unlocked');
  refs.lockBtn?.classList.toggle('js-hidden', which !== 'unlocked');
  refs.rotateBtn?.classList.toggle('js-hidden', which !== 'unlocked');
  refs.newBtn?.classList.toggle('js-hidden', which !== 'unlocked');
  refs.exportBtn?.classList.toggle('js-hidden', which !== 'unlocked');
}

export async function refreshVaultView() {
  try {
    const r = await vaultFetch('/api/vault/status');
    const { initialized, unlocked } = await r.json();
    if (!initialized) { hideVaultLocked(); return showState('uninit'); }
    if (!unlocked) {
      clearToken();
      showVaultLocked();
      return showState('locked');
    }
    hideVaultLocked();
    showState('unlocked');
    await loadEntries();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// ENTRIES
// ═══════════════════════════════════════════════════════════

async function loadEntries() {
  const refs = getRefs();
  if (!refs.list) return;
  refs.list.innerHTML = '<p class="placeholder">' + t('vault.loading') + '</p>';

  try {
    const r = await vaultFetch('/api/vault/entries');
    if (r.status === 401) {
      clearToken();
      return showState('locked');
    }
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error(data.error || 'Failed to load entries');

    entries = data;
    if (entries.length === 0) {
      refs.list.innerHTML = '<p class="placeholder">' + t('vault.noneYet') + '</p>';
      return;
    }
    refs.list.innerHTML = '';
    entries.forEach(e => refs.list.appendChild(renderEntryCard(e)));
  } catch (err) {
    refs.list.innerHTML = `<p class="placeholder">${t('general.error')}: ${escapeHtml(err.message)}</p>`;
  }
}

function renderEntryCard(e) {
  const card = document.createElement('div');
  card.className = 'card card-hover';
  const preview = e.preview || '••••';
  card.innerHTML = `
    <div class="flex-grow">
      <div class="row-between">
        <h3 class="t-card-title">${escapeHtml(e.label)}</h3>
        <span class="badge badge-persona">${escapeHtml(e.provider)}</span>
      </div>
      <p class="t-caption c-tertiary mt-xs">
        <code class="vault-preview">${escapeHtml(preview)}</code>
      </p>
    </div>
    <div class="flex-row gap-sm mt-md pt-md border-t">
      <button class="btn btn-secondary js-reveal" data-id="${escapeHtml(e.id)}">${t('vault.entry.reveal')}</button>
      <button class="btn btn-primary js-edit" data-id="${escapeHtml(e.id)}">${t('general.edit')}</button>
      <button class="btn btn-danger js-delete" data-id="${escapeHtml(e.id)}" data-label="${escapeHtml(e.label)}">${t('general.delete')}</button>
    </div>
  `;
  card.querySelector('.js-reveal')?.addEventListener('click', () => revealEntry(e.id, card));
  card.querySelector('.js-edit')?.addEventListener('click', () => openEditModal(e.id));
  card.querySelector('.js-delete')?.addEventListener('click', (ev) => {
    const target = ev.currentTarget;
    openDeleteModal(target.dataset.label || '', target.dataset.id || '');
  });
  return card;
}

async function revealEntry(id, card) {
  try {
    const r = await vaultFetch('/api/vault/reveal', { method: 'POST', body: JSON.stringify({ id }) });
    if (r.status === 401) { clearToken(); return showState('locked'); }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Failed to reveal');

    const code = card.querySelector('.vault-preview');
    if (!code) return;
    const original = code.textContent;
    code.textContent = data.secret;
    setTimeout(() => { code.textContent = original; }, 8000);
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// SETUP / UNLOCK / LOCK / ROTATE
// ═══════════════════════════════════════════════════════════

async function handleSetup(e) {
  e.preventDefault();
  const refs = getRefs();
  const p1 = refs.setupPass?.value ?? '';
  const p2 = refs.setupPass2?.value ?? '';
  if (p1 !== p2) {
    showToast()?.({ message: t('vault.setup.mismatch'), variant: 'warning' });
    return;
  }
  try {
    const r = await fetch('/api/vault/setup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: p1 }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('vault.setup.failed'));
    setToken(data.token);
    refs.setupForm?.reset();
    showToast()?.({ message: t('vault.setup.success'), variant: 'success' });
    if (data.migratedProxies > 0) {
      showToast()?.({ message: t('vault.migrate.success', { count: String(data.migratedProxies) }), variant: 'success' });
    }
    await refreshVaultView();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

async function handleUnlock(e) {
  e.preventDefault();
  const refs = getRefs();
  const passphrase = refs.unlockPass?.value ?? '';
  try {
    const r = await fetch('/api/vault/unlock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('vault.locked.failed'));
    setToken(data.token);
    refs.unlockForm?.reset();
    if (data.migratedProxies > 0) {
      showToast()?.({ message: t('vault.migrate.success', { count: String(data.migratedProxies) }), variant: 'success' });
    }
    await refreshVaultView();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

async function handleLock() {
  try {
    await vaultFetch('/api/vault/lock', { method: 'POST' });
  } catch { /* ignore */ }
  clearToken();
  showState('locked');
  showVaultLocked();
}

async function handleRotate(e) {
  e.preventDefault();
  const refs = getRefs();
  const p1 = refs.rotatePass?.value ?? '';
  const p2 = refs.rotatePass2?.value ?? '';
  if (p1 !== p2) {
    showToast()?.({ message: t('vault.rotate.mismatch'), variant: 'warning' });
    return;
  }
  try {
    const r = await vaultFetch('/api/vault/rotate', { method: 'POST', body: JSON.stringify({ newPassphrase: p1 }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('vault.rotate.failed'));
    setToken(data.token);
    refs.rotateForm?.reset();
    refs.rotateModal?.classList.remove('js-open');
    showToast()?.({ message: t('vault.rotate.success', { count: String(data.rotated) }), variant: 'success' });
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// ENTRY MODALS
// ═══════════════════════════════════════════════════════════

function openNewModal() {
  const refs = getRefs();
  editingId = null;
  refs.form?.reset();
  if (refs.formTitle) refs.formTitle.textContent = t('vault.form.newTitle');
  if (refs.formSubmit) refs.formSubmit.textContent = t('vault.form.createBtn');
  if (refs.fSecret) refs.fSecret.required = true;
  if (refs.fSecretHint) refs.fSecretHint.textContent = t('vault.form.secretHint');
  refs.formModal?.classList.add('js-open');
}

function openEditModal(id) {
  const refs = getRefs();
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  editingId = id;
  if (refs.fLabel) refs.fLabel.value = entry.label;
  if (refs.fProvider) refs.fProvider.value = entry.provider;
  if (refs.fSecret) { refs.fSecret.value = ''; refs.fSecret.required = false; }
  if (refs.fSecretHint) refs.fSecretHint.textContent = t('vault.form.secretHintEdit');
  if (refs.formTitle) refs.formTitle.textContent = t('vault.form.editTitle');
  if (refs.formSubmit) refs.formSubmit.textContent = t('vault.form.saveBtn');
  refs.formModal?.classList.add('js-open');
}

async function handleEntrySubmit(e) {
  e.preventDefault();
  const refs = getRefs();
  const label = refs.fLabel?.value?.trim();
  const provider = refs.fProvider?.value;
  const secret = refs.fSecret?.value;

  if (!label || !provider) {
    showToast()?.({ message: t('vault.form.required'), variant: 'warning' });
    return;
  }

  try {
    let r;
    if (editingId) {
      const body = { id: editingId, label, provider };
      if (secret) body.secret = secret;
      r = await vaultFetch('/api/vault/entries', { method: 'PUT', body: JSON.stringify(body) });
    } else {
      if (!secret) {
        showToast()?.({ message: t('vault.form.secretRequired'), variant: 'warning' });
        return;
      }
      r = await vaultFetch('/api/vault/entries', { method: 'POST', body: JSON.stringify({ label, provider, secret }) });
    }
    if (r.status === 401) { clearToken(); return showState('locked'); }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('vault.form.saveFailed'));
    refs.formModal?.classList.remove('js-open');
    showToast()?.({ message: editingId ? t('vault.form.updated') : t('vault.form.created'), variant: 'success' });
    await loadEntries();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

function openDeleteModal(label, id) {
  const refs = getRefs();
  deletingId = id;
  if (refs.deleteText) {
    refs.deleteText.innerHTML = t('vault.delete.confirm', { name: '<strong>' + escapeHtml(label) + '</strong>' });
  }
  refs.deleteModal?.classList.add('js-open');
}

async function handleDelete() {
  if (!deletingId) return;
  try {
    const r = await vaultFetch('/api/vault/entries', { method: 'DELETE', body: JSON.stringify({ id: deletingId }) });
    if (r.status === 401) { clearToken(); return showState('locked'); }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('vault.delete.failed'));
    const refs = getRefs();
    refs.deleteModal?.classList.remove('js-open');
    showToast()?.({ message: t('vault.delete.success'), variant: 'success' });
    await loadEntries();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════

async function handleExport() {
  const tok = getToken();
  if (!tok) return;
  // Use fetch + Blob so we can attach the auth header (location.href can't).
  try {
    const r = await vaultFetch('/api/vault/export');
    if (r.status === 401) { clearToken(); return showState('locked'); }
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.error || 'Export failed');
    }
    const blob = await r.blob();
    const cd = r.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename="?([^"]+)"?/i);
    const name = m?.[1] || `brise-vault-${new Date().toISOString().slice(0,10)}.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

function handleImportClick() {
  getRefs().importFile?.click();
}

async function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const bundle = JSON.parse(text);
    if (bundle.kind !== 'brise.vault' || !Array.isArray(bundle.entries)) {
      throw new Error(t('vault.import.invalidBundle'));
    }
    pendingVaultBundle = bundle;
    const refs = getRefs();
    if (refs.importFilename) {
      refs.importFilename.textContent = t('vault.import.fileSummary', { name: file.name, count: String(bundle.entries.length) });
    }
    refs.importModal?.classList.add('js-open');
    updateImportWarn();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  } finally {
    e.target.value = '';
  }
}

function updateImportWarn() {
  const refs = getRefs();
  const replace = refs.importMode?.value === 'replace';
  refs.importReplaceWarn?.classList.toggle('js-hidden', !replace);
}

async function handleImportConfirm() {
  if (!pendingVaultBundle) return;
  const refs = getRefs();
  const mode = refs.importMode?.value || 'merge';
  const passphrase = refs.importPass?.value ?? '';
  if (!passphrase) {
    showToast()?.({ message: t('vault.import.passphraseRequired'), variant: 'warning' });
    return;
  }
  try {
    const body = { bundle: pendingVaultBundle, mode, passphrase };
    if (mode === 'replace') body.confirmReplace = true;
    const r = await fetch('/api/vault/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || t('vault.import.failed'));

    if (data.token) setToken(data.token);
    refs.importModal?.classList.remove('js-open');
    refs.importPass.value = '';
    pendingVaultBundle = null;
    showToast()?.({
      message: t('vault.import.success', {
        imported: String(data.imported),
        skipped: String(data.skipped ?? 0),
        mode,
      }),
      variant: 'success',
    });
    await refreshVaultView();
  } catch (err) {
    showToast()?.({ message: err.message, variant: 'error' });
  }
}

// ═══════════════════════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════════════════════

export function initVaultEvents() {
  const refs = getRefs();
  refs.setupForm?.addEventListener('submit', handleSetup);
  refs.unlockForm?.addEventListener('submit', handleUnlock);
  refs.lockBtn?.addEventListener('click', handleLock);

  refs.rotateBtn?.addEventListener('click', () => refs.rotateModal?.classList.add('js-open'));
  refs.rotateForm?.addEventListener('submit', handleRotate);
  refs.rotateClose?.addEventListener('click', () => refs.rotateModal?.classList.remove('js-open'));
  refs.rotateCancel?.addEventListener('click', () => refs.rotateModal?.classList.remove('js-open'));
  refs.rotateModal?.addEventListener('click', (e) => {
    if (e.target === refs.rotateModal) refs.rotateModal.classList.remove('js-open');
  });

  refs.newBtn?.addEventListener('click', openNewModal);
  refs.form?.addEventListener('submit', handleEntrySubmit);
  refs.formClose?.addEventListener('click', () => refs.formModal?.classList.remove('js-open'));
  refs.formCancel?.addEventListener('click', () => refs.formModal?.classList.remove('js-open'));
  refs.formModal?.addEventListener('click', (e) => {
    if (e.target === refs.formModal) refs.formModal.classList.remove('js-open');
  });

  refs.deleteConfirm?.addEventListener('click', handleDelete);
  refs.deleteCancel?.addEventListener('click', () => refs.deleteModal?.classList.remove('js-open'));
  refs.deleteModal?.addEventListener('click', (e) => {
    if (e.target === refs.deleteModal) refs.deleteModal.classList.remove('js-open');
  });

  refs.exportBtn?.addEventListener('click', handleExport);
  refs.importBtn?.addEventListener('click', handleImportClick);
  refs.importFile?.addEventListener('change', handleImportFile);
  refs.importMode?.addEventListener('change', updateImportWarn);
  refs.importConfirm?.addEventListener('click', handleImportConfirm);
  refs.importCancel?.addEventListener('click', () => refs.importModal?.classList.remove('js-open'));
  refs.importClose?.addEventListener('click', () => refs.importModal?.classList.remove('js-open'));
  refs.importModal?.addEventListener('click', (e) => {
    if (e.target === refs.importModal) refs.importModal.classList.remove('js-open');
  });
}
