import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider, useDispatch } from 'react-redux';
import { store, restoreSession } from './src/store/store';
import { setTokenGetter } from './src/api/client';
import { loadSession } from './src/services/session';
import { ToastProvider } from './src/store/toast';
import AppNavigator from './src/navigation/Root';
import { useRealtime } from './src/services/realtime';
import { colors } from './src/theme/colors';

setTokenGetter(async () => (await loadSession().catch(() => ({})))?.token || null);

const Bootstrap = () => {
  const dispatch = useDispatch();
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    dispatch(restoreSession());
  }, [dispatch]);
  useRealtime();
  return <AppNavigator />;
};

const App = () => (
  <Provider store={store}>
    <SafeAreaProvider>
      <ToastProvider>
        <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
        <Bootstrap />
      </ToastProvider>
    </SafeAreaProvider>
  </Provider>
);

export default App;
