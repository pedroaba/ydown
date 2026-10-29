import { createMusicRuntime } from '@ydown/state';
import { createBrowserAudio } from './adapters/audio';
import { desktopLibrary, desktopStorage } from './adapters/native';
export function createDesktopRuntime() {
  const runtime = createMusicRuntime({ library: desktopLibrary, audio: createBrowserAudio() });
  let restored = false;
  let lastSave = 0;
  let writes = Promise.resolve();
  const save = () => {
    if (!restored) return;
    const { currentId, queue } = runtime.player.getSnapshot();
    const { position } = runtime.progress.getSnapshot();
    const value = JSON.stringify({ currentId, queue, position });
    writes = writes
      .then(() => desktopStorage.setItem('local.playback.v1', value))
      .catch((error: unknown) => {
        runtime.player.set({
          ...runtime.player.getSnapshot(),
          error: `Não foi possível salvar a posição: ${String(error)}`,
        });
      });
    lastSave = Date.now();
  };
  let previous = runtime.player.getSnapshot();
  const stopPlayer = runtime.player.subscribe(() => {
    const next = runtime.player.getSnapshot();
    const changed =
      next.currentId !== previous.currentId ||
      next.playing !== previous.playing ||
      next.queue !== previous.queue ||
      (previous.busy && !next.busy);
    previous = next;
    if (changed && !next.busy) save();
  });
  const stopProgress = runtime.progress.subscribe(() => {
    if (Date.now() - lastSave > 2000) save();
  });
  return {
    ...runtime,
    async initialize() {
      await runtime.initialize();
      if (restored || runtime.library.getSnapshot().status !== 'ready') return;
      try {
        const raw = await desktopStorage.getItem('local.playback.v1');
        const session = raw ? JSON.parse(raw) : null;
        if (
          session &&
          typeof session.currentId === 'string' &&
          Array.isArray(session.queue) &&
          typeof session.position === 'number'
        )
          await runtime.restorePlayback(session);
      } catch (error) {
        runtime.player.set({
          ...runtime.player.getSnapshot(),
          error: `Não foi possível restaurar a fila: ${String(error)}`,
        });
      }
      restored = true;
    },
    dispose() {
      save();
      stopPlayer();
      stopProgress();
      runtime.dispose();
    },
  };
}
