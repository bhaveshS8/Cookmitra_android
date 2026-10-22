import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useDispatch, useSelector } from 'react-redux';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { setAuthResetter } from '../api/client';
import { logout } from '../store/store';
import { linking } from './linking';
import AppHeader from '../components/AppHeader';
import AuthStack from './AuthStack';
import CustomerTabs from './CustomerTabs';
import CookTabs from './CookTabs';
import CookProfileScreen from '../features/cooks/CookProfileScreen';
import BookingDetailScreen from '../features/bookings/BookingDetailScreen';
import BookingWaitScreen from '../features/bookings/BookingWaitScreen';
import BookingPaymentScreen from '../features/payments/BookingPaymentScreen';
import EditProfileScreen from '../features/profile/EditProfileScreen';
import AddressesScreen from '../features/profile/AddressesScreen';
import SecurityScreen from '../features/profile/SecurityScreen';
import ActivityScreen from '../features/profile/ActivityScreen';
import LegalScreen from '../features/profile/LegalScreen';
import CookReviewsScreen from '../features/cook/CookReviewsScreen';
import NotificationsScreen from '../features/notifications/NotificationsScreen';
import AdminNoticeScreen from '../features/admin/AdminNoticeScreen';
import ResetPasswordScreen from '../features/auth/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

const withAppHeader = (Screen) => {
  const ScreenWithAppHeader = (props) => (
    <View style={styles.app}>
      <AppHeader navigation={props.navigation} />
      <View style={styles.navigator}>
        <Screen {...props} />
      </View>
    </View>
  );
  return ScreenWithAppHeader;
};

const AuthAppScreen = withAppHeader(AuthStack);
const CustomerAppScreen = withAppHeader(CustomerTabs);
const CookAppScreen = withAppHeader(CookTabs);
const CookProfileAppScreen = withAppHeader(CookProfileScreen);
const BookingDetailAppScreen = withAppHeader(BookingDetailScreen);
const BookingWaitAppScreen = withAppHeader(BookingWaitScreen);
const BookingPaymentAppScreen = withAppHeader(BookingPaymentScreen);
const EditProfileAppScreen = withAppHeader(EditProfileScreen);
const CookReviewsAppScreen = withAppHeader(CookReviewsScreen);
const AddressesAppScreen = withAppHeader(AddressesScreen);
const SecurityAppScreen = withAppHeader(SecurityScreen);
const ActivityAppScreen = withAppHeader(ActivityScreen);
const LegalAppScreen = withAppHeader(LegalScreen);
const NotificationsAppScreen = withAppHeader(NotificationsScreen);
const ResetPasswordAppScreen = withAppHeader(ResetPasswordScreen);

const RootNavigator = () => {
  const { user, token, restored } = useSelector((s) => s.auth);
  if (!restored) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  const authed = Boolean(token && user);
  const role = user?.role;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!authed ? (
        <Stack.Screen name="Auth" component={AuthAppScreen} />
      ) : (
        <Stack.Group>
          {role === 'admin' ? (
            <Stack.Screen name="Admin" component={AdminNoticeScreen} />
          ) : role === 'cook' ? (
            <Stack.Screen name="Cook" component={CookAppScreen} />
          ) : (
            <Stack.Screen name="Customer" component={CustomerAppScreen} />
          )}
          <Stack.Screen name="CookProfile" component={CookProfileAppScreen} />
          <Stack.Screen name="BookingDetail" component={BookingDetailAppScreen} />
          <Stack.Screen name="BookingWait" component={BookingWaitAppScreen} />
          <Stack.Screen name="BookingPayment" component={BookingPaymentAppScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileAppScreen} />
          <Stack.Screen name="CookReviews" component={CookReviewsAppScreen} />
          <Stack.Screen name="Addresses" component={AddressesAppScreen} />
          <Stack.Screen name="Security" component={SecurityAppScreen} />
          <Stack.Screen name="Activity" component={ActivityAppScreen} />
          <Stack.Screen name="Legal" component={LegalAppScreen} />
          <Stack.Screen name="Notifications" component={NotificationsAppScreen} />
        </Stack.Group>
      )}
      {/* Available in both auth states; a reset link can arrive while signed in. */}
      <Stack.Screen name="ResetPassword" component={ResetPasswordAppScreen} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Clearing storage is not enough: the Redux auth state also has to drop
    // the user or the protected navigator remains mounted after a 401.
    setAuthResetter(() => dispatch(logout()));
    return () => setAuthResetter(null);
  }, [dispatch]);

  return (
    <NavigationContainer linking={linking}>
      <RootNavigator />
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  navigator: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});

export default AppNavigator;
