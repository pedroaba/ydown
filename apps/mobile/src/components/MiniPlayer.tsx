import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useLibrary, useMusic, usePlayer } from '@ydown/hooks';
import { tokens } from '@ydown/design-tokens';
import { IconButton, Text, TrackArtwork } from '@ydown/ui-mobile';
export function MiniPlayer() {
  const state = usePlayer();
  const runtime = useMusic();
  const { data } = useLibrary();
  const track = data.tracks.find((t) => t.id === state.currentId);
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: tokens.colors.border,
        backgroundColor: tokens.colors.surface,
        padding: 12,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir player completo"
        onPress={() => router.push('/player')}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}
      >
        {track && <TrackArtwork track={track} />}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1}>{track?.title ?? 'Escolha uma faixa'}</Text>
          <Text tone="secondary" style={{ fontSize: 12 }}>
            {track?.artist ?? 'Sua biblioteca está logo acima'}
          </Text>
        </View>
      </Pressable>
      <IconButton
        label={state.playing ? 'Pausar' : 'Reproduzir'}
        disabled={!track || state.busy}
        onPress={() => void runtime.togglePlayback()}
      >
        {state.playing ? 'Ⅱ' : '▶'}
      </IconButton>
    </View>
  );
}
