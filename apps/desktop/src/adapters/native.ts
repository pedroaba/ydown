import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import type { LibraryData, Track } from '@ydown/core';
import type { KeyValueStorage, LibraryRepository, MediaAcquisitionService } from '@ydown/contracts';

export const native = isTauri();
export const desktopStorage: KeyValueStorage = {
  getItem: (key) =>
    native
      ? invoke<string | null>('load_state', { key })
      : Promise.resolve(localStorage.getItem(key)),
  setItem: (key, value) =>
    native
      ? invoke('save_state', { key, value })
      : Promise.resolve(localStorage.setItem(key, value)),
};
const emptyLibrary: LibraryData = { tracks: [], favoriteIds: [], playlists: [] };
export const desktopLibrary: LibraryRepository = {
  async load() {
    const raw = await desktopStorage.getItem('local.library.v1');
    if (!raw) return emptyLibrary;
    const data = JSON.parse(raw) as LibraryData;
    if (
      !Array.isArray(data.tracks) ||
      !Array.isArray(data.playlists) ||
      !Array.isArray(data.favoriteIds)
    )
      throw new Error('Biblioteca inválida. Seus arquivos de áudio continuam salvos.');
    return {
      ...data,
      tracks: await Promise.all(
        data.tracks.map(async (track) =>
          track.artwork?.startsWith('local:')
            ? {
                ...track,
                localArtwork: track.artwork,
                artwork: await audioSource(track.artwork).catch(() => undefined),
              }
            : track,
        ),
      ),
    };
  },
  save: (data) =>
    desktopStorage.setItem(
      'local.library.v1',
      JSON.stringify({
        ...data,
        tracks: data.tracks.map((track) => {
          const { localArtwork, ...stored } = track as Track & { localArtwork?: string };
          return { ...stored, artwork: localArtwork ?? stored.artwork };
        }),
      }),
    ),
};
export async function audioSource(source: string) {
  if (!source.startsWith('local:'))
    throw new Error('Origem de áudio inválida. Baixe este conteúdo novamente.');
  return convertFileSrc(await invoke<string>('audio_path', { source }));
}
export const youtube: MediaAcquisitionService = {
  preview: (url) => invoke('preview_youtube', { url }),
  enqueue: (url, kind) => invoke('enqueue_youtube', { url, kind }),
  list: () => (native ? invoke('list_downloads') : Promise.resolve([])),
  cancel: (id) => invoke('cancel_download', { id }),
  retry: (id) => invoke('retry_download', { id }),
};
export const mediaTools = () => invoke<string[]>('media_tools');
export async function storageInfo() {
  return native
    ? invoke<{ path: string; bytes: number }>('storage_info')
    : { path: 'Disponível no aplicativo desktop', bytes: 0 };
}
