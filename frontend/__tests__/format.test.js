import {
  formatCurrency, slabPriceForDuration, formatTime12, normalizeIndianMobile,
  getBookingDisplayState, canRescheduleBooking, isCancelLocked, isReviewable,
  withoutUnpaidCancelled, dayTagLabel,
} from '../src/utils/format';
import {
  mondayOfWeekIST, weekKeyIST, formatWeekLabel,
} from '../src/utils/weeklyPayout';

describe('format utils (ported from website)', () => {
  test('currency and slabs', () => {
    expect(formatCurrency(349)).toMatch(/349/);
    expect(slabPriceForDuration(2)).toBe(349);
    expect(slabPriceForDuration(9)).toBe(null);
  });
  test('12h clock', () => {
    expect(formatTime12('15:30')).toBe('3:30 PM');
    expect(formatTime12('10:00')).toBe('10:00 AM');
  });
  test('mobile normalization', () => {
    expect(normalizeIndianMobile('+91-9876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('12345')).toBe(null);
  });
  test('booking display states', () => {
    expect(getBookingDisplayState({ status: 'completed' })).toBe('COMPLETED');
    expect(getBookingDisplayState({ status: 'cancelled' })).toBe('CANCELLED');
    expect(
      getBookingDisplayState({ status: 'confirmed', date: '2099-01-01', startTime: '10:00', endTime: '12:00' }),
    ).toBe('UPCOMING');
  });
  test('reschedule rules mirror website', () => {
    const b = { status: 'confirmed', rescheduleCount: 2 };
    expect(canRescheduleBooking(b, { role: 'customer' })).toBe(false);
    expect(canRescheduleBooking({ status: 'requested', rescheduleCount: 0 }, { role: 'admin' }, Date.now())).toBe(true);
  });
  test('cancel lock near start', () => {
    const soon = new Date(Date.now() + 10 * 60 * 1000);
    const iso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const hh = `${String(soon.getHours()).padStart(2, '0')}:${String(soon.getMinutes()).padStart(2, '0')}`;
    expect(isCancelLocked({ date: iso, startTime: hh })).toBe(true);
  });
  test('reviewable + unpaid-cancelled filter', () => {
    expect(isReviewable({ status: 'completed' })).toBe(true);
    expect(isReviewable({ status: 'requested' })).toBe(false);
    const rows = [
      { _id: '1', status: 'cancelled', payment: { status: 'pending' } },
      { _id: '2', status: 'confirmed' },
    ];
    expect(withoutUnpaidCancelled(rows).map((r) => r._id)).toEqual(['2']);
  });
  test('day tags', () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    expect(dayTagLabel({ date: today }, today)).toBe('Today');
  });
});

describe('IST week utils (ported from website)', () => {
  test('monday maps to itself at 00:00 IST', () => {
    expect(mondayOfWeekIST('2026-10-05')?.toISOString()).toBe('2026-10-04T18:30:00.000Z');
  });
  test('sunday night stays in the same week', () => {
    expect(mondayOfWeekIST(new Date('2026-10-11T18:00:00Z'))?.toISOString()).toBe(
      '2026-10-04T18:30:00.000Z',
    );
  });
  test('week key and label', () => {
    expect(weekKeyIST('2026-10-07')).toBe('2026-10-05');
    expect(formatWeekLabel(mondayOfWeekIST('2026-10-07'))).toMatch(/5 Oct.*11 Oct/);
  });
});
