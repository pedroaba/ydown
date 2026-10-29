import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MusicProvider } from '@ydown/hooks';
import { tokens } from '@ydown/design-tokens';
import type { MusicRuntime } from '@ydown/state';
import { createMobileRuntime } from '../src/runtime';
export default function Layout() {
  const [runtime, setRuntime] = useState<MusicRuntime | null>(null);
  useEffect(() => {
    const next = createMobileRuntime();
    setRuntime(next);
    void next.initialize();
    return () => next.dispose();
  }, []);
  if (!runtime) return null;
  return (
    <SafeAreaProvider>
      <MusicProvider runtime={runtime}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: tokens.colors.background },
            headerTintColor: tokens.colors.textPrimary,
            contentStyle: { backgroundColor: tokens.colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false, title: 'Biblioteca' }} />
          <Stack.Screen name="player" options={{ title: 'Agora tocando', presentation: 'modal' }} />
        </Stack>
      </MusicProvider>
    </SafeAreaProvider>
  );
}
