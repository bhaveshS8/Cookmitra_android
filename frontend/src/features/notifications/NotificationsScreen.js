import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import {
  AlertCircle, CalendarCheck, ChevronRight, ShieldCheck, Star, Wallet,
} from 'lucide-react-native';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/services';
import { timeAgo } from '../../utils/format';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Loader, ErrorBanner, EmptyState } from '../../components/feedback';

const iconFor = (type = '') => {
  if (type.startsWith('payout') || type.startsWith('incentive') || type.startsWith('referral')) return Wallet;
  if (type.startsWith('profile')) return ShieldCheck;
  if (type.startsWith('review')) return Star;
  if (type.includes('cancel') || type.includes('expired') || type.includes('rejected') || type.includes('failed')) return AlertCircle;
  return CalendarCheck;
};

const bookingIdFrom = (link = '') => {
  const match = String(link).match(/^\/bookings\/([^/?#]+)/);
  return match ? match[1] : null;
};

const NotificationsScreen = ({ navigation }) => {
  const role = useSelector((s) => s.auth.user?.role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getNotifications();
      setRows(Array.isArray(data) ? data : data?.notifications || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      await load();
    } catch {}
  };

  const readOne = async (id) => {
    try {
      await markNotificationRead(id);
      setRows((rs) => rs.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch {}
  };

  const openNotification = async (notification) => {
    if (!notification.read) await readOne(notification._id);
    const bookingId = notification.booking?._id || notification.booking || bookingIdFrom(notification.link);
    if (bookingId) {
      navigation.navigate('BookingDetail', { bookingId: String(bookingId) });
      return;
    }
    if (role === 'cook') {
      if (notification.type?.startsWith('payout') || notification.type?.startsWith('incentive') || notification.type?.startsWith('referral')) {
        navigation.navigate('Cook', { screen: 'Earnings' });
        return;
      }
      if (notification.type?.startsWith('profile')) {
        navigation.navigate('Cook', { screen: 'Setup' });
        return;
      }
      if (notification.type?.startsWith('review')) {
        navigation.navigate('Cook', { screen: 'Reviews' });
      }
    }
  };

  const unread = rows.filter((n) => !n.read).length;

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        {unread ? (
          <View style={styles.actions}>
            <TouchableOpacity onPress={readAll}>
              <Text style={styles.link}>Mark all read</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <EmptyState title="All caught up" message="Booking updates, payouts and announcements appear here." />
        ) : (
          rows.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <TouchableOpacity
                key={n._id}
                style={[shared.card, !n.read && styles.unread]}
                onPress={() => openNotification(n)}>
                <View style={styles.row}>
                  <Icon size={16} color={n.read ? colors.slate400 : colors.primary} />
                  <Text style={[shared.body, !n.read && styles.bold, shared.flex1]}>
                    {n.title || n.type?.replace(/_/g, ' ') || 'Update'}
                  </Text>
                  <ChevronRight size={16} color={colors.slate300} />
                </View>
                {n.message ? <Text style={shared.small}>{n.message}</Text> : null}
                {n.createdAt ? <Text style={styles.time}>{timeAgo(n.createdAt)}</Text> : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '700', color: colors.slate900 },
  time: { fontSize: 12, color: colors.slate400, marginTop: 4 },
  unread: { borderColor: colors.primary100, backgroundColor: '#FFFBF5' },
});

export default NotificationsScreen;
