import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, Vibration, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import {
  ArrowRight,
  BadgeCheck,
  BadgePercent,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Clock,
  Home,
  LocateFixed,
  MapPin,
  MoonStar,
  Navigation,
  ShieldCheck,
  Sparkles,
  Sun,
  Sunset,
  Timer,
  Users,
  Wallet,
  X,
} from 'lucide-react-native';
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
import { createBooking, submitWomanDecline, validateCoupon, getWomanVerificationStatus } from '../../api/bookings';
import { slabPriceForDuration, formatCurrency, formatDate, formatTime12, localTodayStr, LAUNCH_SLAB_PRICES } from '../../utils/format';
import { buildStartOptions, deriveEndTime, groupStartOptions } from '../../utils/timeSlots';
import { bookingAttemptSignature, nextBookingClientKey } from '../../utils/bookingAttempt';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { ErrorBanner } from '../../components/feedback';

const STEPS = ['Details', 'Time', 'Venue', 'Confirm'];

// Customers book a cook directly — there is no service picker in the form.
// The backend still stores a service type for reporting and cook matching;
// the standard cook visit is the default for every direct booking.
const DEFAULT_SERVICE_TYPE = 'cook_for_me';

const TIME_GROUP_META = {
  morning: { Icon: Sun, bg: '#fff7ed', fg: '#c2410c' },
  afternoon: { Icon: Sunset, bg: '#eff6ff', fg: '#1d4ed8' },
  evening: { Icon: MoonStar, bg: '#f5f3ff', fg: '#6d28d9' },
};

const SummaryRow = ({ icon, label, value, onPress }) => (
  <TouchableOpacity
    style={styles.summaryRow}
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    activeOpacity={0.7}>
    <View style={styles.summaryIcon}>{icon}</View>
    <View style={styles.summaryText}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
    {onPress ? <Text style={styles.summaryEdit}>Edit</Text> : null}
  </TouchableOpacity>
);

