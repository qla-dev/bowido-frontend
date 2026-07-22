import { useCallback, useEffect, useRef, useState } from "react";
import { apiService } from "../services/api";
import type { ReverseGeocodingResult } from "../types";

export type ReverseGeocodingStatus =
  | "idle"
  | "loading"
  | "success"
  | "error"
  | "offline";
type Coordinates = { latitude: number; longitude: number };

const resultCache = new Map<string, ReverseGeocodingResult>();
const pendingRequests = new Map<string, Promise<ReverseGeocodingResult>>();
const coordinateKey = (coordinates: Coordinates) =>
  `${coordinates.latitude.toFixed(5)},${coordinates.longitude.toFixed(5)}`;

export const clearReverseGeocodingCache = () => {
  resultCache.clear();
  pendingRequests.clear();
};

const reverseGeocodeOnce = (coordinates: Coordinates) => {
  const key = coordinateKey(coordinates);
  const cached = resultCache.get(key);
  if (cached) return Promise.resolve(cached);
  const pending = pendingRequests.get(key);
  if (pending) return pending;

  const request = apiService.locations
    .reverseGeocode(coordinates.latitude, coordinates.longitude)
    .then((result) => {
      resultCache.set(key, result);
      return result;
    })
    .finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, request);
  return request;
};

export const useReverseGeocoding = (
  coordinates: Coordinates | null,
  debounceMilliseconds = 650,
) => {
  const [status, setStatus] = useState<ReverseGeocodingStatus>("idle");
  const [result, setResult] = useState<ReverseGeocodingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;
    if (!coordinates) {
      setStatus("idle");
      setResult(null);
      setError(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setStatus("offline");
        setError("offline");
        return;
      }

      setStatus("loading");
      setError(null);
      void reverseGeocodeOnce(coordinates)
        .then((nextResult) => {
          if (requestVersion !== requestVersionRef.current) return;
          setResult(nextResult);
          setStatus("success");
        })
        .catch((requestError: unknown) => {
          if (requestVersion !== requestVersionRef.current) return;
          setError(
            requestError instanceof Error
              ? requestError.message
              : "reverse-geocoding-failed",
          );
          setStatus(
            typeof navigator !== "undefined" && !navigator.onLine
              ? "offline"
              : "error",
          );
        });
    }, debounceMilliseconds);

    return () => window.clearTimeout(timeoutId);
  }, [
    coordinates ? coordinateKey(coordinates) : null,
    debounceMilliseconds,
    retryVersion,
  ]);

  const retry = useCallback(
    () => setRetryVersion((version) => version + 1),
    [],
  );
  return { status, result, error, retry };
};
