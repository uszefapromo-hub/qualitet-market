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

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

type Order = {
  id: string;
  number: string;
  date: string;
  total: number;
  status: OrderStatus;
  items: number;
  storeName: string;
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  pending: { label: 'Oczekuje', color: '#f59e0b', icon: 'time-outline' },
  processing: { label: 'W realizacji', color: Colors.neonCyan, icon: 'refresh-outline' },
  shipped: { label: 'Wysłane', color: Colors.neonViolet, icon: 'airplane-outline' },
  delivered: { label: 'Dostarczone', color: '#22c55e', icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Anulowane', color: '#f87171', icon: 'close-circle-outline' },
};

const ORDERS: Order[] = [
  { id: '1', number: 'QM-104892', date: '13 mar 2026', total: 748.00, status: 'delivered', items: 2, storeName: 'TechStore PL' },
  { id: '2', number: 'QM-103211', date: '8 mar 2026', total: 149.00, status: 'shipped', items: 1, storeName: 'AudioWorld' },
  { id: '3', number: 'QM-101873', date: '1 mar 2026', total: 299.00, status: 'processing', items: 1, storeName: 'GadgetHub' },
  { id: '4', number: 'QM-099534', date: '18 lut 2026', total: 89.99, status: 'delivered', items: 3, storeName: 'SmartHome' },
  { id: '5', number: 'QM-097210', date: '5 lut 2026', total: 599.00, status: 'cancelled', items: 1, storeName: 'TechStore PL' },
];

type FilterTab = 'all' | OrderStatus;
const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'processing', label: 'W toku' },
  { id: 'shipped', label: 'Wysłane' },
  { id: 'delivered', label: 'Dostarczone' },
  { id: 'cancelled', label: 'Anulowane' },
];

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];
  return (
    <GlassCard padding={0} style={styles.orderCard}>
      <TouchableOpacity
        style={styles.orderHeader}
        onPress={() => setExpanded(v => !v)}
        activeOpacity={0.8}
      >
        <View style={styles.orderHeaderLeft}>
          <Text style={styles.orderNumber}>{order.number}</Text>
          <Text style={styles.orderMeta}>{order.date} · {order.storeName}</Text>
        </View>
        <View style={styles.orderHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={Colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.orderBody}>
          <View style={styles.divider} />
          <View style={styles.orderDetail}>
            <Text style={styles.detailLabel}>Produkty</Text>
            <Text style={styles.detailValue}>{order.items} szt.</Text>
          </View>
          <View style={styles.orderDetail}>
            <Text style={styles.detailLabel}>Łączna kwota</Text>
            <Text style={styles.detailValueHighlight}>{formatCurrency(order.total)}</Text>
          </View>
          {order.status === 'shipped' && (
            <TouchableOpacity style={styles.trackBtn} activeOpacity={0.8}>
              <Ionicons name="location-outline" size={16} color={Colors.neonViolet} />
              <Text style={styles.trackBtnText}>Śledź przesyłkę</Text>
            </TouchableOpacity>
          )}
          {order.status === 'delivered' && (
            <TouchableOpacity style={styles.reviewBtn} activeOpacity={0.8}>
              <Ionicons name="star-outline" size={16} color={Colors.neonCyan} />
              <Text style={styles.reviewBtnText}>Oceń zamówienie</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </GlassCard>
  );
}

export default function OrdersScreen() {
  const [filter, setFilter] = useState<FilterTab>('all');
  const filtered = filter === 'all' ? ORDERS : ORDERS.filter(o => o.status === filter);

  const totalSpent = ORDERS
    .filter(o => o.status === 'delivered')
    .reduce((s, o) => s + o.total, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="bag-outline" size={22} color={Colors.neonViolet} />
        <Text style={styles.title}>Moje zamówienia</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard} padding={12}>
          <Text style={styles.statValue}>{ORDERS.length}</Text>
          <Text style={styles.statLabel}>Wszystkich</Text>
        </GlassCard>
        <GlassCard style={styles.statCard} padding={12}>
          <Text style={[styles.statValue, { color: Colors.neonViolet }]}>
            {ORDERS.filter(o => o.status === 'shipped' || o.status === 'processing').length}
          </Text>
          <Text style={styles.statLabel}>W toku</Text>
        </GlassCard>
        <GlassCard style={styles.statCard} padding={12}>
          <Text style={[styles.statValue, { color: Colors.neonCyan }]}>{formatCurrency(totalSpent)}</Text>
          <Text style={styles.statLabel}>Wydano</Text>
        </GlassCard>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.filterTab, filter === tab.id && styles.filterTabActive]}
            onPress={() => setFilter(tab.id)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterTabText, filter === tab.id && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bag-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Brak zamówień w tej kategorii</Text>
          </View>
        ) : (
          filtered.map(order => <OrderCard key={order.id} order={order} />)
        )}
      </ScrollView>
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
  statsRow: { flexDirection: 'row', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statCard: { flex: 1, alignItems: 'center', gap: 3 },
  statValue: { color: Colors.white, fontSize: 16, fontWeight: '900' },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  filterRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.neonViolet, borderColor: Colors.neonViolet },
  filterTabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTabTextActive: { color: Colors.white },
  scroll: { padding: 14, gap: 10, paddingBottom: 24 },
  orderCard: { overflow: 'hidden' },
  orderHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: 14, gap: 10,
  },
  orderHeaderLeft: { flex: 1, gap: 4 },
  orderNumber: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  orderMeta: { color: Colors.textMuted, fontSize: 12 },
  orderHeaderRight: { alignItems: 'flex-end', gap: 8 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  divider: { height: 1, backgroundColor: Colors.border },
  orderDetail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { color: Colors.textMuted, fontSize: 13 },
  detailValue: { color: Colors.white, fontSize: 13, fontWeight: '600' },
  detailValueHighlight: { color: Colors.neonCyan, fontSize: 15, fontWeight: '800' },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
  },
  trackBtnText: { color: Colors.neonViolet, fontWeight: '600', fontSize: 14 },
  reviewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,212,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,212,255,0.2)',
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14,
  },
  reviewBtnText: { color: Colors.neonCyan, fontWeight: '600', fontSize: 14 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
});
