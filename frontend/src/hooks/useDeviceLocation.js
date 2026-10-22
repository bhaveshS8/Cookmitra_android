import { useCallback, useEffect, useRef, useState } from 'react';
import {
  cacheLocation,
  getCachedLocation,
  isValidCoords,
  locateDevice,
  LOCATION_IDLE,
  LOCATION_OK,
} from '../services/location';

// Shares one location state across the screens that need it. `auto` asks for a
// fix as soon as the host screen mounts; a restored booking draft or an earlier
// screen's fix is never overwritten by a late automatic result.
export const useDeviceLocation = ({ auto = false } = {}) => {
  const [coords, setCoordsState] = useState(() => getCachedLocation());
  const [status, setStatus] = useState(() =>
    getCachedLocation() ? LOCATION_OK : LOCATION_IDLE,
  );
  const [precise, setPrecise] = useState(true);
  const [loading, setLoading] = useState(false);

  const alive = useRef(true);
  const manual = useRef(false);
  const autoStarted = useRef(false);
  const pending = useRef(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const setCoords = useCallback((next) => {
    manual.current = true;
    setCoordsState(next);
    if (isValidCoords(next)) cacheLocation(next);
  }, []);

  const detect = useCallback(({ manual: isManual = true } = {}) => {
    if (pending.current) return pending.current;
    if (alive.current) setLoading(true);

    const run = (async () => {
      try {
        const result = await locateDevice();
        if (!alive.current) return result;
        setStatus(result.status);
        if (result.status === LOCATION_OK && isValidCoords(result.coords)) {
          setPrecise(result.precise !== false);
          if (isManual || !manual.current) {
            setCoordsState(result.coords);
            cacheLocation(result.coords);
          }
        }
        return result;
      } finally {
        if (alive.current) setLoading(false);
      }
    })();

    pending.current = run;
    run.finally(() => {
      if (pending.current === run) pending.current = null;
    });
    return run;
  }, []);

  useEffect(() => {
    if (!auto || autoStarted.current) return;
    autoStarted.current = true;
    detect({ manual: false });
  }, [auto, detect]);

  return { coords, setCoords, status, precise, loading, detect };
};
