/**
 * History state — history list, detail view, redo-to-playground, dropdowns.
 * Own tab, separate from Playground.
 */

import { $ } from './pg-state.js';
import { fetchPlaygroundHistory, historyDownloadUrl, loadPlaygroundDropdowns as apiLoadDropdowns } from './playground-api.js';
import { renderHistoryList, renderAIResponse } from './playground-dom.js';
import { escapeHtml } from './helpers.js';

function showToast(opts) { window.showToast?.(opts); }

// ═══════════════════════════════════════════════════════════
// HISTORY LIST
// ═══════════════════════════════════════════════════════════

export async function loadHistoryList() {
  const historyList = $('history-list');
  if (!historyList) return;
  historyList.innerHTML = '<p class="placeholder">Loading history...</p>';

  try {
    const history = await fetchPlaygroundHistory();
    renderHistoryList(historyList, history, showHistoryDetail);
  } catch (err) {
    historyList.innerHTML = '<p class="c-tertiary text-center t-caption">Error: ' + escapeHtml(err.message) + '</p>';
  }
}

// ═══════════════════════════════════════════════════════════
// DETAIL VIEW
// ═══════════════════════════════════════════════════════════

function showHistoryDetail(item) {
  const detailContent = $('detail-content');
  const detailView    = $('history-detail-view');
  const listView      = $('history-list-view');

  if (!detailContent || !detailView) return;

  // Build compact metadata card
  const statusBadge = item.status === 'success'
    ? '<span class="badge badge-success badge-caps">' + item.status.toUpperCase() + '</span>'
    : '<span class="badge badge-error badge-caps">' + item.status.toUpperCase() + '</span>';

  let formatChip = '';
  // Build action row: download buttons + redo
  let downloadBtns = '';
  if (item.format) {
    formatChip = '<div class="detail-meta-cell"><span class="detail-meta-label">Format</span><span class="badge badge-caps badge-accent">' + escapeHtml(item.format) + '</span></div>';

    const filesCount = item.files_count || 1;
    for (let f = 1; f <= filesCount; f++) {
      const ext = getExt(item.format);
      const fname = filesCount > 1 ? 'output-' + f + '.' + ext : 'output.' + ext;
      downloadBtns += '<button class="btn btn-primary btn-xs detail-dl-btn" data-history-id="' + item.id + '" data-file="' + f + '">↓ ' + escapeHtml(fname) + '</button> ';
    }
  }
  const actionsRow = '<div class="detail-meta-actions flex-row gap-sm flex-wrap">' +
    downloadBtns +
    '<button class="btn btn-secondary btn-xs" id="detail-redo-btn">↻ Redo</button>' +
  '</div>';

  const metaCard =
    '<div class="card detail-meta-card">' +
      '<div class="detail-meta-grid">' +
        '<div class="detail-meta-cell"><span class="detail-meta-label">Timestamp</span><span class="detail-meta-value">' + new Date(item.timestamp).toLocaleString() + '</span></div>' +
        '<div class="detail-meta-cell"><span class="detail-meta-label">Persona</span><span class="detail-meta-value c-accent">' + (item.persona_id || 'Default') + '</span></div>' +
        '<div class="detail-meta-cell"><span class="detail-meta-label">Status</span>' + statusBadge + '</div>' +
        '<div class="detail-meta-cell"><span class="detail-meta-label">Latency</span><span class="detail-meta-value t-caption-mono">' + item.latency + 'ms</span></div>' +
        formatChip +
      '</div>' +
      actionsRow +
    '</div>';

  // Prompt section (collapsible)
  const promptSection =
    '<div class="detail-section">' +
      '<div class="detail-section-header flex-row row-between">' +
        '<button class="detail-section-toggle" data-target="detail-user-prompt" aria-expanded="true">' +
          '<svg class="detail-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
          '<span class="label label-sm">User Prompt</span>' +
        '</button>' +
        '<button class="btn btn-secondary btn-xs detail-copy-btn" data-copy-target="detail-user-prompt">Copy</button>' +
      '</div>' +
      '<div class="detail-section-body" id="detail-user-prompt-wrap">' +
        '<div class="text-block text-block-prompt" id="detail-user-prompt">' + escapeHtml(item.user_prompt) + '</div>' +
      '</div>' +
    '</div>';

  // AI Response section (collapsible)
  const responseSection =
    '<div class="detail-section">' +
      '<div class="detail-section-header flex-row row-between">' +
        '<button class="detail-section-toggle" data-target="detail-ai-response" aria-expanded="true">' +
          '<svg class="detail-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
          '<span class="label label-sm">AI Response</span>' +
        '</button>' +
        '<button class="btn btn-secondary btn-xs detail-copy-btn" data-copy-target="detail-ai-response">Copy</button>' +
      '</div>' +
      '<div class="detail-section-body" id="detail-ai-response-wrap">' +
        '<div class="text-block" id="detail-ai-response"></div>' +
      '</div>' +
    '</div>';

  detailContent.innerHTML = metaCard + promptSection + responseSection;

  // Render AI response (with fenced-code-block detection)
  const aiResponseEl = $('detail-ai-response');
  if (aiResponseEl) renderAIResponse(aiResponseEl, item.ai_response);

  // Attach download handlers
  detailContent.querySelectorAll('.detail-dl-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(historyDownloadUrl(btn.dataset.historyId, btn.dataset.file), '_blank');
    });
  });

  // Attach copy handlers — copy only code/content, exclude code-block headers
  detailContent.querySelectorAll('.detail-copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = $(btn.dataset.copyTarget);
      if (target) {
        const text = getCopyText(target);
        navigator.clipboard.writeText(text).then(() => {
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
        });
      }
    });
  });

  // Attach collapse/expand toggle handlers
  detailContent.querySelectorAll('.detail-section-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target + '-wrap';
      const body = document.getElementById(targetId);
      if (!body) return;
      const isExpanded = !body.classList.contains('js-collapsed');
      body.classList.toggle('js-collapsed', isExpanded);
      btn.setAttribute('aria-expanded', String(!isExpanded));
    });
  });

  // Attach redo handler
  const redoBtn = $('detail-redo-btn');
  if (redoBtn) {
    redoBtn.addEventListener('click', () => {
      redoToPlayground(item);
    });
  }

  // Toggle visibility — hide list view, show detail view
  if (listView) listView.classList.add('js-hidden');
  detailView.classList.remove('js-hidden');

  // Scroll detail into view
  detailView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getExt(format) {
  const EXT_MAP = { md: 'md', html: 'html', json: 'json', 'json-strict': 'json', csv: 'csv' };
  return EXT_MAP[format] || 'txt';
}

