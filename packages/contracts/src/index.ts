import type { LibraryData, Track } from '@ydown/core';
export interface LibraryRepository {
  load(): Promise<LibraryData>;
  save(data: LibraryData): Promise<void>;
}
export type AudioEvent =
  | { type: 'progress'; position: number; duration: number }
  | { type: 'playing'; playing: boolean }
  | { type: 'ended' }
  | { type: 'error'; message: string };
export interface AudioAdapter {
  load(track: Track): Promise<void>;
  play(): Promise<void>;
  setVolume?(value: number): Promise<void>;
  pause(): Promise<void>;
  seek(seconds: number): Promise<void>;
  subscribe(listener: (event: AudioEvent) => void): () => void;
  dispose(): void;
}
export type Services = { library: LibraryRepository; audio: AudioAdapter };

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type MediaKind = 'audio' | 'video';
export interface MediaPreview {
  videoId: string;
  url: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail?: string;
}
export interface AcquisitionJob {
  id: string;
  url: string;
  kind: MediaKind;
  title: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
  received: number;
  total: number | null;
  error: string | null;
  trackId: string | null;
  createdAt: number;
}
export interface MediaAcquisitionService {
  preview(url: string): Promise<MediaPreview>;
  enqueue(url: string, kind: MediaKind): Promise<AcquisitionJob>;
  list(): Promise<AcquisitionJob[]>;
  cancel(id: string): Promise<void>;
  retry(id: string): Promise<void>;
}
