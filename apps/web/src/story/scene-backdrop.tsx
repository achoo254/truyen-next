import { BACKDROP_FRAMES, type BackdropFrame, type ReadingSceneId, type SceneMood, backdropUrl, readingScene, sceneMood } from '@truyen/story';
import type { ReactNode } from 'react';

export interface BackdropSource {
  media: string;
  type: 'image/avif' | 'image/webp';
  srcSet: string;
}

/** Which frame shape suits which screen: tall phones, portrait tablets, landscape tablets, then wide screens. */
const FRAME_MEDIA: Record<BackdropFrame['id'], string> = {
  phone: '(max-aspect-ratio: 3/5)',
  'tablet-portrait': '(max-aspect-ratio: 1/1)',
  'tablet-landscape': '(max-aspect-ratio: 3/2)',
  desktop: 'all',
};

/** The <source> list of a painted backdrop: per frame shape, AVIF first, then WebP, each with its sizes. */
export function backdropSources(id: ReadingSceneId, mood: SceneMood): BackdropSource[] {
  return BACKDROP_FRAMES.flatMap((frame) =>
    (['avif', 'webp'] as const).map((format) => ({
      media: FRAME_MEDIA[frame.id],
      type: format === 'avif' ? ('image/avif' as const) : ('image/webp' as const),
      srcSet: frame.exports.map((size) => `${backdropUrl(id, mood, size, format)} ${size.split('x')[0]}w`).join(', '),
    })),
  );
}

/**
 * The place around the book. A painted backdrop once the PC has drawn it (loaded after the page and its first
 * picture: low priority), until then the scene drawn in CSS (`.backdrop--<id>` in app.css). Decoration only.
 */
export function SceneBackdrop({ id, lightsOff }: { id: ReadingSceneId; lightsOff: boolean }): ReactNode {
  const scene = readingScene(id);
  const mood = sceneMood(scene, lightsOff);
  const painted = mood !== null && scene.drawn.includes(mood);
  return (
    <div className={`backdrop backdrop--${id}`} data-mood={mood ?? undefined} aria-hidden="true" data-id="reader-backdrop">
      {painted && mood && (
        <picture>
          {backdropSources(id, mood).map((source) => (
            <source key={`${source.media}-${source.type}`} media={source.media} type={source.type} srcSet={source.srcSet} sizes="100vw" />
          ))}
          <img className="backdrop-picture" src={backdropUrl(id, mood, '1920x1080', 'webp')} alt="" decoding="async" fetchPriority="low" />
        </picture>
      )}
      {!painted && <span className="backdrop-prop" />}
    </div>
  );
}

/** A small swatch of a scene for the picker: the same CSS drawing, or a still of the painting. */
export function SceneSwatch({ id, lightsOff }: { id: ReadingSceneId; lightsOff: boolean }): ReactNode {
  const scene = readingScene(id);
  const mood = sceneMood(scene, lightsOff);
  const painted = mood !== null && scene.drawn.includes(mood);
  return (
    <span className={`swatch backdrop backdrop--${id}`} data-mood={mood ?? undefined} aria-hidden="true">
      {painted && mood ? <img className="backdrop-picture" src={backdropUrl(id, mood, '750x1624', 'webp')} alt="" loading="lazy" decoding="async" /> : <span className="backdrop-prop" />}
    </span>
  );
}

export function isPainted(id: ReadingSceneId, lightsOff: boolean): boolean {
  const scene = readingScene(id);
  const mood = sceneMood(scene, lightsOff);
  return mood === null || scene.drawn.includes(mood);
}
