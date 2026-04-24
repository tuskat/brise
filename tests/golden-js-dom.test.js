/**
 * Golden tests for JS DOM rendering — snapshot of class strings
 * produced by JavaScript template literals in *-state.js and *-dom.js.
 *
 * These verify that the HTML strings built in JS match what the CSS expects.
 * If a class name changes in CSS or HTML during refactoring, these tests break
 * to flag the intentional change.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const UTILS_DIR = path.resolve(import.meta.dirname, '../src/utils');

function readUtil(filename) {
  return fs.readFileSync(path.join(UTILS_DIR, filename), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// PERSONA CARD CLASSES
// ═══════════════════════════════════════════════════════════

describe('personas-state.js — card HTML class strings', () => {
  const js = readUtil('personas-state.js');

  it('card uses card card-hover', () => {
    expect(js).toContain('card card-hover');
  });

  it('card info area uses flex-grow', () => {
    expect(js).toContain('flex-grow');
  });

  it('card header uses row-between', () => {
    expect(js).toContain('row-between');
  });

  it('card name uses t-card-title', () => {
    expect(js).toContain('t-card-title');
  });

  it('card id badge uses badge badge-persona', () => {
    expect(js).toContain('badge-persona');
  });

  it('card params use badge badge-caps badge-accent', () => {
    expect(js).toContain('badge-caps');
    expect(js).toContain('badge-accent');
  });

  it('card actions use flex-row gap-sm mt-md pt-md border-t', () => {
    expect(js).toContain('flex-row gap-sm mt-md pt-md border-t');
  });

  it('edit button uses btn btn-primary', () => {
    expect(js).toContain('btn btn-primary');
  });

  it('delete button uses btn btn-danger', () => {
    expect(js).toContain('btn btn-danger');
  });
});

// ═══════════════════════════════════════════════════════════
// PROXY CARD CLASSES
// ═══════════════════════════════════════════════════════════

describe('proxies-state.js — card HTML class strings', () => {
  const js = readUtil('proxies-state.js');

  it('card uses card card-hover', () => {
    expect(js).toContain('card card-hover');
  });

  it('card status uses flex-row gap-sm for status row', () => {
    expect(js).toContain('flex-row gap-sm');
  });

  it('card info area uses flex-grow', () => {
    expect(js).toContain('flex-grow');
  });

  it('card header uses row-between', () => {
    expect(js).toContain('row-between');
  });

  it('card name uses t-card-title', () => {
    expect(js).toContain('t-card-title');
  });

  it('card URL uses t-caption-mono c-tertiary', () => {
    expect(js).toContain('t-caption-mono');
    expect(js).toContain('c-tertiary');
  });

  it('card model badge uses badge badge-caps badge-accent', () => {
    expect(js).toContain('badge-caps');
    expect(js).toContain('badge-accent');
  });

  it('card actions use flex-row gap-sm mt-md pt-md border-t', () => {
    expect(js).toContain('flex-row gap-sm mt-md pt-md border-t');
  });

  it('test button uses btn btn-secondary', () => {
    expect(js).toContain('btn btn-secondary');
  });

  it('edit button uses btn btn-primary', () => {
    expect(js).toContain('btn btn-primary');
  });

  it('delete button uses btn btn-danger', () => {
    expect(js).toContain('btn btn-danger');
  });

  it('local badge uses badge badge-caps badge-local', () => {
    expect(js).toContain('badge-local');
  });

  it('remote badge uses badge badge-caps badge-remote', () => {
    expect(js).toContain('badge-remote');
  });
});

// ═══════════════════════════════════════════════════════════
// CHAT DOM CLASSES
// ═══════════════════════════════════════════════════════════

describe('chat-dom.js — message HTML class strings', () => {
  const js = readUtil('chat-dom.js');

  it('message uses chat-msg flex-col', () => {
    expect(js).toContain('chat-msg flex-col');
  });

  it('user message uses chat-msg-user', () => {
    expect(js).toContain('chat-msg-user');
  });

  it('assistant message uses chat-msg-assistant', () => {
    expect(js).toContain('chat-msg-assistant');
  });

  it('error message uses chat-msg-error', () => {
    expect(js).toContain('chat-msg-error');
  });

  it('message bubble uses chat-msg-bubble', () => {
    expect(js).toContain('chat-msg-bubble');
  });

  it('meta row uses flex-row gap-sm', () => {
    expect(js).toContain('flex-row gap-sm');
  });

  it('copy button uses icon-btn', () => {
    expect(js).toContain('icon-btn');
  });

  it('conversation list item uses chat-conv-item', () => {
    expect(js).toContain('chat-conv-item');
  });

  it('loading dots use js-chat-msg-loading', () => {
    expect(js).toContain('js-chat-msg-loading');
  });
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD STATE CLASSES
// ═══════════════════════════════════════════════════════════

describe('dashboard-state.js — activity HTML class strings', () => {
  const js = readUtil('dashboard-state.js');

  it('activity item uses activity-item flex-row', () => {
    expect(js).toContain('activity-item flex-row');
  });

  it('success item uses activity-success', () => {
    expect(js).toContain('activity-success');
  });

  it('error item uses activity-error', () => {
    expect(js).toContain('activity-error');
  });

  it('status uses activity-status with c-success/c-error', () => {
    expect(js).toContain('activity-status');
    expect(js).toContain('c-success');
    expect(js).toContain('c-error');
  });

  it('time uses t-caption-mono c-tertiary', () => {
    expect(js).toContain('t-caption-mono c-tertiary');
  });

  it('persona uses c-accent', () => {
    expect(js).toContain('c-accent');
  });

  it('prompt uses flex-grow truncate c-secondary t-body', () => {
    expect(js).toContain('flex-grow truncate c-secondary t-body');
  });

  it('latency uses t-caption-mono c-tertiary text-right flex-shrink-0', () => {
    expect(js).toContain('t-caption-mono c-tertiary text-right flex-shrink-0');
  });
});

// ═══════════════════════════════════════════════════════════
// PLAYGROUND DOM CLASSES
// ═══════════════════════════════════════════════════════════

describe('playground-dom.js — history and detail class strings', () => {
  const js = readUtil('playground-dom.js');

  it('history item uses card history-item', () => {
    expect(js).toContain('card history-item');
  });

  it('history item header uses row-between', () => {
    expect(js).toContain('row-between');
  });

  it('history item meta uses flex-row gap-lg', () => {
    expect(js).toContain('flex-row gap-lg');
  });

  it('format badge uses badge badge-caps badge-accent', () => {
    expect(js).toContain('badge-caps');
    expect(js).toContain('badge-accent');
  });

  it('detail section uses flex-col gap-xs', () => {
    expect(js).toContain('flex-col gap-xs');
  });

  it('detail label uses label label-sm', () => {
    expect(js).toContain('label label-sm');
  });

  it('detail value uses detail-value', () => {
    expect(js).toContain('detail-value');
  });

  it('download buttons row uses flex-row gap-sm flex-wrap', () => {
    expect(js).toContain('flex-row gap-sm flex-wrap');
  });

  it('batch group uses pg-batch-group', () => {
    expect(js).toContain('pg-batch-group');
  });

  it('batch label uses pg-batch-label', () => {
    expect(js).toContain('pg-batch-label');
  });
});

// ═══════════════════════════════════════════════════════════
// CROSS-CUTTING: JS class strings match CSS selectors
// ═══════════════════════════════════════════════════════════

describe('JS class strings have matching CSS rules', () => {
  const cssDir = path.resolve(import.meta.dirname, '../src/styles');
  const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css')).sort();
  const css = cssFiles.map(f => fs.readFileSync(path.join(cssDir, f), 'utf-8')).join('\n');

  // Key classes used in JS that MUST have CSS rules
  const criticalClasses = [
    // Cards
    'card', 'card-hover',
    // Modal
    'modal', 'modal-card',
    // Input
    'input', 'input-select', 'input-textarea',
    // Badge
    'badge', 'badge-accent', 'badge-local', 'badge-remote', 'badge-persona',
    // Button
    'btn-primary', 'btn-secondary', 'btn-danger', 'btn-danger-fill',
    // Status
    'status-dot', 'status-dot-online', 'status-dot-offline',
    // Stat
    'stat-value',
    // Chat
    'chat-msg', 'chat-msg-bubble', 'chat-msg-copy', 'chat-conv-item',
    'chat-msg-user', 'chat-msg-assistant', 'chat-msg-error',
    // Activity
    'activity-item', 'activity-success', 'activity-error',
    'activity-status', 'activity-time', 'activity-persona', 'activity-latency',
    // History
    'history-item',
    // Detail
    'detail-value',
    // Stat
    'stat-value',
  ];

  criticalClasses.forEach(cls => {
    it(`${cls} from JS has matching CSS rule`, () => {
      expect(css).toContain(cls);
    });
  });
});
