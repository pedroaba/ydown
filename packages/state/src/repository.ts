import type { KeyValueStorage, LibraryRepository } from '@ydown/contracts';
import type { LibraryData } from '@ydown/core';
// Only user edits are persisted. Sources and metadata remain owned by the library adapter.
export function createLibraryRepository(
  storage: KeyValueStorage,
  seed: LibraryData,
): LibraryRepository {
  return {
    async load() {
      const raw = await storage.getItem('ydown.library.v1');
      if (!raw) return seed;
      const value: unknown = JSON.parse(raw);
      if (!value || typeof value !== 'object') throw new Error('Biblioteca salva inválida.');
      const saved = value as Record<string, unknown>;
      if (
        saved.version !== 1 ||
        !Array.isArray(saved.favoriteIds) ||
        !Array.isArray(saved.playlists)
      )
        throw new Error('Formato de biblioteca não suportado.');
      const ids = new Set(seed.tracks.map((t) => t.id));
      const strings = (items: unknown[]): string[] => [
        ...new Set(items.filter((id): id is string => typeof id === 'string' && ids.has(id))),
      ];
      return {
        ...seed,
        favoriteIds: strings(saved.favoriteIds),
        playlists: saved.playlists.map((item: unknown) => {
          if (!item || typeof item !== 'object') throw new Error('Playlist salva inválida.');
          const p = item as Record<string, unknown>;
          if (typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.trackIds))
            throw new Error('Playlist salva inválida.');
          return { id: p.id, name: p.name, trackIds: strings(p.trackIds) };
        }),
      };
    },
    async save(data) {
      await storage.setItem(
        'ydown.library.v1',
        JSON.stringify({ version: 1, favoriteIds: data.favoriteIds, playlists: data.playlists }),
      );
    },
  };
}
