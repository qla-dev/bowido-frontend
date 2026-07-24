import { useCallback, useEffect, useMemo, useState } from "react";
import L, { type LeafletMouseEvent } from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  CheckCircle2,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Search,
  RefreshCcw,
  TriangleAlert,
} from "lucide-react";
import { cn } from "./ui";
import { useDeviceLocation } from "../hooks/useDeviceLocation";
import { useReverseGeocoding } from "../hooks/useReverseGeocoding";
import { useAddressSearch } from "../hooks/useAddressSearch";
import type { AppLanguage } from "../i18n";
import type {
  DeliveryLocation,
  DeliveryLocationInput,
  ReverseGeocodingResult,
} from "../types";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type AddressFields = {
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
};

type AddressResult = Pick<
  ReverseGeocodingResult,
  "street" | "house_number" | "postal_code" | "city" | "formatted_address"
>;

const emptyAddressFields: AddressFields = {
  street: "",
  house_number: "",
  postal_code: "",
  city: "",
};

// Geo-coding providers sometimes classify a locality as a suburb or district
// and omit `street`. The first formatted address segment is the best editable
// address line in that case (for example, "Donja Jošanica").
const toAddressFields = (address?: Partial<AddressResult>): AddressFields => ({
  street:
    address?.street?.trim() ||
    address?.formatted_address?.split(",")[0]?.trim() ||
    "",
  house_number: address?.house_number?.trim() || "",
  postal_code: address?.postal_code?.trim() || "",
  city: address?.city?.trim() || "",
});

type DeliveryLocationMapProps = {
  palletId: number;
  language: AppLanguage;
  initialLocation?: DeliveryLocation;
  initialLocationIsSaved?: boolean;
  onSave: (
    palletId: number,
    input: DeliveryLocationInput,
  ) => Promise<DeliveryLocation>;
};

