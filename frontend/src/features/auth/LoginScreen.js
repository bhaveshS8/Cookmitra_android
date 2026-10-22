import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  CalendarCheck,
  Check,
  ChevronRight,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
} from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../../store/store';
import { useShowToast } from '../../store/toast';
import { normalizeEmail, validateEmail, authErrorMessage, fieldErrorsFromResponse } from '../../utils/authValidation';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { ErrorBanner } from '../../components/feedback';
import { savePostAuthTarget } from '../../services/session';

const LoginScreen = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const showToast = useShowToast();
  const loading = useSelector((s) => s.auth.loading);
  const next = route?.params?.next || null;

  const clearFieldError = (field) => {
    setFieldErrors((p) => (p[field] ? { ...p, [field]: '' } : p));
    setError('');
  };

  const submit = async () => {
    if (loading) return;
    const errors = {};
    const emailErr = validateEmail(email);
    if (emailErr) errors.email = emailErr;
    // Sign-in only checks that a password was entered. Minimum-length and
    // strength rules belong to registration/reset and must not block older
    // accounts from signing in.
    if (!password) errors.password = 'Password is required';
    else if (password.length > 128) errors.password = 'Password must be under 128 characters';
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setError('Please fix the highlighted fields and try again.');
      return;
    }
    setError('');
    try {
      const { user } = await dispatch(
        loginUser({ email: normalizeEmail(email), password, rememberMe }),
      ).unwrap();
      if (next && user?.role === 'customer') await savePostAuthTarget(next);
      showToast(`Welcome back, ${user.name}!`, 'success');
      // Root navigator switches stacks by role; Home resumes a pending target.
    } catch (err) {
      const serverFields = fieldErrorsFromResponse(err);
      if (Object.keys(serverFields).length) setFieldErrors(serverFields);
      const msg = authErrorMessage(err, 'Invalid credentials. Please try again.');
      setError(msg);
      showToast(msg, 'error');
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {/* Soft brand glow — keeps the screen warm without competing with the form. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
          <Defs>
            <RadialGradient id="login-glow" cx="0.9" cy="0.02" r="0.85">
              <Stop offset="0" stopColor="#fb923c" stopOpacity={0.15} />
              <Stop offset="1" stopColor="#fb923c" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={1} height={1} fill="url(#login-glow)" />
        </Svg>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
          <View style={styles.body}>
            <View style={styles.eyebrow}>
              <ShieldCheck size={13} color={colors.primary700} strokeWidth={2.3} />
              <Text style={styles.eyebrowText}>SECURE SIGN-IN</Text>
            </View>

            <Text style={styles.title}>
              Welcome <Text style={styles.titleAccent}>back.</Text>
            </Text>
            <Text style={styles.subtitle}>
              Sign in to manage your bookings, payments, and messages — all in one place.
            </Text>

            {next ? (
              <View style={styles.resumeCard}>
                <View style={styles.resumeIcon}>
                  <CalendarCheck size={18} color={colors.primary} strokeWidth={2.2} />
                </View>
                <Text style={styles.resumeText}>
                  You were booking a cook — sign in to pick up right where you left off.
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <ErrorBanner message={error} />

              <Field
                label="Email address"
                value={email}
                onChangeText={(v) => { setEmail(v); clearFieldError('email'); }}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                maxLength={254}
                leftIcon={<Mail size={18} color={colors.slate400} strokeWidth={2} />}
                error={fieldErrors.email}
              />
              <Field
                label="Password"
                value={password}
                onChangeText={(v) => { setPassword(v); clearFieldError('password'); }}
                placeholder="Enter your password"
                secure
                maxLength={128}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={submit}
                leftIcon={<Lock size={18} color={colors.slate400} strokeWidth={2} />}
                error={fieldErrors.password}
              />

              <View style={styles.row}>
                <TouchableOpacity
                  onPress={() => setRememberMe((r) => !r)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: rememberMe }}
                  accessibilityLabel="Keep me signed in"
                  hitSlop={8}
                  style={styles.checkRow}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                    {rememberMe ? <Check size={12} color={colors.white} strokeWidth={3.5} /> : null}
                  </View>
                  <Text style={styles.checkLabel}>Keep me signed in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword', email ? { email } : undefined)}
                  accessibilityRole="button"
                  hitSlop={8}>
                  <Text style={styles.link}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              <Button
                title={loading ? 'Signing in…' : 'Sign in'}
                onPress={submit}
                loading={loading}
                icon={<LogIn size={18} color={colors.white} strokeWidth={2.3} />}
                testID="login-submit"
              />

              <Text style={styles.terms}>
                By signing in you agree to our{' '}
                <Text
                  style={styles.termsLink}
                  accessibilityRole="link"
                  onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>
                  Terms
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.termsLink}
                  accessibilityRole="link"
                  onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>
                  Privacy Policy
                </Text>
                .
              </Text>

              <View style={styles.securityRow}>
                <ShieldCheck size={13} color={colors.slate400} strokeWidth={2.2} />
                <Text style={styles.securityText}>Protected with encrypted sign-in</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>New to CookMitra?</Text>
              <TouchableOpacity
                style={styles.footerLink}
                onPress={() => navigation.navigate('Register', next ? { next } : undefined)}
                accessibilityRole="button"
                hitSlop={8}>
                <Text style={styles.footerLinkText}>Create an account</Text>
                <ChevronRight size={15} color={colors.primary} strokeWidth={2.6} />
              </TouchableOpacity>
            </View>
          </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
  },
  body: { width: '100%', maxWidth: 520, alignSelf: 'center' },

  eyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#f1e5d8',
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  eyebrowText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.primary700,
  },

  title: {
    marginTop: 16,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.7,
    color: colors.slate900,
  },
  titleAccent: { color: colors.primary },
  subtitle: {
    marginTop: 8,
    maxWidth: 440,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.slate600,
  },

  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    padding: 14,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: '#f6d9c2',
    borderRadius: 16,
  },
  resumeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: colors.primary800,
  },

  card: {
    marginTop: 18,
    padding: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#f2e6da',
    borderRadius: 22,
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
    marginBottom: 16,
  },
  checkRow: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { fontSize: 13, fontWeight: '600', color: colors.slate600 },

  link: { fontSize: 13.5, fontWeight: '800', color: colors.primary },

  terms: {
    marginTop: 12,
    paddingHorizontal: 4,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    color: colors.slate500,
  },
  termsLink: { fontWeight: '700', color: colors.primary700 },

  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#f4ebe3',
  },
  securityText: { fontSize: 11.5, fontWeight: '600', color: colors.slate500 },

  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  footerText: { fontSize: 13.5, color: colors.slate600 },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingVertical: 4,
  },
  footerLinkText: { fontSize: 13.5, fontWeight: '800', color: colors.primary },
});

export default LoginScreen;
