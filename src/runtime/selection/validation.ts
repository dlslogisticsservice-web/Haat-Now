// ─────────────────────────────────────────────────────────────────────────────
// Runtime Edit Validation (Phase 8G · Edit Transaction Engine).
//
// A pure, framework-free validator: given an editable-property spec and a candidate value,
// it decides whether the value is admissible. The Edit Transaction Engine runs this BEFORE a
// transaction is allowed to become Dirty and projected onto the live runtime — an invalid
// value is recorded (so the Inspector can show the error) but never applied, so the runtime
// stays stable and a rejected edit leaves it unchanged.
//
// No DOM, no React, no persistence. Type-aware: text / image URL / color / boolean, plus the
// declared rules (required, min/max length, pattern). Order matters — the first failing rule
// wins so the Inspector shows one clear, actionable message.
// ─────────────────────────────────────────────────────────────────────────────
import type { EditablePropSpec } from '../StudioMetadata';

export interface ValidationResult {
  valid: boolean;
  /** Human-facing reason the value was rejected (empty when valid). */
  error: string;
}

const OK: ValidationResult = { valid: true, error: '' };
const fail = (error: string): ValidationResult => ({ valid: false, error });

// A URL we can actually put on an <img>: http(s), protocol-relative, data or blob.
const IMAGE_URL = /^(https?:\/\/|\/\/|\/|data:image\/|blob:)/i;
// A CSS color the theme can accept: hex, rg[b]a(), hsl[a](), or a bare CSS keyword.
const COLOR = /^(#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)$/i;

/** Validate a candidate value for one editable property. Pure — same input, same result. */
export function validateValue(prop: EditablePropSpec, value: string | boolean): ValidationResult {
  // Booleans are always structurally valid — a toggle can only be on or off.
  if (prop.type === 'boolean') return OK;

  const v = prop.validation ?? {};
  const s = typeof value === 'string' ? value : String(value ?? '');
  const trimmed = s.trim();

  if (v.required && trimmed === '') return fail('Required — value cannot be empty');
  // An empty, non-required value is valid (clears the field) — skip the remaining checks.
  if (trimmed === '') return OK;

  if (v.minLength != null && s.length < v.minLength) return fail(`Too short — min ${v.minLength} characters`);
  if (v.maxLength != null && s.length > v.maxLength) return fail(`Too long — max ${v.maxLength} characters`);
  if (v.pattern) {
    let re: RegExp | null = null;
    try { re = new RegExp(v.pattern); } catch { re = null; }
    if (re && !re.test(s)) return fail('Invalid format');
  }

  if (prop.type === 'image' && !IMAGE_URL.test(trimmed)) return fail('Invalid image URL');
  if (prop.type === 'color' && !COLOR.test(trimmed)) return fail('Invalid color value');

  return OK;
}
