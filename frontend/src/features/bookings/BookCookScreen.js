import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useDeviceLocation } from '../../hooks/useDeviceLocation';
import {
  locationMessage,
  needsLocationSettings,
  openAppSettings,
  openLocationSettings,
  LOCATION_IDLE,
  LOCATION_OK,
  LOCATION_SERVICES_OFF,
} from '../../services/location';
import { useShowToast } from '../../store/toast';
import { saveBookingDraft, loadBookingDraft, clearBookingDraft, savePostAuthTarget } from '../../services/session';
import { searchAvailability, createBooking, submitWomanDecline, validateCoupon, getWomanVerificationStatus } from '../../api/bookings';
import { SERVICE_DETAILS, slabPriceForDuration, formatCurrency, formatTime12, localTodayStr } from '../../utils/format';
import { bookingAttemptSignature, nextBookingClientKey } from '../../utils/bookingAttempt';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { Loader, ErrorBanner, EmptyState } from '../../components/feedback';

const STEPS = ['Service', 'Slot', 'Venue', 'Confirm'];

const BookCookScreen = ({ navigation, route }) => {
  const user = useSelector((s) => s.auth.user);
  const showToast = useShowToast();
  const [step, setStep] = useState(0);
  const [serviceType, setServiceType] = useState(route?.params?.serviceType || 'cook_for_me');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hours, setHours] = useState(2);
  const [guests, setGuests] = useState('4');
  const [notes, setNotes] = useState('');
  const [coupon, setCoupon] = useState('');
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [address, setAddress] = useState('');
  const [flatNo, setFlatNo] = useState('');
  const [society, setSociety] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('Pune');
  // Auto-detect on entry; an explicit tap re-pins. A restored draft keeps its
  // own coordinates (the hook never lets a late automatic fix overwrite them).
  const location = useDeviceLocation({ auto: true });
  const { coords, setCoords } = location;
  const [presence, setPresence] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [couponState, setCouponState] = useState(null);
  const [restriction, setRestriction] = useState(null);
  // Stable per-attempt idempotency key: a lost response must replay the same
  // booking instead of creating a duplicate. A new key is made only when the
  // booking details that define the attempt actually change.
  const clientKeyRef = useRef('');
  const clientKeySignatureRef = useRef('');

  useEffect(() => {
    if (route?.params?.serviceType) setServiceType(route.params.serviceType);
  }, [route?.params?.serviceType]);

  useEffect(() => {
    const code = String(route?.params?.couponCode || '').trim().toUpperCase();
    if (!code) return;
    setCoupon(code);
    setCouponState(null);
    showToast(`Coupon ${code} added — validate it at review.`, 'info');
    navigation.setParams({ couponCode: null });
  }, [route?.params?.couponCode, showToast, navigation]);

  // Restore any server-side woman-presence restriction (e.g. recorded on
  // another device): a blocked customer sees the countdown, not a dead end.
  useEffect(() => {
    if (step !== 2 || user?.role !== 'customer') return;
    let alive = true;
    (async () => {
      try {
        const s = await getWomanVerificationStatus();
        if (alive) setRestriction(s?.blocked ? s : null);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [step, user?.role]);
  // Resume an unfinished booking saved before the login gate (website
  // bookingDraft parity): restore scalar fields, then discard the draft.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const draft = await loadBookingDraft();
        if (!alive || !draft || draft.kind !== 'on-demand') return;
        // A draft saved before an expired session belongs to that account.
        // Never surface it to a different user who signs in on this device.
        if (draft.ownerId && user?._id && String(draft.ownerId) !== String(user._id)) {
          await clearBookingDraft();
          return;
        }
        if (draft.serviceType) setServiceType(draft.serviceType);
        if (draft.date) {
          const d = new Date(`${draft.date}T00:00:00`);
          if (!Number.isNaN(d.getTime())) setDate(d);
        }
        if (draft.hours) setHours(draft.hours);
        if (draft.guests) setGuests(String(draft.guests));
        if (draft.notes) setNotes(draft.notes);
        if (draft.coupon) setCoupon(draft.coupon);
        if (draft.address) setAddress(draft.address);
        if (draft.flatNo) setFlatNo(draft.flatNo);
        if (draft.society) setSociety(draft.society);
        if (draft.landmark) setLandmark(draft.landmark);
        if (draft.city) setCity(draft.city);
        if (draft.presence) setPresence(draft.presence);
        if (draft.slot) {
          setSlot(draft.slot);
          setStep(3);
        }
        if (draft.coords) setCoords(draft.coords);
        // The key must survive the app/process restart that follows a lost
        // response or an expired session, or the retry creates a duplicate.
        if (draft.clientKey && draft.clientKeySignature) {
          clientKeyRef.current = String(draft.clientKey);
          clientKeySignatureRef.current = String(draft.clientKeySignature);
        }
        showToast('Resumed your unfinished booking.', 'info');
        await clearBookingDraft();
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [showToast, user?._id, setCoords]);

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const slab = slabPriceForDuration(hours);

  const findSlots = async (overrideCookId) => {
    const preferredCookId = overrideCookId === undefined ? route?.params?.cookId : overrideCookId;
    setLoadingSlots(true);
    setFormError('');
    try {
      const data = await searchAvailability({ date: dateStr, durationHours: hours, suggest: 1 });
      const cooks = Array.isArray(data?.cooks) ? data.cooks : [];
      const relevant = preferredCookId
        ? cooks.filter((c) => String(c.user?._id || c._id) === String(preferredCookId))
        : cooks;
      const all = [];
      for (const c of relevant) {
        for (const s of c.slots || []) {
          all.push({ ...s, cookName: c.name || c.user?.name, cookId: c.user?._id || c._id });
        }
      }
      all.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
      setSlots(all);
      if (!all.length) {
        setFormError(
          preferredCookId
            ? 'This cook has no free slot then — try another day, duration, or show all cooks.'
            : 'No cooks free at that time — try another day or duration.',
        );
      }
    } catch (e) {
      setFormError(e?.response?.data?.message || 'Could not search availability.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const detectLocation = async () => {
    const result = await location.detect();
    if (!result) return;
    if (result.status === LOCATION_OK) {
      showToast(
        result.precise === false
          ? 'Approximate location pinned — confirm the address below.'
          : 'Location pinned — confirm the address below.',
        'success',
      );
      return;
    }
    if (needsLocationSettings(result.status)) {
      Alert.alert('Location needed', locationMessage(result.status), [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Open settings',
          onPress: () =>
            result.status === LOCATION_SERVICES_OFF
              ? openLocationSettings()
              : openAppSettings(),
        },
      ]);
      return;
    }
    showToast(locationMessage(result.status), 'error');
  };

  const submit = async () => {
    if (submitting) return;
    if (restriction?.blocked) {
      const secs = Number(restriction.remainingSeconds || 0);
      const mm = Math.floor(secs / 60);
      const ss = String(secs % 60).padStart(2, '0');
      setFormError(`Booking is paused for ${mm}:${ss} because a woman will not be present at home.`);
      return;
    }
    if (!user) {
      await saveBookingDraft({
        kind: 'on-demand', ownerId: user?._id || null, serviceType, date: dateStr, hours, guests, notes, coupon, slot,
        address, flatNo, society, landmark, city, presence, coords,
      });
      await savePostAuthTarget('Book');
      showToast('Please sign in again to finish this booking.', 'info');
      return;
    }
    if (user.role !== 'customer') {
      showToast('Only customer accounts can make bookings', 'error');
      return;
    }
    if (!address.trim() || !city.trim()) {
      setFormError('Please enter the venue address and city.');
      return;
    }
    if (presence === 'no') {
      try {
        const data = await submitWomanDecline();
        if (data?.blocked) setRestriction(data);
      } catch {}
      setFormError('You cannot make a booking for the next 1 hour because a woman will not be present at home.');
      return;
    }
    if (presence !== 'yes') {
      setFormError('Please confirm whether a woman will be present at home during the service.');
      return;
    }
    if (!slot?.startTime || !slot?.endTime) {
      setFormError('Please pick a time slot first.');
      setStep(1);
      return;
    }
    const attemptSignature = bookingAttemptSignature({
      serviceType, date: dateStr, hours, slot, guests, address,
      flatNo, society, landmark, city, coupon,
    });
    clientKeyRef.current = nextBookingClientKey({
      userId: user._id,
      signature: attemptSignature,
      currentKey: clientKeyRef.current,
      currentSignature: clientKeySignatureRef.current,
    });
    clientKeySignatureRef.current = attemptSignature;
    const draft = {
      kind: 'on-demand', ownerId: user?._id || null, serviceType, date: dateStr, hours, guests, notes, coupon, slot,
      address, flatNo, society, landmark, city, presence, coords,
      clientKey: clientKeyRef.current, clientKeySignature: attemptSignature,
    };
    setSubmitting(true);
    setFormError('');
    try {
      // Persist before the network call so a timeout, crash, or session
      // expiry can still be recovered from the Book tab after sign-in.
      await saveBookingDraft(draft);
      const payload = {
        serviceType,
        date: dateStr,
        startTime: slot.startTime,
        endTime: slot.endTime,
        guests: Number(guests) || 1,
        durationHours: hours,
        notes: notes.trim(),
        selectedItems: [],
        couponCode: coupon.trim(),
        womanPresenceConfirmed: true,
        address: address.trim(),
        addressDetails: { flatNo: flatNo.trim(), society: society.trim(), landmark: landmark.trim(), city: city.trim() },
        clientKey: clientKeyRef.current,
      };
      if (coords) payload.location = coords;
      const res = await createBooking(payload);
      clientKeyRef.current = '';
      clientKeySignatureRef.current = '';
      await clearBookingDraft();
      navigation.setParams({ cookId: null, couponCode: null });
      try {
        Vibration.vibrate(60);
      } catch {}
      showToast("Finding a cook for you — we're contacting available cooks now.", 'success');
      navigation.navigate('BookingWait', { bookingId: res?._id });
    } catch (err) {
      const data = err.response?.data || {};
      if (err.response?.status === 403 && data?.code === 'BOOKING_TEMPORARILY_BLOCKED') {
        // Server-reported lockout (e.g. answered NO on another device):
        // surface the restriction with its countdown instead of a dead end.
        if (data?.blockedUntil) setRestriction({ blocked: true, blockedUntil: data.blockedUntil, remainingSeconds: data.remainingSeconds });
        setFormError(data?.message || 'Booking is temporarily paused.');
        return;
      }
      if (err.response?.status === 409) {
        setFormError(`${data?.message || 'Slot conflict.'} Please pick another time.`);
      } else {
        showToast(data?.message || 'Booking failed', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <KeyboardAwareScrollView contentContainerStyle={shared.scrollContent}>
          <Text style={shared.h1}>Book a cook</Text>
          <View style={styles.steps}>
            {STEPS.map((s, i) => (
              <View key={s} style={styles.stepWrap}>
                <View style={[styles.dot, i <= step && styles.dotOn]}>
                  <Text style={[styles.dotText, i <= step && styles.dotTextOn]}>{i + 1}</Text>
                </View>
                <Text style={[styles.stepLabel, i === step && styles.stepLabelOn]}>{s}</Text>
              </View>
            ))}
          </View>
          <ErrorBanner message={formError} />

          {step === 0 ? (
            <>
              <Text style={styles.label}>Service</Text>
              {Object.entries(SERVICE_DETAILS).map(([key, s]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setServiceType(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: serviceType === key }}
                  style={[styles.option, serviceType === key && styles.optionOn]}>
                  <Text style={shared.h3}>{s.label}</Text>
                  <Text style={shared.small}>{s.description}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateText}>{dateStr}</Text>
              </TouchableOpacity>
              {showDatePicker ? (
                <DateTimePicker
                  value={date}
                  mode="date"
                  minimumDate={new Date(localTodayStr() + 'T00:00:00')}
                  onChange={(e, d) => {
                    setShowDatePicker(false);
                    if (d) setDate(d);
                  }}
                />
              ) : null}
              <Text style={styles.label}>Duration (hours)</Text>
              <View style={styles.chips}>
                {[1, 2, 3, 4].map((h) => (
                  <TouchableOpacity key={h} onPress={() => setHours(h)} style={[styles.chip, hours === h && styles.chipOn]}>
                    <Text style={[styles.chipText, hours === h && styles.chipTextOn]}>{h}h · {formatCurrency(slabPriceForDuration(h))}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Guests" value={String(guests)} onChangeText={setGuests} keyboardType="number-pad" maxLength={3} />
              <Field label="Notes for the cook (optional)" value={notes} onChangeText={setNotes} multiline maxLength={500} />
              <Button title="Find free cooks" onPress={() => { setStep(1); findSlots(); }} />
            </>
          ) : null}

          {step === 1 ? (
            <>
              <Text style={shared.body}>Free on {dateStr} · {hours} hour(s){slab ? ` · from ${formatCurrency(slab)}` : ''}</Text>
              {route?.params?.cookId ? (
                <View style={styles.preferred}>
                  <Text style={shared.small}>Showing slots for your selected cook.</Text>
                  <TouchableOpacity
                    onPress={() => {
                      navigation.setParams({ cookId: undefined });
                      setSlot(null);
                      findSlots(null);
                    }}>
                    <Text style={styles.link}>Show all cooks</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {loadingSlots ? (
                <Loader message="Checking cook availability…" />
              ) : slots.length === 0 ? (
                <EmptyState title="No free slots" message={formError || 'Try another day or duration.'} actionLabel="Change search" onAction={() => setStep(0)} />
              ) : (
                slots.map((s, i) => (
                  <TouchableOpacity
                    key={`${s.startTime}-${i}`}
                    onPress={() => setSlot(s)}
                    style={[styles.option, slot === s && styles.optionOn]}>
                    <Text style={shared.h3}>{formatTime12(s.startTime)} – {formatTime12(s.endTime)}</Text>
                    <Text style={shared.small}>{s.cookName ? `e.g. ${s.cookName}` : 'Available cook'}</Text>
                  </TouchableOpacity>
                ))
              )}
              <View style={styles.nav}>
                <View style={shared.flex1}><Button title="Back" variant="outline" onPress={() => setStep(0)} /></View>
                <View style={shared.flex1}>
                  <Button title="Continue" onPress={() => (slot ? setStep(2) : setFormError('Please pick a time slot first'))} />
                </View>
              </View>
            </>
          ) : null}

          {step === 2 ? (
            <>
              {restriction?.blocked ? (
                <View style={styles.restricted}>
                  <Text style={styles.restrictedText}>
                    Booking paused — a woman will not be present at home.
                    {Number(restriction.remainingSeconds) > 0
                      ? ` Try again in ${Math.floor(restriction.remainingSeconds / 60)}:${String(restriction.remainingSeconds % 60).padStart(2, '0')}.`
                      : ''}
                  </Text>
                </View>
              ) : null}
              <Field label="Venue address *" value={address} onChangeText={setAddress} placeholder="Flat, street, area" multiline maxLength={300} />
              <Field label="Flat / house no." value={flatNo} onChangeText={setFlatNo} maxLength={120} />
              <Field label="Society / building" value={society} onChangeText={setSociety} maxLength={160} />
              <Field label="Landmark" value={landmark} onChangeText={setLandmark} maxLength={160} />
              <Field label="City *" value={city} onChangeText={setCity} maxLength={80} />
              <Button
                title={
                  location.loading
                    ? 'Detecting location…'
                    : coords
                      ? `Location pinned (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) — tap to re-pin`
                      : 'Use my current location'
                }
                variant="outline"
                onPress={detectLocation}
              />
              {!coords && location.status !== LOCATION_IDLE && location.status !== LOCATION_OK ? (
                <Text style={styles.locationHint}>{locationMessage(location.status)}</Text>
              ) : null}
              <Text style={[styles.label, shared.mt12]}>Will a woman be present at home? *</Text>
              <Text style={shared.small}>Required by CookMitra safety policy — the backend verifies this strictly.</Text>
              <View style={styles.chips}>
                <TouchableOpacity onPress={() => setPresence('yes')} style={[styles.chip, presence === 'yes' && styles.chipOn]}>
                  <Text style={[styles.chipText, presence === 'yes' && styles.chipTextOn]}>Yes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPresence('no')} style={[styles.chip, presence === 'no' && styles.chipOn]}>
                  <Text style={[styles.chipText, presence === 'no' && styles.chipTextOn]}>No</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.nav}>
                <View style={shared.flex1}><Button title="Back" variant="outline" onPress={() => setStep(1)} /></View>
                <View style={shared.flex1}><Button title="Review booking" onPress={() => setStep(3)} /></View>
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <View style={shared.card}>
                <Text style={shared.h2}>{SERVICE_DETAILS[serviceType]?.label}</Text>
                <Text style={shared.body}>{dateStr} · {slot ? `${formatTime12(slot.startTime)} – ${formatTime12(slot.endTime)}` : ''}</Text>
                <Text style={shared.body}>{hours} hour(s) · {guests} guest(s){slab ? ` · ${formatCurrency(slab)}` : ''}</Text>
                <Text style={shared.small}>{address} · {city}</Text>
              </View>
              <Field label="Coupon code (optional)" value={coupon} onChangeText={(v) => { setCoupon(v); setCouponState(null); }} autoCapitalize="characters" maxLength={24} />
              <TouchableOpacity
                onPress={async () => {
                  if (!coupon.trim()) return;
                  try {
                    const res = await validateCoupon(coupon.trim(), { amount: slab || 0 });
                    setCouponState({ ok: true, message: res?.message || `Coupon ${coupon.trim()} looks valid — final discount is confirmed at booking.` });
                    showToast('Coupon validated.', 'success');
                  } catch (e) {
                    setCouponState({ ok: false, message: e?.response?.data?.message || 'This coupon cannot be applied.' });
                  }
                }}>
                <Text style={styles.link}>Validate coupon</Text>
              </TouchableOpacity>
              {couponState ? (
                <Text style={[shared.small, { color: couponState.ok ? colors.emerald : colors.rose }]}>
                  {couponState.message}
                </Text>
              ) : null}
              <View style={styles.nav}>
                <View style={shared.flex1}><Button title="Back" variant="outline" onPress={() => setStep(2)} /></View>
                <View style={shared.flex1}>
                  <Button title={submitting ? 'Booking…' : 'Confirm booking'} onPress={submit} loading={submitting} />
                </View>
              </View>
            </>
          ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  stepWrap: { alignItems: 'center', flex: 1 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.slate200, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.primary },
  dotText: { fontWeight: '800', color: colors.slate500 },
  dotTextOn: { color: colors.white },
  stepLabel: { fontSize: 11, color: colors.slate500, marginTop: 2 },
  stepLabelOn: { color: colors.primary700, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '700', color: colors.slate800, marginBottom: 8, marginTop: 4 },
  locationHint: { fontSize: 12, color: colors.amber, marginTop: 6, marginBottom: 8, lineHeight: 16 },
  option: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 14, padding: 14, marginBottom: 10, gap: 4 },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dateBtn: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, borderRadius: 12, padding: 14, marginBottom: 6 },
  dateText: { fontSize: 15, fontWeight: '700', color: colors.slate900 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.white },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.slate700 },
  chipTextOn: { color: colors.primary800 },
  nav: { flexDirection: 'row', gap: 10, marginTop: 8 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 8 },
  preferred: { backgroundColor: colors.primaryLight, borderRadius: 12, padding: 10, marginBottom: 8 },
  restricted: { backgroundColor: colors.roseLight, borderRadius: 12, padding: 12, marginBottom: 12 },
  restrictedText: { fontSize: 13, fontWeight: '600', color: '#9f1239' },
});

export default BookCookScreen;
