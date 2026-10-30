/**
 * Types for page-flip 2.0.7 (StPageFlip, MIT), which ships no declarations. Only what the reader uses, written from
 * the library's source (src/PageFlip.ts, src/Settings.ts, src/Render/Render.ts of that version).
 */
declare module 'page-flip/dist/js/page-flip.module.js' {
  /** `user_fold`: a finger or the mouse holds the page; `fold_corner`: the pointer hovers a corner; `flipping`: animating. */
  export type FlippingState = 'user_fold' | 'fold_corner' | 'flipping' | 'read';
  export type FlipCorner = 'top' | 'bottom';
  export type Orientation = 'portrait' | 'landscape';

  export interface FlipSetting {
    startPage: number;
    size: 'fixed' | 'stretch';
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    drawShadow: boolean;
    flippingTime: number;
    usePortrait: boolean;
    startZIndex: number;
    autoSize: boolean;
    maxShadowOpacity: number;
    showCover: boolean;
    mobileScrollSupport: boolean;
    clickEventForward: boolean;
    useMouseEvents: boolean;
    swipeDistance: number;
    showPageCorners: boolean;
    disableFlipByClick: boolean;
  }

  /** The book's area inside its block: `width` is two pages wide even in portrait (the left one is off screen). */
  export interface PageRect {
    left: number;
    top: number;
    width: number;
    height: number;
    pageWidth: number;
  }

  /** `data` is a page index (`flip`), a state (`changeState`), an orientation (`changeOrientation`) or an object (`init`). */
  export interface WidgetEvent {
    data: number | string | boolean | object | null;
    object: PageFlip;
  }

  /**
   * The renderer. `drawFrame` is protected in the library and runs on every animation frame for as long as the page
   * lives (the loop has no stop); the reader wraps it so an idle book does no work.
   */
  export interface Render {
    drawFrame(): void;
    finishAnimation(): void;
  }

  export class PageFlip {
    constructor(inBlock: HTMLElement, setting: Partial<FlipSetting>);
    loadFromHTML(items: HTMLElement[]): void;
    on(eventName: 'flip' | 'changeState' | 'changeOrientation' | 'init' | 'update', callback: (event: WidgetEvent) => void): PageFlip;
    off(eventName: string): void;
    /** Turns to a page with the animation (from the spread next to it, for a jump). */
    flip(page: number, corner?: FlipCorner): void;
    /** Shows a page at once, without animation. */
    turnToPage(page: number): void;
    update(): void;
    destroy(): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getOrientation(): Orientation;
    getBoundsRect(): PageRect;
    getSettings(): FlipSetting;
    getState(): FlippingState;
    getRender(): Render;
  }
}
