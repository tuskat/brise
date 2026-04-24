/**
 * Golden tests for CSS — snapshot of the current CSS class inventory,
 * selector counts, and structural invariants that must not change
 * unintentionally during refactoring.
 *
 * These are NOT pixel-level tests. They verify:
 * 1. Total CSS line count stays within expected range
 * 2. Key CSS classes / selectors still exist after refactoring
 * 3. No CSS rule is accidentally deleted
 * 4. Utility classes remain intact
 * 5. Design system tokens are unchanged
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CSS_DIR = path.resolve(import.meta.dirname, '../src/styles');

// Read ALL CSS files in src/styles/ so chunked files are covered
const cssFiles = fs.readdirSync(CSS_DIR).filter(f => f.endsWith('.css')).sort();
const css = cssFiles.map(f => fs.readFileSync(path.join(CSS_DIR, f), 'utf-8')).join('\n');
const lines = css.split('\n');

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check that a CSS class (without the dot) appears as a CSS selector.
 * E.g., hasCssSelector('card') matches '.card {' or '.card:hover'
 */
function hasCssSelector(cls) {
  const re = new RegExp('\\.' + escapeRegex(cls) + '[\\s{:,.]');
  return re.test(css);
}

// ═══════════════════════════════════════════════════════════
// STRUCTURAL INVARIANTS
// ═══════════════════════════════════════════════════════════

describe('CSS structure', () => {
  it('total line count is within expected range', () => {
    // After Round 3 DRY refactor
    expect(lines.length).toBeGreaterThanOrEqual(1400);
    expect(lines.length).toBeLessThanOrEqual(2050);
  });

  it('global.css starts with imports section', () => {
    const globalCss = fs.readFileSync(path.join(CSS_DIR, 'global.css'), 'utf-8');
    expect(globalCss.startsWith('/* ═')).toBe(true);
    expect(globalCss.slice(0, 300)).toContain('IMPORTS');
  });

  it('theme tokens file exists and contains :root tokens', () => {
    const tokensCss = fs.readFileSync(path.join(CSS_DIR, 'theme_tokens.css'), 'utf-8');
    expect(tokensCss).toContain('THEME TOKENS');
    expect(tokensCss).toContain(':root {');
  });

  it('contains CSS custom property definitions in :root', () => {
    const tokensCss = fs.readFileSync(path.join(CSS_DIR, 'theme_tokens.css'), 'utf-8');
    expect(tokensCss).toContain('--bg-primary:');
    expect(tokensCss).toContain('--text-primary:');
    expect(tokensCss).toContain('--accent:');
    expect(tokensCss).toContain('--success:');
    expect(tokensCss).toContain('--error:');
    expect(tokensCss).toContain('--warning:');
    expect(tokensCss).toContain('--shadow-card:');
    expect(tokensCss).toContain('--shadow-modal:');
  });

  it('contains light theme overrides in :root.js-light', () => {
    const tokensCss = fs.readFileSync(path.join(CSS_DIR, 'theme_tokens.css'), 'utf-8');
    expect(tokensCss).toContain(':root.js-light');
    expect(tokensCss).toContain('--bg-primary: #f0ede8');
  });
});

// ═══════════════════════════════════════════════════════════
// UTILITY CLASSES (must all exist)
// ═══════════════════════════════════════════════════════════

