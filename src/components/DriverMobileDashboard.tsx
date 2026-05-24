import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Camera, ChevronDown, History, RefreshCcw, Search } from 'lucide-react';
import { useApp } from '../AppContext';
import { Pallet, User } from '../types';
import { Badge, Card, cn } from './ui';
import { DriverModalShell } from './DriverModalShell';
import { DriverPalletSummaryCard } from './DriverPalletSummaryCard';

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
  warehouse1: 'Maxwellstraat 2-4, 3316 GP Dordrecht',
  warehouse2: 'Nikole Tesle 71',
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
  thirdAddress: string;
  addAddress: string;
  addAnotherAddress: string;
  useCurrentLocation: string;
  manualLocation: string;
  manualLocationPlaceholder: string;
  applyLocation: string;
};

const driverCopy: Record<'en' | 'nl' | 'bs', DriverCopy> = {
  en: {
    title: 'Scan QR code',
    resultLabel: 'Scanned pallet',
    palletNameLabel: 'Pallet',
    palletTypeLabel: 'Type',
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
    searchClientPlaceholder: 'Search client',
    noClientsFound: 'No clients found',
    scannedPallets: 'Scanned pallets',
    historyPallets: 'Pallet history',
    showAll: 'View all',
    liveDot: 'Live camera',
    statusUpdatedTitle: 'Status updated',
    statusSavedDetailAtClient: 'The pallet is marked at the client.',
    statusSavedDetailReturn: 'The pallet is marked ready for return.',
    statusSavedDetailTransport: 'The pallet is marked in transport.',
    statusSavedDetailWarehouse: 'The pallet is marked at Bowido warehouse.',
    statusSavedDetailRepair: 'The pallet is marked in repair.',
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
    addAddress: 'Add address',
    addAnotherAddress: 'Add another',
    useCurrentLocation: 'Current location',
    manualLocation: 'Manual search',
    manualLocationPlaceholder: 'Enter new address',
    applyLocation: 'Select',
  },
  nl: {
    title: 'Scan QR-code',
    resultLabel: 'Gescande bok',
    palletNameLabel: 'Boknummer',
    palletTypeLabel: 'Type',
    currentStatus: 'Huidige status',
    changeLabel: 'Wijzig',
    changeStatus: 'Status wijzigen',
    capturePalletPhoto: 'Foto maken',
    reportDamage: 'SCHADE MELDEN',
    scanNext: 'Scan volgende',
    summaryType: 'Type',
    summaryClient: 'Klant',
    summaryLocation: 'Locatie',
    clientEmpty: 'Geen klant',
    emptyStatus: 'Geen status',
    selectClient: 'Klant kiezen',
    searchClientPlaceholder: 'Zoek klant',
    noClientsFound: 'Geen klanten gevonden',
    scannedPallets: 'Gescande bokken',
    historyPallets: 'Bokgeschiedenis',
    showAll: 'Toon alles',
    liveDot: 'Live camera',
    statusUpdatedTitle: 'Status bijgewerkt',
    statusSavedDetailAtClient: 'De bok staat nu bij de klant.',
    statusSavedDetailReturn: 'De bok staat nu klaar voor retour.',
    statusSavedDetailTransport: 'De bok staat nu in transport.',
    statusSavedDetailWarehouse: 'De bok staat nu in Bowido magazijn.',
    statusSavedDetailRepair: 'De bok staat nu in reparatie.',
    damageReportedTitle: 'Schade gemeld',
    damageReportedDetail: 'De schademelding is opgeslagen voor deze bok.',
    damageModalTitle: 'Schade melden',
    damageModalDescription: 'Omschrijving schade',
    damageModalPhoto: 'Foto toevoegen',
    damageModalPlaceholder: 'Beschrijf wat er beschadigd is aan de bok',
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
    addAddress: 'Adres toevoegen',
    addAnotherAddress: 'Ander adres',
    useCurrentLocation: 'Huidige locatie',
    manualLocation: 'Handmatig zoeken',
    manualLocationPlaceholder: 'Nieuw adres invoeren',
    applyLocation: 'Selecteren',
  },
  bs: {
    title: 'Skeniraj QR kod',
    resultLabel: 'Skenirana paleta',
    palletNameLabel: 'Paleta',
    palletTypeLabel: 'Tip',
    currentStatus: 'Trenutni status',
    changeLabel: 'Promijeni',
    changeStatus: 'Promijeni status',
    capturePalletPhoto: 'USLIKAJ PALETU',
    reportDamage: 'PRIJAVI OŠTEĆENJE',
    scanNext: 'Skeniraj sljedeću',
    summaryType: 'Tip',
    summaryClient: 'Klijent',
    summaryLocation: 'Lokacija',
    clientEmpty: 'Bez klijenta',
    emptyStatus: 'Bez statusa',
    selectClient: 'Odaberi klijenta',
    searchClientPlaceholder: 'Pretraži klijenta',
    noClientsFound: 'Nema pronađenih klijenata',
    scannedPallets: 'Skenirane palete',
    historyPallets: 'Historija paleta',
    showAll: 'Prikaži sve',
    liveDot: 'Live kamera',
    statusUpdatedTitle: 'Status ažuriran',
    statusSavedDetailAtClient: 'Paleta je označena kod klijenta.',
    statusSavedDetailReturn: 'Paleta je označena za povrat.',
    statusSavedDetailTransport: 'Paleta je označena u transportu.',
    statusSavedDetailWarehouse: 'Paleta je označena u Bowido magacinu.',
    statusSavedDetailRepair: 'Paleta je označena za reparaciju.',
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
    addAddress: 'Dodaj adresu',
    addAnotherAddress: 'Dodaj drugu',
    useCurrentLocation: 'Trenutna lokacija',
    manualLocation: 'Ručno unesi',
    manualLocationPlaceholder: 'Unesi novu adresu',
    applyLocation: 'Odaberi',
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
    reportedAt: 'Reported on',
    deadlineStatus: 'Deadline',
    withinDeadline: 'Within deadline',
    overdue: 'Overdue',
    daysLeft: 'days left',
    daysLate: 'days late',
  },
  nl: {
    sentAt: 'Verzonden',
    returnDue: 'Retour',
    reportedAt: 'Gemeld op',
    deadlineStatus: 'Termijn',
    withinDeadline: 'Binnen termijn',
    overdue: 'Over tijd',
    daysLeft: 'dagen over',
    daysLate: 'dagen te laat',
  },
  bs: {
    sentAt: 'Poslana',
    returnDue: 'Povrat do',
    reportedAt: 'Prijavljeno',
    deadlineStatus: 'Rok',
    withinDeadline: 'U roku',
    overdue: 'Van roka',
    daysLeft: 'dana do isteka',
    daysLate: 'dana van roka',
  },
} as const;

