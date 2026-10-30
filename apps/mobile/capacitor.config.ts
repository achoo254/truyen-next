import type { CapacitorConfig } from '@capacitor/cli';
import brand from '../../brand.config.json' with { type: 'json' };

/**
 * The iPhone app around the app build of the web app (`pnpm mobile:build`: `vite build --mode native` into
 * apps/web/dist-native, then `cap sync`). Its page runs at capacitor://localhost; the stories and their media come
 * from https://truyen.hoandat.com. CapacitorHttp sends the page's fetch() calls to other origins through the app
 * (the site sends no CORS headers and needs none), and the pictures and sound load as plain media. Downloaded stories
 * play from the phone (apps/web/src/native/downloads.ts).
 */
const config: CapacitorConfig = {
  appId: brand.appIds.ios,
  appName: brand.appName,
  webDir: '../web/dist-native',
  ios: {
    // The page draws under the notch and the home bar itself (viewport-fit=cover, safe-area paddings).
    contentInset: 'never',
    backgroundColor: brand.colors.background,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
};

export default config;
