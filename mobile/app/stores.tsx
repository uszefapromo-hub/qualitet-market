import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';

const STORES = [
  { id: '1', name: 'TechWorld PL', description: 'Best electronics and gadgets', category: 'Electronics', rating: 4.8, productCount: 342 },
  { id: '2', name: 'Fashion Hub', description: 'Trendy fashion for everyone', category: 'Fashion', rating: 4.6, productCount: 215 },
  { id: '3', name: 'Home & Deco', description: 'Make your home beautiful', category: 'Home', rating: 4.7, productCount: 189 },
  { id: '4', name: 'Sports Zone', description: 'Everything for active lifestyle', category: 'Sports', rating: 4.5, productCount: 276 },
  { id: '5', name: 'Beauty Bar', description: 'Premium beauty products', category: 'Beauty', rating: 4.9, productCount: 134 },
  { id: '6', name: 'Kids World', description: 'Safe toys & learning materials', category: 'Kids', rating: 4.7, productCount: 98 },
  { id: '7', name: 'AutoGadgets', description: 'Smart car accessories', category: 'Automotive', rating: 4.6, productCount: 167 },
  { id: '8', name: 'BookStore', description: 'Books for curious minds', category: 'Books', rating: 4.8, productCount: 523 },
];

export default function StoresScreen() {
  const [search, setSearch] = useState('');
  const filtered = STORES.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="storefront" size={22} color={Colors.neonViolet} />
        <Text style={styles.title}>Stores</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <GlassCard style={styles.searchCard} padding={0}>
          <View style={styles.searchInner}>
            <Ionicons name="search" size={16} color={Colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search stores..."
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
            />
          </View>
        </GlassCard>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[['500+', 'Stores'], ['50K+', 'Products'], ['99%', 'Verified']].map(([v, l]) => (
          <GlassCard key={l} style={styles.statCard} padding={10}>
            <Text style={styles.statValue}>{v}</Text>
            <Text style={styles.statLabel}>{l}</Text>
          </GlassCard>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {filtered.map(store => (
          <GlassCard key={store.id} style={styles.storeCard} padding={0}>
            <View style={styles.storeBanner}>
              <View style={styles.storeLogo}>
                <Text style={styles.storeLogoText}>🏪</Text>
              </View>
              <View style={styles.storeInfo}>
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeCategory}>{store.category}</Text>
              </View>
            </View>
            <View style={styles.storeBody}>
              <Text style={styles.storeDesc} numberOfLines={2}>{store.description}</Text>
              <View style={styles.storeStats}>
                <View style={styles.storeStat}>
                  <Ionicons name="star" size={12} color="#facc15" />
                  <Text style={styles.storeStatText}>{store.rating}</Text>
                </View>
                <View style={styles.storeStat}>
                  <Ionicons name="cube-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.storeStatText}>{store.productCount} products</Text>
                </View>
                <View style={styles.chevron}>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </View>
              </View>
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { fontSize: 24, fontWeight: '900', color: Colors.white },
  searchRow: { padding: 16, paddingBottom: 0 },
  searchCard: { borderRadius: 12 },
  searchInner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  searchInput: { flex: 1, color: Colors.white, fontSize: 14 },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: Colors.neonViolet, fontSize: 16, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 10 },
  list: { padding: 16, gap: 12 },
  storeCard: { overflow: 'hidden' },
  storeBanner: {
    height: 60, backgroundColor: 'rgba(124,58,237,0.15)',
    flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 10,
  },
  storeLogo: {
    width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  storeLogoText: { fontSize: 20 },
  storeInfo: { flex: 1 },
  storeName: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  storeCategory: { color: Colors.neonCyan, fontSize: 11 },
  storeBody: { padding: 12, gap: 8 },
  storeDesc: { color: Colors.textSecondary, fontSize: 12 },
  storeStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  storeStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeStatText: { color: Colors.textSecondary, fontSize: 12 },
  chevron: { marginLeft: 'auto' as any },
});