const driverTransportWindowCopy = {
  en: {
    startedAt: 'Started',
    dueBy: 'Due by',
    laneBihToNl: 'BiH -> NL',
    laneNlToBih: 'NL -> BiH',
  },
  nl: {
    startedAt: 'Verzonden',
    dueBy: 'Aankomst',
    laneBihToNl: 'BiH -> NL',
    laneNlToBih: 'NL -> BiH',
  },
  bs: {
    startedAt: 'Početak',
    dueBy: 'Završiti do',
    laneBihToNl: 'BiH -> NL',
    laneNlToBih: 'NL -> BiH',
  },
} as const;

const clientLinkedStatusIds = [4, 5];
const transportStatusIds = [2, 6];

const getPalletColorTheme = () => {
  return {
    surface: 'bg-white/92 dark:bg-[#1a3327]/92',
    softSurface: 'bg-white/72 dark:bg-[#20372c]/72',
    strongSurface: 'bg-slate-200/70 dark:bg-slate-700/45',
    border: 'border-slate-300/80 dark:border-slate-400/28',
    label: 'text-slate-600 dark:text-slate-300',
    heading: 'text-slate-900 dark:text-white',
    body: 'text-slate-700 dark:text-slate-200',
    button: 'bg-slate-200/88 text-slate-700 dark:bg-slate-700/55 dark:text-slate-100',
    buttonHover: 'hover:text-slate-900 dark:hover:text-white',
  };
};

