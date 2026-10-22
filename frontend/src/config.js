// Build-time configuration via react-native-config (mobile/.env).
// Node-style process.env does NOT exist in the RN runtime — values must
// come through Config.
import Config from 'react-native-config';

const trimTrailingSlash = (s) => String(s || '').replace(/\/+$/, '');

const API_BASE_URL = 'https://cookmitra.org/api';
const PROD_WEB_ORIGIN = 'https://cookmitra.org';

export const getApiConfig = () => {
  return {
    baseUrl: API_BASE_URL,
    webOrigin: trimTrailingSlash(Config.WEB_ORIGIN || PROD_WEB_ORIGIN),
    razorpayKeyId: Config.RAZORPAY_KEY_ID || '',
  };
};
