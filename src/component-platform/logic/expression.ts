// ─────────────────────────────────────────────────────────────────────────────
// Expression Engine (Phase 9B).
//
// A safe, self-contained expression evaluator — NO eval / new Function. It powers data binding,
// conditional logic, computed variables and workflow conditions. A recursive-descent parser
// (precedence climbing) supports math, string, boolean, comparison, ternary, member access,
// indexing, and a whitelisted function library (formatting, currency, plural, array/string ops,
// date). Identifier lookup is null-safe (missing paths resolve to undefined, never throw).
//
// PURE — no DOM, no React, no services.
// ─────────────────────────────────────────────────────────────────────────────

export type Scope = Record<string, unknown>;
export interface EvalResult { ok: boolean; value: unknown; error?: string; }

// ── function library (whitelisted; no lambdas → no arbitrary code) ──
const FN: Record<string, (...a: unknown[]) => unknown> = {
  len: (x) => (Array.isArray(x) || typeof x === 'string' ? (x as unknown[]).length : 0),
  count: (x) => (Array.isArray(x) ? x.length : 0),
  upper: (x) => String(x ?? '').toUpperCase(),
  lower: (x) => String(x ?? '').toLowerCase(),
  trim: (x) => String(x ?? '').trim(),
  contains: (x, y) => String(x ?? '').includes(String(y ?? '')),
  replace: (x, a, b) => String(x ?? '').split(String(a ?? '')).join(String(b ?? '')),
  round: (x) => Math.round(Number(x) || 0),
  floor: (x) => Math.floor(Number(x) || 0),
  ceil: (x) => Math.ceil(Number(x) || 0),
  abs: (x) => Math.abs(Number(x) || 0),
  min: (...a) => Math.min(...a.map(Number)),
  max: (...a) => Math.max(...a.map(Number)),
  sum: (x) => (Array.isArray(x) ? x.reduce((s: number, v) => s + (Number(v) || 0), 0) : 0),
  first: (x) => (Array.isArray(x) ? x[0] : undefined),
  last: (x) => (Array.isArray(x) ? x[x.length - 1] : undefined),
  join: (x, sep) => (Array.isArray(x) ? x.join(String(sep ?? ',')) : ''),
  currency: (n, cur) => `${String(cur ?? 'SAR')} ${(Number(n) || 0).toFixed(2)}`,
  plural: (n, one, many) => (Number(n) === 1 ? String(one ?? '') : String(many ?? '')),
  ifNull: (x, fb) => (x == null || x === '' ? fb : x),
  bool: (x) => !!x && x !== 'false' && x !== '0',
  num: (x) => Number(x) || 0,
  str: (x) => String(x ?? ''),
};
export const FUNCTIONS = Object.keys(FN);

// ── tokenizer ──
type Tok = { t: 'num' | 'str' | 'id' | 'op' | 'punc'; v: string };
function lex(src: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  const ops = ['&&', '||', '==', '!=', '>=', '<=', '+', '-', '*', '/', '%', '>', '<', '!', '?', ':'];
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n') { i++; continue; }
    if (c === '"' || c === "'") { let j = i + 1, v = ''; while (j < src.length && src[j] !== c) { v += src[j]; j++; } out.push({ t: 'str', v }); i = j + 1; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) { let j = i, v = ''; while (j < src.length && /[0-9.]/.test(src[j])) { v += src[j]; j++; } out.push({ t: 'num', v }); i = j; continue; }
    if (/[a-zA-Z_$]/.test(c)) { let j = i, v = ''; while (j < src.length && /[a-zA-Z0-9_$.]/.test(src[j])) { v += src[j]; j++; } out.push({ t: 'id', v }); i = j; continue; }
    const two = src.slice(i, i + 2);
    if (ops.includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if (ops.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if ('()[],'.includes(c)) { out.push({ t: 'punc', v: c }); i++; continue; }
    throw new Error(`Unexpected '${c}'`);
  }
  return out;
}

// ── parser (precedence climbing) → AST evaluated inline against scope ──
const PREC: Record<string, number> = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '<=': 4, '>': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };

