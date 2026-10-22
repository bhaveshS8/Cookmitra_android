import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { shared } from '../../theme/shared';
import { colors } from '../../theme/colors';

// Abridged policy viewer. Full policy text lives on the website
// (frontend/src/pages/Legal.jsx); the statements below preserve its
// meaning: what is collected, retention for bookings/tax/disputes,
// verification-document handling, and deletion subject to retention.
const DOCS = {
  terms: {
    title: 'Terms of Service',
    body: 'CookMitra connects households with verified home cooks for festive cooking services. Bookings are confirmed once a cook accepts and payment is received. Pricing follows the published hourly slabs with a 15% platform commission included in the displayed total. Cancellations follow the published cancellation window: free cancellation outside the lock window, charges as previewed inside it. Refunds are processed to the original payment method within 5–7 business days of approval.',
  },
  privacy: {
    title: 'Privacy Policy',
    body: 'We collect your name, contact details, addresses, booking history, and cook verification documents to operate the service. Booking records are retained for account management, tax, and dispute resolution, then deleted or anonymized in line with our retention policy. Verification documents are stored securely with restricted access. You may request access, correction, or deletion of your data, subject to legal retention requirements for active or recently closed bookings.',
  },
  refunds: {
    title: 'Refund Policy',
    body: 'Refunds depend on timing and service state: unpaid cancelled bookings carry no charge; paid bookings cancelled in time are refunded per the cancellation preview shown before you confirm. Approved refunds reach the original payment method in 5–7 business days. If a cook payout was already settled, refunds require an explicit clawback decision and our team contacts the cook about recovery.',
  },
  cancellation: {
    title: 'Cancellation & Refund Rules',
    body: 'Cancellation is free until 30 minutes before the service start time. Inside the lock window, cancellation may carry charges exactly as previewed on the booking. Cook-initiated cancellations trigger an automatic search for a replacement cook at no extra charge when you accept the replacement. Customer no-shows are not refundable.',
  },
  contact: {
    title: 'Contact Us',
    body: 'For help with bookings, payments, refunds, or your account, contact CookMitra support. We reply within one business day. For booking or payment issues, include your registered phone number, booking ID, and (for payments) the Razorpay payment ID from your receipt.',
  },
};

const ORDER = ['terms', 'privacy', 'refunds', 'cancellation', 'contact'];

const LegalScreen = ({ navigation, route }) => {
  const [active, setActive] = useState(route?.params?.doc || 'terms');

  useEffect(() => {
    if (route?.params?.doc) setActive(route.params.doc);
  }, [route?.params?.doc]);

  const doc = DOCS[active] || DOCS.terms;

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={shared.scrollContent}>
        {navigation?.canGoBack?.() ? (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <ChevronLeft size={18} color={colors.primary} strokeWidth={2.4} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {ORDER.map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => setActive(key)}
              style={[styles.tab, active === key && styles.tabOn]}>
              <Text style={[styles.tabText, active === key && styles.tabTextOn]}>
                {DOCS[key].title.replace(' & Refund Rules', '')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={shared.h1}>{doc.title}</Text>
        <Text style={[shared.body, shared.mt8]}>{doc.body}</Text>

        {active === 'contact' ? (
          <View style={styles.contact}>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:contactuscookmitra@gmail.com').catch(() => {})}>
              <Text style={styles.link}>Email: contactuscookmitra@gmail.com</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('tel:+919322321831').catch(() => {})}>
              <Text style={styles.link}>Call: +91 93223 21831</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://wa.me/919322321831').catch(() => {})}>
              <Text style={styles.link}>WhatsApp support</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://instagram.com/cookmitra_india').catch(() => {})}>
              <Text style={styles.link}>Instagram: @cookmitra_india</Text>
            </TouchableOpacity>
            <Text style={shared.small}>Area: Pune & Mumbai, India · Hours: 10:00 AM – 6:00 PM IST, all days</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 10 },
  backText: { fontSize: 14, fontWeight: '700', color: colors.primary },
  tabs: { gap: 8, paddingBottom: 14 },
  tab: { borderWidth: 1, borderColor: colors.slate200, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.white },
  tabOn: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  tabText: { fontSize: 12, fontWeight: '700', color: colors.slate600 },
  tabTextOn: { color: colors.primary800 },
  contact: { gap: 4, marginTop: 14, backgroundColor: colors.primaryLight, borderRadius: 16, padding: 14 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary, paddingVertical: 4 },
});

export default LegalScreen;
export const LEGAL_DOCS = Object.keys(DOCS);
