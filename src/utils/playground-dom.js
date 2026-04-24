/**
 * DOM helpers for PlaygroundView — response rendering, history list,
 * multi-file cards, progress bar, detail modal, etc.
 * All functions assume the DOM elements exist (callers guard with &&).
 */

import { escapeHtml, truncate, formatTime } from './helpers.js';

// ═══════════════════════════════════════════════════════════
// FORMAT CONFIG
// ═══════════════════════════════════════════════════════════

export const FORMAT_HINTS = {
  md: 'Template mode — model fills in a markdown template',
  html: 'Suggested structure — HTML5 boilerplate with semantic tags',
  json: 'Suggested schema — JSON boilerplate',
  'json-strict': 'Strict schema — output must validate against the configured JSON schema or it will be rejected',
  csv: 'Suggested format — comma-separated with header row'
};

const EXT_MAP = { md: 'md', html: 'html', json: 'json', 'json-strict': 'json', csv: 'csv' };

export function getExt(format) {
  return EXT_MAP[format] || 'txt';
}

// ═══════════════════════════════════════════════════════════
// DOWNLOAD HELPERS
// ═══════════════════════════════════════════════════════════

export function downloadBlob(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadFormatFile(content, format, fileIndex, filesPerCall) {
  const ext = getExt(format);
  const filename = filesPerCall > 1
    ? 'output-' + fileIndex + '.' + ext
    : 'output.' + ext;
  downloadBlob(content, filename);
}

// ═══════════════════════════════════════════════════════════
// AI RESPONSE RENDERER — detects fenced code blocks
// ═══════════════════════════════════════════════════════════

export function renderAIResponse(containerEl, rawText) {
  if (!containerEl || rawText == null) return;
  containerEl.innerHTML = '';

  // Pre-process: wrap <thinking>...</thinking> as fenced code blocks
  // so they get the same code-block UI treatment
  let processed = rawText.replace(/<think>([\s\S]*?)<\/think>/gi, (_, content) => {
    return '```thought\n' + content + '\n```';
  });

  const fenceRe = /(```([a-zA-Z0-9_-]*)\n[\s\S]*?```)/g;
  const parts = [];
  let lastIdx = 0;
  let match;

  while ((match = fenceRe.exec(processed)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: processed.substring(lastIdx, match.index) });
    }
    const fullMatch = match[0];
    const lang = match[2] || '';
    const codeContent = fullMatch.replace(/^```[a-zA-Z0-9_-]*\n/, '').replace(/\n```$/, '');
    parts.push({ type: 'code', lang, content: codeContent });
    lastIdx = match.index + fullMatch.length;
  }

  if (lastIdx < processed.length) {
    parts.push({ type: 'text', content: processed.substring(lastIdx) });
  }

  if (parts.length === 0) {
    containerEl.textContent = rawText;
    return;
  }

  parts.forEach(part => {
    if (part.type === 'code') {
      const block = document.createElement('div');
      block.className = 'detail-code-block';

      const header = document.createElement('div');
      header.className = 'detail-code-block-header';

      const langSpan = document.createElement('span');
      langSpan.className = 'detail-code-block-lang';
      // Tag <think> blocks as "AI Thoughts"
      const isThoughtBlock = (part.lang || '').toLowerCase() === 'thought' || (part.lang || '').toLowerCase() === 'thinking';
      langSpan.textContent = isThoughtBlock ? 'AI Thoughts' : (part.lang || 'code');
      header.appendChild(langSpan);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'detail-code-block-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(part.content).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        });
      });
      header.appendChild(copyBtn);
      block.appendChild(header);

      const pre = document.createElement('pre');
      pre.className = 'detail-code-block-pre';
      pre.textContent = part.content;
      block.appendChild(pre);

      containerEl.appendChild(block);
    } else {
      const span = document.createElement('span');
      span.className = 'detail-block-text detail-code-content';
      span.style.whiteSpace = 'pre-wrap';
      span.textContent = part.content;
      containerEl.appendChild(span);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// RESPONSE RENDERING
// ═══════════════════════════════════════════════════════════

export function renderSingleResponse(result, opts) {
  const { responseText, multiFiles, downloadBtn, responseTitle } = opts;

  if (responseText) renderAIResponse(responseText, result.data);
  responseText && responseText.classList.remove('js-hidden');
  multiFiles && multiFiles.classList.add('js-hidden');

  if (result.download_ready && result.format) {
    downloadBtn && downloadBtn.classList.remove('js-hidden');
    return { content: result.data, format: result.format, filesPerCall: 1 };
  } else {
    downloadBtn && downloadBtn.classList.add('js-hidden');
    return null;
  }
}

export function renderMultiFileResponse(result, filesPerCall, callNum, opts) {
  const { responseText, multiFiles, downloadBtn, responseTitle } = opts;

  responseText && responseText.classList.add('js-hidden');
  downloadBtn && downloadBtn.classList.add('js-hidden');
  responseTitle && (responseTitle.textContent = 'Response (' + result.files.length + ' files)');

  if (callNum <= 1) {
    multiFiles.innerHTML = '';
  }

  result.files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'pg-file-card';

    const ext = getExt(result.format);
    const filename = filesPerCall > 1
      ? 'output-' + file.index + '.' + ext
      : 'output.' + ext;

    if (file.download_ready) {
      card.innerHTML =
        '<div class="pg-file-card-header">' +
          '<span class="pg-file-card-name">' + escapeHtml(filename) + '</span>' +
          '<button class="pg-file-card-download-btn" data-index="' + file.index + '">Download</button>' +
        '</div>' +
        '<pre class="pg-file-card-content">' + escapeHtml(file.data) + '</pre>';

      card.querySelector('.pg-file-card-download-btn').addEventListener('click', () => {
        downloadFormatFile(file.data, result.format, file.index, filesPerCall);
      });
    } else {
      card.innerHTML =
        '<div class="pg-file-card-header">' +
          '<span class="pg-file-card-name pg-file-card-name-error">' + escapeHtml(filename) + '</span>' +
        '</div>' +
        '<pre class="pg-file-card-content pg-file-card-content-error">' + escapeHtml(file.error || file.raw || 'Error') + '</pre>';
    }

    multiFiles.appendChild(card);
  });

  multiFiles.classList.remove('js-hidden');
  return { files: result.files, format: result.format, filesPerCall };
}

