// ─────────────────────────────────────────────────────────────────────────────
// Notification preferences — the single authority for "may we notify this user?".
//
// It EXTENDS the preferences ProfileScreen already persists at `haat_notif_prefs`
// ({orders, offers, news}); it does not fork them. Older stored values load cleanly and
// gain sensible defaults for the new fields (master enable, quiet hours, language), so
// nothing is lost and there is one preferences shape, not two.
//
// The decision functions (isInQuietHours, isAllowed) are PURE — they take the clock in —
// so the delivery pipeline and tests reach the same verdict. Only load/save touch storage.
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationCategory = 'orders' | 'offers' | 'news';

export interface QuietHours {
  enabled: boolean;
  /** Local-time hours [0..23]. A window may wrap midnight (start > end). */
  startHour: number;
  endHour: number;
}

export interface NotificationPreferences {
  /** Master switch. When false, nothing is delivered regardless of category. */
  enabled: boolean;
  categories: Record<NotificationCategory, boolean>;
  quietHours: QuietHours;
  /** Preferred content language; defaults to the app language. Metadata for rendering. */
  language: 'ar' | 'en';
}

export const NOTIF_PREFS_KEY = 'haat_notif_prefs';

/** Transactional categories bypass quiet hours — "your driver arrived" must not be silenced. */
export const QUIET_HOURS_EXEMPT: readonly NotificationCategory[] = ['orders'];

export const defaultPreferences = (language: 'ar' | 'en' = 'ar'): NotificationPreferences => ({
  enabled: true,
  categories: { orders: true, offers: true, news: false },
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
  language,
});

/**
 * Load preferences, upgrading any legacy `{orders, offers, news}` blob in place. Unknown
 * or missing fields fall back to defaults — a stored subset never disables the new fields.
 */
export function loadPreferences(language: 'ar' | 'en' = 'ar'): NotificationPreferences {
  const base = defaultPreferences(language);
  if (typeof localStorage === 'undefined') return base;
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
      categories: {
        orders: typeof raw.orders === 'boolean' ? raw.orders : raw.categories?.orders ?? base.categories.orders,
        offers: typeof raw.offers === 'boolean' ? raw.offers : raw.categories?.offers ?? base.categories.offers,
        news: typeof raw.news === 'boolean' ? raw.news : raw.categories?.news ?? base.categories.news,
      },
      quietHours: {
        enabled: raw.quietHours?.enabled ?? base.quietHours.enabled,
        startHour: clampHour(raw.quietHours?.startHour, base.quietHours.startHour),
        endHour: clampHour(raw.quietHours?.endHour, base.quietHours.endHour),
      },
      language: raw.language === 'en' || raw.language === 'ar' ? raw.language : base.language,
    };
  } catch {
    return base;
  }
}

/** Persist while STAYING backward-compatible: the flat category keys ProfileScreen reads
 *  are written alongside the structured fields, so neither view breaks the other. */
export function savePreferences(prefs: NotificationPreferences): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify({
      // legacy flat keys (ProfileScreen)
      orders: prefs.categories.orders, offers: prefs.categories.offers, news: prefs.categories.news,
      // structured superset (this module)
      enabled: prefs.enabled, categories: prefs.categories, quietHours: prefs.quietHours, language: prefs.language,
    }));
  } catch { /* quota — ignore */ }
}

const clampHour = (v: unknown, fallback: number): number =>
  typeof v === 'number' && v >= 0 && v <= 23 ? Math.floor(v) : fallback;

/** Is `date` inside the quiet-hours window (handles windows that wrap midnight)? */
export function isInQuietHours(q: QuietHours, date: Date): boolean {
  if (!q.enabled) return false;
  const h = date.getHours();
  if (q.startHour === q.endHour) return false;          // zero-length window
  return q.startHour < q.endHour
    ? h >= q.startHour && h < q.endHour                 // same-day window
    : h >= q.startHour || h < q.endHour;                // wraps midnight
}

/** May we deliver a message of `category` to this user right now? */
export function isAllowed(prefs: NotificationPreferences, category: NotificationCategory, date: Date): boolean {
  if (!prefs.enabled) return false;                     // master off
  if (!prefs.categories[category]) return false;        // category muted
  if (isInQuietHours(prefs.quietHours, date) && !QUIET_HOURS_EXEMPT.includes(category)) return false;
  return true;
}
