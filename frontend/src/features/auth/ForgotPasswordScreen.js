import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  Mail,
  Send,
  ShieldCheck,
} from 'lucide-react-native';
import API, { getApiErrorMessage } from '../../api/client';
import { useShowToast } from '../../store/toast';
import { normalizeEmail, validateEmail } from '../../utils/authValidation';
import { colors } from '../../theme/colors';
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

  const goBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation?.navigate?.('Login');
  };

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
      setSent(false);
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {/* Warm brand glow shared with sign-in and registration. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
          <Defs>
            <RadialGradient id="forgot-glow" cx="0.9" cy="0.02" r="0.85">
              <Stop offset="0" stopColor="#fb923c" stopOpacity={0.15} />
              <Stop offset="1" stopColor="#fb923c" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={1} height={1} fill="url(#forgot-glow)" />
        </Svg>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.body}>
          <TouchableOpacity
            style={styles.back}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Back to sign in"
            hitSlop={8}
            testID="forgot-back">
            <ChevronLeft size={16} color={colors.slate600} strokeWidth={2.5} />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>

          <View style={styles.eyebrow}>
            <KeyRound size={13} color={colors.primary700} strokeWidth={2.3} />
            <Text style={styles.eyebrowText}>ACCOUNT RECOVERY</Text>
          </View>

          <Text style={styles.title}>
            {sent ? (
              <>Check your <Text style={styles.titleAccent}>inbox.</Text></>
            ) : (
              <>Reset your <Text style={styles.titleAccent}>password.</Text></>
            )}
          </Text>
          <Text style={styles.subtitle}>
            {sent
              ? 'We\u2019ve sent a secure reset link if the address matches a CookMitra account.'
              : 'Enter the email linked to your CookMitra account and we\u2019ll send you a secure reset link.'}
          </Text>

          {sent ? (
            <View
              style={styles.sentCard}
              accessible
              accessibilityLabel="Reset link sent">
              <View style={styles.sentIcon}>
                <CheckCircle2 size={20} color="#047857" strokeWidth={2.4} />
              </View>
              <View style={styles.sentCopy}>
                <Text style={styles.sentTitle}>Reset link sent</Text>
                <Text style={styles.sentText}>
                  Open the link in your email and choose a new password. It expires after 1 hour.
                </Text>
              </View>
            </View>
          ) : null}

          <ErrorBanner message={error} />

          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.iconTile}>
                <Mail size={18} color={colors.primary700} strokeWidth={2.1} />
              </View>
              <View style={styles.cardHeadCopy}>
                <Text style={styles.cardTitle}>{sent ? 'Send another link' : 'Email address'}</Text>
                <Text style={styles.cardHint}>We&apos;ll only use this to send your reset link.</Text>
              </View>
            </View>

            <Field
              label="Email address"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setFieldError('');
                setError('');
                if (sent) setSent(false);
              }}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={254}
              leftIcon={<Mail size={18} color={colors.slate400} strokeWidth={2} />}
              error={fieldError}
              testID="forgot-email"
            />
            <Button
              title={loading ? 'Sending\u2026' : sent ? 'Send again' : 'Send reset link'}
              onPress={submit}
              loading={loading}
              icon={<Send size={18} color={colors.white} strokeWidth={2.3} />}
              testID="forgot-submit"
            />

            <View style={styles.secureRow}>
              <ShieldCheck size={14} color={colors.slate400} strokeWidth={2.2} />
              <Text style={styles.secureText}>Private link · valid for 1 hour</Text>
            </View>
          </View>

          <View style={styles.helpCard}>
            <View style={styles.helpHead}>
              <Clock size={15} color={colors.amber} strokeWidth={2.2} />
              <Text style={styles.helpTitle}>Didn&apos;t get the email?</Text>
            </View>
            <Text style={styles.helpText}>
              Check your spam or promotions folder and confirm this is the address linked to your
              account. Delivery can take a minute.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Remembered your password?</Text>
            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => navigation?.navigate?.('Login')}
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
    paddingTop: 18,
    paddingBottom: 24,
  },
  body: { width: '100%', maxWidth: 520, alignSelf: 'center' },

  back: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingVertical: 4,
    marginBottom: 14,
  },
  backText: { fontSize: 13, fontWeight: '700', color: colors.slate600 },

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

  sentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    padding: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 16,
  },
  sentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentCopy: { flex: 1 },
  sentTitle: { fontSize: 14, fontWeight: '800', color: '#065f46' },
  sentText: { marginTop: 2, fontSize: 12.5, lineHeight: 18, color: '#047857' },

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

  helpCard: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#fffaf4',
    borderWidth: 1,
    borderColor: '#f6e3d1',
    borderRadius: 18,
  },
  helpHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  helpTitle: { fontSize: 12.5, fontWeight: '800', color: '#9a3412' },
  helpText: { fontSize: 12, lineHeight: 18, color: colors.slate600 },

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

export default ForgotPasswordScreen;
