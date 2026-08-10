import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

/** Standard dark screen chrome shared by every route. */
export function Screen({ children, edges = ['top'] }: { children: React.ReactNode; edges?: ('top' | 'bottom' | 'left' | 'right')[] }) {
  return (
    <View className="flex-1 bg-jungle-black">
      <StatusBar style="light" />
      <SafeAreaView edges={edges} className="flex-1">
        {children}
      </SafeAreaView>
    </View>
  );
}
