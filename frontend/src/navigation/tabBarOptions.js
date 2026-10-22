import { colors } from '../theme/colors';

export const tabBarScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary700,
  tabBarInactiveTintColor: colors.slate500,
  tabBarHideOnKeyboard: true,
  tabBarItemStyle: {
    flex: 1,
    flexBasis: 0,
    paddingHorizontal: 2,
  },
  tabBarLabelStyle: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    marginBottom: 1,
  },
  tabBarIconStyle: {
    marginTop: 0,
  },
  tabBarStyle: {
    minHeight: 68,
    paddingTop: 7,
    backgroundColor: colors.white,
    borderTopColor: colors.slate100,
    borderTopWidth: 1,
    elevation: 12,
    shadowColor: colors.slate900,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
};
