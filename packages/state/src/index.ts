import type { Services } from '@ydown/contracts';
import {
  editPlaylist,
  queueIndex,
  toggleFavorite,
  type Track,
  type LibraryData,
} from '@ydown/core';
export function createStore<T>(initial: T) {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next: T) => {
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
}
export type LibrarySnapshot = {
  status: 'loading' | 'ready' | 'error';
  data: LibraryData;
  saving: boolean;
  error: string | null;
};
export type PlayerSnapshot = {
  currentId: string | null;
  queue: readonly string[];
  playing: boolean;
  busy: boolean;
  error: string | null;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  volume: number;
};
const empty: LibraryData = { tracks: [], favoriteIds: [], playlists: [] };
export function createMusicRuntime(services: Services) {
  const library = createStore<LibrarySnapshot>({
    status: 'loading',
    data: empty,
    saving: false,
    error: null,
  });
  const player = createStore<PlayerSnapshot>({
    shuffle: false,
    repeat: 'off',
    volume: 1,
    currentId: null,
    queue: [],
    playing: false,
    busy: false,
    error: null,
  });
  // This store has its own subscriptions. Audio ticks never notify the library or player metadata.
  const progress = createStore({ position: 0, duration: 0 });
  let disposed = false;
  let playbackRequest = 0;
  let playbackChain = Promise.resolve();
  const updatePlayer = (patch: Partial<PlayerSnapshot>) =>
    player.set({ ...player.getSnapshot(), ...patch });
  const message = (error: unknown) =>
    error instanceof Error ? error.message : 'Operação indisponível. Tente novamente.';
  async function initialize() {
    library.set({ ...library.getSnapshot(), status: 'loading', error: null });
    try {
      const data = await services.library.load();
      if (!disposed) library.set({ status: 'ready', data, saving: false, error: null });
    } catch (error) {
      if (!disposed)
        library.set({ ...library.getSnapshot(), status: 'error', error: message(error) });
    }
  }
  async function mutate(transform: (data: LibraryData) => LibraryData) {
    const before = library.getSnapshot();
    if (before.saving || before.status !== 'ready') return;
    try {
      const data = transform(before.data);
      library.set({ ...before, data, saving: true, error: null });
      await services.library.save(data);
      if (!disposed) library.set({ ...library.getSnapshot(), saving: false });
    } catch (error) {
      if (!disposed) library.set({ ...before, saving: false, error: message(error) });
    }
  }
  const getTrack = (id: string) => library.getSnapshot().data.tracks.find((t) => t.id === id);
  function playTrack(id: string, queue?: readonly string[]) {
    const track = getTrack(id);
    if (!track) return Promise.resolve();
    const request = ++playbackRequest;
    const ids = [...new Set(queue ?? player.getSnapshot().queue)].filter((id) => !!getTrack(id));
    updatePlayer({ busy: true, error: null });
    // Serialize native loads so rapid selections cannot leave the wrong source playing.
    playbackChain = playbackChain.then(async () => {
      if (request !== playbackRequest || disposed) return;
      try {
        await services.audio.pause();
        await services.audio.load(track);
        if (request !== playbackRequest || disposed) return;
        progress.set({ position: 0, duration: track.duration });
        updatePlayer({ currentId: id, queue: ids.includes(id) ? ids : [id], playing: false });
        await services.audio.play();
        if (request === playbackRequest && !disposed) updatePlayer({ playing: true, busy: false });
      } catch (error) {
        if (request === playbackRequest && !disposed)
          updatePlayer({ error: message(error), busy: false, playing: false });
      }
    });
    return playbackChain;
  }
  async function restorePlayback(session: {
    currentId: string | null;
    queue: readonly string[];
    position: number;
  }) {
    const track = session.currentId ? getTrack(session.currentId) : undefined;
    if (!track) return;
    const request = ++playbackRequest;
    updatePlayer({ busy: true, playing: false, error: null });
    try {
      await services.audio.pause();
      await services.audio.load(track);
      const position = Math.min(
        track.duration,
        Math.max(0, Number.isFinite(session.position) ? session.position : 0),
      );
      await services.audio.seek(position);
      if (request !== playbackRequest || disposed) return;
      const queue = [...new Set(session.queue)].filter((id) => !!getTrack(id));
      progress.set({ position, duration: track.duration });
      updatePlayer({
        currentId: track.id,
        queue: queue.includes(track.id) ? queue : [track.id, ...queue],
        busy: false,
        playing: false,
      });
    } catch (error) {
      updatePlayer({ busy: false, playing: false, error: message(error) });
    }
  }
  async function move(direction: 1 | -1) {
    const state = player.getSnapshot();
    let id = queueIndex(state.queue, state.currentId, direction);
    if (state.shuffle && state.queue.length > 1) {
      const choices = state.queue.filter((id) => id !== state.currentId);
      id = choices[Math.floor(Math.random() * choices.length)];
    } else if (!id && state.repeat === 'all') {
      id = direction === 1 ? (state.queue[0] ?? null) : (state.queue.at(-1) ?? null);
    }
    if (id) await playTrack(id);
  }
  async function togglePlayback() {
    const state = player.getSnapshot();
    if (!state.currentId || state.busy) return;
    updatePlayer({ busy: true, error: null });
    try {
      if (state.playing) await services.audio.pause();
      else await services.audio.play();
      updatePlayer({ playing: !state.playing, busy: false });
    } catch (error) {
      updatePlayer({ error: message(error), busy: false, playing: false });
    }
  }
  async function seek(value: number) {
    const state = progress.getSnapshot();
    const position = Math.min(state.duration, Math.max(0, Number.isFinite(value) ? value : 0));
    try {
      await services.audio.seek(position);
      progress.set({ ...state, position });
    } catch (error) {
      updatePlayer({ error: message(error) });
    }
  }
  const unsubscribe = services.audio.subscribe((event) => {
    if (disposed) return;
    switch (event.type) {
      case 'progress':
        progress.set({ position: event.position, duration: event.duration });
        break;
      case 'playing':
        if (player.getSnapshot().playing !== event.playing)
          updatePlayer({ playing: event.playing });
        break;
      case 'ended':
        updatePlayer({ playing: false });
        if (player.getSnapshot().repeat === 'one' && player.getSnapshot().currentId) {
          void playTrack(player.getSnapshot().currentId!);
        } else void move(1);
        break;
      case 'error':
        updatePlayer({ error: event.message, busy: false, playing: false });
        break;
    }
  });
  return {
    library,
    player,
    progress,
    initialize,
    playTrack,
    restorePlayback,
    togglePlayback,
    seek,
    next: () => move(1),
    previous: () => move(-1),
    addTracks: (tracks: readonly Track[]) =>
      mutate((data) => {
        const ids = new Set(data.tracks.map((t) => t.id));
        const added = tracks.filter((track) => {
          if (ids.has(track.id)) return false;
          ids.add(track.id);
          return true;
        });
        return { ...data, tracks: [...data.tracks, ...added] };
      }),
    createPlaylist: (name: string) =>
      mutate((data) => ({
        ...data,
        playlists: [
          ...data.playlists,
          {
            id: `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            name: name.trim(),
            trackIds: [],
          },
        ],
      })),
    renamePlaylist: (id: string, name: string) =>
      mutate((data) => ({
        ...data,
        playlists: data.playlists.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)),
      })),
    deletePlaylist: (id: string) =>
      mutate((data) => ({ ...data, playlists: data.playlists.filter((p) => p.id !== id) })),
    toggleShuffle: () => updatePlayer({ shuffle: !player.getSnapshot().shuffle }),
    cycleRepeat: () => {
      const repeat = player.getSnapshot().repeat;
      updatePlayer({ repeat: repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off' });
    },
    setVolume: async (value: number) => {
      const volume = Math.min(1, Math.max(0, value));
      try {
        await services.audio.setVolume?.(volume);
        updatePlayer({ volume });
      } catch (error) {
        updatePlayer({ error: message(error) });
      }
    },
    favorite: (id: string) => mutate((data) => toggleFavorite(data, id)),
    playlist: (playlistId: string, trackId: string, action: 'add' | 'remove') =>
      mutate((data) => editPlaylist(data, playlistId, trackId, action)),
    enqueue: (id: string) => {
      if (getTrack(id)) updatePlayer({ queue: [...new Set([...player.getSnapshot().queue, id])] });
    },
    removeFromQueue: (index: number) => {
      const state = player.getSnapshot();
      // The current track stays in the queue; removing upcoming entries is reversible.
      if (state.queue[index] !== state.currentId)
        updatePlayer({ queue: state.queue.filter((_, i) => i !== index) });
    },
    dispose: () => {
      disposed = true;
      ++playbackRequest;
      unsubscribe();
      services.audio.dispose();
    },
  };
}
export type MusicRuntime = ReturnType<typeof createMusicRuntime>;

export { createLibraryRepository } from './repository';
