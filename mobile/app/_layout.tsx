import { useEffect, useState, useCallback } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '@/constants/theme';

/** Minimum time (ms) the in-app loading screen is shown before handing off. */
const MIN_SPLASH_DURATION_MS = 500;
// Keep the native splash screen visible while we initialize the app.
SplashScreen.preventAutoHideAsync();

function TabBarIcon({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrapper, focused && { backgroundColor: 'rgba(0,212,255,0.15)', borderRadius: 10 }]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

function LoadingScreen() {
  return (
    <SafeAreaView style={styles.loadingContainer}>
      <View style={styles.loadingContent}>
        <Text style={styles.loadingLogo}>
          <Text style={styles.loadingLogoCyan}>Qualitet</Text>
          <Text style={styles.loadingLogoSub}> Market</Text>
        </Text>
        <ActivityIndicator size="large" color={Colors.neonCyan} style={styles.loadingSpinner} />
        <Text style={styles.loadingText}>Ładowanie aplikacji…</Text>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Perform any async initialization here (load fonts, check auth, etc.)
        // Simulate minimal async work so the loading screen is visible.
        await new Promise<void>(resolve => setTimeout(resolve, MIN_SPLASH_DURATION_MS));
      } catch {
        // Non-fatal: continue loading even if prep fails.
      } finally {
        setAppReady(true);
      }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) {
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return <LoadingScreen />;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.border, borderTopWidth: 1, height: 70, paddingBottom: 10 },
        tabBarActiveTintColor: Colors.neonCyan,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.4)',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="trending" options={{ title: 'Trending', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'trending-up' : 'trending-up-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="cart" options={{ title: 'Koszyk', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'cart' : 'cart-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="stores" options={{ title: 'Sklepy', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'storefront' : 'storefront-outline'} color={color} focused={focused} /> }} />
        <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, focused }) => <TabBarIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} /> }} />
        {/* Non-tab screens – accessible via navigation but hidden from the tab bar */}
        <Tabs.Screen name="creator" options={{ href: null, title: 'Creator' }} />
        <Tabs.Screen name="login" options={{ href: null, title: 'Logowanie' }} />
        <Tabs.Screen name="orders" options={{ href: null, title: 'Zamówienia' }} />
        <Tabs.Screen name="checkout" options={{ href: null, title: 'Kasa' }} />
      </Tabs>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  iconWrapper: { padding: 6 },
  loadingContainer: { flex: 1, backgroundColor: Colors.background },
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingLogo: { fontSize: 32, fontWeight: '900' },
  loadingLogoCyan: { color: Colors.neonCyan },
  loadingLogoSub: { color: Colors.textMuted, fontSize: 22, fontWeight: '300' },
  loadingSpinner: { marginTop: 8 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
});
