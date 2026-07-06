// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · PWA (Wave 3, Part 9).
// Config-driven, per-tenant PWA: manifest + service-worker generators, an install-prompt
// controller (when/whether to show `beforeinstallprompt`), and offline / push-ready /
// background-sync-ready helpers. Pure + isomorphic; the browser event is injected.
// Reusable by every tenant (brand-driven manifest/theme).
// ─────────────────────────────────────────────────────────────────────────────

import type { JsonObject } from '../domain/entities';

export interface PwaIcon { src: string; sizes: string; type: string; purpose?: string }
export interface PwaManifestConfig {
  name: string;
  shortName: string;
  description?: string;
  themeColor: string;
  backgroundColor: string;
  startUrl?: string;
  display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser';
  icons: PwaIcon[];
  lang?: string;
  dir?: 'ltr' | 'rtl';
}

/** Build a web app manifest object (serialize to manifest.webmanifest). */
export function buildManifest(config: PwaManifestConfig): JsonObject {
  return {
    name: config.name,
    short_name: config.shortName,
    description: config.description ?? config.name,
    start_url: config.startUrl ?? '/',
    display: config.display ?? 'standalone',
    theme_color: config.themeColor,
    background_color: config.backgroundColor,
    lang: config.lang ?? 'en',
    dir: config.dir ?? 'ltr',
    icons: config.icons.map(i => ({ src: i.src, sizes: i.sizes, type: i.type, ...(i.purpose ? { purpose: i.purpose } : {}) })),
  };
}

export interface ServiceWorkerConfig {
  cacheName: string;              // versioned per deploy
  precacheUrls: string[];        // app shell + critical assets
  offlineUrl: string;            // fallback page for navigations
}

/**
 * Generate a service-worker source (string) implementing: precache app shell,
 * cache-first for static assets, network-first for navigations with an offline fallback,
 * and stubs that are PUSH-ready + BACKGROUND-SYNC-ready (listeners registered, wired later).
 */
export function buildServiceWorker(config: ServiceWorkerConfig): string {
  const cache = JSON.stringify(config.cacheName);
  const precache = JSON.stringify(config.precacheUrls);
  const offline = JSON.stringify(config.offlineUrl);
  return [
    `const CACHE = ${cache};`,
    `const PRECACHE = ${precache};`,
    `const OFFLINE = ${offline};`,
    `self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())); });`,
    `self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });`,
    `self.addEventListener('fetch', e => {`,
    `  const req = e.request; if (req.method !== 'GET') return;`,
    `  if (req.mode === 'navigate') { e.respondWith(fetch(req).catch(() => caches.match(OFFLINE))); return; }`,
    `  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; }).catch(() => caches.match(OFFLINE))));`,
    `});`,
    `// Push-ready: shows a notification when a push arrives (wired to a provider later).`,
    `self.addEventListener('push', e => { const d = (() => { try { return e.data ? e.data.json() : {}; } catch { return {}; } })(); e.waitUntil(self.registration.showNotification(d.title || 'HaaT Now', { body: d.body || '', icon: d.icon })); });`,
    `// Background-sync-ready: drains a queued action tag when connectivity returns.`,
    `self.addEventListener('sync', e => { if (e.tag === 'haat-sync') { /* drain queue in a later wave */ } });`,
  ].join('\n');
}

// ── Install prompt controller ──────────────────────────────────────────────────────
export interface InstallPromptEvent {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export interface InstallPromptConfig {
  enabled: boolean;
  minVisits?: number;            // don't prompt before N visits
  minSecondsOnSite?: number;     // don't prompt before N seconds
}
export interface InstallContext { visits: number; secondsOnSite: number; alreadyInstalled: boolean }

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable' | 'ineligible';

/** Manages the deferred `beforeinstallprompt` event + config-driven eligibility. */
export class InstallPromptController {
  private deferred: InstallPromptEvent | null = null;
  constructor(private readonly config: InstallPromptConfig) {}

  /** Call from the `beforeinstallprompt` handler (after preventDefault). */
  capture(event: InstallPromptEvent): void {
    this.deferred = event;
  }

  /** Whether to surface the install CTA now. */
  shouldShow(ctx: InstallContext): boolean {
    if (!this.config.enabled || ctx.alreadyInstalled || !this.deferred) return false;
    if (this.config.minVisits !== undefined && ctx.visits < this.config.minVisits) return false;
    if (this.config.minSecondsOnSite !== undefined && ctx.secondsOnSite < this.config.minSecondsOnSite) return false;
    return true;
  }

  /** Trigger the native install prompt (from a user gesture). */
  async prompt(): Promise<InstallOutcome> {
    if (!this.config.enabled) return 'ineligible';
    if (!this.deferred) return 'unavailable';
    await this.deferred.prompt();
    const choice = await this.deferred.userChoice;
    this.deferred = null;
    return choice.outcome;
  }
}

/** Feature detection — safe under Node + browser. */
export function pwaCapabilities(nav?: { serviceWorker?: unknown }, win?: Record<string, unknown>): { serviceWorker: boolean; push: boolean; backgroundSync: boolean } {
  const navigatorObj = nav ?? (typeof navigator !== 'undefined' ? (navigator as unknown as { serviceWorker?: unknown }) : undefined);
  const windowObj = win ?? (typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined);
  return {
    serviceWorker: !!navigatorObj && 'serviceWorker' in navigatorObj,
    push: !!windowObj && 'PushManager' in windowObj,
    backgroundSync: !!windowObj && 'SyncManager' in windowObj,
  };
}
