import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { DesignProvider } from './design/DesignContext';
import { ExperienceProvider } from './experience/ExperienceContext';
import { MISSING_SUPABASE_VARS } from './lib/supabase';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {MISSING_SUPABASE_VARS.length > 0 ? (
      <MissingConfigScreen vars={MISSING_SUPABASE_VARS} />
    ) : (
      <AppConfigProvider>
        <DesignProvider>
          <ExperienceProvider>
            <App />
          </ExperienceProvider>
        </DesignProvider>
      </AppConfigProvider>
    )}
  </StrictMode>,
);
