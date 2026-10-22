import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import RazorpayCheckout from 'react-native-razorpay';
import { useSelector } from 'react-redux';
import { useShowToast } from '../../store/toast';
import { getBooking, payBooking, createPaymentOrder } from '../../api/bookings';
import {
  clearPendingPayment,
  loadPendingPayment,
  savePendingPayment,
} from '../../services/session';
import { getApiConfig } from '../../config';
import { formatCurrency, formatDate, formatTimeRange12, formatIsoToIstDay } from '../../utils/format';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Loader, ErrorBanner } from '../../components/feedback';

const METHODS = [
  { id: 'upi', label: 'UPI', desc: 'GPay · PhonePe · Paytm', tag: 'Recommended' },
  { id: 'card', label: 'Card', desc: 'Credit / Debit' },
  { id: 'netbanking', label: 'Net Banking', desc: 'All major banks' },
  { id: 'wallet', label: 'Wallet', desc: 'Paytm · Amazon Pay' },
];

// Mirrors website BookingPayment HIDE_METHODS: only the chosen rail is shown.
const hiddenFor = (method) =>
  METHODS.map((m) => m.id).filter((id) => id !== method).concat(['emi', 'paylater', 'cardless_emi']);

const BookingPaymentScreen = ({ navigation, route }) => {
  const bookingId = route?.params?.bookingId;
  const user = useSelector((s) => s.auth.user);
  const showToast = useShowToast();
  const [booking, setBooking] = useState(null);
  const [method, setMethod] = useState('upi');
  const [phase, setPhase] = useState('loading');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const autoVerifiedRef = useRef('');
  const canVerify = Boolean(
    pending?.payment?.razorpayOrderId &&
      pending?.payment?.razorpayPaymentId &&
      pending?.payment?.razorpaySignature,
  );

  const markPaid = useCallback(
    async (data, message) => {
      setBooking((prev) => ({ ...(prev || {}), ...(data || {}) }));
      setPending(null);
      await clearPendingPayment(bookingId);
      setError('');
      setPhase('success');
      if (message) showToast(message, 'success');
    },
    [bookingId, showToast],
  );

  // A checkout success can be followed by a lost verification response, a
  // process death, or a webhook that confirms the charge first. The proof is
  // persisted before verification so the same payment can be re-checked
  // without asking the customer to pay again.
  const verifyPending = useCallback(
    async (proof, { announce = false } = {}) => {
      if (!proof?.payment || verifyingRef.current) return false;
      verifyingRef.current = true;
      setVerifying(true);
      setError('');
      try {
        const res = await payBooking(bookingId, {
          method: proof.method || 'upi',
          payment: proof.payment,
        });
        await markPaid(
          res || {},
          announce ? 'Payment successful — booking confirmed!' : null,
        );
        return true;
      } catch (err) {
        const data = err?.response?.data || {};
        if (
          err?.response?.status === 409 &&
          (data.alreadyPaid || data.status === 'confirmed')
        ) {
          await markPaid(data, 'Payment already recorded — booking confirmed!');
          return true;
        }
        const ref = proof?.payment?.razorpayPaymentId || '';
        const refText = ref ? ` Payment reference: ${ref}.` : '';
        const msg =
          err?.response?.status === 410
            ? `The slot was released. Do not pay again.${refText} Contact CookMitra support so we can verify or refund the payment.`
            : err?.response?.status === 400 || err?.response?.status === 402
              ? `We could not confirm this payment automatically.${refText} Do not pay again — contact CookMitra support with this reference.`
              : `Payment submitted but confirmation is pending.${refText} Check your connection and tap "Check payment status"; do not pay again.`;
        setPending(proof);
        setPhase('verifying');
        setError(msg);
        if (announce) showToast(msg, 'error');
        return false;
      } finally {
        verifyingRef.current = false;
        setVerifying(false);
      }
    },
    [bookingId, markPaid, showToast],
  );

  const checkPaid = useCallback(async () => {
    try {
      const data = await getBooking(bookingId);
      if (data?.payment?.status === 'paid') {
        await markPaid(data, null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [bookingId, markPaid]);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getBooking(bookingId);
      if (data?.payment?.status === 'paid') {
        await clearPendingPayment(bookingId);
        navigation.replace('BookingDetail', { bookingId });
        return;
      }
      // Check for a paid proof before the status guard: a booking can have
      // become cancelled/expired while its charge is still unconfirmed.
      const stored = await loadPendingPayment(bookingId);
      if (stored?.payment) {
        setBooking(data);
        setPending(stored);
        setPhase('verifying');
        if (autoVerifiedRef.current !== bookingId) {
          autoVerifiedRef.current = bookingId;
          await verifyPending(stored);
        }
        return;
      }
      if (!['accepted', 'confirmed'].includes(data?.status)) {
        setError('This booking is not awaiting payment.');
        setPhase('error');
        return;
      }
      if (Number(data?.amount) <= 0) {
        navigation.replace('BookingDetail', { bookingId });
        return;
      }
      setBooking(data);
      setPhase('pay');
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the booking.');
      setPhase('error');
    }
  }, [bookingId, navigation, verifyPending]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Razorpay runs in a native activity. Re-check the booking when the app
  // comes back so a webhook-confirmed charge is not left on the pay screen.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') checkPaid();
    });
    return () => sub.remove();
  }, [checkPaid]);

  const pay = async () => {
    if (phase === 'processing' || verifyingRef.current) return;
    setPhase('processing');
    setError('');
    try {
      const stored = await loadPendingPayment(bookingId);
      if (stored?.payment) {
        setPending(stored);
        setPhase('verifying');
        await verifyPending(stored, { announce: true });
        return;
      }
      if (await checkPaid()) return;

      const cookId = booking?.cook?._id || booking?.cook;
      const order = await createPaymentOrder({
        cook: cookId,
        date: formatIsoToIstDay(booking?.date) || booking?.date,
        startTime: booking?.startTime,
        endTime: booking?.endTime,
        durationHours: booking?.durationHours,
        bookingId,
      });
      const key = getApiConfig().razorpayKeyId || order.keyId;
      if (!key) {
        throw { response: { data: { message: 'Payments are not configured in this build.' } } };
      }
      const resp = await RazorpayCheckout.open({
        key,
        order_id: order.orderId,
        name: 'CookMitra',
        description: `Cook booking ${formatDate(booking?.date)}`,
        prefill: { contact: user?.phone || '', email: user?.email || '' },
        theme: { color: '#e8590c' },
        config: { display: { hide: hiddenFor(method).map((m) => ({ method: m })) } },
      });
      if (
        !resp?.razorpay_order_id ||
        !resp?.razorpay_payment_id ||
        !resp?.razorpay_signature
      ) {
        setPending({
          method,
          payment: {
            razorpayOrderId: resp?.razorpay_order_id || '',
            razorpayPaymentId: resp?.razorpay_payment_id || '',
            razorpaySignature: resp?.razorpay_signature || '',
          },
        });
        setPhase('verifying');
        setError(
          'Checkout returned an incomplete response. Do not pay again — contact CookMitra support with any payment reference shown in your UPI or card app.',
        );
        return;
      }
      const proof = {
        method,
        payment: {
          razorpayOrderId: resp.razorpay_order_id,
          razorpayPaymentId: resp.razorpay_payment_id,
          razorpaySignature: resp.razorpay_signature,
        },
      };
      // Store before the network call. If this write fails we still keep the
      // proof in memory and verify immediately.
      try {
        await savePendingPayment(bookingId, proof);
      } catch {}
      setPending(proof);
      setPhase('verifying');
      await verifyPending(proof, { announce: true });
    } catch (e) {
      if (e?.response?.status === 503) {
        setPhase('pay');
        const msg503 = 'Online payment is temporarily unavailable. Please try again later — no money was charged.';
        setError(msg503);
        showToast(msg503, 'error');
      } else if (e?.code === 0 || /cancel/i.test(e?.description || e?.message || '')) {
        setPhase('pay');
        showToast('Payment cancelled — your slot is still held until the timer ends.', 'info');
      } else {
        setPhase('pay');
        const msg = e?.response?.data?.message || e?.description || 'Could not start payment.';
        setError(msg);
        showToast(msg, 'error');
      }
    }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={shared.scrollContent}>
        <Text style={shared.h1}>Pay securely</Text>
        <ErrorBanner message={error} onRetry={phase === 'error' ? load : null} />
        {phase === 'loading' ? <Loader message="Preparing payment…" /> : null}
        {phase === 'verifying' ? (
          <View style={shared.card}>
            <Text style={shared.h2}>{verifying ? 'Checking payment…' : 'Confirming payment'}</Text>
            {verifying ? <Loader message="Contacting CookMitra…" /> : null}
            <Text style={shared.body}>
              Your payment details are saved on this device. Do not pay again.
            </Text>
            {pending?.payment?.razorpayPaymentId ? (
              <Text selectable style={shared.small}>
                Payment reference: {pending.payment.razorpayPaymentId}
              </Text>
            ) : null}
            {canVerify ? (
              <Button
                title={verifying ? 'Checking…' : 'Check payment status'}
                onPress={() => verifyPending(pending, { announce: true })}
                loading={verifying}
                disabled={verifying}
              />
            ) : null}
          </View>
        ) : null}
        {phase === 'expired' ? (
          <View style={shared.card}>
            <Text style={shared.h2}>Payment window expired</Text>
            <Text style={shared.body}>The slot was released. Please make a fresh booking.</Text>
            <Button title="Book again" onPress={() => navigation.navigate('Customer', { screen: 'Book' })} />
          </View>
        ) : null}
        {phase === 'pay' || phase === 'processing' ? (
          <>
            <View style={shared.card}>
              <Text style={shared.h2}>{formatCurrency(booking?.amount)}</Text>
              <Text style={shared.body}>
                {formatDate(booking?.date)} · {formatTimeRange12(booking?.startTime, booking?.endTime, '-')}
              </Text>
              <Text style={shared.small}>{booking?.address}</Text>
            </View>
            <Text style={styles.label}>Payment method</Text>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setMethod(m.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: method === m.id }}
                style={[styles.method, method === m.id && styles.methodOn]}>
                <View style={shared.flex1}>
                  <Text style={shared.h3}>
                    {m.label} {m.tag ? <Text style={styles.tag}>· {m.tag}</Text> : null}
                  </Text>
                  <Text style={shared.small}>{m.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <Button
              title={phase === 'processing' ? 'Processing…' : `Pay ${formatCurrency(booking?.amount)}`}
              onPress={pay}
              loading={phase === 'processing'}
            />
          </>
        ) : null}
        {phase === 'success' ? (
          <View style={shared.card}>
            <Text style={[shared.h2, { color: colors.emerald }]}>Payment successful</Text>
            <Text style={shared.body}>Your booking is confirmed. The cook has your venue details.</Text>
            <View style={styles.links}>
              {booking?.cookWhatsappUrl ? (
                <Button title="Message cook on WhatsApp" variant="outline" onPress={() => Linking.openURL(booking.cookWhatsappUrl).catch(() => {})} />
              ) : null}
              <Button title="View booking" onPress={() => navigation.replace('BookingDetail', { bookingId })} />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '700', color: colors.slate800, marginBottom: 8 },
  method: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 14, padding: 14, marginBottom: 10 },
  methodOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tag: { fontSize: 12, color: colors.primary700 },
  links: { gap: 10, marginTop: 12 },
});

export default BookingPaymentScreen;
