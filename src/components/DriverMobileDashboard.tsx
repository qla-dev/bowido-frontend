import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  History,
  MapPin,
  PackageSearch,
  RefreshCcw,
  Search,
} from "lucide-react";
import { useApp } from "../AppContext";
import { ClientDetail, Pallet, RoleType, User } from "../types";
import { Card, cn } from "./ui";
import { DriverModalShell } from "./DriverModalShell";
import { DriverPalletSummaryCard } from "./DriverPalletSummaryCard";
import { DeliveryLocationMap } from "./DeliveryLocationMap";
import {
  NoQrReturnFormModal,
  getNoQrReturnButtonCopy,
} from "./NoQrReturnFormModal";
import { getLocationLabel, getPalletTypeLabel, getStatusLabel } from "../i18n";
import { findPalletByScannedQr } from "../lib/palletQrMatching";
import { getPalletDisplayName } from "../lib/palletDisplay";
import {
  decodeQrFromImageBitmap,
  decodeQrFromVideo,
} from "../lib/videoQrDecoder";
import { apiService } from "../services/api";
import { statusIdAllowsCustomer } from "../lib/palletCustomerAssignment";

interface DriverMobileDashboardProps {
  user: User;
  selectedPalletId?: number | null;
  onSelectedPalletIdChange?: (palletId: number | null) => void;
}

type DriverBadgeVariant = "default" | "info" | "warning" | "success" | "danger";
type CameraState =
  | "loading"
  | "ready"
  | "preview"
  | "unsupported"
  | "denied"
  | "error";
type CameraZoomRange = { min: number; max: number; step: number };
type ConfirmationPrompt = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "success" | "warning";
  onConfirm: () => void;
};
type CameraZoomCapabilities = MediaTrackCapabilities & {
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
};
type CameraZoomSettings = MediaTrackSettings & { zoom?: number };

type ZoomableMediaTrack = MediaStreamTrack & {
  applyConstraints: (
    constraints: MediaTrackConstraints & {
      advanced?: Array<MediaTrackConstraintSet & { zoom?: number }>;
    },
  ) => Promise<void>;
};

interface DetectedCode {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect: (source: ImageBitmapSource) => Promise<DetectedCode[]>;
}

