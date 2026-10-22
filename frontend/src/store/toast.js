import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const ToastContext = createContext(() => {});

export const useShowToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
  // Read the context directly rather than using useSafeAreaInsets so the
  // provider also works in isolated renders/tests without a SafeAreaProvider.
  const insets = useContext(SafeAreaInsetsContext);
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const showToast = useCallback((message, kind = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message: String(message), kind });
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: (insets?.bottom || 0) + 16 }]}>
          <View style={[styles.toast, toast.kind === 'error' ? styles.error : toast.kind === 'success' ? styles.success : styles.info]}>
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, maxWidth: '100%' },
  info: { backgroundColor: colors.slate800 },
  success: { backgroundColor: colors.emerald },
  error: { backgroundColor: colors.rose },
  text: { color: colors.white, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
