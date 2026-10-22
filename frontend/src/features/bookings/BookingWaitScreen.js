import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useShowToast } from '../../store/toast';
import { getBooking, cancelBooking } from '../../api/bookings';
import { bookingWaitDestination } from '../../utils/bookingActions';
import { formatCurrency, formatDate, formatTimeRange12, isCancelLocked } from '../../utils/format';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Loader, ErrorBanner, EmptyState, StatusBadge } from '../../components/feedback';

const TERMINAL = ['accepted', 'confirmed', 'rejected', 'cancelled', 'expired'];

const BookingWaitScreen = ({ navigation, route }) => {
  const bookingId = route?.params?.bookingId;
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const showToast = useShowToast();
  const timer = useRef(null);
  const handled = useRef(false);
  const redirect = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!bookingId) return;
    if (!silent) setError('');
    try {
      const data = await getBooking(bookingId);
      setBooking(data);
      if (handled.current) return;
      const destination = bookingWaitDestination(data);
      if (!destination) return;
      handled.current = true;
      if (data?.status === 'accepted') {
        showToast(`${data?.cook?.name || 'Your cook'} accepted your request!`, 'success');
      }
      if (destination.delayMs > 0) {
        redirect.current = setTimeout(() => {
          navigation.replace(destination.screen, { bookingId });
        }, destination.delayMs);
      } else {
        navigation.replace(destination.screen, { bookingId });
      }
    } catch (e) {
      if (!silent) setError(e?.response?.data?.message || 'Could not load the booking.');
    } finally {
      setRefreshing(false);
    }
  }, [bookingId, navigation, showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
      timer.current = setInterval(() => load(true), 10000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }, [load]),
  );

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (redirect.current) clearTimeout(redirect.current);
  }, []);

  const cancel = async () => {
    if (cancelling) return;
    if (booking && isCancelLocked(booking)) {
      showToast('Cancellation is locked within 30 minutes of the start time.', 'error');
      return;
    }
    setCancelling(true);
    try {
      await cancelBooking(bookingId);
      showToast('Booking cancelled.', 'info');
      navigation.navigate('Customer', { screen: 'Bookings' });
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not cancel.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>Finding your cook…</Text>
        <Text style={shared.body}>We&apos;re contacting available cooks now. This usually takes a minute.</Text>
        <ErrorBanner message={error} onRetry={() => load()} />
        {!booking ? (
          <Loader message="Waiting for a cook to accept…" />
        ) : (
          <View style={shared.card}>
            <View style={shared.spread}>
              <Text style={shared.h2}>{formatCurrency(booking.amount)}</Text>
              <StatusBadge status={booking.status} />
            </View>
            <Text style={shared.body}>{formatDate(booking.date)} · {formatTimeRange12(booking.startTime, booking.endTime, '-')}</Text>
            <Text style={shared.small}>{booking.address}</Text>
            {!TERMINAL.includes(booking.status) ? (
              <View style={shared.mt12}>
                <Button title={cancelling ? 'Cancelling…' : 'Cancel request'} variant="outline" onPress={cancel} loading={cancelling} />
              </View>
            ) : (
              <View style={shared.mt12}>
                <Button
                  title="Back to my bookings"
                  variant="outline"
                  onPress={() => navigation.navigate('Customer', { screen: 'Bookings' })}
                />
              </View>
            )}
          </View>
        )}
        {!booking && !error ? (
          <EmptyState title="Still waiting" message="Pull down to refresh the status." />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BookingWaitScreen;
