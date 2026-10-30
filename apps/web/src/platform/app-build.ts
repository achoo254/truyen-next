/**
 * Which build is running: the website, or the iPhone app (`vite build --mode native`, apps/mobile). Constants of the
 * build, so the web bundle drops the app-only code (Capacitor, downloads, the parental gate) altogether.
 */
import { primaryOrigin } from '@achoo254/brand/hosts';
import { brand } from '../brand';

/** True in the iPhone app's build; false on the web and in tests. */
export const IN_APP: boolean = import.meta.env.MODE === 'native';

/**
 * Where the story files are read from: '' on the web (this site) and in a test app with its stories packed in, the
 * site's origin (https://truyen.hoandat.com) in the app.
 */
export const STORY_ORIGIN: string = import.meta.env.VITE_TRUYEN_STORY_ORIGIN ?? '';

/** The address a page of the app has on the web, to share: the page's own on the site, the site's in the app. */
export function publicUrl(path: string, inApp: boolean = IN_APP): string {
  const origin = inApp || typeof window === 'undefined' ? primaryOrigin(brand) : window.location.origin;
  return `${origin}${path}`;
}

/** `/da-tai`: the stories kept on the phone (iPhone app only). */
export const DOWNLOADS_PATH = '/da-tai';
