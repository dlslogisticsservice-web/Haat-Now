// App version + semver comparison for the force-update gate.
// Bump APP_VERSION on each release; the store-side `min_app_version` setting
// (public.settings) drives whether older installs are forced to update.
export const APP_VERSION = '1.0.0';

/** True if `current` is a lower semantic version than `min` (e.g. 1.0.0 < 1.1.0). */
export function isVersionBelow(current: string, min: string): boolean {
  const norm = (v: string) => v.replace(/[^0-9.].*$/, '').split('.').map(n => parseInt(n, 10) || 0);
  const a = norm(current), b = norm(min);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}
