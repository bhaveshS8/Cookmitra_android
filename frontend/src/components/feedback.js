import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { AlertCircle, Star } from 'lucide-react-native';
import { colors, statusColors } from '../theme/colors';

export const Loader = ({ message = 'Loading…' }) => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.muted}>{message}</Text>
  </View>
);

export const EmptyState = ({ title, message, actionLabel, onAction }) => (
  <View style={styles.center}>
    <Text style={styles.emptyTitle}>{title}</Text>
    <Text style={styles.muted}>{message}</Text>
    {actionLabel ? (
      <TouchableOpacity onPress={onAction} style={styles.linkBtn}>
        <Text style={styles.link}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const ErrorBanner = ({ message, onRetry }) => {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <AlertCircle size={16} color={colors.rose} />
      <Text style={styles.bannerText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry}>
          <Text style={styles.link}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export const StatusBadge = ({ status }) => {
  const key = String(status || '').toLowerCase();
  const c = statusColors[key] || { bg: colors.slate100, fg: colors.slate600 };
  const label = String(status || 'unknown').replace(/_/g, ' ').toUpperCase();
  const boxStyle = [styles.badge, { backgroundColor: c.bg }];
  const textStyle = [styles.badgeText, { color: c.fg }];
  return (
    <View style={boxStyle}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
};

export const Stars = ({ value = 0, size = 14 }) => (
  <View style={styles.starsRow}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        color={i <= Math.round(value) ? '#f59e0b' : colors.slate300}
        fill={i <= Math.round(value) ? '#f59e0b' : 'transparent'}
      />
    ))}
  </View>
);

export const Avatar = ({ name, size = 44 }) => {
  const boxStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  };
  const textStyle = { color: colors.white, fontWeight: '800', fontSize: size * 0.4 };
  return (
    <View style={boxStyle}>
      <Text style={textStyle}>{String(name || 'C')[0].toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: 'center', gap: 8 },
  muted: { fontSize: 14, color: colors.slate500, textAlign: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.slate800 },
  linkBtn: { marginTop: 4, padding: 8 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.roseLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: { flex: 1, fontSize: 13, color: '#9f1239' },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '800' },
  starsRow: { flexDirection: 'row', gap: 2 },
});
