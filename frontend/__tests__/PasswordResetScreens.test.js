import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store, logout } from '../src/store/store';
import { ToastProvider } from '../src/store/toast';
import API from '../src/api/client';
import ForgotPasswordScreen from '../src/features/auth/ForgotPasswordScreen';
import ResetPasswordScreen from '../src/features/auth/ResetPasswordScreen';

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
  getApiErrorMessage: (e, fallback) => e?.response?.data?.message || fallback,
}));

const TOKEN = 'a'.repeat(64);

const renderWithProviders = async (ui) => {
  await render(
    <Provider store={store}>
      <ToastProvider>{ui}</ToastProvider>
    </Provider>,
  );
  return screen;
};

const forgotNavigation = () => ({
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  navigate: jest.fn(),
});

const resetNavigation = () => ({
  canGoBack: jest.fn(() => true),
  goBack: jest.fn(),
  navigate: jest.fn(),
  setParams: jest.fn(),
});

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(logout());
  });

  test('renders the recovery card and validates an empty email without a request', async () => {
    const navigation = forgotNavigation();
    await renderWithProviders(<ForgotPasswordScreen navigation={navigation} route={{ params: {} }} />);

    expect(screen.getByTestId('forgot-email')).toBeTruthy();
    expect(screen.getByTestId('forgot-submit')).toBeTruthy();
    expect(screen.getByText('ACCOUNT RECOVERY')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('forgot-submit'));

    expect(screen.getByText('Email is required')).toBeTruthy();
    expect(API.post).not.toHaveBeenCalled();
  });

  test('normalizes the email, sends the reset link, and switches to the sent state', async () => {
    API.post.mockResolvedValueOnce({ data: { message: 'Sent' } });
    const navigation = forgotNavigation();
    await renderWithProviders(<ForgotPasswordScreen navigation={navigation} route={{ params: {} }} />);

    await fireEvent.changeText(screen.getByTestId('forgot-email'), '  Person@Example.COM  ');
    await fireEvent.press(screen.getByTestId('forgot-submit'));

    await waitFor(() =>
      expect(API.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'person@example.com',
      }),
    );
    expect(screen.getByText('Reset link sent')).toBeTruthy();
    expect(screen.getByText('Send again')).toBeTruthy();
  });

  test('editing the address hides the previous sent confirmation', async () => {
    API.post.mockResolvedValueOnce({ data: { message: 'Sent' } });
    const navigation = forgotNavigation();
    await renderWithProviders(<ForgotPasswordScreen navigation={navigation} route={{ params: {} }} />);

    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'person@example.com');
    await fireEvent.press(screen.getByTestId('forgot-submit'));
    await waitFor(() => expect(screen.getByText('Reset link sent')).toBeTruthy());

    await fireEvent.changeText(screen.getByTestId('forgot-email'), 'other@example.com');
    expect(screen.queryByText('Reset link sent')).toBeNull();
    expect(screen.getByText('Send reset link')).toBeTruthy();
  });
});

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(logout());
  });

  test('offers a fresh link when the token is missing', async () => {
    const navigation = resetNavigation();
    await renderWithProviders(
      <ResetPasswordScreen navigation={navigation} route={{ params: {} }} />,
    );

    expect(screen.getByText('LINK NOT VALID')).toBeTruthy();
    expect(screen.getByText('Request a new reset link')).toBeTruthy();
    expect(screen.queryByTestId('reset-submit')).toBeNull();

    await fireEvent.press(screen.getByTestId('reset-back'));

    expect(navigation.navigate).toHaveBeenCalledWith('Auth', { screen: 'ForgotPassword' });
  });

  test('blocks a mismatched confirmation before calling the API', async () => {
    const navigation = resetNavigation();
    await renderWithProviders(
      <ResetPasswordScreen navigation={navigation} route={{ params: { token: TOKEN } }} />,
    );

    await fireEvent.changeText(screen.getByTestId('reset-password'), 'NewPass123');
    await fireEvent.changeText(screen.getByTestId('reset-confirm'), 'Different123');
    await fireEvent.press(screen.getByTestId('reset-submit'));

    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(API.post).not.toHaveBeenCalled();
  });

  test('submits a valid password and keeps the success state after clearing the token param', async () => {
    API.post.mockResolvedValueOnce({ data: { message: 'Password reset' } });
    const navigation = resetNavigation();
    await renderWithProviders(
      <ResetPasswordScreen navigation={navigation} route={{ params: { token: TOKEN } }} />,
    );

    await fireEvent.changeText(screen.getByTestId('reset-password'), 'NewPass123');
    await fireEvent.changeText(screen.getByTestId('reset-confirm'), 'NewPass123');
    await fireEvent.press(screen.getByTestId('reset-submit'));

    await waitFor(() =>
      expect(API.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: TOKEN,
        password: 'NewPass123',
      }),
    );
    await waitFor(() => expect(screen.getByText('Password updated')).toBeTruthy());
    expect(navigation.setParams).toHaveBeenCalledWith({ token: null });
    expect(screen.getByTestId('reset-back')).toBeTruthy();
  });
});
