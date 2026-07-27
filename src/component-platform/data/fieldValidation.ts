// ─────────────────────────────────────────────────────────────────────────────
// Entity Field Validation (Phase 9D).
//
// Declarative, per-field validation rules + a pure validateRecord() that reuses the ONE
// expression engine for conditional / cross-field / custom rules. No second validation system —
// this layers on the 9C data model. Messages are localizable (en + ar).
// ─────────────────────────────────────────────────────────────────────────────
import { evaluate } from '../logic/expression';
import type { Entity, DataRecord } from './dataModel';

export type ValidationRule =
  | 'required' | 'nullable' | 'unique' | 'minLength' | 'maxLength' | 'regex'
  | 'email' | 'phone' | 'url' | 'range' | 'enum' | 'date' | 'time' | 'currency'
  | 'file' | 'image' | 'conditional' | 'crossField' | 'custom';

export const VALIDATION_RULES: ValidationRule[] = [
  'required', 'nullable', 'unique', 'minLength', 'maxLength', 'regex', 'email', 'phone', 'url',
  'range', 'enum', 'date', 'time', 'currency', 'file', 'image', 'conditional', 'crossField', 'custom',
];

export interface FieldValidation {
  id: string;
  rule: ValidationRule;
  /** Rule argument: length/regex/range "min,max"/enum "a,b,c"/expression for conditional/custom. */
  value?: string;
  /** Only apply when this expression (over the record + ctx) is truthy (conditional). */
  when?: string;
  message?: string;
  messageAr?: string;
}

export interface ValidationError { field: string; rule: ValidationRule; message: string; }

const RX = {
  email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/,
  phone: /^\+?[0-9\s-]{7,15}$/,
  url: /^(https?:\/\/|\/)[^\s]+$/i,
  image: /\.(png|jpe?g|gif|webp|svg|avif)$/i,
  date: /^\d{4}-\d{2}-\d{2}$/,
  time: /^\d{2}:\d{2}(:\d{2})?$/,
};

/** Validate one record against an entity's field validations. Pure; null-safe. */
export function validateRecord(entity: Entity, record: DataRecord, opts: { all?: DataRecord[]; lang?: 'ar' | 'en'; scope?: Record<string, unknown> } = {}): ValidationError[] {
  const errors: ValidationError[] = [];
  const all = opts.all || [];
  const lang = opts.lang || 'en';
  const scope = { ...(opts.scope || {}), record, rec: record };
  const msg = (v: FieldValidation, fallback: string) => (lang === 'ar' ? v.messageAr : v.message) || v.message || fallback;

  for (const f of entity.fields) {
    for (const v of f.validations || []) {
      // Conditional gate: skip unless `when` is truthy.
      if (v.when) { const w = evaluate(v.when, scope); if (!(w.ok && w.value)) continue; }
      const raw = record[f.name];
      const s = raw == null ? '' : String(raw);
      const n = Number(raw);
      const push = (fallback: string) => errors.push({ field: f.name, rule: v.rule, message: msg(v, fallback) });
      switch (v.rule) {
        case 'required': if (s.trim() === '') push(`${f.name} is required`); break;
        case 'nullable': break; // informational
        case 'unique': if (s !== '' && all.filter(r => r.id !== record.id && String(r[f.name] ?? '') === s).length) push(`${f.name} must be unique`); break;
        case 'minLength': if (s !== '' && s.length < Number(v.value)) push(`${f.name} min ${v.value} chars`); break;
        case 'maxLength': if (s.length > Number(v.value)) push(`${f.name} max ${v.value} chars`); break;
        case 'regex': if (s !== '' && v.value) { try { if (!new RegExp(v.value).test(s)) push(`${f.name} invalid format`); } catch { /* bad regex ignored */ } } break;
        case 'email': if (s !== '' && !RX.email.test(s)) push(`${f.name} invalid email`); break;
        case 'phone': if (s !== '' && !RX.phone.test(s)) push(`${f.name} invalid phone`); break;
        case 'url': if (s !== '' && !RX.url.test(s)) push(`${f.name} invalid URL`); break;
        case 'range': { const [lo, hi] = (v.value || '').split(',').map(x => Number(x.trim())); if (s !== '' && (n < lo || n > hi)) push(`${f.name} out of range (${v.value})`); break; }
        case 'enum': if (s !== '' && !(v.value || '').split(',').map(x => x.trim()).includes(s)) push(`${f.name} not an allowed value`); break;
        case 'date': if (s !== '' && !RX.date.test(s)) push(`${f.name} invalid date (YYYY-MM-DD)`); break;
        case 'time': if (s !== '' && !RX.time.test(s)) push(`${f.name} invalid time (HH:MM)`); break;
        case 'currency': if (s !== '' && !Number.isFinite(n)) push(`${f.name} invalid amount`); break;
        case 'file': if (s !== '' && !/\.[a-z0-9]{2,5}$/i.test(s)) push(`${f.name} invalid file`); break;
        case 'image': if (s !== '' && !RX.image.test(s)) push(`${f.name} not an image`); break;
        case 'crossField': case 'custom': case 'conditional': { if (v.value) { const r = evaluate(v.value, scope); if (r.ok && !r.value) push(`${f.name} failed validation`); } break; }
        default: break;
      }
    }
  }
  return errors;
}

let vseq = 0;
export const vid = () => `v_${Date.now().toString(36)}_${++vseq}`;
