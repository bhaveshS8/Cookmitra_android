import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getMyBookings } from '../../api/bookings';
import {
  formatCurrency, formatDate, formatTimeRange12, getBookingDisplayState,
  withoutUnpaidCancelled, dayTagLabel,
} from '../../utils/format';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Loader, ErrorBanner, EmptyState, StatusBadge } from '../../components/feedback';

const FILTERS = ['All', 'Upcoming', 'Completed', 'Cancelled'];

const MyBookingsScreen = ({ navigation }) => {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getMyBookings();
      const list = Array.isArray(data) ? data : data?.bookings || [];
      setRows(withoutUnpaidCancelled(list));
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load your bookings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(() => { load(); }, 30000);
    return () => clearInterval(timer);
  }, [load]));

  const shown = rows.filter((b) => {
    const state = getBookingDisplayState(b);
    if (filter === 'Upcoming') return ['UPCOMING', 'IN_PROGRESS'].includes(state);
    if (filter === 'Completed') return state === 'COMPLETED';
    if (filter === 'Cancelled') return ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(state);
    return true;
  });

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>My bookings</Text>
        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipOn]}>
              <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : shown.length === 0 ? (
          <EmptyState
            title="No bookings here"
            message={rows.length ? 'Try a different filter.' : 'Book your first cook and it will show up here.'}
            actionLabel={rows.length ? undefined : 'Book a cook'}
            onAction={rows.length ? undefined : () => navigation.navigate('Book', { cookId: null, couponCode: null })}
          />
        ) : (
          shown.map((b) => {
            const tag = dayTagLabel(b);
            const state = getBookingDisplayState(b);
            const needsPay = b.status === 'accepted' && b.payment?.status !== 'paid';
            const canShowOtp = ['accepted', 'confirmed'].includes(b.status)
              && b.serviceOtp
              && !b.serviceStartedAt;
            return (
              <TouchableOpacity
                key={b._id}
                style={shared.card}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: b._id })}>
                <View style={shared.spread}>
                  <Text style={shared.h3}>{formatDate(b.date)}</Text>
                  <StatusBadge status={b.status} />
                </View>
                <Text style={shared.body}>
                  {formatTimeRange12(b.startTime, b.endTime, '-')} · {formatCurrency(b.amount)}
                  {tag ? ` · ${tag}` : ''}
                </Text>
                <Text style={shared.small} numberOfLines={1}>{b.address}</Text>
                <Text style={shared.small}>{state.replace(/_/g, ' ')}</Text>
                {canShowOtp ? (
                  <Text selectable style={styles.otp}>Start OTP: {b.serviceOtp}</Text>
                ) : null}
                <View style={styles.actions}>
                  {b.status === 'requested' ? (
                    <TouchableOpacity onPress={() => navigation.navigate('BookingWait', { bookingId: b._id })}>
                      <Text style={styles.action}>View status</Text>
                    </TouchableOpacity>
                  ) : null}
                  {needsPay ? (
                    <TouchableOpacity onPress={() => navigation.navigate('BookingPayment', { bookingId: b._id })}>
                      <Text style={styles.action}>Pay now</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => navigation.navigate('BookingDetail', { bookingId: b._id })}>
                    <Text style={styles.action}>Details</Text>
                  </TouchableOpacity>
                  {b.status === 'completed' && !b.review ? (
                    <TouchableOpacity onPress={() => navigation.navigate('BookingDetail', { bookingId: b._id })}>
                      <Text style={styles.action}>Rate cook</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  chip: { borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: colors.white },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.slate600 },
  chipTextOn: { color: colors.primary800 },
  otp: { fontSize: 14, fontWeight: '800', color: colors.primary800, marginTop: 6, letterSpacing: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  action: { fontSize: 13, fontWeight: '800', color: colors.primary },
});

export default MyBookingsScreen;
