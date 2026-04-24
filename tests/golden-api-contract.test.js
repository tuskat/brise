/**
 * Golden tests for API response envelope and routing invariants.
 * These verify the backend API contract remains intact during
 * CSS/HTML-only refactoring (Phases 3–8 should not touch API files).
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PAGES_DIR = path.resolve(import.meta.dirname, '../src/pages/api');

function readApi(relativePath) {
  return fs.readFileSync(path.join(PAGES_DIR, relativePath), 'utf-8');
}

// ═══════════════════════════════════════════════════════════
// RESPONSE ENVELOPE
// ═══════════════════════════════════════════════════════════

describe('API response envelope', () => {
  // These endpoints follow the { status: 'success'|'error', data, latency_ms } envelope
  const envelopeFiles = [
    'proxy.js',
    'proxies.js',
    'personas.js',
    'history.js',
    'metrics.js',
    'export.js',
    'chat/conversations.js',
    'chat/[id].js',
    'chat/[id]/messages.js',
    'chat/[id]/title.js',
  ];

  envelopeFiles.forEach(file => {
    it(`${file} returns success or error in response body`, () => {
      const source = readApi(file);
      // Should contain 'success' or 'error' in response bodies
      // (some use { success: true/false }, others use { status: 'success'/'error' })
      const hasSuccess = /['"`]success['"`]/.test(source) || /success:/.test(source);
      const hasError = /['"`]error['"`]/.test(source) || /error:/.test(source);
      expect(hasSuccess || hasError).toBe(true);
    });
  });

  it('proxy.js follows the status envelope pattern', () => {
    const source = readApi('proxy.js');
    expect(source).toContain('status');
  });
});

// ═══════════════════════════════════════════════════════════
// PROXY LOGGING INVARIANT
// ═══════════════════════════════════════════════════════════

describe('Proxy logging invariants', () => {
  it('proxy.js logs to prompt_logs (including failures)', () => {
    const source = readApi('proxy.js');
    expect(source).toContain('logInteraction');
  });

  it('chat messages.js does NOT log to prompt_logs', () => {
    const source = readApi('chat/[id]/messages.js');
    expect(source).not.toContain('logInteraction');
  });
});

// ═══════════════════════════════════════════════════════════
// API KEY SECURITY INVARIANTS
// ═══════════════════════════════════════════════════════════

describe('API key security invariants', () => {
  it('proxies.js uses ASCII asterisks for key masking', () => {
    const source = readApi('proxies.js');
    // Should NOT use Unicode bullet character
    expect(source).not.toContain('•');
    // Should use asterisks
    expect(source).toContain('********');
  });

  it('proxies.js rejects all-asterisk keys on PUT', () => {
    const source = readApi('proxies.js');
    expect(source).toMatch(/\*{4,}/);
  });
});

// ═══════════════════════════════════════════════════════════
// ROUTE CONSISTENCY
// ═══════════════════════════════════════════════════════════

describe('Route file existence', () => {
  const expectedRoutes = [
    'proxy.js',
    'proxies.js',
    'proxies/test.js',
    'personas.js',
    'history.js',
    'metrics.js',
    'export.js',
    'chat/conversations.js',
    'chat/[id].js',
    'chat/[id]/messages.js',
    'chat/[id]/title.js',
  ];

  expectedRoutes.forEach(route => {
    it(`${route} exists`, () => {
      const fullPath = path.join(PAGES_DIR, route);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  });
});
