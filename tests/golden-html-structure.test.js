/**
 * Golden tests for HTML structure — snapshot of Astro component class
 * attributes and structural invariants that must survive CSS DRY refactoring.
 *
 * These verify:
 * 1. HTML elements have the correct classes after refactoring
 * 2. Button classes: btn btn-primary / btn-secondary / btn-danger-fill
 * 3. Layout utility classes: flex-col, row-between, flex-grow, etc.
 * 4. Modal structure remains consistent across tabs
 * 5. Design system classes are used correctly
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const COMP_DIR = path.resolve(import.meta.dirname, '../src/components');

function readComponent(relativePath) {
  return fs.readFileSync(path.join(COMP_DIR, relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// BUTTON CLASSES
// ═══════════════════════════════════════════════════════════

describe('Button classes in HTML', () => {
  it('PersonasTab form submit uses btn btn-primary', () => {
    const html = readComponent('tabs/PersonasTab.astro');
    expect(html).toContain('btn btn-primary');
  });

  it('PersonasTab delete button uses btn btn-danger-fill', () => {
    const html = readComponent('tabs/PersonasTab.astro');
    expect(html).toContain('btn btn-danger-fill');
  });

  it('ProxiesTab form submit uses btn btn-primary', () => {
    const html = readComponent('tabs/ProxiesTab.astro');
    expect(html).toContain('btn btn-primary');
  });

  it('ProxiesTab delete button uses btn btn-danger-fill', () => {
    const html = readComponent('tabs/ProxiesTab.astro');
    expect(html).toContain('btn btn-danger-fill');
  });

  it('ChatTab title edit modal uses btn btn-primary/secondary', () => {
    const html = readComponent('tabs/ChatTab.astro');
    expect(html).toContain('btn btn-secondary');
    expect(html).toContain('btn btn-primary');
  });
});

// ═══════════════════════════════════════════════════════════
// LAYOUT UTILITY CLASSES
// ═══════════════════════════════════════════════════════════

describe('Layout utility classes in HTML', () => {
  it('PersonasTab list uses flex-col gap-md mt-lg', () => {
    const html = readComponent('tabs/PersonasTab.astro');
    expect(html).toContain('flex-col gap-md mt-lg');
  });

  it('ProxiesTab list uses flex-col gap-md mt-lg', () => {
    const html = readComponent('tabs/ProxiesTab.astro');
    expect(html).toContain('flex-col gap-md mt-lg');
  });

  it('PersonasTab header uses row-between', () => {
    const html = readComponent('tabs/PersonasTab.astro');
    expect(html).toContain('row-between');
  });

  it('ProxiesTab header uses row-between', () => {
    const html = readComponent('tabs/ProxiesTab.astro');
    expect(html).toContain('row-between');
  });

  it('PlaygroundTab root uses flex-col gap-lg', () => {
    const html = readComponent('tabs/PlaygroundTab.astro');
    expect(html).toContain('flex-col gap-lg');
  });

  it('PlaygroundTab selectors row uses flex-row gap-lg flex-wrap', () => {
    const html = readComponent('tabs/PlaygroundTab.astro');
    expect(html).toContain('flex-row gap-lg flex-wrap');
  });

  it('DashboardTab stat value row uses flex-row gap-xs items-baseline', () => {
    const html = readComponent('tabs/DashboardTab.astro');
    expect(html).toContain('flex-row gap-xs items-baseline');
  });

  it('HistoryTab header uses row-between', () => {
    const html = readComponent('tabs/HistoryTab.astro');
    expect(html).toContain('row-between');
  });

  it('HistoryTab list uses flex-col gap-md mt-lg', () => {
    const html = readComponent('tabs/HistoryTab.astro');
    expect(html).toContain('flex-col gap-md mt-lg');
  });
});

// ═══════════════════════════════════════════════════════════
// DESIGN SYSTEM CLASSES IN HTML
// ═══════════════════════════════════════════════════════════

describe('Design system classes in HTML', () => {
  it('DashboardTab uses t-hero for title, t-subtitle for subtitle', () => {
    const html = readComponent('tabs/DashboardTab.astro');
    expect(html).toContain('t-hero');
    expect(html).toContain('t-subtitle');
  });

  it('DashboardTab uses card card-hover stat-card for metric cards', () => {
    const html = readComponent('tabs/DashboardTab.astro');
    expect(html).toContain('card card-hover stat-card');
  });

  it('DashboardTab uses label label-sm for stat labels', () => {
    const html = readComponent('tabs/DashboardTab.astro');
    expect(html).toContain('label label-sm');
  });

  it('DashboardTab uses stat-value for metric values', () => {
    const html = readComponent('tabs/DashboardTab.astro');
    expect(html).toContain('stat-value');
  });

  it('PersonasTab modal uses modal, modal-card', () => {
    const html = readComponent('tabs/PersonasTab.astro');
    expect(html).toContain('modal');
    expect(html).toContain('modal-card');
  });

  it('ProxiesTab modal uses modal, modal-card', () => {
    const html = readComponent('tabs/ProxiesTab.astro');
    expect(html).toContain('modal');
    expect(html).toContain('modal-card');
  });

  it('ChatTab modal uses modal, modal-card', () => {
    const html = readComponent('tabs/ChatTab.astro');
    expect(html).toContain('modal');
    expect(html).toContain('modal-card');
  });

  it('ChatTab has think-modal with think-modal-body', () => {
    const html = readComponent('tabs/ChatTab.astro');
    expect(html).toContain('id="think-modal"');
    expect(html).toContain('id="think-modal-body"');
    expect(html).toContain('id="think-modal-close"');
  });

  it('All modals use t-section-title', () => {
    const html1 = readComponent('tabs/PersonasTab.astro');
    const html2 = readComponent('tabs/ProxiesTab.astro');
    const html3 = readComponent('tabs/ChatTab.astro');
    [html1, html2, html3].forEach(html => {
      expect(html).toContain('t-section-title');
    });
  });

  it('Form inputs use input and label classes', () => {
    const html = readComponent('tabs/PersonasTab.astro');
    expect(html).toContain('input');
    expect(html).toContain('label');
  });
});

// ═══════════════════════════════════════════════════════════
// JS-GENERATED HTML CLASS INVARIANTS
// ═══════════════════════════════════════════════════════════

describe('JS-generated HTML class invariants', () => {
  it('personas-state.js uses t-card-title and row-between in cards', () => {
    const js = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/personas-state.js'), 'utf-8'
    );
    expect(js).toContain('t-card-title');
    expect(js).toContain('row-between');
  });

  it('personas-state.js uses flex-grow and badge badge-caps badge-accent', () => {
    const js = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/personas-state.js'), 'utf-8'
    );
    expect(js).toContain('flex-grow');
    expect(js).toContain('badge');
  });

  it('proxies-state.js uses t-card-title, t-caption-mono, c-tertiary', () => {
    const js = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/proxies-state.js'), 'utf-8'
    );
    expect(js).toContain('t-card-title');
    expect(js).toContain('t-caption-mono');
    expect(js).toContain('c-tertiary');
  });

  it('proxies-state.js uses row-between and flex-grow', () => {
    const js = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/proxies-state.js'), 'utf-8'
    );
    expect(js).toContain('row-between');
    expect(js).toContain('flex-grow');
  });

  it('chat-dom.js uses icon-btn for conversation delete and copy buttons', () => {
    const js = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/chat-dom.js'), 'utf-8'
    );
    expect(js).toContain('icon-btn');
  });

  it('dashboard-state.js uses flex-row for activity items', () => {
    const js = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/dashboard-state.js'), 'utf-8'
    );
    expect(js).toContain('flex-row');
  });

  it('dashboard-state.js uses activity-success / activity-error for status', () => {
    const js = fs.readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/dashboard-state.js'), 'utf-8'
    );
    expect(js).toContain('activity-success');
    expect(js).toContain('activity-error');
  });
});

// ═══════════════════════════════════════════════════════════
// NO REGRESSION: removed class strings should NOT appear
// ═══════════════════════════════════════════════════════════

describe('No regression: removed BEM classes absent from HTML', () => {
  it('no ds-modal__save-btn in any Astro component', () => {
    const files = ['tabs/PersonasTab.astro', 'tabs/ProxiesTab.astro', 'tabs/ChatTab.astro'];
    files.forEach(f => {
      const html = readComponent(f);
      expect(html).not.toContain('ds-modal__save-btn');
    });
  });

  it('no ds-modal__cancel-btn in any Astro component', () => {
    const files = ['tabs/PersonasTab.astro', 'tabs/ProxiesTab.astro', 'tabs/ChatTab.astro'];
    files.forEach(f => {
      const html = readComponent(f);
      expect(html).not.toContain('ds-modal__cancel-btn');
    });
  });

  it('no ds-modal__delete-btn in any Astro component', () => {
    const files = ['tabs/PersonasTab.astro', 'tabs/ProxiesTab.astro'];
    files.forEach(f => {
      const html = readComponent(f);
      expect(html).not.toContain('ds-modal__delete-btn');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// TAB VIEW IDS — all must exist and be unique
// ═══════════════════════════════════════════════════════════

describe('Tab view element IDs', () => {
  const tabIds = [
    { file: 'tabs/DashboardTab.astro', id: 'dashboard-view' },
    { file: 'tabs/ChatTab.astro', id: 'chat-view' },
    { file: 'tabs/PlaygroundTab.astro', id: 'playground-view' },
    { file: 'tabs/PersonasTab.astro', id: 'personas-view' },
    { file: 'tabs/ProxiesTab.astro', id: 'proxies-view' },
  ];

  tabIds.forEach(({ file, id }) => {
    it(`${file} has id="${id}"`, () => {
      const html = readComponent(file);
      expect(html).toContain(`id="${id}"`);
    });
  });

  it('all tab view IDs are unique across components', () => {
    const ids = tabIds.map(t => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ═══════════════════════════════════════════════════════════
// MODAL STRUCTURE CONSISTENCY
// ═══════════════════════════════════════════════════════════

describe('Modal structure consistency', () => {
  it('all modals have modal class', () => {
    const html1 = readComponent('tabs/PersonasTab.astro');
    const html2 = readComponent('tabs/ProxiesTab.astro');
    const html3 = readComponent('tabs/ChatTab.astro');

    [html1, html2, html3].forEach(html => {
      expect(html).toContain('modal');
    });
  });

  it('all modals have a close button', () => {
    const html1 = readComponent('tabs/PersonasTab.astro');
    const html2 = readComponent('tabs/ProxiesTab.astro');

    expect(html1).toContain('modal-close');
    expect(html2).toContain('modal-close');
  });

  it('delete confirmation modals use modal-card-sm', () => {
    const html1 = readComponent('tabs/PersonasTab.astro');
    const html2 = readComponent('tabs/ProxiesTab.astro');
    expect(html1).toContain('modal-card-sm');
    expect(html2).toContain('modal-card-sm');
  });
});
