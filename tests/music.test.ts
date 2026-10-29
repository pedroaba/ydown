import { describe, expect, it, vi } from 'vitest';
import type { AudioAdapter, AudioEvent, LibraryRepository } from '@ydown/contracts';
import { editPlaylist, queueIndex, selectTracks, toggleFavorite } from '@ydown/core';
import { demoLibrary } from '@ydown/core/demo';
import { createLibraryRepository, createMusicRuntime } from '@ydown/state';
import { formatBytes, formatDuration, progressRatio } from '@ydown/utils';
function fixture(repository?: LibraryRepository) {
  let emit: (event: AudioEvent) => void = () => {};
  const audio: AudioAdapter = {
    load: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    pause: vi.fn(async () => {}),
    seek: vi.fn(async () => {}),
    subscribe: (fn) => {
      emit = fn;
      return () => {
        emit = () => {};
      };
    },
    dispose: vi.fn(),
  };
  const library = repository ?? { load: async () => demoLibrary, save: vi.fn(async () => {}) };
  const runtime = createMusicRuntime({ audio, library });
  return { runtime, audio, emit: (event: AudioEvent) => emit(event) };
}
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
describe('runtime compartilhado', () => {
  it('isola progresso de todos os assinantes de biblioteca e metadados', async () => {
    const { runtime, emit } = fixture();
    await runtime.initialize();
    const library = vi.fn();
    const player = vi.fn();
    const progress = vi.fn();
    runtime.library.subscribe(library);
    runtime.player.subscribe(player);
    runtime.progress.subscribe(progress);
    for (let i = 0; i < 50; i++) emit({ type: 'progress', position: i / 4, duration: 16 });
    expect(progress).toHaveBeenCalledTimes(50);
    expect(library).not.toHaveBeenCalled();
    expect(player).not.toHaveBeenCalled();
    runtime.dispose();
  });
  it('reproduz, pausa, retoma, busca e avança automaticamente', async () => {
    const { runtime, audio, emit } = fixture();
    await runtime.initialize();
    await runtime.playTrack('aurora', ['aurora', 'mare']);
    expect(runtime.player.getSnapshot().playing).toBe(true);
    await runtime.togglePlayback();
    expect(runtime.player.getSnapshot().playing).toBe(false);
    await runtime.togglePlayback();
    expect(runtime.player.getSnapshot().playing).toBe(true);
    await runtime.seek(999);
    expect(audio.seek).toHaveBeenLastCalledWith(16);
    emit({ type: 'ended' });
    await vi.waitFor(() => expect(runtime.player.getSnapshot().currentId).toBe('mare'));
    await runtime.next();
    expect(runtime.player.getSnapshot().currentId).toBe('mare');
    runtime.dispose();
  });
  it('mantém identidades estáveis e remove apenas faixas futuras', async () => {
    const { runtime } = fixture();
    await runtime.initialize();
    await runtime.playTrack('aurora', ['aurora']);
    runtime.enqueue('mare');
    runtime.enqueue('mare');
    runtime.enqueue('missing');
    expect(runtime.player.getSnapshot().queue).toEqual(['aurora', 'mare']);
    runtime.removeFromQueue(0);
    expect(runtime.player.getSnapshot().queue).toHaveLength(2);
    runtime.removeFromQueue(1);
    expect(runtime.player.getSnapshot().queue).toEqual(['aurora']);
    runtime.dispose();
  });
  it('a seleção mais recente vence carregamentos concorrentes', async () => {
    const { runtime, audio } = fixture();
    await runtime.initialize();
    let release!: () => void;
    vi.mocked(audio.load).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const first = runtime.playTrack('aurora', ['aurora', 'mare']);
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const second = runtime.playTrack('mare', ['aurora', 'mare']);
    release();
    await Promise.all([first, second]);
    expect(runtime.player.getSnapshot().currentId).toBe('mare');
    expect(audio.play).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });
  it('desfaz favorito quando a persistência falha', async () => {
    const { runtime } = fixture({
      load: async () => demoLibrary,
      save: async () => {
        throw new Error('Disco indisponível');
      },
    });
    await runtime.initialize();
    await runtime.favorite('mare');
    expect(runtime.library.getSnapshot().data.favoriteIds).not.toContain('mare');
    expect(runtime.library.getSnapshot().error).toBe('Disco indisponível');
    runtime.dispose();
  });
  it('expõe falhas de carga e permite tentar novamente', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('Sem acesso'))
      .mockResolvedValue(demoLibrary);
    const { runtime } = fixture({ load, save: async () => {} });
    await runtime.initialize();
    expect(runtime.library.getSnapshot().status).toBe('error');
    await runtime.initialize();
    expect(runtime.library.getSnapshot().status).toBe('ready');
    runtime.dispose();
  });
  it('expõe erro de áudio e libera controles para nova tentativa', async () => {
    const { runtime, audio } = fixture();
    await runtime.initialize();
    vi.mocked(audio.play).mockRejectedValueOnce(new Error('Áudio indisponível'));
    await runtime.playTrack('aurora');
    expect(runtime.player.getSnapshot()).toMatchObject({
      error: 'Áudio indisponível',
      playing: false,
      busy: false,
    });
    await runtime.playTrack('aurora');
    expect(runtime.player.getSnapshot().playing).toBe(true);
    runtime.dispose();
  });
  it('ignora eventos após desmontar o aplicativo', async () => {
    const { runtime, emit, audio } = fixture();
    await runtime.initialize();
    runtime.dispose();
    const listener = vi.fn();
    runtime.progress.subscribe(listener);
    emit({ type: 'progress', position: 10, duration: 16 });
    expect(listener).not.toHaveBeenCalled();
    expect(audio.dispose).toHaveBeenCalledOnce();
  });
});
describe('persistência e utilitários', () => {
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
  it('formata duração e tamanho e limita progresso inválido', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(-1)).toBe('0 B');
    expect(progressRatio(40, 0)).toBe(0);
    expect(progressRatio(120, 100)).toBe(1);
  });
});

