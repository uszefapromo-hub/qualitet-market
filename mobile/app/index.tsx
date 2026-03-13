import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';
import { ProductCard } from '@/components/ProductCard';
import { formatCurrency } from '@/lib/api';

const TRENDING = [
  { id: '1', name: 'Wireless Earbuds', price: 149, discount: 30, storeName: 'AudioWorld', rating: 4.7, reviewCount: 543 },
  { id: '2', name: 'Phone Stand', price: 49, discount: 0, storeName: 'DeskSetup', rating: 4.5, reviewCount: 234 },
  { id: '3', name: 'LED Strip Lights', price: 89, discount: 25, storeName: 'SmartHome', rating: 4.6, reviewCount: 789 },
  { id: '4', name: 'Keyboard Mech', price: 349, discount: 10, storeName: 'TechStore', rating: 4.8, reviewCount: 432 },
];

const FEED = [
  { id: '1', name: 'Premium Wireless Headphones', price: 299, discount: 20, storeName: 'TechStore PL', likes: 1247, comments: 89 },
  { id: '2', name: 'Smart Watch Series X', price: 599, discount: 15, storeName: 'GadgetHub', likes: 892, comments: 54 },
];

function FeedCard({ item }: { item: typeof FEED[0] }) {
  const [liked, setLiked] = useState(false);
  const price = item.discount ? item.price * (1 - item.discount / 100) : item.price;
  return (
    <GlassCard style={styles.feedCard} padding={0}>
      <View style={styles.feedHeader}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{item.storeName[0]}</Text></View>
        <Text style={styles.feedStore}>{item.storeName}</Text>
        <Text style={styles.feedTime}>Just now</Text>
      </View>
      <View style={styles.feedImage}>
        <Text style={styles.feedEmoji}>📦</Text>
        {item.discount ? <View style={styles.feedBadge}><Text style={styles.feedBadgeText}>-{item.discount}%</Text></View> : null}
      </View>
      <View style={styles.feedContent}>
        <Text style={styles.feedName}>{item.name}</Text>
        <View style={styles.feedPriceRow}>
          <Text style={styles.feedPrice}>{formatCurrency(price)}</Text>
          {item.discount ? <Text style={styles.feedOriginalPrice}>{formatCurrency(item.price)}</Text> : null}
        </View>
        <TouchableOpacity style={styles.buyBtn} activeOpacity={0.8}>
          <Ionicons name="cart" size={16} color="#000" />
          <Text style={styles.buyBtnText}>Buy Now</Text>
        </TouchableOpacity>
        <View style={styles.feedActions}>
          <TouchableOpacity onPress={() => setLiked(l => !l)} style={styles.actionBtn}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#f87171' : Colors.textSecondary} />
            <Text style={[styles.actionText, liked && { color: '#f87171' }]}>{item.likes + (liked ? 1 : 0)}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionText}>{item.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { marginLeft: 'auto' as any }]}>
            <Ionicons name="share-social-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GlassCard>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}><Text style={styles.logoCyan}>Qualitet</Text><Text style={styles.logoSub}> Market</Text></Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}><Ionicons name="search" size={20} color={Colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Ionicons name="cart-outline" size={20} color={Colors.textSecondary} /></TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <GlassCard style={styles.hero}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE NOW</Text>
          </View>
          <Text style={styles.heroTitle}>Discover Amazing <Text style={{ color: Colors.neonCyan }}>Products</Text></Text>
          <Text style={styles.heroSub}>50,000+ products from verified stores</Text>
          <View style={styles.heroBadges}>
            {['🔥 1.2K live', '📦 50K+', '⭐ 4.8 avg'].map(b => (
              <View key={b} style={styles.heroBadge}><Text style={styles.heroBadgeText}>{b}</Text></View>
            ))}
          </View>
        </GlassCard>

        {/* Trending */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={16} color={Colors.neonCyan} />
            <Text style={styles.sectionTitle}>Trending Now</Text>
          </View>
          <View style={styles.trendingGrid}>
            {TRENDING.map(p => <View key={p.id} style={styles.trendingItem}><ProductCard product={p} /></View>)}
          </View>
        </View>

        {/* Feed */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.feedDot} />
            <Text style={styles.sectionTitle}>Live Feed</Text>
          </View>
          {FEED.map(item => <FeedCard key={item.id} item={item} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.surface },
  logo: { fontSize: 20, fontWeight: '900' },
  logoCyan: { color: Colors.neonCyan },
  logoSub: { color: Colors.textMuted, fontSize: 14, fontWeight: '300' },
  headerRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 10, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border },
  scroll: { padding: 16, gap: 20 },
  hero: { backgroundColor: 'rgba(0,212,255,0.05)', borderColor: 'rgba(0,212,255,0.2)' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.neonCyan },
  liveText: { color: Colors.neonCyan, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  heroTitle: { fontSize: 22, fontWeight: '900', color: Colors.white, marginBottom: 4 },
  heroSub: { color: Colors.textMuted, fontSize: 13, marginBottom: 12 },
  heroBadges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  heroBadge: { backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  heroBadgeText: { color: Colors.textSecondary, fontSize: 11 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  trendingItem: { width: '47%' },
  feedCard: { overflow: 'hidden' },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.neonViolet, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  feedStore: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
  feedTime: { color: Colors.textMuted, fontSize: 11 },
  feedImage: { height: 200, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  feedEmoji: { fontSize: 60, opacity: 0.2 },
  feedBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: Colors.neonPink, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  feedBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  feedContent: { padding: 14, gap: 10 },
  feedName: { color: Colors.white, fontSize: 15, fontWeight: '600' },
  feedPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedPrice: { color: Colors.neonCyan, fontSize: 20, fontWeight: '800' },
  feedOriginalPrice: { color: Colors.textMuted, fontSize: 13, textDecorationLine: 'line-through' },
  buyBtn: { backgroundColor: Colors.neonCyan, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buyBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  feedActions: { flexDirection: 'row', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: Colors.textSecondary, fontSize: 13 },
  feedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.neonCyan },
});
