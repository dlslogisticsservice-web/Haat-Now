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

// Website Runtime: when the request targets a tenant website (?site=<slug> in sandbox/dev, or a
// subdomain / custom domain in production) render the public site instead of the role apps. Additive —
// the default host/path is unchanged, so the existing apps and the E2E suite are untouched.
const publicReq = resolvePublicRequest(window.location);
// In sandbox, ensure demo tenants exist so a slug resolves to a real branded tenant (idempotent).
if (publicReq.isPublicSite && import.meta.env.VITE_AUTH_MODE === 'sandbox') {
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
          {publicReq.isPublicSite ? (
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
