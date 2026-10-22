import React, { useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

// Field components consume this to keep the focused input visible even when
// the keyboard is already open and the user switches to another field.
export const KeyboardAwareScrollContext = React.createContext(null);

const SCROLL_PADDING = 28;
const VIEWPORT_MARGIN = 8;

export const KeyboardAwareScrollView = ({
  children,
  style,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  extraScrollHeight = SCROLL_PADDING,
  onScroll,
  ...rest
}) => {
  const scrollRef = useRef(null);
  const scrollTimer = useRef(null);
  const scrollOffset = useRef(0);
  const keyboardMetrics = useRef(null);

  const scrollToFocusedInput = useCallback(() => {
    const scrollView = scrollRef.current;
    const focusedInput = TextInput.State?.currentlyFocusedInput?.();
    const metrics = keyboardMetrics.current || Keyboard.metrics();
    if (
      !scrollView ||
      !focusedInput ||
      !metrics?.screenY ||
      typeof focusedInput.measureInWindow !== 'function' ||
      typeof scrollView.measureInWindow !== 'function' ||
      typeof scrollView.scrollTo !== 'function'
    ) {
      return;
    }

    focusedInput.measureInWindow((_x, y, _width, height) => {
      scrollView.measureInWindow((_sx, sy, _sw, sh) => {
        const viewportTop = sy + VIEWPORT_MARGIN;
        const viewportBottom = Math.min(sy + sh, metrics.screenY) - extraScrollHeight;
        let delta = 0;

        if (y + height > viewportBottom) {
          delta = y + height - viewportBottom;
        } else if (y < viewportTop) {
          delta = y - viewportTop;
        }
        if (!delta) return;

        const nextOffset = Math.max(0, scrollOffset.current + delta);
        scrollOffset.current = nextOffset;
        scrollView.scrollTo({ y: nextOffset, animated: true });
      });
    });
  }, [extraScrollHeight]);

  const scheduleScroll = useCallback(
    (delay = 60) => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
      scrollTimer.current = setTimeout(() => {
        scrollTimer.current = null;
        scrollToFocusedInput();
      }, delay);
    },
    [scrollToFocusedInput],
  );

  const handleFieldFocus = useCallback(() => {
    // When the keyboard is opening, keyboardWillShow/DidShow handles the
    // scroll. Focus-only scrolling is for switching fields while it is open.
    if (Keyboard.isVisible()) scheduleScroll(60);
  }, [scheduleScroll]);

  const handleScroll = useCallback(
    (event) => {
      scrollOffset.current = event?.nativeEvent?.contentOffset?.y || 0;
      onScroll?.(event);
    },
    [onScroll],
  );

  useEffect(() => {
    const showEvents =
      Platform.OS === 'ios' ? ['keyboardWillShow', 'keyboardDidShow'] : ['keyboardDidShow'];
    const subscriptions = showEvents.map((eventName) =>
      Keyboard.addListener(eventName, (event) => {
        keyboardMetrics.current = event?.endCoordinates || null;
        scheduleScroll(eventName === 'keyboardWillShow' ? 0 : 40);
      }),
    );
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      keyboardMetrics.current = null;
      if (scrollTimer.current) {
        clearTimeout(scrollTimer.current);
        scrollTimer.current = null;
      }
    });

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      hideSubscription.remove();
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    };
  }, [scheduleScroll]);

  return (
    <KeyboardAwareScrollContext.Provider value={handleFieldFocus}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
        style={[styles.flex, style]}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={contentContainerStyle}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          {...rest}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </KeyboardAwareScrollContext.Provider>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
