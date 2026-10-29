import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLibraryRepository, createMusicRuntime } from '@ydown/state';
import { createExpoAudio } from './adapters/audio';
export function createMobileRuntime() {
  return createMusicRuntime({
    library: createLibraryRepository(AsyncStorage, { tracks: [], favoriteIds: [], playlists: [] }),
    audio: createExpoAudio(),
  });
}
