import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "../../services/api";
import {
  clearReverseGeocodingCache,
  useReverseGeocoding,
} from "../useReverseGeocoding";

describe("useReverseGeocoding", () => {
  beforeEach(() => {
    clearReverseGeocodingCache();
    vi.restoreAllMocks();
  });

  it("debounces and resolves the selected coordinates", async () => {
    const reverseGeocode = vi
      .spyOn(apiService.locations, "reverseGeocode")
      .mockResolvedValue({
        latitude: 43.8563,
        longitude: 18.4131,
        formatted_address: "Titova 1, Sarajevo",
        provider: "geoapify",
      });
    const { result } = renderHook(() =>
      useReverseGeocoding(
        {
          latitude: 43.8563,
          longitude: 18.4131,
        },
        10,
      ),
    );

    expect(reverseGeocode).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.result?.formatted_address).toBe("Titova 1, Sarajevo");
    expect(reverseGeocode).toHaveBeenCalledTimes(1);
  });

  it("exposes a controlled API error state", async () => {
    vi.spyOn(apiService.locations, "reverseGeocode").mockRejectedValue(
      new Error("Address service unavailable"),
    );
    const { result } = renderHook(() =>
      useReverseGeocoding(
        {
          latitude: 43.8563,
          longitude: 18.4131,
        },
        10,
      ),
    );

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Address service unavailable");
  });

  it("ignores a stale response after the selected coordinates change", async () => {
    let resolveFirst:
      | ((
          value: Awaited<
            ReturnType<typeof apiService.locations.reverseGeocode>
          >,
        ) => void)
      | undefined;
    const reverseGeocode = vi
      .spyOn(apiService.locations, "reverseGeocode")
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        latitude: 44.2,
        longitude: 17.9,
        formatted_address: "New address",
        provider: "geoapify",
      });
    const { result, rerender } = renderHook(
      ({ coordinates }) => useReverseGeocoding(coordinates, 0),
      {
        initialProps: {
          coordinates: { latitude: 43.8563, longitude: 18.4131 },
        },
      },
    );
    await waitFor(() => expect(reverseGeocode).toHaveBeenCalledTimes(1));
    rerender({ coordinates: { latitude: 44.2, longitude: 17.9 } });
    await waitFor(() =>
      expect(result.current.result?.formatted_address).toBe("New address"),
    );
    resolveFirst?.({
      latitude: 43.8563,
      longitude: 18.4131,
      formatted_address: "Stale address",
      provider: "geoapify",
    });
    await Promise.resolve();
    expect(result.current.result?.formatted_address).toBe("New address");
  });

  it("does not repeat a request for materially identical rounded coordinates", async () => {
    const reverseGeocode = vi
      .spyOn(apiService.locations, "reverseGeocode")
      .mockResolvedValue({
        latitude: 43.8563,
        longitude: 18.4131,
        formatted_address: "Cached address",
        provider: "geoapify",
      });
    const { result, rerender } = renderHook(
      ({ coordinates }) => useReverseGeocoding(coordinates, 0),
      {
        initialProps: {
          coordinates: { latitude: 43.856301, longitude: 18.413101 },
        },
      },
    );
    await waitFor(() => expect(result.current.status).toBe("success"));
    rerender({ coordinates: { latitude: 43.856302, longitude: 18.413102 } });
    await Promise.resolve();
    expect(reverseGeocode).toHaveBeenCalledTimes(1);
  });
});
