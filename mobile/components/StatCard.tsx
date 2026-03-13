import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { GlassCard } from './GlassCard';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  positive?: boolean;
  color?: 'cyan' | 'violet' | 'pink';
}

export function StatCard({ title, value, change, positive, color = 'cyan' }: StatCardProps) {
  const accent = color === 'cyan' ? Colors.neonCyan : color === 'violet' ? Colors.neonViolet : Colors.neonPink;
  return (
    <GlassCard glow={color} style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      {change && <Text style={[styles.change, { color: positive ? '#4ade80' : '#f87171' }]}>{positive ? '↑' : '↓'} {change}</Text>}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  title: { color: Colors.textMuted, fontSize: 11, marginBottom: 6 },
  value: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  change: { fontSize: 11, fontWeight: '600' },
});
