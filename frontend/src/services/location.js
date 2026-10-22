// Device location for the venue pin.
//
// Why this module exists instead of calling the Geolocation API inline:
//
// 1. Android 12+ requires ACCESS_FINE_LOCATION and ACCESS_COARSE_LOCATION to be
//    requested in ONE runtime request. Requesting only FINE is ignored on some
//    versions, which reads to the user as "location does not work".
// 2. Users may grant only Approximate. That leaves FINE denied while COARSE is
//    granted; the native library then returns POSITION_UNAVAILABLE for a
//    high-accuracy request (it resolves the GPS provider, then rejects it for a
//    missing FINE grant). We must retry with network/coarse accuracy.
// 3. Location Services can be switched off system-wide (error code 2). The user
//    needs an actionable message, not a generic failure.
// 4. Several screens want the same fix. One in-flight request is shared so the
//    permission dialog never appears twice, and the last fix is reused for the
//    rest of the session (never persisted to disk).

import { Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export const LOCATION_IDLE = 'idle';
export const LOCATION_OK = 'ok';
export const LOCATION_DENIED = 'denied';
export const LOCATION_BLOCKED = 'blocked';
export const LOCATION_SERVICES_OFF = 'services_off';
export const LOCATION_TIMEOUT = 'timeout';
export const LOCATION_UNAVAILABLE = 'unavailable';

export const PERMISSION_PRECISE = 'precise';
export const PERMISSION_APPROXIMATE = 'approximate';
export const PERMISSION_DENIED = 'denied';
export const PERMISSION_BLOCKED = 'blocked';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

let cached = null;
let inFlight = null;

export const isValidCoords = (c) =>
  Boolean(
    c &&
      Number.isFinite(c.lat) &&
      Number.isFinite(c.lng) &&
      Math.abs(c.lat) <= 90 &&
      Math.abs(c.lng) <= 180,
  );

// Session-only cache. A venue pin from a previous launch could be stale or from
// somewhere else entirely, so it is intentionally not written to AsyncStorage.
export const getCachedLocation = () => cached;
export const cacheLocation = (coords) => {
  if (isValidCoords(coords)) cached = { lat: coords.lat, lng: coords.lng };
};

const toCoords = (position) => ({
  lat: position.coords.latitude,
  lng: position.coords.longitude,
});

const errorCode = (err) => Number(err?.code);

const getPosition = (options) =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(resolve, reject, options);
  });

// Returns 'precise' | 'approximate' | 'denied' | 'blocked'. Prompts only when
// the app has no location permission at all.
export const requestLocationPermission = async ({ platform = Platform.OS } = {}) => {
  if (platform !== 'android') {
    // The app ships Android-only; keep the previous behaviour for any other host.
    return PERMISSION_PRECISE;
  }
  try {
    if (await PermissionsAndroid.check(FINE)) return PERMISSION_PRECISE;
    if (await PermissionsAndroid.check(COARSE)) return PERMISSION_APPROXIMATE;

    // Both, in one request. This is the Android 12+ contract and it also gives
    // the user the precise/approximate choice on earlier versions.
    const results = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
    if (results[FINE] === PermissionsAndroid.RESULTS.GRANTED) return PERMISSION_PRECISE;
    if (results[COARSE] === PermissionsAndroid.RESULTS.GRANTED) return PERMISSION_APPROXIMATE;
    const blocked =
      results[FINE] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      results[COARSE] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    return blocked ? PERMISSION_BLOCKED : PERMISSION_DENIED;
  } catch {
    return PERMISSION_DENIED;
  }
};

// Resolves to { status, coords?, precise?, accuracy? }. Never throws.
export const locateDevice = ({ platform = Platform.OS } = {}) => {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const permission = await requestLocationPermission({ platform });
    if (permission === PERMISSION_DENIED) return { status: LOCATION_DENIED };
    if (permission === PERMISSION_BLOCKED) return { status: LOCATION_BLOCKED };

    // Approximate permission can only use the network provider; asking for GPS
    // with FINE denied makes the native layer report POSITION_UNAVAILABLE.
    const highAccuracy = permission === PERMISSION_PRECISE;

    try {
      const position = await getPosition({
        enableHighAccuracy: highAccuracy,
        timeout: 15000,
        maximumAge: highAccuracy ? 10000 : 60000,
      });
      const coords = toCoords(position);
      cacheLocation(coords);
      return {
        status: LOCATION_OK,
        coords,
        precise: highAccuracy,
        accuracy: position.coords.accuracy,
      };
    } catch (first) {
      const code = errorCode(first);
      if (code === 1) return { status: LOCATION_DENIED };
      if (code === 2) return { status: LOCATION_SERVICES_OFF };

      // High-accuracy fix timed out: retry once at network accuracy. Indoors a
      // coarse fix is far more useful than no pin at all.
      if (code === 3 && highAccuracy) {
        try {
          const position = await getPosition({
            enableHighAccuracy: false,
            timeout: 12000,
            maximumAge: 60000,
          });
          const coords = toCoords(position);
          cacheLocation(coords);
          return {
            status: LOCATION_OK,
            coords,
            precise: false,
            accuracy: position.coords.accuracy,
          };
        } catch (second) {
          const secondCode = errorCode(second);
          if (secondCode === 1) return { status: LOCATION_DENIED };
          if (secondCode === 2) return { status: LOCATION_SERVICES_OFF };
          return { status: LOCATION_TIMEOUT };
        }
      }
      return { status: code === 3 ? LOCATION_TIMEOUT : LOCATION_UNAVAILABLE };
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
};

export const locationMessage = (status) => {
  switch (status) {
    case LOCATION_DENIED:
      return 'Location permission is needed to pin the venue. You can also enter the address manually.';
    case LOCATION_BLOCKED:
      return 'Location is turned off for CookMitra. Enable it in Settings, or enter the address manually.';
    case LOCATION_SERVICES_OFF:
      return 'Location (GPS) is off on this phone. Turn it on, then try again.';
    case LOCATION_TIMEOUT:
    case LOCATION_UNAVAILABLE:
      return 'Could not get a location fix. Move near a window and retry, or enter the address manually.';
    default:
      return 'Location is unavailable. Enter the address manually.';
  }
};

export const needsLocationSettings = (status) =>
  status === LOCATION_BLOCKED || status === LOCATION_SERVICES_OFF;

export const openLocationSettings = async () => {
  try {
    await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
  } catch {
    try {
      await Linking.openSettings();
    } catch {
      // Nothing else the app can do; the message already tells the user where
      // to look.
    }
  }
};

export const openAppSettings = async () => {
  try {
    await Linking.openSettings();
  } catch {
    // Ignore: the message already explains what to enable.
  }
};
