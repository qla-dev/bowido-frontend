import { useEffect, useRef, useState } from "react";
import { apiService } from "../services/api";
import type { ReverseGeocodingResult } from "../types";

export type AddressSearchStatus = "idle" | "loading" | "success" | "error" | "offline";

const resultCache = new Map<string, ReverseGeocodingResult[]>();
const pendingRequests = new Map<string, Promise<ReverseGeocodingResult[]>>();

export const clearAddressSearchCache = () => {
  resultCache.clear();
  pendingRequests.clear();
};

const searchOnce = (query: string) => {
  const cached = resultCache.get(query);
  if (cached) return Promise.resolve(cached);
  const pending = pendingRequests.get(query);
  if (pending) return pending;

  const request = apiService.locations.searchAddress(query).then((results) => {
    resultCache.set(query, results);
    return results;
  }).finally(() => pendingRequests.delete(query));
  pendingRequests.set(query, request);
  return request;
};

export const useAddressSearch = (input: string, debounceMilliseconds = 300) => {
  const query = input.trim().replace(/\s+/g, " ");
  const [status, setStatus] = useState<AddressSearchStatus>("idle");
  const [results, setResults] = useState<ReverseGeocodingResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const requestVersion = ++requestVersionRef.current;
    if (query.length < 3) {
      setStatus("idle");
      setResults([]);
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
      void searchOnce(query)
        .then((nextResults) => {
          if (requestVersion !== requestVersionRef.current) return;
          setResults(nextResults);
          setStatus("success");
        })
        .catch((requestError: unknown) => {
          if (requestVersion !== requestVersionRef.current) return;
          setResults([]);
          setError(requestError instanceof Error ? requestError.message : "address-search-failed");
          setStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error");
        });
    }, debounceMilliseconds);

    return () => window.clearTimeout(timeoutId);
  }, [query, debounceMilliseconds]);

  return { status, results, error };
};
