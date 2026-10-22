import { PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  cacheLocation,
  getCachedLocation,
  isValidCoords,
  locateDevice,
  locationMessage,
  needsLocationSettings,
  LOCATION_BLOCKED,
  LOCATION_DENIED,
  LOCATION_OK,
  LOCATION_SERVICES_OFF,
  LOCATION_TIMEOUT,
  LOCATION_UNAVAILABLE,
} from '../src/services/location';
import { useDeviceLocation } from '../src/hooks/useDeviceLocation';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;

const android = { platform: 'android' };

const grant = (permissions) =>
  PermissionsAndroid.check.mockImplementation(async (p) => permissions.includes(p));

const answerPrompt = (result) =>
  PermissionsAndroid.requestMultiple.mockResolvedValue(result);

const fix = (lat = 18.52, lng = 73.85, accuracy = 8) =>
  Geolocation.getCurrentPosition.mockImplementation((success) =>
    success({ coords: { latitude: lat, longitude: lng, accuracy } }),
  );

const failWith = (code) =>
  Geolocation.getCurrentPosition.mockImplementation((success, error) =>
    error({ code }),
  );

beforeAll(() => {
  jest.spyOn(PermissionsAndroid, 'check');
  jest.spyOn(PermissionsAndroid, 'requestMultiple');
});

beforeEach(() => {
  PermissionsAndroid.check.mockReset();
  PermissionsAndroid.requestMultiple.mockReset();
  Geolocation.getCurrentPosition.mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('permission handling', () => {
  test('precise permission is used as-is without prompting', async () => {
    grant([FINE, COARSE]);
    fix();

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_OK);
    expect(result.precise).toBe(true);
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
  });

  test('approximate-only permission uses network accuracy instead of GPS', async () => {
    grant([COARSE]);
    fix();

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_OK);
    expect(result.precise).toBe(false);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: false }),
    );
  });

  test('first-run request asks for FINE and COARSE together (Android 12+) and accepts approximate', async () => {
    grant([]);
    answerPrompt({ [FINE]: DENIED, [COARSE]: GRANTED });
    fix();

    const result = await locateDevice(android);

    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([FINE, COARSE]);
    expect(result.status).toBe(LOCATION_OK);
    expect(result.precise).toBe(false);
  });

  test('a denied prompt never reads the device location', async () => {
    grant([]);
    answerPrompt({ [FINE]: DENIED, [COARSE]: DENIED });

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_DENIED);
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  test('a permanently denied prompt is reported as blocked', async () => {
    grant([]);
    answerPrompt({ [FINE]: NEVER_ASK_AGAIN, [COARSE]: NEVER_ASK_AGAIN });

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_BLOCKED);
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe('acquisition failures', () => {
  test('POSITION_UNAVAILABLE means location services are switched off', async () => {
    grant([FINE]);
    failWith(2);

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_SERVICES_OFF);
    // No point retrying a provider that is disabled system-wide.
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  test('a high-accuracy timeout retries once at network accuracy', async () => {
    grant([FINE]);
    Geolocation.getCurrentPosition
      .mockImplementationOnce((success, error) => error({ code: 3 }))
      .mockImplementationOnce((success) =>
        success({ coords: { latitude: 19.07, longitude: 72.87, accuracy: 900 } }),
      );

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_OK);
    expect(result.coords).toEqual({ lat: 19.07, lng: 72.87 });
    expect(result.precise).toBe(false);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(Geolocation.getCurrentPosition.mock.calls[1][2]).toEqual(
      expect.objectContaining({ enableHighAccuracy: false }),
    );
  });

  test('a second timeout is reported as a timeout, not a success', async () => {
    grant([FINE]);
    failWith(3);

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_TIMEOUT);
  });

  test('an unknown native error is reported as unavailable', async () => {
    grant([FINE]);
    failWith(99);

    const result = await locateDevice(android);

    expect(result.status).toBe(LOCATION_UNAVAILABLE);
  });
});

describe('coordinates and messages', () => {
  test('valid fixes are cached for the session', async () => {
    cacheLocation({ lat: 18.52, lng: 73.85 });
    expect(getCachedLocation()).toEqual({ lat: 18.52, lng: 73.85 });
  });

  test('invalid coordinates are rejected', () => {
    expect(isValidCoords(null)).toBe(false);
    expect(isValidCoords({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidCoords({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidCoords({ lat: -90, lng: 180 })).toBe(true);
  });

  test('every failure status has an actionable message', () => {
    for (const status of [
      LOCATION_DENIED,
      LOCATION_BLOCKED,
      LOCATION_SERVICES_OFF,
      LOCATION_TIMEOUT,
      LOCATION_UNAVAILABLE,
    ]) {
      expect(locationMessage(status).length).toBeGreaterThan(20);
    }
    expect(needsLocationSettings(LOCATION_SERVICES_OFF)).toBe(true);
    expect(needsLocationSettings(LOCATION_BLOCKED)).toBe(true);
    expect(needsLocationSettings(LOCATION_DENIED)).toBe(false);
  });
});

describe('useDeviceLocation', () => {
  test('an automatic fix fills the pin when nothing was set', async () => {
    grant([FINE]);
    fix(17.38, 78.48);

    // renderHook is async in @testing-library/react-native v14.
    const { result } = await renderHook(() => useDeviceLocation({ auto: true }));

    await waitFor(() => expect(result.current.status).toBe(LOCATION_OK));
    expect(result.current.coords).toEqual({ lat: 17.38, lng: 78.48 });
  });

  test('a restored draft pin is not overwritten by a late automatic fix', async () => {
    grant([FINE]);
    let resolveFix;
    Geolocation.getCurrentPosition.mockImplementation((success) => {
      resolveFix = success;
    });

    const { result } = await renderHook(() => useDeviceLocation({ auto: true }));
    await waitFor(() => expect(resolveFix).toBeDefined());

    await act(async () => {
      result.current.setCoords({ lat: 19.07, lng: 72.87 });
    });
    await waitFor(() =>
      expect(result.current.coords).toEqual({ lat: 19.07, lng: 72.87 }),
    );

    await act(async () => {
      resolveFix({ coords: { latitude: 28.61, longitude: 77.2, accuracy: 5 } });
    });

    expect(result.current.coords).toEqual({ lat: 19.07, lng: 72.87 });
  });
});
