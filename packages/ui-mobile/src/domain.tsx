import { Pressable, View, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import type { Track, Playlist, Download } from '@ydown/core';
import { describeDownload } from '@ydown/core';
import { tokens } from '@ydown/design-tokens';
import { formatBytes, formatDuration, progressRatio } from '@ydown/utils';
import { Text, Badge, Button, IconButton, Progress, Surface } from './primitives';
const c = tokens.colors;
export function TrackArtwork({
  track,
  size = 'small',
}: {
  track: Track;
  size?: 'small' | 'large';
}) {
  return (
    <View
      accessible
      accessibilityLabel={`Capa de ${track.album}`}
      style={[
        s.artwork,
        size === 'large' ? s.largeArtwork : s.smallArtwork,
        { backgroundColor: track.color },
      ]}
    >
      <Text style={{ fontSize: size === 'large' ? 84 : 26, color: '#17231c' }}>♫</Text>
    </View>
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
      selected={favorite}
      disabled={disabled}
      onPress={onToggle}
    >
      {favorite ? '♥' : '♡'}
    </IconButton>
  );
}
export function TrackItem({
  track,
  active,
  favorite,
  disabled,
  onPlay,
  onFavorite,
  onActions,
}: {
  track: Track;
  active: boolean;
  favorite: boolean;
  disabled: boolean;
  onPlay: () => void;
  onFavorite: () => void;
  onActions: () => void;
}) {
  return (
    <View style={[s.track, active && { backgroundColor: c.surface }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reproduzir ${track.title}, ${track.artist}`}
        accessibilityState={{ selected: active }}
        onPress={onPlay}
        style={s.trackMain}
      >
        <TrackArtwork track={track} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            numberOfLines={1}
            style={{ fontWeight: '600', color: active ? c.accent : c.textPrimary }}
          >
            {track.title}
          </Text>
          <Text tone="secondary" numberOfLines={1} style={{ fontSize: 13 }}>
            {track.artist} · {formatDuration(track.duration)}
          </Text>
        </View>
      </Pressable>
      <FavoriteButton favorite={favorite} disabled={disabled} onToggle={onFavorite} />
      <IconButton label={`Ações de ${track.title}`} onPress={onActions}>
        ⋯
      </IconButton>
    </View>
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
    <View style={s.controls}>
      <IconButton label="Faixa anterior" disabled={!canPrevious || busy} onPress={onPrevious}>
        |‹
      </IconButton>
      <Button
        label={playing ? 'Pausar' : 'Reproduzir'}
        variant="primary"
        disabled={busy}
        onPress={onToggle}
      >
        {playing ? 'Ⅱ' : '▶'}
      </Button>
      <IconButton label="Próxima faixa" disabled={!canNext || busy} onPress={onNext}>
        ›|
      </IconButton>
    </View>
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
    <View>
      <Slider
        accessibilityLabel="Posição da reprodução"
        accessibilityValue={{
          min: 0,
          max: duration,
          now: Math.min(position, duration),
          text: `${formatDuration(position)} de ${formatDuration(duration)}`,
        }}
        minimumValue={0}
        maximumValue={duration || 1}
        value={Math.min(position, duration)}
        disabled={!duration}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={c.accent}
        maximumTrackTintColor={c.border}
        thumbTintColor={c.accent}
      />
      <View style={s.progressLabels}>
        <Text tone="secondary" style={{ fontSize: 12 }}>
          {formatDuration(position)}
        </Text>
        <Text tone="secondary" style={{ fontSize: 12 }}>
          {formatDuration(duration)}
        </Text>
      </View>
    </View>
  );
}
export function PlaylistCard({ playlist, onOpen }: { playlist: Playlist; onOpen: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${playlist.name}, ${playlist.trackIds.length} faixas`}
      onPress={onOpen}
    >
      <Surface>
        <Text style={{ fontWeight: '600' }}>♫ {playlist.name}</Text>
        <Text tone="secondary">{playlist.trackIds.length} faixas</Text>
      </Surface>
    </Pressable>
  );
}
export function DownloadItem({ download }: { download: Download }) {
  return (
    <Surface>
      <Text>{download.title}</Text>
      <Badge>{describeDownload(download)}</Badge>
      {download.status === 'downloading' && (
        <Progress
          label={`Download de ${download.title}`}
          value={progressRatio(download.received, download.total)}
        />
      )}{' '}
      {download.status === 'completed' && (
        <Text tone="secondary">{formatBytes(download.bytes)}</Text>
      )}
    </Surface>
  );
}
const s = StyleSheet.create({
  artwork: { alignItems: 'center', justifyContent: 'center', borderRadius: tokens.radius.sm },
  smallArtwork: { width: 48, height: 48 },
  largeArtwork: { width: '100%', aspectRatio: 1, borderRadius: tokens.radius.lg },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 80,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  trackMain: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 72 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
});
