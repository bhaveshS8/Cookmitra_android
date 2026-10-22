import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Linking, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useShowToast } from '../../store/toast';
import { getCookBookings, getCookRequests, acceptBooking, rejectBooking } from '../../api/bookings';
import { formatCurrency, formatDate, formatTimeRange12 } from '../../utils/format';
import { mapsNavigateUrl } from '../../utils/links';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Loader, ErrorBanner, EmptyState, StatusBadge } from '../../components/feedback';

const TABS = ['Requests', 'Assigned', 'History'];

const CookDashboardScreen = ({ navigation }) => {
  const [tab, setTab] = useState('Requests');
  const [requests, setRequests] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const showToast = useShowToast();
  const lastRequestCount = useRef(0);

  const load = useCallback(async () => {
    setError('');
    try {
      const [req, mine] = await Promise.all([getCookRequests(), getCookBookings()]);
      const reqList = Array.isArray(req) ? req : req?.bookings || [];
      const myList = Array.isArray(mine) ? mine : mine?.bookings || [];
      setRequests(reqList);
      setAssigned(myList);
      if (reqList.length > lastRequestCount.current) {
        try {
          Vibration.vibrate([0, 120, 80, 120]);
        } catch {}
      }
      lastRequestCount.current = reqList.length;
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(() => { load(); }, 20000);
    return () => clearInterval(timer);
  }, [load]));

  const act = async (id, kind) => {
    if (busyId) return;
    setBusyId(id);
    try {
      if (kind === 'accept') {
        await acceptBooking(id);
        showToast('Booking accepted — the customer has been notified.', 'success');
      } else {
        await rejectBooking(id);
        showToast('Request declined.', 'info');
      }
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Action failed. Please try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const rows = tab === 'Requests' ? requests : assigned.filter((b) =>
    tab === 'Assigned'
      ? ['accepted', 'confirmed', 'in_progress'].includes(b.status)
      : ['completed', 'cancelled', 'rejected', 'expired'].includes(b.status),
  );

  const openMaps = (b) => {
    const url = mapsNavigateUrl(b);
    if (url) Linking.openURL(url).catch(() => showToast('Could not open Maps.', 'error'));
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>My jobs</Text>
        <View style={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader message="Loading jobs…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title={tab === 'Requests' ? 'No new requests' : 'Nothing here yet'}
            message={tab === 'Requests' ? 'New booking requests will appear here with the customer venue.' : 'Accepted jobs show up under Assigned.'}
          />
        ) : (
          rows.map((b) => (
            <View key={b._id} style={shared.card}>
              <View style={shared.spread}>
                <Text style={shared.h3}>{formatDate(b.date)}</Text>
                <StatusBadge status={b.status} />
              </View>
              <Text style={shared.body}>
                {formatTimeRange12(b.startTime, b.endTime, '-')} · {b.durationHours || ''} hrs · {formatCurrency(b.cookPayout || b.amount)}
              </Text>
              <Text style={shared.small} numberOfLines={2}>{b.address}</Text>
              {b.customer?.name ? <Text style={shared.small}>Customer: {b.customer.name}</Text> : null}
              {b.customer?.phone ? <Text style={shared.small}>Phone: {b.customer.phone}</Text> : null}
              {['accepted', 'confirmed'].includes(b.status) && !b.serviceStartedAt ? (
                <Text style={styles.otpNote}>Ask the customer for their 4-digit start OTP when you begin.</Text>
              ) : null}
              <View style={styles.row}>
                <TouchableOpacity onPress={() => navigation.navigate('BookingDetail', { bookingId: b._id })}>
                  <Text style={styles.link}>Details</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openMaps(b)}>
                  <Text style={styles.link}>Open in Maps</Text>
                </TouchableOpacity>
                {b.customer?.phone ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${b.customer.phone}`).catch(() => showToast('Could not open the dialer.', 'error'))}>
                    <Text style={styles.link}>Call customer</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {tab === 'Requests' ? (
                <View style={styles.actions}>
                  <View style={shared.flex1}>
                    <Button title="Accept" onPress={() => act(b._id, 'accept')} loading={busyId === b._id} />
                  </View>
                  <View style={shared.flex1}>
                    <Button title="Decline" variant="outline" onPress={() => act(b._id, 'reject')} loading={busyId === b._id} />
                  </View>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  tab: { flex: 1, borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 999, paddingVertical: 9, alignItems: 'center', backgroundColor: colors.white },
  tabOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.slate600 },
  tabTextOn: { color: colors.primary800 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  otpNote: { fontSize: 12, fontWeight: '700', color: colors.primary700, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
});

export default CookDashboardScreen;
