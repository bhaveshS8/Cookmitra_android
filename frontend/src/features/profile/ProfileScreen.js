import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronRight } from 'lucide-react-native';
import { logoutUser } from '../../store/store';
import { getMyStats } from '../../api/services';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Loader, ErrorBanner, Avatar } from '../../components/feedback';

const ProfileScreen = ({ navigation }) => {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setStats(await getMyStats());
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rows = [
    { label: 'Personal details', hint: user?.email || '', target: 'EditProfile' },
    { label: 'Saved addresses', hint: 'Home, work & more', target: 'Addresses' },
    { label: 'My activity', hint: 'Bookings & reviews', target: 'Activity' },
    { label: 'Security & password', hint: 'Change password', target: 'Security' },
    { label: 'Terms, privacy & refunds', hint: 'Policies', target: 'Legal' },
    { label: 'Contact support', hint: 'Email, phone & WhatsApp', target: 'Legal', params: { doc: 'contact' } },
  ];

  const logout = () => {
    Alert.alert('Sign out?', 'You will need to sign in again on this device.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => dispatch(logoutUser()) },
    ]);
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <View style={[shared.card, styles.head]}>
          <Avatar name={user?.name} size={60} />
          <Text style={shared.h1}>{user?.name}</Text>
          <Text style={shared.small}>{user?.email} · {user?.phone}</Text>
          {stats ? (
            <View style={styles.stats}>
              {[
                ['Upcoming', stats.upcomingBookings],
                ['Completed', stats.completedBookings],
                ['Total', stats.totalBookings],
                ['Reviews', stats.reviewsGiven],
              ].map(([label, value]) => (
                <View key={label} style={styles.stat}>
                  <Text style={styles.statValue}>{value ?? 0}</Text>
                  <Text style={shared.small}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? <Loader /> : null}
        {rows.map((r) => (
          <TouchableOpacity
            key={r.label}
            style={[shared.card, styles.row]}
            onPress={() => navigation.navigate(r.target, r.params)}>
            <View style={shared.flex1}>
              <Text style={shared.h3}>{r.label}</Text>
              <Text style={shared.small}>{r.hint}</Text>
            </View>
            <ChevronRight size={18} color={colors.slate400} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[shared.card, styles.row]} onPress={logout}>
          <Text style={[shared.h3, { color: colors.rose }]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, width: '100%' },
  stat: { flexGrow: 1, flexBasis: '22%', alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.primary700 },
});

export default ProfileScreen;
