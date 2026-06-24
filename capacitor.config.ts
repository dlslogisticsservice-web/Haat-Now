import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor configuration — HAAT NOW.
 * Native shells (android/ ios/) are generated with `npx cap add android` / `npx cap add ios`
 * after a web build (`npm run build` -> dist/). Bundle id is reverse-DNS and must match the
 * Play Console / App Store Connect records before signing.
 */
const config: CapacitorConfig = {
  appId: 'com.haatnow.app',
  appName: 'HAAT NOW',
  webDir: 'dist',
  backgroundColor: '#060a0e',
  android: {
    allowMixedContent: false, // cleartext disabled (HTTPS-only)
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#060a0e',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#060a0e',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
