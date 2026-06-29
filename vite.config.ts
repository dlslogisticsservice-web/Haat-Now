import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // The platform ships as a SELF-CONTAINED DEMO (all accounts/data/lifecycle live client-side).
  // Force sandbox at build time so production can never hit a backend it was not provisioned for
  // (no 403/401/realtime errors). `.env*` is gitignored, so the deployed build has no env files and
  // would otherwise fall back to whatever the host injects. A real backend deploy opts in explicitly
  // with HAAT_LIVE_BACKEND=1. This define is the single committed source of truth for the auth mode.
  const authMode = process.env.HAAT_LIVE_BACKEND === '1' ? 'supabase' : 'sandbox';
  return {
    define: {
      'import.meta.env.VITE_AUTH_MODE': JSON.stringify(authMode),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Phase I — bundle optimization. Split large vendors into separately-cached,
      // parallel-loaded chunks so the entry chunk stays small (< 500 KB) and vendor
      // code is cached across app deploys.
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-i18n': ['i18next', 'react-i18next'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
