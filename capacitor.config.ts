import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trunotes.v2',
  appName: 'TruNotes v2',
  webDir: 'dist',
  backgroundColor: '#0f172a',
  android: {
    backgroundColor: '#0f172a'
  },
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
