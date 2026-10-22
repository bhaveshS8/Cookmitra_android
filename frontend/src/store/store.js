// Auth state mirroring website frontend/src/store/authSlice.js:
// same endpoints, same payload normalization, same role routing inputs.
import { createSlice, createAsyncThunk, configureStore } from '@reduxjs/toolkit';
import API from '../api/client';
import { saveSession, loadSession, clearSession } from '../services/session';

export const normalizeRole = (role) => {
  if (typeof role !== 'string') return role;
  const lower = role.toLowerCase();
  return ['customer', 'cook', 'admin'].includes(lower) ? lower : role;
};

// The backend serializes the signed-in account id as `id`, while nested
// documents (booking.cook, review.customer, ...) use `_id`. Screens compare
// the two directly, so both keys must be present on the auth user: without
// `_id`, every ownership check compared a real id against `undefined` and
// silently failed (draft scoping, cook-cancel rights on own bookings).
const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') return user;
  let next = user;
  const id = user.id ?? user._id;
  if (id != null && id !== '' && (next.id !== id || next._id !== id)) {
    next = { ...next, id, _id: id };
  }
  if (typeof next.role === 'string') {
    const lower = normalizeRole(next.role);
    if (next.role !== lower) next = { ...next, role: lower };
  }
  return next;
};

const preserveAuthError = (err) => ({
  response: { status: err?.response?.status, data: err?.response?.data },
  message: err?.message,
  code: err?.code,
});

const invalidAuthResponse = () => {
  const message = 'Authentication response was invalid. Please try again.';
  const err = new Error(message);
  err.response = { status: 502, data: { message } };
  return err;
};

// Never authenticate on a malformed response. The token and a routable role
// are both required for the navigator to establish a real session.
const readAuthResult = (data) => {
  const { token, user } = data || {};
  const normalized = normalizeUser(user);
  const role = normalized && typeof normalized === 'object' ? normalizeRole(normalized.role) : null;
  if (typeof token !== 'string' || !token || !['customer', 'cook', 'admin'].includes(role)) {
    throw invalidAuthResponse();
  }
  return { token, user: { ...normalized, role } };
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password, rememberMe = true }, { rejectWithValue }) => {
    try {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        const err = new Error('Email and password are required');
        err.response = { status: 400, data: { message: 'Email and password are required' } };
        throw err;
      }
      const response = await API.post('/auth/login', {
        email: cleanEmail,
        password,
        rememberMe: rememberMe !== false,
      });
      const { token, user: normalized } = readAuthResult(response.data);
      await saveSession(token, normalized, { persistent: rememberMe !== false });
      return { token, user: normalized };
    } catch (err) {
      return rejectWithValue(preserveAuthError(err));
    }
  },
);

export const registerUser = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  const payload = {
    ...data,
    email: String(data?.email || '').trim().toLowerCase(),
    name: String(data?.name || '').trim(),
    phone: String(data?.phone || data?.mobile || '').trim(),
    role: String(data?.role || 'customer').toUpperCase(),
  };
  try {
    const response = await API.post('/auth/register', payload);
    const { token, user: normalized } = readAuthResult(response.data);
    await saveSession(token, normalized, { persistent: true });
    return { token, user: normalized };
  } catch (err) {
    return rejectWithValue(preserveAuthError(err));
  }
});

export const logoutUser = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  try {
    await API.post('/auth/logout');
  } catch {
    // Offline logout still clears local state below.
  }
  await clearSession();
  dispatch(logout());
  return true;
});

export const restoreSession = createAsyncThunk('auth/restore', async (_, { rejectWithValue }) => {
  try {
    const { token } = await loadSession();
    if (!token) return rejectWithValue('no-session');
    const response = await API.get('/auth/me');
    const normalized = normalizeUser(response.data);
    await saveSession(token, normalized, { persistent: true });
    return { token, user: normalized };
  } catch (err) {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      // Keep an unfinished booking draft so a re-login can resume it.
      await clearSession({ preserveResume: true });
    }
    return rejectWithValue(err?.response?.data?.message || 'Session expired');
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, token: null, loading: false, error: null, restored: false },
  reducers: {
    logout(state) {
      state.user = null;
      state.token = null;
      state.error = null;
    },
    updateUser(state, action) {
      if (!state.user) return;
      state.user = normalizeUser({ ...state.user, ...action.payload });
    },
    // The backend rotates the JWT on password change (tokenVersion bump), so
    // the client must swap in the returned token or every later request 401s.
    setToken(state, action) {
      if (typeof action.payload === 'string' && action.payload) {
        state.token = action.payload;
      }
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const onPending = (state) => {
      state.loading = true;
      state.error = null;
    };
    const onFulfilled = (state, action) => {
      state.loading = false;
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.error = null;
      state.restored = true;
    };
    const onRejected = (state, action) => {
      state.loading = false;
      state.error =
        action.payload?.response?.data?.message ||
        action.payload?.message ||
        (typeof action.payload === 'string' ? action.payload : null) ||
        action.error?.message ||
        'Authentication failed';
      state.restored = true;
    };
    builder
      .addCase(loginUser.pending, onPending)
      .addCase(loginUser.fulfilled, onFulfilled)
      .addCase(loginUser.rejected, onRejected)
      .addCase(registerUser.pending, onPending)
      .addCase(registerUser.fulfilled, onFulfilled)
      .addCase(registerUser.rejected, onRejected)
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.error = null;
      })
      .addCase(restoreSession.pending, (state) => {
        state.loading = true;
      })
      .addCase(restoreSession.fulfilled, onFulfilled)
      .addCase(restoreSession.rejected, (state, action) => {
        state.loading = false;
        state.restored = true;
        if (action.payload !== 'no-session') {
          state.error = null;
        }
        if (action.payload && action.payload !== 'no-session') {
          state.user = null;
          state.token = null;
        }
      });
  },
});

export const { logout, updateUser, setToken, clearAuthError } = authSlice.actions;

export const store = configureStore({
  reducer: { auth: authSlice.reducer },
});