class Parser {
  private p = 0;
  constructor(private toks: Tok[], private scope: Scope) {}
  private peek() { return this.toks[this.p]; }
  private next() { return this.toks[this.p++]; }
  private path(id: string): unknown {
    const parts = id.split('.');
    let cur: unknown = this.scope[parts[0]];
    for (let k = 1; k < parts.length; k++) { if (cur == null) return undefined; cur = (cur as Record<string, unknown>)[parts[k]]; }
    return cur;
  }
  parse(): unknown { const v = this.ternary(); if (this.p < this.toks.length) throw new Error('Unexpected token'); return v; }
  private ternary(): unknown {
    let c = this.binary(0);
    if (this.peek()?.v === '?') { this.next(); const a = this.ternary(); if (this.peek()?.v !== ':') throw new Error("Expected ':'"); this.next(); const b = this.ternary(); return c ? a : b; }
    return c;
  }
  private binary(min: number): unknown {
    let left = this.unary();
    while (this.peek()?.t === 'op' && PREC[this.peek().v] != null && PREC[this.peek().v] >= min) {
      const op = this.next().v; const right = this.binary(PREC[op] + 1);
      left = this.apply(op, left, right);
    }
    return left;
  }
  private unary(): unknown {
    const tk = this.peek();
    if (tk?.v === '!') { this.next(); return !this.unary(); }
    if (tk?.v === '-') { this.next(); return -(Number(this.unary()) || 0); }
    return this.postfix(this.primary());
  }
  private postfix(base: unknown): unknown {
    let val = base;
    while (this.peek()?.v === '[') { this.next(); const idx = this.ternary(); if (this.peek()?.v !== ']') throw new Error("Expected ']'"); this.next(); val = val == null ? undefined : (val as Record<string, unknown>)[String(idx)]; }
    return val;
  }
  private primary(): unknown {
    const tk = this.next();
    if (!tk) throw new Error('Unexpected end');
    if (tk.t === 'num') return parseFloat(tk.v);
    if (tk.t === 'str') return tk.v;
    if (tk.v === '(') { const v = this.ternary(); if (this.peek()?.v !== ')') throw new Error("Expected ')'"); this.next(); return v; }
    if (tk.t === 'id') {
      if (tk.v === 'true') return true; if (tk.v === 'false') return false; if (tk.v === 'null') return null;
      if (this.peek()?.v === '(') { // function call
        this.next(); const args: unknown[] = [];
        if (this.peek()?.v !== ')') { args.push(this.ternary()); while (this.peek()?.v === ',') { this.next(); args.push(this.ternary()); } }
        if (this.peek()?.v !== ')') throw new Error("Expected ')'"); this.next();
        const fn = FN[tk.v]; if (!fn) throw new Error(`Unknown function '${tk.v}'`);
        return fn(...args);
      }
      return this.path(tk.v);
    }
    throw new Error(`Unexpected '${tk.v}'`);
  }
  private apply(op: string, a: unknown, b: unknown): unknown {
    switch (op) {
      case '||': return a || b; case '&&': return a && b;
      case '==': return a === b; case '!=': return a !== b;
      case '<': return (a as number) < (b as number); case '<=': return (a as number) <= (b as number);
      case '>': return (a as number) > (b as number); case '>=': return (a as number) >= (b as number);
      case '+': return (typeof a === 'string' || typeof b === 'string') ? String(a ?? '') + String(b ?? '') : (Number(a) || 0) + (Number(b) || 0);
      case '-': return (Number(a) || 0) - (Number(b) || 0);
      case '*': return (Number(a) || 0) * (Number(b) || 0);
      case '/': return (Number(b) || 0) === 0 ? 0 : (Number(a) || 0) / (Number(b) || 0);
      case '%': return (Number(b) || 0) === 0 ? 0 : (Number(a) || 0) % (Number(b) || 0);
      default: return undefined;
    }
  }
}

/** Evaluate an expression against a scope. Never throws — returns {ok,value,error}. */
export function evaluate(expr: string, scope: Scope = {}): EvalResult {
  const src = (expr ?? '').trim();
  if (!src) return { ok: true, value: '' };
  try { return { ok: true, value: new Parser(lex(src), scope).parse() }; }
  catch (e) { return { ok: false, value: undefined, error: (e as Error).message }; }
}

/** Validate an expression parses. */
export function validateExpression(expr: string): { valid: boolean; error?: string } {
  const r = evaluate(expr, {});
  return r.ok ? { valid: true } : { valid: false, error: r.error };
}

/** Interpolate a string containing {{ expr }} segments against a scope. */
export function interpolate(str: string, scope: Scope = {}): string {
  return String(str ?? '').replace(/\{\{([^}]+)\}\}/g, (_m, e) => {
    const r = evaluate(String(e), scope);
    return r.ok && r.value != null ? String(r.value) : '';
  });
}

/** Does a string contain a binding expression? */
export function hasBinding(str: unknown): boolean { return typeof str === 'string' && /\{\{[^}]+\}\}/.test(str); }
