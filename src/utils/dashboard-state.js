/**
 * Dashboard state — metrics loading, chart rendering, recent activity.
 * Called by tab-nav.js when the dashboard tab becomes active.
 */

import { formatTime, truncate, escapeHtml } from './helpers.js';

const showToast = () => window.showToast;

// ═══════════════════════════════════════════════════════════
// OPEN HISTORY DETAIL FROM DASHBOARD
// ═══════════════════════════════════════════════════════════

function openHistoryDetail(item) {
  // Switch to history tab
  const historyLink = document.querySelector('[data-tab="history"]');
  if (historyLink) historyLink.click();

  // Show the detail view after tab switch renders
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (window.showHistoryDetail) window.showHistoryDetail(item);
    });
  });
}

// ═══════════════════════════════════════════════════════════
// DOM REFS (resolved lazily on first call)
// ═══════════════════════════════════════════════════════════

function getRefs() {
  return {
    metricTotal:        document.getElementById('metric-total'),
    metricSuccessRate:  document.getElementById('metric-success-rate'),
    metricAvgLatency:   document.getElementById('metric-avg-latency'),
    metricRecentLatency: document.getElementById('metric-recent-latency'),
    metricMinLatency:   document.getElementById('metric-min-latency'),
    metricMaxLatency:   document.getElementById('metric-max-latency'),
    personaUsageChart:  document.getElementById('persona-usage-chart'),
    dailyUsageChart:    document.getElementById('daily-usage-chart'),
    recentActivity:     document.getElementById('recent-activity'),
  };
}

// ═══════════════════════════════════════════════════════════
// METRICS LOADER
// ═══════════════════════════════════════════════════════════

export async function loadMetrics() {
  const refs = getRefs();

  try {
    const response = await fetch('/api/metrics');
    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      throw new Error(result.error || 'Failed to load metrics');
    }

    const m = result.data;

    // Update metric cards
    if (refs.metricTotal)        refs.metricTotal.textContent        = m.totalRequests?.toString() ?? '0';
    if (refs.metricSuccessRate)  refs.metricSuccessRate.textContent  = `${m.successRate?.toFixed(1) ?? '0'}%`;
    if (refs.metricAvgLatency)   refs.metricAvgLatency.textContent   = m.avgLatency?.toFixed(0) ?? '0';
    if (refs.metricRecentLatency) refs.metricRecentLatency.textContent = m.recentAvgLatency?.toFixed(0) ?? '0';
    if (refs.metricMinLatency)   refs.metricMinLatency.textContent   = m.minLatency?.toString() ?? '0';
    if (refs.metricMaxLatency)   refs.metricMaxLatency.textContent   = m.maxLatency?.toString() ?? '0';

    // Render persona usage chart — horizontal bars
    if (refs.personaUsageChart) {
      const usage = m.personaUsage || [];
      if (usage.length === 0) {
        refs.personaUsageChart.innerHTML = '<p class="c-tertiary t-caption text-center m-20">No data yet</p>';
      } else {
        const maxCount = Math.max(...usage.map((u) => u.count), 1);
        refs.personaUsageChart.innerHTML = `
          <div class="chart-horizontal">
            ${usage.slice(0, 6).map((u) => {
              const width = Math.max((u.count / maxCount) * 100, 8);
              const label = escapeHtml(u.persona_id || 'Default');
              return `
                <div class="chart-h-row">
                  <span class="t-caption c-secondary truncate t-weight-500 chart-h-label" title="${label}">${label}</span>
                  <div class="chart-h-bar-container">
                    <div class="chart-h-bar" style="width: ${width}%"></div>
                    <span class="t-caption t-weight-700 c-primary text-right chart-h-value">${u.count}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // Render daily activity chart — vertical bars
    if (refs.dailyUsageChart) {
      const daily = m.dailyUsage || [];
      if (daily.length === 0) {
        refs.dailyUsageChart.innerHTML = '<p class="c-tertiary t-caption text-center m-20">No data yet</p>';
      } else {
        const maxCount = Math.max(...daily.map((d) => d.count), 1);
        const MAX_BAR_PX = 110;
        refs.dailyUsageChart.innerHTML = `
          <div class="chart-bars">
            ${daily.map((d) => {
              const pxHeight = Math.max((d.count / maxCount) * MAX_BAR_PX, 4);
              const dateObj = new Date(d.date);
              const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return `
                <div class="chart-bar">
                  <span class="t-caption t-weight-700 c-primary chart-bar-value">${d.count}</span>
                  <div class="chart-bar-fill" style="height: ${pxHeight}px"></div>
                  <span class="t-micro c-tertiary text-center truncate chart-bar-label" title="${dateStr}">${dayName}<br/>${dateStr.slice(-2)}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    // Render recent activity
    if (refs.recentActivity) {
      const historyResponse = await fetch('/api/history?limit=5');
      const historyResult = await historyResponse.json();

      if (historyResult.status === 'success' && historyResult.data?.length > 0) {
        refs.recentActivity.innerHTML = historyResult.data.map((item) => {
          const statusClass = item.status === 'success' ? 'activity-success' : 'activity-error';
          const statusIcon = item.status === 'success' ? '●' : '○';
          const statusColor = item.status === 'success' ? 'c-success' : 'c-error';
          return `
            <div class="activity-item activity-item-clickable flex-row ${statusClass}" data-history-id="${item.id}">
              <span class="t-caption text-center flex-shrink-0 activity-status ${statusColor}">${statusIcon}</span>
              <span class="t-caption-mono c-tertiary flex-shrink-0 activity-time">${formatTime(item.timestamp)}</span>
              <span class="t-caption t-weight-600 truncate flex-shrink-0 c-accent activity-persona">${escapeHtml(item.persona_id || 'Default')}</span>
              <span class="flex-grow truncate c-secondary t-body">${escapeHtml(truncate(item.user_prompt, 50))}</span>
              <span class="t-caption-mono c-tertiary text-right flex-shrink-0 activity-latency">${item.latency}ms</span>
            </div>
          `;
        }).join('');

        // Attach click handlers to open history detail
        refs.recentActivity.querySelectorAll('.activity-item-clickable').forEach(el => {
          el.addEventListener('click', () => {
            const id = parseInt(el.getAttribute('data-history-id'), 10);
            const item = historyResult.data.find(h => h.id === id);
            if (item) openHistoryDetail(item);
          });
        });
      } else {
        refs.recentActivity.innerHTML = '<p class="c-tertiary t-caption text-center m-20">No recent activity</p>';
      }
    }

  } catch (err) {
    console.error('Failed to load metrics:', err);
    showToast()?.({ message: `Failed to load metrics: ${err.message}`, variant: 'error' });
  }
}
