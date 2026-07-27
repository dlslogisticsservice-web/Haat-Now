// Phase G2.1 — unit tests for the AI engine (deterministic, generates via BuilderStore public API).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../components'; // register the component library
import { BuilderStore } from '../BuilderStore';
import * as AI from '../ai/aiEngine';

test('layout generator inserts components via the store (undoable)', () => {
  const s = new BuilderStore();
  const before = s.count();
  const r = AI.generateLayout(s, 'Create a restaurant home page');
  assert.equal(r.page, 'restaurant');
  assert.ok(r.nodes > 5);
  assert.ok(s.count() > before, 'nodes added to the tree');
  // reversible via undo (generation is many store ops → undo repeatedly)
  const after = s.count();
  assert.ok(s.canUndo());
  for (let i = 0; i < 60; i++) s.undo();
  assert.ok(s.count() < after, 'undo reverts generation');
});

test('page detection routes prompts to templates', () => {
  assert.equal(AI.detectPage('go to checkout'), 'checkout');
  assert.equal(AI.detectPage('merchant dashboard'), 'dashboard');
  assert.equal(AI.detectPage('landing page'), 'landing');
  assert.equal(AI.detectPage('anything else'), 'restaurant');
});

test('theme generator applies theme tokens (undoable state)', () => {
  const s = new BuilderStore();
  const r = AI.generateTheme(s, 'premium gold theme');
  assert.match(r.name, /Premium/);
  assert.equal(s.getTheme()['--color-primary-fixed'], '#d4af37');
  s.undo();
  assert.equal(Object.keys(s.getTheme()).length, 0, 'undo clears theme');
});

test('logic generator creates variables via the logic platform', () => {
  const s = new BuilderStore();
  AI.generateLogic(s, 'shopping cart counter');
  assert.ok(s.variables().some(v => v.name === 'cartCount'));
});

test('data generator creates entities via the data platform', () => {
  const s = new BuilderStore();
  const r = AI.generateData(s, 'pharmacy app');
  assert.ok(r.entities >= 2);
  assert.ok(s.entities().some(e => e.name === 'Medicines'));
  assert.ok(s.records(s.entities()[0].id).length > 0, 'seeded');
});

test('app generator composes data + layout + logic', () => {
  const s = new BuilderStore();
  AI.generateApp(s, 'grocery');
  assert.ok(s.entities().length >= 2);
  assert.ok(s.count() > 5);
  assert.ok(s.aiHistory().some(h => h.action === 'app'));
});

test('refactor / a11y / performance analysers produce suggestions', () => {
  const s = new BuilderStore();
  AI.generateLayout(s, 'restaurant');
  s.addVariable({ name: 'orphan', scope: 'global', type: 'string', value: 'x' });
  const refactor = AI.analyzeRefactor(s);
  assert.ok(refactor.some(x => x.kind === 'unused-variable'));
  const a11y = AI.analyzeAccessibility(s);
  assert.ok(a11y.length > 0, 'navbar/footer/etc need labels');
  const fixed = AI.applyAccessibilityFixes(s);
  assert.ok(fixed > 0);
  assert.equal(AI.analyzeAccessibility(s).length, 0, 'labels applied');
  AI.analyzePerformance(s); // does not throw
});

test('code explanation paraphrases bindings/expressions', () => {
  assert.match(AI.explainExpression('var.count >= 3 && var.active'), /variable count at least 3 AND variable active/);
});
