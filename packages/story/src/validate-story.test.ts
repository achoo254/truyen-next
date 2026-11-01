import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Story } from './story-schema.ts';
import { layOutTrack } from './story-track.ts';
import { SHELF_RULES, estimateStorySeconds, storyMediaFiles, validateStory, wordsFound } from './validate-story.ts';

const STORIES = new URL('../../../stories/', import.meta.url);
const read = (slug: string): Story => JSON.parse(readFileSync(new URL(`${slug}/story.json`, STORIES), 'utf8')) as Story;
const pilot = (): Story => read('son-tinh-thuy-tinh');
/** An adults' shelf story of the repository. */
const adult = (): Story => read('su-tich-ho-guom');
const SLUGS = readdirSync(STORIES, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);

function errorsOf(story: unknown, slug?: string): string[] {
  const result = validateStory(story, slug);
  return result.ok ? [] : result.errors;
}

describe('the stories of the repository', () => {
  it.each(SLUGS)('%s is valid and follows its shelf', (slug) => {
    const story = read(slug);
    expect(errorsOf(story, slug)).toEqual([]);
    const rules = SHELF_RULES[story.shelf];
    expect(story.scenes.length).toBeGreaterThanOrEqual(rules.minScenes);
    expect(story.scenes.length).toBeLessThanOrEqual(rules.maxScenes);
    expect(estimateStorySeconds(story)).toBeGreaterThanOrEqual(rules.minSeconds);
    expect(estimateStorySeconds(story)).toBeLessThanOrEqual(rules.maxSeconds);
    if (story.shelf === 'kids') {
      expect(story.scenes[0]?.narrator).toBe('miu');
      expect(story.scenes.at(-1)?.narrator).toBe('miu');
    } else {
      expect(Object.keys(story.narrators)).not.toContain('miu');
    }
  });

  it('has both shelves, the pilot on the children\'s shelf', () => {
    const shelves = SLUGS.map((slug) => read(slug).shelf);
    expect(shelves).toContain('adults');
    expect(pilot().shelf).toBe('kids');
  });

  it('refers to no media yet: nothing has been generated', () => {
    for (const slug of SLUGS) expect(storyMediaFiles(read(slug))).toEqual([]);
  });
});

