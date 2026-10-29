import { createAudioPlayer, setAudioModeAsync, type AudioSource } from 'expo-audio';
import type { AudioAdapter, AudioEvent } from '@ydown/contracts';
const sources: Record<string, AudioSource> = {
  aurora: require('../../assets/audio/aurora.wav'),
  mare: require('../../assets/audio/mare.wav'),
  orbita: require('../../assets/audio/orbita.wav'),
  caminho: require('../../assets/audio/caminho.wav'),
};
export function createExpoAudio(): AudioAdapter {
  const player = createAudioPlayer(null, { updateInterval: 250 });
  const listeners = new Set<(event: AudioEvent) => void>();
  const emit = (event: AudioEvent) => listeners.forEach((listener) => listener(event));
  const subscription = player.addListener('playbackStatusUpdate', (status) => {
    if (status.error)
      emit({
        type: 'error',
        message: 'Não foi possível reproduzir o áudio. Selecione a faixa para tentar novamente.',
      });
    if (status.isLoaded)
      emit({ type: 'progress', position: status.currentTime, duration: status.duration });
    emit({ type: 'playing', playing: status.playing });
    if (status.didJustFinish) emit({ type: 'ended' });
  });
  return {
    async load(track) {
      const source = sources[track.source];
      if (!source) throw new Error('Áudio não encontrado neste dispositivo.');
      await setAudioModeAsync({ playsInSilentMode: true });
      player.replace(source);
    },
    async play() {
      if (player.currentTime >= player.duration && player.duration > 0) await player.seekTo(0);
      player.play();
    },
    async pause() {
      player.pause();
    },
    async seek(seconds) {
      await player.seekTo(seconds);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      subscription.remove();
      player.remove();
      listeners.clear();
    },
  };
}
