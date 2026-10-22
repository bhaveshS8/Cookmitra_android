import React, { useCallback, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandHeader } from './BrandHeader';
import { Avatar } from './feedback';
import { getNotifications } from '../api/services';
import { colors } from '../theme/colors';

const AppHeader = ({ navigation: suppliedNavigation }) => {
  const containerNavigation = useNavigation();
  const navigation = suppliedNavigation || containerNavigation;
  const { user, token } = useSelector((state) => state.auth);
  const insets = useSafeAreaInsets();
  const [imageFailed, setImageFailed] = useState(false);
  const [unread, setUnread] = useState(0);
  const avatar = typeof user?.avatar === 'string' ? user.avatar.trim() : '';
  const isLoggedIn = Boolean(token && user);

  useEffect(() => {
    setImageFailed(false);
  }, [avatar]);

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn) {
        setUnread(0);
        return undefined;
      }
      let alive = true;
      const loadUnread = async () => {
        try {
          const data = await getNotifications();
          const rows = Array.isArray(data) ? data : data?.notifications || [];
          if (alive) setUnread(rows.filter((n) => !n.read).length);
        } catch {}
      };
      loadUnread();
      const timer = setInterval(loadUnread, 60000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [isLoggedIn]),
  );

  const openProfile = () => {
    const route = user?.role === 'cook' ? 'Cook' : 'Customer';
    const screen = user?.role === 'cook' ? 'Setup' : 'Profile';
    navigation.navigate(route, { screen });
  };

  const openNotifications = () => {
    navigation.navigate('Notifications');
  };

  const goHome = () => {
    try {
      if (!isLoggedIn) {
        navigation.navigate('Auth', { screen: 'Welcome' });
      } else if (user?.role === 'cook') {
        navigation.navigate('Cook', { screen: 'Jobs' });
      } else {
        navigation.navigate('Customer', { screen: 'Home' });
      }
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <BrandHeader compact onPress={goHome} />
      {isLoggedIn ? (
        <View style={styles.actions}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open notifications"
            onPress={openNotifications}
            style={styles.action}>
            <Bell size={22} color={colors.slate700} />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={openProfile}
            style={styles.avatarButton}>
            {avatar && !imageFailed ? (
              <Image
                accessibilityLabel="Profile image"
                source={{ uri: avatar }}
                style={styles.avatarImage}
                onError={() => setImageFailed(true)}
              />
            ) : (
              <Avatar name={user?.name} size={36} />
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  avatarButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
});

export default AppHeader;
