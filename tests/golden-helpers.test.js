/**
 * Golden tests for helpers.js — pure functions with known inputs/outputs.
 * These serve as a safety net: if any output changes during CSS DRY refactoring,
 * the change is intentional and documented.
 */

import { describe, it, expect } from 'vitest';
import { escapeHtml, truncate, formatTime } from '../src/utils/helpers.js';

// ═══════════════════════════════════════════════════════════
// escapeHtml
// ═══════════════════════════════════════════════════════════

describe('escapeHtml', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('Ollama Local')).toBe('Ollama Local');
  });

  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml("it's")).toBe("it&#039;s");
    expect(escapeHtml('`code`')).toBe('&#96;code&#96;');
  });

  it('escapes all five special characters', () => {
    expect(escapeHtml('&<>"\'`')).toBe('&amp;&lt;&gt;&quot;&#039;&#96;');
  });
});

// ═══════════════════════════════════════════════════════════
// truncate
// ═══════════════════════════════════════════════════════════

describe('truncate', () => {
  it('returns empty string for null/undefined/empty', () => {
    expect(truncate(null, 10)).toBe('');
    expect(truncate(undefined, 10)).toBe('');
    expect(truncate('', 10)).toBe('');
  });

  it('leaves short strings untouched', () => {
    expect(truncate('Hello', 10)).toBe('Hello');
  });

  it('truncates long strings with ellipsis', () => {
    expect(truncate('This is a long prompt that should be truncated', 20)).toBe(
      'This is a long promp...'
    );
  });

  it('handles exact length boundary', () => {
    const str = '12345';
    expect(truncate(str, 5)).toBe('12345');
    expect(truncate(str, 4)).toBe('1234...');
  });

  it('used by playground/dashboard at length 50 and 80', () => {
    const prompt = 'A'.repeat(100);
    expect(truncate(prompt, 50)).toBe('A'.repeat(50) + '...');
    expect(truncate(prompt, 80)).toBe('A'.repeat(80) + '...');
  });
});

// ═══════════════════════════════════════════════════════════
// formatTime
// ═══════════════════════════════════════════════════════════

describe('formatTime', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatTime(null)).toBe('');
    expect(formatTime(undefined)).toBe('');
    expect(formatTime('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatTime('not-a-date')).toBe('');
  });

  /**
   * formatTime parses 'YYYY-MM-DD HH:MM:SS' as LOCAL time (SQLite convention).
   * We build timestamps using local date formatting to avoid UTC offset issues.
   */
  function toLocalSqlString(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  it('shows "Just now" for timestamps < 1 minute ago', () => {
    const ts = toLocalSqlString(new Date());
    expect(formatTime(ts)).toBe('Just now');
  });

  it('shows Xm ago for timestamps < 1 hour ago', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
    const ts = toLocalSqlString(fiveMinAgo);
    expect(formatTime(ts)).toBe('5m ago');
  });

  it('shows Xh ago for timestamps < 24 hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000);
    const ts = toLocalSqlString(twoHoursAgo);
    expect(formatTime(ts)).toBe('2h ago');
  });

  it('shows Xd ago for timestamps < 7 days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    const ts = toLocalSqlString(threeDaysAgo);
    expect(formatTime(ts)).toBe('3d ago');
  });

  it('shows formatted date for timestamps >= 7 days ago', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000);
    const ts = toLocalSqlString(tenDaysAgo);
    const result = formatTime(ts);
    // Should NOT be "Just now", "Xm ago", "Xh ago", or "Xd ago"
    expect(result).not.toMatch(/^(Just now|\d+m ago|\d+h ago|\d+d ago)$/);
    // Should be a locale date string
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles SQLite-style space-separated datetime', () => {
    const ts = '2026-04-23 14:30:00';
    const result = formatTime(ts);
    // Should not throw, should return a non-empty string
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});
