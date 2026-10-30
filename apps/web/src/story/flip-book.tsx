import { type FlippingState, PageFlip } from 'page-flip/dist/js/page-flip.module.js';
import { Fragment, type PointerEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type BookLayout, type Turn, edgeTap, firstPageOf, pagesPerSpread, spreadOfPage, spreadsNear, turnTo } from './book-pages';
import { TAP_MAX_PX } from './use-swipe';

/**
 * Lays a spread's two faces in the book: picture and text (or the two halves of the last page). On a phone both go
 * on one page, picture over text; from 880px each gets its own page.
 */
export type PlacePages = (first: ReactNode, second: ReactNode) => ReactNode;

/** What the book shows: the spread at rest under the reader's eyes, and whether a page is moving. */
export interface BookView {
  shown: number;
  /** A page is held by a finger or the mouse, or turning by itself. */
  busy: boolean;
}

/** A full turn of a wide page; the library shortens it for shorter travel (a phone page turns in about two thirds). */
const FLIP_MS = 900;
/** The library draws on every frame for as long as the page lives; the book only lets it draw while a page moves and a little after. */
const IDLE_TAIL_MS = FLIP_MS + 250;
/** Widest page: the phone book as before (520px), two pages of a 1100px spread. The ratio comes from the room there is. */
const MAX_PAGE_WIDTH: Record<BookLayout, number> = { single: 520, spread: 550 };
const SHADOW_OPACITY = 0.5;

const FLIPPING_STATES: readonly FlippingState[] = ['user_fold', 'fold_corner', 'flipping', 'read'];
const isFlippingState = (value: unknown): value is FlippingState => typeof value === 'string' && (FLIPPING_STATES as readonly string[]).includes(value);
/** States in which the book may be told to turn: at rest, or with a hovered corner folded. */
const atRest = (state: FlippingState): boolean => state === 'read' || state === 'fold_corner';

interface BookHooks {
  /** The spread the story is on (the player's state, the only source of truth). */
  target: () => number;
  /**
   * The reader turned the book (drag, swipe, corner tap) to the next or previous spread, now on show as `reached`.
   * The story's state follows on the next render; until then `target` must already answer `reached`, or the book
   * would turn itself back to where the story was a moment ago.
   */
  turned: (to: Turn, reached: number) => void;
  view: (view: BookView) => void;
}

interface OpenBook {
  /** Turn the book to the story's spread, if it is not there; waits for a turn in progress to end. */
  sync: () => void;
  /** The turn a tap at a client point asks for (an edge of the open book, outside the library's corners). */
  tap: (clientX: number, clientY: number) => Turn | null;
  close: () => void;
}

/** The size of one page in the room the host gives the book. */
function pageSize(host: HTMLElement, layout: BookLayout): { width: number; height: number } {
  const width = Math.min(host.clientWidth / pagesPerSpread(layout), MAX_PAGE_WIDTH[layout]);
  const height = host.clientHeight;
  // Not laid out yet: any upright page; the library refits it to the block on its first update.
  return width > 0 && height > 0 ? { width, height } : { width: 3, height: 4 };
}

/**
 * A static copy of a page the library makes to turn it on a phone: strip what must stay unique (ids, the live
 * subtitle region) and its motion, which would load again for a leaf that shows for a moment.
 */
function quietCopy(copy: HTMLElement): void {
  copy.inert = true;
  copy.setAttribute('aria-hidden', 'true');
  for (const element of [copy, ...copy.querySelectorAll('[data-id], [aria-live]')]) {
    element.removeAttribute('data-id');
    element.removeAttribute('aria-live');
  }
  for (const video of copy.querySelectorAll('video')) {
    video.removeAttribute('src');
    video.load();
  }
}

/**
 * Starts page-flip on the page containers inside `host`. The player's state leads: `sync` turns the book to it, and
 * a turn the reader makes on the book is reported once through `turned`, never applied to the book twice.
 */
