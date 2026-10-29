import type { LibraryData } from './index';
export const demoLibrary: LibraryData = {
  tracks: [
    {
      id: 'aurora',
      title: 'Aurora',
      artist: 'Ydown Sessions',
      album: 'Pequenos intervalos',
      duration: 16,
      source: 'aurora',
      color: '#b8cba5',
    },
    {
      id: 'mare',
      title: 'Maré tranquila',
      artist: 'Ydown Sessions',
      album: 'Pequenos intervalos',
      duration: 16,
      source: 'mare',
      color: '#9fbfc5',
    },
    {
      id: 'orbita',
      title: 'Órbita',
      artist: 'Ydown Sessions',
      album: 'Entre espaços',
      duration: 16,
      source: 'orbita',
      color: '#c2afd0',
    },
    {
      id: 'caminho',
      title: 'No caminho',
      artist: 'Ydown Sessions',
      album: 'Entre espaços',
      duration: 16,
      source: 'caminho',
      color: '#d3b392',
    },
  ],
  favoriteIds: ['aurora'],
  playlists: [{ id: 'pausa', name: 'Uma pausa', trackIds: ['aurora', 'mare'] }],
};
