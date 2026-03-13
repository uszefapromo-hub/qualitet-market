import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  padding?: number;
  glow?: 'cyan' | 'violet' | 'pink';
}

export function GlassCard({ children, style, padding = 16, glow, ...props }: GlassCardProps) {
  const glowColor = glow === 'cyan' ? 'rgba(0,212,255,0.15)' : glow === 'violet' ? 'rgba(124,58,237,0.15)' : glow === 'pink' ? 'rgba(240,89,218,0.15)' : undefined;
  return (
    <View style={[styles.card, { padding }, glow && { shadowColor: glowColor, shadowOpacity: 1, shadowRadius: 12, elevation: 8 }, style as any]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
  },
});