function openBook(host: HTMLElement, pages: HTMLElement[], layout: BookLayout, hooks: BookHooks): OpenBook {
  const block = document.createElement('div');
  block.className = 'flip-root';
  host.append(block);
  const size = pageSize(host, layout);
  const book = new PageFlip(block, {
    size: 'stretch',
    width: size.width,
    height: size.height,
    // One page stays one page: the library goes to single-page mode when the block is under two minimum widths.
    minWidth: layout === 'single' ? MAX_PAGE_WIDTH.single : 100,
    maxWidth: MAX_PAGE_WIDTH[layout],
    minHeight: 100,
    maxHeight: 4000,
    usePortrait: layout === 'single',
    autoSize: false,
    showCover: false,
    startPage: firstPageOf(hooks.target(), layout),
    flippingTime: FLIP_MS,
    drawShadow: true,
    maxShadowOpacity: SHADOW_OPACITY,
    // Drag, swipe and a tap on a corner turn the page; a tap elsewhere is the reader's (edge taps are ours).
    disableFlipByClick: true,
    showPageCorners: true,
    useMouseEvents: true,
    clickEventForward: true,
    mobileScrollSupport: true,
  });

  let shown = hooks.target();
  let pending: number | null = null;
  let state: FlippingState = 'read';
  let disposed = false;
  let activeUntil = 0;
  let resized = false;
  // While the library loads it shows page 0 before the start page: those are not the reader's turns.
  let loading = true;
  const wake = (): void => {
    activeUntil = performance.now() + IDLE_TAIL_MS;
  };
  const report = (): void => hooks.view({ shown, busy: state === 'user_fold' || state === 'flipping' });

  const sync = (): void => {
    if (disposed || !atRest(state)) return;
    const goal = hooks.target();
    if (goal === shown) return;
    pending = goal;
    wake();
    const page = firstPageOf(goal, layout);
    // flip() starts the turn with a click the library makes itself near the corner; with disableFlipByClick it can
    // miss its own corner when the book does not touch the top of its block, so the check is off for that call.
    const settings = book.getSettings();
    settings.disableFlipByClick = false;
    try {
      book.flip(page, 'bottom');
    } finally {
      settings.disableFlipByClick = true;
    }
    // Refused (no size yet, or already there by the library's count): show the page at once.
    if (book.getState() !== 'flipping') book.turnToPage(page);
  };

  book.on('flip', (event) => {
    wake();
    if (loading || typeof event.data !== 'number') return;
    const reached = spreadOfPage(event.data, layout);
    shown = reached;
    if (pending === null) {
      const to = turnTo(hooks.target(), reached);
      if (to) hooks.turned(to, reached);
    } else {
      // The turn the story asked for has landed (or was cut short: the next sync goes on to the story's spread).
      pending = null;
    }
    report();
  });
  book.on('changeState', (event) => {
    wake();
    if (loading || !isFlippingState(event.data)) return;
    state = event.data;
    report();
    if (state !== 'read') return;
    if (resized) {
      resized = false;
      book.update();
    }
    sync();
  });
  book.on('changeOrientation', wake);
  book.on('init', wake);
  book.loadFromHTML(pages);
  loading = false;
  shown = spreadOfPage(book.getCurrentPageIndex(), layout);

  // An idle book does no work: the library's frame loop never stops, so its drawing is let through only while a
  // page moves (or the hovered corner is folded) and for a moment after anything changed.
  const render = book.getRender();
  const draw = render.drawFrame.bind(render);
  render.drawFrame = () => {
    if (disposed || (state === 'read' && performance.now() > activeUntil)) return;
    draw();
  };
  wake();

  // The library only listens to the window; the reader's bars and text size change the room too.
  const resize = new ResizeObserver(() => {
    wake();
    if (state === 'read') book.update();
    else resized = true;
  });
  resize.observe(host);

  const own = new Set<Element>(pages);
  const copies = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof HTMLElement && node.classList.contains('stf__item') && !own.has(node)) quietCopy(node);
      }
    }
  });
  const pageBlock = block.querySelector<HTMLElement>('.stf__block');
  if (pageBlock) copies.observe(pageBlock, { childList: true });
  report();

  return {
    sync,
    tap(clientX, clientY) {
      if (!pageBlock || !atRest(state)) return null;
      const box = pageBlock.getBoundingClientRect();
      return edgeTap({ x: clientX - box.left, y: clientY - box.top }, book.getBoundsRect(), layout);
    },
    close() {
      disposed = true;
      resize.disconnect();
      copies.disconnect();
      for (const name of ['flip', 'changeState', 'changeOrientation', 'init']) book.off(name);
      // Land any turn in flight (its events are off), then take the book out of the page.
      render.finishAnimation();
      book.destroy();
    },
  };
}

