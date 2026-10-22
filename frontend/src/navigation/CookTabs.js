import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ClipboardList, Wallet, Star, Settings } from 'lucide-react-native';
import { createTabIcon } from '../components/TabBarIcon';
import { tabBarScreenOptions } from './tabBarOptions';
import CookDashboardScreen from '../features/cook/CookDashboardScreen';
import CookEarningsScreen from '../features/payouts/CookEarningsScreen';
import CookReviewsScreen from '../features/cook/CookReviewsScreen';
import CookSetupScreen from '../features/cook/CookSetupScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Jobs: createTabIcon(ClipboardList),
  Earnings: createTabIcon(Wallet),
  Reviews: createTabIcon(Star),
  Setup: createTabIcon(Settings),
};

const CookTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      ...tabBarScreenOptions,
      tabBarIcon: ICONS[route.name] || ICONS.Jobs,
    })}>
    <Tab.Screen name="Jobs" component={CookDashboardScreen} options={{ title: 'My Jobs' }} />
    <Tab.Screen name="Earnings" component={CookEarningsScreen} options={{ title: 'Earnings' }} />
    <Tab.Screen name="Reviews" component={CookReviewsScreen} options={{ title: 'Reviews' }} />
    <Tab.Screen name="Setup" component={CookSetupScreen} options={{ title: 'Profile' }} />
  </Tab.Navigator>
);

export default CookTabs;
