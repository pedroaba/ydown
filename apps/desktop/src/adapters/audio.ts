import { audioSource } from './native';
import type { AudioAdapter, AudioEvent } from '@ydown/contracts';
export function createBrowserAudio(): AudioAdapter {
  const audio = new Audio();
  audio.preload = 'metadata';
  const listeners = new Set<(event: AudioEvent) => void>();
  const emit = (event: AudioEvent) => listeners.forEach((listener) => listener(event));
  const handlers = {
    timeupdate: () =>
      emit({
        type: 'progress',
        position: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      }),
    loadedmetadata: () =>
      emit({ type: 'progress', position: audio.currentTime, duration: audio.duration }),
    play: () => emit({ type: 'playing', playing: true }),
    pause: () => emit({ type: 'playing', playing: false }),
    ended: () => emit({ type: 'ended' }),
    error: () =>
      emit({
        type: 'error',
        message: 'Não foi possível abrir o áudio. Selecione a faixa para tentar novamente.',
      }),
  };
  Object.entries(handlers).forEach(([event, handler]) => audio.addEventListener(event, handler));
  return {
    async load(track) {
      audio.src = await audioSource(track.source);
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          audio.removeEventListener('loadedmetadata', ready);
          audio.removeEventListener('error', failed);
        };
        const ready = () => {
          cleanup();
          resolve();
        };
        const failed = () => {
          cleanup();
          reject(new Error('Não foi possível abrir este áudio. Baixe-o novamente.'));
        };
        const timer = setTimeout(failed, 15000);
        audio.addEventListener('loadedmetadata', ready, { once: true });
        audio.addEventListener('error', failed, { once: true });
        audio.load();
      });
    },
    async setVolume(value) {
      audio.volume = Math.min(1, Math.max(0, value));
    },
    async play() {
      await audio.play();
    },
    async pause() {
      audio.pause();
    },
    async seek(seconds) {
      audio.currentTime = seconds;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      audio.pause();
      Object.entries(handlers).forEach(([event, handler]) =>
        audio.removeEventListener(event, handler),
      );
      audio.removeAttribute('src');
      audio.load();
      listeners.clear();
    },
  };
}
