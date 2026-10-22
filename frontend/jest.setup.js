/* eslint-env jest */
// Native modules unavailable under Jest are mocked here. No app code
// changes are needed for tests: storage is in-memory, keychain resolves
// empty, network is never touched (axios is mocked per-suite as needed).
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn().mockResolvedValue(true),
  getGenericPassword: jest.fn().mockResolvedValue(false),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  SECURITY_LEVEL_ANY: 'ANY',
  ACCESSIBLE: { WHEN_UNLOCKED: 'WHEN_UNLOCKED' },
}));

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
    requestAuthorization: jest.fn(),
    setRNConfiguration: jest.fn(),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      setItem: jest.fn(async (k, v) => {
        store.set(k, v);
      }),
      getItem: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
      removeItem: jest.fn(async (k) => {
        store.delete(k);
      }),
      multiRemove: jest.fn(async (ks) => {
        (ks || []).forEach((k) => store.delete(k));
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
      __store: store,
    },
  };
});

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { API_BASE_URL: 'http://localhost:5000/api', WEB_ORIGIN: 'https://cookmitra.example.com', RAZORPAY_KEY_ID: '' },
}));

// Toast timers are left real; component tests unmount cleanly without
// fake-timer interference with promise flushing.
