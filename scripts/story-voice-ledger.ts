/**
 * The voice ledger of a story: for every scene, a fingerprint of the narration and the voice its recording was made
 * from (`media/voices.json`, next to the recordings; the site does not serve it). The build compares it with the
 * current text, so a retold scene gets a new recording instead of keeping the old one just because the file exists.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Story } from '@truyen/story';

/** The ledger's path inside a story folder. */
export const LEDGER_FILE = 'media/voices.json';

/** Scene id to the fingerprint its recording was made from. */
export type VoiceLedger = Record<string, string>;

type Scene = Story['scenes'][number];

/** What a recording says and who says it: a different text or voice gives a different fingerprint. */
export function voiceFingerprint(narration: string, voice: string): string {
  return createHash('sha256').update(`${voice}\n${narration}`).digest('hex').slice(0, 16);
}

/** The fingerprint a scene's recording should have today. */
export function sceneFingerprint(story: Story, scene: Scene): string {
  const narrator = story.narrators[scene.narrator];
  if (!narrator) throw new Error(`scene ${scene.id}: narrator "${scene.narrator}" is not in narrators`);
  return voiceFingerprint(scene.narration, narrator.voice);
}

/** The recording's path inside the story folder. */
export const sceneVoiceFile = (scene: Pick<Scene, 'id'>): string => `media/scenes/${scene.id}.m4a`;

/**
 * The scenes whose recording has to be made again: it is missing, or it was made from other words or another voice
 * (a recording with no ledger entry cannot be vouched for, so it counts too). `exists` tells whether a file of the
 * story folder is there.
 */
export function staleVoiceScenes(story: Story, ledger: VoiceLedger, exists: (file: string) => boolean): Scene[] {
  return story.scenes.filter((scene) => !exists(sceneVoiceFile(scene)) || ledger[scene.id] !== sceneFingerprint(story, scene));
}

/** Whether the story has been given a voice before: it has a ledger, or at least one recording is on disk. */
export function previouslyVoiced(story: Story, ledger: VoiceLedger, exists: (file: string) => boolean): boolean {
  return Object.keys(ledger).length > 0 || story.scenes.some((scene) => exists(sceneVoiceFile(scene)));
}

/** The ledger with an entry added for every scene that has a recording but no entry, taken as made from today's text. */
export function adoptRecordings(story: Story, ledger: VoiceLedger, exists: (file: string) => boolean): VoiceLedger {
  const adopted: VoiceLedger = { ...ledger };
  for (const scene of story.scenes) {
    if (exists(sceneVoiceFile(scene)) && adopted[scene.id] === undefined) adopted[scene.id] = sceneFingerprint(story, scene);
  }
  return adopted;
}

/** A voiced story that needs work: the scenes to record again, and whether story.json has lost its voice references. */
export interface VoiceRemake {
  slug: string;
  dir: string;
  /** Scenes whose recording is missing or was made from other words or another voice. */
  sceneIds: string[];
  /** story.json names no recording for some scene, or no whole-story recording. */
  referencesLost: boolean;
}

/**
 * The stories that were given a voice before and no longer match their text: a retelling changed the words, or wrote
 * story.json without the recording references. A story that never had a voice is left alone (making voices for the
 * whole shelf is a deliberate `pnpm story:build`, not something to do behind anyone's back).
 */
export function voiceRemakes(
  stories: readonly { slug: string; dir: string; story: Story }[],
  ledgerOf: (dir: string) => VoiceLedger,
  exists: (dir: string, file: string) => boolean,
): VoiceRemake[] {
  const remakes: VoiceRemake[] = [];
  for (const { slug, dir, story } of stories) {
    const here = (file: string): boolean => exists(dir, file);
    const ledger = ledgerOf(dir);
    if (!previouslyVoiced(story, ledger, here)) continue;
    const sceneIds = staleVoiceScenes(story, ledger, here).map((scene) => scene.id);
    const referencesLost = story.track === undefined || story.scenes.some((scene) => scene.voice.file === undefined);
    if (sceneIds.length > 0 || referencesLost) remakes.push({ slug, dir, sceneIds, referencesLost });
  }
  return remakes;
}

/** The ledger of a story folder; empty when there is none or it cannot be read. */
export function readLedger(dir: string): VoiceLedger {
  const file = path.join(dir, LEDGER_FILE);
  if (!existsSync(file)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

/** Writes the ledger with its scenes in a fixed order so a re-run changes nothing it need not. */
export function writeLedger(dir: string, ledger: VoiceLedger): void {
  const sorted = Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path.join(dir, LEDGER_FILE), `${JSON.stringify(sorted, null, 2)}\n`);
}
