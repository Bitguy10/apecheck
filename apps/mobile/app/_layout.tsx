import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { addNotificationResponseListener } from '../src/lib/push';
import { C } from '../src/lib/theme';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Tapping a dump-alert notification deep-links into the token screen.
    return addNotificationResponseListener((tokenAddress) => {
      router.push(`/token/${tokenAddress}`);
    });
  }, [router]);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: C['jungle-black'] },
            headerTintColor: C['text-primary'],
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: C['jungle-black'] },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="token/[address]" options={{ title: 'Scan', presentation: 'card' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
