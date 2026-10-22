import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, TouchableOpacity, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useShowToast } from '../../store/toast';
import {
  getBooking, acceptBooking, rejectBooking, startService,
  cancelBooking, getCancellationPreview, getRefundEligibility, markNoShow,
} from '../../api/bookings';
import { createReview, createComplaint, requestRefund } from '../../api/services';
import {
  formatCurrency, formatDate, formatTimeRange12, getBookingDisplayState,
  isCancelLocked, canRescheduleBooking, isReviewable, normalizeIndianMobile,
} from '../../utils/format';
import { SERVICE_DETAILS } from '../../utils/format';
import {
  CUSTOMER_CANCEL_REASONS, COOK_CANCEL_REASONS, REFUND_REASONS,
  CUSTOMER_COMPLAINT_REASONS, COOK_COMPLAINT_REASONS, NO_SHOW_REASONS,
} from '../../utils/bookingActions';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { Loader, ErrorBanner, EmptyState, StatusBadge } from '../../components/feedback';
import ReasonModal from '../../components/ReasonModal';
import RescheduleModal from '../../components/RescheduleModal';
import { mapsNavigateUrl, openUrl } from '../../utils/links';

const BookingDetailScreen = ({ navigation, route }) => {
  const bookingId = route?.params?.bookingId;
  const user = useSelector((s) => s.auth.user);
  const role = user?.role;
  const showToast = useShowToast();
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [preview, setPreview] = useState(null);
  const [refundInfo, setRefundInfo] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundNote, setRefundNote] = useState('');
  const [refundError, setRefundError] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState('');
  const [complaintMessage, setComplaintMessage] = useState('');
  const [complaintError, setComplaintError] = useState('');
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowReason, setNoShowReason] = useState('');
  const [noShowError, setNoShowError] = useState('');
  const [modalBusy, setModalBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setBooking(await getBooking(bookingId));
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the booking.');
    } finally {
      setRefreshing(false);
    }
  }, [bookingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const bookingStatus = booking?.status;
  const paymentStatus = booking?.payment?.status;

  // Keep action state fresh while a cook/customer waits on the other side.
  useEffect(() => {
    if (!bookingStatus || !['requested', 'accepted', 'confirmed', 'in_progress'].includes(bookingStatus)) {
      return undefined;
    }
    const timer = setInterval(() => { load(); }, 20000);
    return () => clearInterval(timer);
  }, [bookingStatus, load]);

  useEffect(() => {
    if (!bookingStatus || role !== 'customer') return undefined;
    if (paymentStatus !== 'paid') return undefined;
    if (['completed', 'rejected', 'expired'].includes(bookingStatus)) return undefined;
    let alive = true;
    getRefundEligibility(bookingId)
      .then((info) => { if (alive) setRefundInfo(info); })
      .catch(() => { if (alive) setRefundInfo(null); });
    return () => { alive = false; };
  }, [bookingStatus, paymentStatus, bookingId, role]);

  const run = async (key, fn, okMsg) => {
    if (busy) return;
    setBusy(key);
    try {
      const res = await fn();
      if (res?.deleted) {
        if (okMsg) showToast(okMsg, 'info');
        navigation.goBack();
        return;
      }
      setBooking((prev) => ({ ...(prev || {}), ...((res && typeof res === 'object' ? res : {})) }));
      if (okMsg) showToast(okMsg, 'success');
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Action failed. Please try again.', 'error');
    } finally {
      setBusy('');
    }
  };

  const confirmThen = (title, message, key, fn, okMsg) => {
    Alert.alert(title, message, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: () => run(key, fn, okMsg) },
    ]);
  };

  const openCancel = async () => {
    setCancelError('');
    setCancelNote('');
    setCancelReason(role === 'cook' ? 'MEDICAL_EMERGENCY' : 'CHANGE_OF_PLANS');
    setPreview(null);
    setCancelOpen(true);
    // The preview endpoint is customer/admin-only; cooks get the replacement
    // explanation instead of a misleading refund estimate.
    if (role === 'customer' && booking?.status !== 'requested') {
      try { setPreview(await getCancellationPreview(bookingId)); } catch {}
    }
  };

  const submitCancel = async () => {
    if (modalBusy) return;
    if (cancelReason === 'OTHER' && !cancelNote.trim()) {
      setCancelError('Please describe your reason for cancelling.');
      return;
    }
    setModalBusy(true);
    setCancelError('');
    try {
      const res = await cancelBooking(bookingId, {
        reason: cancelReason,
        ...(cancelNote.trim() ? { reasonNote: cancelNote.trim().slice(0, 500) } : {}),
      });
      setCancelOpen(false);
      if (res?.deleted) {
        showToast('Booking cancelled and removed (no payment was made).', 'info');
        navigation.goBack();
        return;
      }
      showToast(
        res?.replacement
          ? 'Cancellation recorded — we are finding a replacement cook.'
          : 'Booking cancelled.',
        'info',
      );
      await load();
    } catch (e) {
      setCancelError(e?.response?.data?.message || 'Could not cancel this booking.');
    } finally {
      setModalBusy(false);
    }
  };

  const openRefund = async () => {
    setRefundError('');
    setRefundNote('');
    setRefundReason('');
    let info = refundInfo;
    if (!info) {
      try {
        info = await getRefundEligibility(bookingId);
        setRefundInfo(info);
      } catch {
        info = null;
      }
    }
    if (info?.eligible === false) {
      showToast(info.reason || 'This booking is not eligible for a refund.', 'info');
      return;
    }
    setRefundOpen(true);
  };

  const submitRefund = async () => {
    if (modalBusy) return;
    if (!refundReason) {
      setRefundError('Please choose a refund reason.');
      return;
    }
    setModalBusy(true);
    setRefundError('');
    try {
      await requestRefund(bookingId, {
        reason: refundReason,
        ...(refundNote.trim() ? { note: refundNote.trim().slice(0, 500) } : {}),
      });
      showToast('Refund request submitted — our team will review it.', 'success');
      setRefundOpen(false);
      await load();
    } catch (e) {
      setRefundError(e?.response?.data?.message || 'Could not submit the refund request.');
    } finally {
      setModalBusy(false);
    }
  };

  const openComplaint = () => {
    setComplaintError('');
    setComplaintMessage('');
    setComplaintCategory(
      role === 'cook' ? COOK_COMPLAINT_REASONS[0].value : CUSTOMER_COMPLAINT_REASONS[0].value,
    );
    setComplaintOpen(true);
  };

  const submitComplaint = async () => {
    if (modalBusy) return;
    if (complaintMessage.trim().length < 10) {
      setComplaintError('Please describe the issue in at least 10 characters.');
      return;
    }
    setModalBusy(true);
    setComplaintError('');
    try {
      await createComplaint({
        booking: bookingId,
        category: complaintCategory,
        message: complaintMessage.trim(),
      });
      showToast('Report submitted — our team will review it.', 'success');
      setComplaintOpen(false);
    } catch (e) {
      setComplaintError(e?.response?.data?.message || 'Could not submit the report.');
    } finally {
      setModalBusy(false);
    }
  };

  const openNoShow = () => {
    setNoShowError('');
    setNoShowReason(NO_SHOW_REASONS[0].value);
    setNoShowOpen(true);
  };

  const submitNoShow = async () => {
    if (modalBusy) return;
    setModalBusy(true);
    setNoShowError('');
    try {
      const res = await markNoShow(bookingId, { reason: noShowReason });
      setNoShowOpen(false);
      if (res?.deleted) {
        showToast('Customer no-show recorded and unpaid booking removed.', 'info');
        navigation.goBack();
        return;
      }
      showToast('Customer no-show recorded.', 'info');
      await load();
    } catch (e) {
      setNoShowError(e?.response?.data?.message || 'Could not record the no-show.');
    } finally {
      setModalBusy(false);
    }
  };

  if (!booking && !error) {
    return <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}><Loader /></SafeAreaView>;
  }

  const state = booking ? getBookingDisplayState(booking) : '';
  const mapsUrl = booking ? mapsNavigateUrl(booking) : null;
  const counterpartyPhone = normalizeIndianMobile(
    role === 'customer'
      ? booking?.cook?.phone || booking?.cookPhone
      : booking?.customer?.phone || booking?.customerPhone,
  );
  const counterpartyName = role === 'customer'
    ? booking?.cook?.name || booking?.cookName
    : booking?.customer?.name || booking?.customerName;
  const activeStatus = booking && ['requested', 'accepted', 'confirmed', 'in_progress'].includes(booking.status);
  const assignedCookId = booking?.cook?._id || booking?.cook || null;
  const isAssignedCook = role === 'cook' && assignedCookId && String(assignedCookId) === String(user?._id);
  const canCancel = activeStatus && booking?.status !== 'in_progress' && !booking?.serviceStartedAt
    && !isCancelLocked(booking) && (role !== 'cook' || isAssignedCook);
  const paid = booking?.payment?.status === 'paid';
  const refundStatus = refundInfo?.refundStatus || booking?.payment?.refundStatus || 'none';
  const whatsAppUrl = counterpartyPhone
    ? `https://wa.me/91${counterpartyPhone}?text=${encodeURIComponent(
      `Hello${counterpartyName ? ` ${counterpartyName}` : ''}, regarding CookMitra booking ${bookingId}.`,
    )}`
    : null;

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAwareScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <ErrorBanner message={error} onRetry={load} />
        {!booking ? (
          <EmptyState title="Booking not found" message="It may have been removed." />
        ) : (
          <>
            <View style={[shared.card, styles.head]}>
              <View style={shared.spread}>
                <Text style={shared.h1}>{formatCurrency(booking.amount)}</Text>
                <StatusBadge status={booking.status} />
              </View>
              <Text style={shared.h2}>{SERVICE_DETAILS[booking.serviceType]?.label || booking.serviceType}</Text>
              <Text style={shared.body}>
                {formatDate(booking.date)} · {formatTimeRange12(booking.startTime, booking.endTime, '-')}
              </Text>
              <Text style={shared.small}>Status: {state.replace(/_/g, ' ')}</Text>
              <Text style={[shared.body, shared.mt8]}>{booking.address}</Text>
              {(booking.cook?.name || booking.cookName) && <Text style={shared.small}>Cook: {booking.cook?.name || booking.cookName}</Text>}
              {(booking.customer?.name || booking.customerName) && role !== 'customer' && (
                <Text style={shared.small}>Customer: {booking.customer?.name || booking.customerName}</Text>
              )}
              {mapsUrl ? (
                <TouchableOpacity onPress={() => openUrl(mapsUrl)}>
                  <Text style={styles.link}>Open venue in Maps</Text>
                </TouchableOpacity>
              ) : null}
              {counterpartyPhone ? (
                <View style={styles.contactRow}>
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:+91${counterpartyPhone}`).catch(() => {})}>
                    <Text style={styles.link}>Call {counterpartyName || 'contact'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => openUrl(whatsAppUrl)}>
                    <Text style={styles.link}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {booking.selectedItems?.length ? (
                <Text style={shared.small}>Dishes: {booking.selectedItems.join(', ')}</Text>
              ) : null}
              {booking.guests ? <Text style={shared.small}>Guests: {booking.guests}</Text> : null}
              {booking.notes ? <Text style={shared.small}>Notes: {booking.notes}</Text> : null}
            </View>

            {role === 'customer' && booking.serviceOtp && activeStatus && !booking.serviceStartedAt ? (
              <View style={[shared.card, styles.otpCard]}>
                <Text style={shared.h3}>Start OTP</Text>
                <Text selectable style={styles.otp}>{booking.serviceOtp}</Text>
                <Text style={shared.small}>Share this 4-digit code with your cook when they arrive.</Text>
              </View>
            ) : null}

            {role === 'customer' && booking.status === 'requested' ? (
              <View style={styles.stack}>
                <Button title="View booking status" onPress={() => navigation.navigate('BookingWait', { bookingId })} />
                <Text style={styles.note}>We are contacting verified cooks for this slot.</Text>
              </View>
            ) : null}
            {role === 'customer' && ['accepted', 'confirmed'].includes(booking.status) && !paid ? (
              <Button title="Pay now to confirm" onPress={() => navigation.navigate('BookingPayment', { bookingId })} />
            ) : null}

            {role === 'cook' && booking.status === 'requested' ? (
              <View style={styles.actions}>
                <View style={shared.flex1}>
                  <Button title="Accept" onPress={() => run('accept', () => acceptBooking(bookingId), 'Booking accepted!')} loading={busy === 'accept'} />
                </View>
                <View style={shared.flex1}>
                  <Button title="Decline" variant="outline" onPress={() => confirmThen('Decline request?', 'The customer will be notified.', 'reject', () => rejectBooking(bookingId), 'Request declined.')} loading={busy === 'reject'} />
                </View>
              </View>
            ) : null}

            {role === 'cook' && ['accepted', 'confirmed', 'in_progress'].includes(booking.status) && !booking.serviceStartedAt ? (
              <View style={styles.stack}>
                <Text style={shared.small}>
                  Start the service when you reach the venue. Ask the customer for the 4-digit OTP
                  shown on their booking.
                </Text>
                <Button
                  title={showOtp ? 'Start with OTP' : 'Start service'}
                  onPress={() => {
                    if (!showOtp) { setShowOtp(true); return; }
                    if (!/^\d{4}$/.test(otp.trim())) {
                      showToast('Enter the 4-digit OTP from the customer.', 'error');
                      return;
                    }
                    run('start', () => startService(bookingId, otp.trim()), 'Service started!');
                  }}
                  loading={busy === 'start'}
                />
              </View>
            ) : null}
            {showOtp && !booking.serviceStartedAt && role === 'cook' ? (
              <Field label="4-digit OTP from customer *" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={4} hint="Ask the customer for the OTP shown on their booking." />
            ) : null}

            {canCancel || (role === 'customer' && canRescheduleBooking(booking, user)) ? (
              <View style={styles.stack}>
                {role === 'customer' && canRescheduleBooking(booking, user) ? (
                  <Button title="Reschedule booking" variant="outline" onPress={() => setRescheduleOpen(true)} />
                ) : null}
                {canCancel ? (
                  <Button title="Cancel booking" variant="outline" onPress={openCancel} />
                ) : null}
                {!canCancel && activeStatus && !booking.serviceStartedAt ? (
                  <Text style={styles.note}>Cancellation closes 30 minutes before the start time. Contact support if you need help.</Text>
                ) : null}
              </View>
            ) : null}

            {role === 'cook' && ['accepted', 'confirmed', 'in_progress'].includes(booking.status) && !booking.serviceStartedAt ? (
              <Button title="Mark customer no-show" variant="outline" onPress={openNoShow} />
            ) : null}

            {role === 'customer' && paid && refundInfo?.eligible ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Service not completed?</Text>
                <Text style={shared.small}>
                  {refundInfo.scheduledEnd ? `Scheduled end: ${formatDate(refundInfo.scheduledEnd)}. ` : ''}
                  You can request a refund because the service was not marked completed.
                </Text>
                <Button title="Request refund" variant="outline" onPress={openRefund} />
              </View>
            ) : null}
            {role === 'customer' && paid && ['pending', 'processing'].includes(refundStatus) ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Refund under review</Text>
                <Text style={shared.small}>
                  {refundInfo?.refundAmount ? `${formatCurrency(refundInfo.refundAmount)} · ` : ''}
                  Submitted to our team. We will notify you when it is processed.
                </Text>
              </View>
            ) : null}
            {role === 'customer' && paid && ['failed', 'manual'].includes(refundStatus) ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Refund processing</Text>
                <Text style={shared.small}>Our team is completing your refund — we will notify you.</Text>
              </View>
            ) : null}
            {role === 'customer' && paid && refundStatus === 'processed' ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Refund completed</Text>
                <Text style={shared.small}>
                  {refundInfo?.refundAmount ? `${formatCurrency(refundInfo.refundAmount)} refunded. ` : ''}
                  It reaches your account in 5–7 business days.
                </Text>
              </View>
            ) : null}
            {role === 'customer' && paid && refundStatus === 'rejected' ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Refund request rejected</Text>
                <Text style={shared.small}>{refundInfo?.refundAdminNote || 'Contact support if you need help with this booking.'}</Text>
              </View>
            ) : null}

            {booking.status === 'cancelled' && booking.cancellationInfo ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Cancellation details</Text>
                <Text style={shared.body}>
                  Refund: {formatCurrency(booking.cancellationInfo.finalRefundAmount || 0)}
                  {booking.cancellationInfo.refundStatus
                    ? ` · ${String(booking.cancellationInfo.refundStatus).replace(/_/g, ' ')}`
                    : ''}
                </Text>
                {booking.cancellationInfo.reasonNote ? (
                  <Text style={shared.small}>Reason: {booking.cancellationInfo.reasonNote}</Text>
                ) : null}
              </View>
            ) : null}

            {booking.rescheduleHistory?.length ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Reschedule history</Text>
                {booking.rescheduleHistory.slice(-3).map((entry, i) => (
                  <Text key={entry._id || i} style={shared.small}>
                    {entry.fromDate ? `${formatDate(entry.fromDate)} → ` : ''}
                    {entry.toDate ? formatDate(entry.toDate) : 'Updated'}
                    {entry.reason ? ` · ${entry.reason}` : ''}
                  </Text>
                ))}
              </View>
            ) : null}

            {booking.status === 'requested' && booking.cookCancel?.cook ? (
              <View style={[shared.card, styles.refundCard]}>
                <Text style={shared.h3}>Finding a replacement cook</Text>
                <Text style={shared.small}>
                  {role === 'cook'
                    ? 'You are no longer assigned — a replacement cook is being searched.'
                    : 'Your cook had to cancel. We are finding a replacement at no extra charge.'}
                </Text>
              </View>
            ) : null}

            {role === 'customer' && (booking.review || isReviewable(booking)) ? (
              <View style={[shared.card, shared.mt12]}>
                <Text style={shared.h2}>{booking.review ? 'Your review' : 'Rate your cook'}</Text>
                {booking.review ? (
                  <>
                    <Text style={styles.reviewStars}>{'★'.repeat(Number(booking.review.rating || 0))}</Text>
                    {booking.review.comment ? <Text style={shared.body}>{booking.review.comment}</Text> : null}
                  </>
                ) : (
                  <>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <TouchableOpacity key={i} onPress={() => setRating(i)} accessibilityLabel={`Rate ${i} stars`}>
                          <Text style={[styles.star, i <= rating && styles.starOn]}>★</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Field label="Review (optional)" value={reviewText} onChangeText={setReviewText} multiline maxLength={500} />
                    <Button
                      title="Submit review"
                      onPress={() => run('review', () => createReview({ booking: bookingId, rating, comment: reviewText.trim() }), 'Thanks for the feedback!')}
                      loading={busy === 'review'}
                    />
                  </>
                )}
              </View>
            ) : null}

            {role === 'cook' && booking.review ? (
              <View style={[shared.card, shared.mt12]}>
                <Text style={shared.h2}>Customer rating</Text>
                <Text style={styles.reviewStars}>{'★'.repeat(Number(booking.review.rating || 0))}</Text>
                {booking.review.comment ? <Text style={shared.body}>“{booking.review.comment}”</Text> : null}
              </View>
            ) : null}

            {booking?.cook && booking?.customer ? (
              <View style={[shared.card, shared.mt12]}>
                <Text style={shared.h2}>Report an issue</Text>
                <Text style={shared.small}>
                  Faced a problem with {role === 'cook' ? booking?.customer?.name || 'this customer' : booking?.cook?.name || 'this cook'}?
                  Tell our team — every report is reviewed.
                </Text>
                <Button title="Report a problem" variant="outline" onPress={openComplaint} />
              </View>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>

      <ReasonModal
        visible={cancelOpen}
        title={role === 'cook' ? 'Cancel this booking?' : 'Cancel this booking?'}
        subtitle={
          role === 'cook'
            ? 'The booking returns to the finding-cook pool and another eligible cook will be notified.'
            : preview?.canCancel === false
              ? preview.message
              : preview
                ? `Estimated refund: ${formatCurrency(preview.finalRefund ?? preview.finalRefundAmount ?? preview.refundAmount ?? 0)}`
                : 'Cancellation charges may apply.'
        }
        options={role === 'cook' ? COOK_CANCEL_REASONS : CUSTOMER_CANCEL_REASONS}
        value={cancelReason}
        onChange={setCancelReason}
        note={cancelNote}
        onNoteChange={setCancelNote}
        noteRequired={cancelReason === 'OTHER'}
        noteMinLength={cancelReason === 'OTHER' ? 1 : 0}
        noteLabel={cancelReason === 'OTHER' ? 'Please describe your reason *' : 'Additional details (optional)'}
        notePlaceholder="Tell us briefly what happened…"
        confirmLabel="Cancel booking"
        confirmVariant="danger"
        onConfirm={submitCancel}
        onClose={() => setCancelOpen(false)}
        busy={modalBusy}
        error={cancelError}
      />

      <ReasonModal
        visible={refundOpen}
        title="Request a refund"
        subtitle={`Refundable amount: ${formatCurrency(refundInfo?.refundableAmount ?? refundInfo?.refundAmount ?? refundInfo?.paidAmount ?? 0)}`}
        options={REFUND_REASONS}
        value={refundReason}
        onChange={setRefundReason}
        note={refundNote}
        onNoteChange={setRefundNote}
        noteLabel="Anything else we should know? (optional)"
        notePlaceholder="Add details for our team…"
        confirmLabel="Submit request"
        onConfirm={submitRefund}
        onClose={() => setRefundOpen(false)}
        busy={modalBusy}
        error={refundError}
      />

      <RescheduleModal
        visible={rescheduleOpen}
        booking={booking}
        onClose={() => setRescheduleOpen(false)}
        onRescheduled={load}
      />

      <ReasonModal
        visible={complaintOpen}
        title="Report an issue"
        subtitle="Our support team reviews every report."
        options={role === 'cook' ? COOK_COMPLAINT_REASONS : CUSTOMER_COMPLAINT_REASONS}
        value={complaintCategory}
        onChange={setComplaintCategory}
        note={complaintMessage}
        onNoteChange={setComplaintMessage}
        noteRequired
        noteMinLength={10}
        noteMaxLength={2000}
        noteLabel="What happened?"
        notePlaceholder="Describe the issue in at least 10 characters…"
        confirmLabel="Submit report"
        onConfirm={submitComplaint}
        onClose={() => setComplaintOpen(false)}
        busy={modalBusy}
        error={complaintError}
      />

      <ReasonModal
        visible={noShowOpen}
        title="Mark customer no-show"
        subtitle="This records that the customer was unavailable and may affect their refund."
        options={NO_SHOW_REASONS}
        value={noShowReason}
        onChange={setNoShowReason}
        showNote={false}
        confirmLabel="Record no-show"
        confirmVariant="danger"
        onConfirm={submitNoShow}
        onClose={() => setNoShowOpen(false)}
        busy={modalBusy}
        error={noShowError}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  head: { gap: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stack: { gap: 10, marginTop: 10 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 8 },
  contactRow: { flexDirection: 'row', gap: 20 },
  note: { fontSize: 12, color: colors.slate500, marginTop: 8 },
  otpCard: { backgroundColor: '#fff7ed', borderColor: colors.primary100, alignItems: 'center', marginTop: 10 },
  otp: { fontSize: 34, fontWeight: '900', letterSpacing: 10, color: colors.primary800, marginVertical: 4 },
  refundCard: { gap: 6, marginTop: 10 },
  stars: { flexDirection: 'row', gap: 6, marginVertical: 8 },
  star: { fontSize: 32, color: colors.slate300 },
  starOn: { color: '#f59e0b' },
  reviewStars: { fontSize: 20, color: '#f59e0b', letterSpacing: 2, marginVertical: 4 },
});

export default BookingDetailScreen;
