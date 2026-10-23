import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import { useDispatch, useSelector } from 'react-redux';
import API, { getApiErrorMessage } from '../../api/client';
import { useShowToast } from '../../store/toast';
import { logout } from '../../store/store';
import { clearSession } from '../../services/session';
import { parseResetToken } from '../../utils/passwordReset';
import { validatePassword, passwordStrength, strengthLabel } from '../../utils/authValidation';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';
import { ErrorBanner } from '../../components/feedback';

const STRENGTH_COLORS = [
  colors.slate400,
  colors.rose,
  colors.amber,
  colors.blue,
  colors.emerald,
];

const Requirement = ({ label, met }) => (
  <View style={styles.requirement}>
    <View style={[styles.requirementDot, met && styles.requirementDotMet]}>
      {met ? <Check size={10} color={colors.white} strokeWidth={3.5} /> : null}
    </View>
    <Text style={[styles.requirementText, met && styles.requirementTextMet]}>{label}</Text>
  </View>
);

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
      ? 'This reset link is invalid or incomplete. Request a new link and open it on this device.'
      : 'This screen needs a reset link. Request a new link and open it on this device.';

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

  const requestNewLink = () => {
    if (authToken) {
      leave();
      return;
    }
    navigation.navigate('Auth', { screen: 'ForgotPassword' });
  };

  const strength = passwordStrength(password);
  const strengthColor = STRENGTH_COLORS[strength];
  const strengthNote = password ? strengthLabel(strength) : 'Min. 8 characters';
  const hasMinLength = password.length >= 8;
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumberOrSymbol = /[\d\W]/.test(password);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {/* Soft brand glow — matches sign-in, registration, and account recovery. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
          <Defs>
            <RadialGradient id="reset-glow" cx="0.9" cy="0.02" r="0.85">
              <Stop offset="0" stopColor="#fb923c" stopOpacity={0.15} />
              <Stop offset="1" stopColor="#fb923c" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={1} height={1} fill="url(#reset-glow)" />
        </Svg>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.body}>
          <View style={styles.eyebrow}>
            {done ? (
              <CheckCircle2 size={13} color={colors.emerald} strokeWidth={2.3} />
            ) : tokenProblem ? (
              <AlertTriangle size={13} color={colors.amber} strokeWidth={2.3} />
            ) : (
              <Lock size={13} color={colors.primary700} strokeWidth={2.3} />
            )}
            <Text style={styles.eyebrowText}>
              {done ? 'PASSWORD UPDATED' : tokenProblem ? 'LINK NOT VALID' : 'SECURE RESET'}
            </Text>
          </View>

          <Text style={styles.title}>
            {done ? (
              <>You&apos;re <Text style={styles.titleAccent}>all set.</Text></>
            ) : tokenProblem ? (
              <>This link <Text style={styles.titleAccent}>can&apos;t be used.</Text></>
            ) : (
              <>Choose a <Text style={styles.titleAccent}>new password.</Text></>
            )}
          </Text>
          <Text style={styles.subtitle}>
            {done
              ? 'Your password was changed successfully.'
              : tokenProblem
                ? 'The reset link is missing or no longer valid.'
                : 'Create a strong password you haven\u2019t used before.'}
          </Text>

          {done ? (
            <>
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <CheckCircle2 size={32} color="#047857" strokeWidth={2.2} />
                </View>
                <Text style={styles.successTitle}>Password updated</Text>
                <Text style={styles.successText}>
                  Sign in with your new password. For security, other active sessions have been
                  signed out.
                </Text>
              </View>
              <Button
                title={authToken ? 'Back' : 'Back to sign in'}
                variant={authToken ? 'outline' : 'primary'}
                onPress={leave}
                icon={
                  authToken ? (
                    <ChevronLeft size={18} color={colors.primary} strokeWidth={2.5} />
                  ) : (
                    <Lock size={18} color={colors.white} strokeWidth={2.3} />
                  )
                }
                testID="reset-back"
              />
            </>
          ) : tokenProblem ? (
            <>
              <View style={styles.problemCard}>
                <View style={styles.problemIcon}>
                  <AlertTriangle size={24} color="#b45309" strokeWidth={2.2} />
                </View>
                <Text style={styles.problemTitle}>Request a new reset link</Text>
                <Text style={styles.problemText}>{problemText}</Text>
              </View>
              <Button
                title={authToken ? 'Back' : 'Request a new link'}
                variant={authToken ? 'outline' : 'primary'}
                onPress={authToken ? leave : requestNewLink}
                icon={
                  authToken ? (
                    <ChevronLeft size={18} color={colors.primary} strokeWidth={2.5} />
                  ) : (
                    <ChevronRight size={18} color={colors.white} strokeWidth={2.5} />
                  )
                }
                testID="reset-back"
              />
            </>
          ) : (
            <>
              <ErrorBanner message={error} />

              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.iconTile}>
                    <Lock size={18} color={colors.primary700} strokeWidth={2.1} />
                  </View>
                  <View style={styles.cardHeadCopy}>
                    <Text style={styles.cardTitle}>New password</Text>
                    <Text style={styles.cardHint}>Use at least 8 characters.</Text>
                  </View>
                </View>

                <Field
                  label="New password *"
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    setError('');
                    setFieldErrors((p) => ({ ...p, password: '', confirm: '' }));
                  }}
                  placeholder="Min. 8 characters"
                  secure
                  maxLength={128}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  leftIcon={<Lock size={18} color={colors.slate400} strokeWidth={2} />}
                  error={fieldErrors.password}
                  testID="reset-password"
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
                          password && strength >= step ? { backgroundColor: strengthColor } : null,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.strengthText, password ? { color: strengthColor } : null]}>
                    {strengthNote}
                  </Text>
                </View>

                <Field
                  label="Confirm password *"
                  value={confirm}
                  onChangeText={(v) => {
                    setConfirm(v);
                    setError('');
                    setFieldErrors((p) => ({ ...p, confirm: '' }));
                  }}
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
                  testID="reset-confirm"
                />

                {confirm ? (
                  <View style={styles.matchRow}>
                    {confirm === password ? (
                      <CheckCircle2 size={14} color="#047857" strokeWidth={2.3} />
                    ) : (
                      <AlertCircle size={14} color={colors.rose} strokeWidth={2.3} />
                    )}
                    <Text
                      style={[
                        styles.matchText,
                        confirm === password ? styles.matchTextOk : styles.matchTextBad,
                      ]}>
                      {confirm === password
                        ? 'Passwords match'
                        : 'Passwords do not match yet'}
                    </Text>
                  </View>
                ) : null}

                <Button
                  title={loading ? 'Saving\u2026' : 'Save new password'}
                  onPress={submit}
                  loading={loading}
                  icon={<ShieldCheck size={18} color={colors.white} strokeWidth={2.3} />}
                  testID="reset-submit"
                />

                <View style={styles.secureRow}>
                  <ShieldCheck size={14} color={colors.slate400} strokeWidth={2.2} />
                  <Text style={styles.secureText}>Resetting signs you out on all devices</Text>
                </View>

                {!authToken ? (
                  <TouchableOpacity
                    style={styles.newLink}
                    onPress={requestNewLink}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <Text style={styles.newLinkText}>Need a new link?</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.tipsCard}>
                <View style={styles.tipsHead}>
                  <Sparkles size={15} color={colors.primary700} strokeWidth={2.2} />
                  <Text style={styles.tipsTitle}>Make it strong</Text>
                </View>
                <Requirement label="At least 8 characters" met={hasMinLength} />
                <Requirement label="Upper and lowercase letters" met={hasMixedCase} />
                <Requirement label="A number or symbol" met={hasNumberOrSymbol} />
              </View>
            </>
          )}
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
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: 15,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadCopy: { flex: 1 },
  cardTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '800', color: colors.slate900 },
  cardHint: { marginTop: 2, fontSize: 12, lineHeight: 17, color: colors.slate500 },

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

  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -6,
    marginBottom: 14,
  },
  matchText: { fontSize: 11.5, fontWeight: '700' },
  matchTextOk: { color: '#047857' },
  matchTextBad: { color: colors.rose },

  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: '#f4ebe3',
  },
  secureText: { fontSize: 11.5, fontWeight: '600', color: colors.slate500 },
  newLink: { alignSelf: 'center', paddingVertical: 6, marginTop: 4 },
  newLinkText: { fontSize: 12, fontWeight: '800', color: colors.primary },

  tipsCard: {
    marginTop: 14,
    padding: 16,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f6e3d1',
    borderRadius: 18,
  },
  tipsHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  tipsTitle: { fontSize: 13, fontWeight: '800', color: '#9a3412' },
  requirement: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  requirementDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.slate300,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requirementDotMet: { borderColor: colors.emerald, backgroundColor: colors.emerald },
  requirementText: { fontSize: 12, lineHeight: 17, color: colors.slate500 },
  requirementTextMet: { color: '#047857', fontWeight: '700' },

  successCard: {
    marginTop: 18,
    padding: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 22,
    alignItems: 'center',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: { fontSize: 18, fontWeight: '800', color: '#065f46' },
  successText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.slate600,
  },

  problemCard: {
    marginTop: 18,
    padding: 18,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 22,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  problemIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  problemTitle: { fontSize: 16, fontWeight: '800', color: '#92400e' },
  problemText: { marginTop: 6, fontSize: 13, lineHeight: 20, color: '#78350f' },
});

export default ResetPasswordScreen;