interface BarcodeDetectorConstructorLike {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

type OpenChangeMenu = "client" | "status" | "location" | "gps" | null;
type DriverLocationMode = "warehouse_1" | "warehouse_2" | "delivery";

const DEFAULT_CAMERA_ZOOM_RANGE: CameraZoomRange = {
  min: 1,
  max: 3,
  step: 0.1,
};

const clampDriverCameraZoom = (
  value: number,
  range = DEFAULT_CAMERA_ZOOM_RANGE,
) => Math.min(range.max, Math.max(range.min, Number(value.toFixed(2))));

const getPinchDistance = (touches: TouchList) => {
  const firstTouch = touches.item(0);
  const secondTouch = touches.item(1);

  if (!firstTouch || !secondTouch) {
    return 0;
  }

  return Math.hypot(
    firstTouch.clientX - secondTouch.clientX,
    firstTouch.clientY - secondTouch.clientY,
  );
};

const bowidoWarehouseDirectory = {
  warehouse1: "Maxwellstraat 2-4, 3316 GP Dordrecht",
  warehouse2: "Nikole Tesle 71",
};

const SERVICE_ADDRESS = "Nikole Tesle 71, 74000 Doboj";
const DRIVER_STATUS_SLUG_ORDER = [
  "bij-de-klant",
  "ophalen-klant",
  "bih-nl-transport",
  "nl-bih-transport",
  "bowido-nl",
  "bowido-bih",
  "service",
] as const;

const formatWarehouseAddress = (
  street?: string,
  houseNumber?: string,
  postalCode?: string,
  city?: string,
) => {
  const streetLine = [street, houseNumber].filter(Boolean).join(" ").trim();
  const localityLine = [postalCode, city].filter(Boolean).join(" ").trim();

  return [streetLine, localityLine].filter(Boolean).join(", ");
};

const getClientWarehouseAddress = (
  client: ClientDetail | undefined,
  warehouse: 1 | 2,
) =>
  warehouse === 1
    ? formatWarehouseAddress(
        client?.warehouse1_street,
        client?.warehouse1_house_number,
        client?.warehouse1_postal_code,
        client?.warehouse1_city,
      )
    : formatWarehouseAddress(
        client?.warehouse2_street,
        client?.warehouse2_house_number,
        client?.warehouse2_postal_code,
        client?.warehouse2_city,
      );

const getDeliveryLocationAddress = (pallet?: Pallet | null) => {
  const location = pallet?.delivery_location;

  if (!location) {
    return "";
  }

  return (
    formatWarehouseAddress(
      location.street,
      location.house_number,
      location.postal_code,
      location.city,
    ) ||
    location.formatted_address ||
    ""
  );
};

type DriverCopy = {
  title: string;
  resultLabel: string;
  palletNameLabel: string;
  palletTypeLabel: string;
  currentStatus: string;
  changeLabel: string;
  changeStatus: string;
  capturePalletPhoto: string;
  reportDamage: string;
  scanNext: string;
  summaryType: string;
  summaryClient: string;
  summaryLocation: string;
  clientEmpty: string;
  emptyStatus: string;
  selectClient: string;
  searchClientPlaceholder: string;
  noClientsFound: string;
  scannedPallets: string;
  historyPallets: string;
  showAll: string;
  back: string;
  liveDot: string;
  statusUpdatedTitle: string;
  statusSavedDetailAtClient: string;
  statusSavedDetailReturn: string;
  statusSavedDetailTransport: string;
  statusSavedDetailWarehouse: string;
  statusSavedDetailRepair: string;
  damageReportedTitle: string;
  damageReportedDetail: string;
  damageModalTitle: string;
  damageModalDescription: string;
  damageModalPhoto: string;
  damageModalPlaceholder: string;
  damageModalUpload: string;
  damageModalCancel: string;
  damageModalSubmit: string;
  damageModalRemove: string;
  scanImageFallbackTitle: string;
  scanImageFallbackDetail: string;
  scanImageNotRecognizedTitle: string;
  scanImageNotRecognizedDetail: string;
  warehouseDefault: string;
  warehouseSecondary: string;
  newLocation: string;
  noWarehouseSecondary: string;
  gpsLocation: string;
  useGpsLocation: string;
  updateGpsLocation: string;
};

const driverCopy: Record<"en" | "nl" | "bs", DriverCopy> = {
  en: {
    title: "Scan QR code",
    resultLabel: "Scanned pallet",
    palletNameLabel: "Pallet",
    palletTypeLabel: "Type",
    currentStatus: "Current status",
    changeLabel: "Change",
    changeStatus: "Change status",
    capturePalletPhoto: "PHOTOGRAPH PALLET",
    reportDamage: "REPORT DAMAGE",
    scanNext: "Scan next pallet",
    summaryType: "Type",
    summaryClient: "Client",
    summaryLocation: "Location",
    clientEmpty: "No client",
    emptyStatus: "No status",
    selectClient: "Select client",
    searchClientPlaceholder: "Search client",
    noClientsFound: "No clients found",
    scannedPallets: "Scanned pallets",
    historyPallets: "Pallet history",
    showAll: "View all",
    back: "Back",
    liveDot: "Live camera",
    statusUpdatedTitle: "Status updated",
    statusSavedDetailAtClient: "The pallet is marked at the client.",
    statusSavedDetailReturn: "The pallet is marked for customer pickup.",
    statusSavedDetailTransport: "The pallet is marked in transport.",
    statusSavedDetailWarehouse: "The pallet is marked at Bowido warehouse.",
    statusSavedDetailRepair: "The pallet is marked in repair.",
    damageReportedTitle: "Damage reported",
    damageReportedDetail: "The damage report is saved for this pallet.",
    damageModalTitle: "Report damage",
    damageModalDescription: "Damage description",
    damageModalPhoto: "Attach photo",
    damageModalPlaceholder: "Write what is damaged on the pallet",
    damageModalUpload: "Add photo",
    damageModalCancel: "Cancel",
    damageModalSubmit: "Save report",
    damageModalRemove: "Remove",
    scanImageFallbackTitle: "Test scan",
    scanImageFallbackDetail: "Upload a QR image to match database pallets.",
    scanImageNotRecognizedTitle: "QR not recognized",
    scanImageNotRecognizedDetail:
      "This QR code is not linked to a pallet in the database.",
    warehouseDefault: "Warehouse 1",
    warehouseSecondary: "Warehouse 2",
    newLocation: "Delivery address",
    noWarehouseSecondary: "No warehouse 2",
    gpsLocation: "GPS location",
    useGpsLocation: "Use GPS location",
    updateGpsLocation: "Update GPS location",
  },
  nl: {
    title: "Scan QR code",
    resultLabel: "Gescande bok",
    palletNameLabel: "Boknummer",
    palletTypeLabel: "Type",
    currentStatus: "Huidige status",
    changeLabel: "Wijzig",
    changeStatus: "Status wijzigen",
    capturePalletPhoto: "Foto maken",
    reportDamage: "SCHADE MELDEN",
    scanNext: "Scan volgende",
    summaryType: "Type",
    summaryClient: "Klant",
    summaryLocation: "Locatie",
    clientEmpty: "Geen klant",
    emptyStatus: "Geen status",
    selectClient: "Klant kiezen",
    searchClientPlaceholder: "Zoek klant",
    noClientsFound: "Geen klanten gevonden",
    scannedPallets: "Gescande bokken",
    historyPallets: "Bokgeschiedenis",
    showAll: "Toon alles",
    back: "Terug",
    liveDot: "Live camera",
    statusUpdatedTitle: "Status bijgewerkt",
    statusSavedDetailAtClient: "De bok staat nu bij de klant.",
    statusSavedDetailReturn: "De bok is gemarkeerd voor ophalen bij de klant.",
    statusSavedDetailTransport: "De bok staat nu in transport.",
    statusSavedDetailWarehouse: "De bok staat nu in Bowido magazijn.",
    statusSavedDetailRepair: "De bok staat nu in reparatie.",
    damageReportedTitle: "Schade gemeld",
    damageReportedDetail: "De schademelding is opgeslagen voor deze bok.",
    damageModalTitle: "Schade melden",
    damageModalDescription: "Omschrijving schade",
    damageModalPhoto: "Foto toevoegen",
    damageModalPlaceholder: "Beschrijf wat er beschadigd is aan de bok",
    damageModalUpload: "Foto toevoegen",
    damageModalCancel: "Annuleren",
    damageModalSubmit: "Melding opslaan",
    damageModalRemove: "Verwijderen",
    scanImageFallbackTitle: "Testscan",
    scanImageFallbackDetail:
      "Upload een QR-afbeelding om databasebokken te vinden.",
    scanImageNotRecognizedTitle: "QR niet herkend",
    scanImageNotRecognizedDetail:
      "Deze QR-code is niet gekoppeld aan een bok in de database.",
    warehouseDefault: "Magazijn 1",
    warehouseSecondary: "Magazijn 2",
    newLocation: "Afleveradres",
    noWarehouseSecondary: "Geen magazijn 2",
    gpsLocation: "GPS-locatie",
    useGpsLocation: "GPS-locatie gebruiken",
    updateGpsLocation: "GPS-locatie bijwerken",
  },
  bs: {
    title: "Scan QR code",
    resultLabel: "Skenirana paleta",
    palletNameLabel: "Paleta",
    palletTypeLabel: "Tip",
    currentStatus: "Trenutni status",
    changeLabel: "Promijeni",
    changeStatus: "Promijeni status",
    capturePalletPhoto: "USLIKAJ PALETU",
    reportDamage: "PRIJAVI OŠTEĆENJE",
    scanNext: "Skeniraj sljedeću",
    summaryType: "Tip",
    summaryClient: "Klijent",
    summaryLocation: "Lokacija",
    clientEmpty: "Bez klijenta",
    emptyStatus: "Bez statusa",
    selectClient: "Odaberi klijenta",
    searchClientPlaceholder: "Pretraži klijenta",
    noClientsFound: "Nema pronađenih klijenata",
    scannedPallets: "Skenirane palete",
    historyPallets: "Historija paleta",
    showAll: "Prikaži sve",
    back: "Nazad",
    liveDot: "Live kamera",
    statusUpdatedTitle: "Status ažuriran",
    statusSavedDetailAtClient: "Paleta je označena kod klijenta.",
    statusSavedDetailReturn: "Paleta je označena za preuzimanje kod klijenta.",
    statusSavedDetailTransport: "Paleta je označena u transportu.",
    statusSavedDetailWarehouse: "Paleta je označena u Bowido magacinu.",
    statusSavedDetailRepair: "Paleta je označena za reparaciju.",
    damageReportedTitle: "Šteta prijavljena",
    damageReportedDetail: "Prijava štete je sačuvana za ovu paletu.",
    damageModalTitle: "Prijavi štetu",
    damageModalDescription: "Opis oštećenja",
    damageModalPhoto: "Priloži sliku",
    damageModalPlaceholder: "Napiši šta je oštećeno na paleti",
    damageModalUpload: "Dodaj sliku",
    damageModalCancel: "Odustani",
    damageModalSubmit: "Sačuvaj prijavu",
    damageModalRemove: "Ukloni",
    scanImageFallbackTitle: "Test skeniranje",
    scanImageFallbackDetail: "Ucitaj QR sliku za pretragu paleta iz baze.",
    scanImageNotRecognizedTitle: "QR nije prepoznat",
    scanImageNotRecognizedDetail: "Ovaj QR kod nije povezan s paletom u bazi.",
    warehouseDefault: "Magacin 1",
    warehouseSecondary: "Magacin 2",
    newLocation: "Adresa dostave",
    noWarehouseSecondary: "Nema magacina 2",
    gpsLocation: "GPS lokacija",
    useGpsLocation: "Koristi GPS lokaciju",
    updateGpsLocation: "Ažuriraj GPS lokaciju",
  },
};

const driverDateLocales = {
  en: "en-GB",
  nl: "nl-NL",
  bs: "bs-BA",
} as const;

const driverReturnWindowCopy = {
  en: {
    sentAt: "Sent",
    returnDue: "Return by",
    reportedAt: "Reported on",
    deadlineStatus: "Deadline",
    withinDeadline: "Within deadline",
    overdue: "Overdue",
    daysLeft: "days left",
    daysLate: "days late",
  },
  nl: {
    sentAt: "Verzonden",
    returnDue: "Retour",
    reportedAt: "Gemeld op",
    deadlineStatus: "Termijn",
    withinDeadline: "Binnen termijn",
    overdue: "Over tijd",
    daysLeft: "dagen over",
    daysLate: "dagen te laat",
  },
  bs: {
    sentAt: "Poslana",
    returnDue: "Povrat do",
    reportedAt: "Prijavljeno",
    deadlineStatus: "Rok",
    withinDeadline: "U roku",
    overdue: "Van roka",
    daysLeft: "dana do isteka",
    daysLate: "dana van roka",
  },
} as const;

const driverTransportWindowCopy = {
  en: {
    startedAt: "Started",
    dueBy: "Due by",
    laneBihToNl: "BiH -> NL",
    laneNlToBih: "NL -> BiH",
  },
  nl: {
    startedAt: "Verzonden",
    dueBy: "Aankomst",
    laneBihToNl: "BiH -> NL",
    laneNlToBih: "NL -> BiH",
  },
  bs: {
    startedAt: "Početak",
    dueBy: "Završiti do",
    laneBihToNl: "BiH -> NL",
    laneNlToBih: "NL -> BiH",
  },
} as const;

const transportStatusIds = [2, 6];

const getPalletColorTheme = () => {
  return {
    surface: "bg-white/92 dark:bg-[#101715]/92",
    softSurface: "bg-white/72 dark:bg-[#20372c]/72",
    strongSurface: "bg-slate-200/70 dark:bg-slate-700/45",
    border: "border-slate-300/80 dark:border-slate-400/28",
    label: "text-slate-600 dark:text-slate-300",
    heading: "text-slate-900 dark:text-white",
    body: "text-slate-700 dark:text-slate-200",
    button:
      "bg-slate-200/88 text-slate-700 dark:bg-slate-700/55 dark:text-slate-100",
    buttonHover: "hover:text-slate-900 dark:hover:text-white",
  };
};

const getDriverPalletTypeLabel = (
  type: string,
  language: "en" | "nl" | "bs",
) => {
  return getPalletTypeLabel(type, language);
};

export const DriverMobileDashboard: React.FC<DriverMobileDashboardProps> = ({
  user,
  selectedPalletId: controlledSelectedPalletId,
  onSelectedPalletIdChange,
}) => {
  const {
    pallets,
    clients,
    deletePallet,
    updatePalletStatus,
    savePalletDeliveryLocation,
    statuses,
    language,
  } = useApp();
  const [isScanning, setIsScanning] = useState(false);
  const [internalSelectedPalletId, setInternalSelectedPalletId] = useState<
    number | null
  >(null);
  const selectedPalletId =
    controlledSelectedPalletId === undefined
      ? internalSelectedPalletId
      : controlledSelectedPalletId;
  const setSelectedPalletId = (palletId: number | null) => {
    setInternalSelectedPalletId(palletId);
    onSelectedPalletIdChange?.(palletId);
  };
  const [palletPhoto, setPalletPhoto] = useState<File | null>(null);
  const [palletPhotoUrl, setPalletPhotoUrl] = useState<string | null>(null);
  const [damagePhotoUrl, setDamagePhotoUrl] = useState<string | null>(null);
  const [damageDescription, setDamageDescription] = useState("");
  const [scannedPalletIds, setScannedPalletIds] = useState<number[]>([]);
  const [isScannedPalletsModalOpen, setIsScannedPalletsModalOpen] =
    useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [isNoQrReturnFormOpen, setIsNoQrReturnFormOpen] = useState(false);
  const [isNoQrPickupListOpen, setIsNoQrPickupListOpen] = useState(false);
  const [isRepairListOpen, setIsRepairListOpen] = useState(false);
  const [confirmationPrompt, setConfirmationPrompt] =
    useState<ConfirmationPrompt | null>(null);
  const [noQrClientSearch, setNoQrClientSearch] = useState("");
  const [activeScannedPalletId, setActiveScannedPalletId] = useState<
    number | null
  >(null);
  const [openChangeMenu, setOpenChangeMenu] = useState<OpenChangeMenu>(null);
  const [draftStatusId, setDraftStatusId] = useState<number>(4);
  const [draftClientId, setDraftClientId] = useState<number | undefined>(
    undefined,
  );
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [draftLocationMode, setDraftLocationMode] =
    useState<DriverLocationMode>("warehouse_1");
  const [cameraState, setCameraState] = useState<CameraState>("loading");
  const [cameraZoom, setCameraZoom] = useState(DEFAULT_CAMERA_ZOOM_RANGE.min);
  const [cameraZoomRange, setCameraZoomRange] = useState<CameraZoomRange>(
    DEFAULT_CAMERA_ZOOM_RANGE,
  );
  const [isCameraHardwareZoomSupported, setIsCameraHardwareZoomSupported] =
    useState(false);
  const [flashMessage, setFlashMessage] = useState<{
    title: string;
    detail: string;
    variant: DriverBadgeVariant;
  } | null>(null);

  const scanIndexRef = useRef(-1);
  const flashTimeoutRef = useRef<number | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const scanAssistTimeoutRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanImageInputRef = useRef<HTMLInputElement | null>(null);
  const palletPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const damagePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const palletPhotoUrlRef = useRef<string | null>(null);
  const palletPhotoUploadedRef = useRef(false);
  const damagePhotoUrlRef = useRef<string | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const palletsRef = useRef(pallets);
  const scanBusyRef = useRef(false);
  const lastScanAttemptAtRef = useRef(0);
  const lastScanAtRef = useRef(0);
  const pinchStateRef = useRef<{ distance: number; zoom: number } | null>(null);
  const suppressNextScannerClickRef = useRef(false);
  const selectedPalletIdRef = useRef<number | null>(null);

  const text = driverCopy[language] || driverCopy.en;
  const noQrReturnCopy = getNoQrReturnButtonCopy(language);
  const allDriverPallets = pallets;
  const isScannerOpen = selectedPalletId === null;
  const showNoQrReturnAction = user.role_name === RoleType.KLIJENT;
  const showNoQrPickupAction =
    user.role_name === RoleType.VOZAC || user.role_name === RoleType.ADMIN;
  const showRepairListAction = user.role_name === RoleType.SERVISER;
  const noQrPickupCopy =
    language === "bs"
      ? {
          buttonTitle: "Palete bez QR koda",
          buttonText: "Pregled prijavljenih paleta spremnih za preuzimanje.",
          title: "Prijavljene palete bez QR koda",
          subtitle: "Preuzimanje kod kupaca",
          search: "Pretraži po imenu klijenta",
          pallet: "Paleta",
          location: "Lokacija",
          pickup: "Datum preuzimanja",
          comment: "Komentar",
          returned: "Paleta vraćena",
          direct: "Odmah preuzeti",
          empty: "Nema prijavljenih paleta bez QR koda.",
          confirm: "Označiti paletu kao vraćenu? Zapis će biti uklonjen.",
        }
      : language === "nl"
        ? {
            buttonTitle: "Bokken zonder QR-code",
            buttonText:
              "Bekijk gemelde bokken die klaarstaan om opgehaald te worden.",
            title: "Gemelde bokken zonder QR-code",
            subtitle: "Ophalen bij klanten",
            search: "Zoek op klantnaam",
            pallet: "Bok",
            location: "Locatie",
            pickup: "Ophaaldatum",
            comment: "Commentaar",
            returned: "Bok opgehaald",
            direct: "Direct ophalen",
            empty: "Geen gemelde bokken zonder QR-code.",
            confirm: "Bok als opgehaald markeren? De melding wordt verwijderd.",
          }
        : {
            buttonTitle: "Pallets without QR code",
            buttonText: "View reported pallets that are ready for pickup.",
            title: "Reported pallets without QR code",
            subtitle: "Client pickups",
            search: "Search by client name",
            pallet: "Pallet",
            location: "Location",
            pickup: "Pickup date",
            comment: "Comment",
            returned: "Pallet returned",
            direct: "Direct pickup",
            empty: "No pallets without a QR code have been reported.",
            confirm:
              "Mark this pallet as returned? The report will be removed.",
          };
  const repairListCopy =
    language === "bs"
      ? {
          buttonTitle: "Palete za popravak",
          buttonText: "Pregled paleta prijavljenih za servis prije skeniranja.",
          title: "Palete prijavljene za popravak",
          pallet: "Paleta",
          location: "Lokacija",
          type: "Tip",
          note: "Napomena",
          repaired: "Označi kao popravljeno",
          empty: "Nema paleta prijavljenih za popravak.",
          confirm: "Označiti paletu kao popravljenu?",
          successTitle: "Paleta popravljena",
          successDetail: "Paleta je vraćena iz servisa.",
        }
      : language === "nl"
        ? {
            buttonTitle: "Bokken voor reparatie",
            buttonText:
              "Bekijk bokken die voor service zijn gemeld voor het scannen.",
            title: "Bokken gemeld voor reparatie",
            pallet: "Bok",
            location: "Locatie",
            type: "Type",
            note: "Opmerking",
            repaired: "Als gerepareerd markeren",
            empty: "Geen bokken gemeld voor reparatie.",
            confirm: "Bok als gerepareerd markeren?",
            successTitle: "Bok gerepareerd",
            successDetail: "De bok is teruggezet uit service.",
          }
        : {
            buttonTitle: "Pallets for repair",
            buttonText: "View pallets reported for service before scanning.",
            title: "Pallets reported for repair",
            pallet: "Pallet",
            location: "Location",
            type: "Type",
            note: "Note",
            repaired: "Mark as repaired",
            empty: "No pallets have been reported for repair.",
            confirm: "Mark this pallet as repaired?",
            successTitle: "Pallet repaired",
            successDetail: "The pallet has been returned from service.",
          };
  const repairPallets = pallets.filter(
    (pallet) => pallet.is_active && pallet.current_status_slug === "service",
  );
  const noQrPickupPallets = pallets.filter(
    (pallet) =>
      pallet.is_ghost &&
      pallet.is_active &&
      (pallet.client_name || "")
        .toLowerCase()
        .includes(noQrClientSearch.trim().toLowerCase()),
  );
  const getNoQrNoteValue = (note: string | undefined, labels: string[]) => {
    if (!note) {
      return "";
    }

    const segment = note
      .split("|")
      .map((item) => item.trim())
      .find((item) =>
        labels.some((label) =>
          item.toLowerCase().startsWith(label.toLowerCase()),
        ),
      );

    return segment?.split(":").slice(1).join(":").trim() || "";
  };
  const getNoQrPickupLabel = (pallet: Pallet) =>
    getNoQrNoteValue(pallet.note, [
      "Available for pickup",
      "Beschikbaar voor het ophalen",
      "Dostupno za preuzimanje",
    ]) || noQrPickupCopy.direct;
  const getNoQrCommentLabel = (pallet: Pallet) => {
    const structuredComment = getNoQrNoteValue(pallet.note, [
      "Comment",
      "Commentaar",
      "Komentar",
    ]);
    if (structuredComment) {
      return structuredComment;
    }

    const legacyComment = (pallet.note || "")
      .split("|")
      .map((item) => item.trim())
      .filter(
        (item) =>
          item &&
          ![
            "Submitted from mobile no-QR form",
            "Verstuurd via mobiel formulier zonder QR",
            "Poslano preko mobilne no-QR forme",
          ].includes(item) &&
          ![
            "Available for pickup",
            "Beschikbaar voor het ophalen",
            "Dostupno za preuzimanje",
          ].some((label) =>
            item.toLowerCase().startsWith(label.toLowerCase()),
          ) &&
          !["Location", "Locatie", "Lokacija"].some((label) =>
            item.toLowerCase().startsWith(label.toLowerCase()),
          ),
      )
      .join(" | ");

    return legacyComment || "-";
  };
  const selectedPallet = selectedPalletId
    ? allDriverPallets.find((item) => item.id === selectedPalletId) || null
    : null;
  const driverStatusOptions = DRIVER_STATUS_SLUG_ORDER.map((slug) =>
    statuses.find((item) => item.slug === slug),
  ).filter((status): status is NonNullable<typeof status> => Boolean(status));
  const scannedPallets = scannedPalletIds
    .map((palletId) => allDriverPallets.find((item) => item.id === palletId))
    .filter((item): item is Pallet => Boolean(item));
  const historyPallets =
    user.role_name === RoleType.ADMIN && scannedPallets.length === 0
      ? allDriverPallets.filter((item) => item.is_active)
      : scannedPallets;
  const activeScannedPallet =
    historyPallets.find((item) => item.id === activeScannedPalletId) ||
    historyPallets[0] ||
    null;
  const damageTargetPallet = selectedPallet || activeScannedPallet;
  const actionButtonClass =
    "flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[0.58rem] font-black uppercase leading-[1.05] tracking-[0.14em] text-white transition-colors active:scale-[0.99]";
  const modalNavButtonClass =
    "flex h-full w-full items-center justify-center gap-2 rounded-xl px-3 text-center text-[0.72rem] font-black uppercase tracking-[0.14em] text-white transition-colors active:scale-[0.99]";
  const changeTriggerClass =
    "inline-flex h-11 items-center gap-1.5 rounded-full bg-emerald-50 px-4 text-[11.5px] font-black uppercase leading-none tracking-[0.14em] text-emerald-700 transition-all active:scale-[0.98] hover:text-emerald-900 dark:bg-white/10 dark:text-emerald-100 dark:hover:bg-white/14 dark:hover:text-white";
  const getVisibleClientName = (statusId: number, clientName?: string) =>
    statusIdAllowsCustomer(statuses, statusId)
      ? clientName || text.clientEmpty
      : null;
  const shouldShowLocationForStatus = (statusId?: number) =>
    !transportStatusIds.includes(statusId ?? -1);
  const getDriverStatusLabel = (statusName?: string) => {
    if (!statusName) {
      return text.emptyStatus;
    }

    if (statusName === "Bowido BIH") {
      return "Bowido BIH";
    }

    if (statusName === "Transport BiH/NL") {
      return "Transport BIH -> NL";
    }

    if (statusName === "Transport (NL/BiH)") {
      return "Transport NL -> BIH";
    }

    if (statusName === "Bowido(NL)") {
      return "Bowido NL";
    }

    return getStatusLabel(statusName, language);
  };
  const getLocationMeta = (mode: DriverLocationMode, clientId?: number) => {
    const client = clients.find((item) => item.user_id === clientId);
    const warehouse1Address = getClientWarehouseAddress(client, 1);
    const warehouse2Address = getClientWarehouseAddress(client, 2);

    switch (mode) {
      case "warehouse_2":
        return { label: text.warehouseSecondary, address: warehouse2Address };
      case "delivery":
        return {
          label: text.newLocation,
          address: getDeliveryLocationAddress(selectedPallet),
        };
      default:
        return { label: text.warehouseDefault, address: warehouse1Address };
    }
  };
  const activeLocationClientId = statusIdAllowsCustomer(statuses, draftStatusId)
    ? draftClientId
    : undefined;
  const isClientChangeDisabled = !statusIdAllowsCustomer(
    statuses,
    draftStatusId,
  );
  const selectedLocationMeta = getLocationMeta(
    draftLocationMode,
    activeLocationClientId,
  );
  const warehouse2Address = getLocationMeta(
    "warehouse_2",
    activeLocationClientId,
  ).address;
  const hasWarehouse2 = Boolean(warehouse2Address);
  const savedDeliveryLocationAddress =
    getDeliveryLocationAddress(selectedPallet);
  const draftStatus = statuses.find((status) => status.id === draftStatusId);
  const fixedWarehouseLocationMeta =
    draftStatus?.slug === "bowido-nl"
      ? {
          label: "Maxwellstraat 2-4",
          address: "3316 GP Dordrecht",
        }
      : draftStatus?.slug === "bowido-bih"
        ? {
            label: "Nikole Tesle 71",
            address: "",
          }
        : draftStatus?.slug === "service"
          ? {
              label: getDriverStatusLabel(draftStatus.name),
              address: SERVICE_ADDRESS,
            }
          : null;
  const selectedClientName = statusIdAllowsCustomer(statuses, draftStatusId)
    ? clients.find((client) => client.user_id === draftClientId)?.name ||
      selectedPallet?.client_name ||
      text.clientEmpty
    : null;
  const returnWindowText =
    driverReturnWindowCopy[language] || driverReturnWindowCopy.en;
  const transportWindowText =
    driverTransportWindowCopy[language] || driverTransportWindowCopy.en;
  const getClientStatusInfo = (pallet: Pallet | null, clientId?: number) => {
    if (!pallet) {
      return null;
    }

    const sentDate = new Date(pallet.last_status_changed_at);
    const dateFormatter = new Intl.DateTimeFormat(
      driverDateLocales[language] || "en-GB",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );
    const clientDetail = clientId
      ? clients.find((client) => client.user_id === clientId)
      : undefined;

    if (!clientDetail) {
      return {
        statusChangedAtLabel: dateFormatter.format(sentDate),
        dueDateLabel: null,
        deadlineLabel: returnWindowText.deadlineStatus,
        deadlineText: null,
        isOverdue: false,
      };
    }

    const sentAtMidnight = new Date(
      sentDate.getFullYear(),
      sentDate.getMonth(),
      sentDate.getDate(),
    );
    const today = new Date();
    const todayAtMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceSent = Math.max(
      0,
      Math.floor(
        (todayAtMidnight.getTime() - sentAtMidnight.getTime()) / msPerDay,
      ),
    );
    const dueDate = new Date(sentAtMidnight);
    dueDate.setDate(dueDate.getDate() + clientDetail.grace_period_days);
    const remainingDays = clientDetail.grace_period_days - daysSinceSent;
    const isOverdue = remainingDays < 0;

    return {
      statusChangedAtLabel: dateFormatter.format(sentDate),
      dueDateLabel: dateFormatter.format(dueDate),
      deadlineLabel: returnWindowText.deadlineStatus,
      deadlineText: isOverdue
        ? language === "bs"
          ? `${Math.abs(remainingDays)} dana`
          : `${Math.abs(remainingDays)} ${returnWindowText.daysLate}`
        : `${remainingDays} ${returnWindowText.daysLeft}`,
      isOverdue,
    };
  };
  const getTransportWindowInfo = (pallet: Pallet | null) => {
    if (!pallet || !transportStatusIds.includes(pallet.current_status_id)) {
      return null;
    }

    const transportStatus = statuses.find(
      (item) => item.id === pallet.current_status_id,
    );
    const counterDays = transportStatus?.grace_period_days || 3;
    const startedAt = new Date(pallet.last_status_changed_at);
    const startedAtMidnight = new Date(
      startedAt.getFullYear(),
      startedAt.getMonth(),
      startedAt.getDate(),
    );
    const today = new Date();
    const todayAtMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysInTransport = Math.max(
      0,
      Math.floor(
        (todayAtMidnight.getTime() - startedAtMidnight.getTime()) / msPerDay,
      ),
    );
    const dueDate = new Date(startedAtMidnight);
    dueDate.setDate(dueDate.getDate() + counterDays);
    const remainingDays = counterDays - daysInTransport;
    const isOverdue = remainingDays < 0;
    const dateFormatter = new Intl.DateTimeFormat(
      driverDateLocales[language] || "en-GB",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );

    return {
      laneLabel:
        pallet.current_status_id === 2
          ? transportWindowText.laneBihToNl
          : transportWindowText.laneNlToBih,
      startedAtLabel: dateFormatter.format(startedAt),
      dueDateLabel: dateFormatter.format(dueDate),
      deadlineLabel: returnWindowText.deadlineStatus,
      deadlineText: isOverdue
        ? language === "bs"
          ? `${Math.abs(remainingDays)} dana`
          : `${Math.abs(remainingDays)} ${returnWindowText.daysLate}`
        : `${remainingDays} ${returnWindowText.daysLeft}`,
      isOverdue,
    };
  };
  const clientStatusInfo = statusIdAllowsCustomer(
    statuses,
    selectedPallet?.current_status_id,
  )
    ? getClientStatusInfo(selectedPallet, selectedPallet.user_id)
    : null;
  const transportWindowInfo = getTransportWindowInfo(selectedPallet);
  const selectedPalletTheme = getPalletColorTheme();
  const isTransportStatus = ["bih-nl-transport", "nl-bih-transport"].includes(
    selectedPallet?.current_status_slug || "",
  );
  const isRepairStatus = draftStatus?.slug === "service";
  const isLocationChangeDisabled =
    isTransportStatus || Boolean(fixedWarehouseLocationMeta);
  const isWarehouseStatus = ["bowido-bih", "bowido-nl"].includes(
    selectedPallet?.current_status_slug || "",
  );
  const isCheckInStatus = ["bowido-bih", "bowido-nl", "service"].includes(
    selectedPallet?.current_status_slug || "",
  );
  const shouldShowPalletPhotoAction = user.role_name !== RoleType.KLIJENT;
  const shouldTopAlignSummaryCard = [
    "bowido-bih",
    "bowido-nl",
    "ophalen-klant",
    "service",
  ].includes(draftStatus?.slug || "");
  const transportLocationLabel =
    language === "nl"
      ? "Onderweg"
      : language === "bs"
        ? "Na putu"
        : "In transport";
  const showSelectedLocationSummary = Boolean(selectedPallet);
  const warehouseCheckInDateLabel = selectedPallet
    ? new Intl.DateTimeFormat(driverDateLocales[language] || "en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(selectedPallet.last_status_changed_at))
    : "";
  const filteredClients = (() => {
    const query = clientSearchTerm.trim().toLocaleLowerCase();

    if (!query) {
      return clients;
    }

    return clients
      .filter(
        (client) =>
          client.name.toLocaleLowerCase().includes(query) ||
          client.country.toLocaleLowerCase().includes(query) ||
          client.user_id.toString().includes(query),
      )
      .sort((left, right) => {
        const leftStartsWith = left.name.toLocaleLowerCase().startsWith(query);
        const rightStartsWith = right.name
          .toLocaleLowerCase()
          .startsWith(query);

        if (leftStartsWith !== rightStartsWith) {
          return leftStartsWith ? -1 : 1;
        }

        return left.name.localeCompare(
          right.name,
          driverDateLocales[language] || "en-GB",
          { sensitivity: "base" },
        );
      });
  })();
  const changeModalTitle =
    openChangeMenu === "status"
      ? text.changeStatus
      : openChangeMenu === "client"
        ? text.summaryClient
        : openChangeMenu === "location"
          ? text.summaryLocation
          : openChangeMenu === "gps"
            ? text.gpsLocation
            : "";
  const isFullscreenModalOpen = Boolean(
    openChangeMenu || isDamageModalOpen || isScannedPalletsModalOpen,
  );
  const showDamageModalNavActions = isDamageModalOpen;
  const isDamageReportSubmitDisabled =
    !damagePhotoUrl || !damageDescription.trim();

  useEffect(() => {
    palletsRef.current = allDriverPallets;
  }, [allDriverPallets]);

  useEffect(() => {
    selectedPalletIdRef.current = selectedPalletId;
  }, [selectedPalletId]);

  useEffect(() => {
    if (!selectedPallet) {
      return;
    }

    setOpenChangeMenu(null);
    setDraftStatusId(
      [1, 2, 3, 4, 5, 6, 7].includes(selectedPallet.current_status_id)
        ? selectedPallet.current_status_id
        : 0,
    );
    setDraftClientId(selectedPallet.user_id);
    setClientSearchTerm("");
    const client = clients.find(
      (item) => item.user_id === selectedPallet.user_id,
    );
    const warehouse2Address = getClientWarehouseAddress(client, 2);
    const deliveryLocationAddress = getDeliveryLocationAddress(selectedPallet);
    const nextLocationMode =
      selectedPallet.current_location === deliveryLocationAddress &&
      deliveryLocationAddress
        ? "delivery"
        : selectedPallet.current_location === warehouse2Address &&
            warehouse2Address
          ? "warehouse_2"
          : "warehouse_1";
    setDraftLocationMode(nextLocationMode);
  }, [selectedPallet, clients]);

  useEffect(() => {
    if (historyPallets.length === 0) {
      setIsScannedPalletsModalOpen(false);
      setActiveScannedPalletId(null);
      return;
    }

    if (
      activeScannedPalletId &&
      historyPallets.some((item) => item.id === activeScannedPalletId)
    ) {
      return;
    }

    setActiveScannedPalletId(historyPallets[0].id);
  }, [activeScannedPalletId, historyPallets]);

  useEffect(() => {
    if (openChangeMenu === "client") {
      setClientSearchTerm("");
    }
  }, [openChangeMenu]);

  useEffect(() => {
    return () => {
      if (palletPhotoUrlRef.current) {
        URL.revokeObjectURL(palletPhotoUrlRef.current);
      }

      if (damagePhotoUrlRef.current) {
        URL.revokeObjectURL(damagePhotoUrlRef.current);
      }
    };
  }, []);

  const applyCameraTrackZoom = (zoom: number) => {
    const track = streamRef.current?.getVideoTracks()[0] as
      | ZoomableMediaTrack
      | undefined;
    const zoomCapabilities = (
      track?.getCapabilities?.() as CameraZoomCapabilities | undefined
    )?.zoom;

    if (!track || !zoomCapabilities) {
      return;
    }

    void track
      .applyConstraints({ advanced: [{ zoom }] })
      .catch(() => undefined);
  };

  const updateCameraZoom = (value: number, range = cameraZoomRange) => {
    const nextZoom = clampDriverCameraZoom(value, range);
    setCameraZoom(nextZoom);
    applyCameraTrackZoom(nextZoom);
  };

  const syncCameraZoomCapabilities = (stream: MediaStream) => {
    const track = stream.getVideoTracks()[0] as ZoomableMediaTrack | undefined;
    const zoomCapabilities = (
      track?.getCapabilities?.() as CameraZoomCapabilities | undefined
    )?.zoom;

    if (
      zoomCapabilities &&
      typeof zoomCapabilities.min === "number" &&
      typeof zoomCapabilities.max === "number" &&
      zoomCapabilities.max > zoomCapabilities.min
    ) {
      const nextRange = {
        min: zoomCapabilities.min,
        max: zoomCapabilities.max,
        step: zoomCapabilities.step || DEFAULT_CAMERA_ZOOM_RANGE.step,
      };
      const currentTrackZoom = (
        track.getSettings?.() as CameraZoomSettings | undefined
      )?.zoom;
      const nextZoom = clampDriverCameraZoom(
        typeof currentTrackZoom === "number" ? currentTrackZoom : cameraZoom,
        nextRange,
      );

      setCameraZoomRange(nextRange);
      setIsCameraHardwareZoomSupported(true);
      setCameraZoom(nextZoom);
      void track
        .applyConstraints({ advanced: [{ zoom: nextZoom }] })
        .catch(() => undefined);
      return;
    }

    setCameraZoomRange(DEFAULT_CAMERA_ZOOM_RANGE);
    setIsCameraHardwareZoomSupported(false);
    setCameraZoom((current) => clampDriverCameraZoom(current));
  };

  const stopCamera = () => {
    if (scanFrameRef.current) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    if (scanAssistTimeoutRef.current) {
      window.clearTimeout(scanAssistTimeoutRef.current);
      scanAssistTimeoutRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const getBarcodeDetector = async () => {
    if (detectorRef.current) {
      return detectorRef.current;
    }

    const detectorApi = (
      window as Window & {
        BarcodeDetector?: BarcodeDetectorConstructorLike;
      }
    ).BarcodeDetector;

    if (!detectorApi) {
      return null;
    }

    try {
      if (detectorApi.getSupportedFormats) {
        const supportedFormats = await detectorApi
          .getSupportedFormats()
          .catch(() => []);

        if (
          supportedFormats.length > 0 &&
          !supportedFormats.includes("qr_code")
        ) {
          return null;
        }
      }

      detectorRef.current = new detectorApi({
        formats: ["qr_code", "code_128", "code_39", "ean_13"],
      });
    } catch {
      detectorRef.current = null;
    }

    return detectorRef.current;
  };

  const findMatchingPallet = (rawValue: string) => {
    return findPalletByScannedQr(rawValue, palletsRef.current);
  };

  const handleDetectedCode = (rawValue: string) => {
    const matchedPallet = findMatchingPallet(rawValue);

    if (!matchedPallet) {
      showFlash(
        text.scanImageNotRecognizedTitle,
        text.scanImageNotRecognizedDetail,
        "warning",
      );
      lastScanAtRef.current = Date.now();
      return;
    }

    const nextPallet = matchedPallet;

    setScannedPalletIds((current) => [
      nextPallet.id,
      ...current.filter((item) => item !== nextPallet.id),
    ]);
    selectedPalletIdRef.current = nextPallet.id;
    setSelectedPalletId(nextPallet.id);
    lastScanAtRef.current = Date.now();
  };

  const detectFromCamera = async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      scanBusyRef.current ||
      selectedPalletIdRef.current !== null
    ) {
      return;
    }

    const now = Date.now();
    if (
      now - lastScanAtRef.current < 1300 ||
      now - lastScanAttemptAtRef.current < 150
    ) {
      return;
    }

    lastScanAttemptAtRef.current = now;
    scanBusyRef.current = true;

    try {
      let rawValue: string | null = null;

      if (detector) {
        try {
          const codes = await detector.detect(video);
          rawValue =
            codes.find((item) => item.rawValue?.trim())?.rawValue?.trim() ||
            null;
        } catch {
          rawValue = null;
        }
      }

      if (!rawValue) {
        rawValue = decodeQrFromVideo(video, scanCanvasRef);
      }

      if (rawValue) {
        handleDetectedCode(rawValue);
      }
    } catch {
      setCameraState((current) => (current === "ready" ? "preview" : current));
    } finally {
      scanBusyRef.current = false;
    }
  };

  const runDetectionLoop = () => {
    scanFrameRef.current = window.requestAnimationFrame(async () => {
      await detectFromCamera();
      runDetectionLoop();
    });
  };

  useEffect(() => {
    let cancelled = false;

    if (
      !isScannerOpen ||
      isNoQrReturnFormOpen ||
      isNoQrPickupListOpen ||
      isRepairListOpen
    ) {
      stopCamera();
      return;
    }

    const startCamera = async () => {
      setCameraState("loading");
      detectorRef.current = null;

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState("unsupported");
        return;
      }

      try {
        const detector = await getBarcodeDetector();
        const cameraAttempts: MediaStreamConstraints[] = [
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 1280 },
            },
          },
          {
            audio: false,
            video: {
              facingMode: "environment",
            },
          },
          {
            audio: false,
            video: true,
          },
        ];
        let stream: MediaStream | null = null;
        let lastCameraError: unknown = null;

        for (const constraints of cameraAttempts) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (error) {
            lastCameraError = error;
          }
        }

        if (!stream) {
          throw lastCameraError;
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        syncCameraZoomCapabilities(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        if (!detector) {
          detectorRef.current = null;
        }

        setCameraState("ready");
        runDetectionLoop();
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setCameraState("denied");
          return;
        }

        setCameraState("error");
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();

      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, [
    isNoQrPickupListOpen,
    isNoQrReturnFormOpen,
    isRepairListOpen,
    isScannerOpen,
  ]);

  const dismissFlash = () => {
    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }

    setFlashMessage(null);
  };

