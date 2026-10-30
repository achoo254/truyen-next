/**
 * Mèo Miu, the white cat who tells the children's stories (and guides Miu World), cut as a woodblock print: paper
 * white body, ink keyline, rosy cheeks, a vermilion collar bell. `waving` raises a paw to say goodbye on the last
 * page. Hand-drawn vector, MIT like the code; colours from the tokens through app.css.
 */
import type { ReactNode } from 'react';

export function MeoMiu({ waving = false, className }: { waving?: boolean; className?: string }): ReactNode {
  return (
    <svg className={className ? `miu ${className}` : 'miu'} viewBox="0 0 120 140" aria-hidden="true" focusable="false">
      {/* tail */}
      <path className="em-paper em-ink" d="M88 118c18 2 26-10 20-22c-4-8-12-6-12 0c0 6 6 6 6 12c0 6-8 8-16 6z" />
      {/* body */}
      <path className="em-paper em-ink" d="M30 132c-4-28 6-52 30-52s34 24 30 52z" />
      {/* paws */}
      <path className="em-paper em-ink" d="M42 132c0-8 12-8 12 0M66 132c0-8 12-8 12 0" />
      {waving ? (
        <path className="em-paper em-ink miu-wave" d="M84 96c6-10 10-22 8-32c-1-6 8-8 10-2c2 10-2 26-10 38z" />
      ) : (
        <path className="em-paper em-ink" d="M84 100c4 6 4 14 0 20" />
      )}
      {/* head */}
      <path className="em-paper em-ink" d="M22 26l10 24c-6 6-8 14-6 22c4 14 18 20 34 20s30-6 34-20c2-8 0-16-6-22l10-24-24 12c-4-2-10-2-14-2s-10 0-14 2z" strokeLinejoin="round" />
      <path className="em-b em-ink" d="M28 34l6 12 8-4zM92 34l-6 12-8-4z" />
      {/* face */}
      <path className="em-ink" d="M44 62c2-3 6-3 8 0M68 62c2-3 6-3 8 0" strokeWidth="3" />
      <ellipse className="em-cheek" cx="40" cy="72" rx="6" ry="4" />
      <ellipse className="em-cheek" cx="80" cy="72" rx="6" ry="4" />
      <path className="em-ink-fill" d="M56 70h8l-4 4z" />
      <path className="em-ink" d="M60 74v3c-2 3-6 3-8 1M60 77c2 3 6 3 8 1M20 66l14 2M20 74l14-2M100 66l-14 2M100 74l-14-2" />
      {/* collar and bell */}
      <path className="em-a em-ink" d="M38 88c14 6 30 6 44 0v6c-14 6-30 6-44 0z" />
      <circle className="em-b em-ink" cx="60" cy="98" r="5" />
    </svg>
  );
}
