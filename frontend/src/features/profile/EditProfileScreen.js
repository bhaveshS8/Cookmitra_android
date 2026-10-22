import React, { useState } from 'react';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { updateUser } from '../../store/store';
import { useShowToast } from '../../store/toast';
import { updateMe } from '../../api/services';
import { validateName, validateEmail, validatePhone, normalizeEmail, normalizePhone } from '../../utils/authValidation';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { ErrorBanner } from '../../components/feedback';

const EditProfileScreen = ({ navigation }) => {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const showToast = useShowToast();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || user?.mobile || '');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const e = {};
    const n = validateName(name);
    if (n) e.name = n;
    const em = validateEmail(email);
    if (em) e.email = em;
    const p = validatePhone(phone);
    if (p) e.phone = p;
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setSaving(true);
    setError('');
    try {
      const updated = await updateMe({
        name: name.trim(),
        email: normalizeEmail(email),
        phone: normalizePhone(phone),
      });
      dispatch(updateUser(updated?.user || updated));
      showToast('Profile updated.', 'success');
      navigation.goBack();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not update your profile.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAwareScrollView contentContainerStyle={shared.scrollContent}>
        <Text style={shared.h1}>Personal details</Text>
        <ErrorBanner message={error} />
        <Field label="Full name *" value={name} onChangeText={(v) => { setName(v); setErrors((x) => ({ ...x, name: '' })); }} maxLength={80} error={errors.name} />
        <Field label="Email *" value={email} onChangeText={(v) => { setEmail(v); setErrors((x) => ({ ...x, email: '' })); }} keyboardType="email-address" autoCapitalize="none" maxLength={254} error={errors.email} />
        <Field label="Mobile number *" value={phone} onChangeText={(v) => { setPhone(v); setErrors((x) => ({ ...x, phone: '' })); }} keyboardType="phone-pad" maxLength={13} error={errors.phone} />
        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={save} loading={saving} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default EditProfileScreen;