  const showFlash = (
    title: string,
    detail: string,
    variant: DriverBadgeVariant,
    durationMs = 2400,
  ) => {
    setFlashMessage({ title, detail, variant });

    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }

    flashTimeoutRef.current = window.setTimeout(() => {
      flashTimeoutRef.current = null;
      setFlashMessage(null);
    }, durationMs);
  };

  const simulateScan = () => {
    if (isScanning || pallets.length === 0) {
      return;
    }

    setIsScanning(true);

    window.setTimeout(() => {
      scanIndexRef.current = (scanIndexRef.current + 1) % pallets.length;
      const nextPallet = pallets[scanIndexRef.current];
      setScannedPalletIds((current) => [
        nextPallet.id,
        ...current.filter((item) => item !== nextPallet.id),
      ]);
      selectedPalletIdRef.current = nextPallet.id;
      setSelectedPalletId(nextPallet.id);
      setIsScanning(false);
    }, 950);
  };

  const clearPalletPhoto = () => {
    if (palletPhotoUrlRef.current) {
      URL.revokeObjectURL(palletPhotoUrlRef.current);
      palletPhotoUrlRef.current = null;
    }

    if (palletPhotoInputRef.current) {
      palletPhotoInputRef.current.value = "";
    }

    setPalletPhotoUrl(null);
    setPalletPhoto(null);
    palletPhotoUploadedRef.current = false;
  };

  const uploadPalletPhoto = async (
    pallet: Pallet,
    nextStatusId: number,
    nextClientId?: number,
  ) => {
    if (!palletPhoto || palletPhotoUploadedRef.current) {
      return;
    }

    const photoClientId = statusIdAllowsCustomer(statuses, nextStatusId)
      ? nextClientId
      : statusIdAllowsCustomer(statuses, pallet.current_status_id)
        ? pallet.user_id
        : undefined;

    palletPhotoUploadedRef.current = true;

    try {
      await apiService.palletPhotos.uploadScan(pallet.id, palletPhoto, {
        old_status_id: pallet.current_status_id,
        new_status_id: nextStatusId,
        client_id: photoClientId,
      });
    } catch (error) {
      palletPhotoUploadedRef.current = false;
      console.error("Failed to upload driver pallet photo", error);
      showFlash(
        text.capturePalletPhoto,
        text.scanImageFallbackDetail,
        "warning",
      );
    }
  };

  const clearDamageDraft = () => {
    if (damagePhotoInputRef.current) {
      damagePhotoInputRef.current.value = "";
    }

    if (damagePhotoUrlRef.current) {
      URL.revokeObjectURL(damagePhotoUrlRef.current);
      damagePhotoUrlRef.current = null;
    }

    setDamagePhotoUrl(null);
    setDamageDescription("");
  };

  const clearDamagePhoto = () => {
    if (damagePhotoUrlRef.current) {
      URL.revokeObjectURL(damagePhotoUrlRef.current);
      damagePhotoUrlRef.current = null;
    }

    if (damagePhotoInputRef.current) {
      damagePhotoInputRef.current.value = "";
    }

    setDamagePhotoUrl(null);
  };

  const handleScanNext = () => {
    if (selectedPallet) {
      uploadPalletPhoto(
        selectedPallet,
        selectedPallet.current_status_id,
        selectedPallet.user_id,
      );
    }

    clearPalletPhoto();
    clearDamageDraft();
    setIsDamageModalOpen(false);
    setOpenChangeMenu(null);
    selectedPalletIdRef.current = null;
    setSelectedPalletId(null);
    lastScanAtRef.current = 0;
  };

  const persistDriverStatus = async (
    nextStatusId: number,
    clientId?: number,
    nextLocation = selectedLocationMeta.address,
  ) => {
    if (
      !selectedPallet ||
      (statusIdAllowsCustomer(statuses, nextStatusId) &&
        !clientId &&
        !selectedPallet.user_id)
    ) {
      return;
    }

    const preserveClientAssignment = statusIdAllowsCustomer(
      statuses,
      nextStatusId,
    );
    const nextClientId = preserveClientAssignment
      ? (clientId ?? selectedPallet.user_id)
      : undefined;
    const nextStatus = statuses.find((status) => status.id === nextStatusId);

    await uploadPalletPhoto(selectedPallet, nextStatusId, nextClientId);

    updatePalletStatus(
      selectedPallet.id,
      nextStatusId,
      user.id,
      user.name,
      nextLocation,
      nextStatus?.slug === "bij-de-klant"
        ? "Driver marked pallet as Bij de klant."
        : nextStatus?.slug === "ophalen-klant"
          ? "Driver marked pallet as Ophalen klant."
          : nextStatus?.slug === "service"
            ? "Driver marked pallet in repair."
            : transportStatusIds.includes(nextStatusId)
              ? "Driver marked pallet in transport."
              : "Driver marked pallet in Bowido warehouse.",
      nextClientId,
    );

    showFlash(
      text.statusUpdatedTitle,
      nextStatus?.slug === "bij-de-klant"
        ? text.statusSavedDetailAtClient
        : nextStatus?.slug === "ophalen-klant"
          ? text.statusSavedDetailReturn
          : nextStatus?.slug === "service"
            ? text.statusSavedDetailRepair
            : transportStatusIds.includes(nextStatusId)
              ? text.statusSavedDetailTransport
              : text.statusSavedDetailWarehouse,
      "success",
      1500,
    );
  };

  const handleStatusSelection = (statusId: number) => {
    setOpenChangeMenu(null);
    setDraftStatusId(statusId);
    const nextStatus = statuses.find((status) => status.id === statusId);
    const nextClientId = statusIdAllowsCustomer(statuses, statusId)
      ? (draftClientId ?? selectedPallet?.user_id)
      : undefined;
    const nextLocationClientId = statusIdAllowsCustomer(statuses, statusId)
      ? nextClientId
      : undefined;
    const nextLocation =
      nextStatus?.slug === "bowido-nl"
        ? bowidoWarehouseDirectory.warehouse1
        : nextStatus?.slug === "bowido-bih"
          ? bowidoWarehouseDirectory.warehouse2
          : nextStatus?.slug === "service"
            ? SERVICE_ADDRESS
            : getLocationMeta(draftLocationMode, nextLocationClientId).address;

    if (["bowido-nl", "bowido-bih"].includes(nextStatus?.slug || "")) {
      setDraftLocationMode(
        nextStatus?.slug === "bowido-nl" ? "warehouse_1" : "warehouse_2",
      );
    }

    if (
      nextStatus?.slug === "ophalen-klant" ||
      (statusIdAllowsCustomer(statuses, statusId) && !nextClientId)
    ) {
      setOpenChangeMenu("client");
      return;
    }

    persistDriverStatus(statusId, nextClientId, nextLocation);
  };

  const handleClientSelection = (value: string) => {
    if (isClientChangeDisabled) {
      setOpenChangeMenu(null);
      return;
    }

    const nextClientId = value ? Number(value) : undefined;
    setOpenChangeMenu(null);
    setDraftClientId(nextClientId);

    if (statusIdAllowsCustomer(statuses, draftStatusId) && nextClientId) {
      const nextClient = clients.find(
        (client) => client.user_id === nextClientId,
      );
      const nextLocationMode =
        draftLocationMode === "warehouse_2" &&
        !getClientWarehouseAddress(nextClient, 2)
          ? "warehouse_1"
          : draftLocationMode;
      const nextLocation = getLocationMeta(
        nextLocationMode,
        nextClientId,
      ).address;
      setDraftLocationMode(nextLocationMode);

      if (draftStatus?.slug === "ophalen-klant") {
        setOpenChangeMenu("location");
        return;
      }

      persistDriverStatus(draftStatusId, nextClientId, nextLocation);
    }
  };

  const handleLocationSelection = (mode: DriverLocationMode) => {
    setOpenChangeMenu(null);
    setDraftLocationMode(mode);
    const nextLocation = getLocationMeta(mode, activeLocationClientId).address;

    if (selectedPallet) {
      persistDriverStatus(
        draftStatusId,
        statusIdAllowsCustomer(statuses, draftStatusId)
          ? draftClientId
          : undefined,
        nextLocation,
      );
    }
  };

  const openPalletPhotoPicker = () => {
    palletPhotoInputRef.current?.click();
  };

  const handlePalletPhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (palletPhotoUrlRef.current) {
      URL.revokeObjectURL(palletPhotoUrlRef.current);
    }

    const nextPhotoUrl = URL.createObjectURL(file);
    palletPhotoUrlRef.current = nextPhotoUrl;
    palletPhotoUploadedRef.current = false;
    setPalletPhoto(file);
    setPalletPhotoUrl(nextPhotoUrl);
    event.target.value = "";
  };

  const openDamageModal = () => {
    if (!damageTargetPallet) {
      return;
    }

    clearDamageDraft();
    setIsDamageModalOpen(true);
  };

  const closeDamageModal = () => {
    clearDamageDraft();
    setIsDamageModalOpen(false);
  };

  const blurActiveElement = () => {
    if (typeof document === "undefined") {
      return;
    }

    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  };

  const handleDamagePhotoChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (damagePhotoUrlRef.current) {
      URL.revokeObjectURL(damagePhotoUrlRef.current);
    }

    const nextPhotoUrl = URL.createObjectURL(file);
    damagePhotoUrlRef.current = nextPhotoUrl;
    setDamagePhotoUrl(nextPhotoUrl);
    event.target.value = "";
  };

  const handleDamageReportSubmit = () => {
    blurActiveElement();

    if (!damageTargetPallet || !damagePhotoUrl || !damageDescription.trim()) {
      return;
    }

    showFlash(text.damageReportedTitle, text.damageReportedDetail, "warning");
    closeDamageModal();
  };

  const handleScannerFrameClick = () => {
    if (suppressNextScannerClickRef.current) {
      suppressNextScannerClickRef.current = false;
      return;
    }

    return;
  };

  const handleScannerFrameKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      event.currentTarget !== event.target ||
      (event.key !== "Enter" && event.key !== " ")
    ) {
      return;
    }

    event.preventDefault();
    handleScannerFrameClick();
  };

  const handleScannerFrameTouchStart = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length !== 2) {
      return;
    }

    event.preventDefault();
    const distance = getPinchDistance(event.touches);

    if (distance > 0) {
      pinchStateRef.current = { distance, zoom: cameraZoom };
      suppressNextScannerClickRef.current = true;
    }
  };

  const handleScannerFrameTouchMove = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length !== 2 || !pinchStateRef.current) {
      return;
    }

    event.preventDefault();
    const distance = getPinchDistance(event.touches);

    if (distance > 0) {
      updateCameraZoom(
        pinchStateRef.current.zoom *
          (distance / pinchStateRef.current.distance),
      );
      suppressNextScannerClickRef.current = true;
    }
  };

  const handleScannerFrameTouchEnd = (
    event: React.TouchEvent<HTMLDivElement>,
  ) => {
    if (event.touches.length >= 2 || !pinchStateRef.current) {
      return;
    }

    pinchStateRef.current = null;
    window.setTimeout(() => {
      suppressNextScannerClickRef.current = false;
    }, 400);
  };

  const handleScannerFrameWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    suppressNextScannerClickRef.current = true;
    updateCameraZoom(cameraZoom - event.deltaY * 0.01);

    window.setTimeout(() => {
      suppressNextScannerClickRef.current = false;
    }, 300);
  };

  const handleScanImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const detector = await getBarcodeDetector();

    let bitmap: ImageBitmap | null = null;

    try {
      bitmap = await createImageBitmap(file);
      let rawValue: string | null = null;

      if (detector) {
        try {
          const codes = await detector.detect(bitmap);
          rawValue =
            codes.find((item) => item.rawValue?.trim())?.rawValue?.trim() ||
            null;
        } catch {
          rawValue = null;
        }
      }

      rawValue = rawValue || decodeQrFromImageBitmap(bitmap, scanCanvasRef);

      if (rawValue) {
        handleDetectedCode(rawValue);
        return;
      }

      showFlash(
        text.scanImageNotRecognizedTitle,
        text.scanImageNotRecognizedDetail,
        "warning",
      );
    } catch {
      showFlash(
        text.scanImageFallbackTitle,
        text.scanImageFallbackDetail,
        "info",
      );
    } finally {
      bitmap?.close();
    }
  };

  const openScannedPalletsModal = () => {
    if (historyPallets.length === 0) {
      return;
    }

    setActiveScannedPalletId(historyPallets[0].id);
    setIsScannedPalletsModalOpen(true);
  };

  const handleHistoryPalletOpen = (palletCode: string) => {
    setIsScannedPalletsModalOpen(false);
    handleDetectedCode(palletCode);
  };

  const handleFullscreenModalBack = () => {
    if (isDamageModalOpen) {
      blurActiveElement();
      closeDamageModal();
      return;
    }

    if (isScannedPalletsModalOpen) {
      setIsScannedPalletsModalOpen(false);
      return;
    }

    if (openChangeMenu) {
      setOpenChangeMenu(null);
    }
  };

  const isBottomNavVisible = isScannerOpen || Boolean(selectedPallet);
  const scannerBottomActionCount =
    1 + (showNoQrReturnAction ? 1 : 0) + (showNoQrPickupAction ? 1 : 0);

  return (
    <div
      className={cn(
        "mx-auto flex min-h-full w-full max-w-md flex-col",
        isScannerOpen
          ? "gap-4 pb-0"
          : "gap-2 pb-[calc(env(safe-area-inset-bottom)+4.75rem)]",
      )}
    >
      {isScannerOpen && (
        <div className="flex min-h-0 flex-1 flex-col justify-start px-4 pb-1 pt-0 transition-all duration-500">
          <input
            ref={scanImageInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleScanImageChange}
          />

          <div className="px-1 pt-1 pb-5 text-center">
            <p className="text-[13px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
              {text.title}
            </p>
          </div>

          <div className="flex flex-1 flex-col">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key="scanner-view"
                role="button"
                tabIndex={0}
                onClick={handleScannerFrameClick}
                onKeyDown={handleScannerFrameKeyDown}
                onTouchStart={handleScannerFrameTouchStart}
                onTouchMove={handleScannerFrameTouchMove}
                onTouchEnd={handleScannerFrameTouchEnd}
                onTouchCancel={handleScannerFrameTouchEnd}
                onWheel={handleScannerFrameWheel}
                initial={{ opacity: 0.82, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className={cn(
                  "relative mx-auto flex h-full min-h-[min(26rem,calc(100dvh-18rem))] w-full items-center justify-center overflow-hidden rounded-[2.9rem] border border-emerald-200 bg-white text-white transition-all duration-500 dark:border-white/10 dark:bg-[#101715]",
                  cameraState === "ready" ? "" : "active:scale-[0.98]",
                )}
                style={{ touchAction: "none" }}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className={cn(
                    "absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-300",
                    cameraState === "ready" || cameraState === "preview"
                      ? "opacity-100"
                      : "opacity-0",
                  )}
                  style={{
                    transform: isCameraHardwareZoomSupported
                      ? "scale(1)"
                      : `scale(${cameraZoom})`,
                  }}
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(236,253,245,0.10)_0%,rgba(255,255,255,0.02)_32%,rgba(236,253,245,0.18)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,35,26,0.16)_0%,rgba(20,45,34,0.08)_35%,rgba(15,35,26,0.34)_100%)]" />
                <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(16,185,129,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.8)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-[0.12]" />
                <div className="absolute inset-3 rounded-[2rem] border border-emerald-300/20 dark:border-white/10" />
                <div className="absolute left-5 right-5 top-5 h-14 rounded-full bg-emerald-400/12 blur-2xl dark:bg-emerald-400/8" />
                {(cameraState === "ready" || cameraState === "preview") && (
                  <div className="absolute right-6 top-6 z-10 flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400/70" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                    <span className="sr-only">{text.liveDot}</span>
                  </div>
                )}

                <motion.div
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute left-7 top-7 h-14 w-14 rounded-tl-[1.2rem] border-l-4 border-t-4 border-emerald-400/95"
                />
                <motion.div
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.12,
                  }}
                  className="absolute right-7 top-7 h-14 w-14 rounded-tr-[1.2rem] border-r-4 border-t-4 border-emerald-400/95"
                />
                <motion.div
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.24,
                  }}
                  className="absolute bottom-7 left-7 h-14 w-14 rounded-bl-[1.2rem] border-b-4 border-l-4 border-emerald-400/95"
                />
                <motion.div
                  animate={{ opacity: [0.8, 1, 0.8] }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.36,
                  }}
                  className="absolute bottom-7 right-7 h-14 w-14 rounded-br-[1.2rem] border-b-4 border-r-4 border-emerald-400/95"
                />

                <div className="trackpal-scan-line" />

                {isScanning || cameraState === "loading" ? (
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/60">
                    <span className="h-4 w-4 animate-pulse rounded-full bg-emerald-400" />
                  </div>
                ) : cameraState !== "ready" && cameraState !== "preview" ? (
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-emerald-200 bg-emerald-50 dark:border-white/10 dark:bg-[#101715]">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="h-3 w-3 rounded-sm bg-emerald-400/90" />
                      <span className="h-3 w-3 rounded-sm bg-emerald-300/65" />
                      <span className="h-3 w-3 rounded-sm bg-emerald-300/65" />
                      <span className="h-3 w-3 rounded-sm bg-emerald-400/90" />
                    </div>
                  </div>
                ) : (
                  <Camera size={38} className="relative z-10 text-white/25" />
                )}
              </motion.div>
            </AnimatePresence>

            {(cameraState === "ready" || cameraState === "preview") && (
              <div className="mx-auto mt-4 w-3/4 rounded-xl border border-emerald-200 bg-white p-3 dark:border-white/10 dark:bg-[#151d1a]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="driver-camera-zoom"
                    className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-400"
                  >
                    {language === "bs"
                      ? "Zoom kamere"
                      : language === "nl"
                        ? "Camera zoom"
                        : "Camera zoom"}
                  </label>
                  <span className="font-mono text-[10px] font-black text-zinc-700 dark:text-zinc-300">
                    {cameraZoom.toFixed(1)}x
                  </span>
                </div>
                <input
                  id="driver-camera-zoom"
                  type="range"
                  min={cameraZoomRange.min}
                  max={cameraZoomRange.max}
                  step={cameraZoomRange.step}
                  value={cameraZoom}
                  onChange={(event) =>
                    updateCameraZoom(Number(event.target.value))
                  }
                  className="h-2 w-full cursor-pointer accent-[#00A655]"
                  aria-label={language === "bs" ? "Zoom kamere" : "Camera zoom"}
                />
              </div>
            )}
          </div>

          {showRepairListAction && (
            <button
              type="button"
              onClick={() => setIsRepairListOpen(true)}
              className="mt-4 flex min-h-20 w-full items-center gap-3 rounded-[1.8rem] border border-amber-200 bg-amber-50 px-4 py-4 text-left transition-all active:scale-[0.99] dark:border-amber-500/20 dark:bg-amber-500/10"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-600 dark:border-amber-500/25 dark:bg-[#101715] dark:text-amber-200">
                <PackageSearch size={18} />
              </div>
              <div className="flex min-h-11 min-w-0 flex-1 items-center">
                <p className="text-[11px] font-black uppercase leading-4 tracking-[0.16em] text-amber-700 dark:text-amber-100">
                  {repairListCopy.buttonTitle}
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {flashMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-emerald-950/25 px-5 backdrop-blur-[2px] dark:bg-black/45"
            onClick={dismissFlash}
          >
            <motion.div
              key={`${flashMessage.variant}-${flashMessage.title}-${flashMessage.detail}`}
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-sm"
              onClick={(event) => event.stopPropagation()}
              role="alertdialog"
              aria-modal="true"
            >
              <Card className="border-emerald-100 bg-white/98 shadow-[0_24px_64px_-24px_rgba(0,0,0,0.32)] dark:border-white/10 dark:bg-[#101715]/98">
                <div className="text-center">
                  {flashMessage.variant === "success" ? (
                    <motion.div
                      initial={{ scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.16)] dark:bg-emerald-500/10"
                    >
                      <motion.svg
                        viewBox="0 0 52 52"
                        className="h-14 w-14 text-emerald-500 dark:text-emerald-300"
                        fill="none"
                      >
                        <motion.circle
                          cx="26"
                          cy="26"
                          r="20"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          initial={{ pathLength: 0, opacity: 0.45 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{ duration: 0.34, ease: "easeOut" }}
                        />
                        <motion.path
                          d="M16 27.5l6.5 6.5L36.5 20"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 1 }}
                          transition={{
                            duration: 0.28,
                            delay: 0.18,
                            ease: "easeOut",
                          }}
                        />
                      </motion.svg>
                    </motion.div>
                  ) : (
                    <div
                      className={cn(
                        "mx-auto h-2.5 w-20 rounded-full",
                        flashMessage.variant === "warning" && "bg-amber-500",
                        flashMessage.variant === "danger" && "bg-rose-500",
                        flashMessage.variant === "info" && "bg-indigo-500",
                        flashMessage.variant === "default" && "bg-zinc-400",
                      )}
                    />
                  )}
                  <p className="mt-4 text-[1.35rem] font-black uppercase leading-tight tracking-[-0.03em] text-emerald-950 dark:text-white">
                    {flashMessage.title}
                  </p>
                  {flashMessage.detail && (
                    <p className="mt-2 text-[13px] font-bold leading-6 text-zinc-600 dark:text-zinc-300">
                      {flashMessage.detail}
                    </p>
                  )}
                </div>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedPallet && (
          <motion.div
            key={selectedPallet.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mx-auto flex w-full max-w-md flex-col bg-white pt-1 dark:bg-[#070b0a]"
          >
            <Card
              noPadding
              className="mx-auto flex w-full flex-col border-transparent bg-transparent shadow-none"
            >
              <div className="flex flex-col px-0 pb-3 pt-1">
                <DriverPalletSummaryCard
                  nameLabel={text.palletNameLabel}
                  code={getPalletDisplayName(selectedPallet)}
                  typeLabel={text.palletTypeLabel}
                  typeValue={getDriverPalletTypeLabel(
                    selectedPallet.type,
                    language,
                  )}
                  theme={selectedPalletTheme}
                  alignTop={shouldTopAlignSummaryCard}
                >
                  {isCheckInStatus && (
                    <div
                      className={cn(
                        "mt-3 flex w-full justify-center rounded-[1rem] px-0 pt-2.5 pb-0 text-center",
                        selectedPalletTheme.softSurface,
                      )}
                    >
                      <div className="flex min-w-0 flex-col items-center">
                        <p
                          className={cn(
                            "text-[11px] font-black uppercase tracking-[0.14em]",
                            selectedPalletTheme.label,
                          )}
                        >
                          Check in
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-[13px] font-black tracking-tight",
                            selectedPalletTheme.heading,
                          )}
                        >
                          {warehouseCheckInDateLabel}
                        </p>
                      </div>
                    </div>
                  )}
                  {clientStatusInfo &&
                    selectedPallet.current_status_id === 4 && (
                      <div
                        className={cn(
                          "mt-3 grid w-full grid-cols-3 items-start gap-2.5 rounded-[1rem] px-0 pt-2.5 pb-0",
                          selectedPalletTheme.softSurface,
                        )}
                      >
                        <div className="flex min-w-0 w-full flex-col items-start text-left">
                          <p
                            className={cn(
                              "text-[11px] font-black uppercase tracking-[0.14em]",
                              selectedPalletTheme.label,
                            )}
                          >
                            {returnWindowText.sentAt}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-[13px] font-black tracking-tight",
                              selectedPalletTheme.heading,
                            )}
                          >
                            {clientStatusInfo.statusChangedAtLabel}
                          </p>
                        </div>
                        <div className="flex min-w-0 w-full flex-col items-center text-center">
                          <p
                            className={cn(
                              "text-[11px] font-black uppercase tracking-[0.14em]",
                              selectedPalletTheme.label,
                            )}
                          >
                            {returnWindowText.returnDue}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-[13px] font-black tracking-tight",
                              selectedPalletTheme.heading,
                            )}
                          >
                            {clientStatusInfo.dueDateLabel}
                          </p>
                        </div>
                        <div className="flex min-w-0 w-full flex-col items-end text-right">
                          <p
                            className={cn(
                              "text-[10px] font-black uppercase tracking-[0.14em]",
                              selectedPalletTheme.label,
                            )}
                          >
                            {clientStatusInfo.deadlineLabel}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-right text-[12px] font-black leading-4 tracking-tight",
                              clientStatusInfo.isOverdue
                                ? "text-rose-700 dark:text-rose-100"
                                : selectedPalletTheme.heading,
                            )}
                          >
                            {clientStatusInfo.deadlineText}
                          </p>
                        </div>
                      </div>
                    )}
                  {clientStatusInfo &&
                    selectedPallet.current_status_id === 5 && (
                      <div
                        className={cn(
                          "mt-3 flex w-full justify-center rounded-[1rem] px-0 pt-2.5 pb-0 text-center",
                          selectedPalletTheme.softSurface,
                        )}
                      >
                        <div className="flex min-w-0 flex-col items-center">
                          <p
                            className={cn(
                              "text-[11px] font-black uppercase tracking-[0.14em]",
                              selectedPalletTheme.label,
                            )}
                          >
                            {returnWindowText.reportedAt}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-[13px] font-black tracking-tight",
                              selectedPalletTheme.heading,
                            )}
                          >
                            {clientStatusInfo.statusChangedAtLabel}
                          </p>
                        </div>
                      </div>
                    )}
                  {transportWindowInfo && (
                    <div
                      className={cn(
                        "mt-3 w-full rounded-[1rem] px-0 pt-2.5 pb-0",
                        selectedPalletTheme.softSurface,
                      )}
                    >
                      <div className="grid grid-cols-3 items-start gap-2.5">
                        <div className="flex min-w-0 w-full flex-col items-start text-left">
                          <p
                            className={cn(
                              "text-[11px] font-black uppercase tracking-[0.14em]",
                              selectedPalletTheme.label,
                            )}
                          >
                            {transportWindowText.startedAt}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-[13px] font-black tracking-tight",
                              selectedPalletTheme.heading,
                            )}
                          >
                            {transportWindowInfo.startedAtLabel}
                          </p>
                        </div>
                        <div className="flex min-w-0 w-full flex-col items-center text-center">
                          <p
                            className={cn(
                              "text-[11px] font-black uppercase tracking-[0.14em]",
                              selectedPalletTheme.label,
                            )}
                          >
                            {transportWindowText.dueBy}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-[13px] font-black tracking-tight",
                              selectedPalletTheme.heading,
                            )}
                          >
                            {transportWindowInfo.dueDateLabel}
                          </p>
                        </div>
                        <div className="flex min-w-0 w-full flex-col items-end text-right">
                          <p
                            className={cn(
                              "text-[10px] font-black uppercase tracking-[0.14em]",
                              selectedPalletTheme.label,
                            )}
                          >
                            {transportWindowInfo.deadlineLabel}
                          </p>
                          <p
                            className={cn(
                              "mt-1 text-right text-[12px] font-black leading-4 tracking-tight",
                              transportWindowInfo.isOverdue
                                ? "text-rose-700 dark:text-rose-100"
                                : selectedPalletTheme.heading,
                            )}
                          >
                            {transportWindowInfo.deadlineText}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </DriverPalletSummaryCard>

                <div className="mt-2.5 flex min-h-0 flex-[1.45] flex-col gap-2.5">
                  <div className="relative flex min-h-[11.8rem] flex-[1.28] flex-col justify-center rounded-[1.9rem] bg-white/90 px-4 pt-5 pb-0 text-center dark:bg-[#101715]/92">
                    <p className="text-[12px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                      {text.currentStatus}
                    </p>
                    <p className="mt-3 break-words text-[2.65rem] font-black uppercase leading-[0.94] tracking-[-0.05em] text-emerald-950 dark:text-white">
                      {getDriverStatusLabel(selectedPallet.current_status_name)}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenChangeMenu((current) =>
                          current === "status" ? null : "status",
                        )
                      }
                      className={cn(
                        changeTriggerClass,
                        "mt-3 h-10 self-center px-4 text-[12px]",
                      )}
                    >
                      {text.changeStatus}
                      <ChevronDown
                        size={14}
                        className={cn(
                          "transition-transform",
                          openChangeMenu === "status" && "rotate-180",
                        )}
                      />
                    </button>
                  </div>

                  {(selectedClientName || showSelectedLocationSummary) && (
                    <div
                      className={cn(
                        "grid min-h-0 flex-[1.12] auto-rows-fr gap-2.5 text-left",
                        selectedClientName && showSelectedLocationSummary
                          ? "grid-rows-[minmax(0,1fr)_minmax(0,1fr)]"
                          : "grid-rows-[minmax(0,1fr)]",
                      )}
                    >
                      {selectedClientName && (
                        <div className="relative flex h-full min-h-0 flex-col justify-center rounded-[1.45rem] bg-white/88 px-3.5 py-4 dark:bg-[#101715]/88">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                                {text.summaryClient}
                              </p>
                              <p className="mt-1 break-words text-[1.22rem] font-black leading-6 tracking-[-0.02em] text-emerald-950 dark:text-white">
                                {selectedClientName}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={isClientChangeDisabled}
                              onClick={() => {
                                if (isClientChangeDisabled) {
                                  return;
                                }

                                setOpenChangeMenu((current) =>
                                  current === "client" ? null : "client",
                                );
                              }}
                              className={cn(
                                changeTriggerClass,
                                "shrink-0 self-center",
                                isClientChangeDisabled &&
                                  "cursor-not-allowed opacity-45 hover:text-inherit",
                              )}
                            >
                              {text.changeLabel}
                              <ChevronDown
                                size={14}
                                className={cn(
                                  "transition-transform",
                                  openChangeMenu === "client" && "rotate-180",
                                )}
                              />
                            </button>
                          </div>
                        </div>
                      )}

                      {showSelectedLocationSummary && (
                        <div
                          className={cn(
                            "relative rounded-[1.45rem] bg-white/88 dark:bg-[#101715]/88",
                            selectedClientName ? "px-3.5 py-4" : "px-3.5 py-5",
                          )}
                        >
                          <div className="flex h-full items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                                {text.summaryLocation}
                              </p>
                              <p className="mt-1 break-words text-[1.22rem] font-black leading-6 tracking-[-0.02em] text-emerald-950 dark:text-white">
                                {isTransportStatus
                                  ? transportLocationLabel
                                  : fixedWarehouseLocationMeta
                                    ? fixedWarehouseLocationMeta.label
                                    : selectedLocationMeta.label}
                              </p>
                              {fixedWarehouseLocationMeta?.address && (
                                <p className="mt-1 break-words text-[14px] font-bold leading-5 text-zinc-600 dark:text-[#cce0d3]">
                                  {fixedWarehouseLocationMeta.address}
                                </p>
                              )}
                              {!isLocationChangeDisabled && (
                                <p className="mt-1 break-words text-[14px] font-bold leading-5 text-zinc-600 dark:text-[#cce0d3]">
                                  {selectedLocationMeta.address}
                                </p>
                              )}
                            </div>
                            {!isLocationChangeDisabled && (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenChangeMenu((current) =>
                                    current === "location" ? null : "location",
                                  )
                                }
                                className={cn(
                                  changeTriggerClass,
                                  "shrink-0 self-center",
                                )}
                              >
                                {text.changeLabel}
                                <ChevronDown
                                  size={14}
                                  className={cn(
                                    "transition-transform",
                                    openChangeMenu === "location" &&
                                      "rotate-180",
                                  )}
                                />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <input
                ref={palletPhotoInputRef}
                id="driver-pallet-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePalletPhotoChange}
              />

              {palletPhotoUrl && (
                <div className="px-0 pb-3 pt-0.5">
                  <div className="w-full overflow-hidden rounded-[1.45rem] bg-white p-2 dark:bg-[#101715]">
                    <div className="relative overflow-hidden rounded-[1.3rem] bg-emerald-50 dark:bg-[#151d1a]">
                      <img
                        src={palletPhotoUrl}
                        alt={text.capturePalletPhoto}
                        className="h-28 w-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {isBottomNavVisible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70]">
          <div
            className={cn(
              "pointer-events-auto mx-auto grid min-h-16 w-full max-w-md items-center border-t border-transparent bg-[#00A655] px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] shadow-[0_-12px_36px_rgba(0,166,85,0.35)]",
            )}
          >
            {isFullscreenModalOpen ? (
              <div
                className={cn(
                  "grid h-full gap-1",
                  showDamageModalNavActions ? "grid-cols-2" : "grid-cols-1",
                )}
              >
                <button
                  type="button"
                  onClick={handleFullscreenModalBack}
                  className={cn(
                    modalNavButtonClass,
                    "hover:bg-white/10 hover:text-white",
                  )}
                >
                  <ChevronLeft size={20} className="shrink-0" />
                  {text.back}
                </button>
                {showDamageModalNavActions && (
                  <button
                    type="button"
                    onClick={handleDamageReportSubmit}
                    disabled={isDamageReportSubmitDisabled}
                    className={cn(
                      modalNavButtonClass,
                      isDamageReportSubmitDisabled
                        ? "cursor-not-allowed text-white/45 active:scale-100"
                        : "hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Check size={20} className="shrink-0" />
                    {text.damageModalSubmit}
                  </button>
                )}
              </div>
            ) : isScannerOpen ? (
              <div
                className={cn(
                  "grid h-full gap-1",
                  scannerBottomActionCount === 1 && "grid-cols-1",
                  scannerBottomActionCount === 2 && "grid-cols-2",
                  scannerBottomActionCount >= 3 && "grid-cols-3",
                )}
              >
                <button
                  type="button"
                  onClick={openScannedPalletsModal}
                  disabled={historyPallets.length === 0}
                  className={cn(
                    actionButtonClass,
                    historyPallets.length === 0
                      ? "cursor-not-allowed text-white/45 active:scale-100"
                      : "hover:bg-white/10 hover:text-white",
                  )}
                >
                  <History size={20} className="shrink-0" />
                  {text.historyPallets}
                </button>
                {showNoQrReturnAction && (
                  <button
                    type="button"
                    onClick={() => setIsNoQrReturnFormOpen(true)}
                    className={cn(
                      actionButtonClass,
                      "hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <AlertTriangle size={20} className="shrink-0" />
                    {noQrReturnCopy.reportButtonLabel}
                  </button>
                )}
                {showNoQrPickupAction && (
                  <button
                    type="button"
                    onClick={() => setIsNoQrPickupListOpen(true)}
                    className={cn(
                      actionButtonClass,
                      "hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <PackageSearch size={20} className="shrink-0" />
                    {noQrPickupCopy.buttonTitle}
                  </button>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  "grid h-full gap-1",
                  shouldShowPalletPhotoAction ? "grid-cols-3" : "grid-cols-2",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    actionButtonClass,
                    "hover:bg-white/10 hover:text-white",
                  )}
                  onClick={handleScanNext}
                >
                  <RefreshCcw size={20} className="shrink-0" />
                  {text.scanNext}
                </button>
                {shouldShowPalletPhotoAction && (
                  <button
                    type="button"
                    onClick={openPalletPhotoPicker}
                    className={cn(
                      actionButtonClass,
                      "hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Camera size={20} className="shrink-0" />
                    {text.capturePalletPhoto}
                  </button>
                )}
                <button
                  type="button"
                  onClick={openDamageModal}
                  disabled={!damageTargetPallet}
                  className={cn(
                    actionButtonClass,
                    damageTargetPallet
                      ? "hover:bg-white/10 hover:text-white"
                      : "cursor-not-allowed text-white/45 active:scale-100",
                  )}
                >
                  <AlertTriangle size={20} className="shrink-0" />
                  {text.reportDamage}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isNoQrReturnFormOpen && (
          <NoQrReturnFormModal
            currentUser={user}
            onClose={() => setIsNoQrReturnFormOpen(false)}
            onSubmitted={(clientName, count) =>
              showFlash(
                noQrReturnCopy.reportButtonLabel,
                `${clientName} | ${count}`,
                "success",
              )
            }
          />
        )}

        {confirmationPrompt && (
          <DriverModalShell
            onClose={() => setConfirmationPrompt(null)}
            title={confirmationPrompt.title}
            width="sm"
            overlayClassName="z-[130] items-center p-4"
            contentClassName="h-auto max-h-[82dvh] max-w-sm rounded-[1.75rem] border border-emerald-100 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)] dark:border-white/10"
            bodyClassName="bg-zinc-50/80 px-5 py-5 dark:bg-[#070b0a]"
            footer={
              <div className="grid grid-cols-2 gap-2.5 bg-white px-5 py-4 dark:bg-[#101715]">
                <button
                  type="button"
                  onClick={() => setConfirmationPrompt(null)}
                  className="flex h-12 items-center justify-center rounded-[1rem] bg-zinc-100 px-4 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-700 transition-all active:scale-[0.98] dark:bg-[#101715] dark:text-zinc-200"
                >
                  {text.damageModalCancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmationPrompt.onConfirm();
                    setConfirmationPrompt(null);
                  }}
                  className={cn(
                    "flex h-12 items-center justify-center rounded-[1rem] px-4 text-[11px] font-black uppercase tracking-[0.14em] text-white transition-all active:scale-[0.98]",
                    confirmationPrompt.tone === "warning"
                      ? "bg-amber-500"
                      : "bg-[#00A655]",
                  )}
                >
                  {confirmationPrompt.confirmLabel}
                </button>
              </div>
            }
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-600 dark:border-white/10 dark:bg-[#101715] dark:text-emerald-100">
                <CheckCircle2 size={18} />
              </div>
              <p className="text-[13px] font-bold leading-6 text-zinc-700 dark:text-zinc-200">
                {confirmationPrompt.message}
              </p>
            </div>
          </DriverModalShell>
        )}

        {isNoQrPickupListOpen && (
          <DriverModalShell
            onClose={() => {
              setIsNoQrPickupListOpen(false);
              setNoQrClientSearch("");
            }}
            title={noQrPickupCopy.title}
            width="md"
            overlayClassName="z-[110] items-center p-3"
            contentClassName="h-auto max-h-[88dvh] rounded-[1.75rem] border border-emerald-100 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)] dark:border-white/10"
            bodyClassName="bg-zinc-50/80 px-4 py-4 dark:bg-[#070b0a]"
          >
            <div className="space-y-4">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="search"
                  value={noQrClientSearch}
                  onChange={(event) => setNoQrClientSearch(event.target.value)}
                  placeholder={noQrPickupCopy.search}
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-[12px] font-bold text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-400 dark:border-white/10 dark:bg-[#101715] dark:text-white"
                />
              </div>

              {noQrPickupPallets.length > 0 ? (
                <div className="max-h-[64dvh] space-y-3 overflow-y-auto pr-1 no-scrollbar">
                  {noQrPickupPallets.map((pallet, index) => (
                    <div
                      key={`driver-no-qr-pickup-${pallet.id}`}
                      className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#101715]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                            {noQrPickupCopy.pallet} {index + 1}
                          </p>
                          <p className="mt-1 truncate text-[13px] font-black uppercase tracking-tight text-emerald-900 dark:text-white">
                            {pallet.client_name || "-"}
                          </p>
                        </div>
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-emerald-50 px-2 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-100">
                          {index + 1}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-[#101715]">
                          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            {noQrPickupCopy.location}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                            {getLocationLabel(
                              pallet.current_location,
                              language,
                            ) || "-"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-[#101715]">
                            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
                              {noQrPickupCopy.pickup}
                            </p>
                            <p className="mt-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                              {getNoQrPickupLabel(pallet)}
                            </p>
                          </div>
                          <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-[#101715]">
                            <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
                              {noQrPickupCopy.comment}
                            </p>
                            <p className="mt-1 line-clamp-3 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                              {getNoQrCommentLabel(pallet)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setConfirmationPrompt({
                            title: noQrPickupCopy.returned,
                            message: noQrPickupCopy.confirm,
                            confirmLabel: noQrPickupCopy.returned,
                            tone: "success",
                            onConfirm: () => deletePallet(pallet.id),
                          });
                        }}
                        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00A655] px-4 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-transform active:scale-[0.99]"
                      >
                        <CheckCircle2 size={16} />
                        {noQrPickupCopy.returned}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-white px-5 py-10 text-center dark:border-white/10 dark:bg-[#101715]">
                  <PackageSearch
                    size={24}
                    className="mx-auto mb-3 text-zinc-300"
                  />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    {noQrPickupCopy.empty}
                  </p>
                </div>
              )}
            </div>
          </DriverModalShell>
        )}

        {isRepairListOpen && (
          <DriverModalShell
            onClose={() => setIsRepairListOpen(false)}
            title={repairListCopy.title}
            width="md"
            overlayClassName="z-[110] items-center p-3"
            contentClassName="h-auto max-h-[88dvh] rounded-[1.75rem] border border-amber-100 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)] dark:border-white/10"
            bodyClassName="bg-zinc-50/80 px-4 py-4 dark:bg-[#070b0a]"
          >
            {repairPallets.length > 0 ? (
              <div className="max-h-[68dvh] space-y-3 overflow-y-auto pr-1 no-scrollbar">
                {repairPallets.map((pallet, index) => (
                  <div
                    key={`service-repair-pallet-${pallet.id}`}
                    className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#101715]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                          {repairListCopy.pallet} {index + 1}
                        </p>
                        <p className="mt-1 truncate text-[13px] font-black uppercase tracking-tight text-emerald-900 dark:text-white">
                          {pallet.qr_code}
                        </p>
                      </div>
                      <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-amber-50 px-2 text-[11px] font-black text-amber-700 dark:bg-amber-500/10 dark:text-amber-100">
                        {index + 1}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-[#101715]">
                          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            {repairListCopy.type}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                            {getDriverPalletTypeLabel(pallet.type, language)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-[#101715]">
                          <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
                            {repairListCopy.location}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                            {getLocationLabel(
                              pallet.current_location,
                              language,
                            ) || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl bg-zinc-50 px-3 py-2.5 dark:bg-[#101715]">
                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400">
                          {repairListCopy.note}
                        </p>
                        <p className="mt-1 line-clamp-3 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
                          {pallet.note || "-"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmationPrompt({
                          title: repairListCopy.successTitle,
                          message:
                            language === "bs"
                              ? "Oznaciti paletu kao popravljenu?"
                              : repairListCopy.confirm,
                          confirmLabel:
                            language === "bs"
                              ? "Oznaci kao popravljeno"
                              : repairListCopy.repaired,
                          tone: "success",
                          onConfirm: () => {
                            updatePalletStatus(
                              pallet.id,
                              1,
                              user.id,
                              user.name,
                              pallet.current_location,
                              "Service marked pallet as repaired from mobile screen.",
                            );
                            showFlash(
                              repairListCopy.successTitle,
                              language === "bs"
                                ? "Paleta je vracena iz servisa."
                                : repairListCopy.successDetail,
                              "success",
                            );
                          },
                        });
                      }}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#00A655] px-4 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-transform active:scale-[0.99]"
                    >
                      <CheckCircle2 size={16} />
                      {language === "bs"
                        ? "Oznaci kao popravljeno"
                        : repairListCopy.repaired}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-white px-5 py-10 text-center dark:border-white/10 dark:bg-[#101715]">
                <PackageSearch
                  size={24}
                  className="mx-auto mb-3 text-zinc-300"
                />
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  {repairListCopy.empty}
                </p>
              </div>
            )}
          </DriverModalShell>
        )}

        {openChangeMenu && selectedPallet && (
          <DriverModalShell
            onClose={() => setOpenChangeMenu(null)}
            header={
              openChangeMenu === "client" ? (
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 dark:text-emerald-200"
                  />
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={(event) =>
                      setClientSearchTerm(event.target.value)
                    }
                    placeholder={text.searchClientPlaceholder}
                    className="h-11 w-full rounded-[1rem] border border-emerald-100 bg-emerald-50/60 pl-11 pr-4 text-[12px] font-black uppercase tracking-[0.08em] text-emerald-950 outline-none transition-colors placeholder:text-emerald-400 focus:border-emerald-300 dark:border-white/10 dark:bg-[#101715] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-emerald-300"
                  />
                </div>
              ) : undefined
            }
            title={openChangeMenu === "client" ? undefined : changeModalTitle}
            subtitle={
              openChangeMenu === "client"
                ? undefined
                : getPalletDisplayName(selectedPallet)
            }
            width="lg"
            contentClassName="min-h-[24rem] justify-center"
            bodyClassName="p-0"
            headerClassName={
              openChangeMenu === "client"
                ? "items-center px-5 pb-3 pt-4"
                : undefined
            }
            showHeaderDivider={openChangeMenu !== "client"}
          >
            {openChangeMenu === "status" && (
              <div className="space-y-2.5 p-5">
                {driverStatusOptions.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => handleStatusSelection(status.id)}
                    className={cn(
                      "flex w-full items-center justify-center rounded-[1rem] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-tight transition-all",
                      draftStatusId === status.id
                        ? "bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100"
                        : "bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#101715] dark:text-zinc-200 dark:hover:bg-white/5",
                    )}
                  >
                    {getDriverStatusLabel(status.name)}
                  </button>
                ))}
              </div>
            )}

            {openChangeMenu === "client" &&
              statusIdAllowsCustomer(statuses, draftStatusId) && (
                <div className="px-5 pb-5">
                  <div className="max-h-80 space-y-2.5 overflow-y-auto">
                    {filteredClients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() =>
                          handleClientSelection(client.user_id.toString())
                        }
                        className={cn(
                          "flex w-full items-center justify-center rounded-[1rem] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-tight transition-all",
                          draftClientId === client.user_id
                            ? "bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100"
                            : "bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#101715] dark:text-zinc-200 dark:hover:bg-white/5",
                        )}
                      >
                        <div className="text-center">
                          <p>{client.name}</p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-400">
                            {client.country} / #{client.user_id}
                          </p>
                        </div>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="rounded-[1rem] border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-6 text-center text-[11px] font-black uppercase tracking-[0.12em] text-emerald-500 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-300">
                        {text.noClientsFound}
                      </div>
                    )}
                  </div>
                </div>
              )}

            {openChangeMenu === "location" && !isLocationChangeDisabled && (
              <div className="space-y-2.5 p-5">
                <button
                  type="button"
                  onClick={() => handleLocationSelection("warehouse_1")}
                  className={cn(
                    "flex w-full flex-col items-start rounded-[1rem] px-4 py-4 text-left transition-all",
                    draftLocationMode === "warehouse_1"
                      ? "bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100"
                      : "bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#101715] dark:text-zinc-200 dark:hover:bg-white/5",
                  )}
                >
                  <span className="text-[13px] font-black uppercase tracking-tight">
                    {text.warehouseDefault}
                  </span>
                  <span className="mt-1 text-[11px] font-bold normal-case leading-4 opacity-70">
                    {
                      getLocationMeta("warehouse_1", activeLocationClientId)
                        .address
                    }
                  </span>
                </button>
                {hasWarehouse2 ? (
                  <button
                    type="button"
                    onClick={() => handleLocationSelection("warehouse_2")}
                    className={cn(
                      "flex w-full flex-col items-start rounded-[1rem] px-4 py-4 text-left transition-all",
                      draftLocationMode === "warehouse_2"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100"
                        : "bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#101715] dark:text-zinc-200 dark:hover:bg-white/5",
                    )}
                  >
                    <span className="text-[13px] font-black uppercase tracking-tight">
                      {text.warehouseSecondary}
                    </span>
                    <span className="mt-1 text-[11px] font-bold normal-case leading-4 opacity-70">
                      {warehouse2Address}
                    </span>
                  </button>
                ) : (
                  <div className="flex w-full flex-col items-start rounded-[1rem] bg-zinc-100 px-4 py-4 text-left text-zinc-400 dark:bg-white/5 dark:text-zinc-500">
                    <span className="text-[13px] font-black uppercase tracking-tight">
                      {text.warehouseSecondary}
                    </span>
                    <span className="mt-1 text-[11px] font-bold normal-case leading-4">
                      {text.noWarehouseSecondary}
                    </span>
                  </div>
                )}
                {savedDeliveryLocationAddress && (
                  <button
                    type="button"
                    onClick={() => handleLocationSelection("delivery")}
                    className={cn(
                      "flex w-full flex-col items-start rounded-[1rem] px-4 py-4 text-left transition-all",
                      draftLocationMode === "delivery"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100"
                        : "bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#101715] dark:text-zinc-200 dark:hover:bg-white/5",
                    )}
                  >
                    <span className="text-[13px] font-black uppercase tracking-tight">
                      {text.newLocation}
                    </span>
                    <span className="mt-1 text-[11px] font-bold normal-case leading-4 opacity-70">
                      {savedDeliveryLocationAddress}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpenChangeMenu("gps")}
                  className="flex w-full items-center justify-center gap-2 rounded-[1rem] border-2 border-emerald-200 bg-emerald-50/70 px-4 py-3.5 text-[12px] font-black uppercase tracking-[0.1em] text-emerald-800 transition-all active:scale-[0.98] dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100"
                >
                  <MapPin size={16} />
                  {selectedPallet.delivery_location
                    ? text.updateGpsLocation
                    : text.useGpsLocation}
                </button>
              </div>
            )}

            {openChangeMenu === "gps" && (
              <div className="p-3">
                <DeliveryLocationMap
                  palletId={selectedPallet.id}
                  language={language}
                  initialLocation={selectedPallet.delivery_location}
                  onSave={savePalletDeliveryLocation}
                />
              </div>
            )}
          </DriverModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDamageModalOpen && damageTargetPallet && (
          <DriverModalShell
            onClose={closeDamageModal}
            title={text.damageModalTitle}
            subtitle={getPalletDisplayName(damageTargetPallet)}
            width="sm"
            bodyClassName="p-0"
          >
            <div className="space-y-4 p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                  {text.damageModalDescription}
                </p>
                <textarea
                  value={damageDescription}
                  onChange={(event) => setDamageDescription(event.target.value)}
                  placeholder={text.damageModalPlaceholder}
                  className="mt-2 h-28 w-full resize-none rounded-[1.2rem] border border-emerald-100 bg-emerald-50/55 px-4 py-3 text-[16px] font-bold leading-6 text-emerald-950 outline-none transition-colors placeholder:text-zinc-400 md:text-[13px] md:leading-5 focus:border-emerald-300 dark:border-white/10 dark:bg-[#151d1a] dark:text-white dark:placeholder:text-zinc-500"
                />
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                  {text.damageModalPhoto}
                </p>

                <input
                  ref={damagePhotoInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleDamagePhotoChange}
                />

                {damagePhotoUrl ? (
                  <div className="mt-2 overflow-hidden rounded-[1.4rem] border border-emerald-100 bg-white p-2 dark:border-white/10 dark:bg-[#101715]">
                    <div className="relative overflow-hidden rounded-[1.1rem]">
                      <img
                        src={damagePhotoUrl}
                        alt={text.damageModalPhoto}
                        className="h-40 w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearDamagePhoto}
                        className="absolute right-3 top-3 rounded-full bg-white/92 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:bg-[#101715]/92 dark:text-emerald-100"
                      >
                        {text.damageModalRemove}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => damagePhotoInputRef.current?.click()}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-dashed border-emerald-200 bg-emerald-50/55 px-4 py-6 text-[12px] font-black uppercase tracking-[0.16em] text-emerald-700 transition-all hover:border-emerald-300 hover:text-emerald-900 dark:border-white/10 dark:bg-[#151d1a] dark:text-emerald-100 dark:hover:text-white"
                  >
                    <Camera size={16} className="shrink-0" />
                    {text.damageModalUpload}
                  </button>
                )}
              </div>
            </div>
          </DriverModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScannedPalletsModalOpen && activeScannedPallet && (
          <DriverModalShell
            onClose={() => setIsScannedPalletsModalOpen(false)}
            title={text.scannedPallets}
            width="sm"
            bodyClassName="p-0"
            headerClassName="items-center"
          >
            <div className="p-4 pt-3.5">
              <div className="max-h-[24rem] overflow-y-auto">
                <div className="space-y-2">
                  {historyPallets.map((pallet) => (
                    <button
                      key={pallet.id}
                      type="button"
                      onClick={() => handleHistoryPalletOpen(pallet.qr_code)}
                      className="flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-emerald-100 bg-white px-3 py-3 text-left transition-all hover:bg-emerald-50/50 dark:border-white/10 dark:bg-[#101715] dark:hover:bg-white/5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                          {pallet.qr_code}
                        </p>
                        {getVisibleClientName(
                          pallet.current_status_id,
                          pallet.client_name,
                        ) && (
                          <p className="mt-1 truncate text-[11px] font-bold text-zinc-500 dark:text-[#9fcbb3]">
                            {getVisibleClientName(
                              pallet.current_status_id,
                              pallet.client_name,
                            )}
                          </p>
                        )}
                        {shouldShowLocationForStatus(
                          pallet.current_status_id,
                        ) && (
                          <p className="mt-1 truncate text-[11px] font-bold text-zinc-400 dark:text-zinc-400">
                            {getLocationLabel(
                              pallet.current_location,
                              language,
                            )}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 self-center rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:border dark:border-white/10 dark:bg-[#101715] dark:text-emerald-100">
                        {getDriverStatusLabel(pallet.current_status_name)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </DriverModalShell>
        )}
      </AnimatePresence>
    </div>
  );
};
