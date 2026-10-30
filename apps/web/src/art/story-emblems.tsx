/**
 * The carved emblem of each story, drawn the way an Đông Hồ print is cut: flat colour blocks (`.em-a`, `.em-b`,
 * `.em-paper`, coloured in app.css from the tokens) inside one ink keyline (`.em-ink`). They stand in for the
 * covers until the home PC paints them, and mark a scene that has no picture yet. Hand-drawn vectors, MIT like the
 * code. Every emblem sits in a 120-unit square.
 */
import type { ReactNode } from 'react';

export const EMBLEMS = ['star-fruit', 'egg-sack', 'mountain-waves', 'oriole', 'bamboo', 'turtle-sword', 'conical-hat', 'oil-lamp', 'cloud'] as const;
export type EmblemName = (typeof EMBLEMS)[number];

const SHAPES: Record<EmblemName, ReactNode> = {
  // Cây khế: a star fruit cut across, its seeds, and a leaf.
  'star-fruit': (
    <>
      <path className="em-b em-ink" d="M78 22c14-8 30-6 34 2c-10 12-26 14-38 8z" />
      <path className="em-a em-ink" d="M60 18l10 26 28-2-22 17 9 27-25-15-25 15 9-27-22-17 28 2z" strokeLinejoin="round" />
      <path className="em-paper em-ink" d="M60 42l5 13 13-1-10 8 4 13-12-7-12 7 4-13-10-8 13 1z" />
      <path className="em-ink" d="M60 55v-6M66 60l5-2M63 67l3 5M57 67l-3 5M54 60l-5-2" />
      <path className="em-ink" d="M84 30l20-6" />
    </>
  ),
  // Con Rồng cháu Tiên: the pouch of a hundred eggs.
  'egg-sack': (
    <>
      <path className="em-a em-ink" d="M30 52c0-14 14-22 30-22s30 8 30 22c0 30-12 50-30 50S30 82 30 52z" />
      <path className="em-b em-ink" d="M46 30c4-8 24-8 28 0l-6 8H52z" />
      <ellipse className="em-paper em-ink" cx="48" cy="60" rx="7" ry="9" />
      <ellipse className="em-paper em-ink" cx="66" cy="56" rx="7" ry="9" />
      <ellipse className="em-paper em-ink" cx="58" cy="78" rx="7" ry="9" />
      <ellipse className="em-paper em-ink" cx="76" cy="76" rx="6" ry="8" />
      <ellipse className="em-paper em-ink" cx="42" cy="80" rx="6" ry="8" />
      <path className="em-ink" d="M52 22c2-6 14-6 16 0" />
    </>
  ),
  // Sơn Tinh, Thủy Tinh: the mountain and the rising water.
  'mountain-waves': (
    <>
      <path className="em-b em-ink" d="M8 80L40 30l14 20 14-26 44 56z" strokeLinejoin="round" />
      <path className="em-ink" d="M40 30l-6 18M68 24l-4 22" />
      <circle className="em-a em-ink" cx="96" cy="26" r="11" />
      <path className="em-paper em-ink" d="M6 112V84q9-12 18 0q9-12 18 0q9-12 18 0q9-12 18 0q9-12 18 0q9-12 18 0V112z" />
      <path className="em-ink" d="M14 98a6 6 0 0 1 12 0M38 98a6 6 0 0 1 12 0M62 98a6 6 0 0 1 12 0M86 98a6 6 0 0 1 12 0" />
    </>
  ),
  // Tấm Cám: the golden oriole on a branch.
  oriole: (
    <>
      <path className="em-ink" d="M10 92c30-6 70-6 100 4" strokeWidth="5" />
      <path className="em-b em-ink" d="M84 92c6-8 14-10 20-8c-4 6-12 10-20 8z" />
      <path className="em-a em-ink" d="M30 74c0-20 16-34 36-34c8-12 22-14 30-6c-6 2-10 6-10 10c0 22-18 38-40 38c-6 6-16 8-24 6c4-4 8-8 8-14z" strokeLinejoin="round" />
      <path className="em-b em-ink" d="M46 66c10-2 22 0 30 8c-12 4-24 2-30-8z" />
      <path className="em-ink" d="M96 34l10-2-8 8" />
      <circle className="em-ink-fill" cx="88" cy="38" r="2.6" />
      <path className="em-ink" d="M56 90v10M66 90v10" />
    </>
  ),
  // Thánh Gióng: the golden bamboo, scorched by the iron horse's breath.
  bamboo: (
    <>
      <path className="em-a em-ink" d="M36 112V20h12v92zM58 112V8h12v104zM80 112V26h12v86z" />
      <path className="em-ink" d="M36 44h12M36 74h12M58 34h12M58 66h12M58 94h12M80 54h12M80 86h12" />
      <path className="em-b em-ink" d="M48 44c10-10 22-12 30-8c-10 8-20 10-30 8zM70 66c-12-8-26-8-34-2c12 6 24 6 34 2zM92 54c8-10 18-12 24-8c-8 8-16 10-24 8z" />
    </>
  ),
  // Sự tích Hồ Gươm: the golden turtle and the returned sword.
  'turtle-sword': (
    <>
      <path className="em-b em-ink" d="M16 104L100 20" strokeWidth="6" />
      <path className="em-ink" d="M86 26l8 8M90 22l8 8" />
      <path className="em-paper em-ink" d="M44 56c-10-6-10-18 0-20c6 0 8 6 8 10" />
      <path className="em-paper em-ink" d="M34 82c-8 4-12 12-8 16M86 82c8 4 12 12 8 16M38 50c-8-6-14-4-14 2M82 50c8-6 14-4 14 2" />
      <ellipse className="em-a em-ink" cx="60" cy="68" rx="28" ry="24" />
      <path className="em-ink" d="M60 50l10 8v12l-10 8-10-8V58zM60 50v-6M70 58l12-6M70 70l12 6M60 78v12M50 70l-12 6M50 58l-12-6" />
      <path className="em-paper em-ink" d="M52 42c0-10 16-10 16 0c0 4-4 6-8 6s-8-2-8-6z" />
    </>
  ),
  // Chử Đồng Tử và Tiên Dung: the hat and the staff of the immortals.
  'conical-hat': (
    <>
      <path className="em-b em-ink" d="M84 14L56 112" strokeWidth="5" />
      <path className="em-a em-ink" d="M60 26L14 84c28 10 64 10 92 0z" strokeLinejoin="round" />
      <path className="em-ink" d="M60 26L44 88M60 26l16 62M60 26L28 82M60 26l32 56" />
      <path className="em-paper em-ink" d="M14 84c28 10 64 10 92 0c-2 6-4 8-8 10c-24 8-52 8-76 0c-4-2-6-4-8-10z" />
    </>
  ),
  // Chuyện người con gái Nam Xương: the oil lamp whose shadow on the wall was mistaken for a father.
  'oil-lamp': (
    <>
      <path className="em-b em-ink" d="M62 20c10 12 14 22 6 32c-4 4-12 4-16 0c-8-10-2-20 10-32z" />
      <path className="em-paper em-ink" d="M60 34c4 6 6 10 2 14c-2 2-4 2-6 0c-2-4 0-8 4-14z" />
      <path className="em-a em-ink" d="M38 60h44l-6 18H44z" />
      <path className="em-a em-ink" d="M52 78h16v18H52zM36 96h48v10H36z" />
      <path className="em-ink" d="M58 52v8" />
    </>
  ),
  // Any other story: a cloud curl.
  cloud: (
    <>
      <path className="em-a em-ink" d="M18 84c-8-14 4-30 20-26c2-18 26-26 40-12c12-8 30 0 30 16c12 4 12 22 0 22z" />
      <path className="em-ink" d="M36 70c0-8 10-12 16-6c4 4 0 10-4 10M70 64c4-8 16-6 16 2" />
    </>
  ),
};

export function Emblem({ name, className }: { name: EmblemName; className?: string }): ReactNode {
  return (
    <svg className={className ? `emblem ${className}` : 'emblem'} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      {SHAPES[name]}
    </svg>
  );
}
