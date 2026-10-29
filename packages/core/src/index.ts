export type Track = Readonly<{
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  color: string;
  source: string;
  artwork?: string;
  mediaKind?: 'audio' | 'video';
  originUrl?: string;
}>;
export type Playlist = Readonly<{ id: string; name: string; trackIds: readonly string[] }>;
export type LibraryData = {
  tracks: readonly Track[];
  favoriteIds: readonly string[];
  playlists: readonly Playlist[];
};
export type SortOrder = 'title' | 'artist' | 'duration';
export type Download = { id: string; title: string } & (
  | { status: 'queued' }
  | { status: 'downloading'; received: number; total: number }
  | { status: 'completed'; bytes: number }
  | { status: 'failed'; error: string }
);
export function selectTracks(
  data: LibraryData,
  query: string,
  order: SortOrder,
  favoritesOnly = false,
  playlistId?: string,
) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  const search = normalize(query.trim());
  const playlist = data.playlists.find((p) => p.id === playlistId);
  return data.tracks
    .filter(
      (t) =>
        (!playlist || playlist.trackIds.includes(t.id)) &&
        (!favoritesOnly || data.favoriteIds.includes(t.id)) &&
        normalize(`${t.title} ${t.artist} ${t.album}`).includes(search),
    )
    .sort((a, b) =>
      order === 'duration' ? a.duration - b.duration : a[order].localeCompare(b[order], 'pt-BR'),
    );
}
export function toggleFavorite(data: LibraryData, id: string): LibraryData {
  if (!data.tracks.some((t) => t.id === id)) throw new Error('Faixa não encontrada.');
  return {
    ...data,
    favoriteIds: data.favoriteIds.includes(id)
      ? data.favoriteIds.filter((x) => x !== id)
      : [...data.favoriteIds, id],
  };
}
export function editPlaylist(
  data: LibraryData,
  playlistId: string,
  trackId: string,
  action: 'add' | 'remove',
): LibraryData {
  if (!data.playlists.some((p) => p.id === playlistId)) throw new Error('Playlist não encontrada.');
  if (!data.tracks.some((t) => t.id === trackId)) throw new Error('Faixa não encontrada.');
  return {
    ...data,
    playlists: data.playlists.map((p) =>
      p.id !== playlistId
        ? p
        : {
            ...p,
            trackIds:
              action === 'remove'
                ? p.trackIds.filter((id) => id !== trackId)
                : [...new Set([...p.trackIds, trackId])],
          },
    ),
  };
}
export function queueIndex(
  queue: readonly string[],
  currentId: string | null,
  direction: 1 | -1,
): string | null {
  const index = queue.indexOf(currentId ?? '');
  if (index < 0) return null;
  return queue[index + direction] ?? null;
}
export function describeDownload(download: Download): string {
  switch (download.status) {
    case 'queued':
      return 'Na fila';
    case 'downloading':
      return 'Baixando';
    case 'completed':
      return 'Concluído';
    case 'failed':
      return download.error;
  }
}
