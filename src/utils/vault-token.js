/** Shared client helpers for sending the vault unlock token. */

const TOKEN_KEY = 'brise_vault_token';

export function getVaultToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function withVaultHeader(headers = {}) {
  const tok = getVaultToken();
  if (tok) return { ...headers, 'x-vault-token': tok };
  return headers;
}
