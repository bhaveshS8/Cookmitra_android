import { getStateFromPath } from '@react-navigation/native';
import { linking } from '../src/navigation/linking';

const TOKEN = 'b'.repeat(64);

describe('deep-link routes', () => {
  test('maps the reset link to the root-level ResetPassword screen', () => {
    const state = getStateFromPath(`reset-password?token=${TOKEN}`, linking.config);
    expect(state?.routes?.[0]).toMatchObject({
      name: 'ResetPassword',
      params: { token: TOKEN },
    });
  });

  test('maps an authenticated booking link', () => {
    const state = getStateFromPath('bookings/abc123', linking.config);
    expect(state?.routes?.[0]).toMatchObject({
      name: 'BookingDetail',
      params: { bookingId: 'abc123' },
    });
  });

  test('accepts the https reset link the backend emails', () => {
    // The backend emails `${FRONTEND_BASE_URL}/reset-password?token=...`.
    expect(linking.prefixes).toContain('https://cookmitra.org');
    const state = getStateFromPath('reset-password?token=' + TOKEN, linking.config);
    expect(state?.routes?.[0]).toMatchObject({
      name: 'ResetPassword',
      params: { token: TOKEN },
    });
  });
});
