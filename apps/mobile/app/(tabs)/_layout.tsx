import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../src/lib/theme';

function TabIcon({ emoji, color }: { emoji: string; color: string }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: C['jungle-black'] },
        headerTintColor: C['text-primary'],
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: C['jungle-black'],
          borderTopColor: C.border,
        },
        tabBarActiveTintColor: C['signal-green'],
        tabBarInactiveTintColor: C['text-muted'],
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'JetBrains Mono' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'ApeCheck',
          tabBarLabel: 'scan',
          tabBarIcon: ({ color }) => <TabIcon emoji="🦍" color={color} />,
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarLabel: 'watchlist',
          tabBarIcon: ({ color }) => <TabIcon emoji="★" color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarLabel: 'alerts',
          tabBarIcon: ({ color }) => <TabIcon emoji="🔔" color={color} />,
        }}
      />
    </Tabs>
  );
}
