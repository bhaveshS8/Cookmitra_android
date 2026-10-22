import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, CalendarPlus, ClipboardList, User } from 'lucide-react-native';
import { createTabIcon } from '../components/TabBarIcon';
import { tabBarScreenOptions } from './tabBarOptions';
import HomeScreen from '../features/customer/HomeScreen';
import BookCookScreen from '../features/bookings/BookCookScreen';
import MyBookingsScreen from '../features/bookings/MyBookingsScreen';
import ProfileScreen from '../features/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: createTabIcon(Home),
  Book: createTabIcon(CalendarPlus),
  Bookings: createTabIcon(ClipboardList),
  Profile: createTabIcon(User),
};

const CustomerTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      ...tabBarScreenOptions,
      tabBarIcon: ICONS[route.name] || ICONS.Profile,
    })}>
    <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
    <Tab.Screen name="Book" component={BookCookScreen} options={{ title: 'Book' }} />
    <Tab.Screen name="Bookings" component={MyBookingsScreen} options={{ title: 'Bookings' }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
  </Tab.Navigator>
);

export default CustomerTabs;
