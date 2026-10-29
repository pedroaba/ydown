import type { Download, Playlist, Track } from '@ydown/core';
import { describeDownload } from '@ydown/core';
import { formatBytes, formatDuration, progressRatio } from '@ydown/utils';
import {
  Heart,
  MoreHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music2,
  ListPlus,
} from 'lucide-react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Badge, Button, IconButton, Progress, Surface } from './primitives';
export function TrackArtwork({
  track,
  size = 'small',
}: {
  track: Track;
  size?: 'small' | 'large';
}) {
  return (
    <div
      className={`artwork artwork-${size}`}
      style={{ '--art-color': track.color } as React.CSSProperties}
      role="img"
      aria-label={`Capa de ${track.album}`}
    >
      {track.artwork ? <img src={track.artwork} alt="" /> : <Music2 aria-hidden="true" />}
    </div>
  );
}
export function FavoriteButton({
  favorite,
  onToggle,
  disabled = false,
}: {
  favorite: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <IconButton
      label={favorite ? 'Desfavoritar' : 'Favoritar'}
      aria-pressed={favorite}
      onClick={onToggle}
      disabled={disabled}
    >
      <Heart size={18} fill={favorite ? 'currentColor' : 'none'} />
    </IconButton>
  );
}
export function TrackItem({
  track,
  index,
  active,
  favorite,
  disabled,
  onPlay,
  onFavorite,
  onEnqueue,
}: {
  track: Track;
  index: number;
  active: boolean;
  favorite: boolean;
  disabled: boolean;
  onPlay: () => void;
  onFavorite: () => void;
  onEnqueue: () => void;
}) {
  return (
    <div
      className={`track-row ${active ? 'active' : ''}`}
      role="listitem"
      aria-current={active ? 'true' : undefined}
    >
      <span className="track-index">
        {active ? (
          <span className="playing-bars" aria-label="Faixa selecionada">
            <i />
            <i />
            <i />
            <i />
          </span>
        ) : (
          index + 1
        )}
      </span>
      <Button
        variant="ghost"
        className="track-main"
        onClick={onPlay}
        aria-label={`Reproduzir ${track.title}, ${track.artist}`}
      >
        <TrackArtwork track={track} />
        <span>
          <strong>{track.title}</strong>
          <span className="track-artist">{track.artist}</span>
        </span>
      </Button>
      <span className="track-artist-column muted">{track.artist}</span>
      <span className="track-album muted">{track.album}</span>
      <span className="duration muted">{formatDuration(track.duration)}</span>
      <FavoriteButton favorite={favorite} onToggle={onFavorite} disabled={disabled} />
      <Menu.Root>
        <Menu.Trigger asChild>
          <IconButton label={`Ações de ${track.title}`}>
            <MoreHorizontal size={20} />
          </IconButton>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content className="menu" sideOffset={4}>
            <Menu.Item onSelect={onEnqueue}>
              <ListPlus size={16} /> Adicionar à fila
            </Menu.Item>
            <Menu.Item onSelect={onPlay}>
              <Play size={16} /> Reproduzir agora
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}
export function PlaybackControls({
  playing,
  busy,
  canPrevious,
  canNext,
  onToggle,
  onPrevious,
  onNext,
}: {
  playing: boolean;
  busy: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="playback-controls">
      <IconButton label="Faixa anterior" disabled={!canPrevious || busy} onClick={onPrevious}>
        <SkipBack size={20} />
      </IconButton>
      <Button
        variant="primary"
        className="play-toggle"
        aria-label={playing ? 'Pausar' : 'Reproduzir'}
        disabled={busy}
        onClick={onToggle}
      >
        {playing ? <Pause size={22} /> : <Play size={22} />}
      </Button>
      <IconButton label="Próxima faixa" disabled={!canNext || busy} onClick={onNext}>
        <SkipForward size={20} />
      </IconButton>
    </div>
  );
}
export function PlayerProgress({
  position,
  duration,
  onSeek,
}: {
  position: number;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  return (
    <div className="player-progress">
      <span>{formatDuration(position)}</span>
      <input
        aria-label="Posição da reprodução"
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={Math.min(position, duration)}
        disabled={!duration}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-valuetext={`${formatDuration(position)} de ${formatDuration(duration)}`}
      />
      <span>{formatDuration(duration)}</span>
    </div>
  );
}
export function PlaylistCard({ playlist, onOpen }: { playlist: Playlist; onOpen: () => void }) {
  return (
    <Button variant="ghost" className="playlist-card" onClick={onOpen}>
      <Music2 size={20} />
      <span>
        <strong>{playlist.name}</strong>
        <small>{playlist.trackIds.length} faixas</small>
      </span>
    </Button>
  );
}
export function DownloadItem({ download }: { download: Download }) {
  return (
    <Surface>
      <div className="section-heading">
        <strong>{download.title}</strong>
        <Badge>{describeDownload(download)}</Badge>
      </div>
      {download.status === 'downloading' && (
        <Progress
          label={`Download de ${download.title}`}
          value={progressRatio(download.received, download.total)}
        />
      )}
      <span className="muted">
        {download.status === 'completed'
          ? formatBytes(download.bytes)
          : download.status === 'failed'
            ? 'Tente baixar novamente.'
            : ''}
      </span>
    </Surface>
  );
}
