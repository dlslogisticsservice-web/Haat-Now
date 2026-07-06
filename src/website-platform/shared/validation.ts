// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Dependency-free validation kernel (Wave 0).
// Small, typed validators + type guards used by DTO validation, event payload
// checks, and contract tests. No external schema library (keeps the bundle lean).
// ─────────────────────────────────────────────────────────────────────────────

import type { Result, WebsitePlatformError } from './types';
import { ok, err } from './types';
import { errors } from './errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function isString(v: unknown): v is string {
  return typeof v === 'string';
}
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}
export function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
export function isSlug(v: unknown): v is string {
  return typeof v === 'string' && SLUG_RE.test(v) && v.length <= 120;
}
export function isHostname(v: unknown): v is string {
  return typeof v === 'string' && HOST_RE.test(v);
}
export function isOneOf<T extends string>(allowed: ReadonlyArray<T>): (v: unknown) => v is T {
  return (v: unknown): v is T => typeof v === 'string' && (allowed as ReadonlyArray<string>).includes(v);
}

/** A field-level validation issue. */
export interface ValidationIssue {
  field: string;
  rule: string;
}

/** Accumulates issues and produces a Result. */
export class Validator {
  private readonly issues: ValidationIssue[] = [];

  check(condition: boolean, field: string, rule: string): this {
    if (!condition) this.issues.push({ field, rule });
    return this;
  }

  require(value: unknown, field: string): this {
    return this.check(value !== undefined && value !== null && value !== '', field, 'required');
  }

  field<T>(value: unknown, field: string, guard: (v: unknown) => v is T, rule: string): this {
    return this.check(guard(value), field, rule);
  }

  get valid(): boolean {
    return this.issues.length === 0;
  }

  toResult<T>(value: T): Result<T, WebsitePlatformError> {
    if (this.valid) return ok(value);
    const first = this.issues[0];
    return err(errors.validation(`Invalid ${first.field}: ${first.rule}`, { field: first.field, rule: first.rule, count: this.issues.length }));
  }

  list(): ReadonlyArray<ValidationIssue> {
    return this.issues;
  }
}
