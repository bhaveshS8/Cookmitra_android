import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors } from '../theme/colors';

// Each variant pairs a container style with its label colour and spinner colour.
// `light` and `ghost` are the "on-brand surface" pair, meant to sit on dark or
// saturated backgrounds (e.g. the orange cook CTA band) where the default
// primary button would have too little contrast.
const VARIANTS = {
  primary: { container: 'primary', label: 'labelSolid', spinner: colors.white },
  outline: { container: 'outline', label: 'labelOutline', spinner: colors.primary },
  danger: { container: 'danger', label: 'labelSolid', spinner: colors.white },
  light: { container: 'light', label: 'labelLight', spinner: colors.primary700 },
  ghost: { container: 'ghost', label: 'labelGhost', spinner: colors.white },
};

export const Button = ({ title, onPress, variant = 'primary', disabled = false, loading = false, icon = null, testID }) => {
  const preset = VARIANTS[variant] || VARIANTS.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityRole="button"
      testID={testID}
      style={[styles.base, styles[preset.container], (disabled || loading) && styles.disabled]}>
      {loading ? (
        <ActivityIndicator color={preset.spinner} />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={[styles.label, styles[preset.label]]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.rose },
  outline: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primary },
  // Solid white CTA for branded/dark surfaces; carries a soft warm shadow so it
  // reads as a raised, tappable element rather than a flat white block.
  light: {
    backgroundColor: colors.white,
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  // Transparent outlined CTA with white text, for secondary actions on the same surface.
  ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' },
  disabled: { opacity: 0.6 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 16, fontWeight: '700' },
  labelSolid: { color: colors.white },
  labelOutline: { color: colors.primary },
  labelLight: { color: colors.primary700 },
  labelGhost: { color: colors.white },
});
