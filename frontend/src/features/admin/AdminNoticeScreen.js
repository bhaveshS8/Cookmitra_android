import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { logoutUser } from '../../store/store';
import { getApiConfig } from '../../config';
import { shared } from '../../theme/shared';
import { Button } from '../../components/Button';

// The admin console is intentionally desktop-only (bulk tables, CSV exports,
// payout reconciliation). Mobile keeps admins out of the customer/cook tabs so
// they do not hit role-gated APIs by mistake.
const AdminNoticeScreen = () => {
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const adminUrl = `${getApiConfig().webOrigin}/admin`;

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.wrap}>
        <Text style={shared.h1}>Admin console</Text>
        <Text style={shared.body}>
          Signed in as {user?.name || 'admin'}. CookMitra admin tools — complaints, payouts,
          coupons, cook approvals and analytics — are available on the desktop website.
        </Text>
        <View style={shared.card}>
          <Text style={shared.h2}>Use the web console</Text>
          <Text style={shared.small}>
            The mobile app supports customers and cooks. Admin actions that move money or
            approve identities need the wider website layout.
          </Text>
          <Button title="Open admin website" onPress={() => Linking.openURL(adminUrl).catch(() => {})} />
        </View>
        <Button title="Sign out" variant="outline" onPress={() => dispatch(logoutUser())} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 14, justifyContent: 'center' },
});

export default AdminNoticeScreen;
