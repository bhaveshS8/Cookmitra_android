import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useShowToast } from '../store/toast';
import { getRescheduleOptions, rescheduleBooking } from '../api/bookings';
import { MAX_RESCHEDULES } from '../utils/format';
import { RESCHEDULE_REASONS } from '../utils/bookingActions';
import {
  formatCurrency,
  formatDate,
  formatIsoToIstDay,
  formatTime12,
  localTodayStr,
} from '../utils/format';
import { colors } from '../theme/colors';
import { shared } from '../theme/shared';
import { Button } from './Button';

const dayString = (date) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
};

const addDays = (day, delta) => {
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return dayString(d);
};

const RescheduleModal = ({ visible, booking, onClose, onRescheduled }) => {
  const showToast = useShowToast();
  const bookingId = booking?._id;
  const [dateStr, setDateStr] = useState(localTodayStr());
  const [showPicker, setShowPicker] = useState(false);
  const [slots, setSlots] = useState([]);
  const [currentSlot, setCurrentSlot] = useState(null);
  const [selected, setSelected] = useState('');
  const [cookInfo, setCookInfo] = useState(null);
  const [replacementCooks, setReplacementCooks] = useState([]);
  const [selectedCook, setSelectedCook] = useState(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [cookLoading, setCookLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const durationHours = Number(booking?.durationHours || 0);
  const usedMoves = Number(booking?.rescheduleCount || 0);
  const remaining = Math.max(0, MAX_RESCHEDULES - usedMoves);
  const isBroadcast = !booking?.cook;

  const fetchSlots = useCallback(
    async (day) => {
      if (!bookingId) return;
      setLoading(true);
      setError('');
      setSelected('');
      setCookInfo(null);
      setReplacementCooks([]);
      setSelectedCook(null);
      try {
        const data = await getRescheduleOptions(bookingId, { date: day });
        setSlots(Array.isArray(data?.slots) ? data.slots : []);
        setCurrentSlot(data?.currentSlot || null);
      } catch (e) {
        setSlots([]);
        setCurrentSlot(null);
        setError(e?.response?.data?.message || 'Could not load free slots. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [bookingId],
  );

  useEffect(() => {
    if (!visible) return;
    const own = formatIsoToIstDay(booking?.date);
    const today = localTodayStr();
    setDateStr(own && own >= today ? own : today);
    setSelected('');
    setCookInfo(null);
    setReplacementCooks([]);
    setSelectedCook(null);
    setReason('');
    setNote('');
    setError('');
  }, [visible, booking?.date, booking?._id]);

  useEffect(() => {
    if (visible) fetchSlots(dateStr);
  }, [visible, dateStr, fetchSlots]);

  const pickTime = async (startTime) => {
    setSelected(startTime);
    setSelectedCook(null);
    setError('');
    if (isBroadcast) {
      // No cook has accepted yet, so the move simply re-opens the search at
      // the new time. There is no current cook to check.
      setCookInfo({ available: true });
      setReplacementCooks([]);
      return;
    }
    setCookLoading(true);
    try {
      const data = await getRescheduleOptions(bookingId, { date: dateStr, startTime });
      const available = data?.currentCookAvailable !== false;
      setCookInfo({ available });
      setReplacementCooks(available ? [] : Array.isArray(data?.availableCooks) ? data.availableCooks : []);
    } catch (e) {
      setCookInfo({ available: false });
      setReplacementCooks([]);
      setError(e?.response?.data?.message || 'Could not check cook availability.');
    } finally {
      setCookLoading(false);
    }
  };

  const submit = async () => {
    if (busy || !selected) return;
    if (cookInfo && !cookInfo.available && !selectedCook) {
      setError('Your current cook is unavailable. Please choose another cook or time.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const finalReason = reason === 'Other' ? note.trim() : reason;
      const payload = { date: dateStr, startTime: selected };
      if (finalReason) payload.reason = finalReason.slice(0, 200);
      if (selectedCook?.cookId) payload.cookId = selectedCook.cookId;
      const moved = await rescheduleBooking(bookingId, payload);
      showToast(
        moved?.unchanged
          ? 'You are already booked for that time.'
          : `Booking moved to ${formatDate(`${dateStr}T00:00:00`)} · ${formatTime12(selected)}.`,
        'success',
      );
      onRescheduled?.(moved);
      onClose?.();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not reschedule this booking.');
    } finally {
      setBusy(false);
    }
  };

  const currentKey = currentSlot && formatIsoToIstDay(currentSlot.date) === dateStr
    ? String(currentSlot.startTime || '')
    : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.overlay} edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <Text style={shared.h2}>Reschedule booking</Text>
              <Text style={[shared.small, shared.mt8]}>
                {booking?.cook?.name ? `With ${booking.cook.name} · ` : ''}
                {durationHours ? `${durationHours}h session · ` : ''}
                price stays the same.
              </Text>

              <View style={styles.current}>
                <Text style={styles.currentTitle}>Current booking</Text>
                <Text style={shared.body}>
                  {formatDate(booking?.date)} · {formatTime12(booking?.startTime)}
                  {booking?.endTime ? ` – ${formatTime12(booking.endTime)}` : ''}
                </Text>
                <Text style={shared.small}>
                  {formatCurrency(booking?.payment?.paidAmount || booking?.amount)}
                  {' · '}
                  {booking?.payment?.status === 'paid' ? 'Already paid — no extra charge' : 'Payment pending'}
                </Text>
                <Text style={styles.remaining}>
                  {remaining > 0
                    ? `${remaining} of ${MAX_RESCHEDULES} reschedules remaining`
                    : 'You have used all available reschedules.'}
                </Text>
              </View>

              <Text style={styles.label}>New date</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dayButton}
                  onPress={() => setDateStr((d) => addDays(d, -1))}
                  disabled={dateStr <= localTodayStr()}
                  accessibilityLabel="Previous day">
                  <Text style={styles.dayButtonText}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
                  <Text style={styles.dateText}>{formatDate(`${dateStr}T00:00:00`)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dayButton}
                  onPress={() => setDateStr((d) => addDays(d, 1))}
                  accessibilityLabel="Next day">
                  <Text style={styles.dayButtonText}>›</Text>
                </TouchableOpacity>
              </View>
              {showPicker ? (
                <DateTimePicker
                  value={new Date(`${dateStr}T00:00:00`)}
                  mode="date"
                  minimumDate={new Date(`${localTodayStr()}T00:00:00`)}
                  onChange={(e, d) => {
                    setShowPicker(false);
                    if (d) setDateStr(dayString(d));
                  }}
                />
              ) : null}

              <Text style={styles.label}>Free start times</Text>
              {loading ? (
                <Text style={shared.small}>Loading free slots…</Text>
              ) : slots.length === 0 ? (
                <Text style={shared.small}>No free slots on this day. Please pick another date.</Text>
              ) : (
                <View style={styles.chips}>
                  {slots.map((slot) => {
                    const isCurrent = slot.startTime === currentKey;
                    const isSelected = slot.startTime === selected;
                    return (
                      <TouchableOpacity
                        key={`${slot.startTime}-${slot.endTime}`}
                        disabled={isCurrent || busy}
                        onPress={() => pickTime(slot.startTime)}
                        style={[styles.slot, isSelected && styles.slotOn, isCurrent && styles.slotCurrent]}>
                        <Text style={[styles.slotText, isSelected && styles.slotTextOn]}>
                          {formatTime12(slot.startTime)}
                        </Text>
                        <Text style={[styles.slotEnd, isSelected && styles.slotTextOn]}>
                          to {formatTime12(slot.endTime)}
                        </Text>
                        {isCurrent ? <Text style={styles.currentTag}>Current</Text> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {selected ? (
                <View style={styles.cookBox}>
                  {cookLoading ? (
                    <Text style={shared.small}>Checking cook availability…</Text>
                  ) : cookInfo?.available ? (
                    <Text style={styles.ok}>
                      {isBroadcast
                        ? 'We’ll search for an available cook at this new time.'
                        : 'Your current cook is available for this slot.'}
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.warn}>Your current cook is unavailable for this time.</Text>
                      {replacementCooks.length === 0 ? (
                        <Text style={shared.small}>No replacement cook is available — please pick another time.</Text>
                      ) : (
                        <>
                          <Text style={styles.label}>Choose another cook</Text>
                          {replacementCooks.map((c) => {
                            const active = selectedCook?.cookId === c.cookId;
                            return (
                              <TouchableOpacity
                                key={c.cookId}
                                style={[styles.cookRow, active && styles.cookRowOn]}
                                onPress={() => setSelectedCook(active ? null : c)}>
                                <View style={shared.flex1}>
                                  <Text style={styles.cookName}>{c.name || 'Available cook'}</Text>
                                  <Text style={shared.small}>
                                    {c.rating > 0 ? `${Number(c.rating).toFixed(1)} ★ · ` : 'New cook · '}
                                    same booking price
                                  </Text>
                                </View>
                                <Text style={[styles.selectText, active && styles.selectTextOn]}>
                                  {active ? 'Selected' : 'Select'}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </>
                      )}
                    </>
                  )}
                </View>
              ) : null}

              <Text style={styles.label}>Reason (optional)</Text>
              <View style={styles.chips}>
                {RESCHEDULE_REASONS.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setReason(reason === r.value ? '' : r.value)}
                    style={[styles.reasonChip, reason === r.value && styles.reasonChipOn]}>
                    <Text style={[styles.reasonText, reason === r.value && styles.reasonTextOn]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {reason === 'Other' ? (
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Tell us briefly (max 200 characters)"
                  placeholderTextColor={colors.slate400}
                  maxLength={200}
                  multiline
                  style={styles.note}
                />
              ) : null}

              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Text style={[shared.small, shared.mt8]}>
                Rescheduling closes 30 minutes before the start time. The other side is notified as
                soon as you confirm.
              </Text>

              <View style={styles.actions}>
                <View style={shared.flex1}>
                  <Button title="Keep current time" variant="outline" onPress={onClose} disabled={busy} />
                </View>
                <View style={shared.flex1}>
                  <Button
                    title={busy ? 'Moving…' : 'Confirm reschedule'}
                    onPress={submit}
                    loading={busy}
                    disabled={!selected || Boolean(cookInfo && !cookInfo.available && !selectedCook) || remaining === 0}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.48)' },
  sheet: { maxHeight: '92%', backgroundColor: colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 8 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: colors.slate200, marginBottom: 4 },
  content: { padding: 18, paddingTop: 8, gap: 8 },
  current: { backgroundColor: colors.primaryLight, borderRadius: 16, padding: 14, marginTop: 8 },
  currentTitle: { fontSize: 12, fontWeight: '800', color: colors.primary800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  remaining: { fontSize: 12, fontWeight: '700', color: colors.primary700, marginTop: 6 },
  label: { fontSize: 14, fontWeight: '700', color: colors.slate800, marginTop: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayButton: { width: 42, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.slate200, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  dayButtonText: { fontSize: 26, lineHeight: 28, color: colors.primary },
  dateButton: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary100, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  dateText: { fontSize: 14, fontWeight: '700', color: colors.slate900 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  slot: { borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: colors.white, minWidth: 106 },
  slotOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  slotCurrent: { opacity: 0.55 },
  slotText: { fontSize: 14, fontWeight: '800', color: colors.slate800 },
  slotEnd: { fontSize: 11, color: colors.slate500, marginTop: 1 },
  slotTextOn: { color: colors.primary800 },
  currentTag: { fontSize: 10, fontWeight: '800', color: colors.slate500, marginTop: 2 },
  cookBox: { backgroundColor: '#fff7ed', borderRadius: 14, padding: 12, gap: 6, marginTop: 6 },
  ok: { fontSize: 13, fontWeight: '700', color: colors.emerald },
  warn: { fontSize: 13, fontWeight: '700', color: colors.rose },
  cookRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 12, padding: 10, backgroundColor: colors.white },
  cookRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  cookName: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  selectText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  selectTextOn: { color: colors.primary800 },
  reasonChip: { borderWidth: 1, borderColor: colors.slate200, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11, backgroundColor: colors.white },
  reasonChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  reasonText: { fontSize: 12, fontWeight: '600', color: colors.slate600 },
  reasonTextOn: { color: colors.primary800, fontWeight: '700' },
  note: { minHeight: 72, borderWidth: 1, borderColor: colors.slate200, borderRadius: 14, padding: 12, fontSize: 14, color: colors.slate900, backgroundColor: colors.white, textAlignVertical: 'top' },
  error: { fontSize: 13, fontWeight: '600', color: colors.rose },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});

export default RescheduleModal;