describe('controles e biblioteca desktop', () => {
  it('restaura fila e posição sem reproduzir automaticamente', async () => {
    const { runtime, audio } = fixture();
    await runtime.initialize();
    await runtime.restorePlayback({
      currentId: 'mare',
      queue: ['missing', 'mare', 'mare', 'aurora'],
      position: 8,
    });
    expect(runtime.player.getSnapshot()).toMatchObject({
      currentId: 'mare',
      queue: ['mare', 'aurora'],
      playing: false,
      busy: false,
    });
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.seek).toHaveBeenLastCalledWith(8);
    expect(runtime.progress.getSnapshot().position).toBe(8);
    runtime.dispose();
  });
  it('importa sem duplicatas e persiste criação, nome e exclusão de playlists', async () => {
    const { runtime } = fixture();
    await runtime.initialize();
    const track = { ...demoLibrary.tracks[0], id: 'imported', source: 'local:hash.wav' };
    await runtime.addTracks([track, track]);
    await runtime.addTracks([track]);
    expect(
      runtime.library.getSnapshot().data.tracks.filter((t) => t.id === 'imported'),
    ).toHaveLength(1);
    await runtime.createPlaylist('Trabalho');
    const playlist = runtime.library.getSnapshot().data.playlists.at(-1)!;
    await runtime.playlist(playlist.id, track.id, 'add');
    await runtime.renamePlaylist(playlist.id, 'Foco');
    expect(runtime.library.getSnapshot().data.playlists.at(-1)).toMatchObject({
      name: 'Foco',
      trackIds: ['imported'],
    });
    await runtime.deletePlaylist(playlist.id);
    expect(runtime.library.getSnapshot().data.playlists.some((p) => p.id === playlist.id)).toBe(
      false,
    );
    runtime.dispose();
  });
  it('repete a fila, repete uma faixa e embaralha sem selecionar a atual', async () => {
    const { runtime, emit, audio } = fixture();
    await runtime.initialize();
    await runtime.playTrack('mare', ['aurora', 'mare']);
    runtime.cycleRepeat();
    await runtime.next();
    expect(runtime.player.getSnapshot().currentId).toBe('aurora');
    runtime.cycleRepeat();
    emit({ type: 'ended' });
    await vi.waitFor(() => expect(audio.play).toHaveBeenCalledTimes(3));
    expect(runtime.player.getSnapshot().currentId).toBe('aurora');
    runtime.toggleShuffle();
    await runtime.next();
    expect(runtime.player.getSnapshot().currentId).toBe('mare');
    runtime.dispose();
  });
});