const getDriverPalletTypeLabel = (type: string) => {
  const normalizedType = type.trim().toLowerCase();

  if (normalizedType === 'siva' || normalizedType === 'grijs') {
    return 'Grijs';
  }

  if (normalizedType.includes('120x80')) {
    return 'L120';
  }

  if (/^l\s*paleta/i.test(type)) {
    return 'l180';
  }

  if (/^a\s*paleta/i.test(type)) {
    return 'A180';
  }

  return type;
};

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
  const [isAddAddressModalOpen, setIsAddAddressModalOpen] = useState(false);
  const [isEditingAlternateAddress, setIsEditingAlternateAddress] = useState(false);
  const [draftStatusId, setDraftStatusId] = useState<number>(4);
  const [draftClientId, setDraftClientId] = useState<number | undefined>(undefined);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
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
  const driverStatusOptions = [4, 5, 2, 6, 3, 1, 7]
    .map((statusId) => statuses.find((item) => item.id === statusId))
    .filter((status): status is NonNullable<typeof status> => Boolean(status));
  const scannedPallets = scannedPalletIds
    .map((palletId) => allDriverPallets.find((item) => item.id === palletId))
    .filter((item): item is Pallet => Boolean(item));
  const activeScannedPallet =
    scannedPallets.find((item) => item.id === activeScannedPalletId) || scannedPallets[0] || null;
  const damageTargetPallet = selectedPallet || activeScannedPallet;
  const actionButtonClass =
    'flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[0.58rem] font-black uppercase leading-[1.05] tracking-[0.14em] text-white transition-colors active:scale-[0.99]';
  const changeTriggerClass =
    'inline-flex h-11 items-center gap-1.5 rounded-full bg-emerald-50 px-4 text-[11.5px] font-black uppercase leading-none tracking-[0.14em] text-emerald-700 transition-all active:scale-[0.98] hover:text-emerald-900 dark:bg-white/10 dark:text-emerald-100 dark:hover:bg-white/14 dark:hover:text-white';
  const getVisibleClientName = (statusId: number, clientName?: string) =>
    clientLinkedStatusIds.includes(statusId) ? clientName || text.clientEmpty : null;
  const shouldShowLocationForStatus = (statusId?: number) =>
    !transportStatusIds.includes(statusId ?? -1);
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
      if (language === 'bs') {
        return 'Za povrat';
      }

      if (language === 'en') {
        return 'Ready for return';
      }

      return 'Voor retour';
    }

    if (statusName === 'Bowido BIH') {
      return 'Bowido BIH';
    }

    if (statusName === 'Transport BiH/NL') {
      return 'Transport BIH -> NL';
    }

    if (statusName === 'Transport (NL/BiH)') {
      return 'Transport NL -> BIH';
    }

    if (statusName === 'Bowido(NL)') {
      return 'Bowido NL';
    }

    if (statusName === 'Servis') {
      if (language === 'bs') {
        return 'Reparacija';
      }

      if (language === 'en') {
        return 'Repair';
      }

      return 'Reparatie';
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
  const activeLocationClientId = clientLinkedStatusIds.includes(draftStatusId) ? draftClientId : undefined;
  const isClientChangeDisabled = draftStatusId === 5;
  const selectedLocationMeta = getLocationMeta(draftLocationMode, activeLocationClientId);
  const fixedWarehouseLocationMeta =
    draftStatusId === 3
      ? {
          label: 'Maxwellstraat 2-4',
          address: '3316 GP Dordrecht',
        }
      : draftStatusId === 1
        ? {
            label: 'Nikole Tesle 71',
            address: '',
          }
        : null;
  const selectedClientName =
    clientLinkedStatusIds.includes(draftStatusId)
      ? clients.find((client) => client.user_id === draftClientId)?.name ||
        selectedPallet?.client_name ||
        text.clientEmpty
      : null;
  const returnWindowText = driverReturnWindowCopy[language] || driverReturnWindowCopy.en;
  const transportWindowText = driverTransportWindowCopy[language] || driverTransportWindowCopy.en;
  const getClientStatusInfo = (pallet: Pallet | null, clientId?: number) => {
    if (!pallet) {
      return null;
    }

    const sentDate = new Date(pallet.last_status_changed_at);
    const dateFormatter = new Intl.DateTimeFormat(driverDateLocales[language] || 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
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

    return {
      statusChangedAtLabel: dateFormatter.format(sentDate),
      dueDateLabel: dateFormatter.format(dueDate),
      deadlineLabel: isOverdue ? returnWindowText.overdue : returnWindowText.deadlineStatus,
      deadlineText: isOverdue
        ? language === 'bs'
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

    const transportStatus = statuses.find((item) => item.id === pallet.current_status_id);
    const counterDays = transportStatus?.grace_period_days || 3;
    const startedAt = new Date(pallet.last_status_changed_at);
    const startedAtMidnight = new Date(
      startedAt.getFullYear(),
      startedAt.getMonth(),
      startedAt.getDate()
    );
    const today = new Date();
    const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysInTransport = Math.max(
      0,
      Math.floor((todayAtMidnight.getTime() - startedAtMidnight.getTime()) / msPerDay)
    );
    const dueDate = new Date(startedAtMidnight);
    dueDate.setDate(dueDate.getDate() + counterDays);
    const remainingDays = counterDays - daysInTransport;
    const isOverdue = remainingDays < 0;
    const dateFormatter = new Intl.DateTimeFormat(driverDateLocales[language] || 'en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    return {
      laneLabel:
        pallet.current_status_id === 2
          ? transportWindowText.laneBihToNl
          : transportWindowText.laneNlToBih,
      startedAtLabel: dateFormatter.format(startedAt),
      dueDateLabel: dateFormatter.format(dueDate),
      deadlineLabel: isOverdue ? returnWindowText.overdue : returnWindowText.deadlineStatus,
      deadlineText: isOverdue
        ? language === 'bs'
          ? `${Math.abs(remainingDays)} dana`
          : `${Math.abs(remainingDays)} ${returnWindowText.daysLate}`
        : `${remainingDays} ${returnWindowText.daysLeft}`,
      isOverdue,
    };
  };
  const clientStatusInfo =
    clientLinkedStatusIds.includes(selectedPallet?.current_status_id ?? -1)
      ? getClientStatusInfo(selectedPallet, selectedPallet.user_id)
      : null;
  const transportWindowInfo = getTransportWindowInfo(selectedPallet);
  const selectedPalletTheme = getPalletColorTheme();
  const isTransportStatus = transportStatusIds.includes(selectedPallet?.current_status_id ?? -1);
  const isRepairStatus = draftStatusId === 7;
  const isLocationChangeDisabled = isTransportStatus || Boolean(fixedWarehouseLocationMeta);
  const isWarehouseStatus = [1, 3].includes(selectedPallet?.current_status_id ?? -1);
  const isCheckInStatus = [1, 3, 7].includes(selectedPallet?.current_status_id ?? -1);
  const shouldShowPalletPhotoAction = !isTransportStatus && !isWarehouseStatus && !isRepairStatus;
  const shouldTopAlignSummaryCard = [1, 3, 5, 7].includes(draftStatusId);
  const transportLocationLabel =
    language === 'nl' ? 'Onderweg' : language === 'bs' ? 'Na putu' : 'On the way';
  const showSelectedLocationSummary = Boolean(selectedPallet);
  const warehouseCheckInDateLabel = selectedPallet
    ? new Intl.DateTimeFormat(driverDateLocales[language] || 'en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(selectedPallet.last_status_changed_at))
    : '';
  const filteredClients = clients.filter((client) => {
    const query = clientSearchTerm.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      client.name.toLowerCase().includes(query) ||
      client.country.toLowerCase().includes(query) ||
      client.user_id.toString().includes(query)
    );
  });
  const changeModalTitle =
    openChangeMenu === 'status'
      ? text.changeStatus
      : openChangeMenu === 'client'
        ? text.summaryClient
        : openChangeMenu === 'location'
          ? text.summaryLocation
          : '';

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
        : 0
    );
    setDraftClientId(selectedPallet.user_id);
    setClientSearchTerm('');
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
    if (openChangeMenu === 'client') {
      setClientSearchTerm('');
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
    type: 'Siva',
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
    if (
      !selectedPallet ||
      (clientLinkedStatusIds.includes(nextStatusId) && !clientId && !selectedPallet.user_id)
    ) {
      return;
    }

    const nextStatusName = statuses.find((item) => item.id === nextStatusId)?.name || '';
    const preserveClientAssignment = clientLinkedStatusIds.includes(nextStatusId);
    const nextClientId = preserveClientAssignment ? clientId ?? selectedPallet.user_id : undefined;
    const nextClientName = nextClientId
      ? clients.find((client) => client.user_id === nextClientId)?.name || selectedPallet.client_name
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
            user_id: nextClientId,
            client_name: nextClientName,
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
            : nextStatusId === 7
              ? 'Driver marked pallet in repair.'
            : transportStatusIds.includes(nextStatusId)
              ? 'Driver marked pallet in transport.'
            : 'Driver marked pallet in Bowido warehouse.',
        nextClientId
      );
    }

    showFlash(
      text.statusUpdatedTitle,
      nextStatusId === 4
        ? text.statusSavedDetailAtClient
        : nextStatusId === 5
          ? text.statusSavedDetailReturn
          : nextStatusId === 7
            ? text.statusSavedDetailRepair
          : transportStatusIds.includes(nextStatusId)
            ? text.statusSavedDetailTransport
          : text.statusSavedDetailWarehouse,
      'success'
    );
  };

  const handleStatusSelection = (statusId: number) => {
    setOpenChangeMenu(null);
    setDraftStatusId(statusId);
    const nextClientId = clientLinkedStatusIds.includes(statusId)
      ? draftClientId ?? selectedPallet?.user_id
      : undefined;
    const nextLocationClientId = clientLinkedStatusIds.includes(statusId) ? nextClientId : undefined;
    const nextLocation =
      statusId === 3
        ? defaultWarehouseDirectory.warehouse1
        : statusId === 1
          ? defaultWarehouseDirectory.warehouse2
        : getLocationMeta(
            draftLocationMode,
            nextLocationClientId,
            manualLocationInput
          ).address;

    if (statusId === 3 || statusId === 1) {
      setDraftLocationMode(statusId === 3 ? 'warehouse_1' : 'warehouse_2');
      setManualLocationInput('');
    }

    if (statusId === 4 && !nextClientId) {
      setOpenChangeMenu('client');
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

    if (clientLinkedStatusIds.includes(draftStatusId) && nextClientId) {
      const nextLocation = getLocationMeta(draftLocationMode, nextClientId, manualLocationInput).address;
      persistDriverStatus(draftStatusId, nextClientId, nextLocation);
    }
  };

  const handleLocationSelection = (mode: DriverLocationMode) => {
    setOpenChangeMenu(null);
    setIsAddAddressModalOpen(false);
    setIsEditingAlternateAddress(false);
    setDraftLocationMode(mode);
    const nextLocation = getLocationMeta(mode, activeLocationClientId).address;

    if (selectedPallet) {
      persistDriverStatus(
        draftStatusId,
        clientLinkedStatusIds.includes(draftStatusId) ? draftClientId : undefined,
        nextLocation
      );
    }
  };

  const handleManualLocationApply = (nextLocationInput?: string) => {
    const nextLocation = (nextLocationInput ?? manualLocationInput).trim();

    if (!nextLocation) {
      return;
    }

    setOpenChangeMenu(null);
    setIsAddAddressModalOpen(false);
    setIsEditingAlternateAddress(false);
    setDraftLocationMode('manual');
    setManualLocationInput(nextLocation);

    if (selectedPallet) {
      persistDriverStatus(
        draftStatusId,
        clientLinkedStatusIds.includes(draftStatusId) ? draftClientId : undefined,
        nextLocation
      );
    }
  };

  const closeAddAddressModal = () => {
    setIsAddAddressModalOpen(false);
    setIsEditingAlternateAddress(false);
    setManualLocationInput('');
  };

  const openAddAddressModal = () => {
    setOpenChangeMenu(null);
    setIsEditingAlternateAddress(false);
    setManualLocationInput('');
    setIsAddAddressModalOpen(true);
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
    if (!damageTargetPallet || !damagePhotoUrl || !damageDescription.trim()) {
      return;
    }

    showFlash(text.damageReportedTitle, text.damageReportedDetail, 'warning');
    closeDamageModal();
  };

  const handleScannerFrameClick = () => {
    if (cameraState === 'ready' || isScanning) {
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
    <div
      className={cn(
        'mx-auto flex min-h-full w-full max-w-md flex-col',
        isScannerOpen ? 'gap-4 pb-0' : 'gap-2 pb-[calc(env(safe-area-inset-bottom)+4.75rem)]'
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

          <div className="mt-1 flex flex-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.button
                key="scanner-view"
                type="button"
                onClick={handleScannerFrameClick}
                initial={{ opacity: 0.82, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className={cn(
                  'relative mx-auto flex h-full min-h-[26rem] w-full items-center justify-center overflow-hidden rounded-[2.9rem] border border-emerald-200 bg-white text-white transition-all duration-500 dark:border-white/10 dark:bg-[#172d22]',
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
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
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
                    className="absolute left-12 right-12 h-[2px] bg-emerald-400"
                  />
                ) : isScanning || cameraState === 'loading' ? (
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-300/60">
                    <span className="h-4 w-4 animate-pulse rounded-full bg-emerald-400" />
                  </div>
                ) : (
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-emerald-200 bg-emerald-50 dark:border-white/10 dark:bg-[#1f3a2d]">
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
          </div>

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
            <Card className="w-full max-w-sm border-emerald-100 bg-white/95 dark:border-white/10 dark:bg-[#1a3327]/95">
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
            className="mx-auto flex w-full max-w-md flex-col pt-1"
          >
            <Card noPadding className="mx-auto flex w-full flex-col border-transparent bg-transparent shadow-none">
              <div className="flex flex-col px-0 pb-3 pt-1">
                <DriverPalletSummaryCard
                  nameLabel={text.palletNameLabel}
                  code={selectedPallet.qr_code}
                  typeLabel={text.palletTypeLabel}
                  typeValue={getDriverPalletTypeLabel(selectedPallet.type)}
                  theme={selectedPalletTheme}
                  alignTop={shouldTopAlignSummaryCard}
                >
                  {isCheckInStatus && (
                    <div
                      className={cn(
                        'mt-3 flex w-full justify-center rounded-[1rem] px-0 pt-2.5 pb-0 text-center',
                        selectedPalletTheme.softSurface
                      )}
                    >
                      <div className="flex min-w-0 flex-col items-center">
                        <p className={cn('text-[11px] font-black uppercase tracking-[0.14em]', selectedPalletTheme.label)}>
                          Check in
                        </p>
                        <p className={cn('mt-1 text-[13px] font-black tracking-tight', selectedPalletTheme.heading)}>
                          {warehouseCheckInDateLabel}
                        </p>
                      </div>
                    </div>
                  )}
                  {clientStatusInfo && selectedPallet.current_status_id === 4 && (
                    <div
                      className={cn(
                        'mt-3 grid w-full grid-cols-3 items-start gap-2.5 rounded-[1rem] px-0 pt-2.5 pb-0',
                        selectedPalletTheme.softSurface
                      )}
                    >
                      <div className="flex min-w-0 w-full flex-col items-start text-left">
                        <p className={cn('text-[11px] font-black uppercase tracking-[0.14em]', selectedPalletTheme.label)}>
                          {returnWindowText.sentAt}
                        </p>
                        <p className={cn('mt-1 text-[13px] font-black tracking-tight', selectedPalletTheme.heading)}>
                          {clientStatusInfo.statusChangedAtLabel}
                        </p>
                      </div>
                      <div className="flex min-w-0 w-full flex-col items-center text-center">
                        <p className={cn('text-[11px] font-black uppercase tracking-[0.14em]', selectedPalletTheme.label)}>
                          {returnWindowText.returnDue}
                        </p>
                        <p className={cn('mt-1 text-[13px] font-black tracking-tight', selectedPalletTheme.heading)}>
                          {clientStatusInfo.dueDateLabel}
                        </p>
                      </div>
                      <div className="flex min-w-0 w-full flex-col items-end text-right">
                        <p
                          className={cn(
                            'text-[10px] font-black uppercase tracking-[0.14em]',
                            clientStatusInfo.isOverdue
                              ? 'text-rose-700 dark:text-rose-100'
                              : selectedPalletTheme.label
                          )}
                        >
                          {clientStatusInfo.deadlineLabel}
                        </p>
                        <p
                          className={cn(
                            'mt-1 text-right text-[12px] font-black leading-4 tracking-tight',
                            clientStatusInfo.isOverdue
                              ? 'text-rose-700 dark:text-rose-100'
                              : selectedPalletTheme.heading
                          )}
                        >
                          {clientStatusInfo.deadlineText}
                        </p>
                      </div>
                    </div>
                  )}
                  {clientStatusInfo && selectedPallet.current_status_id === 5 && (
                    <div
                      className={cn(
                        'mt-3 flex w-full justify-center rounded-[1rem] px-0 pt-2.5 pb-0 text-center',
                        selectedPalletTheme.softSurface
                      )}
                    >
                      <div className="flex min-w-0 flex-col items-center">
                        <p className={cn('text-[11px] font-black uppercase tracking-[0.14em]', selectedPalletTheme.label)}>
                          {returnWindowText.reportedAt}
                        </p>
                        <p className={cn('mt-1 text-[13px] font-black tracking-tight', selectedPalletTheme.heading)}>
                          {clientStatusInfo.statusChangedAtLabel}
                        </p>
                      </div>
                    </div>
                  )}
                  {transportWindowInfo && (
                    <div
                      className={cn(
                        'mt-3 w-full rounded-[1rem] px-0 pt-2.5 pb-0',
                        selectedPalletTheme.softSurface
                      )}
                    >
                      <div className="grid grid-cols-3 items-start gap-2.5">
                        <div className="flex min-w-0 w-full flex-col items-start text-left">
                          <p className={cn('text-[11px] font-black uppercase tracking-[0.14em]', selectedPalletTheme.label)}>
                            {transportWindowText.startedAt}
                          </p>
                          <p className={cn('mt-1 text-[13px] font-black tracking-tight', selectedPalletTheme.heading)}>
                            {transportWindowInfo.startedAtLabel}
                          </p>
                        </div>
                        <div className="flex min-w-0 w-full flex-col items-center text-center">
                          <p className={cn('text-[11px] font-black uppercase tracking-[0.14em]', selectedPalletTheme.label)}>
                            {transportWindowText.dueBy}
                          </p>
                          <p className={cn('mt-1 text-[13px] font-black tracking-tight', selectedPalletTheme.heading)}>
                            {transportWindowInfo.dueDateLabel}
                          </p>
                        </div>
                        <div className="flex min-w-0 w-full flex-col items-end text-right">
                          <p
                            className={cn(
                              'text-[10px] font-black uppercase tracking-[0.14em]',
                              transportWindowInfo.isOverdue
                                ? 'text-rose-700 dark:text-rose-100'
                                : selectedPalletTheme.label
                            )}
                          >
                            {transportWindowInfo.deadlineLabel}
                          </p>
                          <p
                            className={cn(
                              'mt-1 text-right text-[12px] font-black leading-4 tracking-tight',
                              transportWindowInfo.isOverdue
                                ? 'text-rose-700 dark:text-rose-100'
                                : selectedPalletTheme.heading
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
                  <div
                    className="relative flex min-h-[11.8rem] flex-[1.28] flex-col justify-center rounded-[1.9rem] bg-white/90 px-4 pt-5 pb-0 text-center dark:bg-[#1a3327]/92"
                  >
                    <p className="text-[12px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                      {text.currentStatus}
                    </p>
                    <p className="mt-3 break-words text-[2.65rem] font-black uppercase leading-[0.94] tracking-[-0.05em] text-emerald-950 dark:text-white">
                      {getDriverStatusLabel(selectedPallet.current_status_name)}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpenChangeMenu((current) => (current === 'status' ? null : 'status'))}
                      className={cn(changeTriggerClass, 'mt-3 h-10 self-center px-4 text-[12px]')}
                    >
                      {text.changeStatus}
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform', openChangeMenu === 'status' && 'rotate-180')}
                      />
                    </button>
                  </div>

                  {(selectedClientName || showSelectedLocationSummary) && (
                    <div
                      className={cn(
                        'grid min-h-0 flex-[1.12] auto-rows-fr gap-2.5 text-left',
                        selectedClientName && showSelectedLocationSummary
                          ? 'grid-rows-[minmax(0,1fr)_minmax(0,1fr)]'
                          : 'grid-rows-[minmax(0,1fr)]'
                      )}
                    >
                    {selectedClientName && (
                      <div
                        className="relative flex h-full min-h-0 flex-col justify-center rounded-[1.45rem] bg-white/88 px-3.5 py-4 dark:bg-[#1a3327]/88"
                      >
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

                              setOpenChangeMenu((current) => (current === 'client' ? null : 'client'));
                            }}
                            className={cn(
                              changeTriggerClass,
                              'shrink-0 self-center',
                              isClientChangeDisabled && 'cursor-not-allowed opacity-45 hover:text-inherit'
                            )}
                          >
                            {text.changeLabel}
                            <ChevronDown
                              size={14}
                              className={cn('transition-transform', openChangeMenu === 'client' && 'rotate-180')}
                            />
                          </button>
                        </div>
                      </div>
                    )}

                    {showSelectedLocationSummary && (
                      <div
                        className={cn(
                          'relative rounded-[1.45rem] bg-white/88 dark:bg-[#1a3327]/88',
                          selectedClientName ? 'px-3.5 py-4' : 'px-3.5 py-5'
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
                              onClick={() => setOpenChangeMenu((current) => (current === 'location' ? null : 'location'))}
                              className={cn(changeTriggerClass, 'shrink-0 self-center')}
                            >
                              {text.changeLabel}
                              <ChevronDown
                                size={14}
                                className={cn('transition-transform', openChangeMenu === 'location' && 'rotate-180')}
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
                  <div className="w-full overflow-hidden rounded-[1.45rem] bg-white p-2 dark:bg-[#1a3327]">
                    <div className="relative overflow-hidden rounded-[1.3rem] bg-emerald-50 dark:bg-[#203d31]">
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

      {(isScannerOpen || selectedPallet) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60]">
          <div className="pointer-events-auto mx-auto grid min-h-16 w-full max-w-md items-center border-t border-white/15 bg-[#00A655]/92 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] backdrop-blur-xl shadow-[0_-12px_36px_rgba(0,166,85,0.35)]">
            {isScannerOpen ? (
              <div className="grid h-full grid-cols-1">
                <button
                  type="button"
                  onClick={openScannedPalletsModal}
                  disabled={scannedPallets.length === 0}
                  className={cn(
                    actionButtonClass,
                    scannedPallets.length === 0
                      ? 'cursor-not-allowed text-white/45 active:scale-100'
                      : 'hover:bg-white/10 hover:text-white'
                  )}
                >
                  <History size={20} className="shrink-0" />
                  {text.historyPallets}
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'grid h-full gap-1',
                  shouldShowPalletPhotoAction ? 'grid-cols-3' : 'grid-cols-2'
                )}
              >
                <button
                  type="button"
                  className={cn(
                    actionButtonClass,
                    'hover:bg-white/10 hover:text-white'
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
                      'hover:bg-white/10 hover:text-white'
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
                      ? 'hover:bg-white/10 hover:text-white'
                      : 'cursor-not-allowed text-white/45 active:scale-100'
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
        {openChangeMenu && selectedPallet && (
          <DriverModalShell
            onClose={() => setOpenChangeMenu(null)}
            title={openChangeMenu === 'client' ? undefined : changeModalTitle}
            subtitle={openChangeMenu === 'client' ? undefined : selectedPallet.qr_code}
            width="lg"
            contentClassName="min-h-[24rem] justify-center"
            bodyClassName="p-0"
            headerClassName={openChangeMenu === 'client' ? 'px-5 pb-1 pt-4' : undefined}
            showHeaderDivider={openChangeMenu !== 'client'}
          >
            {openChangeMenu === 'status' && (
              <div className="space-y-2.5 p-5">
                {driverStatusOptions.map((status) => (
                  <button
                    key={status.id}
                    type="button"
                    onClick={() => handleStatusSelection(status.id)}
                    className={cn(
                      'flex w-full items-center justify-center rounded-[1rem] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-tight transition-all',
                      draftStatusId === status.id
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                        : 'bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5'
                    )}
                  >
                    {getDriverStatusLabel(status.name)}
                  </button>
                ))}
              </div>
            )}

            {openChangeMenu === 'client' && draftStatusId === 4 && (
              <div className="p-5">
                <div className="relative mb-3">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 dark:text-emerald-200"
                  />
                  <input
                    type="text"
                    value={clientSearchTerm}
                    onChange={(event) => setClientSearchTerm(event.target.value)}
                    placeholder={text.searchClientPlaceholder}
                    className="h-11 w-full rounded-[1rem] border border-emerald-100 bg-emerald-50/60 pl-11 pr-4 text-[12px] font-black uppercase tracking-[0.08em] text-emerald-950 outline-none transition-colors placeholder:text-emerald-400 focus:border-emerald-300 dark:border-white/10 dark:bg-[#1f3a2d] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-emerald-300"
                  />
                </div>
                <div className="max-h-80 space-y-2.5 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleClientSelection(client.user_id.toString())}
                      className={cn(
                        'flex w-full items-center justify-center rounded-[1rem] px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-tight transition-all',
                        draftClientId === client.user_id
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                          : 'bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5'
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
                    <div className="rounded-[1rem] border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-6 text-center text-[11px] font-black uppercase tracking-[0.12em] text-emerald-500 dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-300">
                      {text.noClientsFound}
                    </div>
                  )}
                </div>
              </div>
            )}

            {openChangeMenu === 'location' && !isLocationChangeDisabled && (
              <div className="space-y-3.5 p-5">
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => handleLocationSelection('warehouse_1')}
                    className={cn(
                      'flex w-full flex-col items-start rounded-[1rem] px-4 py-4 text-left transition-all',
                      draftLocationMode === 'warehouse_1'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                        : 'bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5'
                    )}
                  >
                    <span className="text-[13px] font-black uppercase tracking-tight">{text.warehouseDefault}</span>
                    <span className="mt-1 text-[11px] font-bold normal-case leading-4 opacity-70">
                      {getLocationMeta('warehouse_1', activeLocationClientId).address}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLocationSelection('warehouse_2')}
                    className={cn(
                      'flex w-full flex-col items-start rounded-[1rem] px-4 py-4 text-left transition-all',
                      draftLocationMode === 'warehouse_2'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                        : 'bg-white text-zinc-700 hover:bg-emerald-50/70 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5'
                    )}
                  >
                    <span className="text-[13px] font-black uppercase tracking-tight">{text.warehouseSecondary}</span>
                    <span className="mt-1 text-[11px] font-bold normal-case leading-4 opacity-70">
                      {getLocationMeta('warehouse_2', activeLocationClientId).address}
                    </span>
                  </button>
                </div>

                {!isRepairStatus && (
                  <button
                    type="button"
                    onClick={openAddAddressModal}
                    className="flex w-full items-center justify-center rounded-[1rem] bg-white px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-tight text-zinc-700 transition-all hover:bg-emerald-50/70 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5"
                  >
                    {text.addAddress}
                  </button>
                )}
              </div>
            )}
          </DriverModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddAddressModalOpen && selectedPallet && (
          <DriverModalShell
            onClose={closeAddAddressModal}
            title={isEditingAlternateAddress ? text.manualLocation : text.addAddress}
            subtitle={selectedPallet.qr_code}
            width="md"
            overlayClassName="z-[60]"
            bodyClassName="p-0"
          >
            <div className="mx-auto w-full max-w-[21.75rem] space-y-3.5 px-5 py-5">
              {!isEditingAlternateAddress ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleLocationSelection('driver_current')}
                    className="flex w-full flex-col rounded-[1.2rem] bg-white px-4 py-4 text-left text-zinc-700 transition-all hover:bg-zinc-50 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5"
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-200">
                      {text.useCurrentLocation}
                    </span>
                    <span className="mt-2 text-[15px] font-black leading-5 text-emerald-950 dark:text-white">
                      {getLocationMeta('driver_current', activeLocationClientId).address}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setManualLocationInput('');
                      setIsEditingAlternateAddress(true);
                    }}
                    className="flex w-full items-center justify-center rounded-[1.1rem] bg-white px-4 py-3.5 text-center text-[13px] font-black uppercase tracking-[0.14em] text-zinc-700 transition-all hover:bg-zinc-50 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5"
                  >
                    {text.addAnotherAddress}
                  </button>
                </>
              ) : (
                <div className="space-y-3.5">
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
                    className="h-12 w-full rounded-[1rem] border-2 border-emerald-200 bg-white px-4 text-[14px] font-bold text-emerald-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-emerald-400 focus:bg-white dark:border-white/10 dark:bg-[#203d31] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-emerald-300"
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setManualLocationInput('');
                        setIsEditingAlternateAddress(false);
                      }}
                      className="flex items-center justify-center rounded-[1rem] bg-white px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-zinc-700 transition-all hover:bg-zinc-50 active:scale-[0.98] dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:bg-white/5"
                    >
                      {text.damageModalCancel}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleManualLocationApply()}
                      className="flex items-center justify-center rounded-[1rem] bg-[#00A655] px-4 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-white transition-all active:scale-[0.98]"
                    >
                      {text.applyLocation}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </DriverModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDamageModalOpen && damageTargetPallet && (
          <DriverModalShell
            onClose={closeDamageModal}
            title={text.damageModalTitle}
            subtitle={damageTargetPallet.qr_code}
            width="sm"
            bodyClassName="p-0"
            footer={
              <>
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
              </>
            }
            footerClassName="grid grid-cols-2 gap-3 p-5"
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
                        className="absolute right-3 top-3 rounded-full bg-white/92 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:bg-[#172d22]/92 dark:text-emerald-100"
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
          >
            <div className="space-y-4 p-4 pt-0">
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
                <p className="mt-2 text-[0.85rem] font-black tracking-[0.02em] text-zinc-600 dark:text-[#cce0d3]">
                  {getDriverPalletTypeLabel(activeScannedPallet.type)}
                </p>

                <div className="mt-4 space-y-2.5">
                  <p className="text-[1rem] font-black uppercase tracking-[-0.03em] text-emerald-950 dark:text-white">
                    {getDriverStatusLabel(activeScannedPallet.current_status_name)}
                  </p>
                  {getVisibleClientName(
                    activeScannedPallet.current_status_id,
                    activeScannedPallet.client_name
                  ) && (
                    <p className="text-[0.98rem] font-black leading-6 text-emerald-950 dark:text-white">
                      {getVisibleClientName(
                        activeScannedPallet.current_status_id,
                        activeScannedPallet.client_name
                      )}
                    </p>
                  )}
                  {shouldShowLocationForStatus(activeScannedPallet.current_status_id) && (
                    <p className="text-[0.95rem] font-bold leading-6 text-zinc-600 dark:text-[#cce0d3]">
                      {activeScannedPallet.current_location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </DriverModalShell>
        )}
      </AnimatePresence>

    </div>
  );
};
