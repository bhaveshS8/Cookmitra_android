import { StyleSheet } from 'react-native';
import { colors } from './colors';

// Shared StyleSheet fragments mirroring the website card/button language
// (rounded cards, soft borders, brand CTA). Per-screen styles extend these.
export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  h1: { fontSize: 24, fontWeight: '800', color: colors.slate900 },
  h2: { fontSize: 18, fontWeight: '800', color: colors.slate900 },
  h3: { fontSize: 15, fontWeight: '700', color: colors.slate900 },
  body: { fontSize: 14, color: colors.slate700, lineHeight: 21 },
  small: { fontSize: 13, color: colors.slate500 },
  row: { flexDirection: 'row', alignItems: 'center' },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex1: { flex: 1 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mt16: { marginTop: 16 },
});

export const fontSize = { small: 13, body: 15, title: 18, hero: 24 };
