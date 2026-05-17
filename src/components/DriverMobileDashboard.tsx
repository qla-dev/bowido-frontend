import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Camera, ChevronDown, RefreshCcw, X } from 'lucide-react';
import { useApp } from '../AppContext';
import { Pallet, User } from '../types';
import { Badge, Card, cn } from './ui';

interface DriverMobileDashboardProps {
  user: User;
}

type DriverBadgeVariant = 'default' | 'info' | 'warning' | 'success' | 'danger';
type CameraState = 'loading' | 'ready' | 'preview' | 'unsupported' | 'denied' | 'error';

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

type OpenChangeMenu = 'client' | 'status' | 'location' | null;
type DriverLocationMode = 'warehouse_1' | 'warehouse_2' | 'driver_current' | 'manual';

const defaultWarehouseDirectory = {
  warehouse1: 'Industrieweg 18, Eindhoven',
  warehouse2: 'Kanaaldijk 6, Helmond',
  driverCurrent: 'Flight Forum 240, Eindhoven',
};

const clientWarehouseDirectories: Record<
  number,
  {
    warehouse1: string;
    warehouse2: string;
    driverCurrent: string;
  }
> = {
  4: {
    warehouse1: 'Veldhovenweg 18, Eindhoven',
    warehouse2: 'Achtseweg Zuid 151, Eindhoven',
    driverCurrent: 'Leenderweg 210, Eindhoven',
  },
  99: {
    warehouse1: 'Waalhaven Zuidzijde 19, Rotterdam',
    warehouse2: 'Albert Plesmanweg 65, Rotterdam',
    driverCurrent: 'Maasvlakte Plaza 4, Rotterdam',
  },
  100: {
    warehouse1: 'Rajlovacka cesta 18, Sarajevo',
    warehouse2: 'Kurta Schorka 14, Sarajevo',
    driverCurrent: 'Stupska 42, Sarajevo',
  },
};

type DriverCopy = {
  title: string;
  resultLabel: string;
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
  scannedPallets: string;
  showAll: string;
  liveDot: string;
  statusUpdatedTitle: string;
  statusSavedDetailAtClient: string;
  statusSavedDetailReturn: string;
  statusSavedDetailWarehouse: string;
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
  thirdAddress: string;
  useCurrentLocation: string;
  manualLocation: string;
  manualLocationPlaceholder: string;
  applyLocation: string;
};

const driverCopy: Record<'en' | 'nl' | 'bs', DriverCopy> = {
  en: {
    title: 'Scan QR code',
    resultLabel: 'Scanned pallet',
    currentStatus: 'Current status',
    changeLabel: 'Change',
    changeStatus: 'Change status',
    capturePalletPhoto: 'PHOTOGRAPH PALLET',
    reportDamage: 'REPORT DAMAGE',
    scanNext: 'Scan next pallet',
    summaryType: 'Type',
    summaryClient: 'Client',
    summaryLocation: 'Location',
    clientEmpty: 'No client',
    emptyStatus: 'No status',
    selectClient: 'Select client',
    scannedPallets: 'Scanned pallets',
    showAll: 'View all',
    liveDot: 'Live camera',
    statusUpdatedTitle: 'Status updated',
    statusSavedDetailAtClient: 'The pallet is marked at the client.',
    statusSavedDetailReturn: 'The pallet is marked ready for return.',
    statusSavedDetailWarehouse: 'The pallet is marked at Bowido warehouse.',
    damageReportedTitle: 'Damage reported',
    damageReportedDetail: 'The damage report is saved for this pallet.',
    damageModalTitle: 'Report damage',
    damageModalDescription: 'Damage description',
    damageModalPhoto: 'Attach photo',
    damageModalPlaceholder: 'Write what is damaged on the pallet',
    damageModalUpload: 'Add photo',
    damageModalCancel: 'Cancel',
    damageModalSubmit: 'Save report',
    damageModalRemove: 'Remove',
    scanImageFallbackTitle: 'Test scan',
    scanImageFallbackDetail: 'Upload a QR image for demo recognition.',
    scanImageNotRecognizedTitle: 'QR not recognized',
    scanImageNotRecognizedDetail: 'Use a clearer QR image for demo scanning.',
    warehouseDefault: 'Warehouse 1',
    warehouseSecondary: 'Warehouse 2',
    thirdAddress: 'Third address',
    useCurrentLocation: 'Current location',
    manualLocation: 'Manual search',
    manualLocationPlaceholder: 'Enter address',
    applyLocation: 'Set',
  },
  nl: {
    title: 'Scan QR-code',
    resultLabel: 'Gescande pallet',
    currentStatus: 'Huidige status',
    changeLabel: 'Wijzig',
    changeStatus: 'Status wijzigen',
    capturePalletPhoto: 'FOTOGRAFEER PALET',
    reportDamage: 'MELD SCHADE',
    scanNext: 'Scan volgende pallet',
    summaryType: 'Type',
    summaryClient: 'Klant',
    summaryLocation: 'Locatie',
    clientEmpty: 'Geen klant',
    emptyStatus: 'Geen status',
    selectClient: 'Klant kiezen',
    scannedPallets: 'Gescande pallets',
    showAll: 'Toon alles',
    liveDot: 'Live camera',
    statusUpdatedTitle: 'Status bijgewerkt',
    statusSavedDetailAtClient: 'De pallet staat nu bij de klant.',
    statusSavedDetailReturn: 'De pallet staat nu klaar voor retour.',
    statusSavedDetailWarehouse: 'De pallet staat nu in Bowido magazijn.',
    damageReportedTitle: 'Schade gemeld',
    damageReportedDetail: 'De schademelding is opgeslagen voor deze pallet.',
    damageModalTitle: 'Schade melden',
    damageModalDescription: 'Omschrijving schade',
    damageModalPhoto: 'Foto toevoegen',
    damageModalPlaceholder: 'Beschrijf wat er beschadigd is aan de pallet',
    damageModalUpload: 'Foto toevoegen',
    damageModalCancel: 'Annuleren',
    damageModalSubmit: 'Melding opslaan',
    damageModalRemove: 'Verwijderen',
    scanImageFallbackTitle: 'Testscan',
    scanImageFallbackDetail: 'Upload een QR-afbeelding voor demoherkenning.',
    scanImageNotRecognizedTitle: 'QR niet herkend',
    scanImageNotRecognizedDetail: 'Gebruik een duidelijkere QR-afbeelding voor demo scannen.',
    warehouseDefault: 'Magazijn 1',
    warehouseSecondary: 'Magazijn 2',
    thirdAddress: 'Derde adres',
    useCurrentLocation: 'Huidige locatie',
    manualLocation: 'Handmatig zoeken',
    manualLocationPlaceholder: 'Adres invoeren',
    applyLocation: 'Instellen',
  },
  bs: {
    title: 'Skeniraj QR kod',
    resultLabel: 'Skenirana paleta',
    currentStatus: 'Trenutni status',
    changeLabel: 'Promijeni',
    changeStatus: 'Promijeni status',
    capturePalletPhoto: 'USLIKAJ PALETU',
    reportDamage: 'PRIJAVI ŠTETU',
    scanNext: 'Skeniraj sljedeću',
    summaryType: 'Tip',
    summaryClient: 'Klijent',
    summaryLocation: 'Lokacija',
    clientEmpty: 'Bez klijenta',
    emptyStatus: 'Bez statusa',
    selectClient: 'Odaberi klijenta',
    scannedPallets: 'Skenirane palete',
    showAll: 'Prikaži sve',
    liveDot: 'Live kamera',
    statusUpdatedTitle: 'Status ažuriran',
    statusSavedDetailAtClient: 'Paleta je označena kod klijenta.',
    statusSavedDetailReturn: 'Paleta je označena za povrat.',
    statusSavedDetailWarehouse: 'Paleta je označena u Bowido magacinu.',
    damageReportedTitle: 'Šteta prijavljena',
    damageReportedDetail: 'Prijava štete je sačuvana za ovu paletu.',
    damageModalTitle: 'Prijavi štetu',
    damageModalDescription: 'Opis oštećenja',
    damageModalPhoto: 'Priloži sliku',
    damageModalPlaceholder: 'Napiši šta je oštećeno na paleti',
    damageModalUpload: 'Dodaj sliku',
    damageModalCancel: 'Odustani',
    damageModalSubmit: 'Sačuvaj prijavu',
    damageModalRemove: 'Ukloni',
    scanImageFallbackTitle: 'Test skeniranje',
    scanImageFallbackDetail: 'Učitaj QR sliku za demo prepoznavanje.',
    scanImageNotRecognizedTitle: 'QR nije prepoznat',
    scanImageNotRecognizedDetail: 'Koristi QR kod sa BOWNL-0001 do BOWNL-0005.',
    warehouseDefault: 'Magacin 1',
    warehouseSecondary: 'Magacin 2',
    thirdAddress: 'Treća adresa',
    useCurrentLocation: 'Trenutna lokacija',
    manualLocation: 'Ručno unesi',
    manualLocationPlaceholder: 'Unesi adresu',
    applyLocation: 'Postavi',
  },
};

