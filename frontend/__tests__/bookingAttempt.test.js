import { bookingAttemptSignature, nextBookingClientKey } from '../src/utils/bookingAttempt';

const DETAILS = {
  serviceType: 'cook_for_me',
  date: '2026-11-01',
  hours: 2,
  slot: { startTime: '10:00', endTime: '12:00' },
  guests: '4',
  address: '12 Main Road',
  flatNo: 'A-1',
  society: 'Sunrise',
  landmark: 'Near park',
  city: 'Pune',
  coupon: '',
};

describe('booking attempt idempotency key', () => {
  test('reuses the persisted key after a restart for the same attempt', () => {
    const signature = bookingAttemptSignature(DETAILS);
    expect(
      nextBookingClientKey({
        userId: 'user1',
        signature,
        currentKey: 'bk_user1_saved',
        currentSignature: signature,
      }),
    ).toBe('bk_user1_saved');
  });

  test('creates a new key when a booking-defining field changes', () => {
    const signature = bookingAttemptSignature(DETAILS);
    const changed = bookingAttemptSignature({ ...DETAILS, city: 'Mumbai' });
    const key = nextBookingClientKey({
      userId: 'user1',
      signature: changed,
      currentKey: 'bk_user1_saved',
      currentSignature: signature,
      now: 123,
      random: () => 0.5,
    });
    expect(key).not.toBe('bk_user1_saved');
    expect(key).toMatch(/^bk_user1_123_/);
  });
});
