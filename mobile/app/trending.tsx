import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';
import { ProductCard } from '@/components/ProductCard';

const CATEGORIES = ['All', 'Electronics', 'Fashion', 'Home', 'Sports', 'Beauty'];
const TABS = ['Viral', 'Best Sellers', 'New'];

const PRODUCTS = Array.from({ length: 10 }, (_, i) => ({
  id: String(i + 1),
  name: [
    'Wireless Earbuds Pro', 'Smart LED Lamp', 'Yoga Mat', 'Coffee Maker',
    'Running Shoes', 'Laptop Stand', 'Phone Holder', 'Bluetooth Speaker',
    'Fitness Tracker', 'Desk Organizer',
  ][i],
  price: [149, 89, 199, 349, 279, 159, 49, 199, 129, 79][i],
  storeName: [
    'TechWorld', 'HomeDecor', 'FitLife', 'KitchenPro',
    'SportZone', 'DeskSetup', 'AutoGadgets', 'AudioHub', 'HealthTech', 'OfficePro',
  ][i],
  rating: 4.5,
  reviewCount: 200,
  discount: [20, 0, 15, 10, 25, 0, 30, 5, 0, 20][i],
}));

export default function TrendingScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeCategory, setActiveCategory] = useState('All');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="flame" size={22} color={Colors.neonPink} />
        <Text style={styles.title}>Trending</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(i)}
              style={[styles.tab, activeTab === i && styles.tabActive]}
            >
              <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catsScroll}
          contentContainerStyle={styles.cats}
        >
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setActiveCategory(cat)}
              style={[styles.cat, activeCategory === cat && styles.catActive]}
            >
              <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { icon: 'trending-up' as const, label: 'Rising', value: '+28%', color: Colors.neonCyan },
            { icon: 'flame' as const, label: 'Hot', value: '1,234', color: Colors.neonPink },
            { icon: 'star' as const, label: 'Top', value: '4.9★', color: '#facc15' },
          ].map(s => (
            <GlassCard key={s.label} style={styles.statCard} padding={10}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Products Grid */}
        <View style={styles.grid}>
          {PRODUCTS.map(p => (
            <View key={p.id} style={styles.gridItem}>
              <ProductCard product={p} />
            </View>
          ))}
        </View>
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
  tabsScroll: { marginTop: 12 },
  tabs: { paddingHorizontal: 16, gap: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.neonCyan, borderColor: Colors.neonCyan },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#000' },
  catsScroll: { marginTop: 10 },
  cats: { paddingHorizontal: 16, gap: 8 },
  cat: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
  },
  catActive: { backgroundColor: Colors.neonViolet, borderColor: Colors.neonViolet },
  catText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  catTextActive: { color: Colors.white },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  gridItem: { width: '47%' },
});
