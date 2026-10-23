import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store, logout, loginUser } from '../src/store/store';
import { ToastProvider } from '../src/store/toast';
import { createBooking, validateCoupon } from '../src/api/bookings';
import { clearBookingDraft } from '../src/services/session';
import BookCookScreen from '../src/features/bookings/BookCookScreen';

jest.mock('../src/api/bookings', () => ({
  createBooking: jest.fn(),
  submitWomanDecline: jest.fn(),
  validateCoupon: jest.fn(),
  getWomanVerificationStatus: jest.fn().mockResolvedValue({ blocked: false }),
}));

jest.mock('../src/hooks/useDeviceLocation', () => ({
  useDeviceLocation: () => ({
    coords: null,
    setCoords: jest.fn(),
    loading: false,
    status: 'idle',
    detect: jest.fn(),
  }),
}));

// Keep the flow test independent of the wall clock: fixed slots render the
// same way before 8 AM, after 8 PM, and on every date.
jest.mock('../src/utils/timeSlots', () => ({
  buildStartOptions: () => ['09:00', '10:00'],
  deriveEndTime: (start, hours) => {
    const [h, m] = start.split(':').map(Number);
    return `${String(h + hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  },
  groupStartOptions: () => [
    { key: 'morning', label: 'Morning', hint: '8 AM – 12 PM', times: ['09:00', '10:00'] },
  ],
}));

const renderScreen = () =>
  render(
    <Provider store={store}>
      <ToastProvider>
        <BookCookScreen
          navigation={{ setParams: jest.fn(), navigate: jest.fn() }}
          route={{ params: {} }}
        />
      </ToastProvider>
    </Provider>,
  );

const signInCustomer = () => {
  store.dispatch(
    loginUser.fulfilled(
      {
        token: 'test-token',
        user: { _id: 'customer-1', id: 'customer-1', role: 'customer', name: 'Test Customer' },
      },
      'test-request',
      undefined,
    ),
  );
};

const goToConfirmation = async (view) => {
  await fireEvent.press(view.getByTestId('booking-next-time'));
  await fireEvent.press(view.getByTestId('booking-time-09:00'));
  await fireEvent.press(view.getByTestId('booking-next-venue'));
  await fireEvent.changeText(
    view.getByPlaceholderText('Flat, street, area'),
    '12 Rose Villa, Baner',
  );
  await fireEvent.press(view.getByTestId('booking-presence-yes'));
  await fireEvent.press(view.getByTestId('booking-next-confirm'));
  await view.findByText('Your booking');
};

describe('BookCookScreen', () => {
  beforeEach(async () => {
    store.dispatch(logout());
    await clearBookingDraft();
  });

  afterEach(async () => {
    await clearBookingDraft();
    jest.clearAllMocks();
  });

  test('renders the restyled direct-booking flow through confirmation', async () => {
    const view = await renderScreen();

    expect(view.getByText('Book your cook')).toBeTruthy();
    expect(view.getByText('When do you need a cook?')).toBeTruthy();
    expect(view.getByText('How long do you need?')).toBeTruthy();
    expect(view.getByText("Who's joining?")).toBeTruthy();

    await fireEvent.press(view.getByTestId('booking-next-time'));

    expect(view.getByText('Pick a start time')).toBeTruthy();
    await fireEvent.press(view.getByTestId('booking-time-09:00'));
    expect(view.getByText('YOUR SLOT')).toBeTruthy();
    await fireEvent.press(view.getByTestId('booking-next-venue'));

    expect(view.getByText('Where should the cook come?')).toBeTruthy();
    await fireEvent.changeText(
      view.getByPlaceholderText('Flat, street, area'),
      '12 Rose Villa, Baner',
    );
    await fireEvent.press(view.getByTestId('booking-presence-yes'));
    await fireEvent.press(view.getByTestId('booking-next-confirm'));

    expect(await view.findByText('Your booking')).toBeTruthy();
    expect(view.getByText('All-in price · 2 hrs')).toBeTruthy();
    expect(view.getByText('Have a coupon?')).toBeTruthy();
  });

  test('applies a coupon and includes it in the booking payload', async () => {
    signInCustomer();
    validateCoupon.mockResolvedValueOnce({
      code: 'FESTIVE20',
      discount: 70,
      payable: 429,
    });
    createBooking.mockResolvedValueOnce({ _id: 'booking-1' });

    const view = await renderScreen();
    await goToConfirmation(view);

    await fireEvent.changeText(view.getByPlaceholderText('Enter coupon code'), 'FESTIVE20');
    await fireEvent.press(view.getByTestId('booking-coupon-apply'));

    await waitFor(() => expect(validateCoupon).toHaveBeenCalledTimes(1));
    expect(validateCoupon).toHaveBeenCalledWith('FESTIVE20', {
      amount: expect.any(Number),
      serviceType: 'cook_for_me',
    });
    expect(await view.findByText(/looks valid/i)).toBeTruthy();

    await fireEvent.press(view.getByTestId('booking-submit'));

    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(createBooking.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        couponCode: 'FESTIVE20',
        serviceType: 'cook_for_me',
      }),
    );
  });

  test('shows the server reason when a coupon is rejected', async () => {
    signInCustomer();
    validateCoupon.mockRejectedValueOnce({
      response: { data: { message: 'This coupon has expired.' } },
    });

    const view = await renderScreen();
    await goToConfirmation(view);

    await fireEvent.changeText(view.getByPlaceholderText('Enter coupon code'), 'EXPIRED10');
    await fireEvent.press(view.getByTestId('booking-coupon-apply'));

    expect(await view.findByText('This coupon has expired.')).toBeTruthy();
    expect(validateCoupon).toHaveBeenCalledWith('EXPIRED10', {
      amount: expect.any(Number),
      serviceType: 'cook_for_me',
    });
  });
});
