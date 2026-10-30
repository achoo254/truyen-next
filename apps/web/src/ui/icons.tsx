/**
 * The reader's icons: one family, drawn on a 24-unit grid with a 2-unit round stroke in the current text colour.
 * Always decorative: the button around each icon carries the name (aria-label or a visible label).
 */
import type { ReactNode } from 'react';

export type IconName =
  | 'play'
  | 'pause'
  | 'prev'
  | 'next'
  | 'more'
  | 'close'
  | 'moon'
  | 'sun'
  | 'sound'
  | 'muted'
  | 'scenes'
  | 'share'
  | 'expand'
  | 'shrink'
  | 'timer'
  | 'replay'
  | 'search'
  | 'check'
  | 'back';

const PATHS: Record<IconName, ReactNode> = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  pause: (
    <>
      <path d="M8.5 5.5v13M15.5 5.5v13" strokeWidth="3" />
    </>
  ),
  prev: <path d="M15 5l-7 7 7 7" />,
  next: <path d="M9 5l7 7-7 7" />,
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="18.5" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  muted: (
    <>
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  scenes: <path d="M4 6h3M10 6h10M4 12h3M10 12h10M4 18h3M10 18h10" />,
  share: (
    <>
      <path d="M12 3.5v11M8 7.5l4-4 4 4" />
      <path d="M6 11.5H5v8.5h14v-8.5h-1" />
    </>
  ),
  expand: <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />,
  shrink: <path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
    </>
  ),
  replay: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 3.5v4h4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  back: <path d="M19 12H5M11 6l-6 6 6 6" />,
};

export function Icon({ name, className }: { name: IconName; className?: string }): ReactNode {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
