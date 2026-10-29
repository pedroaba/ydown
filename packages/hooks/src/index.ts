import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { queueIndex, selectTracks, type SortOrder } from '@ydown/core';
import type { MusicRuntime } from '@ydown/state';
const MusicContext = createContext<MusicRuntime | null>(null);
export function MusicProvider({
  runtime,
  children,
}: {
  runtime: MusicRuntime;
  children: ReactNode;
}) {
  return createElement(MusicContext.Provider, { value: runtime }, children);
}
export function useMusic() {
  const runtime = useContext(MusicContext);
  if (!runtime) throw new Error('Configure MusicProvider no aplicativo.');
  return runtime;
}
export function useLibrary(
  query = '',
  order: SortOrder = 'title',
  favoritesOnly = false,
  playlistId?: string,
) {
  const runtime = useMusic();
  const state = useSyncExternalStore(
    runtime.library.subscribe,
    runtime.library.getSnapshot,
    runtime.library.getSnapshot,
  );
  const tracks = useMemo(
    () => selectTracks(state.data, query, order, favoritesOnly, playlistId),
    [state.data, query, order, favoritesOnly, playlistId],
  );
  const selectedPlaylist = state.data.playlists.find((p) => p.id === playlistId);
  const availableTracks = useMemo(
    () =>
      selectedPlaylist
        ? state.data.tracks.filter((t) => !selectedPlaylist.trackIds.includes(t.id))
        : [],
    [state.data.tracks, selectedPlaylist],
  );
  return {
    ...state,
    tracks,
    selectedPlaylist,
    availableTracks,
    favorite: runtime.favorite,
    retry: runtime.initialize,
    playlist: runtime.playlist,
  };
}
export function usePlayer() {
  const runtime = useMusic();
  const state = useSyncExternalStore(
    runtime.player.subscribe,
    runtime.player.getSnapshot,
    runtime.player.getSnapshot,
  );
  return {
    ...state,
    canPrevious: !!queueIndex(state.queue, state.currentId, -1),
    canNext: !!queueIndex(state.queue, state.currentId, 1),
  };
}
export function usePlayerProgress() {
  const runtime = useMusic();
  const value = useSyncExternalStore(
    runtime.progress.subscribe,
    runtime.progress.getSnapshot,
    runtime.progress.getSnapshot,
  );
  return { ...value, seek: runtime.seek };
}
