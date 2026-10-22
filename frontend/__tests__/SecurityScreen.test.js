import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { store, logout, setToken } from '../src/store/store';
import { ToastProvider } from '../src/store/toast';
import { changePassword } from '../src/api/services';
import { replaceSessionToken, clearSession } from '../src/services/session';
import SecurityScreen from '../src/features/profile/SecurityScreen';

jest.mock('../src/api/services', () => ({
  changePassword: jest.fn(),
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
