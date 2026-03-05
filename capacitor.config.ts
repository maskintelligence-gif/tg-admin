import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.toorogadgets.admin',
  appName: 'TG Admin',
  webDir: 'dist',
  // When running on device, talk directly to Supabase (no local server needed)
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true to debug via Chrome DevTools
  },
  plugins: {
    // SplashScreen config (if you add @capacitor/splash-screen later)
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#080d1a',
      showSpinner: false,
    },
    // StatusBar config
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#080d1a',
    },
  },
};

export default config;
