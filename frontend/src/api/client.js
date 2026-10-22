// Shared Axios client mirroring website frontend/src/api/axios.js:
// Bearer JWT per request, 15 s timeout, session restore on launch,
// session clear + logout notification on 401 (non-auth forms) and on 403
// "blocked by an administrator". Navigation-agnostic: the navigator
// registers a reset handler (avoids a router import cycle).
import axios from 'axios';
import { getApiConfig } from '../config';
import { loadSession, clearSession } from '../services/session';

let tokenGetter = null;
let authResetter = null;

export const setTokenGetter = (fn) => {
  tokenGetter = fn;
};
export const setAuthResetter = (fn) => {
  authResetter = fn;
};

const API = axios.create({
  baseURL: getApiConfig().baseUrl,
  timeout: 15000,
});

API.interceptors.request.use(async (config) => {
  const token = tokenGetter ? await tokenGetter() : (await loadSession()).token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const AUTH_FORM_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/google',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const isAuthForm = (url = '') => AUTH_FORM_PATHS.some((path) => url.includes(path));

// A wrong current password returns 401, but that is a form error and must not
// tear down an otherwise valid session. Any other 401 from the same endpoint
// (for example an expired JWT) still follows the normal session-expiry path.
const isWrongCurrentPassword = (error) =>
  String(error.config?.url || '').includes('/auth/change-password') &&
  /current password is incorrect/i.test(error.response?.data?.message || '');

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const url = error.config?.url || '';
    const status = error.response?.status;
    if (status === 401 && !isAuthForm(url) && !isWrongCurrentPassword(error)) {
      await clearSession({ preserveResume: true });
      if (authResetter) authResetter('session-expired');
    }
    const blockedMsg = error.response?.data?.message || '';
    if (status === 403 && /blocked by an administrator/i.test(blockedMsg)) {
      await clearSession({ preserveResume: true });
      if (authResetter) authResetter('blocked');
    }
    return Promise.reject(error);
  },
);

export const getApiErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (err?.code === 'ECONNABORTED') return 'Request timed out — check your connection and retry.';
  if (err?.message === 'Network Error') return 'Cannot reach the server — check your connection.';
  return err?.response?.data?.message || fallback;
};

export default API;
