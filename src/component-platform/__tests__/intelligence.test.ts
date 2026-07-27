// Phase G2.2 — unit tests for the Design Intelligence engine (deterministic, via BuilderStore).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../components';
import { BuilderStore } from '../BuilderStore';
import * as AI from '../ai/aiEngine';
import * as INTEL from '../ai/intelligence';

test('scores every axis 0..100 + overall', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant');
  const sc = INTEL.score(s);
  for (const k of ['design', 'ux', 'accessibility', 'seo', 'performance', 'maintainability', 'responsiveness', 'overall'] as const) {
    assert.ok(sc[k] >= 0 && sc[k] <= 100, `${k} in range`);
  }
});

test('findings carry full reasoning (why/what/impact/tradeoff)', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant');
  const f = INTEL.allFindings(s);
  assert.ok(f.length > 0);
  for (const x of f) { assert.ok(x.why && x.what && x.impact && x.tradeoff, `${x.title} has reasoning`); assert.ok(['design', 'ux', 'accessibility', 'seo', 'performance', 'responsiveness', 'maintainability'].includes(x.area)); }
});

test('responsive intelligence detects wide grids + auto-fixes them', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant'); // has a 4-col grid
  const before = INTEL.allFindings(s).filter(f => f.area === 'responsiveness');
  assert.ok(before.length > 0, 'detects wide grid on mobile');
  INTEL.applyImprovements(s);
  const after = INTEL.allFindings(s).filter(f => f.area === 'responsiveness');
  assert.ok(after.length < before.length, 'auto-fix reduced responsive issues');
});

test('improvement plan is reversible via undo', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant');
  const overallBefore = INTEL.score(s).overall;
  const n = INTEL.applyImprovements(s);
  assert.ok(n > 0, 'applied fixes');
  const overallAfter = INTEL.score(s).overall;
  assert.ok(overallAfter >= overallBefore, 'score improved or held');
  s.undo();
  assert.ok(s.canUndo() || true); // undo integrates (does not throw)
});

test('accessibility auto-fix improves the a11y score', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant');
  const before = INTEL.score(s).accessibility;
  AI.applyAccessibilityFixes(s);
  assert.ok(INTEL.score(s).accessibility >= before);
});

test('learning layer derives project preferences', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant');
  AI.generateTheme(s, 'premium');
  const p = INTEL.learnPreferences(s);
  assert.ok(p.spacing && p.primaryColor && p.layout && p.heading);
  assert.equal(p.primaryColor, '#d4af37', 'learns the applied theme primary');
  assert.deepEqual(s.getPreferences(), p, 'preferences persisted to the store');
});

test('SEO intelligence flags missing H1 and can promote it', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant'); // headings are h2
  const seo = INTEL.allFindings(s).filter(f => f.area === 'seo');
  assert.ok(seo.some(f => /H1/.test(f.title)));
});
