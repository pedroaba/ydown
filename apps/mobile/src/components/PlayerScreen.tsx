import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibrary, useMusic, usePlayer, usePlayerProgress } from '@ydown/hooks';
import {
  Button,
  FavoriteButton,
  IconButton,
  PlaybackControls,
  PlayerProgress,
  Text,
  TrackArtwork,
} from '@ydown/ui-mobile';
function ConnectedProgress() {
  const { position, duration, seek } = usePlayerProgress();
  return (
    <PlayerProgress position={position} duration={duration} onSeek={(value) => void seek(value)} />
  );
}
export function PlayerScreen() {
  const runtime = useMusic();
  const state = usePlayer();
  const { data, saving, favorite } = useLibrary();
  const track = data.tracks.find((t) => t.id === state.currentId);
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{
          padding: 24,
          gap: 8,
          maxWidth: 560,
          width: '100%',
          alignSelf: 'center',
        }}
        data={state.queue.map((id, index) => ({ id, index }))}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ gap: 24 }}>
            {track ? (
              <>
                <TrackArtwork track={track} size="large" />
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: '700' }}>
                      {track.title}
                    </Text>
                    <Text tone="secondary">
                      {track.artist} · {track.album}
                    </Text>
                  </View>
                  <FavoriteButton
                    disabled={saving}
                    favorite={data.favoriteIds.includes(track.id)}
                    onToggle={() => void favorite(track.id)}
                  />
                </View>
                <ConnectedProgress />
                <PlaybackControls
                  playing={state.playing}
                  busy={state.busy}
                  canPrevious={state.canPrevious}
                  canNext={state.canNext}
                  onToggle={() => void runtime.togglePlayback()}
                  onPrevious={() => void runtime.previous()}
                  onNext={() => void runtime.next()}
                />
              </>
            ) : (
              <Text>Escolha uma faixa na biblioteca para começar.</Text>
            )}
            {state.error && <Text accessibilityRole="alert">{state.error}</Text>}
            <Text accessibilityRole="header" style={{ fontWeight: '600', fontSize: 20 }}>
              Fila de reprodução
            </Text>
          </View>
        }
        ListEmptyComponent={<Text tone="secondary">Sua fila está vazia.</Text>}
        renderItem={({ item }) => {
          const t = data.tracks.find((t) => t.id === item.id);
          return t ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View style={{ flex: 1 }}>
                <Button variant="ghost" onPress={() => void runtime.playTrack(t.id)}>
                  {t.title}
                  {t.id === state.currentId ? ' · Atual' : ''}
                </Button>
              </View>
              <IconButton
                label={`Remover ${t.title} da fila`}
                disabled={t.id === state.currentId}
                onPress={() => runtime.removeFromQueue(item.index)}
              >
                ×
              </IconButton>
            </View>
          ) : null;
        }}
      />
    </SafeAreaView>
  );
}
