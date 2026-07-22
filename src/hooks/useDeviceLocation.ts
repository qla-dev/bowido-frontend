import { useCallback, useEffect, useRef, useState } from "react";

export type DeviceLocationStatus =
  | "idle"
  | "refining"
  | "acquired"
  | "denied"
  | "blocked"
  | "timeout"
  | "unsupported"
  | "error";

export type AccuracyLevel = "excellent" | "good" | "moderate" | "poor";
export type RefinementWarning =
  | "timeout_with_position"
  | "error_with_position"
  | null;

export type DeviceCoordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
};

type DeviceLocationState = {
  status: DeviceLocationStatus;
  coordinates: DeviceCoordinates | null;
  completionVersion: number;
  warning: RefinementWarning;
};

export const GPS_REFINEMENT_TIMEOUT_MS = 20_000;
export const EXCELLENT_ACCURACY_METERS = 20;

export const geolocationOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: GPS_REFINEMENT_TIMEOUT_MS,
  maximumAge: 0,
};

export const getAccuracyLevel = (accuracy?: number): AccuracyLevel | null => {
  if (accuracy === undefined || !Number.isFinite(accuracy)) return null;
  if (accuracy <= 20) return "excellent";
  if (accuracy <= 50) return "good";
  if (accuracy <= 100) return "moderate";
  return "poor";
};

const permissionIsBlocked = async () => {
  if (!navigator.permissions?.query) return false;
  try {
    const permission = await navigator.permissions.query({
      name: "geolocation",
    });
    return permission.state === "denied";
  } catch {
    return false;
  }
};

const toCoordinates = (
  position: GeolocationPosition,
): DeviceCoordinates | null => {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : undefined,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
  };
};

export const useDeviceLocation = () => {
  const [state, setState] = useState<DeviceLocationState>(() => ({
    status:
      typeof navigator === "undefined" || !navigator.geolocation
        ? "unsupported"
        : "idle",
    coordinates: null,
    completionVersion: 0,
    warning: null,
  }));
  const watchIdRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);
  const cycleRef = useRef(0);
  const activeRef = useRef(false);
  const bestRef = useRef<DeviceCoordinates | null>(null);

  const clearActiveWatch = useCallback(() => {
    activeRef.current = false;
    if (timeoutIdRef.current !== null) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    if (
      watchIdRef.current !== null &&
      typeof navigator !== "undefined" &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const finishWithBest = useCallback(
    (warning: RefinementWarning = null) => {
      const best = bestRef.current;
      clearActiveWatch();
      if (!best) return false;
      setState((current) => ({
        ...current,
        status: "acquired",
        coordinates: best,
        completionVersion: current.completionVersion + 1,
        warning,
      }));
      return true;
    },
    [clearActiveWatch],
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    void permissionIsBlocked().then((blocked) => {
      if (blocked) {
        setState((current) =>
          current.status === "idle"
            ? { ...current, status: "blocked" }
            : current,
        );
      }
    });
    return clearActiveWatch;
  }, [clearActiveWatch]);

  const stopRefinement = useCallback(() => {
    if (!activeRef.current) return;
    if (!finishWithBest()) {
      clearActiveWatch();
      setState((current) => ({ ...current, status: "idle", warning: null }));
    }
  }, [clearActiveWatch, finishWithBest]);

  const cancelRefinement = useCallback(() => {
    if (!activeRef.current) return;
    clearActiveWatch();
    cycleRef.current += 1;
    setState((current) => ({
      ...current,
      status: current.coordinates ? "acquired" : "idle",
      warning: null,
    }));
  }, [clearActiveWatch]);

  const startRefinement = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((current) => ({ ...current, status: "unsupported" }));
      return;
    }

    clearActiveWatch();
    const cycle = ++cycleRef.current;
    activeRef.current = true;
    bestRef.current = null;
    setState((current) => ({
      ...current,
      status: "refining",
      coordinates: null,
      warning: null,
    }));

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!activeRef.current || cycle !== cycleRef.current) return;
        const next = toCoordinates(position);
        if (!next) return;
        const currentBest = bestRef.current;
        const isBetter =
          !currentBest ||
          (next.accuracy !== undefined &&
            (currentBest.accuracy === undefined ||
              next.accuracy < currentBest.accuracy));
        if (!isBetter) return;

        bestRef.current = next;
        setState((current) => ({
          ...current,
          status: "refining",
          coordinates: next,
        }));
        if (
          next.accuracy !== undefined &&
          next.accuracy <= EXCELLENT_ACCURACY_METERS
        ) {
          finishWithBest();
        }
      },
      (error) => {
        if (!activeRef.current || cycle !== cycleRef.current) return;
        if (
          finishWithBest(
            error.code === error.TIMEOUT
              ? "timeout_with_position"
              : "error_with_position",
          )
        )
          return;
        clearActiveWatch();
        if (error.code === error.PERMISSION_DENIED) {
          void permissionIsBlocked().then((blocked) => {
            if (cycle === cycleRef.current) {
              setState((current) => ({
                ...current,
                status: blocked ? "blocked" : "denied",
              }));
            }
          });
          return;
        }
        setState((current) => ({
          ...current,
          status: error.code === error.TIMEOUT ? "timeout" : "error",
        }));
      },
      geolocationOptions,
    );

    watchIdRef.current = watchId;
    if (!activeRef.current) {
      navigator.geolocation.clearWatch(watchId);
      watchIdRef.current = null;
      return;
    }
    timeoutIdRef.current = window.setTimeout(() => {
      if (!activeRef.current || cycle !== cycleRef.current) return;
      if (!finishWithBest("timeout_with_position")) {
        clearActiveWatch();
        setState((current) => ({ ...current, status: "timeout" }));
      }
    }, GPS_REFINEMENT_TIMEOUT_MS);
  }, [clearActiveWatch, finishWithBest]);

  return {
    ...state,
    bestPosition: state.coordinates,
    accuracy: state.coordinates?.accuracy,
    isRefining: state.status === "refining",
    isSupported: state.status !== "unsupported",
    locationError: ["denied", "blocked", "timeout", "error"].includes(
      state.status,
    )
      ? state.status
      : null,
    accuracyLevel: getAccuracyLevel(state.coordinates?.accuracy),
    startRefinement,
    requestLocation: startRefinement,
    retry: startRefinement,
    stopRefinement,
    cancelRefinement,
  };
};