const getWarehouseDirectory = (clientId?: number) =>
  (clientId ? clientWarehouseDirectories[clientId] : null) || defaultWarehouseDirectory;

const inferLocationModeFromAddress = (location: string, clientId?: number): DriverLocationMode => {
  const directory = getWarehouseDirectory(clientId);

  if (location === directory.warehouse2) {
    return 'warehouse_2';
  }

  if (location === directory.driverCurrent) {
    return 'driver_current';
  }

  if (location && location !== directory.warehouse1) {
    return 'manual';
  }

  return 'warehouse_1';
};

const driverDateLocales = {
  en: 'en-GB',
  nl: 'nl-NL',
  bs: 'bs-BA',
} as const;

const driverReturnWindowCopy = {
  en: {
    sentAt: 'Sent',
    returnDue: 'Return by',
    deadlineStatus: 'Deadline',
    withinDeadline: 'Within deadline',
    overdue: 'Overdue',
    daysLeft: 'days left',
    daysLate: 'days late',
  },
  nl: {
    sentAt: 'Verzonden',
    returnDue: 'Retour voor',
    deadlineStatus: 'Termijn',
    withinDeadline: 'Binnen termijn',
    overdue: 'Over tijd',
    daysLeft: 'dagen over',
    daysLate: 'dagen te laat',
  },
  bs: {
    sentAt: 'Poslana',
    returnDue: 'Povrat do',
    deadlineStatus: 'Rok',
    withinDeadline: 'U roku',
    overdue: 'Van roka',
    daysLeft: 'dana do isteka',
    daysLate: 'dana van roka',
  },
} as const;

