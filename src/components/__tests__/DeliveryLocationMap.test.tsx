import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeliveryLocation } from "../../types";
import { apiService } from "../../services/api";
import { clearReverseGeocodingCache } from "../../hooks/useReverseGeocoding";

const leafletMocks = vi.hoisted(() => ({
  mapClickHandler: null as
    | null
    | ((event: { latlng: { lat: number; lng: number } }) => void),
  draggedPosition: { lat: 45.1234567, lng: 16.7654321 },
}));

vi.mock("leaflet", () => ({
  default: {
    Icon: class {},
    Marker: class {},
  },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Circle: () => <div data-testid="accuracy-circle" />,
  Marker: ({
    eventHandlers,
  }: {
    eventHandlers: { dragend: (event: unknown) => void };
  }) => (
    <button
      type="button"
      data-testid="delivery-marker"
      onClick={() =>
        eventHandlers.dragend({
          target: { getLatLng: () => leafletMocks.draggedPosition },
        })
      }
    />
  ),
  useMap: () => ({
    setView: vi.fn(),
    getZoom: () => 17,
    invalidateSize: vi.fn(),
    getContainer: () => document.createElement("div"),
  }),
  useMapEvents: (handlers: typeof leafletMocks) => {
    leafletMocks.mapClickHandler = (
      handlers as unknown as { click: typeof leafletMocks.mapClickHandler }
    ).click;
    return null;
  },
}));

import { DeliveryLocationMap } from "../DeliveryLocationMap";

const savedLocation: DeliveryLocation = {
  id: 1,
  pallet_id: 12,
  latitude: 43.8563,
  longitude: 18.4131,
  accuracy_meters: 8,
  formatted_address: "Titova 1, Sarajevo",
  provider: "geoapify",
  source: "device_gps",
  confirmed_by_user: true,
  created_by_user_id: 1,
  captured_at: "2026-07-22T10:00:00.000Z",
  created_at: "2026-07-22T10:00:00.000Z",
  updated_at: "2026-07-22T10:00:00.000Z",
};

type GeolocationCallbacks = {
  success?: PositionCallback;
  error?: PositionErrorCallback;
};

const callbacks: GeolocationCallbacks = {};

const installGeolocation = (permissionState: PermissionState = "prompt") => {
  const watchPosition = vi.fn(
    (success: PositionCallback, error?: PositionErrorCallback | null) => {
      callbacks.success = success;
      callbacks.error = error || undefined;
      return 41;
    },
  );
  const clearWatch = vi.fn();

  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition, clearWatch },
  });
  Object.defineProperty(navigator, "permissions", {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: permissionState }) },
  });

  return { watchPosition, clearWatch };
};

const gpsPosition = {
  coords: {
    latitude: 43.8563,
    longitude: 18.4131,
    accuracy: 12,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({}),
  },
  timestamp: Date.now(),
  toJSON: () => ({}),
} as GeolocationPosition;