describe('validateStory', () => {
  it('reports shape errors with their path', () => {
    expect(errorsOf({ schemaVersion: 2 })).toContain('schemaVersion: Invalid input: expected 1');
    const story = pilot();
    expect(errorsOf({ ...story, extra: true }).join('\n')).toMatch(/extra/);
    expect(errorsOf({ ...story, slug: 'Son Tinh' })).toEqual(['slug: lowercase kebab-case']);
  });

  it('keeps media paths inside the story folder with the right type', () => {
    const story = pilot();
    const scene = story.scenes[0];
    if (!scene) throw new Error('pilot has no scene');
    for (const file of ['../secret.webp', '/etc/passwd.webp', 'media/a.png', 'media/../x.webp']) {
      expect(errorsOf({ ...story, scenes: [{ ...scene, image: { ...scene.image, file } }, ...story.scenes.slice(1)] })).not.toEqual([]);
    }
    expect(errorsOf({ ...story, scenes: [{ ...scene, image: { ...scene.image, file: 'media/scenes/mo-dau.webp' } }, ...story.scenes.slice(1)] })).toEqual([]);
    expect(errorsOf({ ...story, music: { ...story.music, file: 'media/music.mp4' } })).not.toEqual([]);
  });

  it('checks references, ids, subtitles, digits and Miu across fields', () => {
    const story = pilot();
    const [first, second, ...rest] = story.scenes;
    if (!first || !second) throw new Error('pilot has too few scenes');
    expect(errorsOf({ ...story, scenes: [{ ...first, narrator: 'ke-chuyen' }, second, ...rest] })).toEqual(['scenes.mo-dau: the opening scene is narrated by "miu"']);
    expect(errorsOf({ ...story, scenes: [first, { ...second, id: 'mo-dau' }, ...rest] })).toEqual(['scenes: id "mo-dau" is used twice']);
    expect(errorsOf({ ...story, scenes: [first, { ...second, narrator: 'ai-do' }, ...rest] })).toEqual(['scenes.vua-va-cong-chua: narrator "ai-do" is not in narrators']);
    expect(errorsOf({ ...story, scenes: [first, { ...second, image: { ...second.image, character: 'rong' } }, ...rest] })).toEqual([
      'scenes.vua-va-cong-chua.image.character: "rong" is not in characters',
    ]);
    expect(errorsOf({ ...story, scenes: [first, { ...second, subtitles: second.subtitles.slice(1) }, ...rest] })).toEqual([
      'scenes.vua-va-cong-chua.subtitles: joined, the lines must be exactly the narration',
    ]);
    const digits = { ...second, narration: 'Vua có 100 mâm xôi.', subtitles: ['Vua có 100 mâm xôi.'] };
    expect(errorsOf({ ...story, scenes: [first, digits, ...rest] })).toContain('scenes.vua-va-cong-chua.narration: write numbers as words, the voice misreads digits');
    const long = 'Một câu thật là dài '.repeat(6).trim();
    expect(errorsOf({ ...story, scenes: [first, { ...second, narration: long, subtitles: [long] }, ...rest] }).join('\n')).toMatch(/subtitles\[0\]: \d+ characters, at most 90/);
  });

  it('checks the scene count and the read-aloud length of the children\'s shelf', () => {
    const story = pilot();
    expect(errorsOf({ ...story, scenes: story.scenes.slice(0, 5).concat(story.scenes.slice(-1)).slice(0, 5) }).join('\n')).toMatch(/5 scenes, expected 6–10 on the kids shelf/);
    const padded = story.scenes.map((scene) => {
      const narration = `${scene.narration} ${'la la la la la la la la la la.'.repeat(4)}`;
      return { ...scene, narration, subtitles: [...scene.subtitles, ...Array.from({ length: 4 }, () => 'la la la la la la la la la la.')] };
    });
    const longStory = { ...story, scenes: padded };
    expect(estimateStorySeconds(longStory)).toBeGreaterThan(SHELF_RULES.kids.maxSeconds);
    expect(errorsOf(longStory).join('\n')).toMatch(/read aloud, expected 180–360 s on the kids shelf/);
  });

  it('requires a shelf: kids, adults or world', () => {
    const { shelf: _shelf, ...withoutShelf } = pilot();
    expect(errorsOf(withoutShelf).join('\n')).toMatch(/^shelf: /);
    expect(errorsOf({ ...pilot(), shelf: 'teens' }).join('\n')).toMatch(/^shelf: /);
  });

  it('keeps the children\'s voices: Mèo Miu with Trúc Ly, the storyteller with Quỳnh Anh', () => {
    const story = pilot();
    const miu = story.narrators.miu;
    if (!miu) throw new Error('pilot has no Miu');
    expect(errorsOf({ ...story, narrators: { ...story.narrators, miu: { ...miu, voice: 'Ngọc Huyền' } } })).toEqual(['narrators.miu: Mèo Miu speaks with "Trúc Ly"']);
    expect(errorsOf({ ...story, narrators: { ...story.narrators, 'ke-chuyen': { name: 'Người kể chuyện', voice: 'Thanh Bình' } } })).toEqual([
      'narrators.ke-chuyen: the children\'s storyteller speaks with "Quỳnh Anh"',
    ]);
  });

  it('keeps killing, blood and death out of a children\'s retelling, in words and in prompts', () => {
    const story = pilot();
    const [first, second, ...rest] = story.scenes;
    if (!first || !second) throw new Error('pilot has too few scenes');
    const sad = { ...second, narration: 'Thủy Tinh giết hết cá.', subtitles: ['Thủy Tinh giết hết cá.'] };
    expect(errorsOf({ ...story, scenes: [first, sad, ...rest] })).toEqual(['scenes.vua-va-cong-chua.narration: "giết" has no place in a children\'s retelling']);
    const armed = { ...second, image: { ...second.image, prompt: 'the king holds a sword' } };
    expect(errorsOf({ ...story, scenes: [first, armed, ...rest] })).toEqual(['scenes.vua-va-cong-chua.image.prompt: no "sword"']);
  });

  it('gives the adults\' shelf one storyteller with a voice of their own and no Mèo Miu', () => {
    const story = adult();
    expect(story.shelf).toBe('adults');
    const storyteller = story.narrators['ke-chuyen'];
    if (!storyteller) throw new Error('no storyteller');
    expect(errorsOf({ ...story, narrators: { 'ke-chuyen': { ...storyteller, voice: 'Quỳnh Anh' } } })).toEqual([
      'narrators.ke-chuyen: "Quỳnh Anh" is another shelf\'s voice; the adults\' storyteller has their own',
    ]);
    expect(errorsOf({ ...story, narrators: { 'ke-chuyen': { ...storyteller, voice: 'Minh Triết' } } })).toEqual([
      'narrators.ke-chuyen: "Minh Triết" is not used, speech recognition hears it poorly',
    ]);
    expect(errorsOf({ ...story, narrators: { ...story.narrators, miu: { name: 'Mèo Miu', voice: 'Trúc Ly' } } })).toEqual([
      'narrators: an adults\' story has one storyteller, found 2',
      'narrators.miu: Mèo Miu narrates only the children\'s shelf',
      'narrators.miu: "Trúc Ly" is another shelf\'s voice; the adults\' storyteller has their own',
    ]);
    // The pilot moved to the adults' shelf breaks every rule of it: Mèo Miu, two voices, too short.
    expect(errorsOf({ ...pilot(), shelf: 'adults' }).join('\n')).toMatch(/one storyteller[\s\S]*Mèo Miu narrates only[\s\S]*Mèo Miu appears only[\s\S]*expected 360–720 s on the adults shelf/);
  });

  it('lets an adults\' story name death and weapons, but no prompt asks for gore', () => {
    const story = adult();
    const [first, ...rest] = story.scenes;
    if (!first) throw new Error('no scene');
    const sombre = { ...first, narration: `${first.narration} Nhiều người đã chết.`, subtitles: [...first.subtitles, 'Nhiều người đã chết.'] };
    expect(errorsOf({ ...story, scenes: [sombre, ...rest] })).toEqual([]);
    expect(errorsOf({ ...story, scenes: [{ ...first, image: { ...first.image, prompt: 'a bloody battlefield' } }, ...rest] })).toEqual([
      `scenes.${first.id}.image.prompt: no "bloody"`,
    ]);
    expect(errorsOf({ ...story, scenes: story.scenes.slice(0, 7) }).join('\n')).toMatch(/7 scenes, expected 8–14 on the adults shelf/);
  });

  it('tells world stories with one storyteller, Mỹ Duyên, gently enough for a child', () => {
    // The gentle children's pilot, told by one storyteller without Mèo Miu, is a valid world story.
    const kids = pilot();
    const storyteller = { name: 'Người kể chuyện', voice: 'Mỹ Duyên' };
    const world: Story = {
      ...kids,
      shelf: 'world',
      narrators: { 'ke-chuyen': storyteller },
      characters: kids.characters.filter((c) => c.id !== 'miu'),
      scenes: kids.scenes.map(({ image: { character, ...image }, ...scene }) => ({
        ...scene,
        narrator: 'ke-chuyen',
        image: character === 'miu' ? image : { ...image, character },
      })),
    };
    const [first, ...rest] = world.scenes;
    if (!first) throw new Error('no scene');
    const base = adult();
    expect(errorsOf(world)).toEqual([]);
    expect(errorsOf({ ...world, narrators: { 'ke-chuyen': { ...storyteller, voice: 'Thanh Bình' } } })).toEqual([
      'narrators.ke-chuyen: the world storyteller speaks with "Mỹ Duyên"',
    ]);
    const sombre = { ...first, narration: `${first.narration} Nhiều người đã chết.`, subtitles: [...first.subtitles, 'Nhiều người đã chết.'] };
    expect(errorsOf({ ...world, scenes: [sombre, ...rest] })).toEqual([`scenes.${first.id}.narration: "chết" has no place in a family retelling`]);
    expect(errorsOf({ ...world, scenes: [{ ...first, image: { ...first.image, prompt: 'a knight with a sword' } }, ...rest] })).toEqual([
      `scenes.${first.id}.image.prompt: no "sword"`,
    ]);
    // An adults' storyteller may not borrow the world shelf's voice.
    expect(errorsOf({ ...base, narrators: { 'ke-chuyen': storyteller } })).toEqual([
      'narrators.ke-chuyen: "Mỹ Duyên" is another shelf\'s voice; the adults\' storyteller has their own',
    ]);
  });

  it('names the source of every story in a few words', () => {
    const { basedOn: _basedOn, ...withoutSource } = pilot();
    expect(errorsOf(withoutSource).join('\n')).toMatch(/^basedOn: /);
    expect(errorsOf({ ...pilot(), basedOn: 'x'.repeat(81) }).join('\n')).toMatch(/^basedOn: /);
  });

  it('refuses a story that does not say where the tale comes from', () => {
    const { source: _source, ...withoutSource } = pilot();
    expect(errorsOf(withoutSource).join('\n')).toMatch(/^source: /);
    expect(errorsOf({ ...pilot(), source: '   ' }).join('\n')).toMatch(/^source: /);
  });

  it('finds whole words only', () => {
    expect(wordsFound('Chính xác, máu đỏ', ['xác chết', 'máu'])).toEqual(['máu']);
    expect(wordsFound('A SWORD', ['sword'])).toEqual(['sword']);
    expect(wordsFound('swordfish', ['sword'])).toEqual([]);
  });

  it('accepts a story recording made from every voice and the music, laid out over the scenes in order', () => {
    const story = pilot();
    const voiced = {
      ...story,
      scenes: story.scenes.map((scene) => ({ ...scene, voice: { file: `media/scenes/${scene.id}.m4a` } })),
      music: { ...story.music, file: 'media/music.m4a' },
    };
    const track = layOutTrack('media/story.m4a', voiced.scenes, voiced.scenes.map(() => 10));
    expect(errorsOf({ ...voiced, track })).toEqual([]);
    expect(storyMediaFiles({ ...voiced, track })).toContain('media/story.m4a');
    expect(errorsOf({ ...story, track })).toEqual(['track: made from every scene voice and the music, which are not all there']);
    const [a, b, ...others] = track.scenes;
    if (!a || !b) throw new Error('too few scenes');
    expect(errorsOf({ ...voiced, track: { ...track, scenes: [b, a, ...others] } }).join('\n')).toMatch(/track\.scenes: must list every scene in order/);
    expect(errorsOf({ ...voiced, track: { ...track, scenes: [a, { ...b, start: a.end - 1 }, ...others] } })).toEqual([
      `track.scenes.${b.id}: starts at ${a.end - 1} s, before ${a.id} ends at ${a.end} s`,
    ]);
    expect(errorsOf({ ...voiced, track: { ...track, duration: 5 } }).join('\n')).toMatch(/after the recording's 5 s/);
    expect(errorsOf({ ...voiced, track: { ...track, file: 'media/story.mp3' } }).join('\n')).toMatch(/^track\.file: /);
  });

  it('matches the slug to its folder', () => {
    expect(errorsOf(pilot(), 'other')).toEqual(['slug: "son-tinh-thuy-tinh" must match its folder "other"']);
  });
});
