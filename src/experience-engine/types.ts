// ─────────────────────────────────────────────────────────────────────────────
// Experience Engine · shared primitive types.
//
// PURE foundation. This module — and the entire src/experience-engine tree — imports
// nothing from React, the DOM, Supabase, features, or services. It is a self-contained
// library of contracts, exactly like src/guardian/kernel. Nothing here runs business
// logic; it defines the vocabulary the platform is built on.
//
// The repo has NO strictNullChecks, so discriminated unions do not narrow via `if (r.ok)`.
// The Result idiom below uses type-predicate guards (isOk/isErr), matching the existing
// website-platform / guardian convention.
// ─────────────────────────────────────────────────────────────────────────────

/** Stable identifiers. `(string & {})` keeps the known union while allowing future values. */
export type ExperienceId = string;
export type ComponentId = string;
export type TenantId = string;
export type ChannelId = 'website' | 'customer' | 'driver' | 'merchant' | 'affiliate' | 'partner' | 'admin' | (string & {});
export type RoleId = 'guest' | 'customer' | 'driver' | 'merchant' | 'affiliate' | 'partner' | 'admin' | 'super_admin' | (string & {});

export type LocaleCode = 'ar' | 'en' | (string & {});
export type TextDirection = 'rtl' | 'ltr';
export type DeviceKind = 'mobile' | 'tablet' | 'desktop' | 'kiosk' | 'tv' | 'car' | 'wearable' | 'voice' | 'ar' | 'vr' | (string & {});
export type PlatformKind = 'web' | 'ios' | 'android' | 'native' | (string & {});
export type Environment = 'production' | 'staging' | 'development' | 'sandbox';

/** Semantic version, e.g. "1.4.0". */
export type SemVer = string;
/** ISO-8601 timestamp. */
export type Timestamp = string;

/** JSON value — the wire shape for configs, schemas and metadata. */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// ── Result (predicate-guarded; no strictNullChecks in this repo) ───────────────
export interface Ok<T> { readonly ok: true; readonly value: T }
export interface Err<E> { readonly ok: false; readonly error: E }
export type Result<T, E = string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok === true;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r.ok === false;