describe('Utility classes', () => {
  const layoutUtils = [
    'flex-col', 'flex-row', 'flex-wrap', 'flex-grow', 'flex-1', 'flex-shrink-0',
    'row-between', 'row-center', 'items-baseline', 'self-end', 'self-start',
    'gap-xs', 'gap-sm', 'gap-md', 'gap-lg',
    'w-100', 'min-w-0',
    'truncate', 'text-center', 'text-left', 'text-right',
    'overflow-hidden', 'overflow-y',
  ];

  layoutUtils.forEach(cls => {
    it(`.${cls} exists`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  const typoUtils = [
    't-micro', 't-caption', 't-caption-mono',
    't-body', 't-label', 't-card-title', 't-section-title',
    't-hero', 't-subtitle', 't-title', 't-mono',
    't-weight-500', 't-weight-600', 't-weight-700',
    't-uppercase', 't-pre-wrap',
  ];

  typoUtils.forEach(cls => {
    it(`.${cls} exists`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  const colorUtils = [
    'c-primary', 'c-secondary', 'c-tertiary',
    'c-accent', 'c-success', 'c-error', 'c-warning', 'c-inverse',
    'bg-error', 'bg-primary', 'bg-secondary', 'bg-tertiary', 'bg-surface', 'bg-accent',
  ];

  colorUtils.forEach(cls => {
    it(`.${cls} exists`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  const borderUtils = [
    'border', 'border-b', 'border-t', 'rounded', 'rounded-sm', 'rounded-full',
  ];

  borderUtils.forEach(cls => {
    it(`.${cls} exists`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  const btnVariants = [
    'btn-primary', 'btn-secondary', 'btn-sm', 'btn-xs', 'btn-lg',
    'btn-danger', 'btn-danger-fill', 'btn-export',
  ];

  btnVariants.forEach(cls => {
    it(`.${cls} exists`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  const componentUtils = [
    'icon-btn', 'label-sm', 'badge-accent',
  ];

  componentUtils.forEach(cls => {
    it(`.${cls} exists`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// DESIGN SYSTEM COMPONENTS (new flat names)
// ═══════════════════════════════════════════════════════════

describe('Design system components', () => {
  const dsClasses = [
    'card', 'card-hover',
    'text-block', 'text-block-prompt',
    'modal',
    'modal-card', 'modal-card-sm', 'modal-close',
    'input', 'input-select', 'input-textarea',
    'label',
    'placeholder',
    'badge', 'badge-caps', 'badge-sm',
    'badge-success', 'badge-error', 'badge-warning',
    'badge-info', 'badge-neutral', 'badge-persona',
    'badge-local', 'badge-remote', 'badge-accent',
  ];

  dsClasses.forEach(cls => {
    it(`.${cls} exists as CSS selector`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  it('modal.js-open state class exists', () => {
    expect(css).toContain('.modal.js-open');
  });

  it('input:focus pseudo-selector exists', () => {
    expect(css).toContain('.input:focus');
  });
});

// ═══════════════════════════════════════════════════════════
// PER-TAB CSS CLASSES
// ═══════════════════════════════════════════════════════════

describe('Per-tab CSS selectors', () => {
  // Dashboard
  const dashboardClasses = [
    'dashboard-grid', 'dashboard-charts',
    'dashboard-chart-area', 'dashboard-section-full', 'dashboard-activity-list',
    'chart-bars', 'chart-bar', 'chart-bar-fill',
    'chart-horizontal', 'chart-h-row', 'chart-h-bar',
    'activity-item', 'activity-success', 'activity-error',
    'activity-status', 'activity-time',
    'activity-persona', 'activity-latency',
    'stat-value',
    'chart-bar-value', 'chart-bar-label', 'chart-h-label', 'chart-h-value',
  ];

  dashboardClasses.forEach(cls => {
    it(`dashboard: .${cls} exists in CSS`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  // Chat
  const chatClasses = [
    'chat-layout', 'chat-sidebar', 'chat-sidebar-list', 'chat-sidebar-backdrop',
    'chat-main', 'chat-empty', 'chat-thread', 'chat-thread-header', 'chat-messages',
    'chat-msg', 'chat-msg-user', 'chat-msg-assistant', 'chat-msg-error',
    'chat-msg-bubble', 'chat-msg-copy', 'chat-msg-dot',
    'chat-input-textarea', 'chat-send-btn',
    'chat-conv-item', 'chat-conv-item-active',
  ];

  chatClasses.forEach(cls => {
    it(`chat: .${cls} exists in CSS`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  // Playground
  const playgroundClasses = [
    'pg-field-sm', 'pg-field-xs', 'pg-response', 'pg-response-header',
    'pg-file-card', 'pg-file-card-header', 'pg-file-card-name',
    'pg-file-card-name-error', 'pg-file-card-download-btn', 'pg-file-card-content',
    'pg-file-card-content-error',
    'pg-batch-group', 'pg-batch-label',
    'pg-call-separator', 'pg-call-error',
    'pg-progress-bar', 'pg-progress-fill',
  ];

  playgroundClasses.forEach(cls => {
    it(`playground: .${cls} exists in CSS`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  // History
  const historyClasses = [
    'history-item',
  ];

  historyClasses.forEach(cls => {
    it(`history: .${cls} exists in CSS`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });

  // Proxies
  const proxiesClasses = [
    'status-dot', 'status-dot-online',
    'status-dot-offline', 'status-dot-unknown',
  ];

  proxiesClasses.forEach(cls => {
    it(`proxies: .${cls} exists in CSS`, () => {
      expect(hasCssSelector(cls)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// REMOVED SELECTORS (must NOT reappear)
// ═══════════════════════════════════════════════════════════

describe('Removed CSS selectors', () => {
  const removedClasses = [
    // Phase 1
    'ds-modal__save-btn', 'ds-modal__cancel-btn', 'ds-modal__delete-btn', 'ds-modal__test-btn',
    // Phase 3
    'pg-cv__label', 'detail-label', 'pg-cv__response-title', 'dashboard__section-title', 'ds-modal__confirm-text',
    // Phase 4
    'stat-card__trend--up', 'stat-card__trend--down',
    // Phase 5
    'persona-card__param', 'pg-format-badge', 'stat-card__label',
    // Round 3 — replaced by utilities
    'empty-state__title', 'empty-state__action',
    'dashboard__grid', 'dashboard__charts', 'dashboard__chart-area',
    'chart-bar__fill', 'chart-bar__value', 'chart-bar__label',
    // chart-h-label, chart-h-value — still in CSS as structural min-width rules (used by JS)
    // ds-page-header, ds-page-title, ds-page-subtitle, ds-card-actions — compat aliases, will remove later
    // chat-conversation__* — compat aliases, will remove later
    'activity-item--success', 'activity-item--error',
    'activity-item__status', 'activity-item__time', 'activity-item__persona', 'activity-item__prompt', 'activity-item__latency',
    'stat-card__value', 'stat-card__unit', 'stat-card__trend', 'stat-card',
    'chat-msg--user', 'chat-msg--assistant', 'chat-msg--error',
    'chat-msg__bubble', 'chat-msg__copy', 'chat-msg__time', 'chat-msg__latency', 'chat-msg__persona',
    'chat-conv-item--active', 'chat-conv-item__delete', 'chat-conv-item__title',
    'pg-cv__send-btn', 'pg-cv__response', 'pg-cv__response-header', 'pg-cv__response-meta',
    'pg-cv__select', 'pg-cv__textarea',
    'pg-progress-container',
    'history-item__time', 'history-item__status', 'history-item__persona', 'history-item__prompt', 'history-item__latency',
    'proxy-card__status',
  ];

  removedClasses.forEach(cls => {
    it(`.${cls} was removed`, () => {
      expect(hasCssSelector(cls)).toBe(false);
    });
  });
});
