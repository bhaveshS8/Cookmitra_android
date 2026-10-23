import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useShowToast } from '../../store/toast';
import { logout, setToken, updateUser } from '../../store/store';
import { replaceSessionToken, clearSession } from '../../services/session';
import { changePassword, setPassword } from '../../api/services';
import { validatePassword } from '../../utils/authValidation';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { ErrorBanner } from '../../components/feedback';

const SecurityScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const showToast = useShowToast();
  const user = useSelector((s) => s.auth.user);
  const googleOnly =
    Boolean(user) &&
    !user.hasPassword &&
    (user.authProvider === 'google' || user.loginMethod === 'google');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    const e = {};
    if (!googleOnly && !current) e.current = 'Current password is required';
    const pw = validatePassword(next);
    if (pw) e.next = pw;
    if (confirm !== next) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    setSaving(true);
    setError('');
    try {
      if (googleOnly) {
        const res = await setPassword({ newPassword: next });
        dispatch(
          updateUser({
            ...(res?.user || {}),
            hasPassword: true,
            authProvider: 'local+google',
            loginMethod: 'local+google',
          }),
        );
        showToast(
          res?.message || 'Password created. You can now sign in either way.',
          'success',
        );
        navigation.goBack();
        return;
      }
      const res = await changePassword({ currentPassword: current, newPassword: next });
      // The backend bumps tokenVersion, invalidating the old JWT. Persist the
      // replacement so this device stays signed in; other devices are logged
      // out as intended. If the new token cannot be secured, end this session
      // instead of leaving the app holding an already-revoked credential.
      if (!res?.token) {
        await clearSession();
        dispatch(logout());
        showToast('Password changed. Please sign in again.', 'info');
        return;
      }
      try {
        await replaceSessionToken(res.token);
      } catch {
        await clearSession();
        dispatch(logout());
        showToast('Password changed, but this session could not be saved securely. Please sign in again.', 'info');
        return;
      }
      dispatch(setToken(res.token));
      showToast('Password changed. Please sign in again on other devices.', 'success');
      navigation.goBack();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (googleOnly ? 'Could not create the password.' : 'Could not change the password.');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAwareScrollView contentContainerStyle={shared.scrollContent}>
        <Text style={shared.h1}>Security</Text>
        <ErrorBanner message={error} />
        {googleOnly ? (
          <View style={shared.card}>
            <Text style={shared.h3}>Create a password</Text>
            <Text style={[shared.body, shared.mt8]}>
              You signed up with Google. Create a password to also sign in with your email and
              password. Google sign-in will keep working too.
            </Text>
          </View>
        ) : null}
        {!googleOnly ? (
          <Field testID="current-password" label="Current password *" value={current} onChangeText={(v) => { setCurrent(v); setErrors((x) => ({ ...x, current: '' })); }} secure autoCapitalize="none" error={errors.current} />
        ) : null}
        <Field testID="new-password" label={googleOnly ? 'Create password *' : 'New password *'} value={next} onChangeText={(v) => { setNext(v); setErrors((x) => ({ ...x, next: '' })); }} secure autoCapitalize="none" maxLength={128} error={errors.next} />
        <Field testID="confirm-password" label={googleOnly ? 'Confirm password *' : 'Confirm new password *'} value={confirm} onChangeText={(v) => { setConfirm(v); setErrors((x) => ({ ...x, confirm: '' })); }} secure autoCapitalize="none" maxLength={128} error={errors.confirm} />
        <Button
          title={
            saving
              ? googleOnly
                ? 'Creating…'
                : 'Saving…'
              : googleOnly
                ? 'Create password'
                : 'Change password'
          }
          onPress={save}
          loading={saving}
          testID="change-password-submit"
        />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default SecurityScreen;
