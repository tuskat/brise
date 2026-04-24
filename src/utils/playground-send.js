/**
 * Playground send — handlePlaygroundSend, batch logic, cancel, progress.
 */

import { pgState, $ } from './pg-state.js';
import {
  loadPlaygroundDropdowns,
  sendPlaygroundRequest,
  fetchPlaygroundHistory,
} from './playground-api.js';
import {
  downloadFormatFile,
  renderAIResponse,
  renderSingleResponse,
  renderMultiFileResponse,
  appendCallSeparator,
  showProgress,
  hideProgress,
} from './playground-dom.js';
import { t } from '../i18n/index.js';

// Playground no longer owns history — expose a no-op for compatibility
function loadPlaygroundHistory() {
  if (window.loadHistoryList) window.loadHistoryList();
}

function showToast(opts) { window.showToast?.(opts); }

// ═══════════════════════════════════════════════════════════
// UUID HELPER
// ═══════════════════════════════════════════════════════════

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ═══════════════════════════════════════════════════════════
// CONTROLS DISABLE/ENABLE
// ═══════════════════════════════════════════════════════════

function setControlsDisabled(disabled) {
  const ids = ['pg-persona-select', 'pg-proxy-select', 'pg-format-select', 'pg-files-per-call', 'pg-calls', 'pg-prompt'];
  ids.forEach(id => {
    const el = $(id);
    if (el) el.disabled = disabled;
  });
}

// ═══════════════════════════════════════════════════════════
// SEND HANDLER — Batch + Multi-File
// ═══════════════════════════════════════════════════════════