const BookCookScreen = ({ navigation, route }) => {
  const user = useSelector((s) => s.auth.user);
  const showToast = useShowToast();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hours, setHours] = useState(2);
  const [guests, setGuests] = useState('4');
  const [notes, setNotes] = useState('');
  const [coupon, setCoupon] = useState('');
  const [slot, setSlot] = useState(null);
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
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [restriction, setRestriction] = useState(null);
  // Stable per-attempt idempotency key: a lost response must replay the same
  // booking instead of creating a duplicate. A new key is made only when the
  // booking details that define the attempt actually change.
  const clientKeyRef = useRef('');
  const clientKeySignatureRef = useRef('');

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
        if (draft.slot?.startTime) {
          // Restore only a slot that still fits the website-style hourly grid
          // (older drafts may contain half-hour or now-past start times).
          const restoredHours = Number(draft.hours) || 2;
          const restoredEnd = deriveEndTime(draft.slot.startTime, restoredHours);
          const restoredOptions = buildStartOptions({
            date: draft.date || localTodayStr(),
            durationHours: restoredHours,
          });
          if (restoredEnd && restoredOptions.includes(draft.slot.startTime)) {
            setSlot({ startTime: draft.slot.startTime, endTime: restoredEnd, derived: true });
            setStep(3);
          }
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
  const saving = Math.max(0, (LAUNCH_SLAB_PRICES[1] || 0) * Number(hours) - Number(slab || 0));
  const dateDow = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const dateDay = date.getDate();
  const dateMonth = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const venueSummary = [address, flatNo, society, landmark, city].filter(Boolean).join(' · ');
  const startOptions = buildStartOptions({ date: dateStr, durationHours: hours });
  const timeGroups = groupStartOptions(startOptions);

  const pickDateOffset = (offset) => {
    const next = new Date();
    next.setDate(next.getDate() + offset);
    setDate(next);
    setSlot(null);
    setFormError('');
  };

  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code || validatingCoupon) return;
    setValidatingCoupon(true);
    setCouponState(null);
    try {
      const res = await validateCoupon(code, {
        amount: slab || 0,
        serviceType: DEFAULT_SERVICE_TYPE,
      });
      setCouponState({
        ok: true,
        message: res?.message || `Coupon ${code} looks valid — the final discount is confirmed at booking.`,
      });
      showToast('Coupon validated.', 'success');
    } catch (e) {
      setCouponState({
        ok: false,
        message: e?.response?.data?.message || 'This coupon cannot be applied.',
      });
    } finally {
      setValidatingCoupon(false);
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
        kind: 'on-demand', ownerId: user?._id || null, date: dateStr, hours, guests, notes, coupon, slot,
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
      serviceType: DEFAULT_SERVICE_TYPE, date: dateStr, hours, slot, guests, address,
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
      kind: 'on-demand', ownerId: user?._id || null, date: dateStr, hours, guests, notes, coupon, slot,
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
        serviceType: DEFAULT_SERVICE_TYPE,
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
      navigation.setParams({ couponCode: null });
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
      <KeyboardAwareScrollView
        key={step}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
          <View style={styles.hero}>
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
              <Defs>
                <LinearGradient id="book-hero" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#fffdf8" />
                  <Stop offset="0.55" stopColor="#fff3e2" />
                  <Stop offset="1" stopColor="#ffe1c2" />
                </LinearGradient>
                <RadialGradient id="book-bloom" cx="0.92" cy="0.04" r="0.9">
                  <Stop offset="0" stopColor="#fb923c" stopOpacity={0.24} />
                  <Stop offset="1" stopColor="#fb923c" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x={0} y={0} width={1} height={1} fill="url(#book-hero)" />
              <Rect x={0} y={0} width={1} height={1} fill="url(#book-bloom)" />
            </Svg>

            <View style={styles.heroTop}>
              <View style={styles.heroCopy}>
                <View style={styles.eyebrow}>
                  <Sparkles size={12} color={colors.primary700} />
                  <Text style={styles.eyebrowText}>INSTANT BOOKING</Text>
                </View>
                <Text style={styles.heroTitle}>Book your cook</Text>
                <View style={styles.heroTrust}>
                  <ShieldCheck size={13} color={colors.primary700} />
                  <Text style={styles.heroTrustText}>Verified</Text>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroTrustText}>No payment now</Text>
                </View>
              </View>
              <View style={styles.heroPrice}>
                <Text style={styles.heroPriceLabel}>{hours} HR · ALL-IN</Text>
                <Text style={styles.heroPriceValue}>{formatCurrency(slab)}</Text>
                <Text style={styles.heroPriceSave}>
                  {saving > 0 ? `Save ${formatCurrency(saving)}` : 'Launch price'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.progressCard}>
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <React.Fragment key={label}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                      {done ? (
                        <Check size={12} color={colors.white} strokeWidth={3} />
                      ) : (
                        <Text style={[styles.stepNum, active && styles.stepNumOn]}>{i + 1}</Text>
                      )}
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.stepLabel, active && styles.stepLabelOn, done && styles.stepLabelDone]}>
                      {label}
                    </Text>
                  </View>
                  {i < STEPS.length - 1 ? (
                    <View style={[styles.stepLine, done && styles.stepLineDone]} />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>

          <ErrorBanner message={formError} />

          {step === 0 ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileOrange]}>
                    <CalendarDays size={18} color={colors.primary700} />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>When do you need a cook?</Text>
                    <Text style={styles.cardHint}>Pick a date and how long you need.</Text>
                  </View>
                </View>

                <View style={styles.quickDates}>
                  {[0, 1, 2].map((offset) => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const active = dateStr === day;
                    return (
                      <TouchableOpacity
                        key={offset}
                        onPress={() => pickDateOffset(offset)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        style={[styles.quickDate, active && styles.quickDateOn]}>
                        <Text style={[styles.quickDateLabel, active && styles.quickDateLabelOn]}>
                          {offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </Text>
                        <Text style={[styles.quickDateValue, active && styles.quickDateValueOn]}>
                          {d.getDate()} {d.toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={styles.dateCard}
                  onPress={() => setShowDatePicker(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change booking date">
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeDow}>{dateDow}</Text>
                    <Text style={styles.dateBadgeDay}>{dateDay}</Text>
                    <Text style={styles.dateBadgeMonth}>{dateMonth}</Text>
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.dateLabel}>SELECTED DATE</Text>
                    <Text style={styles.dateValue}>{formatDate(dateStr)}</Text>
                  </View>
                  <View style={styles.changePill}>
                    <Text style={styles.changePillText}>Change</Text>
                    <ChevronDown size={14} color={colors.primary700} />
                  </View>
                </TouchableOpacity>
                {showDatePicker ? (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    minimumDate={new Date(localTodayStr() + 'T00:00:00')}
                    onChange={(e, d) => {
                      setShowDatePicker(false);
                      if (d) {
                        setDate(d);
                        setSlot(null);
                        setFormError('');
                      }
                    }}
                  />
                ) : null}
              </View>

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileBlue]}>
                    <Timer size={18} color="#1d4ed8" />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>How long do you need?</Text>
                    <Text style={styles.cardHint}>Longer sessions save more per hour.</Text>
                  </View>
                  <View style={styles.hoursPill}>
                    <Text style={styles.hoursPillText}>{hours}h</Text>
                  </View>
                </View>
                <View style={styles.durationGrid}>
                  {[1, 2, 3, 4].map((h) => {
                    const price = slabPriceForDuration(h);
                    const save = Math.max(0, (LAUNCH_SLAB_PRICES[1] || 0) * h - Number(price || 0));
                    const active = hours === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        onPress={() => {
                          setHours(h);
                          setSlot(null);
                          setFormError('');
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                        style={[styles.durationCard, active && styles.durationCardOn]}>
                        {save > 0 ? (
                          <View style={styles.saveBadge}>
                            <Text style={styles.saveBadgeText}>SAVE {formatCurrency(save)}</Text>
                          </View>
                        ) : null}
                        <View style={[styles.durationCheck, active && styles.durationCheckOn]}>
                          {active ? <Check size={12} color={colors.white} strokeWidth={3} /> : null}
                        </View>
                        <Text style={[styles.durationHours, active && styles.durationHoursOn]}>
                          {h} hr{h > 1 ? 's' : ''}
                        </Text>
                        <Text style={[styles.durationPrice, active && styles.durationPriceOn]}>
                          {formatCurrency(price)}
                        </Text>
                        <Text style={styles.durationPer}>{price ? `₹${Math.round(price / h)}/hr` : ''}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileEmerald]}>
                    <Users size={18} color="#047857" />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>Who&apos;s joining?</Text>
                    <Text style={styles.cardHint}>Tell the cook how many people to prepare for.</Text>
                  </View>
                </View>
                <Field
                  label="Guests"
                  value={String(guests)}
                  onChangeText={setGuests}
                  keyboardType="number-pad"
                  maxLength={3}
                  leftIcon={<Users size={16} color={colors.slate400} />}
                />
                <Field
                  label="Notes for the cook (optional)"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  maxLength={500}
                  placeholder="Allergies, spice level, dishes to prepare…"
                />
              </View>

              <Button
                title="Choose a time"
                testID="booking-next-time"
                icon={<Clock size={18} color={colors.white} />}
                onPress={() => {
                  if (dateStr < localTodayStr()) {
                    setFormError('That date already passed — please pick today or a future date.');
                    return;
                  }
                  setFormError('');
                  setStep(1);
                }}
              />
              <Text style={styles.footerNote}>No payment now — you&apos;ll see the full price before confirming.</Text>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileOrange]}>
                    <Clock size={18} color={colors.primary700} />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>Pick a start time</Text>
                    <Text style={styles.cardHint}>Service hours 8:00 AM – 8:00 PM. End time is calculated.</Text>
                  </View>
                  <View style={styles.hoursPill}>
                    <Text style={styles.hoursPillText}>{hours}h</Text>
                  </View>
                </View>

                {timeGroups.length === 0 ? (
                  <View style={styles.emptySlot}>
                    <View style={styles.emptyIcon}>
                      <Clock size={22} color={colors.slate400} />
                    </View>
                    <Text style={styles.emptyTitle}>No start times left</Text>
                    <Text style={styles.emptyText}>
                      This date has no slot that fits a {hours}-hour booking. Pick another date or a shorter duration.
                    </Text>
                  </View>
                ) : (
                  timeGroups.map((group) => {
                    const meta = TIME_GROUP_META[group.key] || TIME_GROUP_META.morning;
                    const GroupIcon = meta.Icon;
                    return (
                      <View key={group.key} style={styles.timeGroup}>
                        <View style={styles.timeGroupHead}>
                          <View style={[styles.groupIcon, { backgroundColor: meta.bg }]}>
                            <GroupIcon size={14} color={meta.fg} />
                          </View>
                          <Text style={styles.timeGroupLabel}>{group.label}</Text>
                          <Text style={styles.timeGroupHint}>{group.hint}</Text>
                        </View>
                        <View style={styles.timeGrid}>
                          {group.times.map((t) => {
                            const active = slot?.startTime === t;
                            return (
                              <TouchableOpacity
                                key={t}
                                testID={`booking-time-${t}`}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: active }}
                                onPress={() => {
                                  setSlot({
                                    startTime: t,
                                    endTime: deriveEndTime(t, hours),
                                    derived: true,
                                  });
                                  setFormError('');
                                }}
                                style={[styles.timeChip, active && styles.timeChipOn]}>
                                <Text style={[styles.timeChipText, active && styles.timeChipTextOn]}>
                                  {formatTime12(t)}
                                </Text>
                                {active ? <Check size={12} color={colors.white} strokeWidth={3} /> : null}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}

                {slot?.startTime && slot?.endTime ? (
                  <View style={styles.slotSummary}>
                    <View style={styles.slotSummaryIcon}>
                      <CheckCircle2 size={20} color="#047857" />
                    </View>
                    <View style={shared.flex1}>
                      <Text style={styles.slotSummaryLabel}>YOUR SLOT</Text>
                      <Text style={styles.slotSummaryTitle}>
                        {formatTime12(slot.startTime)} – {formatTime12(slot.endTime)}
                      </Text>
                      <Text style={styles.slotSummarySub}>
                        {hours} hour(s) · ends at {formatTime12(slot.endTime)}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.nav}>
                <View style={shared.flex1}>
                  <Button title="Back" variant="outline" onPress={() => setStep(0)} />
                </View>
                <View style={styles.navPrimary}>
                  <Button
                    title="Continue"
                    testID="booking-next-venue"
                    icon={<ArrowRight size={18} color={colors.white} />}
                    disabled={timeGroups.length === 0}
                    onPress={() => {
                      if (!slot?.startTime || !slot?.endTime) {
                        setFormError('Please pick a start time first.');
                        return;
                      }
                      if (!startOptions.includes(slot.startTime)) {
                        setSlot(null);
                        setFormError('That start time is no longer available — pick another.');
                        return;
                      }
                      setFormError('');
                      setStep(2);
                    }}
                  />
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

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileEmerald]}>
                    <MapPin size={18} color="#047857" />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>Where should the cook come?</Text>
                    <Text style={styles.cardHint}>Give the cook a clear, complete address.</Text>
                  </View>
                </View>
                <Field
                  label="Full venue address *"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Flat, street, area"
                  multiline
                  maxLength={300}
                />
                <Field
                  label="Flat / house no."
                  value={flatNo}
                  onChangeText={setFlatNo}
                  maxLength={120}
                  placeholder="e.g. 12B"
                  leftIcon={<Home size={16} color={colors.slate400} />}
                />
                <Field
                  label="Society / building"
                  value={society}
                  onChangeText={setSociety}
                  maxLength={160}
                  placeholder="e.g. Sunshine Residency"
                  leftIcon={<Building2 size={16} color={colors.slate400} />}
                />
                <Field
                  label="Landmark"
                  value={landmark}
                  onChangeText={setLandmark}
                  maxLength={160}
                  placeholder="e.g. Near Gopalpatti"
                  leftIcon={<Navigation size={16} color={colors.slate400} />}
                />
                <Field
                  label="City *"
                  value={city}
                  onChangeText={setCity}
                  maxLength={80}
                  leftIcon={<MapPin size={16} color={colors.slate400} />}
                />
              </View>

              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.locationRow}
                  onPress={detectLocation}
                  disabled={location.loading}
                  accessibilityRole="button"
                  accessibilityLabel={coords ? 'Change pinned location' : 'Pin current location'}
                  activeOpacity={0.8}>
                  <View style={[styles.iconTile, styles.iconTileBlue]}>
                    <Navigation size={18} color="#1d4ed8" />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.locationTitle}>
                      {coords ? 'Location pinned' : location.loading ? 'Detecting location…' : 'Pin your exact location'}
                    </Text>
                    <Text style={styles.locationSub}>
                      {coords
                        ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)} — tap to re-pin`
                        : 'Helps the cook find your home faster.'}
                    </Text>
                  </View>
                  <View style={[styles.locationAction, coords && styles.locationActionDone]}>
                    {location.loading ? (
                      <ActivityIndicator size="small" color={colors.primary700} />
                    ) : coords ? (
                      <Check size={16} color="#047857" strokeWidth={3} />
                    ) : (
                      <LocateFixed size={16} color={colors.primary700} />
                    )}
                  </View>
                </TouchableOpacity>
                {!coords && location.status !== LOCATION_IDLE && location.status !== LOCATION_OK ? (
                  <Text style={styles.locationHint}>{locationMessage(location.status)}</Text>
                ) : null}
              </View>

              <View style={styles.safetyCard}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileRose]}>
                    <ShieldCheck size={18} color="#be123c" />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>Safety check</Text>
                    <Text style={styles.cardHint}>Required by CookMitra policy.</Text>
                  </View>
                </View>
                <Text style={styles.safetyQuestion}>
                  Will a woman be present at home throughout the service?
                </Text>
                <View style={styles.presenceRow}>
                  <TouchableOpacity
                    testID="booking-presence-yes"
                    onPress={() => {
                      setPresence('yes');
                      setFormError('');
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: presence === 'yes' }}
                    style={[styles.presenceCard, presence === 'yes' && styles.presenceCardYes]}>
                    <View style={[styles.presenceCircle, presence === 'yes' && styles.presenceCircleYes]}>
                      {presence === 'yes' ? <Check size={12} color={colors.white} strokeWidth={3} /> : null}
                    </View>
                    <View style={shared.flex1}>
                      <Text style={[styles.presenceTitle, presence === 'yes' && styles.presenceTitleYes]}>Yes</Text>
                      <Text style={styles.presenceSub}>She&apos;ll be home</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="booking-presence-no"
                    onPress={() => setPresence('no')}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: presence === 'no' }}
                    style={[styles.presenceCard, presence === 'no' && styles.presenceCardNo]}>
                    <View style={[styles.presenceCircle, presence === 'no' && styles.presenceCircleNo]}>
                      {presence === 'no' ? <X size={12} color={colors.white} strokeWidth={3} /> : null}
                    </View>
                    <View style={shared.flex1}>
                      <Text style={[styles.presenceTitle, presence === 'no' && styles.presenceTitleNo]}>No</Text>
                      <Text style={styles.presenceSub}>Not this time</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.nav}>
                <View style={shared.flex1}>
                  <Button title="Back" variant="outline" onPress={() => setStep(1)} />
                </View>
                <View style={styles.navPrimary}>
                  <Button
                    title="Review booking"
                    testID="booking-next-confirm"
                    icon={<ArrowRight size={18} color={colors.white} />}
                    onPress={() => setStep(3)}
                  />
                </View>
              </View>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileOrange]}>
                    <ChefHat size={18} color={colors.primary700} />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>Your booking</Text>
                    <Text style={styles.cardHint}>Review the details before we find your cook.</Text>
                  </View>
                  <View style={styles.almostPill}>
                    <BadgeCheck size={12} color="#047857" />
                    <Text style={styles.almostPillText}>Almost done</Text>
                  </View>
                </View>

                <View style={styles.summaryList}>
                  <SummaryRow
                    icon={<CalendarDays size={16} color={colors.primary700} />}
                    label="Date"
                    value={formatDate(dateStr)}
                    onPress={() => setStep(0)}
                  />
                  <SummaryRow
                    icon={<Clock size={16} color="#1d4ed8" />}
                    label="Time"
                    value={slot ? `${formatTime12(slot.startTime)} – ${formatTime12(slot.endTime)}` : 'Not selected'}
                    onPress={() => setStep(1)}
                  />
                  <SummaryRow
                    icon={<Users size={16} color="#047857" />}
                    label="Session"
                    value={`${hours} hour${hours === 1 ? '' : 's'} · ${guests} guest${Number(guests) === 1 ? '' : 's'}`}
                    onPress={() => setStep(0)}
                  />
                  <SummaryRow
                    icon={<MapPin size={16} color="#be123c" />}
                    label="Venue"
                    value={venueSummary || 'Not added'}
                    onPress={() => setStep(2)}
                  />
                </View>
              </View>

              <View style={styles.priceStrip}>
                <View style={styles.priceStripLeft}>
                  <View style={styles.priceStripIcon}>
                    <Wallet size={16} color={colors.primary700} />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.priceStripLabel}>All-in price · {hours} hr{hours === 1 ? '' : 's'}</Text>
                    <Text style={styles.priceStripNote}>Flat rate · same for every cook</Text>
                  </View>
                </View>
                <View style={styles.priceStripRight}>
                  <Text style={styles.priceStripValue}>{formatCurrency(slab)}</Text>
                  <Text style={styles.priceStripBadge}>No payment now</Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.iconTile, styles.iconTileAmber]}>
                    <BadgePercent size={18} color="#b45309" />
                  </View>
                  <View style={shared.flex1}>
                    <Text style={styles.cardTitle}>Have a coupon?</Text>
                    <Text style={styles.cardHint}>Apply it now — the discount is confirmed at booking.</Text>
                  </View>
                </View>
                <View style={styles.couponRow}>
                  <View style={styles.couponInputWrap}>
                    <BadgePercent size={16} color={colors.slate400} />
                    <TextInput
                      style={styles.couponInput}
                      value={coupon}
                      onChangeText={(v) => {
                        setCoupon(v);
                        setCouponState(null);
                      }}
                      placeholder="Enter coupon code"
                      placeholderTextColor={colors.slate400}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={24}
                    />
                  </View>
                  <TouchableOpacity
                    testID="booking-coupon-apply"
                    onPress={applyCoupon}
                    disabled={!coupon.trim() || validatingCoupon}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !coupon.trim() || validatingCoupon }}
                    style={[styles.couponBtn, (!coupon.trim() || validatingCoupon) && styles.couponBtnDisabled]}>
                    {validatingCoupon ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.couponBtnText}>Apply</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {couponState ? (
                  <View style={[styles.couponMsg, couponState.ok ? styles.couponMsgOk : styles.couponMsgErr]}>
                    {couponState.ok ? (
                      <CheckCircle2 size={14} color="#047857" />
                    ) : (
                      <X size={14} color="#be123c" />
                    )}
                    <Text style={[styles.couponMsgText, couponState.ok ? styles.couponMsgTextOk : styles.couponMsgTextErr]}>
                      {couponState.message}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.nav}>
                <View style={shared.flex1}>
                  <Button title="Back" variant="outline" onPress={() => setStep(2)} />
                </View>
                <View style={styles.navPrimary}>
                  <Button
                    title={submitting ? 'Booking…' : 'Confirm booking'}
                    testID="booking-submit"
                    icon={<Check size={18} color={colors.white} strokeWidth={3} />}
                    onPress={submit}
                    loading={submitting}
                  />
                </View>
              </View>
              <Text style={styles.footerNote}>
                We&apos;ll start finding a verified cook as soon as you confirm.
              </Text>
            </>
          ) : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 36,
  },

  // Hero -------------------------------------------------------------------
  hero: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 16,
    marginTop: 4,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: '#fff3e2',
    shadowColor: '#c2410c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroCopy: { flex: 1 },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(194, 65, 12, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  eyebrowText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, color: colors.primary700 },
  heroTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, color: colors.slate900, marginTop: 10 },
  heroTrust: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  heroTrustText: { fontSize: 12, fontWeight: '600', color: '#9a3412' },
  heroDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#fb923c' },
  heroPrice: {
    minWidth: 94,
    alignItems: 'flex-end',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  heroPriceLabel: { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.6, color: '#9a3412', textAlign: 'right' },
  heroPriceValue: { fontSize: 22, fontWeight: '800', color: colors.primary800, marginTop: 2 },
  heroPriceSave: { fontSize: 10, fontWeight: '700', color: '#047857', marginTop: 1, textAlign: 'right' },

  // Stepper ----------------------------------------------------------------
  progressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f1e7dc',
    backgroundColor: colors.white,
    paddingVertical: 11,
    paddingHorizontal: 10,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  stepItem: { width: 52, alignItems: 'center' },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.slate200,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  stepDotDone: { borderColor: colors.emerald, backgroundColor: colors.emerald },
  stepNum: { fontSize: 11, fontWeight: '800', color: colors.slate500 },
  stepNumOn: { color: colors.white },
  stepLabel: { width: 52, marginTop: 4, textAlign: 'center', fontSize: 10, fontWeight: '600', color: colors.slate400 },
  stepLabelOn: { fontWeight: '800', color: colors.primary700 },
  stepLabelDone: { color: '#047857' },
  stepLine: { flex: 1, height: 2, marginTop: 12, marginHorizontal: 2, borderRadius: 1, backgroundColor: colors.slate100 },
  stepLineDone: { backgroundColor: '#a7f3d0' },

  // Cards ------------------------------------------------------------------
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1e7dc',
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  iconTile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconTileOrange: { backgroundColor: '#fff7ed' },
  iconTileBlue: { backgroundColor: '#eff6ff' },
  iconTileEmerald: { backgroundColor: '#ecfdf5' },
  iconTileAmber: { backgroundColor: '#fffbeb' },
  iconTileRose: { backgroundColor: '#fff1f2' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.slate900 },
  cardHint: { fontSize: 12, lineHeight: 17, color: colors.slate500, marginTop: 3 },

  // Date -------------------------------------------------------------------
  quickDates: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  quickDate: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2f6',
    backgroundColor: '#fbfaf8',
    paddingVertical: 8,
  },
  quickDateOn: { borderColor: colors.primary, backgroundColor: '#fff7ed' },
  quickDateLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.slate500 },
  quickDateLabelOn: { color: colors.primary700 },
  quickDateValue: { fontSize: 13, fontWeight: '800', color: colors.slate800, marginTop: 2 },
  quickDateValueOn: { color: colors.primary800 },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1e7dc',
    backgroundColor: '#fffdfa',
    padding: 10,
  },
  dateBadge: {
    width: 50,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dateBadgeDow: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: colors.primary700 },
  dateBadgeDay: { fontSize: 20, fontWeight: '800', lineHeight: 24, color: colors.primary800 },
  dateBadgeMonth: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5, color: colors.primary700 },
  dateLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: colors.slate400 },
  dateValue: { fontSize: 14, fontWeight: '800', color: colors.slate900, marginTop: 2 },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  changePillText: { fontSize: 11, fontWeight: '800', color: colors.primary700 },

  // Duration ---------------------------------------------------------------
  hoursPill: { borderRadius: 999, backgroundColor: '#eff6ff', paddingVertical: 5, paddingHorizontal: 10 },
  hoursPillText: { fontSize: 12, fontWeight: '800', color: '#1d4ed8' },
  durationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationCard: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#eef2f6',
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingTop: 26,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  durationCardOn: { borderColor: colors.primary, backgroundColor: '#fff7ed' },
  saveBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderBottomLeftRadius: 8,
    backgroundColor: '#ecfdf5',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  saveBadgeText: { fontSize: 8, fontWeight: '800', letterSpacing: 0.2, color: '#047857' },
  durationCheck: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationCheckOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  durationHours: { fontSize: 13, fontWeight: '800', color: colors.slate800 },
  durationHoursOn: { color: colors.primary800 },
  durationPrice: { fontSize: 17, fontWeight: '800', color: colors.slate900, marginTop: 2 },
  durationPriceOn: { color: colors.primary800 },
  durationPer: { fontSize: 10, color: colors.slate500, marginTop: 1 },

  // Time slots -------------------------------------------------------------
  timeGroup: { marginBottom: 12 },
  timeGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  groupIcon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  timeGroupLabel: { fontSize: 13, fontWeight: '800', color: colors.slate800 },
  timeGroupHint: { fontSize: 11, color: colors.slate400, marginLeft: 'auto' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  timeChip: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#eef2f6',
    backgroundColor: colors.white,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  timeChipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  timeChipText: { fontSize: 12.5, fontWeight: '700', color: colors.slate700 },
  timeChipTextOn: { color: colors.white, fontWeight: '800' },
  emptySlot: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e2e8f0',
    backgroundColor: '#fbfaf8',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: colors.slate800 },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: colors.slate500, marginTop: 4 },
  slotSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    padding: 12,
    marginTop: 12,
  },
  slotSummaryIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  slotSummaryLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.7, color: '#047857' },
  slotSummaryTitle: { fontSize: 16, fontWeight: '800', color: '#065f46', marginTop: 2 },
  slotSummarySub: { fontSize: 11.5, color: '#047857', marginTop: 1 },

  // Navigation -------------------------------------------------------------
  nav: { flexDirection: 'row', gap: 10, marginTop: 2, marginBottom: 6 },
  navPrimary: { flex: 1.4 },
  footerNote: { textAlign: 'center', fontSize: 11.5, lineHeight: 16, color: colors.slate400, marginTop: 10 },

  // Venue ------------------------------------------------------------------
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationTitle: { fontSize: 14, fontWeight: '800', color: colors.slate900 },
  locationSub: { fontSize: 11.5, lineHeight: 16, color: colors.slate500, marginTop: 3 },
  locationAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationActionDone: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  locationHint: { fontSize: 11.5, lineHeight: 16, color: colors.amber, marginTop: 10 },

  // Safety -----------------------------------------------------------------
  safetyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fecdd3',
    backgroundColor: '#fffbfc',
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 1,
  },
  safetyQuestion: { fontSize: 13, fontWeight: '700', lineHeight: 19, color: colors.slate800, marginBottom: 12 },
  presenceRow: { flexDirection: 'row', gap: 8 },
  presenceCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#eef2f6',
    backgroundColor: colors.white,
    padding: 10,
  },
  presenceCardYes: { borderColor: '#6ee7b7', backgroundColor: '#ecfdf5' },
  presenceCardNo: { borderColor: '#fda4af', backgroundColor: '#fff1f2' },
  presenceCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceCircleYes: { borderColor: colors.emerald, backgroundColor: colors.emerald },
  presenceCircleNo: { borderColor: colors.rose, backgroundColor: colors.rose },
  presenceTitle: { fontSize: 13, fontWeight: '800', color: colors.slate700 },
  presenceTitleYes: { color: '#047857' },
  presenceTitleNo: { color: '#be123c' },
  presenceSub: { fontSize: 9.5, color: colors.slate500, marginTop: 1 },
  restricted: { borderRadius: 14, borderWidth: 1, borderColor: '#fecdd3', backgroundColor: colors.roseLight, padding: 12, marginBottom: 12 },
  restrictedText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18, color: '#9f1239' },

  // Confirm ----------------------------------------------------------------
  summaryList: { marginTop: -2 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#f4efe9',
  },
  summaryIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#fbfaf8', alignItems: 'center', justifyContent: 'center' },
  summaryText: { flex: 1 },
  summaryLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: colors.slate400 },
  summaryValue: { fontSize: 13, fontWeight: '700', lineHeight: 18, color: colors.slate800, marginTop: 2 },
  summaryEdit: { fontSize: 11, fontWeight: '800', color: colors.primary700, paddingHorizontal: 4 },
  almostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    paddingVertical: 4,
    paddingHorizontal: 7,
  },
  almostPillText: { fontSize: 9, fontWeight: '800', color: '#047857' },
  priceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#7c2d12',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 3,
  },
  priceStripLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  priceStripIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255, 255, 255, 0.14)', alignItems: 'center', justifyContent: 'center' },
  priceStripLabel: { fontSize: 12, fontWeight: '800', color: '#ffedd5' },
  priceStripNote: { fontSize: 10.5, color: '#fed7aa', marginTop: 2 },
  priceStripRight: { alignItems: 'flex-end', marginLeft: 8 },
  priceStripValue: { fontSize: 20, fontWeight: '800', color: colors.white },
  priceStripBadge: { fontSize: 9, fontWeight: '800', color: '#bbf7d0', marginTop: 2 },

  // Coupon -----------------------------------------------------------------
  couponRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  couponInputWrap: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#eef2f6',
    backgroundColor: '#fbfaf8',
    paddingHorizontal: 10,
  },
  couponInput: { flex: 1, fontSize: 13.5, fontWeight: '600', color: colors.slate900, paddingVertical: 10 },
  couponBtn: { minWidth: 68, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  couponBtnDisabled: { backgroundColor: '#fdba74' },
  couponBtnText: { fontSize: 12.5, fontWeight: '800', color: colors.white },
  couponMsg: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 10, borderWidth: 1, padding: 9, marginTop: 10 },
  couponMsgOk: { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' },
  couponMsgErr: { borderColor: '#fecdd3', backgroundColor: '#fff1f2' },
  couponMsgText: { flex: 1, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  couponMsgTextOk: { color: '#047857' },
  couponMsgTextErr: { color: '#be123c' },
});

export default BookCookScreen;
