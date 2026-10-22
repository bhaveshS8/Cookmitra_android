// Session storage. Website uses localStorage/sessionStorage keyed by
// `rememberMe`; mobile keeps the JWT in the Android Keystore
// (react-native-keychain) and non-sensitive profile/draft data in
// AsyncStorage. `rememberMe=false` keeps the token session-scoped
// (memory only) just like the website's sessionStorage path.
import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVICE = 'com.cookmitra.session';
const USER_KEY = '@cookmitra:user';
const DRAFT_KEY = '@cookmitra:booking-draft';
const POST_AUTH_KEY = '@cookmitra:post-auth-target';
const PENDING_PAYMENTS_KEY = '@cookmitra:pending-payments';
// If the Keystore reset ever fails, this tombstone makes the next launch
// ignore the stale credential instead of restoring a session the user
// explicitly ended.
const SESSION_REVOKED_KEY = '@cookmitra:session-revoked';

let memoryToken = null;

export const saveSession = async (token, user, { persistent = true } = {}) => {
  if (!token) {
    memoryToken = null;
    try {
      await Keychain.resetGenericPassword({ service: SERVICE });
    } catch {}
    try {
      await AsyncStorage.setItem(SESSION_REVOKED_KEY, '1');
    } catch {}
  } else if (persistent) {
    await Keychain.setGenericPassword('token', token, { service: SERVICE });
    memoryToken = token;
    try {
      await AsyncStorage.removeItem(SESSION_REVOKED_KEY);
    } catch {}
  } else {
    let cleared = true;
    try {
      await Keychain.resetGenericPassword({ service: SERVICE });
    } catch {
      cleared = false;
    }
    memoryToken = token;
    try {
      if (cleared) await AsyncStorage.removeItem(SESSION_REVOKED_KEY);
      else await AsyncStorage.setItem(SESSION_REVOKED_KEY, '1');
    } catch {}
  }
  if (user) await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const loadSession = async () => {
  let token = memoryToken;
  if (!token) {
    let revoked = null;
    try {
      revoked = await AsyncStorage.getItem(SESSION_REVOKED_KEY);
    } catch {}
    if (!revoked) {
      try {
        const creds = await Keychain.getGenericPassword({ service: SERVICE });
        token = creds ? creds.password : null;
      } catch {
        token = null;
      }
    }
  }
  let user = null;
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    user = raw ? JSON.parse(raw) : null;
  } catch {
    user = null;
  }
  return { token, user };
};

export const clearSession = async ({ preserveResume = false } = {}) => {
  memoryToken = null;
  let tombstoneWritten = false;
  try {
    await AsyncStorage.setItem(SESSION_REVOKED_KEY, '1');
    tombstoneWritten = true;
  } catch {}
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
    if (tombstoneWritten) {
      try {
        await AsyncStorage.removeItem(SESSION_REVOKED_KEY);
      } catch {}
    }
  } catch {
    // Leave the tombstone in place: a failed Keystore reset must not let a
    // logged-out token silently return on the next app launch.
  }
  try {
    // On an expired/revoked session we keep the booking draft, pending
    // payment proof, and post-auth target so the customer can sign back in
    // and finish the booking. An explicit logout clears everything.
    await AsyncStorage.multiRemove(
      preserveResume
        ? [USER_KEY]
        : [USER_KEY, DRAFT_KEY, POST_AUTH_KEY, PENDING_PAYMENTS_KEY],
    );
  } catch {}
};

// Password change rotates tokenVersion server-side and returns a fresh JWT.
// Swap the stored token while respecting the original persistence choice:
// only write to the Keystore if a persistent token already lives there.
// Keystore failures are thrown so the caller can end the session instead of
// silently keeping a token the server has already invalidated.
export const replaceSessionToken = async (token) => {
  if (!token) return;
  const existing = await Keychain.getGenericPassword({ service: SERVICE });
  if (existing) {
    await Keychain.setGenericPassword('token', token, { service: SERVICE });
  }
  memoryToken = token;
};

export const saveBookingDraft = async (draft) => {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {}
};

export const loadBookingDraft = async () => {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearBookingDraft = async () => {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {}
};

// Login can happen halfway through a booking. The book tab consumes this
// marker on its next focus so sign-in lands back on the form instead of Home.
export const savePostAuthTarget = async (target) => {
  try {
    await AsyncStorage.setItem(POST_AUTH_KEY, String(target || ''));
  } catch {}
};

export const consumePostAuthTarget = async () => {
  try {
    const value = await AsyncStorage.getItem(POST_AUTH_KEY);
    if (value) await AsyncStorage.removeItem(POST_AUTH_KEY);
    return value || null;
  } catch {
    return null;
  }
};

const readPendingPayments = async () => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_PAYMENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

// Razorpay checkout resolves before the backend verifies the signature. If
// the verification request or the app dies at that moment, the proof is the
// only way to confirm the charge without asking the customer to pay twice.
// Store only gateway ids and the chosen rail — never card/UPI credentials.
export const savePendingPayment = async (bookingId, proof) => {
  if (!bookingId || !proof?.payment) return;
  const all = await readPendingPayments();
  all[String(bookingId)] = { ...proof, savedAt: Date.now() };
  await AsyncStorage.setItem(PENDING_PAYMENTS_KEY, JSON.stringify(all));
};

export const loadPendingPayment = async (bookingId) => {
  if (!bookingId) return null;
  const all = await readPendingPayments();
  return all[String(bookingId)] || null;
};

export const clearPendingPayment = async (bookingId) => {
  if (!bookingId) return;
  try {
    const all = await readPendingPayments();
    delete all[String(bookingId)];
    if (Object.keys(all).length === 0) {
      await AsyncStorage.removeItem(PENDING_PAYMENTS_KEY);
    } else {
      await AsyncStorage.setItem(PENDING_PAYMENTS_KEY, JSON.stringify(all));
    }
  } catch {}
};

