import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin, X } from 'lucide-react-native';
import { colors } from '../theme/colors';
import {
  locationMessage,
  needsLocationSettings,
  openAppSettings,
  openLocationSettings,
  LOCATION_BLOCKED,
  LOCATION_DENIED,
  LOCATION_IDLE,
  LOCATION_OK,
  LOCATION_SERVICES_OFF,
  LOCATION_TIMEOUT,
  LOCATION_UNAVAILABLE,
} from '../services/location';

const TITLES = {
  [LOCATION_SERVICES_OFF]: 'Turn on location',
  [LOCATION_BLOCKED]: 'Allow location access',
  [LOCATION_DENIED]: 'Location permission needed',
  [LOCATION_TIMEOUT]: 'Location not found',
  [LOCATION_UNAVAILABLE]: 'Location not found',
};

// Compact, dismissible status row. Success renders nothing: a working fix
// should not add chrome to the screen.
export const LocationNotice = ({ status, loading, onRetry }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || status === LOCATION_OK) return null;

  const detecting = loading && status === LOCATION_IDLE;
  if (!detecting && status === LOCATION_IDLE) return null;

  const settings = needsLocationSettings(status);
  const actionLabel = settings ? 'Open settings' : 'Retry';
  const onAction = settings
    ? () => (status === LOCATION_SERVICES_OFF ? openLocationSettings() : openAppSettings())
    : onRetry;

  return (
    <View style={styles.wrap}>
      {detecting ? (
        <ActivityIndicator size="small" color={colors.amber} />
      ) : (
        <MapPin size={16} color={colors.amber} />
      )}
      <View style={styles.textCol}>
        <Text style={styles.title}>
          {detecting ? 'Detecting your location…' : TITLES[status] || 'Location'}
        </Text>
        {detecting ? null : <Text style={styles.body}>{locationMessage(status)}</Text>}
      </View>
      {!detecting && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={() => setDismissed(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss location notice">
        <X size={16} color={colors.slate400} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.amberLight,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  textCol: { flex: 1 },
  title: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  body: { fontSize: 12, color: '#92400e', marginTop: 2, lineHeight: 16 },
  action: { fontSize: 13, fontWeight: '700', color: colors.primary700 },
});