const fallbackMapCenter: [number, number] = [44.2, 17.9];
const deliveryMarkerIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const copy = {
  en: {
    title: "Delivery location",
    street: "Street",
    houseNumber: "House number",
    postalCode: "Postal code",
    city: "City",
    searchAddress: "Search full address",
    searchAddressPlaceholder: "Start typing an address, city or postcode",
    searchHint: "Choose a suggestion to fill the address and place it on the map.",
    searchingAddresses: "Searching addresses…",
    noAddresses: "No matching addresses found.",
    addressSearchError: "Address suggestions could not be loaded.",
    addressFieldsHint: "Complete any missing address details before saving.",
    refining: "Improving GPS accuracy… Keep the device still for a moment.",
    cancel: "Use best position",
    excellent: "Excellent",
    good: "Good",
    moderate: "Moderate",
    poor: "Poor",
    refinementWarning:
      "The best available position is shown. You can adjust the marker before saving.",
    explanation:
      "Select the exact destination. It will be stored only for this pallet delivery.",
    accessTitle: "Location access is needed",
    accessDetail:
      "Allow the browser to request your current GPS position. Nothing is saved until you confirm.",
    enable: "Enable location",
    loading: "Getting your location…",
    denied: "Location permission was denied.",
    blocked:
      "Allow location access for this site in your browser or device settings, then try again.",
    timeout: "Your GPS position could not be obtained in time.",
    unsupported: "This browser does not support device location.",
    locationError: "Your current location could not be obtained.",
    retry: "Try again",
    manual: "Choose on map",
    manualHint: "Tap the map to place the delivery marker.",
    findAgain: "Find my location again",
    accuracy: "GPS accuracy",
    lowAccuracy:
      "Wait a few seconds or move closer to a window. You can also move the marker manually.",
    resolving: "Resolving street address…",
    addressUnavailable:
      "No street address was found. The coordinates can still be saved.",
    reverseError: "The street address could not be loaded.",
    offline:
      "You appear to be offline. Coordinates can still be selected and saved when the connection returns.",
    coordinates: "Selected coordinates",
    save: "Save as delivery location",
    update: "Update delivery location",
    saving: "Saving…",
    saved: "Saved",
    saveSuccess: "Delivery location saved for this pallet.",
    saveError: "The delivery location could not be saved. Please try again.",
    choosePoint: "Choose a point before saving.",
  },
  nl: {
    title: "Afleverlocatie",
    street: "Straat",
    houseNumber: "Huisnummer",
    postalCode: "Postcode",
    city: "Plaats",
    searchAddress: "Zoek volledig adres",
    searchAddressPlaceholder: "Begin een adres, plaats of postcode te typen",
    searchHint: "Kies een suggestie om het adres in te vullen en op de kaart te plaatsen.",
    searchingAddresses: "Adressen zoeken…",
    noAddresses: "Geen overeenkomende adressen gevonden.",
    addressSearchError: "Adressuggesties konden niet worden geladen.",
    addressFieldsHint: "Vul ontbrekende adresgegevens aan voordat je opslaat.",
    refining: "GPS-nauwkeurigheid verbeteren… Houd het apparaat even stil.",
    cancel: "Beste positie gebruiken",
    excellent: "Uitstekend",
    good: "Goed",
    moderate: "Redelijk",
    poor: "Slecht",
    refinementWarning:
      "De best beschikbare positie wordt getoond. Je kunt de markering aanpassen.",
    explanation:
      "Kies de exacte bestemming. Deze wordt alleen voor deze boklevering opgeslagen.",
    accessTitle: "Locatietoegang is nodig",
    accessDetail:
      "Sta de browser toe je huidige GPS-positie op te vragen. Er wordt niets opgeslagen zonder bevestiging.",
    enable: "Locatie inschakelen",
    loading: "Locatie ophalen…",
    denied: "Locatietoegang is geweigerd.",
    blocked:
      "Sta locatie toe voor deze site in de browser- of apparaatinstellingen en probeer opnieuw.",
    timeout: "Je GPS-positie kon niet op tijd worden opgehaald.",
    unsupported: "Deze browser ondersteunt geen apparaatlocatie.",
    locationError: "Je huidige locatie kon niet worden opgehaald.",
    retry: "Opnieuw proberen",
    manual: "Kies op kaart",
    manualHint: "Tik op de kaart om de aflevermarkering te plaatsen.",
    findAgain: "Vind mijn locatie opnieuw",
    accuracy: "GPS-nauwkeurigheid",
    lowAccuracy:
      "Wacht enkele seconden of ga dichter bij een raam staan. Je kunt de markering ook handmatig verplaatsen.",
    resolving: "Straatadres opzoeken…",
    addressUnavailable:
      "Geen straatadres gevonden. De coördinaten kunnen wel worden opgeslagen.",
    reverseError: "Het straatadres kon niet worden geladen.",
    offline:
      "Je lijkt offline. Kies coördinaten en sla ze op zodra de verbinding terug is.",
    coordinates: "Geselecteerde coördinaten",
    save: "Opslaan als afleverlocatie",
    update: "Afleverlocatie bijwerken",
    saving: "Opslaan…",
    saved: "Opgeslagen",
    saveSuccess: "Afleverlocatie voor deze bok opgeslagen.",
    saveError: "De afleverlocatie kon niet worden opgeslagen. Probeer opnieuw.",
    choosePoint: "Kies een punt voordat je opslaat.",
  },
  bs: {
    title: "Lokacija dostave",
    street: "Ulica",
    houseNumber: "Kućni broj",
    postalCode: "Poštanski broj",
    city: "Grad",
    searchAddress: "Pretraži cijelu adresu",
    searchAddressPlaceholder: "Počnite unositi adresu, grad ili poštanski broj",
    searchHint: "Odaberite prijedlog da popunite adresu i prikažete je na mapi.",
    searchingAddresses: "Pretraživanje adresa…",
    noAddresses: "Nema pronađenih odgovarajućih adresa.",
    addressSearchError: "Prijedloge adresa nije moguće učitati.",
    addressFieldsHint: "Dopunite podatke adrese koji nedostaju prije čuvanja.",
    refining:
      "Poboljšavanje GPS preciznosti… Držite uređaj mirno nekoliko trenutaka.",
    cancel: "Koristi najbolju poziciju",
    excellent: "Odlična preciznost",
    good: "Dobra preciznost",
    moderate: "Srednja preciznost",
    poor: "Slaba preciznost",
    refinementWarning:
      "Prikazana je najbolja dostupna pozicija. Oznaku možete pomjeriti prije čuvanja.",
    explanation:
      "Odaberite tačno odredište. Lokacija će biti sačuvana samo za ovu dostavu palete.",
    accessTitle: "Potreban je pristup lokaciji",
    accessDetail:
      "Dozvolite pregledniku da zatraži trenutnu GPS poziciju. Ništa se ne čuva bez vaše potvrde.",
    enable: "Uključi lokaciju",
    loading: "Učitavanje lokacije…",
    denied: "Pristup lokaciji je odbijen.",
    blocked:
      "Omogućite lokaciju za ovu stranicu u postavkama preglednika ili uređaja, pa pokušajte ponovo.",
    timeout: "GPS pozicija nije pronađena na vrijeme.",
    unsupported: "Ovaj preglednik ne podržava lokaciju uređaja.",
    locationError: "Trenutnu lokaciju nije moguće pronaći.",
    retry: "Pokušaj ponovo",
    manual: "Odaberi na mapi",
    manualHint: "Dodirnite mapu da postavite oznaku dostave.",
    findAgain: "Ponovo pronađi moju lokaciju",
    accuracy: "GPS preciznost",
    lowAccuracy:
      "Sačekajte nekoliko sekundi ili se približite prozoru. Marker možete pomjeriti i ručno.",
    resolving: "Pronalaženje adrese…",
    addressUnavailable:
      "Adresa nije pronađena. Koordinate se ipak mogu sačuvati.",
    reverseError: "Adresu nije moguće učitati.",
    offline:
      "Izgleda da nema interneta. Odaberite koordinate i sačuvajte ih kada se veza vrati.",
    coordinates: "Odabrane koordinate",
    save: "Sačuvaj kao lokaciju dostave",
    update: "Ažuriraj lokaciju dostave",
    saving: "Čuvanje…",
    saved: "Sačuvano",
    saveSuccess: "Lokacija dostave je sačuvana za ovu paletu.",
    saveError: "Lokaciju dostave nije moguće sačuvati. Pokušajte ponovo.",
    choosePoint: "Odaberite tačku prije čuvanja.",
  },
} satisfies Record<AppLanguage, Record<string, string>>;

