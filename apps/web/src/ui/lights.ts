/**
 * "Tắt đèn": the lamplit look for reading in a dark room. The choice is Truyện's own (localStorage), never the
 * shared hoandat.com theme cookie: the night look of another app should not dim this one, nor the other way
 * round. With no choice saved, the device's dark mode turns the lights off. public/theme-init.js applies the
 * same rule before the first paint.
 */
import { useSyncExternalStore } from 'react';

export const LIGHTS_KEY = 'truyen:lights';
export type Lights = 'on' | 'off';

const listeners = new Set<() => void>();

function systemDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** The saved choice, or null when there is none (or storage is blocked). */
export function savedLights(): Lights | null {
  try {
    const value = window.localStorage.getItem(LIGHTS_KEY);
    return value === 'on' || value === 'off' ? value : null;
  } catch {
    return null;
  }
}

export function currentLights(): Lights {
  const attribute = document.documentElement.getAttribute('data-theme');
  if (attribute === 'dark') return 'off';
  if (attribute === 'light') return 'on';
  return savedLights() ?? (systemDark() ? 'off' : 'on');
}

export function setLights(lights: Lights): void {
  document.documentElement.setAttribute('data-theme', lights === 'off' ? 'dark' : 'light');
  try {
    window.localStorage.setItem(LIGHTS_KEY, lights);
  } catch (error) {
    // Still applied for this visit; only remembering it failed.
    console.warn('lights choice not saved', error instanceof Error ? error.name : typeof error);
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLights(): Lights {
  return useSyncExternalStore(subscribe, currentLights, () => 'on');
}
