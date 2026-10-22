import { bookingWaitDestination } from '../src/utils/bookingActions';

describe('bookingWaitDestination', () => {
  test('sends paid bookings to details even when the status is still accepted', () => {
    expect(
      bookingWaitDestination({ status: 'accepted', amount: 349, payment: { status: 'paid' } }),
    ).toEqual({ screen: 'BookingDetail', delayMs: 0 });
  });

  test('sends confirmed bookings to details, never back to checkout', () => {
    expect(
      bookingWaitDestination({ status: 'confirmed', amount: 349, payment: { status: 'paid' } }),
    ).toEqual({ screen: 'BookingDetail', delayMs: 0 });
  });

  test('sends accepted unpaid bookings to checkout', () => {
    expect(
      bookingWaitDestination({ status: 'accepted', amount: 349, payment: { status: 'pending' } }),
    ).toEqual({ screen: 'BookingPayment', delayMs: 1200 });
  });

  test('a zero-payable accepted booking goes to details', () => {
    expect(
      bookingWaitDestination({ status: 'accepted', amount: 0, payment: { status: 'pending' } }),
    ).toEqual({ screen: 'BookingDetail', delayMs: 1200 });
  });

  test('keeps waiting while a booking is still requested', () => {
    expect(bookingWaitDestination({ status: 'requested', payment: { status: 'pending' } })).toBeNull();
  });
});
