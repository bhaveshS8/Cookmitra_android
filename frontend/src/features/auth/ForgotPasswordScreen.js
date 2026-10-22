import React, { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import API, { getApiErrorMessage } from '../../api/client';
import { useShowToast } from '../../store/toast';
import { normalizeEmail, validateEmail } from '../../utils/authValidation';
import { shared } from '../../theme/shared';
import { BrandHeader } from '../../components/BrandHeader';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { ErrorBanner } from '../../components/feedback';

const ForgotPasswordScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState(route?.params?.email || '');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const showToast = useShowToast();

  const submit = async () => {
    if (loading) return;
    const err = validateEmail(email);
    setFieldError(err);
    if (err) return;
    setLoading(true);
    setError('');
    try {
      await API.post('/auth/forgot-password', { email: normalizeEmail(email) });
      setSent(true);
      showToast('If an account exists for that email, a reset link is on its way.', 'success');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Could not send the reset link. Please try again.');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAwareScrollView contentContainerStyle={shared.scrollContent}>
        <BrandHeader compact />
        <Text style={[shared.h1, styles.title]}>Reset your password</Text>
        <Text style={shared.body}>
          Enter your account email and we will send you a reset link.
        </Text>
        <ErrorBanner message={error} />
        {sent ? (
          <Text style={shared.body}>
            Check your inbox (and spam folder). The link opens CookMitra&apos;s
            secure reset page in your browser so you can set a new password.
          </Text>
        ) : null}
        <Field
          label="Email address *"
          value={email}
          onChangeText={(v) => { setEmail(v); setFieldError(''); }}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={254}
          error={fieldError}
        />
        <Button title={loading ? 'Sending…' : 'Send reset link'} onPress={submit} loading={loading} />
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({ title: { marginTop: 16 } });

export default ForgotPasswordScreen;
