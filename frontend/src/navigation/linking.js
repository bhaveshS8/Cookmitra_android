// Deep links handled by the app. ResetPassword is a root-level screen so the
// same link works whether the user is signed in or signed out; protected
// booking links are only registered by the authenticated navigator.
//
// The https prefix matches the real reset link the backend emails
// (`{FRONTEND_BASE_URL}/reset-password?token=...`) so tapping it on the device
// can open the app instead of the browser. It is an unverified App Link until
// https://cookmitra.org/.well-known/assetlinks.json is published — see
// ANDROID_RELEASE_READINESS.md.
export const linking = {
  prefixes: ['cookmitra://', 'https://cookmitra.org'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      BookingDetail: 'bookings/:bookingId',
    },
  },
};
