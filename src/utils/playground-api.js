/**
 * Playground API client — all network calls for the PlaygroundView feature.
 * Returns parsed JSON; callers handle UI state.
 */

/**
 * Populate <select> elements with personas and proxies for Playground.
 */
export async function loadPlaygroundDropdowns(personaSelect, proxySelect) {
  try {
    const res = await fetch('/api/personas');
    const data = await res.json();
    if (res.ok && Array.isArray(data) && personaSelect) {
      personaSelect.innerHTML = '<option value="">Default (No Persona)</option>';
      data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        personaSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load personas', err);
  }

  try {
    const res = await fetch('/api/proxies');
    const data = await res.json();
    if (res.ok && Array.isArray(data) && proxySelect) {
      proxySelect.innerHTML = '';
      data.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        proxySelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load proxies', err);
  }
}

/**
 * POST /api/proxy — send a playground prompt (single or batch call).
 * Returns parsed JSON result.
 */
export async function sendPlaygroundRequest(payload) {
  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  return { ok: res.ok, status: res.status, data: result };
}

/**
 * GET /api/history — fetch prompt history for playground.
 */
export async function fetchPlaygroundHistory() {
  const res = await fetch('/api/history');
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || 'Failed to load history');
  return result.data || [];
}

/**
 * Build the download URL for a history entry's file.
 */
export function historyDownloadUrl(historyId, fileIdx) {
  return '/api/history/' + historyId + '/download?file=' + fileIdx;
}
