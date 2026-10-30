import { describe, expect, it } from 'vitest';
import { backdropSources } from './scene-backdrop';

describe('backdrop sources', () => {
  it('offers AVIF then WebP for each frame shape, tall phones first', () => {
    const sources = backdropSources('ban-go', 'night');
    expect(sources).toHaveLength(8);
    expect(sources[0]).toEqual({
      media: '(max-aspect-ratio: 3/5)',
      type: 'image/avif',
      srcSet: '/reading-scenes/ban-go-night-1125x2436.avif 1125w, /reading-scenes/ban-go-night-750x1624.avif 750w',
    });
    expect(sources[1]?.type).toBe('image/webp');
    expect(sources.at(-1)).toMatchObject({ media: 'all', srcSet: '/reading-scenes/ban-go-night-2560x1440.webp 2560w, /reading-scenes/ban-go-night-1920x1080.webp 1920w' });
  });
});
