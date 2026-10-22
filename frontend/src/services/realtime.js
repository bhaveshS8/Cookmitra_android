import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Vibration } from 'react-native';
import { useShowToast } from '../store/toast';
import { loadSession } from './session';
import { getApiConfig } from '../config';
import { parseSseEvents, SSE_MAX_BUFFER } from '../utils/sse';

// Mirrors website hooks/useRealtime.js (EventSource on /realtime/stream with
// booking_request/assigned/replacement_needed/expired events).
//
// `eventsource` v5 is fetch-stream based and React Native's whatwg-fetch
// polyfill does not expose a readable response body, so it never delivered
// events on device. This small client uses RN's XHR, which does support
// incremental responses, sends the JWT in the Authorization header (not the
// URL), and reconnects with backoff. Screens keep polling, so a dropped
// stream never blocks the booking flow.
let started = false;

const EVENT_KINDS = new Set([
  'booking_request',
  'booking_assigned',
  'booking_replacement_needed',
  'booking_ignored',
  'booking_expired',
]);

const RETRY_MS = 4000;

export const startRealtime = async (onEvent) => {
  if (started) return () => {};
  started = true;
  const { token } = await loadSession().catch(() => ({ token: null }));
  if (!token) {
    started = false;
    return () => {};
  }

  let stopped = false;
  let xhr = null;
  let retryTimer = null;
  let pending = '';
  let consumed = 0;

  const resetBuffer = () => {
    pending = '';
    consumed = 0;
  };

  const emit = (frame) => {
    if (!EVENT_KINDS.has(frame.event)) return;
    let payload = null;
    if (frame.data) {
      try {
        payload = JSON.parse(frame.data);
      } catch {
        payload = null;
      }
    }
    try {
      Vibration.vibrate(80);
    } catch {}
    onEvent?.(frame.event, payload);
  };

  const consume = () => {
    if (!xhr) return;
    const text = xhr.responseText || '';
    if (text.length < consumed) resetBuffer();
    if (text.length > consumed) {
      pending += text.slice(consumed);
      consumed = text.length;
    }
    if (pending.length > SSE_MAX_BUFFER) resetBuffer();
    const parsed = parseSseEvents(pending);
    pending = parsed.rest;
    parsed.events.forEach(emit);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    started = false;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    try {
      xhr?.abort();
    } catch {}
    xhr = null;
  };

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!stopped) connect();
    }, RETRY_MS);
  };

  const connect = () => {
    if (stopped) return;
    resetBuffer();
    try {
      xhr = new XMLHttpRequest();
    } catch {
      stop();
      return;
    }
    try {
      xhr.open('GET', `${getApiConfig().baseUrl}/realtime/stream`, true);
      xhr.setRequestHeader('Accept', 'text/event-stream');
      xhr.setRequestHeader('Cache-Control', 'no-cache');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.timeout = 0;
    } catch {
      stop();
      return;
    }
    xhr.onreadystatechange = () => {
      if (stopped) return;
      if (xhr?.readyState === 2 || xhr?.readyState === 3) consume();
      if (xhr?.readyState === 4) {
        consume();
        // A revoked/expired token cannot be fixed by retrying; user-facing
        // screens will pick up the 401 through their normal API calls.
        if (xhr.status === 401 || xhr.status === 403) {
          stop();
          return;
        }
        scheduleReconnect();
      }
    };
    xhr.onerror = scheduleReconnect;
    try {
      xhr.send();
    } catch {
      scheduleReconnect();
    }
  };

  connect();
  return stop;
};

export const useRealtime = () => {
  const user = useSelector((s) => s.auth.user);
  const token = useSelector((s) => s.auth.token);
  const showToast = useShowToast();
  useEffect(() => {
    if (!user || !token) return undefined;
    let active = true;
    let stop = null;
    startRealtime((kind) => {
      if (kind === 'booking_request') showToast('New booking request — open My Jobs.', 'info');
      if (kind === 'booking_replacement_needed') showToast('A replacement cook is needed.', 'info');
      if (kind === 'booking_expired') showToast('A booking request expired.', 'info');
    })
      .then((s) => {
        // The screen can unmount while the session token is still loading.
        if (active) stop = s;
        else s();
      })
      .catch(() => {});
    return () => {
      active = false;
      if (stop) stop();
    };
  }, [user, token, showToast]);
};
