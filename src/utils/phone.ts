// ─────────────────────────────────────────────────────────────────────────────
// Production phone normalization → E.164.
// Examples:
//   Egypt  01012345678 -> +201012345678
//   Saudi  0501234567   -> +966501234567
// National numbers are prefixed with the active country's dial code (leading
// zeros stripped). Numbers already in +<cc> / 00<cc> form are preserved.
// ─────────────────────────────────────────────────────────────────────────────
import { getCountry, type CountryCode } from '../config/countries';

const COUNTRY_STORAGE_KEY = 'haat_country';

function activeCountryCode(override?: CountryCode): string | null {
  if (override) return override;
  if (typeof localStorage !== 'undefined') return localStorage.getItem(COUNTRY_STORAGE_KEY);
  return null;
}

/** Convert any user-entered phone string to E.164 (e.g. "+201012345678"). */
export function toE164(raw: string, countryCode?: CountryCode): string {
  let s = (raw || '').trim().replace(/[\s\-().]/g, '');
  if (!s) return '';
  if (s.startsWith('00')) s = '+' + s.slice(2);              // 0020... -> +20...
  if (s.startsWith('+')) return '+' + s.slice(1).replace(/\D/g, '');

  // National format → prepend the active country's dial code, drop leading zeros.
  const country = getCountry(activeCountryCode(countryCode));
  const national = s.replace(/\D/g, '').replace(/^0+/, '');
  return `${country.dialCode}${national}`;
}

/** Strict E.164 validity check. */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}
