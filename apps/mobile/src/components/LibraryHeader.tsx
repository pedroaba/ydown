import { View, StyleSheet } from 'react-native';
import type { SortOrder } from '@ydown/core';
import { tokens } from '@ydown/design-tokens';
import { Badge, Button, Input, Loading, Text } from '@ydown/ui-mobile';
type Props = {
  title: string;
  count: number;
  view: string;
  query: string;
  order: SortOrder;
  playbackDisabled: boolean;
  saving: boolean;
  error: string | null;
  status: 'loading' | 'ready' | 'error';
  onViewChange: (view: string) => void;
  onQueryChange: (query: string) => void;
  onOrderChange: (order: SortOrder) => void;
  onPlay: () => void;
  onRetry: () => void;
};
export function LibraryHeader(p: Props) {
  return (
    <View style={{ gap: 16 }}>
      <Badge>Biblioteca local</Badge>
      <Text accessibilityRole="header" style={s.title}>
        {p.title}
      </Text>
      <Text tone="secondary">{p.count} faixas · Seu espaço de música</Text>
      <View style={s.row}>
        <Button
          variant={p.view === 'library' ? 'primary' : 'secondary'}
          onPress={() => p.onViewChange('library')}
        >
          Todas
        </Button>
        <Button
          variant={p.view === 'favorites' ? 'primary' : 'secondary'}
          onPress={() => p.onViewChange('favorites')}
        >
          Favoritas
        </Button>
      </View>
      <Button variant="primary" disabled={p.playbackDisabled} onPress={p.onPlay}>
        ▶ Reproduzir tudo
      </Button>
      <Input
        label="Buscar na biblioteca"
        value={p.query}
        onChangeText={p.onQueryChange}
        placeholder="Música, artista ou álbum"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      <View style={s.row}>
        {(['title', 'artist', 'duration'] as const).map((value) => (
          <Button
            key={value}
            variant={p.order === value ? 'primary' : 'ghost'}
            onPress={() => p.onOrderChange(value)}
          >
            {{ title: 'Título', artist: 'Artista', duration: 'Duração' }[value]}
          </Button>
        ))}
      </View>
      {p.error && (
        <View accessibilityLiveRegion="polite">
          <Text style={{ color: tokens.colors.danger }}>{p.error}</Text>
          <Button disabled={p.saving} onPress={p.onRetry}>
            Tentar novamente
          </Button>
        </View>
      )}
      {p.status === 'loading' && <Loading label="Carregando biblioteca…" />}
    </View>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -1 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
});
