/**
 * Bottom-right "Vault Locked" pill. Visible when the vault is initialized
 * but locked (or after a 401 vault_locked from any API call). Clicking it
 * switches to the Vault tab.
 */

import { t } from '../i18n/index.js';
import { getVaultToken } from './vault-token.js';

const ID = 'vault-locked-indicator';

function ensureNode() {
  let el = document.getElementById(ID);
  if (el) return el;
  el = document.createElement('button');
  el.id = ID;
  el.type = 'button';
  el.className = 'vault-locked-indicator js-hidden';
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
    <span class="vault-locked-indicator-text"></span>
  `;
  el.addEventListener('click', () => {
    document.querySelector('.sidebar-link[data-tab="vault"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  document.body.appendChild(el);
  return el;
}

export function showVaultLocked() {
  const el = ensureNode();
  const text = el.querySelector('.vault-locked-indicator-text');
  if (text) text.textContent = t('vault.indicator.locked');
  el.title = t('vault.indicator.tooltip');
  el.classList.remove('js-hidden');
}

export function hideVaultLocked() {
  document.getElementById(ID)?.classList.add('js-hidden');
}

/** Inspect a fetch Response; if it's 401 vault_locked, show the indicator. Returns the same response. */
export async function checkVaultLockedResponse(response) {
  if (response.status !== 401) return response;
  const cloned = response.clone();
  try {
    const data = await cloned.json();
    if (data?.code === 'vault_locked') showVaultLocked();
  } catch { /* not JSON */ }
  return response;
}

/** Boot-time check: ask the server, sync the pill. */
export async function initVaultIndicator() {
  ensureNode();
  try {
    const r = await fetch('/api/vault/status', {
      headers: getVaultToken() ? { 'x-vault-token': getVaultToken() } : {},
    });
    const { initialized, unlocked } = await r.json();
    if (initialized && !unlocked) showVaultLocked();
    else hideVaultLocked();
  } catch { /* ignore */ }
}
