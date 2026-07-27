// Phase 9B — unit tests for the Expression Engine (safe evaluator powering bindings/logic).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validateExpression, interpolate, hasBinding } from '../logic/expression';

const scope = {
  var: { count: 3, name: 'Sara', loggedIn: true, price: 20 },
  state: { cart: 2 },
  data: { restaurant: { name: 'Al Basha', rating: 4.8 } },
  ctx: { role: 'customer', country: 'SA' },
};

test('arithmetic + precedence', () => {
  assert.equal(evaluate('1 + 2 * 3').value, 7);
  assert.equal(evaluate('(1 + 2) * 3').value, 9);
  assert.equal(evaluate('10 % 3').value, 1);
  assert.equal(evaluate('7 / 0').value, 0); // null-safe division
});

test('comparisons + boolean logic + ternary', () => {
  assert.equal(evaluate('var.count > 2', scope).value, true);
  assert.equal(evaluate('var.count == 3 && var.loggedIn', scope).value, true);
  assert.equal(evaluate('var.count > 5 || var.loggedIn', scope).value, true);
  assert.equal(evaluate('var.count > 2 ? "many" : "few"', scope).value, 'many');
  assert.equal(evaluate('!var.loggedIn', scope).value, false);
});

test('paths are null-safe (missing → undefined, never throws)', () => {
  assert.equal(evaluate('var.missing.deep.path', scope).ok, true);
  assert.equal(evaluate('var.missing', scope).value, undefined);
  assert.equal(evaluate('data.restaurant.name', scope).value, 'Al Basha');
});

test('string concatenation + functions', () => {
  assert.equal(evaluate('"Hi " + var.name', scope).value, 'Hi Sara');
  assert.equal(evaluate('upper(var.name)', scope).value, 'SARA');
  assert.equal(evaluate('len(var.name)', scope).value, 4);
  assert.equal(evaluate('round(4.6)').value, 5);
  assert.equal(evaluate('currency(var.price, "SAR")', scope).value, 'SAR 20.00');
  assert.equal(evaluate('plural(var.count, "item", "items")', scope).value, 'items');
  assert.equal(evaluate('ifNull(var.missing, "fallback")', scope).value, 'fallback');
});

test('array functions', () => {
  const s = { arr: [1, 2, 3, 4] };
  assert.equal(evaluate('sum(arr)', s).value, 10);
  assert.equal(evaluate('len(arr)', s).value, 4);
  assert.equal(evaluate('first(arr)', s).value, 1);
  assert.equal(evaluate('last(arr)', s).value, 4);
});

test('validate + interpolate + hasBinding', () => {
  assert.equal(validateExpression('1 + ').valid, false);
  assert.equal(validateExpression('var.count > 2').valid, true);
  assert.equal(interpolate('Hello {{var.name}} ({{var.count}})', scope), 'Hello Sara (3)');
  assert.equal(hasBinding('{{x}}'), true);
  assert.equal(hasBinding('plain'), false);
});

test('unknown function is a safe error, not a crash', () => {
  const r = evaluate('nope(1)');
  assert.equal(r.ok, false);
  assert.match(r.error || '', /Unknown function/);
});
