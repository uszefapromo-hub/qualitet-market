import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';
import { formatCurrency } from '@/lib/api';

type CartItem = {
  id: string;
  name: string;
  storeName: string;
  price: number;
  qty: number;
};

const INITIAL_ITEMS: CartItem[] = [
  { id: '1', name: 'Słuchawki bezprzewodowe Pro', storeName: 'AudioWorld', price: 149, qty: 1 },
  { id: '2', name: 'Smartwatch Series X', storeName: 'TechStore PL', price: 599, qty: 1 },
];

export default function CartScreen() {
  const [items, setItems] = useState<CartItem[]>(INITIAL_ITEMS);

  const updateQty = (id: string, delta: number) => {
    setItems(prev =>
      prev
        .map(item => item.id === id ? { ...item, qty: item.qty + delta } : item)
        .filter(item => item.qty > 0),
    );
  };

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = items.length > 0 ? 9.99 : 0;
  const total = subtotal + shipping;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="cart" size={22} color={Colors.neonCyan} />
        <Text style={styles.title}>Koszyk</Text>
        {items.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{items.reduce((s, i) => s + i.qty, 0)}</Text>
          </View>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Koszyk jest pusty</Text>
          <Text style={styles.emptyDesc}>Dodaj produkty, aby kontynuować zakupy.</Text>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
            {/* Items */}
            {items.map(item => (
              <GlassCard key={item.id} padding={14} style={styles.itemCard}>
                <View style={styles.itemEmoji}>
                  <Text style={{ fontSize: 28 }}>📦</Text>
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemStore}>{item.storeName}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(item.price)}</Text>
                </View>
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQty(item.id, -1)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={item.qty === 1 ? 'trash-outline' : 'remove'}
                      size={16}
                      color={item.qty === 1 ? '#f87171' : Colors.textSecondary}
                    />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQty(item.id, 1)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={16} color={Colors.neonCyan} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ))}

            {/* Summary */}
            <GlassCard padding={16} style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Podsumowanie</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Produkty ({items.reduce((s, i) => s + i.qty, 0)})</Text>
                <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Dostawa</Text>
                <Text style={styles.summaryValue}>{formatCurrency(shipping)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Razem</Text>
                <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
              </View>
            </GlassCard>
          </ScrollView>

          {/* Checkout button */}
          <View style={styles.checkoutBar}>
            <TouchableOpacity style={styles.checkoutBtn} activeOpacity={0.85}>
              <Ionicons name="card-outline" size={20} color="#000" />
              <Text style={styles.checkoutBtnText}>Przejdź do kasy — {formatCurrency(total)}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: { color: Colors.white, fontSize: 18, fontWeight: '800', flex: 1 },
  countBadge: {
    backgroundColor: Colors.neonCyan, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countText: { color: '#000', fontSize: 12, fontWeight: '800' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  emptyDesc: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  scroll: { padding: 16, gap: 12, paddingBottom: 120 },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemEmoji: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  itemStore: { color: Colors.textMuted, fontSize: 12 },
  itemPrice: { color: Colors.neonCyan, fontSize: 15, fontWeight: '800' },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { color: Colors.white, fontSize: 15, fontWeight: '700', minWidth: 20, textAlign: 'center' },
  summaryCard: { gap: 10 },
  summaryTitle: { color: Colors.white, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: Colors.textSecondary, fontSize: 14 },
  summaryValue: { color: Colors.white, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  totalLabel: { color: Colors.white, fontSize: 16, fontWeight: '800' },
  totalValue: { color: Colors.neonCyan, fontSize: 18, fontWeight: '900' },
  checkoutBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  checkoutBtn: {
    backgroundColor: Colors.neonCyan, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  checkoutBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
});
