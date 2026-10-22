import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { getCookEarnings, getCookPayouts } from '../../api/services';
import { formatCurrency, formatDate } from '../../utils/format';
import { mondayOfWeekIST, weekKeyIST, formatWeekLabel, DAY_MS } from '../../utils/weeklyPayout';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Loader, ErrorBanner, EmptyState, StatusBadge } from '../../components/feedback';

const CookEarningsScreen = () => {
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [monday, setMonday] = useState(() => mondayOfWeekIST(new Date()));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [e, p] = await Promise.all([getCookEarnings(), getCookPayouts().catch(() => [])]);
      setOverview(e?.overview || null);
      setRows(e?.bookings || []);
      setCycles(Array.isArray(p) ? p : p?.cycles || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not load earnings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weekKey = monday ? weekKeyIST(monday) : null;
  const weekCycles = cycles.filter((c) => {
    try {
      return weekKeyIST(c.weekStart) === weekKey;
    } catch {
      return false;
    }
  });

  const cards = overview
    ? [
        { label: 'Today', value: overview.today },
        { label: 'This week', value: overview.thisWeek },
        { label: 'Pending', value: overview.pending },
        { label: 'Paid', value: overview.paid },
        { label: 'Lifetime', value: overview.lifetime },
      ]
    : [];

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>Earnings</Text>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : (
          <>
            <View style={styles.grid}>
              {cards.map((c) => (
                <View key={c.label} style={styles.stat}>
                  <Text style={styles.statValue}>{formatCurrency(c.value)}</Text>
                  <Text style={shared.small}>{c.label}</Text>
                </View>
              ))}
            </View>
            <View style={shared.spread}>
              <TouchableOpacity onPress={() => setMonday((m) => new Date(new Date(m).getTime() - 7 * DAY_MS))} accessibilityLabel="Previous week">
                <ChevronLeft size={22} color={colors.primary} />
              </TouchableOpacity>
              <Text style={shared.h2}>Week {monday ? formatWeekLabel(monday) : ''}</Text>
              <TouchableOpacity onPress={() => setMonday((m) => new Date(new Date(m).getTime() + 7 * DAY_MS))} accessibilityLabel="Next week">
                <ChevronRight size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {weekCycles.length === 0 ? (
              <Text style={[shared.small, shared.mt8]}>No payout cycle built for this week yet.</Text>
            ) : (
              weekCycles.map((c) => (
                <View key={c._id} style={[shared.card, shared.mt8]}>
                  <View style={shared.spread}>
                    <Text style={shared.h3}>{formatCurrency(c.totalPayable ?? c.cookEarnings)}</Text>
                    <StatusBadge status={c.status} />
                  </View>
                  <Text style={shared.small}>
                    {c.bookingCount ?? 0} bookings
                    {c.paidAt || c.paymentDate ? ` · Paid ${formatDate(c.paidAt || c.paymentDate)}` : ''}
                  </Text>
                </View>
              ))
            )}
            <Text style={[shared.h2, shared.mt16]}>Recent sessions</Text>
            {rows.length === 0 ? (
              <EmptyState title="No sessions yet" message="Completed sessions and their payouts appear here." />
            ) : (
              rows.slice(0, 30).map((b) => (
                <View key={b._id || b.bookingId} style={shared.card}>
                  <View style={shared.spread}>
                    <Text style={shared.h3}>{formatCurrency(b.cookPayout)}</Text>
                    <StatusBadge status={b.payoutStatus} />
                  </View>
                  <Text style={shared.small}>
                    {b.customer || 'Customer'} · {b.date ? formatDate(b.date) : ''} · {b.duration ? `${b.duration}h` : ''}
                  </Text>
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 },
  stat: { flexGrow: 1, flexBasis: '30%', backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12 },
  statValue: { fontSize: 16, fontWeight: '800', color: colors.primary },
});

export default CookEarningsScreen;
