import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getMyBookings } from '../../api/bookings';
import { getMyReviews } from '../../api/services';
import { formatCurrency, formatDate, getBookingDisplayState } from '../../utils/format';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Loader, ErrorBanner, EmptyState, StatusBadge } from '../../components/feedback';

const asList = (data, key) => (Array.isArray(data) ? data : data?.[key] || []);

const ActivityScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [bk, rv] = await Promise.all([
        getMyBookings().catch(() => []),
        getMyReviews().catch(() => []),
      ]);
      setBookings(asList(bk, 'bookings'));
      setReviews(asList(rv, 'reviews'));
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load your activity.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>My activity</Text>
        <Text style={shared.small}>Your recent bookings and the reviews you have shared.</Text>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : (
          <>
            <View style={[shared.card, styles.summary]}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{bookings.length}</Text>
                <Text style={shared.small}>Bookings</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{reviews.length}</Text>
                <Text style={shared.small}>Reviews</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {bookings.filter((b) => b.status === 'completed').length}
                </Text>
                <Text style={shared.small}>Completed</Text>
              </View>
            </View>

            <Text style={[shared.h2, shared.mt8]}>Recent bookings</Text>
            {bookings.length === 0 ? (
              <EmptyState title="No bookings yet" message="Your booking history will appear here." />
            ) : (
              bookings.slice(0, 8).map((b) => (
                <TouchableOpacity
                  key={b._id}
                  style={shared.card}
                  onPress={() => navigation.navigate('BookingDetail', { bookingId: b._id })}>
                  <View style={shared.spread}>
                    <Text style={shared.h3}>{formatDate(b.date)}</Text>
                    <StatusBadge status={b.status} />
                  </View>
                  <Text style={shared.small}>
                    {getBookingDisplayState(b).replace(/_/g, ' ')} · {formatCurrency(b.amount)}
                    {b.cook?.name ? ` · ${b.cook.name}` : ''}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <Text style={[shared.h2, shared.mt8]}>Reviews you wrote</Text>
            {reviews.length === 0 ? (
              <EmptyState title="No reviews yet" message="After a completed service you can rate your cook." />
            ) : (
              reviews.map((r) => (
                <View key={r._id} style={shared.card}>
                  <View style={shared.spread}>
                    <Text style={shared.h3}>
                      {r.cook?.name || r.booking?.cook?.name || 'CookMitra cook'}
                    </Text>
                    <Text style={styles.stars}>{'★'.repeat(Number(r.rating || 0))}</Text>
                  </View>
                  {r.comment ? <Text style={shared.body}>“{r.comment}”</Text> : null}
                  {r.createdAt ? <Text style={shared.small}>{formatDate(r.createdAt)}</Text> : null}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 12, paddingVertical: 10 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.primary700 },
  stars: { color: '#f59e0b', fontSize: 15, letterSpacing: 1 },
});

export default ActivityScreen;
