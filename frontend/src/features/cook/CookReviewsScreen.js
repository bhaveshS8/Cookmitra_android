import React, { useCallback, useState } from 'react';
import { Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getCookOwnReviews, getCookReviews } from '../../api/services';
import { formatDate } from '../../utils/format';
import { shared } from '../../theme/shared';
import { colors } from '../../theme/colors';
import { Loader, ErrorBanner, EmptyState, Stars } from '../../components/feedback';
import { View } from 'react-native';

const CookReviewsScreen = ({ route }) => {
  const cookId = route?.params?.cookId;
  // This screen is used both as a cook tab and as a stack screen from profiles.
  // The tab bar already handles the bottom inset, so only add it in stack mode.
  const isTabScreen = route?.name === 'Reviews';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = cookId ? await getCookReviews(cookId) : await getCookOwnReviews();
      setRows(Array.isArray(data) ? data : data?.reviews || []);
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load reviews.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cookId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView
      style={shared.screen}
      edges={isTabScreen ? ['left', 'right'] : ['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={shared.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <Text style={shared.h1}>Reviews</Text>
        <ErrorBanner message={error} onRetry={load} />
        {loading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <EmptyState title="No reviews yet" message="Reviews from completed bookings will appear here." />
        ) : (
          rows.map((r) => (
            <View key={r._id} style={shared.card}>
              <Stars value={r.rating} />
              <Text style={shared.body}>{r.comment || r.text || 'No comment.'}</Text>
              <Text style={shared.small}>
                {r.customer?.name || 'Customer'}
                {r.createdAt ? ` · ${formatDate(r.createdAt)}` : ''}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default CookReviewsScreen;
