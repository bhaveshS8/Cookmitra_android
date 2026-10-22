import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  Check,
  ChefHat,
  ChevronRight,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Store,
  User,
  UserPlus,
} from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser } from '../../store/store';
import { useShowToast } from '../../store/toast';
import {
  normalizeEmail, normalizePhone, validateEmail, validateName,
  validatePassword, validatePhone, passwordStrength, strengthLabel,
  authErrorMessage, fieldErrorsFromResponse,
} from '../../utils/authValidation';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { savePostAuthTarget } from '../../services/session';
import { ErrorBanner } from '../../components/feedback';

const STRENGTH_COLORS = [
  colors.slate400,
  colors.rose,
  colors.amber,
  colors.blue,
  colors.emerald,
];

const RegisterScreen = ({ navigation, route }) => {
  const initialRole = route?.params?.role === 'cook' ? 'cook' : 'customer';
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '', role: initialRole });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const showToast = useShowToast();
  const loading = useSelector((s) => s.auth.loading);
  const next = route?.params?.next || null;
  const isCook = form.role === 'cook';

  const set = (k) => (v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setFieldErrors((p) => (p[k] ? { ...p, [k]: '' } : p));
    setError('');
  };

  const chooseRole = (role) => {
    setForm((p) => ({ ...p, role }));
    setFieldErrors((p) => (p.role ? { ...p, role: '' } : p));
    setError('');
  };

  const submit = async () => {
    if (loading) return;
    const errors = {};
    const n = validateName(form.name);
    if (n) errors.name = n;
    const e = validateEmail(form.email);
    if (e) errors.email = e;
    const p = validatePhone(form.phone);
    if (p) errors.phone = p;
    const pw = validatePassword(form.password);
    if (pw) errors.password = pw;
    if (!form.confirm) errors.confirm = 'Please confirm your password';
    else if (form.confirm !== form.password) errors.confirm = 'Passwords do not match';
    if (!['customer', 'cook'].includes(form.role)) errors.role = 'Choose an account type';
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      setError('Please fix the highlighted fields and try again.');
      return;
    }
    setError('');
    try {
      const { user } = await dispatch(
        registerUser({
          name: form.name.trim(),
          email: normalizeEmail(form.email),
          phone: normalizePhone(form.phone),
          password: form.password,
          role: form.role,
        }),
      ).unwrap();
      if (next && user?.role === 'customer') await savePostAuthTarget(next);
      showToast(`Welcome to CookMitra, ${user.name}!`, 'success');
    } catch (err) {
      const serverFields = fieldErrorsFromResponse(err);
      if (Object.keys(serverFields).length) setFieldErrors(serverFields);
      const msg = authErrorMessage(err, 'Could not create your account. Please try again.');
      setError(msg);
      showToast(msg, 'error');
    }
  };

  const strength = passwordStrength(form.password);
  const strengthColor = STRENGTH_COLORS[strength];
  const strengthNote = form.password ? strengthLabel(strength) : 'Min. 8 characters';

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {/* Soft brand glow — matches the welcome and sign-in screens. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
          <Defs>
            <RadialGradient id="register-glow" cx="0.9" cy="0.02" r="0.85">
              <Stop offset="0" stopColor="#fb923c" stopOpacity={0.15} />
              <Stop offset="1" stopColor="#fb923c" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={1} height={1} fill="url(#register-glow)" />
        </Svg>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
          <View style={styles.body}>
            <Text style={styles.title}>
              Create your{'\n'}
              <Text style={styles.titleAccent}>account.</Text>
            </Text>
            <Text style={styles.subtitle}>
              {isCook
                ? 'Share your cooking and earn from local bookings — on your schedule.'
                : 'Book trusted home cooks for everyday meals and celebrations.'}
            </Text>

            <View style={styles.card}>
              <ErrorBanner message={error} />

              <View style={styles.roles}>
                <TouchableOpacity
                  onPress={() => chooseRole('customer')}
                  disabled={loading}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: form.role === 'customer', disabled: loading }}
                  accessibilityLabel="Customer account"
                  style={[styles.role, form.role === 'customer' && styles.roleActive]}>
                  {form.role === 'customer' ? (
                    <View style={styles.roleCheck}>
                      <Check size={11} color={colors.white} strokeWidth={3.5} />
                    </View>
                  ) : null}
                  <View style={[styles.roleIcon, form.role === 'customer' && styles.roleIconActive]}>
                    <Store
                      size={19}
                      color={form.role === 'customer' ? colors.primary : colors.slate500}
                      strokeWidth={2.1}
                    />
                  </View>
                  <Text style={styles.roleName}>Customer</Text>
                  <Text style={styles.roleHint}>Book trusted cooks</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => chooseRole('cook')}
                  disabled={loading}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: form.role === 'cook', disabled: loading }}
                  accessibilityLabel="Cook account"
                  style={[styles.role, form.role === 'cook' && styles.roleActive]}>
                  {form.role === 'cook' ? (
                    <View style={styles.roleCheck}>
                      <Check size={11} color={colors.white} strokeWidth={3.5} />
                    </View>
                  ) : null}
                  <View style={[styles.roleIcon, form.role === 'cook' && styles.roleIconActive]}>
                    <ChefHat
                      size={19}
                      color={form.role === 'cook' ? colors.primary : colors.slate500}
                      strokeWidth={2.1}
                    />
                  </View>
                  <Text style={styles.roleName}>Cook</Text>
                  <Text style={styles.roleHint}>Cook &amp; earn</Text>
                </TouchableOpacity>
              </View>
              {fieldErrors.role ? <Text style={styles.roleError}>{fieldErrors.role}</Text> : null}

              <View style={styles.divider} />

              <Field
                label="Full name"
                value={form.name}
                onChangeText={set('name')}
                placeholder="Your name"
                maxLength={80}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                leftIcon={<User size={18} color={colors.slate400} strokeWidth={2} />}
                error={fieldErrors.name}
              />
              <Field
                label="Email address"
                value={form.email}
                onChangeText={set('email')}
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
                label="Mobile number"
                value={form.phone}
                onChangeText={set('phone')}
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={13}
                autoComplete="tel"
                textContentType="telephoneNumber"
                leftIcon={<Phone size={18} color={colors.slate400} strokeWidth={2} />}
                error={fieldErrors.phone}
              />
              <Field
                label="Password"
                value={form.password}
                onChangeText={set('password')}
                placeholder="Min. 8 characters"
                secure
                maxLength={128}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                leftIcon={<Lock size={18} color={colors.slate400} strokeWidth={2} />}
                error={fieldErrors.password}
              />

              <View
                style={styles.strengthRow}
                accessible
                accessibilityLabel={`Password strength: ${strengthNote}`}>
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((step) => (
                    <View
                      key={step}
                      style={[
                        styles.strengthBar,
                        form.password && strength >= step ? { backgroundColor: strengthColor } : null,
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthText, form.password ? { color: strengthColor } : null]}>
                  {strengthNote}
                </Text>
              </View>

              <Field
                label="Confirm password"
                value={form.confirm}
                onChangeText={set('confirm')}
                placeholder="Repeat your password"
                secure
                maxLength={128}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={submit}
                leftIcon={<Lock size={18} color={colors.slate400} strokeWidth={2} />}
                error={fieldErrors.confirm}
              />

              <Button
                title={loading ? 'Creating your account…' : 'Create account'}
                onPress={submit}
                loading={loading}
                icon={<UserPlus size={18} color={colors.white} strokeWidth={2.3} />}
                testID="register-submit"
              />

              <Text style={styles.terms}>
                By creating an account you agree to our{' '}
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
                <Text style={styles.securityText}>Your information is encrypted and secure</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <TouchableOpacity
                style={styles.footerLink}
                onPress={() => navigation.navigate('Login', next ? { next } : undefined)}
                accessibilityRole="button"
                hitSlop={8}>
                <Text style={styles.footerLinkText}>Sign in</Text>
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

  title: {
    marginTop: 0,
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

  roles: { flexDirection: 'row', gap: 10 },
  role: {
    flex: 1,
    position: 'relative',
    padding: 13,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.slate200,
    borderRadius: 16,
  },
  roleActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  roleCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.slate100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconActive: { backgroundColor: colors.white },
  roleName: {
    marginTop: 10,
    fontSize: 14.5,
    fontWeight: '800',
    color: colors.slate900,
  },
  roleHint: {
    marginTop: 2,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.slate500,
  },
  roleError: { fontSize: 13, color: colors.rose, marginTop: 8 },

  divider: {
    height: 1,
    backgroundColor: '#f4ebe3',
    marginTop: 16,
    marginBottom: 16,
  },

  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -6,
    marginBottom: 14,
  },
  strengthBars: { flex: 1, flexDirection: 'row', gap: 4 },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.slate100,
  },
  strengthText: {
    minWidth: 92,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: colors.slate500,
  },

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

export default RegisterScreen;
