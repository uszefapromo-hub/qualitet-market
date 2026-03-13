export const Colors = {
  background: '#0a0a0f',
  surface: '#0f0f1a',
  surfaceElevated: '#14141f',
  neonCyan: '#00d4ff',
  neonViolet: '#7c3aed',
  neonPink: '#f059da',
  white: '#ffffff',
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.6)',
  textMuted: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.1)',
  glass: 'rgba(255,255,255,0.05)',
};

export const Typography = {
  heading: { fontSize: 28, fontWeight: '800' as const, color: Colors.textPrimary },
  subheading: { fontSize: 20, fontWeight: '700' as const, color: Colors.textPrimary },
  title: { fontSize: 16, fontWeight: '600' as const, color: Colors.textPrimary },
  body: { fontSize: 14, color: Colors.textSecondary },
  caption: { fontSize: 12, color: Colors.textMuted },
};

export const GlassStyle = {
  backgroundColor: Colors.glass,
  borderWidth: 1,
  borderColor: Colors.border,
  borderRadius: 12,
};
