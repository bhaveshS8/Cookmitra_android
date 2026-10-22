import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { colors } from '../theme/colors';

export const BrandHeader = ({ compact = false, onPress, accessibilityLabel = 'Go to home' }) => {
  const content = (
    <>
      <Image source={require('../../assets/logo.jpg')} style={compact ? styles.logoSm : styles.logo} />
      <Text style={compact ? styles.nameSm : styles.name}>
        Cook<Text style={styles.accent}>Mitra</Text>
      </Text>
    </>
  );
  if (!onPress) {
    return <View style={styles.wrap}>{content}</View>;
  }
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.wrap}>
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  logoSm: { width: 36, height: 36, borderRadius: 10 },
  name: { fontSize: 26, fontWeight: '800', color: colors.slate900 },
  nameSm: { fontSize: 19, fontWeight: '800', color: colors.slate900 },
  accent: { color: colors.primary },
});
