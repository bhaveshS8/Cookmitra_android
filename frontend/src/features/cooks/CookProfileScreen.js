import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { getCook } from '../../api/services';
import { formatCurrency } from '../../utils/format';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';
import { Loader, ErrorBanner, EmptyState, Stars, Avatar } from '../../components/feedback';

const CookProfileScreen = ({ navigation, route }) => {
  const cookId = route?.params?.cookId;
  const currentUser = useSelector((s) => s.auth.user);
  const [cook, setCook] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setCook(await getCook(cookId));
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load the cook profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cookId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const profile = cook?.profile || cook;
  const user = cook?.user || cook;

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : !cook ? (
          <EmptyState title="Cook not found" message="This profile may have been removed." />
        ) : (
          <>
            <View style={[shared.card, styles.head]}>
              <Avatar name={user?.name} size={64} />
              <Text style={shared.h1}>{user?.name || 'Cook'}</Text>
              {profile?.rating?.average ? (
                <View style={styles.ratingRow}>
                  <Stars value={profile.rating.average} />
                  <Text style={shared.small}>
                    {Number(profile.rating.average).toFixed(1)} ({profile.rating.count || 0} reviews)
                  </Text>
                </View>
              ) : null}
              <Text style={shared.body}>
                {[profile?.serviceArea, profile?.experienceYears ? `${profile.experienceYears} yrs experience` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Home cook'}
              </Text>
              {profile?.bio ? <Text style={shared.small}>{profile.bio}</Text> : null}
            </View>
            <View style={shared.card}>
              <Text style={shared.h2}>Services & pricing</Text>
              <Text style={shared.body}>1 hr · {formatCurrency(199)}</Text>
              <Text style={shared.body}>2 hrs · {formatCurrency(349)}</Text>
              <Text style={shared.body}>3 hrs · {formatCurrency(499)}</Text>
              <Text style={shared.body}>4 hrs · {formatCurrency(649)}</Text>
            </View>
            {currentUser?.role === 'customer' ? (
              <Button
                title="Book this cook"
                onPress={() => navigation.navigate('Customer', { screen: 'Book', params: { cookId: user?._id || cookId } })}
              />
            ) : null}
            <TouchableOpacity onPress={() => navigation.navigate('CookReviews', { cookId: user?._id || cookId })}>
              <Text style={styles.link}>Read reviews</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { fontSize: 14, fontWeight: '700', color: colors.primary, textAlign: 'center', marginTop: 12 },
});

export default CookProfileScreen;
