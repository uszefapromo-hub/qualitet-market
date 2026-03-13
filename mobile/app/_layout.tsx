import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

function TabBarIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrapper, focused && { backgroundColor: 'rgba(0,212,255,0.15)', borderRadius: 10 }]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border, borderTopWidth: 1, height: 70, paddingBottom: 10 },
        tabBarActiveTintColor: Colors.neonCyan,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="trending" options={{ title: 'Trending', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'trending-up' : 'trending-up-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="stores" options={{ title: 'Stores', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'storefront' : 'storefront-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="creator" options={{ title: 'Creator', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'people' : 'people-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} /> }} />
      </Tabs>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ iconWrapper: { padding: 6 } });
