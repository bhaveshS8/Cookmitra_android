import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store } from '../src/store/store';
import { ToastProvider } from '../src/store/toast';
import RegisterScreen from '../src/features/auth/RegisterScreen';

const renderRegister = async () => {
  await render(
    <Provider store={store}>
      <ToastProvider>
        <RegisterScreen navigation={{ navigate: jest.fn() }} route={{ params: {} }} />
      </ToastProvider>
    </Provider>,
  );
  return screen;
};

describe('RegisterScreen', () => {
  test('renders form and switches account role', async () => {
    const s = await renderRegister();
    expect(s.getByPlaceholderText('Your name')).toBeTruthy();
    expect(s.getByPlaceholderText('name@example.com')).toBeTruthy();
    expect(s.getByTestId('register-submit')).toBeTruthy();
    expect(s.getByText('Book trusted home cooks for everyday meals and celebrations.')).toBeTruthy();

    await fireEvent.press(s.getByLabelText('Cook account'));

    expect(s.getByText('Share your cooking and earn from local bookings — on your schedule.')).toBeTruthy();
  });

  test('empty submit shows validation errors', async () => {
    const s = await renderRegister();
    await fireEvent.press(s.getByTestId('register-submit'));
    expect(s.getByText('Please fix the highlighted fields and try again.')).toBeTruthy();
    expect(s.getByText('Full name is required')).toBeTruthy();
    expect(s.getByText('Email is required')).toBeTruthy();
    expect(s.getByText('Mobile number is required')).toBeTruthy();
    expect(s.getByText('Password is required')).toBeTruthy();
    expect(s.getByText('Please confirm your password')).toBeTruthy();
  });

  test('confirm password is required and must match', async () => {
    const s = await renderRegister();
    await fireEvent.changeText(s.getByPlaceholderText('Min. 8 characters'), 'Abcdefgh1');
    await fireEvent.press(s.getByTestId('register-submit'));
    expect(s.getByText('Please confirm your password')).toBeTruthy();

    await fireEvent.changeText(s.getByPlaceholderText('Repeat your password'), 'Different1');
    await fireEvent.press(s.getByTestId('register-submit'));
    expect(s.getByText('Passwords do not match')).toBeTruthy();
  });

  test('editing a field clears the validation banner', async () => {
    const s = await renderRegister();
    await fireEvent.press(s.getByTestId('register-submit'));
    expect(s.getByText('Please fix the highlighted fields and try again.')).toBeTruthy();

    await fireEvent.changeText(s.getByPlaceholderText('Your name'), 'Asha');
    expect(s.queryByText('Please fix the highlighted fields and try again.')).toBeNull();
    expect(s.queryByText('Full name is required')).toBeNull();
  });
});
