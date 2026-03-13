import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';
import { StatCard } from '@/components/StatCard';
import { formatCurrency, formatNumber } from '@/lib/api';

const TOP_PRODUCTS = [
  { id: '1', name: 'Wireless Headphones', commission: 12, clicks: 234, conversions: 18, earning: 43.20 },
  { id: '2', name: 'Smart Watch', commission: 8, clicks: 189, conversions: 12, earning: 57.60 },
  { id: '3', name: 'LED Strip Lights', commission: 15, clicks: 412, conversions: 31, earning: 69.75 },
];

export default function CreatorScreen() {
  const [copied, setCopied] = useState('');

  const copyLink = (id: string) => {
    setCopied(id);
    Alert.alert('Copied!', 'Affiliate link copied to clipboard');
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="link" size={22} color={Colors.neonPink} />
        <Text style={styles.title}>Creator Hub</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard title="Total Earnings" value={formatCurrency(170.55)} change="23% this month" positive={true} color="cyan" />
          <StatCard title="Total Clicks" value={formatNumber(835)} change="12% up" positive={true} color="violet" />
        </View>
        <View style={styles.statsGrid}>
          <StatCard title="Conversions" value="61" change="8% up" positive={true} color="pink" />
          <StatCard title="Conv. Rate" value="7.3%" change="0.5% up" positive={true} color="cyan" />
        </View>

        {/* Referral Code */}
        <GlassCard style={styles.referralCard}>
          <Text style={styles.referralLabel}>MY REFERRAL CODE</Text>
          <GlassCard style={styles.codeCard} padding={12}>
            <Text style={styles.code} numberOfLines={1}>QUALITET-CREATOR-ABC123</Text>
            <TouchableOpacity onPress={() => copyLink('main')}>
              <Ionicons name="copy-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </GlassCard>
          <TouchableOpacity style={styles.shareBtn}>
            <Ionicons name="share-social-outline" size={16} color={Colors.neonPink} />
            <Text style={styles.shareBtnText}>Share My Link</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Top Products */}
        <Text style={styles.sectionTitle}>Top Products to Promote</Text>
        {TOP_PRODUCTS.map(product => (
          <GlassCard key={product.id} style={styles.productCard}>
            <View style={styles.productHeader}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.commission}>{product.commission}% commission</Text>
              </View>
              <Text style={styles.earning}>{formatCurrency(product.earning)}</Text>
            </View>
            <View style={styles.productStats}>
              <View style={styles.productStat}>
                <Text style={[styles.statNum, { color: Colors.neonViolet }]}>{formatNumber(product.clicks)}</Text>
                <Text style={styles.statLabel}>Clicks</Text>
              </View>
              <View style={styles.productStat}>
                <Text style={[styles.statNum, { color: Colors.neonPink }]}>{product.conversions}</Text>
                <Text style={styles.statLabel}>Sales</Text>
              </View>
            </View>
            <View style={styles.productActions}>
              <TouchableOpacity onPress={() => copyLink(product.id)} style={styles.copyBtn}>
                <Ionicons name="copy-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.copyBtnText}>{copied === product.id ? 'Copied!' : 'Copy Link'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promoteBtn}>
                <Ionicons name="flash" size={14} color="#000" />
                <Text style={styles.promoteBtnText}>Promote</Text>
              </TouchableOpacity>
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
  scroll: { padding: 16, gap: 16 },
  statsGrid: { flexDirection: 'row', gap: 12 },
  referralCard: { borderColor: 'rgba(240,89,218,0.3)', gap: 12 },
  referralLabel: { color: Colors.neonPink, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  codeCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { color: Colors.neonCyan, fontSize: 13, fontWeight: '600', flex: 1, marginRight: 8 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 12, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.glass,
  },
  shareBtnText: { color: Colors.neonPink, fontWeight: '600', fontSize: 14 },
  sectionTitle: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  productCard: { gap: 12 },
  productHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  productInfo: { flex: 1 },
  productName: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  commission: { color: Colors.neonCyan, fontSize: 12 },
  earning: { color: Colors.neonCyan, fontWeight: '800', fontSize: 16 },
  productStats: { flexDirection: 'row', gap: 12 },
  productStat: {
    flex: 1, alignItems: 'center', padding: 8, borderRadius: 8,
    backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.border,
  },
  statNum: { fontSize: 16, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 10 },
  productActions: { flexDirection: 'row', gap: 10 },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 10, borderRadius: 10, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.glass,
  },
  copyBtnText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  promoteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 10, borderRadius: 10, backgroundColor: Colors.neonCyan,
  },
  promoteBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },
});
