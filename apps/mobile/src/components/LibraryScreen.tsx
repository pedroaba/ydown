import { useState } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibrary, useMusic, usePlayer } from '@ydown/hooks';
import type { SortOrder, Track } from '@ydown/core';
import { tokens } from '@ydown/design-tokens';
import { Button, Dialog, PlaylistCard, Text, TrackItem } from '@ydown/ui-mobile';
import { LibraryHeader } from './LibraryHeader';
import { MiniPlayer } from './MiniPlayer';
export function LibraryScreen() {
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<SortOrder>('title');
  const [view, setView] = useState('library');
  const [actions, setActions] = useState<Track | null>(null);
  const {
    tracks,
    data,
    selectedPlaylist: playlist,
    availableTracks,
    status,
    saving,
    error,
    favorite,
    retry,
    playlist: edit,
  } = useLibrary(query, order, view === 'favorites', view);
  const runtime = useMusic();
  const player = usePlayer();
  const visible = tracks;
  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <Text style={{ fontWeight: '800', fontSize: 26 }}>
          ydown<Text style={{ color: tokens.colors.accent }}>.</Text>
        </Text>
      </View>
      <FlatList
        data={status === 'ready' ? visible : []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <LibraryHeader
            title={playlist?.name ?? (view === 'favorites' ? 'Suas favoritas' : 'Sua biblioteca')}
            count={visible.length}
            view={view}
            query={query}
            order={order}
            playbackDisabled={!visible.length || player.busy}
            saving={saving}
            error={error}
            status={status}
            onViewChange={setView}
            onQueryChange={setQuery}
            onOrderChange={setOrder}
            onPlay={() =>
              void runtime.playTrack(
                visible[0].id,
                visible.map((t) => t.id),
              )
            }
            onRetry={() => void retry()}
          />
        }
        renderItem={({ item }) => (
          <TrackItem
            track={item}
            active={player.currentId === item.id}
            favorite={data.favoriteIds.includes(item.id)}
            disabled={saving}
            onPlay={() =>
              void runtime.playTrack(
                item.id,
                visible.map((t) => t.id),
              )
            }
            onFavorite={() => void favorite(item.id)}
            onActions={() => setActions(item)}
          />
        )}
        ListEmptyComponent={
          status === 'ready' ? (
            <View style={{ paddingVertical: 32, gap: 12 }}>
              <Text>{query ? 'Nenhuma faixa encontrada.' : 'Ainda não há faixas aqui.'}</Text>
              <Text tone="secondary">
                {view === 'favorites'
                  ? 'Use o coração para salvar suas favoritas.'
                  : 'Tente outra busca ou adicione faixas à playlist.'}
              </Text>
              {!!query && <Button onPress={() => setQuery('')}>Limpar busca</Button>}
            </View>
          ) : undefined
        }
        ListFooterComponent={
          <View style={{ gap: 16, marginTop: 24 }}>
            <Text accessibilityRole="header" style={{ fontWeight: '600', fontSize: 20 }}>
              Suas playlists
            </Text>
            {data.playlists.map((p) => (
              <PlaylistCard key={p.id} playlist={p} onOpen={() => setView(p.id)} />
            ))}
            {playlist &&
              availableTracks.map((t) => (
                <Button
                  key={t.id}
                  disabled={saving}
                  onPress={() => void edit(playlist.id, t.id, 'add')}
                >
                  Adicionar {t.title}
                </Button>
              ))}
            <Text tone="secondary" style={{ fontSize: 12, marginBottom: 24 }}>
              Demo · Estudos sonoros locais de 16 segundos.
            </Text>
          </View>
        }
      />
      {player.error && (
        <Text accessibilityRole="alert" style={{ color: tokens.colors.danger, padding: 12 }}>
          {player.error}
        </Text>
      )}
      <MiniPlayer />
      <Dialog open={!!actions} onClose={() => setActions(null)} title={actions?.title ?? 'Ações'}>
        <Button
          onPress={() => {
            if (actions) runtime.enqueue(actions.id);
            setActions(null);
          }}
        >
          Adicionar à fila
        </Button>
        {playlist && (
          <Button
            disabled={saving}
            onPress={() => {
              if (actions) void edit(playlist.id, actions.id, 'remove');
              setActions(null);
            }}
          >
            Remover da playlist
          </Button>
        )}
      </Dialog>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.background },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: { paddingHorizontal: 20, paddingTop: 20 },
});