describe("DeliveryLocationMap", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearReverseGeocodingCache();
    vi.spyOn(apiService.locations, "reverseGeocode").mockImplementation(
      async (latitude, longitude) => ({
        latitude,
        longitude,
        formatted_address: "Resolved test address",
        street: "Test Street",
        postal_code: "71000",
        city: "Sarajevo",
        provider: "geoapify",
      }),
    );
    callbacks.success = undefined;
    callbacks.error = undefined;
    leafletMocks.mapClickHandler = null;
    installGeolocation();
  });

  it("renders the disabled state and requests device permission", async () => {
    const { watchPosition, clearWatch } = installGeolocation();
    render(
      <DeliveryLocationMap palletId={12} language="bs" onSave={vi.fn()} />,
    );

    expect(
      screen.getByText("Potreban je pristup lokaciji"),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Uključi lokaciju" }),
    );
    expect(watchPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      },
    );

    act(() => callbacks.success?.(gpsPosition));

    expect(await screen.findByTestId("delivery-marker")).toBeInTheDocument();
    expect(clearWatch).toHaveBeenCalledWith(41);
    expect(screen.getByText(/43\.8563000, 18\.4131000/)).toBeInTheDocument();
    expect(screen.getByText(/12 m/)).toBeInTheDocument();
  });

  it("handles permission denial and provides retry plus manual fallback", async () => {
    installGeolocation("denied");
    render(
      <DeliveryLocationMap palletId={12} language="en" onSave={vi.fn()} />,
    );

    await waitFor(() =>
      expect(
        screen.getAllByText(/Allow location access for this site/).length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose on map" }),
    ).toBeInTheDocument();
  });

  it("allows a map click and marker drag to adjust coordinates", async () => {
    render(
      <DeliveryLocationMap
        palletId={12}
        language="en"
        initialLocation={savedLocation}
        onSave={vi.fn()}
      />,
    );

    act(() =>
      leafletMocks.mapClickHandler?.({ latlng: { lat: 44.1, lng: 17.2 } }),
    );
    expect(screen.getByText(/44\.1000000, 17\.2000000/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("delivery-marker"));
    expect(screen.getByText(/45\.1234567, 16\.7654321/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Update delivery location/ }),
    ).toBeEnabled();
    await waitFor(() =>
      expect(apiService.locations.reverseGeocode).toHaveBeenCalledWith(
        45.1234567,
        16.7654321,
      ),
    );
    expect(apiService.locations.reverseGeocode).toHaveBeenCalledTimes(1);
  });

  it("does not reverse-geocode intermediate readings and resolves the final best position once", async () => {
    render(
      <DeliveryLocationMap palletId={12} language="en" onSave={vi.fn()} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Enable location" }),
    );

    act(() =>
      callbacks.success?.({
        ...gpsPosition,
        coords: { ...gpsPosition.coords, accuracy: 140 },
      }),
    );
    act(() =>
      callbacks.success?.({
        ...gpsPosition,
        coords: { ...gpsPosition.coords, accuracy: 65 },
      }),
    );
    expect(apiService.locations.reverseGeocode).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Use best position" }),
    );
    await waitFor(() =>
      expect(apiService.locations.reverseGeocode).toHaveBeenCalledTimes(1),
    );
  });

  it("warns about poor final accuracy without blocking an explicit save", async () => {
    render(
      <DeliveryLocationMap palletId={12} language="bs" onSave={vi.fn()} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Uključi lokaciju" }),
    );
    act(() =>
      callbacks.success?.({
        ...gpsPosition,
        coords: { ...gpsPosition.coords, accuracy: 140 },
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Koristi najbolju poziciju" }),
    );

    expect(screen.getByText(/Sačekajte nekoliko sekundi/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sačuvaj kao lokaciju dostave" }),
    ).toBeEnabled();
  });

  it("submits selected coordinates once and shows the saved state", async () => {
    let resolveSave: ((location: DeliveryLocation) => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<DeliveryLocation>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<DeliveryLocationMap palletId={12} language="en" onSave={onSave} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Enable location" }),
    );
    act(() => callbacks.success?.(gpsPosition));
    expect(await screen.findByDisplayValue("Test Street")).toBeInTheDocument();
    expect(screen.getByDisplayValue("71000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Sarajevo")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("House number"), "12A");
    const saveButton = await screen.findByRole("button", {
      name: "Save as delivery location",
    });

    fireEvent.click(saveButton);
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      12,
      expect.objectContaining({
        latitude: 43.8563,
        longitude: 18.4131,
        accuracy_meters: 12,
        street: "Test Street",
        house_number: "12A",
        postal_code: "71000",
        city: "Sarajevo",
      }),
    );

    await act(async () => resolveSave?.(savedLocation));

    expect(
      screen.getByText("Delivery location saved for this pallet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("renders an existing saved delivery location when reopened", () => {
    render(
      <DeliveryLocationMap
        palletId={12}
        language="nl"
        initialLocation={savedLocation}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Opgeslagen").length).toBeGreaterThan(0);
    expect(screen.getByText(/43\.8563000, 18\.4131000/)).toBeInTheDocument();
    expect(screen.getByTestId("delivery-marker")).toBeInTheDocument();
  });
});
