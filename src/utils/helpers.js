/**
 * Shared helper utilities for the Brise frontend.
 * No DOM dependencies — pure functions only.
 */

import { t } from '../i18n/index.js';

/**
 * HTML-escape a string for safe insertion via innerHTML.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#96;');
}

/**
 * Truncate a string with ellipsis.
 */
export function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

/**
 * Human-readable relative time ("Just now", "5m ago", "2h ago", etc.).
 * SQLite returns DATETIME as 'YYYY-MM-DD HH:MM:SS' (local server time, no TZ).
 * Parsing it as-is treats it as local time, which is correct.
 * Ranges: <1min → Just now, <60min → Xm ago, <24h → Xh ago, <7d → Xd ago, else → date.
 */
export function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp.replace(' ', 'T'));
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000)  return t('time.justNow');
  if (diff < 3_600_000)  return t('time.minutesAgo', { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('time.hoursAgo', { n: Math.floor(diff / 3_600_000) });
  if (diff < 604_800_000) return t('time.daysAgo', { n: Math.floor(diff / 86_400_000) });
  return date.toLocaleDateString();
}
