import { store, loginUser, registerUser, logout } from '../src/store/store';
import API from '../src/api/client';
import { saveSession } from '../src/services/session';

jest.mock('../src/api/client', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn() },
}));

jest.mock('../src/services/session', () => ({
  saveSession: jest.fn().mockResolvedValue(undefined),
  loadSession: jest.fn(),
  clearSession: jest.fn().mockResolvedValue(undefined),
}));

describe('auth thunks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(logout());
  });

  test('login authenticates only a complete response and normalizes the role', async () => {
    API.post.mockResolvedValueOnce({
      data: { token: 'token-123', user: { name: 'Asha', role: 'COOK' } },
    });

    const result = await store.dispatch(
      loginUser({ email: '  ASHA@EXAMPLE.COM ', password: 'secret12', rememberMe: true }),
    );

    expect(loginUser.fulfilled.match(result)).toBe(true);
    expect(API.post).toHaveBeenCalledWith('/auth/login', {
      email: 'asha@example.com',
      password: 'secret12',
      rememberMe: true,
    });
    expect(result.payload.user.role).toBe('cook');
    expect(saveSession).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ name: 'Asha', role: 'cook' }),
      { persistent: true },
    );
    expect(store.getState().auth.token).toBe('token-123');
  });

  test('login rejects a response without a token', async () => {
    API.post.mockResolvedValueOnce({
      data: { user: { name: 'Asha', role: 'CUSTOMER' } },
    });

    const result = await store.dispatch(loginUser({ email: 'asha@example.com', password: 'secret12' }));

    expect(loginUser.rejected.match(result)).toBe(true);
    expect(result.payload.response.data.message).toMatch(/invalid/i);
    expect(saveSession).not.toHaveBeenCalled();
    expect(store.getState().auth.token).toBeNull();
  });

  test('register rejects a response without a routable user role', async () => {
    API.post.mockResolvedValueOnce({
      data: { token: 'token-123', user: { name: 'Asha', role: 'SUPERUSER' } },
    });

    const result = await store.dispatch(
      registerUser({
        name: 'Asha',
        email: 'asha@example.com',
        phone: '9876543210',
        password: 'secret12',
        role: 'customer',
      }),
    );

    expect(registerUser.rejected.match(result)).toBe(true);
    expect(saveSession).not.toHaveBeenCalled();
    expect(store.getState().auth.token).toBeNull();
  });

  // The backend returns the account id as `id`; screens compare it with the
  // `_id` nested in booking/review payloads. Both keys must be populated or
  // ownership checks compare a real id against `undefined`.
  test('mirrors the account id onto _id for ownership comparisons', async () => {
    API.post.mockResolvedValueOnce({
      data: { token: 'token-123', user: { id: 'user-1', name: 'Asha', role: 'COOK' } },
    });

    const result = await store.dispatch(
      loginUser({ email: 'asha@example.com', password: 'secret12' }),
    );

    expect(loginUser.fulfilled.match(result)).toBe(true);
    expect(result.payload.user.id).toBe('user-1');
    expect(result.payload.user._id).toBe('user-1');
    expect(store.getState().auth.user._id).toBe('user-1');
  });
});