export function appendCallSeparator(multiFiles, callNum) {
  if (!multiFiles || callNum <= 1) return;
  const sep = document.createElement('div');
  sep.className = 'pg-call-separator';
  sep.textContent = '── Call ' + callNum + ' ──';
  multiFiles.appendChild(sep);
}

// ═══════════════════════════════════════════════════════════
// PROGRESS UI
// ═══════════════════════════════════════════════════════════

export function showProgress(container, text, fill, current, total) {
  if (!container) return;
  text && (text.textContent = 'Call ' + current + ' of ' + total + ' complete');
  fill && (fill.style.width = ((current / total) * 100) + '%');
  container.classList.remove('js-hidden');
}

export function hideProgress(container) {
  container && container.classList.add('js-hidden');
}

// ═══════════════════════════════════════════════════════════
// HISTORY DOM
// ═══════════════════════════════════════════════════════════

export function createHistoryItem(item, onDetail) {
  const div = document.createElement('div');
  const statusIcon = item.status === 'success' ? '✓' : '✗';
  const statusClass = item.status === 'success' ? 'c-success' : 'c-error';

  let formatBadge = '';
  if (item.format) {
    formatBadge = '<span class="badge badge-caps badge-accent self-end">' + escapeHtml(item.format) + '</span>';
  }

  div.className = 'card history-item';
  div.innerHTML =
    '<div class="flex-row row-between gap-md">' +
      '<span class="w-100 t-caption t-weight-500 c-secondary">' + formatTime(item.timestamp) + '</span>' +
      formatBadge +
      '<span class="t-body t-weight-700 self-end ' + statusClass + '">' + statusIcon + '</span>' +
    '</div>' +
    '<div class="flex-row gap-lg" style="margin-top:0.5rem;font-size:0.75rem;color:var(--text-tertiary)">' +
      '<span class="c-accent">' + (item.persona_id || 'Default') + '</span>' +
      '<span class="t-caption-mono">' + item.latency + 'ms</span>' +
    '</div>' +
    '<p class="mt-md truncate c-secondary t-body">' + truncate(item.user_prompt, 80) + '</p>';

  div.addEventListener('click', () => onDetail(item));
  return div;
}

