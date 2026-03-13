import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { GlassCard } from '@/components/GlassCard';

const MENU: { icon: string; label: string; badge?: string }[] = [
  { icon: 'bag-outline', label: 'My Orders', badge: '3' },
  { icon: 'heart-outline', label: 'Wishlist', badge: '12' },
  { icon: 'notifications-outline', label: 'Notifications', badge: '5' },
  { icon: 'settings-outline', label: 'Settings' },
  { icon: 'shield-checkmark-outline', label: 'Privacy & Security' },
];

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Profile Card */}
        <GlassCard style={styles.profileCard} padding={24}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>JK</Text>
            </View>
          </View>
          <Text style={styles.name}>Jan Kowalski</Text>
          <Text style={styles.email}>jan.kowalski@email.com</Text>
          <View style={styles.statsRow}>
            {[['23', 'Orders'], ['12', 'Wishlist'], ['4.8 ★', 'Rating']].map(([v, l]) => (
              <View key={l} style={styles.stat}>
                <Text style={styles.statValue}>{v}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Seller / Creator */}
        <View style={styles.roleRow}>
          <GlassCard style={[styles.roleCard, { borderColor: 'rgba(0,212,255,0.3)' }]} padding={16}>
            <Ionicons name="storefront" size={22} color={Colors.neonCyan} />
            <Text style={styles.roleTitle}>Seller Hub</Text>
            <Text style={styles.roleDesc}>Manage your store</Text>
          </GlassCard>
          <GlassCard style={[styles.roleCard, { borderColor: 'rgba(240,89,218,0.3)' }]} padding={16}>
            <Ionicons name="people" size={22} color={Colors.neonPink} />
            <Text style={styles.roleTitle}>Creator Hub</Text>
            <Text style={styles.roleDesc}>Earn with affiliates</Text>
          </GlassCard>
        </View>

        {/* Menu */}
        {MENU.map(({ icon, label, badge }) => (
          <GlassCard key={label} padding={14} style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
            </View>
            <Text style={styles.menuLabel}>{label}</Text>
            {badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            )}
            <View style={styles.chevron}>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </View>
          </GlassCard>
        ))}

        <TouchableOpacity>
          <GlassCard padding={14} style={styles.signOut}>
            <Ionicons name="log-out-outline" size={20} color="#f87171" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </GlassCard>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 12 },
  profileCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.05)',
    borderColor: 'rgba(124,58,237,0.2)',
  },
  avatarContainer: { marginBottom: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.neonViolet, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.white, fontSize: 28, fontWeight: '900' },
  name: { color: Colors.white, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  email: { color: Colors.textMuted, fontSize: 13, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 24 },
  stat: { alignItems: 'center' },
  statValue: { color: Colors.neonCyan, fontWeight: '800', fontSize: 16 },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleCard: { flex: 1, gap: 6 },
  roleTitle: { color: Colors.white, fontWeight: '700', fontSize: 14 },
  roleDesc: { color: Colors.textMuted, fontSize: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.glass, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  menuLabel: { color: Colors.white, fontWeight: '600', fontSize: 14, flex: 1 },
  badge: { backgroundColor: Colors.neonCyan, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  badgeText: { color: '#000', fontSize: 11, fontWeight: '700' },
  chevron: { marginLeft: 'auto' as any },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { color: '#f87171', fontWeight: '600', fontSize: 15 },
});
