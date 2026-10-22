import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import API, { getApiErrorMessage } from '../../api/client';
import { useShowToast } from '../../store/toast';
import { logout } from '../../store/store';
import { clearSession } from '../../services/session';
import { parseResetToken } from '../../utils/passwordReset';
import { validatePassword } from '../../utils/authValidation';
import { shared } from '../../theme/shared';
import { BrandHeader } from '../../components/BrandHeader';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { ErrorBanner } from '../../components/feedback';

const ResetPasswordScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const authToken = useSelector((s) => s.auth.token);
  const userRole = useSelector((s) => s.auth.user?.role);
  const routeToken = route?.params?.token;
  const initial = parseResetToken(routeToken);
  // Keep the token in state so clearing the navigation param after a
  // successful reset does not wipe the "done" screen.
  const [token, setToken] = useState(initial.token);
  const [tokenProblem, setTokenProblem] = useState(initial.problem);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const ignoreNextParamChange = useRef(false);
  const showToast = useShowToast();

  useEffect(() => {
    // The successful reset deliberately clears the navigation param so the
    // token no longer sits in navigation state. Ignore that one change.
    if (ignoreNextParamChange.current) {
      ignoreNextParamChange.current = false;
      return;
    }
    const parsed = parseResetToken(routeToken);
    setToken(parsed.token);
    setTokenProblem(parsed.problem);
    if (parsed.token) setDone(false);
  }, [routeToken]);

  const submit = async () => {
    if (loading || !token) return;
    const errors = {};
    const pw = validatePassword(password);
    if (pw) errors.password = pw;
    if (confirm !== password) errors.confirm = 'Passwords do not match';
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    setLoading(true);
    setError('');
    try {
      const res = await API.post('/auth/reset-password', { token, password });
      setDone(true);
      ignoreNextParamChange.current = true;
      navigation.setParams({ token: null });
      showToast(
        res.data?.message || 'Password reset — please sign in with your new password.',
        'success',
      );
      // The backend bumped tokenVersion, so any session on this device is
      // already invalid. Drop it rather than leaving a stale signed-in UI.
      if (authToken) {
        await clearSession();
        dispatch(logout());
      }
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Reset failed. Your link may have expired.');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const problemText =
    tokenProblem === 'malformed'
      ? 'This reset link is invalid or incomplete. Request a new link from the Forgot password screen and open it on this device.'
      : 'This screen needs a reset link. Request a new link from the Forgot password screen and open it on this device.';

  const leave = () => {
    if (authToken) {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return;
      }
      navigation.navigate(
        userRole === 'cook' ? 'Cook' : userRole === 'admin' ? 'Admin' : 'Customer',
      );
      return;
    }
    navigation.navigate('Auth', { screen: 'Login' });
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAwareScrollView contentContainerStyle={shared.scrollContent}>
        <BrandHeader compact />
        <Text style={[shared.h1, styles.title]}>Set a new password</Text>
        <ErrorBanner message={error} />
        {tokenProblem ? (
          <Text style={shared.body}>{problemText}</Text>
        ) : done ? (
          <Text style={shared.body}>Done — please sign in with your new password.</Text>
        ) : (
          <>
            <Field label="New password *" value={password} onChangeText={(v) => { setPassword(v); setFieldErrors((p) => ({ ...p, password: '' })); }} placeholder="Min 8 characters" secure maxLength={128} autoCapitalize="none" error={fieldErrors.password} />
            <Field label="Confirm password *" value={confirm} onChangeText={(v) => { setConfirm(v); setFieldErrors((p) => ({ ...p, confirm: '' })); }} placeholder="Repeat your password" secure maxLength={128} autoCapitalize="none" error={fieldErrors.confirm} />
          </>
        )}
        {token && !done ? (
          <Button title={loading ? 'Saving…' : 'Save new password'} onPress={submit} loading={loading} />
        ) : (
          <Button
            title={authToken ? 'Back' : 'Back to sign in'}
            variant="outline"
            onPress={leave}
          />
        )}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ title: { marginTop: 16 } });

export default ResetPasswordScreen;
