import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  CalendarCheck,
  ChevronRight,
  ChefHat,
  ShieldCheck,
  Star,
  Wallet,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { Button } from '../../components/Button';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'ID-verified cooks',
    text: 'Background-checked profiles',
  },
  {
    icon: CalendarCheck,
    title: 'Live booking updates',
    text: 'Real-time session tracking',
  },
  {
    icon: Wallet,
    title: 'Secure payments',
    text: 'Protected UPI & card checkout',
  },
];

const WelcomeScreen = ({ navigation }) => (
  <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
    {/* Soft brand glow — adds depth without competing with the content. */}
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 1 1">
        <Defs>
          <RadialGradient id="welcome-glow" cx="0.9" cy="0.02" r="0.85">
            <Stop offset="0" stopColor="#fb923c" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#fb923c" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={1} height={1} fill="url(#welcome-glow)" />
      </Svg>
    </View>

    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.body}>
        <View style={styles.trustPill}>
          <Star size={12} fill="#f59e0b" color="#f59e0b" />
          <Text style={styles.trustText}>4.8 · Trusted by 12,000+ households</Text>
        </View>

        <Text style={styles.title}>
          Festive cooking,{'\n'}
          <Text style={styles.titleAccent}>minus the stress.</Text>
        </Text>

        <Text style={styles.subtitle}>
          Book verified home cooks for celebrations and everyday meals — they cook
          fresh in your kitchen while you enjoy the occasion.
        </Text>

        <View style={styles.features}>
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <View key={f.title} style={[styles.feature, i > 0 && styles.featureBorder]}>
                <View style={styles.featureIcon}>
                  <Icon size={18} color={colors.primary} strokeWidth={2.1} />
                </View>
                <View style={styles.featureBody}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.actions}>
          <Button
            title="Create an account"
            onPress={() => navigation.navigate('Register')}
            testID="welcome-register"
          />
          <View style={styles.signInRow}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
              testID="welcome-login">
              <Text style={styles.signInLink}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cookLink}
          onPress={() => navigation.navigate('Register', { role: 'cook' })}
          accessibilityRole="button">
          <ChefHat size={14} color={colors.primary700} />
          <Text style={styles.cookText}>
            Are you a home cook? <Text style={styles.cookTextStrong}>Join as a cook</Text>
          </Text>
          <ChevronRight size={14} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.footerNote}>Your Cook. Your Occasion. Your Kitchen.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  body: { width: '100%', maxWidth: 520, alignSelf: 'center' },

  trustPill: {
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
  trustText: { fontSize: 11.5, fontWeight: '600', color: colors.slate600 },

  title: {
    marginTop: 18,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.slate900,
  },
  titleAccent: { color: colors.primary },
  subtitle: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.slate600,
  },

  features: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#f2e6da',
    borderRadius: 20,
    shadowColor: '#7c2d12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 1,
  },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  featureBorder: { borderTopWidth: 1, borderTopColor: '#f4ebe3' },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBody: { flex: 1 },
  featureTitle: { fontSize: 14.5, fontWeight: '800', color: colors.slate900 },
  featureText: { marginTop: 2, fontSize: 12.5, lineHeight: 17, color: colors.slate500 },

  actions: { marginTop: 22 },
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signInText: { fontSize: 13.5, color: colors.slate600 },
  signInLink: { fontSize: 13.5, fontWeight: '800', color: colors.primary },

  footer: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginTop: 'auto',
    paddingTop: 30,
    alignItems: 'center',
  },
  cookLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  cookText: { fontSize: 12.5, color: colors.slate600 },
  cookTextStrong: { fontWeight: '800', color: colors.primary700 },
  footerNote: {
    marginTop: 8,
    fontSize: 11,
    color: colors.slate500,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});

export default WelcomeScreen;
