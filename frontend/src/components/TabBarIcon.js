import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

const TabBarIcon = ({ Icon, color, focused }) => (
  <View style={[styles.container, focused && styles.active]}>
    <Icon size={20} color={color} strokeWidth={focused ? 2.5 : 2} />
  </View>
);

export const createTabIcon = (Icon) => ({ color, focused }) => (
  <TabBarIcon Icon={Icon} color={color} focused={focused} />
);

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  active: { backgroundColor: colors.primaryLight },
});

export default TabBarIcon;
