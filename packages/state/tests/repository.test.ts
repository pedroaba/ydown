import { describe, expect, it, vi } from 'vitest';
import { toggleFavorite } from '@ydown/core';
import { demoLibrary } from '@ydown/core/demo';
import { createLibraryRepository } from '../src/repository';
describe('persistência da biblioteca', () => {
  it('restaura apenas IDs válidos e preserva as edições entre sessões', async () => {
    let value: string | null = null;
    const storage = {
      getItem: async () => value,
      setItem: async (_: string, next: string) => {
        value = next;
      },
    };
    const repo = createLibraryRepository(storage, demoLibrary);
    await repo.save(toggleFavorite(demoLibrary, 'mare'));
    expect((await createLibraryRepository(storage, demoLibrary).load()).favoriteIds).toContain(
      'mare',
    );
    value = JSON.stringify({
      version: 1,
      favoriteIds: ['missing', 'aurora', 'aurora'],
      playlists: [],
    });
    expect((await repo.load()).favoriteIds).toEqual(['aurora']);
  });
  it('não sobrescreve silenciosamente arquivos inválidos', async () => {
    const repo = createLibraryRepository(
      { getItem: async () => '{invalid', setItem: vi.fn() },
      demoLibrary,
    );
    await expect(repo.load()).rejects.toThrow();
  });
});