export const DriverMobileDashboard: React.FC<DriverMobileDashboardProps> = ({ user }) => {
  const { pallets, clients, updatePalletStatus, statuses, language } = useApp();
  const [demoPallets, setDemoPallets] = useState<Pallet[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(null);
  const [palletPhotoUrl, setPalletPhotoUrl] = useState<string | null>(null);
  const [damagePhotoUrl, setDamagePhotoUrl] = useState<string | null>(null);
  const [damageDescription, setDamageDescription] = useState('');
  const [scannedPalletIds, setScannedPalletIds] = useState<number[]>([]);
  const [isScannedPalletsModalOpen, setIsScannedPalletsModalOpen] = useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [activeScannedPalletId, setActiveScannedPalletId] = useState<number | null>(null);
  const [openChangeMenu, setOpenChangeMenu] = useState<OpenChangeMenu>(null);
  const [draftStatusId, setDraftStatusId] = useState<number>(4);
  const [draftClientId, setDraftClientId] = useState<number | undefined>(undefined);
  const [draftLocationMode, setDraftLocationMode] = useState<DriverLocationMode>('warehouse_1');
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [cameraState, setCameraState] = useState<CameraState>('loading');
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
  const streamRef = useRef<MediaStream | null>(null);
  const scanImageInputRef = useRef<HTMLInputElement | null>(null);
  const palletPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const damagePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const palletPhotoUrlRef = useRef<string | null>(null);
  const damagePhotoUrlRef = useRef<string | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const palletsRef = useRef(pallets);
  const scanBusyRef = useRef(false);
  const lastScanAtRef = useRef(0);
  const selectedPalletIdRef = useRef<number | null>(null);
  const nextDemoPalletIdRef = useRef(-1);

  const text = driverCopy[language] || driverCopy.en;
  const allDriverPallets = [...demoPallets, ...pallets];
  const isScannerOpen = selectedPalletId === null;
  const selectedPallet = selectedPalletId
    ? allDriverPallets.find((item) => item.id === selectedPalletId) || null
    : null;
  const driverStatusOptions = [4, 3, 1, 5]
    .map((statusId) => statuses.find((item) => item.id === statusId))
    .filter((status): status is NonNullable<typeof status> => Boolean(status));
  const scannedPallets = scannedPalletIds
    .map((palletId) => allDriverPallets.find((item) => item.id === palletId))
    .filter((item): item is Pallet => Boolean(item));
  const activeScannedPallet =
    scannedPallets.find((item) => item.id === activeScannedPalletId) || scannedPallets[0] || null;
  const actionButtonClass =
    'flex h-[4.45rem] w-full items-center justify-center gap-2 rounded-[1.55rem] border border-emerald-300 bg-[#00A655] px-4 text-center text-[0.82rem] font-black uppercase leading-[1.15] tracking-[0.08em] text-white shadow-[0_22px_44px_-22px_rgba(0,166,85,0.65)] transition-all active:scale-[0.99] dark:border-emerald-400/25 dark:shadow-[0_22px_44px_-22px_rgba(0,0,0,0.55)]';
  const changeTriggerClass =
    'inline-flex h-9 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 text-[10px] font-black uppercase leading-none tracking-[0.14em] text-emerald-700 shadow-[0_10px_24px_-18px_rgba(0,166,85,0.45)] transition-all active:scale-[0.98] hover:border-emerald-300 hover:text-emerald-900 dark:border-white/10 dark:bg-white/10 dark:text-emerald-100 dark:hover:bg-white/14 dark:hover:text-white';
  const getVisibleClientName = (statusId: number, clientName?: string) =>
    statusId === 4 ? clientName || text.clientEmpty : null;
  const getDriverStatusLabel = (statusName?: string) => {
    if (!statusName) {
      return text.emptyStatus;
    }

    if (statusName === 'Bij de klant') {
      if (language === 'bs') {
        return 'Kod klijenta';
      }

      if (language === 'en') {
        return 'At client';
      }

      return 'Bij de klant';
    }

    if (statusName === 'Voor retour') {
      return 'Voor retour';
    }

    if (statusName === 'Bowido BIH') {
      return 'Bowido BIH';
    }

    if (statusName === 'Bowido(NL)') {
      return 'Bowido NL';
    }

    return statusName;
  };
  const getLocationMeta = (
    mode: DriverLocationMode,
    clientId?: number,
    manualValue = manualLocationInput
  ) => {
    const directory = getWarehouseDirectory(clientId);

    switch (mode) {
      case 'warehouse_2':
        return { label: text.warehouseSecondary, address: directory.warehouse2 };
      case 'driver_current':
        return { label: text.thirdAddress, address: directory.driverCurrent };
      case 'manual':
        return {
          label: text.thirdAddress,
          address: manualValue.trim() || directory.driverCurrent,
        };
      default:
        return { label: text.warehouseDefault, address: directory.warehouse1 };
    }
  };
  const activeLocationClientId = draftStatusId === 4 ? draftClientId : undefined;
  const selectedLocationMeta = getLocationMeta(draftLocationMode, activeLocationClientId);
  const selectedClientName =
    draftStatusId === 4
      ? clients.find((client) => client.user_id === draftClientId)?.name ||
        selectedPallet?.client_name ||
        text.clientEmpty
      : null;
  const isAndroidDevice =
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const returnWindowText = driverReturnWindowCopy[language] || driverReturnWindowCopy.en;
  const getClientReturnInfo = (pallet: Pallet | null, clientId?: number) => {
    if (!pallet || !clientId) {
      return null;
    }

    const clientDetail = clients.find((client) => client.user_id === clientId);

    if (!clientDetail) {
      return null;
    }

    const sentDate = new Date(pallet.last_status_changed_at);
    const sentAtMidnight = new Date(sentDate.getFullYear(), sentDate.getMonth(), sentDate.getDate());
    const today = new Date();
    const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceSent = Math.max(
      0,
      Math.floor((todayAtMidnight.getTime() - sentAtMidnight.getTime()) / msPerDay)
    );
    const dueDate = new Date(sentAtMidnight);
    dueDate.setDate(dueDate.getDate() + clientDetail.grace_period_days);
    const remainingDays = clientDetail.grace_period_days - daysSinceSent;
    const isOverdue = remainingDays < 0;
    const dateFormatter = new Intl.DateTimeFormat(driverDateLocales[language] || 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return {
      sentAtLabel: dateFormatter.format(sentDate),
      dueDateLabel: dateFormatter.format(dueDate),
      deadlineTitle: isOverdue ? returnWindowText.overdue : returnWindowText.withinDeadline,
      deadlineDetail: isOverdue
        ? `${Math.abs(remainingDays)} ${returnWindowText.daysLate}`
        : `${remainingDays} ${returnWindowText.daysLeft}`,
      isOverdue,
    };
  };
  const clientReturnInfo = getClientReturnInfo(selectedPallet, draftStatusId === 4 ? draftClientId : undefined);

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
    setDraftStatusId([1, 3, 4, 5].includes(selectedPallet.current_status_id) ? selectedPallet.current_status_id : 0);
    setDraftClientId(selectedPallet.user_id);
    const nextLocationMode = inferLocationModeFromAddress(
      selectedPallet.current_location,
      selectedPallet.user_id
    );
    setDraftLocationMode(nextLocationMode);
    setManualLocationInput(nextLocationMode === 'manual' ? selectedPallet.current_location : '');
  }, [selectedPallet]);

  useEffect(() => {
    if (scannedPallets.length === 0) {
      setIsScannedPalletsModalOpen(false);
      setActiveScannedPalletId(null);
      return;
    }

    if (activeScannedPalletId && scannedPallets.some((item) => item.id === activeScannedPalletId)) {
      return;
    }

    setActiveScannedPalletId(scannedPallets[0].id);
  }, [activeScannedPalletId, scannedPallets]);

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
        const supportedFormats = await detectorApi.getSupportedFormats().catch(() => []);

        if (supportedFormats.length > 0 && !supportedFormats.includes('qr_code')) {
          return null;
        }
      }

      detectorRef.current = new detectorApi({
        formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
      });
    } catch {
      detectorRef.current = null;
    }

    return detectorRef.current;
  };

  const findMatchingPallet = (rawValue: string) => {
    const normalized = rawValue.trim().toUpperCase();

    return (
      palletsRef.current.find((item) => item.qr_code.toUpperCase() === normalized) ||
      palletsRef.current.find((item) => normalized.includes(item.qr_code.toUpperCase())) ||
      null
    );
  };

  const createDemoPallet = (rawValue: string): Pallet => ({
    id: nextDemoPalletIdRef.current--,
    qr_code: rawValue.trim() || `DEMO-${Math.abs(nextDemoPalletIdRef.current)}`,
    current_status_id: 0,
    current_status_name: '',
    type: 'Kraksna (Standard)',
    current_location: defaultWarehouseDirectory.warehouse1,
    is_ghost: false,
    is_active: true,
    last_status_changed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  const handleDetectedCode = (rawValue: string) => {
    const matchedPallet = findMatchingPallet(rawValue);
    const nextPallet = matchedPallet || createDemoPallet(rawValue);

    if (!matchedPallet) {
      setDemoPallets((current) => [nextPallet, ...current.filter((item) => item.qr_code !== nextPallet.qr_code)]);
    }

    setScannedPalletIds((current) => [nextPallet.id, ...current.filter((item) => item !== nextPallet.id)]);
    selectedPalletIdRef.current = nextPallet.id;
    setSelectedPalletId(nextPallet.id);
    lastScanAtRef.current = Date.now();
  };

  const detectFromCamera = async () => {
    const detector = detectorRef.current;
    const video = videoRef.current;

    if (!detector || !video) {
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
    if (now - lastScanAtRef.current < 1300) {
      return;
    }

    scanBusyRef.current = true;

    try {
      const codes = await detector.detect(video);
      const firstCode = codes.find((item) => item.rawValue?.trim());
      if (firstCode?.rawValue) {
        handleDetectedCode(firstCode.rawValue);
      }
    } catch {
      setCameraState((current) => (current === 'ready' ? 'preview' : current));
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

    if (!isScannerOpen) {
      stopCamera();
      return;
    }

    const startCamera = async () => {
      setCameraState('loading');
      detectorRef.current = null;

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unsupported');
        return;
      }

      try {
        const detector = await getBarcodeDetector();
        const cameraAttempts: MediaStreamConstraints[] = [
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 1280 },
            },
          },
          {
            audio: false,
            video: {
              facingMode: 'environment',
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        if (detector) {
          setCameraState('ready');
          runDetectionLoop();

          scanAssistTimeoutRef.current = window.setTimeout(() => {
            if (selectedPalletIdRef.current === null) {
              setCameraState((current) => (current === 'ready' ? 'preview' : current));
            }
          }, 4500);
        } else {
          setCameraState('preview');
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          setCameraState('denied');
          return;
        }

        setCameraState('error');
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();

      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [isScannerOpen]);

  const showFlash = (title: string, detail: string, variant: DriverBadgeVariant) => {
    setFlashMessage({ title, detail, variant });

    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
    }

    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashMessage(null);
    }, 2400);
  };

  const simulateScan = () => {
    if (isScanning || pallets.length === 0) {
      return;
    }

    setIsScanning(true);

    window.setTimeout(() => {
      scanIndexRef.current = (scanIndexRef.current + 1) % pallets.length;
      const nextPallet = pallets[scanIndexRef.current];
      setScannedPalletIds((current) => [nextPallet.id, ...current.filter((item) => item !== nextPallet.id)]);
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
      palletPhotoInputRef.current.value = '';
    }

    setPalletPhotoUrl(null);
  };

  const clearDamageDraft = () => {
    if (damagePhotoInputRef.current) {
      damagePhotoInputRef.current.value = '';
    }

    if (damagePhotoUrlRef.current) {
      URL.revokeObjectURL(damagePhotoUrlRef.current);
      damagePhotoUrlRef.current = null;
    }

    setDamagePhotoUrl(null);
    setDamageDescription('');
  };

  const clearDamagePhoto = () => {
    if (damagePhotoUrlRef.current) {
      URL.revokeObjectURL(damagePhotoUrlRef.current);
      damagePhotoUrlRef.current = null;
    }

    if (damagePhotoInputRef.current) {
      damagePhotoInputRef.current.value = '';
    }

    setDamagePhotoUrl(null);
  };

  const handleScanNext = () => {
    clearPalletPhoto();
    clearDamageDraft();
    setIsDamageModalOpen(false);
    setOpenChangeMenu(null);
    selectedPalletIdRef.current = null;
    setSelectedPalletId(null);
    lastScanAtRef.current = 0;
  };

  const persistDriverStatus = (
    nextStatusId: number,
    clientId?: number,
    nextLocation = selectedLocationMeta.address
  ) => {
    if (!selectedPallet || (nextStatusId === 4 && !clientId)) {
      return;
    }

    const nextStatusName = statuses.find((item) => item.id === nextStatusId)?.name || '';
    const nextClientName = clientId
      ? clients.find((client) => client.user_id === clientId)?.name
      : undefined;
    const isDemoPallet = selectedPallet.id < 0;

    if (isDemoPallet) {
      setDemoPallets((current) =>
        current.map((item) => {
          if (item.id !== selectedPallet.id) {
            return item;
          }

          return {
            ...item,
            current_status_id: nextStatusId,
            current_status_name: nextStatusName,
            current_location: nextLocation,
            last_status_changed_at: new Date().toISOString(),
            user_id: nextStatusId === 4 ? clientId : undefined,
            client_name: nextStatusId === 4 ? nextClientName : undefined,
          };
        })
      );
    } else {
      updatePalletStatus(
        selectedPallet.id,
        nextStatusId,
        user.id,
        user.name,
        nextLocation,
        nextStatusId === 4
          ? 'Driver marked pallet as Bij de klant.'
          : nextStatusId === 5
            ? 'Driver marked pallet as Voor retour.'
            : 'Driver marked pallet in Bowido warehouse.',
        nextStatusId === 4 ? clientId : undefined
      );
    }

    showFlash(
      text.statusUpdatedTitle,
      nextStatusId === 4
        ? text.statusSavedDetailAtClient
        : nextStatusId === 5
          ? text.statusSavedDetailReturn
          : text.statusSavedDetailWarehouse,
      'success'
    );
  };

  const handleStatusSelection = (statusId: number) => {
    setOpenChangeMenu(null);
    setDraftStatusId(statusId);
    const nextLocationClientId = statusId === 4 ? draftClientId : undefined;
    const nextLocation = getLocationMeta(
      draftLocationMode,
      nextLocationClientId,
      manualLocationInput
    ).address;

    if (statusId === 5 || statusId === 1 || statusId === 3) {
      persistDriverStatus(statusId, undefined, nextLocation);
      return;
    }

    if (draftClientId) {
      persistDriverStatus(4, draftClientId, nextLocation);
      return;
    }

    setOpenChangeMenu('client');
  };

  const handleClientSelection = (value: string) => {
    const nextClientId = value ? Number(value) : undefined;
    setOpenChangeMenu(null);
    setDraftClientId(nextClientId);

    if (draftStatusId === 4 && nextClientId) {
      const nextLocation = getLocationMeta(draftLocationMode, nextClientId, manualLocationInput).address;
      persistDriverStatus(4, nextClientId, nextLocation);
    }
  };

  const handleLocationSelection = (mode: DriverLocationMode) => {
    setOpenChangeMenu(null);
    setDraftLocationMode(mode);
    const nextLocation = getLocationMeta(mode, activeLocationClientId).address;

    if (selectedPallet) {
      persistDriverStatus(draftStatusId, draftStatusId === 4 ? draftClientId : undefined, nextLocation);
    }
  };

  const handleManualLocationApply = () => {
    const nextLocation = manualLocationInput.trim();

    if (!nextLocation) {
      return;
    }

    setOpenChangeMenu(null);
    setDraftLocationMode('manual');

    if (selectedPallet) {
      persistDriverStatus(draftStatusId, draftStatusId === 4 ? draftClientId : undefined, nextLocation);
    }
  };

  const openPalletPhotoPicker = () => {
    palletPhotoInputRef.current?.click();
  };

  const handlePalletPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (palletPhotoUrlRef.current) {
      URL.revokeObjectURL(palletPhotoUrlRef.current);
    }

    const nextPhotoUrl = URL.createObjectURL(file);
    palletPhotoUrlRef.current = nextPhotoUrl;
    setPalletPhotoUrl(nextPhotoUrl);
    event.target.value = '';
  };

  const openDamageModal = () => {
    clearDamageDraft();
    setIsDamageModalOpen(true);
  };

  const closeDamageModal = () => {
    clearDamageDraft();
    setIsDamageModalOpen(false);
  };

  const handleDamagePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    event.target.value = '';
  };

  const handleDamageReportSubmit = () => {
    if (!selectedPallet || !damagePhotoUrl || !damageDescription.trim()) {
      return;
    }

    showFlash(text.damageReportedTitle, text.damageReportedDetail, 'warning');
    closeDamageModal();
  };

  const openScanImagePicker = () => {
    scanImageInputRef.current?.click();
  };

  const handleScannerFrameClick = () => {
    if (cameraState === 'ready' || isScanning) {
      return;
    }

    if (isAndroidDevice) {
      openScanImagePicker();
      return;
    }

    simulateScan();
  };

  const handleScanImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const detector = await getBarcodeDetector();

    if (!detector) {
      simulateScan();
      return;
    }

    let bitmap: ImageBitmap | null = null;

    try {
      bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      const firstCode = codes.find((item) => item.rawValue?.trim());

      if (firstCode?.rawValue) {
        handleDetectedCode(firstCode.rawValue);
        return;
      }

      showFlash(text.scanImageNotRecognizedTitle, text.scanImageNotRecognizedDetail, 'warning');
    } catch {
      showFlash(text.scanImageFallbackTitle, text.scanImageFallbackDetail, 'info');
    } finally {
      bitmap?.close();
    }
  };

  const openScannedPalletsModal = () => {
    if (scannedPallets.length === 0) {
      return;
    }

    setActiveScannedPalletId(scannedPallets[0].id);
    setIsScannedPalletsModalOpen(true);
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 pb-6">
      {isScannerOpen && (
        <div className="flex min-h-[80dvh] flex-col justify-center px-1 py-2 transition-all duration-500">
          <input
            ref={scanImageInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleScanImageChange}
          />

          <div className="relative text-center">
            <h1 className="mt-3 text-[2rem] font-black leading-none tracking-[-0.04em] text-emerald-950 dark:text-white">
              {text.title}
            </h1>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.button
              key="scanner-view"
              type="button"
              onClick={handleScannerFrameClick}
              initial={{ opacity: 0.82, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className={cn(
                'relative mx-auto mt-8 flex h-[60dvh] min-h-[30rem] w-full items-center justify-center overflow-hidden rounded-[2.9rem] border border-emerald-200 bg-white text-white shadow-[0_30px_60px_-28px_rgba(0,166,85,0.28)] transition-all duration-500 dark:border-white/10 dark:bg-[#172d22] dark:shadow-[0_32px_64px_-28px_rgba(0,0,0,0.55)]',
                cameraState === 'ready' ? '' : 'active:scale-[0.98]'
              )}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  'absolute inset-0 h-full w-full object-cover transition-opacity duration-300',
                  cameraState === 'ready' || cameraState === 'preview' ? 'opacity-100' : 'opacity-0'
                )}
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(236,253,245,0.10)_0%,rgba(255,255,255,0.02)_32%,rgba(236,253,245,0.18)_100%)] dark:bg-[linear-gradient(180deg,rgba(15,35,26,0.16)_0%,rgba(20,45,34,0.08)_35%,rgba(15,35,26,0.34)_100%)]" />
              <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(16,185,129,0.8)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.8)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-[0.12]" />
              <div className="absolute inset-3 rounded-[2rem] border border-emerald-300/20 dark:border-white/10" />
              <div className="absolute left-5 right-5 top-5 h-14 rounded-full bg-emerald-400/12 blur-2xl dark:bg-emerald-400/8" />
              {(cameraState === 'ready' || cameraState === 'preview') && (
                <div className="absolute right-6 top-6 z-10 flex h-3 w-3 items-center justify-center">
                  <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
                  <span className="sr-only">{text.liveDot}</span>
                </div>
              )}

              <motion.div
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-7 top-7 h-14 w-14 rounded-tl-[1.2rem] border-l-4 border-t-4 border-emerald-400/95"
              />
              <motion.div
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.12 }}
                className="absolute right-7 top-7 h-14 w-14 rounded-tr-[1.2rem] border-r-4 border-t-4 border-emerald-400/95"
              />
              <motion.div
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.24 }}
                className="absolute bottom-7 left-7 h-14 w-14 rounded-bl-[1.2rem] border-b-4 border-l-4 border-emerald-400/95"
              />
              <motion.div
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.36 }}
                className="absolute bottom-7 right-7 h-14 w-14 rounded-br-[1.2rem] border-b-4 border-r-4 border-emerald-400/95"
              />

              {cameraState === 'ready' ? (
                <motion.div
                  animate={{ y: [-158, 158, -158] }}
                  transition={{ duration: 1.45, repeat: Infinity, ease: 'linear' }}
                  className="absolute left-12 right-12 h-[2px] bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.9)]"
                />
              ) : isScanning || cameraState === 'loading' ? (
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/60">
                  <span className="h-4 w-4 animate-pulse rounded-full bg-emerald-400" />
                </div>
              ) : (
                <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-emerald-200 bg-emerald-50 shadow-inner shadow-emerald-100/80 dark:border-white/10 dark:bg-[#1f3a2d] dark:shadow-black/25">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="h-3 w-3 rounded-sm bg-emerald-400/90" />
                    <span className="h-3 w-3 rounded-sm bg-emerald-300/65" />
                    <span className="h-3 w-3 rounded-sm bg-emerald-300/65" />
                    <span className="h-3 w-3 rounded-sm bg-emerald-400/90" />
                  </div>
                </div>
              )}
            </motion.button>
          </AnimatePresence>

          {scannedPallets.length > 0 && (
            <div className="mt-4 h-44 w-full">
              <div className="h-full overflow-hidden rounded-[1.65rem] border border-emerald-100 bg-white shadow-[0_18px_40px_-28px_rgba(0,166,85,0.22)] dark:border-white/10 dark:bg-[#1a3327] dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between gap-3 border-b border-emerald-100 px-4 py-3 dark:border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
                    {text.scannedPallets}
                  </p>
                  <button
                    type="button"
                    onClick={openScannedPalletsModal}
                    className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 transition-colors hover:text-emerald-800 dark:text-emerald-200 dark:hover:text-white"
                  >
                    {text.showAll}
                  </button>
                </div>
                <div className="h-[calc(100%-2.8rem)] overflow-y-auto p-2">
                  <div className="space-y-2">
                    {scannedPallets.map((pallet) => (
                      <div
                        key={pallet.id}
                        className="flex items-start justify-between gap-3 rounded-[1.15rem] border border-emerald-100 bg-emerald-50/60 px-3 py-3 dark:border-white/10 dark:bg-[#203d31]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                            {pallet.qr_code}
                          </p>
                          {getVisibleClientName(pallet.current_status_id, pallet.client_name) && (
                            <p className="mt-1 truncate text-[11px] font-bold text-zinc-500 dark:text-[#9fcbb3]">
                              {getVisibleClientName(pallet.current_status_id, pallet.client_name)}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:border dark:border-white/10 dark:bg-[#172d22] dark:text-emerald-100">
                          {getDriverStatusLabel(pallet.current_status_name)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {flashMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="pointer-events-none fixed inset-x-0 top-24 z-[70] flex justify-center px-4"
          >
            <Card className="w-full max-w-sm border-emerald-100 bg-white/95 shadow-[0_26px_50px_-28px_rgba(0,166,85,0.35)] dark:border-white/10 dark:bg-[#1a3327]/95 dark:shadow-[0_26px_50px_-28px_rgba(0,0,0,0.55)]">
              <div>
                  <Badge variant={flashMessage.variant}>{flashMessage.title}</Badge>
                  <p className="mt-2 text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                    {flashMessage.detail}
                  </p>
              </div>
            </Card>
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
            className="mx-auto flex min-h-[82dvh] w-full max-w-[25rem] flex-col justify-between pt-8"
          >
            <Card noPadding className="mx-auto flex min-h-full w-full flex-col overflow-visible border-transparent bg-transparent shadow-none">
              <div className="px-5 pb-5 pt-8">
                <div className="text-center">
                  <p className="text-[1.15rem] font-black uppercase tracking-[0.14em] text-emerald-900 dark:text-white">
                    {selectedPallet.qr_code}
                  </p>
                  {clientReturnInfo && (
                    <div className="mx-auto mt-4 grid max-w-[21rem] grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                          {returnWindowText.sentAt}
                        </p>
                        <p className="mt-1.5 text-[12px] font-black tracking-tight text-emerald-950 dark:text-white">
                          {clientReturnInfo.sentAtLabel}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                          {returnWindowText.returnDue}
                        </p>
                        <p className="mt-1.5 text-[12px] font-black tracking-tight text-emerald-950 dark:text-white">
                          {clientReturnInfo.dueDateLabel}
                        </p>
                      </div>
                      <div>
                        <p
                          className={cn(
                            'text-[9px] font-black uppercase tracking-[0.16em]',
                            clientReturnInfo.isOverdue
                              ? 'text-rose-600 dark:text-rose-200'
                              : 'text-emerald-600 dark:text-emerald-200'
                          )}
                        >
                          {returnWindowText.deadlineStatus}
                        </p>
                        <p
                          className={cn(
                            'mt-1.5 text-[12px] font-black tracking-tight',
                            clientReturnInfo.isOverdue
                              ? 'text-rose-700 dark:text-rose-100'
                              : 'text-emerald-950 dark:text-white'
                          )}
                        >
                          {clientReturnInfo.deadlineTitle}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-[10px] font-black leading-4',
                            clientReturnInfo.isOverdue
                              ? 'text-rose-600 dark:text-rose-200'
                              : 'text-zinc-600 dark:text-[#cce0d3]'
                          )}
                        >
                          {clientReturnInfo.deadlineDetail}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative mt-8 rounded-[2rem] border border-emerald-100 bg-white/90 px-6 py-7 text-center shadow-[0_24px_44px_-28px_rgba(0,166,85,0.26)] dark:border-white/10 dark:bg-[#1a3327]/92 dark:shadow-[0_24px_44px_-28px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                    {text.currentStatus}
                  </p>
                  <p className="mt-3 text-[2.75rem] font-black uppercase leading-[0.96] tracking-[-0.07em] text-emerald-950 dark:text-white">
                    {getDriverStatusLabel(selectedPallet.current_status_name)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenChangeMenu((current) => (current === 'status' ? null : 'status'))}
                    className={cn(changeTriggerClass, 'mt-4 h-10 px-4 text-[11px]')}
                  >
                    {text.changeStatus}
                    <ChevronDown
                      size={13}
                      className={cn('transition-transform', openChangeMenu === 'status' && 'rotate-180')}
                    />
                  </button>
                  <AnimatePresence>
                    {openChangeMenu === 'status' && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        className="absolute left-1/2 top-[calc(100%+0.8rem)] z-20 w-[13rem] -translate-x-1/2 overflow-hidden rounded-[1.2rem] border border-emerald-100 bg-white p-2 shadow-[0_24px_44px_-26px_rgba(0,166,85,0.45)] dark:border-white/10 dark:bg-[#1f3a2d] dark:shadow-[0_24px_44px_-26px_rgba(0,0,0,0.55)]"
                      >
                        <div className="space-y-1">
                          {driverStatusOptions.map((status) => (
                            <button
                              key={status.id}
                              type="button"
                              onClick={() => handleStatusSelection(status.id)}
                              className={cn(
                                'flex w-full items-center justify-center rounded-[0.95rem] px-3 py-2.5 text-center text-[12px] font-black uppercase tracking-tight transition-all',
                                draftStatusId === status.id
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                                  : 'text-zinc-600 hover:bg-emerald-50/80 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-emerald-100'
                              )}
                            >
                              {getDriverStatusLabel(status.name)}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="mt-5 space-y-3.5 text-left">
                  {selectedClientName && (
                    <div className="relative rounded-[1.6rem] border border-emerald-100 bg-white/88 p-5 shadow-[0_18px_34px_-28px_rgba(0,166,85,0.18)] dark:border-white/10 dark:bg-[#1a3327]/88">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                            {text.summaryClient}
                          </p>
                          <p className="mt-1 text-[1.24rem] font-black leading-6 tracking-[-0.03em] text-emerald-950 dark:text-white">
                            {selectedClientName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOpenChangeMenu((current) => (current === 'client' ? null : 'client'))}
                          className={changeTriggerClass}
                        >
                          {text.changeLabel}
                          <ChevronDown
                            size={13}
                            className={cn('transition-transform', openChangeMenu === 'client' && 'rotate-180')}
                          />
                        </button>
                      </div>
                      <AnimatePresence>
                        {openChangeMenu === 'client' && draftStatusId === 4 && (
                          <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.98 }}
                            className="absolute left-0 top-[calc(100%+0.65rem)] z-20 w-full overflow-hidden rounded-[1.2rem] border border-emerald-100 bg-white p-2 shadow-[0_24px_44px_-26px_rgba(0,166,85,0.45)] dark:border-white/10 dark:bg-[#1f3a2d] dark:shadow-[0_24px_44px_-26px_rgba(0,0,0,0.55)]"
                          >
                            <div className="max-h-48 space-y-1 overflow-y-auto">
                              {clients.map((client) => (
                                <button
                                  key={client.id}
                                  type="button"
                                  onClick={() => handleClientSelection(client.user_id.toString())}
                                  className={cn(
                                    'flex w-full items-center justify-center rounded-[0.95rem] px-3 py-2 text-center text-[12px] font-black uppercase tracking-tight transition-all',
                                    draftClientId === client.user_id
                                      ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                                      : 'text-zinc-600 hover:bg-emerald-50/80 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-emerald-100'
                                  )}
                                >
                                  {client.name}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="relative rounded-[1.6rem] border border-emerald-100 bg-white/88 p-5 shadow-[0_18px_34px_-28px_rgba(0,166,85,0.18)] dark:border-white/10 dark:bg-[#1a3327]/88">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                          {text.summaryLocation}
                        </p>
                        <p className="mt-1 text-[1.24rem] font-black leading-6 tracking-[-0.03em] text-emerald-950 dark:text-white">
                          {selectedLocationMeta.label}
                        </p>
                        <p className="mt-1.5 text-[15px] font-bold leading-6 text-zinc-600 dark:text-[#cce0d3]">
                          {selectedLocationMeta.address}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenChangeMenu((current) => (current === 'location' ? null : 'location'))}
                        className={changeTriggerClass}
                      >
                        {text.changeLabel}
                        <ChevronDown
                          size={13}
                          className={cn('transition-transform', openChangeMenu === 'location' && 'rotate-180')}
                        />
                      </button>
                    </div>
                    <AnimatePresence>
                      {openChangeMenu === 'location' && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          className="absolute left-0 top-[calc(100%+0.65rem)] z-20 w-full overflow-hidden rounded-[1.2rem] border border-emerald-100 bg-white p-2 shadow-[0_24px_44px_-26px_rgba(0,166,85,0.45)] dark:border-white/10 dark:bg-[#1f3a2d] dark:shadow-[0_24px_44px_-26px_rgba(0,0,0,0.55)]"
                        >
                          <div className="space-y-1">
                            <button
                              type="button"
                              onClick={() => handleLocationSelection('warehouse_1')}
                              className={cn(
                                'flex w-full items-center justify-between rounded-[0.95rem] px-3 py-2 text-left text-[12px] font-black uppercase tracking-tight transition-all',
                                draftLocationMode === 'warehouse_1'
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                                  : 'text-zinc-600 hover:bg-emerald-50/80 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-emerald-100'
                              )}
                            >
                              <span>{text.warehouseDefault}</span>
                              <span className="truncate pl-3 text-[10px] font-bold normal-case tracking-normal opacity-70">
                                {getLocationMeta('warehouse_1', activeLocationClientId).address}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLocationSelection('warehouse_2')}
                              className={cn(
                                'flex w-full items-center justify-between rounded-[0.95rem] px-3 py-2 text-left text-[12px] font-black uppercase tracking-tight transition-all',
                                draftLocationMode === 'warehouse_2'
                                  ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                                  : 'text-zinc-600 hover:bg-emerald-50/80 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-emerald-100'
                              )}
                            >
                              <span>{text.warehouseSecondary}</span>
                              <span className="truncate pl-3 text-[10px] font-bold normal-case tracking-normal opacity-70">
                                {getLocationMeta('warehouse_2', activeLocationClientId).address}
                              </span>
                            </button>
                          </div>

                          <div className="mt-3 rounded-[1rem] bg-emerald-50/80 p-3 dark:bg-white/5">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                              {text.thirdAddress}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleLocationSelection('driver_current')}
                              className={cn(
                                'mt-2 flex w-full items-center justify-between rounded-[0.95rem] px-3 py-2 text-left text-[12px] font-black uppercase tracking-tight transition-all',
                                draftLocationMode === 'driver_current'
                                  ? 'bg-white text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                                  : 'bg-white/80 text-zinc-600 hover:bg-white dark:bg-[#203d31] dark:text-zinc-300 dark:hover:bg-white/10'
                              )}
                            >
                              <span>{text.useCurrentLocation}</span>
                              <span className="truncate pl-3 text-[10px] font-bold normal-case tracking-normal opacity-70">
                                {getLocationMeta('driver_current', activeLocationClientId).address}
                              </span>
                            </button>

                            <div className="mt-2 flex gap-2">
                              <input
                                value={manualLocationInput}
                                onChange={(event) => setManualLocationInput(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleManualLocationApply();
                                  }
                                }}
                                placeholder={text.manualLocationPlaceholder}
                                className="h-10 flex-1 rounded-[0.95rem] border border-emerald-200 bg-white px-3 text-[12px] font-bold text-emerald-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-400 dark:border-white/10 dark:bg-[#203d31] dark:text-white dark:placeholder:text-zinc-500"
                              />
                              <button
                                type="button"
                                onClick={handleManualLocationApply}
                                className="rounded-[0.95rem] bg-[#00A655] px-4 text-[11px] font-black uppercase tracking-[0.14em] text-white transition-all active:scale-[0.98]"
                              >
                                {text.applyLocation}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="mt-auto flex flex-col items-center space-y-4 p-5 pb-5 pt-7">
                <input
                  ref={palletPhotoInputRef}
                  id="driver-pallet-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePalletPhotoChange}
                />

                <div className="w-full max-w-[22.25rem] space-y-3.5">
                  <button
                    type="button"
                    className={actionButtonClass}
                    onClick={handleScanNext}
                  >
                    <RefreshCcw size={18} className="shrink-0" />
                    {text.scanNext}
                  </button>

                  <div className="grid w-full grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={openPalletPhotoPicker}
                      className={actionButtonClass}
                    >
                      <Camera size={18} className="shrink-0" />
                      {text.capturePalletPhoto}
                    </button>
                    <button
                      type="button"
                      onClick={openDamageModal}
                      className={actionButtonClass}
                    >
                      <AlertTriangle size={18} className="shrink-0" />
                      {text.reportDamage}
                    </button>
                  </div>
                </div>

                {palletPhotoUrl && (
                  <div className="w-full overflow-hidden rounded-[1.7rem] border border-emerald-100 bg-white p-2 shadow-[0_18px_40px_-28px_rgba(0,166,85,0.32)] dark:border-white/10 dark:bg-[#1a3327] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                    <div className="relative overflow-hidden rounded-[1.3rem] bg-emerald-50 dark:bg-[#203d31]">
                      <img
                        src={palletPhotoUrl}
                        alt={text.capturePalletPhoto}
                        className="h-40 w-full object-cover"
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDamageModalOpen && selectedPallet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/25 px-4 py-6 backdrop-blur-[2px] dark:bg-black/45"
            onClick={closeDamageModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_30px_60px_-28px_rgba(0,166,85,0.32)] dark:border-white/10 dark:bg-[#172d22] dark:shadow-[0_30px_60px_-28px_rgba(0,0,0,0.65)]"
            >
              <div className="flex items-center justify-between border-b border-emerald-100 px-5 py-4 dark:border-white/10">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                    {text.damageModalTitle}
                  </p>
                  <p className="mt-1 text-[13px] font-black uppercase tracking-[0.08em] text-emerald-950 dark:text-white">
                    {selectedPallet.qr_code}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDamageModal}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-all active:scale-[0.98] dark:bg-[#1f3a2d] dark:text-emerald-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                    {text.damageModalDescription}
                  </p>
                  <textarea
                    value={damageDescription}
                    onChange={(event) => setDamageDescription(event.target.value)}
                    placeholder={text.damageModalPlaceholder}
                    className="mt-2 h-28 w-full resize-none rounded-[1.2rem] border border-emerald-100 bg-emerald-50/55 px-4 py-3 text-[13px] font-bold leading-5 text-emerald-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-300 dark:border-white/10 dark:bg-[#203d31] dark:text-white dark:placeholder:text-zinc-500"
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
                    <div className="mt-2 overflow-hidden rounded-[1.4rem] border border-emerald-100 bg-white p-2 dark:border-white/10 dark:bg-[#1a3327]">
                      <div className="relative overflow-hidden rounded-[1.1rem]">
                        <img
                          src={damagePhotoUrl}
                          alt={text.damageModalPhoto}
                          className="h-40 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearDamagePhoto}
                          className="absolute right-3 top-3 rounded-full bg-white/92 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 shadow-[0_14px_28px_-20px_rgba(0,166,85,0.55)] dark:bg-[#172d22]/92 dark:text-emerald-100"
                        >
                          {text.damageModalRemove}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => damagePhotoInputRef.current?.click()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-[1.4rem] border border-dashed border-emerald-200 bg-emerald-50/55 px-4 py-6 text-[12px] font-black uppercase tracking-[0.16em] text-emerald-700 transition-all hover:border-emerald-300 hover:text-emerald-900 dark:border-white/10 dark:bg-[#203d31] dark:text-emerald-100 dark:hover:text-white"
                    >
                      <Camera size={16} className="shrink-0" />
                      {text.damageModalUpload}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-emerald-100 p-5 dark:border-white/10">
                <button
                  type="button"
                  onClick={closeDamageModal}
                  className="flex items-center justify-center rounded-[1.3rem] border border-emerald-200 bg-white px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-emerald-800 transition-all active:scale-[0.98] dark:border-white/10 dark:bg-[#1f3a2d] dark:text-emerald-100"
                >
                  {text.damageModalCancel}
                </button>
                <button
                  type="button"
                  onClick={handleDamageReportSubmit}
                  disabled={!damagePhotoUrl || !damageDescription.trim()}
                  className="flex items-center justify-center rounded-[1.3rem] border border-emerald-300 bg-[#00A655] px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 dark:border-emerald-400/25"
                >
                  {text.damageModalSubmit}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isScannedPalletsModalOpen && activeScannedPallet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/25 px-4 py-6 backdrop-blur-[2px] dark:bg-black/45"
            onClick={() => setIsScannedPalletsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-[0_30px_60px_-28px_rgba(0,166,85,0.32)] dark:border-white/10 dark:bg-[#172d22] dark:shadow-[0_30px_60px_-28px_rgba(0,0,0,0.65)]"
            >
              <div className="flex items-center justify-between border-b border-emerald-100 px-5 py-4 dark:border-white/10">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                  {text.scannedPallets}
                </p>
                <button
                  type="button"
                  onClick={() => setIsScannedPalletsModalOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-all active:scale-[0.98] dark:bg-[#1f3a2d] dark:text-emerald-100"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-4">
                <div className="max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    {scannedPallets.map((pallet) => (
                      <button
                        key={pallet.id}
                        type="button"
                        onClick={() => setActiveScannedPalletId(pallet.id)}
                        className={cn(
                          'flex w-full items-start justify-between gap-3 rounded-[1.15rem] border px-3 py-3 text-left transition-all',
                          activeScannedPallet.id === pallet.id
                            ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/20 dark:bg-white/10'
                            : 'border-emerald-100 bg-white hover:bg-emerald-50/50 dark:border-white/10 dark:bg-[#1f3a2d] dark:hover:bg-white/5'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                            {pallet.qr_code}
                          </p>
                          {getVisibleClientName(pallet.current_status_id, pallet.client_name) && (
                            <p className="mt-1 truncate text-[11px] font-bold text-zinc-500 dark:text-[#9fcbb3]">
                              {getVisibleClientName(pallet.current_status_id, pallet.client_name)}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:border dark:border-white/10 dark:bg-[#172d22] dark:text-emerald-100">
                          {getDriverStatusLabel(pallet.current_status_name)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/60 p-4 dark:border-white/10 dark:bg-[#203d31]">
                  <p className="text-[1.25rem] font-black uppercase tracking-[-0.04em] text-emerald-950 dark:text-white">
                    {activeScannedPallet.qr_code}
                  </p>

                  <div className="mt-4 space-y-2.5">
                    <p className="text-[1rem] font-black uppercase tracking-[-0.03em] text-emerald-950 dark:text-white">
                      {getDriverStatusLabel(activeScannedPallet.current_status_name)}
                    </p>
                    {getVisibleClientName(
                      activeScannedPallet.current_status_id,
                      activeScannedPallet.client_name
                    ) && (
                      <p className="text-[0.98rem] font-black leading-6 text-emerald-900 dark:text-emerald-100">
                        {getVisibleClientName(
                          activeScannedPallet.current_status_id,
                          activeScannedPallet.client_name
                        )}
                      </p>
                    )}
                    <p className="text-[0.95rem] font-bold leading-6 text-zinc-600 dark:text-[#cce0d3]">
                      {activeScannedPallet.current_location}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
