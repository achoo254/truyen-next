/**
 * A story's cover until the home PC paints one: a flat print colour, the story's carved emblem, and the title in a
 * paper cartouche, the way Đông Hồ prints name themselves. Six colour schemes (`data-cover`, app.css), picked per
 * story so neighbours on a shelf differ.
 */
import type { Shelf } from '@truyen/story';
import type { ReactNode } from 'react';
import { Emblem, type EmblemName } from './story-emblems';

interface CoverArt {
  emblem: EmblemName;
  scheme: CoverScheme;
}

export const COVER_SCHEMES = [1, 2, 3, 4, 5, 6] as const;
export type CoverScheme = (typeof COVER_SCHEMES)[number];

/** The stories drawn so far. A new story without an entry still gets a cover (coverArt). */
const COVERS: Record<string, CoverArt> = {
  'cay-khe': { emblem: 'star-fruit', scheme: 3 },
  'con-rong-chau-tien': { emblem: 'egg-sack', scheme: 2 },
  'son-tinh-thuy-tinh': { emblem: 'mountain-waves', scheme: 5 },
  'tam-cam': { emblem: 'oriole', scheme: 4 },
  'thanh-giong': { emblem: 'bamboo', scheme: 1 },
  'su-tich-ho-guom': { emblem: 'turtle-sword', scheme: 3 },
  'chu-dong-tu': { emblem: 'conical-hat', scheme: 1 },
  'nguoi-con-gai-nam-xuong': { emblem: 'oil-lamp', scheme: 6 },
};

/** A stable scheme for any slug, so a story keeps its colour between visits. */
function schemeOf(slug: string): CoverScheme {
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVER_SCHEMES[hash % COVER_SCHEMES.length] ?? 1;
}

export function coverArt(slug: string): CoverArt {
  return COVERS[slug] ?? { emblem: 'cloud', scheme: schemeOf(slug) };
}

interface StoryCoverProps {
  slug: string;
  title: string;
  shelf: Shelf;
  /** `tile` on the shelves, `large` on the story's own page, `mini` (emblem only) beside a title. */
  size?: 'tile' | 'large' | 'mini';
  /** The title with the searched words marked, when the shelf is searched. */
  titleContent?: ReactNode;
}

export function StoryCover({ slug, title, shelf, size = 'tile', titleContent }: StoryCoverProps): ReactNode {
  const art = coverArt(slug);
  return (
    <div className={`cover cover--${size}`} data-cover={art.scheme} data-shelf={shelf}>
      <Emblem name={art.emblem} className="cover-emblem" />
      {size !== 'mini' && (
        <p className="cover-title" lang="vi">
          {titleContent ?? title}
        </p>
      )}
    </div>
  );
}
