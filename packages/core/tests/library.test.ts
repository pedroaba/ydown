import { describe, expect, it } from 'vitest';
import { editPlaylist, queueIndex, selectTracks, toggleFavorite } from '../src/index';
import { demoLibrary } from '../src/demo';
describe('casos de uso independentes de plataforma', () => {
  it('busca sem acento, ordena e filtra favoritas sem alterar a fonte', () => {
    expect(selectTracks(demoLibrary, 'mare', 'title').map((t) => t.id)).toEqual(['mare']);
    expect(selectTracks(demoLibrary, '', 'title', true).map((t) => t.id)).toEqual(['aurora']);
    expect(selectTracks(demoLibrary, '', 'title').map((t) => t.id)).toEqual([
      'aurora',
      'mare',
      'caminho',
      'orbita',
    ]);
    expect(selectTracks(demoLibrary, '', 'title', false, 'pausa').map((t) => t.id)).toEqual([
      'aurora',
      'mare',
    ]);
    expect(demoLibrary.tracks[2].id).toBe('orbita');
  });
  it('favorita e desfavorita com validação de identidade', () => {
    const next = toggleFavorite(demoLibrary, 'mare');
    expect(next.favoriteIds).toContain('mare');
    expect(toggleFavorite(next, 'mare').favoriteIds).not.toContain('mare');
    expect(() => toggleFavorite(demoLibrary, 'missing')).toThrow('Faixa não encontrada');
  });
  it('adiciona sem duplicar e remove da playlist', () => {
    expect(editPlaylist(demoLibrary, 'pausa', 'aurora', 'add').playlists[0].trackIds).toHaveLength(
      2,
    );
    expect(editPlaylist(demoLibrary, 'pausa', 'orbita', 'add').playlists[0].trackIds).toContain(
      'orbita',
    );
    expect(
      editPlaylist(demoLibrary, 'pausa', 'aurora', 'remove').playlists[0].trackIds,
    ).not.toContain('aurora');
    expect(() => editPlaylist(demoLibrary, 'missing', 'aurora', 'add')).toThrow();
  });
  it('respeita limites da fila', () => {
    expect(queueIndex(['aurora', 'mare'], 'aurora', -1)).toBeNull();
    expect(queueIndex(['aurora', 'mare'], 'aurora', 1)).toBe('mare');
    expect(queueIndex(['aurora', 'mare'], 'mare', 1)).toBeNull();
  });
});
