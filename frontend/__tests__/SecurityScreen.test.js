import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store, logout, setToken, loginUser } from '../src/store/store';
import { ToastProvider } from '../src/store/toast';
import { changePassword, setPassword } from '../src/api/services';
import { replaceSessionToken, clearSession } from '../src/services/session';
import SecurityScreen from '../src/features/profile/SecurityScreen';

jest.mock('../src/api/services', () => ({
  changePassword: jest.fn(),
  setPassword: jest.fn(),
}));

jest.mock('../src/services/session', () => ({
  saveSession: jest.fn().mockResolvedValue(undefined),
  loadSession: jest.fn(),
  clearSession: jest.fn().mockResolvedValue(undefined),
  replaceSessionToken: jest.fn().mockResolvedValue(undefined),
}));

const renderSecurity = async (goBack = jest.fn()) => {
  await render(
    <Provider store={store}>
      <ToastProvider>
        <SecurityScreen navigation={{ goBack }} />
      </ToastProvider>
    </Provider>,
  );
  return { goBack };
};

describe('SecurityScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(logout());
  });

  test('persists the rotated JWT returned by change-password', async () => {
    changePassword.mockResolvedValueOnce({ message: 'Password changed', token: 'rotated-token' });
    const { goBack } = await renderSecurity();

    await fireEvent.changeText(screen.getByTestId('current-password'), 'OldPass123');
    await fireEvent.changeText(screen.getByTestId('new-password'), 'NewPass123');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'NewPass123');
    await fireEvent.press(screen.getByTestId('change-password-submit'));

    await waitFor(() => expect(replaceSessionToken).toHaveBeenCalledWith('rotated-token'));
    await waitFor(() => expect(store.getState().auth.token).toBe('rotated-token'));
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'OldPass123',
      newPassword: 'NewPass123',
    });
    expect(goBack).toHaveBeenCalled();
  });

  test('lets a Google-only account create a password without the current one', async () => {
    store.dispatch(
      loginUser.fulfilled(
        {
          token: 'google-token',
          user: {
            id: 'user-google',
            name: 'Google User',
            role: 'customer',
            authProvider: 'google',
            loginMethod: 'google',
            hasPassword: false,
          },
        },
        'request-google',
      ),
    );
    setPassword.mockResolvedValueOnce({
      message: 'Password created',
      user: { id: 'user-google', hasPassword: true, authProvider: 'local+google' },
    });

    const { goBack } = await renderSecurity();

    expect(screen.queryByTestId('current-password')).toBeNull();
    expect(screen.getByText('Create password')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('new-password'), 'NewPass123');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'NewPass123');
    await fireEvent.press(screen.getByTestId('change-password-submit'));

    await waitFor(() =>
      expect(setPassword).toHaveBeenCalledWith({ newPassword: 'NewPass123' }),
    );
    expect(changePassword).not.toHaveBeenCalled();
    expect(replaceSessionToken).not.toHaveBeenCalled();
    expect(store.getState().auth.user.hasPassword).toBe(true);
    expect(store.getState().auth.user.authProvider).toBe('local+google');
    expect(goBack).toHaveBeenCalled();
  });

  test('rejects mismatched confirmation before calling the API', async () => {
    await renderSecurity();

    await fireEvent.changeText(screen.getByTestId('current-password'), 'OldPass123');
    await fireEvent.changeText(screen.getByTestId('new-password'), 'NewPass123');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'Different123');
    await fireEvent.press(screen.getByTestId('change-password-submit'));

    expect(screen.getByText('Passwords do not match')).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });

  test('ends the session when the rotated token cannot be stored securely', async () => {
    store.dispatch(setToken('old-token'));
    changePassword.mockResolvedValueOnce({ message: 'Password changed', token: 'rotated-token' });
    replaceSessionToken.mockRejectedValueOnce(new Error('keystore unavailable'));
    const { goBack } = await renderSecurity();

    await fireEvent.changeText(screen.getByTestId('current-password'), 'OldPass123');
    await fireEvent.changeText(screen.getByTestId('new-password'), 'NewPass123');
    await fireEvent.changeText(screen.getByTestId('confirm-password'), 'NewPass123');
    await fireEvent.press(screen.getByTestId('change-password-submit'));

    await waitFor(() => expect(clearSession).toHaveBeenCalled());
    expect(store.getState().auth.token).toBeNull();
    expect(goBack).not.toHaveBeenCalled();
  });
});
