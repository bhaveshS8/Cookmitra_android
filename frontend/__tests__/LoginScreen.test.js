import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store } from '../src/store/store';
import { ToastProvider } from '../src/store/toast';
import LoginScreen from '../src/features/auth/LoginScreen';

const renderLogin = async (params = {}) => {
  await render(
    <Provider store={store}>
      <ToastProvider>
        <LoginScreen navigation={{ navigate: jest.fn() }} route={{ params }} />
      </ToastProvider>
    </Provider>,
  );
  return screen;
};

describe('LoginScreen', () => {
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
});