/** One empty element per page; React fills the ones near the reader through portals, the library moves them. */
function makePages(spreads: number, layout: BookLayout): HTMLElement[] {
  const per = pagesPerSpread(layout);
  return Array.from({ length: spreads * per }, (_, page) => {
    const element = document.createElement('div');
    element.className = 'flip-page';
    if (per === 2) element.dataset.side = page % 2 === 0 ? 'left' : 'right';
    return element;
  });
}

interface FlipBookProps {
  layout: BookLayout;
  spreads: number;
  /** The spread the story is on. */
  target: number;
  /** Taps near the left or right edge turn the page (the adults' shelf). Corners always do. */
  edgeTaps: boolean;
  onTurn: (to: Turn) => void;
  onView: (view: BookView) => void;
  /** The content of a spread, laid out with `place`; only spreads near the reader are asked for. */
  renderSpread: (spread: number, place: PlacePages) => ReactNode;
}

/**
 * The book with pages that curl (page-flip, HTML mode, so the subtitles stay real text). React renders each page's
 * content through a portal into an element the library owns and moves; the library only positions and clips those
 * elements. Pointer handling (drag, swipe, corner taps) is the library's; edge taps are added here.
 */
export function FlipBook({ layout, spreads, target, edgeTaps, onTurn, onView, renderSpread }: FlipBookProps): ReactNode {
  const hostRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<OpenBook | null>(null);
  const targetRef = useRef(target);
  const onTurnRef = useRef(onTurn);
  const onViewRef = useRef(onView);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const [shown, setShown] = useState(target);
  const pages = useMemo(() => makePages(spreads, layout), [spreads, layout]);

  useEffect(() => {
    onTurnRef.current = onTurn;
    onViewRef.current = onView;
  }, [onTurn, onView]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const book = openBook(host, pages, layout, {
      target: () => targetRef.current,
      turned: (to, reached) => {
        targetRef.current = reached;
        onTurnRef.current(to);
      },
      view: (view) => {
        setShown(view.shown);
        onViewRef.current(view);
      },
    });
    bookRef.current = book;
    return () => {
      bookRef.current = null;
      book.close();
    };
  }, [pages, layout]);

  useEffect(() => {
    targetRef.current = target;
    bookRef.current?.sync();
  }, [target]);

  const per = pagesPerSpread(layout);
  const placeFor =
    (spread: number): PlacePages =>
    (first, second) => {
      const [left, right] = [pages[spread * per], pages[spread * per + 1]];
      if (!left) return null;
      if (per === 1 || !right) {
        return createPortal(
          <div className="flip-face">
            {first}
            {second}
          </div>,
          left,
        );
      }
      return (
        <>
          {createPortal(<div className="flip-face">{first}</div>, left)}
          {createPortal(<div className="flip-face">{second}</div>, right)}
        </>
      );
    };

  return (
    <div
      ref={hostRef}
      className="flip-host"
      data-layout={layout}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        const interactive = event.target instanceof Element && event.target.closest('a, button, input, select, textarea');
        pointerRef.current = event.isPrimary && !interactive ? { x: event.clientX, y: event.clientY } : null;
      }}
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        const from = pointerRef.current;
        pointerRef.current = null;
        if (!edgeTaps || !from || Math.hypot(event.clientX - from.x, event.clientY - from.y) > TAP_MAX_PX) return;
        const to = bookRef.current?.tap(event.clientX, event.clientY);
        if (to) onTurn(to);
      }}
      onPointerCancel={() => {
        pointerRef.current = null;
      }}
    >
      {spreadsNear([shown, target], spreads).map((spread) => (
        <Fragment key={spread}>{renderSpread(spread, placeFor(spread))}</Fragment>
      ))}
    </div>
  );
}
