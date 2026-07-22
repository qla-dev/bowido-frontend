import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GPS_REFINEMENT_TIMEOUT_MS,
  getAccuracyLevel,
  useDeviceLocation,
} from "../useDeviceLocation";

type Watch = { success: PositionCallback; error: PositionErrorCallback };
const watches = new Map<number, Watch>();
let nextWatchId = 1;
let clearWatch: ReturnType<typeof vi.fn>;
let watchPosition: ReturnType<typeof vi.fn>;

const position = (accuracy: number, latitude = 43.8563, longitude = 18.4131) =>
  ({
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  }) as GeolocationPosition;

const geolocationError = (code: number) =>
  ({
    code,
    message: "GPS failed",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  }) as GeolocationPositionError;

describe("useDeviceLocation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    watches.clear();
    nextWatchId = 1;
    clearWatch = vi.fn((id: number) => watches.delete(id));
    watchPosition = vi.fn(
      (success: PositionCallback, error: PositionErrorCallback) => {
        const id = nextWatchId++;
        watches.set(id, { success, error });
        return id;
      },
    );
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { watchPosition, clearWatch },
    });
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: { query: vi.fn().mockResolvedValue({ state: "prompt" }) },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("starts a high-accuracy watch and keeps only improving readings", () => {
    const { result } = renderHook(() => useDeviceLocation());
    act(() => result.current.startRefinement());
    expect(watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      },
    );

    act(() => watches.get(1)?.success(position(120, 43.1, 18.1)));
    expect(result.current.coordinates?.accuracy).toBe(120);
    act(() => watches.get(1)?.success(position(150, 44.1, 19.1)));
    expect(result.current.coordinates?.latitude).toBe(43.1);
    act(() => watches.get(1)?.success(position(45, 43.2, 18.2)));
    expect(result.current.coordinates?.accuracy).toBe(45);
    expect(result.current.status).toBe("refining");
  });

  it("stops immediately at excellent accuracy and finalizes once", () => {
    const { result } = renderHook(() => useDeviceLocation());
    act(() => result.current.startRefinement());
    act(() => watches.get(1)?.success(position(15)));

    expect(result.current.status).toBe("acquired");
    expect(result.current.completionVersion).toBe(1);
    expect(clearWatch).toHaveBeenCalledWith(1);
  });

  it("uses the best valid reading after the refinement timeout", () => {
    const { result } = renderHook(() => useDeviceLocation());
    act(() => result.current.startRefinement());
    act(() => watches.get(1)?.success(position(75)));
    act(() => vi.advanceTimersByTime(GPS_REFINEMENT_TIMEOUT_MS));

    expect(result.current.status).toBe("acquired");
    expect(result.current.coordinates?.accuracy).toBe(75);
    expect(result.current.warning).toBe("timeout_with_position");
    expect(result.current.completionVersion).toBe(1);
  });

  it("reports timeout when no valid reading was received", () => {
    const { result } = renderHook(() => useDeviceLocation());
    act(() => result.current.startRefinement());
    act(() => vi.advanceTimersByTime(GPS_REFINEMENT_TIMEOUT_MS));
    expect(result.current.status).toBe("timeout");
    expect(result.current.coordinates).toBeNull();
    expect(clearWatch).toHaveBeenCalledWith(1);
  });

  it("retains the best reading if the provider errors later", () => {
    const { result } = renderHook(() => useDeviceLocation());
    act(() => result.current.startRefinement());
    act(() => watches.get(1)?.success(position(60)));
    act(() => watches.get(1)?.error(geolocationError(2)));
    expect(result.current.status).toBe("acquired");
    expect(result.current.warning).toBe("error_with_position");
  });

  it("prevents duplicate active watchers and cleans up on unmount", () => {
    const { result, unmount } = renderHook(() => useDeviceLocation());
    act(() => result.current.startRefinement());
    act(() => result.current.startRefinement());
    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels an active watcher and classifies accuracy tiers", () => {
    const { result } = renderHook(() => useDeviceLocation());
    act(() => result.current.startRefinement());
    act(() => result.current.stopRefinement());
    expect(result.current.status).toBe("idle");
    expect(clearWatch).toHaveBeenCalledWith(1);
    expect(getAccuracyLevel(20)).toBe("excellent");
    expect(getAccuracyLevel(21)).toBe("good");
    expect(getAccuracyLevel(51)).toBe("moderate");
    expect(getAccuracyLevel(101)).toBe("poor");
  });
});
