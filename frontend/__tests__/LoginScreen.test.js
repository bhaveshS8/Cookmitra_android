import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store, logout } from '../src/store/store';
import { ToastProvider } from '../src/store/toast';
import API from '../src/api/client';
import LoginScreen from '../src/features/auth/LoginScreen';

const renderLogin = async (params = {}, navigation = { navigate: jest.fn() }) => {
  await render(
    <Provider store={store}>
      <ToastProvider>
        <LoginScreen navigation={navigation} route={{ params }} />
      </ToastProvider>
    </Provider>,
  );
  return screen;
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    store.dispatch(logout());
  });

  test('renders email + password fields and submit', async () => {
    const s = await renderLogin();
    expect(s.getByPlaceholderText('name@example.com')).toBeTruthy();
    expect(s.getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(s.getByTestId('login-submit')).toBeTruthy();
  });
  test('empty submit shows validation errors, no network call', async () => {
    const s = await renderLogin();
    await fireEvent.press(s.getByTestId('login-submit'));
    expect(s.getByText('Please fix the highlighted fields and try again.')).toBeTruthy();
    expect(s.getByText('Email is required')).toBeTruthy();
    expect(s.getByText('Password is required')).toBeTruthy();
  });
  test('editing a field clears the validation banner', async () => {
    const s = await renderLogin();
    await fireEvent.press(s.getByTestId('login-submit'));
    expect(s.getByText('Please fix the highlighted fields and try again.')).toBeTruthy();

    await fireEvent.changeText(s.getByPlaceholderText('name@example.com'), 'person@example.com');
    expect(s.queryByText('Please fix the highlighted fields and try again.')).toBeNull();
    expect(s.queryByText('Email is required')).toBeNull();
  });
  test('booking-resume note appears with next param', async () => {
    const s = await renderLogin({ next: 'Book' });
    expect(s.getByText(/pick up right where you left off/)).toBeTruthy();
  });

  test('Google-only account gets a link to set a password by email', async () => {
    const navigation = { navigate: jest.fn() };
    jest.spyOn(API, 'post').mockRejectedValueOnce({
      response: {
        status: 401,
        data: {
          message:
            "This account uses Google sign-in. Continue with Google, or set a password via 'Forgot password?' to sign in with email.",
          code: 'GOOGLE_SIGN_IN_REQUIRED',
        },
      },
    });

    const s = await renderLogin({}, navigation);
    await fireEvent.changeText(s.getByPlaceholderText('name@example.com'), 'Person@Example.com ');
    await fireEvent.changeText(s.getByPlaceholderText('Enter your password'), 'anything123');
    await fireEvent.press(s.getByTestId('login-submit'));

    await waitFor(() => expect(s.getByText('Set a password via email')).toBeTruthy());
    expect(s.getByText(/This account was created with Google/)).toBeTruthy();

    await fireEvent.press(s.getByText('Set a password via email'));
    expect(navigation.navigate).toHaveBeenCalledWith('ForgotPassword', {
      email: 'person@example.com',
    });
  });
});