const MapViewport = ({
  center,
  recenterVersion,
}: {
  center: [number, number];
  recenterVersion: number;
}) => {
  const map = useMap();

  useEffect(() => {
    map.setView(center, Math.max(map.getZoom(), 16), { animate: true });
  }, [map, center[0], center[1], recenterVersion]);

  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => map.invalidateSize({ animate: false });
    const frame = window.requestAnimationFrame(invalidate);
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(invalidate)
        : null;
    observer?.observe(container);

    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [map]);

  return null;
};

const MapClickSelector = ({
  onSelect,
}: {
  onSelect: (coordinates: Coordinates) => void;
}) => {
  useMapEvents({
    click: (event: LeafletMouseEvent) =>
      onSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      }),
  });

  return null;
};

const coordinatesMatch = (left: Coordinates | null, right?: Coordinates) =>
  Boolean(
    left &&
      right &&
      Math.abs(left.latitude - right.latitude) < 0.0000001 &&
      Math.abs(left.longitude - right.longitude) < 0.0000001,
  );

export const DeliveryLocationMap = ({
  palletId,
  language,
  initialLocation,
  initialLocationIsSaved = true,
  onSave,
}: DeliveryLocationMapProps) => {
  const text = copy[language] || copy.en;
  const initialCoordinates = initialLocation
    ? {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      }
    : null;
  const [selectedCoordinates, setSelectedCoordinates] =
    useState<Coordinates | null>(initialCoordinates);
  const [geocodeCoordinates, setGeocodeCoordinates] =
    useState<Coordinates | null>(null);
  const [savedLocation, setSavedLocation] = useState<
    DeliveryLocation | undefined
  >(initialLocationIsSaved ? initialLocation : undefined);
  const [displayedAddress, setDisplayedAddress] = useState(
    initialLocation?.formatted_address || "",
  );
  const [addressFields, setAddressFields] = useState<AddressFields>(() =>
    toAddressFields(initialLocation),
  );
  const [manualMapEnabled, setManualMapEnabled] = useState(
    Boolean(initialLocation),
  );
  const [recenterVersion, setRecenterVersion] = useState(0);
  const [capturedAt, setCapturedAt] = useState(
    initialLocation?.captured_at || new Date().toISOString(),
  );
  const [selectedAccuracy, setSelectedAccuracy] = useState<number | undefined>(
    initialLocation?.accuracy_meters,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [addressSearchInput, setAddressSearchInput] = useState("");
  const deviceLocation = useDeviceLocation();
  const reverseGeocoding = useReverseGeocoding(geocodeCoordinates);
  const addressSearch = useAddressSearch(addressSearchInput);

  useEffect(() => {
    setSavedLocation(initialLocationIsSaved ? initialLocation : undefined);
    setSelectedCoordinates(initialCoordinates);
    setGeocodeCoordinates(null);
    setDisplayedAddress(initialLocation?.formatted_address || "");
    setAddressFields(toAddressFields(initialLocation));
    setManualMapEnabled(Boolean(initialLocation));
    setCapturedAt(initialLocation?.captured_at || new Date().toISOString());
    setSelectedAccuracy(initialLocation?.accuracy_meters);
    setSaveError("");
    setSaveMessage("");
    setAddressSearchInput("");
  }, [palletId]);

  useEffect(() => {
    if (!deviceLocation.coordinates) {
      return;
    }

    setSelectedCoordinates({
      latitude: deviceLocation.coordinates.latitude,
      longitude: deviceLocation.coordinates.longitude,
    });
    setCapturedAt(deviceLocation.coordinates.capturedAt);
    setSelectedAccuracy(deviceLocation.coordinates.accuracy);
    setDisplayedAddress("");
    setAddressFields(emptyAddressFields);
    setManualMapEnabled(true);
    setSaveError("");
    setSaveMessage("");
    setRecenterVersion((version) => version + 1);
  }, [deviceLocation.coordinates?.capturedAt]);

  useEffect(() => {
    if (!deviceLocation.completionVersion || !deviceLocation.coordinates)
      return;
    setGeocodeCoordinates({
      latitude: deviceLocation.coordinates.latitude,
      longitude: deviceLocation.coordinates.longitude,
    });
  }, [deviceLocation.completionVersion]);

  useEffect(() => {
    if (reverseGeocoding.result) {
      setDisplayedAddress(reverseGeocoding.result.formatted_address || "");
      setAddressFields(toAddressFields(reverseGeocoding.result));
    }
  }, [reverseGeocoding.result]);

  const selectCoordinates = useCallback(
    (coordinates: Coordinates) => {
      deviceLocation.cancelRefinement();
      setSelectedCoordinates(coordinates);
      setGeocodeCoordinates(coordinates);
      setSelectedAccuracy(undefined);
      setCapturedAt(new Date().toISOString());
      setDisplayedAddress("");
      setAddressFields(emptyAddressFields);
      setSaveError("");
      setSaveMessage("");
    },
    [deviceLocation.cancelRefinement],
  );

  const selectAddressSuggestion = useCallback(
    (suggestion: ReverseGeocodingResult) => {
      deviceLocation.cancelRefinement();
      setSelectedCoordinates({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
      });
      setGeocodeCoordinates(null);
      setSelectedAccuracy(undefined);
      setCapturedAt(new Date().toISOString());
      setDisplayedAddress(suggestion.formatted_address || "");
      setAddressFields(toAddressFields(suggestion));
      setManualMapEnabled(true);
      setAddressSearchInput("");
      setSaveError("");
      setSaveMessage("");
      setRecenterVersion((version) => version + 1);
    },
    [deviceLocation.cancelRefinement],
  );

  const mapCenter = useMemo<[number, number]>(
    () =>
      selectedCoordinates
        ? [selectedCoordinates.latitude, selectedCoordinates.longitude]
        : fallbackMapCenter,
    [selectedCoordinates?.latitude, selectedCoordinates?.longitude],
  );
  const savedAddressFields = useMemo(
    () => toAddressFields(savedLocation),
    [savedLocation],
  );
  const hasUnsavedChanges =
    !coordinatesMatch(selectedCoordinates, savedLocation) ||
    Boolean(
      savedLocation &&
        (addressFields.street !== savedAddressFields.street ||
          addressFields.house_number !== savedAddressFields.house_number ||
          addressFields.postal_code !== savedAddressFields.postal_code ||
          addressFields.city !== savedAddressFields.city),
    );
  const isLowAccuracy = deviceLocation.accuracyLevel === "poor";
  const accuracyTone =
    deviceLocation.accuracyLevel === "poor"
      ? "bg-rose-50 text-rose-800 dark:bg-rose-400/10 dark:text-rose-200"
      : deviceLocation.accuracyLevel === "moderate"
        ? "bg-amber-50 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200"
        : deviceLocation.accuracyLevel === "good"
          ? "bg-lime-50 text-lime-800 dark:bg-lime-400/10 dark:text-lime-200"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200";
  const canSave =
    Boolean(selectedCoordinates) &&
    !isSaving &&
    !deviceLocation.isRefining &&
    (hasUnsavedChanges || !savedLocation);

  const handleSave = async () => {
    if (!selectedCoordinates) {
      setSaveError(text.choosePoint);
      return;
    }

    if (isSaving || !canSave) {
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const nextLocation = await onSave(palletId, {
        latitude: selectedCoordinates.latitude,
        longitude: selectedCoordinates.longitude,
        accuracy_meters: selectedAccuracy,
        captured_at: capturedAt,
        street: addressFields.street.trim(),
        house_number: addressFields.house_number.trim(),
        postal_code: addressFields.postal_code.trim(),
        city: addressFields.city.trim(),
      });
      setSavedLocation(nextLocation);
      setDisplayedAddress(nextLocation.formatted_address || displayedAddress);
      setAddressFields(toAddressFields(nextLocation));
      setSaveMessage(text.saveSuccess);
    } catch (error) {
      setSaveError(
        error instanceof Error && error.message
          ? error.message
          : text.saveError,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const locationFailureText =
    deviceLocation.status === "blocked"
      ? text.blocked
      : deviceLocation.status === "denied"
        ? text.denied
        : deviceLocation.status === "timeout"
          ? text.timeout
          : deviceLocation.status === "unsupported"
            ? text.unsupported
            : text.locationError;
  const showLocationFailure = [
    "blocked",
    "denied",
    "timeout",
    "unsupported",
    "error",
  ].includes(deviceLocation.status);

  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-emerald-100 bg-white/92 shadow-sm dark:border-white/10 dark:bg-[#101715]/92">
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
            {text.title}
          </p>
          <p className="mt-1.5 text-[12px] font-semibold leading-5 text-zinc-500 dark:text-zinc-300">
            {text.explanation}
          </p>
        </div>
        {savedLocation && !hasUnsavedChanges && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
            <CheckCircle2 size={13} />
            {text.saved}
          </span>
        )}
      </div>

      <div className="relative z-[600] px-4 pb-3">
        <label className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-100">
          {text.searchAddress}
          <span className="relative mt-1.5 block">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-200"
            />
            {addressSearch.status === "loading" && (
              <LoaderCircle
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-emerald-600 dark:text-emerald-200"
              />
            )}
            <input
              type="search"
              value={addressSearchInput}
              onChange={(event) => setAddressSearchInput(event.target.value)}
              placeholder={text.searchAddressPlaceholder}
              className="h-11 w-full rounded-xl border border-emerald-100 bg-white py-2 pl-9 pr-9 text-[12px] font-semibold normal-case tracking-normal text-emerald-950 outline-none placeholder:text-zinc-400 focus:border-emerald-400 dark:border-white/10 dark:bg-[#101715] dark:text-white"
            />
          </span>
        </label>
        {addressSearchInput.trim().length >= 3 && (
          <div className="absolute left-4 right-4 top-[4.7rem] overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-xl dark:border-white/10 dark:bg-[#101715]">
            {addressSearch.status === "loading" && (
              <p className="px-3 py-3 text-[11px] font-bold text-zinc-500 dark:text-zinc-300">
                {text.searchingAddresses}
              </p>
            )}
            {addressSearch.status === "success" && addressSearch.results.length === 0 && (
              <p className="px-3 py-3 text-[11px] font-bold text-zinc-500 dark:text-zinc-300">
                {text.noAddresses}
              </p>
            )}
            {["error", "offline"].includes(addressSearch.status) && (
              <p role="alert" className="px-3 py-3 text-[11px] font-bold text-rose-700 dark:text-rose-200">
                {text.addressSearchError}
              </p>
            )}
            {addressSearch.results.map((suggestion, index) => (
              <button
                key={`${suggestion.latitude}-${suggestion.longitude}-${index}`}
                type="button"
                onClick={() => selectAddressSuggestion(suggestion)}
                className="flex w-full items-start gap-2 border-t border-emerald-50 px-3 py-2.5 text-left transition-colors first:border-t-0 hover:bg-emerald-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-200" />
                <span className="text-[12px] font-bold leading-5 text-emerald-950 dark:text-white">
                  {suggestion.formatted_address || [suggestion.street, suggestion.house_number, suggestion.postal_code, suggestion.city].filter(Boolean).join(", ")}
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[10px] font-semibold leading-4 text-zinc-500 dark:text-zinc-300">
          {text.searchHint}
        </p>
      </div>

      {!manualMapEnabled && !selectedCoordinates ? (
        <div className="mx-3 mb-3 flex min-h-[240px] flex-col items-center justify-center rounded-[1.35rem] bg-emerald-50/70 px-5 py-6 text-center dark:bg-[#151d1a]">
          {deviceLocation.isRefining ? (
            <>
              <LoaderCircle
                size={34}
                className="animate-spin text-emerald-600 dark:text-emerald-200"
              />
              <p className="mt-4 text-[14px] font-black text-emerald-950 dark:text-white">
                {text.refining}
              </p>
              <button
                type="button"
                onClick={deviceLocation.stopRefinement}
                className="mt-4 text-[11px] font-black uppercase text-emerald-700 underline dark:text-emerald-200"
              >
                {text.cancel}
              </button>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm dark:bg-white/10 dark:text-emerald-200">
                {showLocationFailure ? (
                  <TriangleAlert size={27} />
                ) : (
                  <MapPin size={27} />
                )}
              </div>
              <p className="mt-4 text-[15px] font-black text-emerald-950 dark:text-white">
                {showLocationFailure ? locationFailureText : text.accessTitle}
              </p>
              <p className="mt-2 max-w-xs text-[12px] font-semibold leading-5 text-zinc-500 dark:text-zinc-300">
                {showLocationFailure &&
                ["blocked", "denied"].includes(deviceLocation.status)
                  ? text.blocked
                  : text.accessDetail}
              </p>
              <div className="mt-5 grid w-full max-w-xs grid-cols-1 gap-2 sm:grid-cols-2">
                {deviceLocation.status !== "unsupported" && (
                  <button
                    type="button"
                    onClick={deviceLocation.requestLocation}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] bg-[#00A655] px-4 py-3 text-[11px] font-black uppercase tracking-[0.11em] text-white transition-transform active:scale-[0.98]"
                  >
                    <LocateFixed size={16} />
                    {showLocationFailure ? text.retry : text.enable}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setManualMapEnabled(true)}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-[0.9rem] bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.11em] text-emerald-700 shadow-sm transition-transform active:scale-[0.98] dark:bg-white/10 dark:text-emerald-100"
                >
                  <MapPin size={16} />
                  {text.manual}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="delivery-location-map relative isolate mx-3 h-[clamp(230px,32dvh,290px)] min-h-[230px] overflow-hidden rounded-[1.35rem] bg-emerald-50 dark:bg-[#151d1a]">
            <MapContainer
              center={mapCenter}
              zoom={selectedCoordinates ? 17 : 7}
              scrollWheelZoom
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapViewport
                center={mapCenter}
                recenterVersion={recenterVersion}
              />
              <MapClickSelector onSelect={selectCoordinates} />
              {deviceLocation.coordinates?.accuracy && (
                <Circle
                  center={[
                    deviceLocation.coordinates.latitude,
                    deviceLocation.coordinates.longitude,
                  ]}
                  radius={deviceLocation.coordinates.accuracy}
                  pathOptions={{
                    color: "#00A655",
                    fillColor: "#10b981",
                    fillOpacity: 0.12,
                    weight: 1.5,
                  }}
                />
              )}
              {selectedCoordinates && (
                <Marker
                  position={[
                    selectedCoordinates.latitude,
                    selectedCoordinates.longitude,
                  ]}
                  icon={deliveryMarkerIcon}
                  draggable
                  eventHandlers={{
                    dragend: (event) => {
                      const marker = event.target as L.Marker;
                      const position = marker.getLatLng();
                      selectCoordinates({
                        latitude: position.lat,
                        longitude: position.lng,
                      });
                    },
                  }}
                />
              )}
            </MapContainer>

            <button
              type="button"
              onClick={deviceLocation.requestLocation}
              disabled={deviceLocation.isRefining}
              aria-label={text.findAgain}
              title={text.findAgain}
              className="absolute right-3 top-3 z-[500] flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-700 shadow-lg transition-transform active:scale-95 disabled:opacity-60 dark:bg-[#101715] dark:text-emerald-100"
            >
              {deviceLocation.isRefining ? (
                <LoaderCircle size={20} className="animate-spin" />
              ) : (
                <LocateFixed size={20} />
              )}
            </button>

            {!selectedCoordinates && (
              <div className="pointer-events-none absolute inset-x-4 bottom-5 z-[500] rounded-xl bg-white/95 px-3 py-2 text-center text-[11px] font-black text-emerald-800 shadow-md dark:bg-[#101715]/95 dark:text-emerald-100">
                {text.manualHint}
              </div>
            )}
          </div>

          <div className="px-4 pb-4 pt-3">
            {deviceLocation.isRefining && (
              <div
                role="status"
                className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-800 dark:bg-sky-400/10 dark:text-sky-200"
              >
                <span className="flex items-center gap-2">
                  <LoaderCircle size={14} className="animate-spin" />
                  {text.refining}
                </span>
                <button
                  type="button"
                  onClick={deviceLocation.stopRefinement}
                  className="shrink-0 uppercase underline"
                >
                  {text.cancel}
                </button>
              </div>
            )}
            {deviceLocation.coordinates?.accuracy !== undefined && (
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[11px] font-bold",
                  accuracyTone,
                )}
              >
                <span>{text.accuracy}</span>
                <span>
                  {text[deviceLocation.accuracyLevel || "poor"]} ·{" "}
                  {Math.round(deviceLocation.coordinates.accuracy)} m
                </span>
              </div>
            )}
            {isLowAccuracy && (
              <p className="mt-2 text-[11px] font-semibold leading-4 text-amber-700 dark:text-amber-200">
                {text.lowAccuracy}
              </p>
            )}
            {deviceLocation.warning && (
              <p className="mt-2 text-[11px] font-semibold leading-4 text-amber-700 dark:text-amber-200">
                {text.refinementWarning}
              </p>
            )}

            {selectedCoordinates && (
              <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-3 dark:bg-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-emerald-600 dark:text-emerald-200">
                  {reverseGeocoding.status === "loading"
                    ? text.resolving
                    : text.title}
                </p>
                {reverseGeocoding.status === "loading" ? (
                  <div className="mt-2 flex items-center gap-2 text-[12px] font-bold text-zinc-500 dark:text-zinc-300">
                    <LoaderCircle size={15} className="animate-spin" />
                    {text.resolving}
                  </div>
                ) : (
                  <p className="mt-1.5 text-[13px] font-black leading-5 text-emerald-950 dark:text-white">
                    {displayedAddress || text.addressUnavailable}
                  </p>
                )}
                <p className="mt-3 text-[10px] font-bold leading-4 text-zinc-500 dark:text-zinc-300">
                  {text.addressFieldsHint}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["street", text.street],
                      ["house_number", text.houseNumber],
                      ["postal_code", text.postalCode],
                      ["city", text.city],
                    ] as const
                  ).map(([field, label]) => (
                    <label
                      key={field}
                      className="min-w-0 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-300"
                    >
                      {label}
                      <input
                        type="text"
                        value={addressFields[field]}
                        disabled={reverseGeocoding.status === "loading"}
                        onChange={(event) => {
                          setAddressFields((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }));
                          setSaveError("");
                          setSaveMessage("");
                        }}
                        className="mt-1.5 h-10 w-full min-w-0 rounded-[0.7rem] border border-emerald-100 bg-white px-2.5 text-[12px] font-bold normal-case tracking-normal text-emerald-950 outline-none focus:border-emerald-400 disabled:opacity-50 dark:border-white/10 dark:bg-[#101715] dark:text-white"
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[10px] font-bold text-zinc-400 dark:text-zinc-400">
                  {text.coordinates}: {selectedCoordinates.latitude.toFixed(7)},{" "}
                  {selectedCoordinates.longitude.toFixed(7)}
                </p>
                {["error", "offline"].includes(reverseGeocoding.status) && (
                  <div className="mt-2 flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-800 dark:bg-amber-400/10 dark:text-amber-200">
                    <span>
                      {reverseGeocoding.status === "offline"
                        ? text.offline
                        : text.reverseError}
                    </span>
                    <button
                      type="button"
                      onClick={reverseGeocoding.retry}
                      className="shrink-0 uppercase underline"
                    >
                      {text.retry}
                    </button>
                  </div>
                )}
              </div>
            )}

            {saveError && (
              <p
                role="alert"
                className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200"
              >
                {saveError}
              </p>
            )}
            {saveMessage && (
              <p
                role="status"
                className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"
              >
                <CheckCircle2 size={15} />
                {saveMessage}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                "mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-[11px] font-black uppercase tracking-[0.1em] transition-transform active:scale-[0.99]",
                canSave
                  ? "bg-[#00A655] text-white shadow-[0_10px_24px_-14px_rgba(0,166,85,0.8)]"
                  : "bg-emerald-100 text-emerald-500 dark:bg-white/10 dark:text-white/35",
              )}
            >
              {isSaving ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : savedLocation ? (
                <RefreshCcw size={16} />
              ) : (
                <MapPin size={16} />
              )}
              {isSaving
                ? text.saving
                : savedLocation
                  ? hasUnsavedChanges
                    ? text.update
                    : text.saved
                  : text.save}
            </button>

            <p className="mt-3 text-center text-[9px] font-semibold leading-4 text-zinc-400 dark:text-zinc-500">
              Map data ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                OpenStreetMap contributors
              </a>{" "}
              · Address data ©{" "}
              <a
                href="https://www.geoapify.com/"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Geoapify
              </a>
            </p>
          </div>
        </>
      )}
    </section>
  );
};
