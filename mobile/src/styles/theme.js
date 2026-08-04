import { StyleSheet, Platform } from 'react-native';

export const COLORS = {
  bg: '#07080d',
  bgCard: '#0a0c16',
  bgCardAlt: '#0c0f1a',
  border: '#1a1f2e',
  borderAccent: '#0e1628',
  cyan: '#00e5ff',
  cyanDim: '#00b8cc',
  cyanGlow: 'rgba(0, 229, 255, 0.15)',
  red: '#ff1e3c',
  redDim: '#cc0020',
  redGlow: 'rgba(255, 30, 60, 0.15)',
  emerald: '#10b981',
  emeraldDim: '#059669',
  amber: '#f59e0b',
  white: '#f1f5f9',
  slate100: '#f1f5f9',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',
};

export const FONTS = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
};

export const card = {
  backgroundColor: COLORS.bgCard,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: COLORS.border,
  padding: 16,
};

export const glassCard = {
  ...card,
  backgroundColor: 'rgba(10, 12, 22, 0.92)',
};

export const inputField = {
  backgroundColor: 'rgba(15, 23, 42, 0.8)',
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 12,
  color: COLORS.white,
  fontSize: FONTS.sm,
  fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
};

export const btnPrimary = {
  backgroundColor: 'transparent',
  borderWidth: 1,
  borderColor: COLORS.cyan,
  borderRadius: 12,
  paddingVertical: 14,
  paddingHorizontal: 20,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: COLORS.cyan,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 4,
};

export const btnPrimaryText = {
  color: COLORS.cyan,
  fontSize: FONTS.sm,
  fontWeight: '800',
  letterSpacing: 1.5,
  textTransform: 'uppercase',
};

export const btnDanger = {
  ...btnPrimary,
  borderColor: COLORS.red,
  shadowColor: COLORS.red,
};

export const btnDangerText = {
  ...btnPrimaryText,
  color: COLORS.red,
};

export const labelText = {
  color: COLORS.slate400,
  fontSize: FONTS.xs,
  fontWeight: '700',
  letterSpacing: 1,
  textTransform: 'uppercase',
  marginBottom: 6,
};

export const headingText = {
  color: COLORS.white,
  fontSize: FONTS.xl,
  fontWeight: '800',
};

export const subText = {
  color: COLORS.slate400,
  fontSize: FONTS.xs,
};

export const rowBetween = {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
};

export const row = {
  flexDirection: 'row',
  alignItems: 'center',
};
