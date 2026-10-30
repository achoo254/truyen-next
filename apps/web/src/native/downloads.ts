/**
 * Stories kept on the phone for listening with no network (iPhone app only). A story's folder of the site (story.json
 * and every media file it refers to) is copied into the app's Library/NoCloud/downloads/<slug>/: kept out of iCloud
 * backups (it can always be fetched again) and never purged by the system, unlike caches. A download goes into
 * `<slug>.part/` first and is moved into place only once every file is there, with a manifest that holds its size,
 * so a story is either whole on the phone or not at all.
 *
 * Downloaded stories are registered with story-location.ts at start-up, and from then on every file of them is read
 * from the phone.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { FileTransfer } from '@capacitor/file-transfer';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { SHELVES, type Shelf, type Story } from '@truyen/story';
import { forgetOfflineCopy, rememberOfflineCopy, storyRemoteUrl } from '../story/story-location';
import { type DownloadProgress, STORY_JSON, contentLength, storyMediaDownloads } from './download-files';

const DIRECTORY = Directory.LibraryNoCloud;
const ROOT = 'downloads';
const MANIFEST = 'download.json';
const PART = '.part';

/** A story kept on the phone. */
export interface Download {
  slug: string;
  title: string;
  shelf: Shelf;
  /** Bytes on the phone. */
  bytes: number;
  /** When it was downloaded (ISO date-time). */
  savedAt: string;
}

export class DownloadCancelled extends Error {
  constructor() {
    super('download cancelled');
    this.name = 'DownloadCancelled';
  }
}

const folderOf = (slug: string): string => `${ROOT}/${slug}`;

function isDownload(value: unknown): value is Download {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.slug === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) &&
    typeof entry.title === 'string' &&
    (SHELVES as readonly unknown[]).includes(entry.shelf) &&
    typeof entry.bytes === 'number' &&
    typeof entry.savedAt === 'string'
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: DIRECTORY });
    return true;
  } catch {
    return false;
  }
}

async function removeFolder(path: string): Promise<void> {
  if (await exists(path)) await Filesystem.rmdir({ path, directory: DIRECTORY, recursive: true });
}

/** The address the web view loads a downloaded folder's files from. */
async function localFolderUrl(slug: string): Promise<string> {
  const { uri } = await Filesystem.getUri({ path: `${folderOf(slug)}/`, directory: DIRECTORY });
  return Capacitor.convertFileSrc(uri);
}

async function readManifest(slug: string): Promise<Download | null> {
  try {
    const { data } = await Filesystem.readFile({ path: `${folderOf(slug)}/${MANIFEST}`, directory: DIRECTORY, encoding: Encoding.UTF8 });
    const parsed: unknown = JSON.parse(typeof data === 'string' ? data : await data.text());
    return isDownload(parsed) && parsed.slug === slug ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Every whole download on the phone, registered so its files load from the phone. Unfinished `.part` folders (the app
 * was closed mid-download) are removed.
 */
export async function restoreDownloads(): Promise<Download[]> {
  let names: string[];
  try {
    const listing = await Filesystem.readdir({ path: ROOT, directory: DIRECTORY });
    names = listing.files.filter((entry) => entry.type === 'directory').map((entry) => entry.name);
  } catch {
    // No download yet: the folder does not exist.
    return [];
  }
  const downloads: Download[] = [];
  for (const name of names) {
    if (name.endsWith(PART)) {
      await removeFolder(`${ROOT}/${name}`).catch((error: unknown) => console.warn('could not clear an unfinished download', error));
      continue;
    }
    const manifest = await readManifest(name);
    if (!manifest) continue;
    rememberOfflineCopy(name, await localFolderUrl(name));
    downloads.push(manifest);
  }
  return downloads.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
}

/** The size of the story's media on the site, asked with HEAD; null when the site does not say for every file. */
export async function measureStory(story: Story): Promise<number | null> {
  const sizes = await Promise.all(
    storyMediaDownloads(story).map(async (file) => {
      const response = await CapacitorHttp.request({ method: 'HEAD', url: storyRemoteUrl(story.slug, file) });
      if (response.status < 200 || response.status >= 300) throw new Error(`${file}: HTTP ${response.status}`);
      return contentLength(response.headers);
    }),
  );
  return sizes.every((size): size is number => size !== null) ? sizes.reduce((sum, size) => sum + size, 0) : null;
}

/**
 * Copies the story's media from the site to the phone, with the story itself (story.json), reporting progress; replaces an earlier copy only once the
 * new one is whole. `signal` cancels between two files (the file in flight finishes) with DownloadCancelled.
 */
export async function downloadStory(story: Story, onProgress: (progress: DownloadProgress) => void, signal?: AbortSignal): Promise<Download> {
  const files = storyMediaDownloads(story);
  const part = `${folderOf(story.slug)}${PART}`;
  const total = await measureStory(story).catch((error: unknown) => {
    console.warn('story size unknown', error instanceof Error ? error.message : error);
    return null;
  });
  const progress: DownloadProgress = { filesDone: 0, files: files.length, bytes: 0, total };
  onProgress({ ...progress });
  await removeFolder(part);

  let inFlight = 0;
  const listener = await FileTransfer.addListener('progress', (status) => {
    inFlight = status.bytes;
    onProgress({ ...progress, bytes: progress.bytes + inFlight });
  });
  try {
    for (const file of files) {
      if (signal?.aborted) throw new DownloadCancelled();
      const target = `${part}/${file}`;
      const folder = target.slice(0, target.lastIndexOf('/'));
      if (!(await exists(folder))) await Filesystem.mkdir({ path: folder, directory: DIRECTORY, recursive: true });
      const { uri } = await Filesystem.getUri({ path: target, directory: DIRECTORY });
      inFlight = 0;
      await FileTransfer.downloadFile({ url: storyRemoteUrl(story.slug, file), path: uri, progress: true });
      const { size } = await Filesystem.stat({ path: target, directory: DIRECTORY });
      if (size <= 0) throw new Error(`${file}: empty download`);
      progress.bytes += size;
      progress.filesDone += 1;
      onProgress({ ...progress });
    }
    // The story as the app read it, so it names exactly the files fetched above.
    await Filesystem.writeFile({ path: `${part}/${STORY_JSON}`, directory: DIRECTORY, data: JSON.stringify(story), encoding: Encoding.UTF8 });
    const saved: Download = { slug: story.slug, title: story.title, shelf: story.shelf, bytes: progress.bytes, savedAt: new Date().toISOString() };
    await Filesystem.writeFile({ path: `${part}/${MANIFEST}`, directory: DIRECTORY, data: JSON.stringify(saved), encoding: Encoding.UTF8 });
    await removeFolder(folderOf(story.slug));
    await Filesystem.rename({ from: part, to: folderOf(story.slug), directory: DIRECTORY, toDirectory: DIRECTORY });
    rememberOfflineCopy(story.slug, await localFolderUrl(story.slug));
    return saved;
  } catch (error) {
    await removeFolder(part).catch((cleanup: unknown) => console.warn('could not clear a failed download', cleanup));
    throw error;
  } finally {
    await listener.remove();
  }
}

/** Deletes the phone's copy of a story; it plays from the site again. */
export async function removeDownload(slug: string): Promise<void> {
  forgetOfflineCopy(slug);
  await removeFolder(folderOf(slug));
}

/** The phone's copy of one story, if whole. */
export async function downloadOf(slug: string): Promise<Download | null> {
  return readManifest(slug);
}