export function renderHistoryList(historyList, history, onDetail) {
  if (!historyList) return;
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyList.innerHTML = '<p class="placeholder">No history yet. Run a prompt above!</p>';
    return;
  }

  let i = 0;
  while (i < history.length) {
    const item = history[i];

    if (item.batch_id) {
      const batchItems = [item];
      let j = i + 1;
      while (j < history.length && history[j].batch_id === item.batch_id) {
        batchItems.push(history[j]);
        j++;
      }

      const groupDiv = document.createElement('div');
      groupDiv.className = 'pg-batch-group';

      const label = document.createElement('div');
      label.className = 'pg-batch-label t-micro c-tertiary';
      label.textContent = '──── Batch Call ────';
      groupDiv.appendChild(label);

      batchItems.forEach(bi => {
        groupDiv.appendChild(createHistoryItem(bi, onDetail));
      });

      historyList.appendChild(groupDiv);
      i = j;
    } else {
      historyList.appendChild(createHistoryItem(item, onDetail));
      i++;
    }
  }
}

export function renderDetailView(item, detailContent, detailView, onDownload) {
  if (!detailContent || !detailView) return;

  let formatSection = '';
  if (item.format) {
    formatSection =
      '<div class="flex-col gap-xs">' +
        '<h3 class="label label-sm">Format</h3>' +
        '<p class="detail-value"><span class="badge badge-caps badge-accent">' + escapeHtml(item.format) + '</span></p>' +
      '</div>';

    const filesCount = item.files_count || 1;
    let downloadBtns = '';
    for (let f = 1; f <= filesCount; f++) {
      const ext = getExt(item.format);
      const fname = filesCount > 1 ? 'output-' + f + '.' + ext : 'output.' + ext;
      downloadBtns += '<button class="btn btn-primary btn-sm" data-history-id="' + item.id + '" data-file="' + f + '">' + escapeHtml(fname) + '</button> ';
    }
    formatSection +=
      '<div class="flex-col gap-xs">' +
        '<h3 class="label label-sm">Download Files</h3>' +
        '<div class="flex-row gap-sm flex-wrap">' + downloadBtns + '</div>' +
      '</div>';
  }

  detailContent.innerHTML =
    '<div class="flex-col gap-xs">' +
      '<h3 class="label label-sm">Timestamp</h3>' +
      '<p class="t-body c-primary m-0">' + new Date(item.timestamp).toLocaleString() + '</p>' +
    '</div>' +
    '<div class="flex-col gap-xs">' +
      '<h3 class="label label-sm">Persona</h3>' +
      '<p class="t-body c-primary m-0">' + (item.persona_id || 'Default') + '</p>' +
    '</div>' +
    '<div class="flex-col gap-xs">' +
      '<h3 class="label label-sm">Status</h3>' +
      '<p class="t-body c-primary m-0 ' + (item.status === 'success' ? 'c-success' : 'c-error') + '">' + item.status.toUpperCase() + '</p>' +
    '</div>' +
    '<div class="flex-col gap-xs">' +
      '<h3 class="label label-sm">Latency</h3>' +
      '<p class="t-body c-primary m-0">' + item.latency + 'ms</p>' +
    '</div>' +
    formatSection +
    '<div class="flex-col gap-xs">' +
      '<h3 class="label label-sm">User Prompt</h3>' +
      '<div class="text-block text-block-prompt">' + escapeHtml(item.user_prompt) + '</div>' +
    '</div>' +
    '<div class="flex-col gap-xs">' +
      '<h3 class="label label-sm">AI Response</h3>' +
      '<div class="text-block" id="detail-ai-response"></div>' +
    '</div>';

  // Attach download handlers
  const dlBtns = detailContent.querySelectorAll('.pg-detail-download');
  dlBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDownload(btn.getAttribute('data-history-id'), btn.getAttribute('data-file'));
    });
  });

  // Render AI response with fenced-code-block detection
  const aiResponseEl = document.getElementById('detail-ai-response');
  if (aiResponseEl) renderAIResponse(aiResponseEl, item.ai_response);

  detailView.classList.remove('js-hidden');
}