export async function handlePlaygroundSend() {
  const promptArea         = $('pg-prompt');
  const personaSelect      = $('pg-persona-select');
  const proxySelect        = $('pg-proxy-select');
  const formatSelect       = $('pg-format-select');
  const filesPerCallSelect = $('pg-files-per-call');
  const callsSelect        = $('pg-calls');
  const sendBtn            = $('pg-send-btn');
  const responseContainer  = $('pg-response-container');
  const responseText       = $('pg-response-text');
  const multiFiles         = $('pg-multi-files');
  const responseTitle      = $('pg-response-title');
  const responseMeta       = $('pg-response-meta');
  const downloadBtn        = $('pg-download-btn');
  const errorContainer     = $('pg-error-container');
  const errorText          = $('pg-error-text');
  const progressContainer  = $('pg-progress-container');
  const progressText       = $('pg-progress-text');
  const progressFill       = $('pg-progress-fill');

  const prompt = promptArea ? promptArea.value.trim() : '';
  const persona_id = personaSelect ? personaSelect.value : null;
  const proxy_id = proxySelect ? proxySelect.value : null;
  const format = formatSelect ? formatSelect.value : null;
  const filesPerCall = (format && filesPerCallSelect) ? parseInt(filesPerCallSelect.value, 10) : 1;
  const calls = (format && callsSelect) ? parseInt(callsSelect.value, 10) : 1;

  if (!prompt) {
    showToast({ message: t('pg.pleaseEnterPrompt'), variant: 'warning' });
    return;
  }

  if (!proxy_id) {
    showToast({ message: t('pg.noProxyConfigured'), variant: 'error' });
    return;
  }

  // Reset UI
  errorContainer && errorContainer.classList.add('js-hidden');
  responseContainer && responseContainer.classList.add('js-hidden');
  downloadBtn && downloadBtn.classList.add('js-hidden');
  responseText && (responseText.innerHTML = '');
  multiFiles && (multiFiles.innerHTML = '');
  multiFiles && multiFiles.classList.add('js-hidden');
  pgState.lastFormatResponse = null;
  hideProgress(progressContainer);

  setControlsDisabled(true);

  const batchId = calls > 1 ? generateUUID() : null;
  pgState.batchCancelFlag = false;
  pgState.batchRunning = true;

  // Update Run button
  if (calls > 1) {
    sendBtn && (sendBtn.textContent = t('pg.cancel'));
    sendBtn && (sendBtn.onclick = cancelBatch);
  } else {
    sendBtn && (sendBtn.disabled = true);
    sendBtn && (sendBtn.textContent = t('pg.running'));
  }

  const responseOpts = { responseText, multiFiles, downloadBtn, responseTitle };
  let totalLatency = 0;
  const allErrors = [];

  for (let callNum = 1; callNum <= calls; callNum++) {
    if (pgState.batchCancelFlag) {
      allErrors.push(t('pg.batchCancelled', { n: callNum - 1 }));
      break;
    }

    if (calls > 1) {
      sendBtn && (sendBtn.textContent = t('pg.runningCall', { n: callNum, total: calls }));
    }

    const payload = { prompt, persona_id, proxy_id };
    if (format) {
      payload.format = format;
      if (filesPerCall > 1) payload.files_per_call = filesPerCall;
    }
    if (batchId) payload.batch_id = batchId;

    try {
      const { ok, status, data: result } = await sendPlaygroundRequest(payload);

      if (ok && (result.status === 'success' || result.status === 'partial')) {
        responseContainer && responseContainer.classList.remove('js-hidden');

        if (result.files && result.files.length > 0) {
          if (callNum > 1) appendCallSeparator(multiFiles, callNum);
          const saved = renderMultiFileResponse(result, filesPerCall, callNum, responseOpts);
          if (saved) pgState.lastFormatResponse = saved;
        } else if (result.download_ready) {
          if (callNum > 1) appendCallSeparator(multiFiles, callNum);
          const saved = renderSingleResponse(result, responseOpts);
          if (saved) pgState.lastFormatResponse = saved;
        } else {
          if (callNum > 1) {
            const sep = document.createElement('div');
            sep.className = 'pg-call-separator';
            sep.textContent = t('history.callSeparator', { n: callNum });
            responseText && responseText.parentElement.insertBefore(sep, responseText.nextSibling);
          }
          responseText && renderAIResponse(responseText, result.data);
          responseContainer && responseContainer.classList.remove('js-hidden');
        }

        totalLatency += (result.latency_ms || 0);
      } else {
        let errorMsg = result.error || 'An unknown error occurred';
        if (result.raw) errorMsg += '\n\nRaw output:\n' + result.raw;
        allErrors.push('Call ' + callNum + ': ' + errorMsg);

        if (calls > 1) {
          const errDiv = document.createElement('div');
          errDiv.className = 'pg-call-error';
          errDiv.textContent = 'Call ' + callNum + ' failed: ' + (errorMsg.length > 200 ? errorMsg.substring(0, 200) + '...' : errorMsg);
          responseContainer && responseContainer.classList.remove('js-hidden');
          if (multiFiles && !multiFiles.classList.contains('js-hidden')) {
            multiFiles.appendChild(errDiv);
          }
        }
      }
    } catch (err) {
      allErrors.push('Call ' + callNum + ': ' + err.message);
      break;
    }

    if (calls > 1) {
      showProgress(progressContainer, progressText, progressFill, callNum, calls);
    }

    // Wait between batch calls to prevent API rejection
    if (callNum < calls) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  // Update meta
  if (responseMeta) {
    responseMeta.textContent = calls > 1
      ? t('pg.totalLatency', { ms: totalLatency, calls })
      : t('pg.latency', { ms: totalLatency || '?' });
  }

  // Show errors if any (single call or all failed in batch)
  if (allErrors.length > 0 && calls === 1) {
    if (errorText) errorText.textContent = allErrors.join('\n');
    errorContainer && errorContainer.classList.remove('js-hidden');
  }

  // Refresh history
  loadPlaygroundHistory();

  pgState.batchRunning = false;
  setControlsDisabled(false);
  hideProgress(progressContainer);

  if (sendBtn) {
    sendBtn.disabled = false;
    sendBtn.textContent = t('pg.run');
    sendBtn.onclick = handlePlaygroundSend;
  }

  if (calls === 1 && allErrors.length === 0 && promptArea) {
    promptArea.value = '';
  }
}

function cancelBatch() {
  pgState.batchCancelFlag = true;
}

// ═══════════════════════════════════════════════════════════
// FORMAT DROPDOWN
// ═══════════════════════════════════════════════════════════

export function handleFormatChange() {
  const formatSelect     = $('pg-format-select');
  const formatInfo       = $('pg-format-info');
  const formatInfoText   = $('pg-format-info-text');
  const quantityControls = $('pg-quantity-controls');

  const value = formatSelect ? formatSelect.value : '';
  if (value) {
    const hint = t('pg.format.' + value);
    // If no translation found, t() returns the key — use old fallback
    formatInfoText.textContent = hint !== 'pg.format.' + value ? hint : '';
    if (formatInfoText.textContent) {
      formatInfo.classList.remove('js-hidden');
    } else {
      formatInfo.classList.add('js-hidden');
    }
    quantityControls && quantityControls.classList.remove('js-hidden');
  } else {
    formatInfo.classList.add('js-hidden');
    quantityControls && quantityControls.classList.add('js-hidden');
  }
}

// ═══════════════════════════════════════════════════════════
// DOWNLOAD HANDLER
// ═══════════════════════════════════════════════════════════

export function handleDownload() {
  if (!pgState.lastFormatResponse) return;
  if (pgState.lastFormatResponse.files) {
    pgState.lastFormatResponse.files.forEach(file => {
      if (file.download_ready) {
        downloadFormatFile(file.data, pgState.lastFormatResponse.format, file.index, pgState.lastFormatResponse.filesPerCall);
      }
    });
  } else {
    downloadFormatFile(pgState.lastFormatResponse.content, pgState.lastFormatResponse.format, 1, 1);
  }
}

// ═══════════════════════════════════════════════════════════
// EVENT WIRING
// ═══════════════════════════════════════════════════════════

export function initSendEvents() {
  const sendBtn      = $('pg-send-btn');
  const promptArea   = $('pg-prompt');
  const formatSelect = $('pg-format-select');
  const downloadBtn  = $('pg-download-btn');

  sendBtn && sendBtn.addEventListener('click', handlePlaygroundSend);

  promptArea && promptArea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePlaygroundSend();
    }
  });

  formatSelect && formatSelect.addEventListener('change', handleFormatChange);

  downloadBtn && downloadBtn.addEventListener('click', handleDownload);
}
