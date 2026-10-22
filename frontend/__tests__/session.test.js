import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  saveSession,
  loadSession,
  clearSession,
  replaceSessionToken,
  saveBookingDraft,
  loadBookingDraft,
  savePostAuthTarget,
  consumePostAuthTarget,
  savePendingPayment,
  loadPendingPayment,
  clearPendingPayment,
} from '../src/services/session';

describe('session storage', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    Keychain.getGenericPassword.mockResolvedValue(false);
  });

  test('rotating a non-persistent session keeps the token in memory', async () => {
    await saveSession('old-token', { name: 'Asha' }, { persistent: false });
    expect(Keychain.setGenericPassword).not.toHaveBeenCalled();

    await replaceSessionToken('new-token');

    const session = await loadSession();
    expect(session.token).toBe('new-token');
    expect(session.user).toEqual({ name: 'Asha' });
  });

  test('rotating a persistent session writes the new token to the Keystore', async () => {
    Keychain.getGenericPassword.mockResolvedValue({ username: 'token', password: 'old-token' });

    await replaceSessionToken('new-token');

    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'token',
      'new-token',
      expect.objectContaining({ service: 'com.cookmitra.session' }),
    );
  });

  test('expired-session cleanup preserves the booking draft, logout clears it', async () => {
    await saveBookingDraft({ kind: 'on-demand', address: 'Kothrud' });
    await savePostAuthTarget('Book');
    await saveSession('token', { name: 'Asha' });

    await clearSession({ preserveResume: true });

    expect((await loadSession()).user).toBeNull();
    expect((await loadBookingDraft())?.address).toBe('Kothrud');
    expect(await consumePostAuthTarget()).toBe('Book');

    await clearSession();
    expect(await loadBookingDraft()).toBeNull();
  });

  test('a failed Keystore reset cannot resurrect the old token on next launch', async () => {
    await saveSession('old-token', { name: 'Asha' });
    Keychain.getGenericPassword.mockResolvedValue({ username: 'token', password: 'old-token' });
    Keychain.resetGenericPassword.mockRejectedValueOnce(new Error('keystore unavailable'));

    await clearSession();

    expect(await loadSession()).toMatchObject({ token: null, user: null });
  });

  test('pending payment proof survives an expired session but not logout', async () => {
    await savePendingPayment('booking1', {
      method: 'upi',
      payment: {
        razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'sig_1',
      },
    });
    expect((await loadPendingPayment('booking1'))?.payment?.razorpayPaymentId).toBe('pay_1');

    await clearSession({ preserveResume: true });
    expect((await loadPendingPayment('booking1'))?.payment?.razorpayPaymentId).toBe('pay_1');

    await clearSession();
    expect(await loadPendingPayment('booking1')).toBeNull();
    await clearPendingPayment('booking1');
  });
});