// ═══════════════════════════════════════════════════════════
// COPY TEXT HELPER — excludes code-block headers from copied text
// ═══════════════════════════════════════════════════════════

function getCopyText(el) {
  // Clone the element so we can safely modify it
  const clone = el.cloneNode(true);
  // Remove all .detail-code-block-header elements (lang label + copy btn)
  clone.querySelectorAll('.detail-code-block-header').forEach(h => h.remove());
  // Remove the copy buttons that may remain as text
  clone.querySelectorAll('.detail-code-block-copy').forEach(b => b.remove());
  return clone.textContent;
}

// ═══════════════════════════════════════════════════════════
// REDO TO PLAYGROUND
// ═══════════════════════════════════════════════════════════

function redoToPlayground(item) {
  // Switch to playground tab
  const playgroundLink = document.querySelector('[data-tab="playground"]');
  if (playgroundLink) playgroundLink.click();

  // Pre-fill the form after a short delay (wait for tab to render)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const promptArea    = $('pg-prompt');
      const personaSelect = $('pg-persona-select');
      const proxySelect   = $('pg-proxy-select');
      const formatSelect  = $('pg-format-select');

      if (promptArea) {
        promptArea.value = item.user_prompt || '';
        promptArea.dispatchEvent(new Event('input'));
        promptArea.focus();
      }
      if (item.persona_id && personaSelect) personaSelect.value = item.persona_id;
      if (item.proxy_id && proxySelect) proxySelect.value = item.proxy_id;
      if (item.format && formatSelect) {
        formatSelect.value = item.format;
        formatSelect.dispatchEvent(new Event('change'));
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════

export function initHistoryView() {
  // Back button
  const backBtn     = $('back-to-history-btn');
  const detailView  = $('history-detail-view');
  const listView    = $('history-list-view');

  backBtn && backBtn.addEventListener('click', () => {
    if (detailView)  detailView.classList.add('js-hidden');
    if (listView) listView.classList.remove('js-hidden');
  });

  // Initial load
  loadHistoryList();
}

// Expose for tab-nav + dashboard
window.loadHistoryList = loadHistoryList;
window.showHistoryDetail = showHistoryDetail;
