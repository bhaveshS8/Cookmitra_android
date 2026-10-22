import React, { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSelector } from 'react-redux';
import { useShowToast } from '../../store/toast';
import {
  createCookProfile,
  getMyCookProfile,
  updateCookProfile,
  toggleAvailability,
  uploadCookDocs,
} from '../../api/services';
import { SERVICE_DETAILS } from '../../utils/format';
import { shared } from '../../theme/shared';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { Loader, ErrorBanner } from '../../components/feedback';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_SCHEDULE = DAYS.map((_, day) => ({
  day,
  enabled: false,
  startTime: '09:00',
  endTime: '18:00',
}));

const normalizeSchedule = (weekly) => {
  if (!Array.isArray(weekly) || weekly.length === 0) return DEFAULT_SCHEDULE;
  return DAYS.map((_, day) => {
    const found = weekly.find((row) => Number(row.day) === day);
    return {
      day,
      enabled: Boolean(found?.enabled),
      startTime: found?.startTime || '09:00',
      endTime: found?.endTime || '18:00',
    };
  });
};

const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || '').trim());

const CookSetupScreen = () => {
  const user = useSelector((s) => s.auth.user);
  const showToast = useShowToast();
  const [profile, setProfile] = useState(null);
  const [needsCreate, setNeedsCreate] = useState(false);
  const [bio, setBio] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [address, setAddress] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [specialties, setSpecialties] = useState('');
  const [serviceTypes, setServiceTypes] = useState(['cook_for_me']);
  const [payoutMethod, setPayoutMethod] = useState('');
  const [upiId, setUpiId] = useState('');
  const [holderName, setHolderName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const available = (profile?.availabilityStatus || 'available') === 'available';

  const applyProfile = useCallback((p) => {
    setProfile(p || null);
    setBio(p?.bio || p?.skills || '');
    setServiceArea(p?.serviceArea || '');
    setAddress(p?.address || '');
    setExperienceYears(String(p?.experienceYears ?? 0));
    setSpecialties(Array.isArray(p?.specialties) ? p.specialties.join(', ') : '');
    setServiceTypes(Array.isArray(p?.serviceTypes) && p.serviceTypes.length ? p.serviceTypes : ['cook_for_me']);
    setPayoutMethod(p?.payoutDetails?.method || '');
    setUpiId(p?.payoutDetails?.upiId || '');
    setHolderName(p?.payoutDetails?.holderName || '');
    setBankName(p?.payoutDetails?.bankName || '');
    setAccountLast4(p?.payoutDetails?.accountLast4 || '');
    setIfsc(p?.payoutDetails?.ifsc || '');
    setSchedule(normalizeSchedule(p?.schedule?.weekly));
  }, []);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getMyCookProfile();
      applyProfile(data?.profile || data);
      setNeedsCreate(false);
    } catch (e) {
      if (e?.response?.status === 404) {
        applyProfile(null);
        setNeedsCreate(true);
      } else {
        setError(e?.response?.data?.message || 'Could not load your cook profile.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyProfile]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const flipAvailability = async (next) => {
    if (!profile?._id) {
      showToast('Create and save your cook profile first.', 'info');
      return;
    }
    try {
      const updated = await toggleAvailability(next ? 'available' : 'unavailable');
      setProfile((p) => ({ ...(p || {}), ...(updated || {}), availabilityStatus: next ? 'available' : 'unavailable' }));
      showToast(next ? 'You are now visible for new bookings.' : 'You are hidden from new bookings.', 'success');
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not update availability.', 'error');
    }
  };

  const toggleServiceType = (key) => {
    setServiceTypes((current) => (
      current.includes(key) ? current.filter((s) => s !== key) : [...current, key]
    ));
  };

  const updateSchedule = (day, patch) => {
    setSchedule((rows) => rows.map((row) => (row.day === day ? { ...row, ...patch } : row)));
  };

  const validate = () => {
    if (!serviceTypes.length) return 'Choose at least one service you offer.';
    if (!bio.trim()) return 'Add a short bio so customers know what you cook.';
    if (!serviceArea.trim()) return 'Enter the area you serve.';
    for (const row of schedule.filter((r) => r.enabled)) {
      if (!isTime(row.startTime) || !isTime(row.endTime)) {
        return `${DAYS[row.day]} needs times in HH:MM format.`;
      }
      if (row.startTime >= row.endTime) {
        return `${DAYS[row.day]} end time must be after the start time.`;
      }
    }
    if (payoutMethod === 'upi') {
      if (!/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim())) {
        return 'Enter a valid UPI id (name@bank).';
      }
    }
    if (payoutMethod === 'bank') {
      if (!holderName.trim()) return 'Enter the account holder name.';
      if (!/^\d{4}$/.test(accountLast4.trim())) return 'Enter the last 4 digits of your account number.';
      if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifsc.trim())) return 'Enter a valid 11-character IFSC code.';
    }
    return '';
  };

  const save = async () => {
    if (saving) return;
    const problem = validate();
    if (problem) {
      showToast(problem, 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bio: bio.trim(),
        skills: bio.trim(),
        serviceArea: serviceArea.trim(),
        address: address.trim(),
        experienceYears: Number(experienceYears) || 0,
        specialties: specialties.split(',').map((s) => s.trim()).filter(Boolean),
        serviceTypes,
        schedule: {
          weekly: schedule,
          blockedDates: profile?.schedule?.blockedDates || [],
        },
      };
      if (payoutMethod === 'upi') {
        payload.payoutDetails = {
          method: 'upi',
          upiId: upiId.trim(),
          holderName: holderName.trim(),
          note: profile?.payoutDetails?.note || '',
        };
      } else if (payoutMethod === 'bank') {
        payload.payoutDetails = {
          method: 'bank',
          holderName: holderName.trim(),
          bankName: bankName.trim(),
          accountLast4: accountLast4.trim().slice(-4),
          ifsc: ifsc.trim().toUpperCase(),
          note: profile?.payoutDetails?.note || '',
        };
      }

      if (!profile?._id) {
        const created = await createCookProfile(payload);
        applyProfile(created?.profile || created);
        setNeedsCreate(false);
        showToast('Cook profile created. Complete verification to get approved.', 'success');
      } else {
        const updated = await updateCookProfile(profile._id, payload);
        setProfile((p) => ({ ...(p || {}), ...(updated || {}) }));
        showToast('Profile saved.', 'success');
      }
      await load();
    } catch (e) {
      showToast(e?.response?.data?.message || 'Could not save the profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = (field) => {
    if (!profile?._id) {
      showToast('Save your cook profile before uploading documents.', 'info');
      return;
    }
    launchImageLibrary(
      { mediaType: 'photo', selectionLimit: 1, maxWidth: 1600, maxHeight: 1600, quality: 0.8 },
      async (res) => {
        if (res.didCancel) return;
        if (res.errorCode) {
          showToast('Could not open the gallery.', 'error');
          return;
        }
        const asset = (res.assets || [])[0];
        if (!asset) return;
        if (asset.fileSize && asset.fileSize > 2 * 1024 * 1024) {
          showToast('File too large — each file must be 2MB or less.', 'error');
          return;
        }
        setUploading(true);
        try {
          const form = new FormData();
          form.append(field, {
            uri: Platform.OS === 'android' ? asset.uri : asset.uri?.replace('file://', ''),
            name: asset.fileName || `cook-${field}-${Date.now()}.jpg`,
            type: asset.type || 'image/jpeg',
          });
          const urls = await uploadCookDocs(form);
          const urlKey = field === 'aadhar' ? 'aadharCardUrl' : field === 'pan' ? 'panCardUrl' : 'photoUrl';
          const url = urls?.[urlKey];
          if (!url) throw new Error('Upload failed — no file URL returned.');
          const updated = await updateCookProfile(profile._id, { [urlKey]: url });
          setProfile((p) => ({ ...(p || {}), ...(updated || {}), [urlKey]: url }));
          showToast('Document uploaded for verification.', 'success');
        } catch (e) {
          showToast(e?.response?.data?.message || 'Upload failed.', 'error');
        } finally {
          setUploading(false);
        }
      },
    );
  };

  const chooseDoc = () => {
    Alert.alert('Upload verification document', 'Choose which document to upload.', [
      { text: 'Aadhaar', onPress: () => uploadDoc('aadhar') },
      { text: 'PAN', onPress: () => uploadDoc('pan') },
      { text: 'Profile photo', onPress: () => uploadDoc('photo') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <KeyboardAwareScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>{needsCreate ? 'Create cook profile' : 'Cook profile'}</Text>
        <Text style={shared.body}>Signed in as {user?.name} · {user?.phone}</Text>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : (
          <>
            {needsCreate ? (
              <View style={[shared.card, styles.notice]}>
                <Text style={shared.h3}>One step to become bookable</Text>
                <Text style={shared.small}>Add your cooking details and services so customers can find and book you.</Text>
              </View>
            ) : (
              <View style={[shared.card, styles.switchRow]}>
                <View style={shared.flex1}>
                  <Text style={shared.h3}>Available for bookings</Text>
                  <Text style={shared.small}>Status: {available ? 'available' : 'unavailable'}</Text>
                  <Text style={shared.small}>Approval: {profile?.approvalStatus || 'pending'}</Text>
                </View>
                <Switch
                  value={available}
                  onValueChange={flipAvailability}
                  trackColor={{ true: colors.primary }}
                  accessibilityLabel="Available for bookings"
                />
              </View>
            )}

            <Field
              label="Bio *"
              value={bio}
              onChangeText={setBio}
              multiline
              maxLength={500}
              placeholder="Tell households about your cooking, specialties and experience"
            />
            <Field label="Service area *" value={serviceArea} onChangeText={setServiceArea} maxLength={80} placeholder="e.g. Kothrud, Pune" />
            <Field label="Address" value={address} onChangeText={setAddress} maxLength={200} placeholder="Area / locality for your profile" />
            <Field label="Years of experience" value={experienceYears} onChangeText={setExperienceYears} keyboardType="number-pad" maxLength={2} />
            <Field label="Specialties" value={specialties} onChangeText={setSpecialties} placeholder="e.g. Maharashtrian thali, festive sweets" hint="Separate each specialty with a comma." />

            <Text style={styles.label}>Services you offer *</Text>
            <View style={styles.chips}>
              {Object.entries(SERVICE_DETAILS).map(([key, value]) => {
                const active = serviceTypes.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => toggleServiceType(key)}
                    style={[styles.chip, active && styles.chipOn]}>
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>{value.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[shared.h2, shared.mt16]}>Weekly availability</Text>
            <Text style={shared.small}>Turn on the days you can accept bookings. Times use 24-hour HH:MM format.</Text>
            {schedule.map((row) => (
              <View key={row.day} style={[styles.dayCard, row.enabled && styles.dayCardOn]}>
                <View style={styles.dayHead}>
                  <Text style={styles.dayName}>{DAYS[row.day]}</Text>
                  <Switch
                    value={row.enabled}
                    onValueChange={(value) => updateSchedule(row.day, { enabled: value })}
                    trackColor={{ true: colors.primary }}
                    accessibilityLabel={`Available on ${DAYS[row.day]}`}
                  />
                </View>
                {row.enabled ? (
                  <View style={styles.timeRow}>
                    <TextInput
                      style={styles.timeInput}
                      value={row.startTime}
                      onChangeText={(value) => updateSchedule(row.day, { startTime: value })}
                      placeholder="09:00"
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                    />
                    <Text style={styles.timeTo}>to</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={row.endTime}
                      onChangeText={(value) => updateSchedule(row.day, { endTime: value })}
                      placeholder="18:00"
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                ) : null}
              </View>
            ))}

            <Text style={[shared.h2, shared.mt16]}>Payout details</Text>
            <Text style={shared.small}>Weekly earnings are settled to these details by the CookMitra team.</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                onPress={() => setPayoutMethod(payoutMethod === 'upi' ? '' : 'upi')}
                style={[styles.chip, payoutMethod === 'upi' && styles.chipOn]}>
                <Text style={[styles.chipText, payoutMethod === 'upi' && styles.chipTextOn]}>UPI</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPayoutMethod(payoutMethod === 'bank' ? '' : 'bank')}
                style={[styles.chip, payoutMethod === 'bank' && styles.chipOn]}>
                <Text style={[styles.chipText, payoutMethod === 'bank' && styles.chipTextOn]}>Bank transfer</Text>
              </TouchableOpacity>
            </View>
            {payoutMethod === 'upi' ? (
              <Field
                label="UPI ID *"
                value={upiId}
                onChangeText={setUpiId}
                placeholder="name@bank"
                autoCapitalize="none"
                maxLength={256}
              />
            ) : null}
            {payoutMethod === 'bank' ? (
              <>
                <Field label="Account holder name *" value={holderName} onChangeText={setHolderName} maxLength={120} />
                <Field label="Bank name" value={bankName} onChangeText={setBankName} maxLength={120} />
                <Field label="Account last 4 digits *" value={accountLast4} onChangeText={setAccountLast4} keyboardType="number-pad" maxLength={4} hint="Only the last 4 digits are stored." />
                <Field label="IFSC code *" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" maxLength={11} />
              </>
            ) : null}

            <Button
              title={saving ? 'Saving…' : needsCreate ? 'Create profile' : 'Save profile'}
              onPress={save}
              loading={saving}
            />

            <Text style={[shared.h2, shared.mt16]}>Verification documents</Text>
            <Text style={shared.small}>
              Status: {profile?.approvalStatus || 'pending'}
              {profile?.aadharCardUrl || profile?.panCardUrl ? ' · submitted' : ' · not submitted'}
            </Text>
            <View style={styles.docRow}>
              <Text style={shared.small}>
                Aadhaar: {profile?.aadharCardUrl ? 'uploaded' : 'not uploaded'}
                {' · '}PAN: {profile?.panCardUrl ? 'uploaded' : 'not uploaded'}
                {profile?.photoUrl ? ' · Photo uploaded' : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={chooseDoc} disabled={uploading} style={styles.uploadBtn}>
              <Text style={styles.uploadText}>{uploading ? 'Uploading…' : 'Upload Aadhaar / PAN / photo'}</Text>
            </TouchableOpacity>
            <Text style={shared.small}>Aadhaar and PAN are visible only to the CookMitra verification team. Max 2MB per file.</Text>
          </>
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notice: { gap: 4, backgroundColor: '#fff7ed', borderColor: colors.primary100 },
  label: { fontSize: 14, fontWeight: '700', color: colors.slate800, marginBottom: 8, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 13, backgroundColor: colors.white },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.slate700 },
  chipTextOn: { color: colors.primary800 },
  dayCard: { borderWidth: 1.5, borderColor: colors.slate200, borderRadius: 14, padding: 12, marginTop: 8, backgroundColor: colors.white },
  dayCardOn: { borderColor: colors.primary100, backgroundColor: '#fffbf5' },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontSize: 14, fontWeight: '700', color: colors.slate800 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  timeInput: { flex: 1, borderWidth: 1, borderColor: colors.slate200, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: colors.slate900, backgroundColor: colors.white },
  timeTo: { fontSize: 13, color: colors.slate500 },
  docRow: { marginTop: 4 },
  uploadBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 8 },
  uploadText: { fontSize: 14, fontWeight: '700', color: colors.primary },
});

export default CookSetupScreen;
