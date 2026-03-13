import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { GlassCard } from './GlassCard';
import { formatCurrency } from '@/lib/api';

export interface Product {
  id: string;
  name: string;
  price: number;
  storeName?: string;
  rating?: number;
  discount?: number;
}

interface ProductCardProps {
  product: Product;
  onPress?: () => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const price = product.discount ? product.price * (1 - product.discount / 100) : product.price;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      <GlassCard padding={0} style={styles.card}>
        <View style={styles.imageContainer}>
          <Text style={styles.emoji}>📦</Text>
          {product.discount ? (
            <View style={styles.badge}><Text style={styles.badgeText}>-{product.discount}%</Text></View>
          ) : null}
        </View>
        <View style={styles.info}>
          {product.storeName ? <Text style={styles.storeName} numberOfLines={1}>{product.storeName}</Text> : null}
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatCurrency(price)}</Text>
            {product.discount ? <Text style={styles.originalPrice}>{formatCurrency(product.price)}</Text> : null}
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { overflow: 'hidden' },
  imageContainer: { height: 140, backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  emoji: { fontSize: 40, opacity: 0.4 },
  badge: { position: 'absolute', top: 8, left: 8, backgroundColor: Colors.neonPink, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: Colors.white, fontSize: 10, fontWeight: '700' },
  info: { padding: 10 },
  storeName: { color: Colors.textMuted, fontSize: 11, marginBottom: 2 },
  name: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600', marginBottom: 6, lineHeight: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { color: Colors.neonCyan, fontSize: 14, fontWeight: '700' },
  originalPrice: { color: Colors.textMuted, fontSize: 11, textDecorationLine: 'line-through' },
});
