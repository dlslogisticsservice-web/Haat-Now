import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { DesignProvider } from './design/DesignContext';
import { ExperienceProvider } from './experience/ExperienceContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MISSING_SUPABASE_VARS } from './lib/supabase';
import { APP_VERSION } from './config/version';
import { PublicSiteApp } from './features/website/PublicSiteApp';
import { resolvePublicRequest } from './features/website/runtime';

// Runtime entry point: the FLAGSHIP marketing website is the canonical public root — `/` renders the
// website; the role application (customer/merchant/driver/admin) is a first-class route under `/app`.
// Tenant websites resolve by subdomain / custom domain (or `?site=<slug>` in dev). See runtime.ts.
const publicReq = resolvePublicRequest(window.location);
// Native shells (Capacitor iOS/Android) ARE the customer application — they package the role app and must
// always render it, never the marketing website, even though their runtime host is `localhost`.
const isNativeApp = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
const showPublicSite = publicReq.isPublicSite && !isNativeApp;
// In sandbox, ensure demo tenants exist so a slug resolves to a real branded tenant (idempotent).
if (showPublicSite && import.meta.env.VITE_AUTH_MODE === 'sandbox') {
  import('./services/demoSeed').then(m => { try { m.seedDemoData(); } catch { /* best-effort */ } });
}

function MissingConfigScreen({ vars }: { vars: string[] }) {
  return (
    <div style={{ minHeight: '100vh', background: '#10150b', color: '#dfe5d4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', padding: '2rem', textAlign: 'center' }}>
      <h1 style={{ color: '#a3f95b', fontSize: '1.5rem', marginBottom: '1rem' }}>⚠ Configuration Required</h1>
      <p style={{ marginBottom: '1rem', opacity: 0.8 }}>The following environment variables are missing from <code>.env</code>:</p>
      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
        {vars.map(v => <li key={v} style={{ color: '#f97316', padding: '0.25rem 0' }}>{v}</li>)}
      </ul>
      <p style={{ opacity: 0.6, fontSize: '0.875rem' }}>
        Create a <code>.env</code> file in the project root (next to <code>package.json</code>) and add the missing values, then restart the dev server.
      </p>
    </div>
  );
}

// Record the running application version (verifiable post-deploy via localStorage).
try { localStorage.setItem('haat_app_version', APP_VERSION); } catch { /* private mode */ }

// PWA service worker — production builds only (kept out of dev/E2E to avoid stale caching).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {MISSING_SUPABASE_VARS.length > 0 ? (
      <MissingConfigScreen vars={MISSING_SUPABASE_VARS} />
    ) : (
      <ErrorBoundary>
        <AppConfigProvider>
          {showPublicSite ? (
            // The public tenant site owns its own theme (the TENANT's brand, via applyBrand). It is mounted
            // OUTSIDE DesignProvider so the platform's published design cannot override the tenant brand — this
            // is what makes brand/theme changes propagate to each tenant website.
            <PublicSiteApp />
          ) : (
            <DesignProvider>
              <ExperienceProvider>
                <App />
              </ExperienceProvider>
            </DesignProvider>
          )}
        </AppConfigProvider>
      </ErrorBoundary>
    )}
  </StrictMode>,
);
