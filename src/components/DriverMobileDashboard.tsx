import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  ChevronDown,
  CheckCircle2,
  MapPin,
  Package,
  QrCode,
  RefreshCcw,
  Truck,
  X,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';
import { User } from '../types';
import { Badge, Button, Card, cn } from './ui';

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
}

type DriverCopy = {
  title: string;
  resultLabel: string;
  currentStatus: string;
  changeLabel: string;
  capturePalletPhoto: string;
  scanNext: string;
  summaryType: string;
  summaryClient: string;
  summaryLocation: string;
  clientEmpty: string;
  selectClient: string;
  scannedPallets: string;
  showAll: string;
  liveDot: string;
  statusUpdatedTitle: string;
  statusSavedDetailAtClient: string;
  statusSavedDetailReturn: string;
};

const driverCopy: Record<'en' | 'nl' | 'bs', DriverCopy> = {
  en: {
    title: 'Scan QR code',
    resultLabel: 'Scanned pallet',
    currentStatus: 'Current status',
    changeLabel: 'Change',
    capturePalletPhoto: 'PHOTOGRAPH PALLET',
    scanNext: 'Scan next pallet',
    summaryType: 'Type',
    summaryClient: 'Client',
    summaryLocation: 'Location',
    clientEmpty: 'No client',
    selectClient: 'Select client',
    scannedPallets: 'Scanned pallets',
    showAll: 'View all',
    liveDot: 'Live camera',
    statusUpdatedTitle: 'Status updated',
    statusSavedDetailAtClient: 'The pallet is marked at the client.',
    statusSavedDetailReturn: 'The pallet is marked ready for return.',
  },
  nl: {
    title: 'Scan QR-code',
    resultLabel: 'Gescande pallet',
    currentStatus: 'Huidige status',
    changeLabel: 'Wijzig',
    capturePalletPhoto: 'FOTOGRAFEER PALET',
    scanNext: 'Scan volgende pallet',
    summaryType: 'Type',
    summaryClient: 'Klant',
    summaryLocation: 'Locatie',
    clientEmpty: 'Geen klant',
    selectClient: 'Klant kiezen',
    scannedPallets: 'Gescande pallets',
    showAll: 'Toon alles',
    liveDot: 'Live camera',
    statusUpdatedTitle: 'Status bijgewerkt',
    statusSavedDetailAtClient: 'De pallet staat nu bij de klant.',
    statusSavedDetailReturn: 'De pallet staat nu klaar voor retour.',
  },
  bs: {
    title: 'Skeniraj QR kod',
    resultLabel: 'Skenirana paleta',
    currentStatus: 'Trenutni status',
    changeLabel: 'Promijeni',
    capturePalletPhoto: 'USLIKAJ PALETU',
    scanNext: 'Skeniraj sljedecu',
    summaryType: 'Tip',
    summaryClient: 'Klijent',
    summaryLocation: 'Lokacija',
    clientEmpty: 'Bez klijenta',
    selectClient: 'Odaberi klijenta',
    scannedPallets: 'Skenirane palete',
    showAll: 'Prikazi sve',
    liveDot: 'Live kamera',
    statusUpdatedTitle: 'Status azuriran',
    statusSavedDetailAtClient: 'Paleta je oznacena kod klijenta.',
    statusSavedDetailReturn: 'Paleta je oznacena za povrat.',
  },
};

const statusToneMap: Record<
  number,
  {
    badge: DriverBadgeVariant;
    panelClass: string;
  }
> = {
  1: {
    badge: 'default',
    panelClass: 'from-zinc-50 via-white to-slate-50',
  },
  2: {
    badge: 'info',
    panelClass: 'from-sky-50 via-white to-indigo-50',
  },
  4: {
    badge: 'success',
    panelClass: 'from-emerald-50 via-white to-lime-50',
  },
  5: {
    badge: 'warning',
    panelClass: 'from-amber-50 via-white to-orange-50',
  },
  6: {
    badge: 'info',
    panelClass: 'from-cyan-50 via-white to-sky-50',
  },
  7: {
    badge: 'danger',
    panelClass: 'from-rose-50 via-white to-red-50',
  },
  8: {
    badge: 'default',
    panelClass: 'from-zinc-100 via-white to-zinc-50',
  },
};

export const DriverMobileDashboard: React.FC<DriverMobileDashboardProps> = ({ user }) => {
  const { pallets, clients, updatePalletStatus, statuses, language } = useApp();
  const [isScanning, setIsScanning] = useState(false);
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(null);
  const [palletPhotoUrl, setPalletPhotoUrl] = useState<string | null>(null);
  const [scannedPalletIds, setScannedPalletIds] = useState<number[]>([]);
  const [isScannedPalletsModalOpen, setIsScannedPalletsModalOpen] = useState(false);
  const [activeScannedPalletId, setActiveScannedPalletId] = useState<number | null>(null);
  const [openChangeMenu, setOpenChangeMenu] = useState<'client' | 'status' | null>(null);
  const [draftStatusId, setDraftStatusId] = useState<number>(4);
  const [draftClientId, setDraftClientId] = useState<number | undefined>(undefined);
  const [cameraState, setCameraState] = useState<CameraState>('loading');
  const [flashMessage, setFlashMessage] = useState<{
    title: string;
    detail: string;
    variant: DriverBadgeVariant;
  } | null>(null);

  const scanIndexRef = useRef(-1);
  const flashTimeoutRef = useRef<number | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const palletPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const palletPhotoUrlRef = useRef<string | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const palletsRef = useRef(pallets);
  const scanBusyRef = useRef(false);
  const lastScanAtRef = useRef(0);
  const selectedPalletIdRef = useRef<number | null>(null);

  const text = driverCopy[language] || driverCopy.en;
  const isScannerOpen = selectedPalletId === null;
  const selectedPallet = selectedPalletId
    ? pallets.find((item) => item.id === selectedPalletId) || null
    : null;
  const driverStatusOptions = [4, 5]
    .map((statusId) => statuses.find((item) => item.id === statusId))
    .filter((status): status is NonNullable<typeof status> => Boolean(status));
  const scannedPallets = scannedPalletIds
    .map((palletId) => pallets.find((item) => item.id === palletId))
    .filter((item): item is (typeof pallets)[number] => Boolean(item));
  const activeScannedPallet =
    scannedPallets.find((item) => item.id === activeScannedPalletId) || scannedPallets[0] || null;
  const actionButtonClass =
    'flex w-full items-center justify-center rounded-[1.9rem] border border-emerald-300 bg-[#00A655] px-5 py-6 text-center text-[1rem] font-black uppercase tracking-[0.08em] text-white shadow-[0_22px_44px_-22px_rgba(0,166,85,0.65)] transition-all active:scale-[0.99] dark:border-emerald-400/25 dark:shadow-[0_22px_44px_-22px_rgba(0,0,0,0.55)]';
  const changeTriggerClass =
    'inline-flex items-center gap-1 text-[10px] font-black uppercase leading-none tracking-[0.16em] text-emerald-600 transition-colors hover:text-emerald-800 dark:text-emerald-200 dark:hover:text-white';

  useEffect(() => {
    palletsRef.current = pallets;
  }, [pallets]);

  useEffect(() => {
    selectedPalletIdRef.current = selectedPalletId;
  }, [selectedPalletId]);

  useEffect(() => {
    if (!selectedPallet) {
      return;
    }

    setOpenChangeMenu(null);
    setDraftStatusId(selectedPallet.current_status_id === 5 ? 5 : 4);
    setDraftClientId(selectedPallet.user_id);
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
    };
  }, []);

  const stopCamera = () => {
    if (scanFrameRef.current) {
      window.cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
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

  const findMatchingPallet = (rawValue: string) => {
    const normalized = rawValue.trim().toUpperCase();

    return (
      palletsRef.current.find((item) => item.qr_code.toUpperCase() === normalized) ||
      palletsRef.current.find((item) => normalized.includes(item.qr_code.toUpperCase())) ||
      null
    );
  };

  const handleDetectedCode = (rawValue: string) => {
    const matchedPallet = findMatchingPallet(rawValue);

    if (!matchedPallet) {
      return;
    }

    setScannedPalletIds((current) => [matchedPallet.id, ...current.filter((item) => item !== matchedPallet.id)]);
    selectedPalletIdRef.current = matchedPallet.id;
    setSelectedPalletId(matchedPallet.id);
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

      const detectorApi = (
        window as Window & {
          BarcodeDetector?: BarcodeDetectorConstructorLike;
        }
      ).BarcodeDetector;

      detectorRef.current = detectorApi
        ? new detectorApi({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13'],
          })
        : null;

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraState('unsupported');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        if (detectorRef.current) {
          setCameraState('ready');
          runDetectionLoop();
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

  const handleScanNext = () => {
    clearPalletPhoto();
    setOpenChangeMenu(null);
    selectedPalletIdRef.current = null;
    setSelectedPalletId(null);
    lastScanAtRef.current = 0;
  };

  const persistDriverStatus = (nextStatusId: number, clientId?: number) => {
    if (!selectedPallet || (nextStatusId === 4 && !clientId)) {
      return;
    }

    updatePalletStatus(
      selectedPallet.id,
      nextStatusId,
      user.id,
      user.name,
      selectedPallet.current_location,
      nextStatusId === 4
        ? 'Driver marked pallet as Bij de klant.'
        : 'Driver marked pallet as Voor retour.',
      nextStatusId === 4 ? clientId : undefined
    );

    showFlash(
      text.statusUpdatedTitle,
      nextStatusId === 4 ? text.statusSavedDetailAtClient : text.statusSavedDetailReturn,
      'success'
    );
  };

  const handleStatusSelection = (statusId: number) => {
    setOpenChangeMenu(null);
    setDraftStatusId(statusId);

    if (statusId === 5) {
      persistDriverStatus(5);
      return;
    }

    if (draftClientId) {
      persistDriverStatus(4, draftClientId);
    }
  };

  const handleClientSelection = (value: string) => {
    const nextClientId = value ? Number(value) : undefined;
    setOpenChangeMenu(null);
    setDraftClientId(nextClientId);

    if (draftStatusId === 4 && nextClientId) {
      persistDriverStatus(4, nextClientId);
    }
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
          <div className="relative text-center">
            <h1 className="mt-3 text-[2rem] font-black leading-none tracking-[-0.04em] text-emerald-950 dark:text-white">
              {text.title}
            </h1>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.button
              key="scanner-view"
              type="button"
              onClick={cameraState === 'ready' ? undefined : simulateScan}
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
                <Camera size={40} className="relative z-10 animate-pulse text-emerald-400" />
              ) : (
                <div className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-emerald-200 bg-emerald-50 shadow-inner shadow-emerald-100/80 dark:border-white/10 dark:bg-[#1f3a2d] dark:shadow-black/25">
                  <QrCode size={42} className="text-emerald-500 dark:text-emerald-300" />
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
                          <p className="mt-1 truncate text-[11px] font-bold text-zinc-500 dark:text-[#9fcbb3]">
                            {pallet.client_name || text.clientEmpty}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:border dark:border-white/10 dark:bg-[#172d22] dark:text-emerald-100">
                          {getStatusLabel(pallet.current_status_name, language)}
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
          >
            <Card className="border-emerald-100 bg-white/95 dark:border-white/10 dark:bg-[#1a3327]/95">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-200">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <Badge variant={flashMessage.variant}>{flashMessage.title}</Badge>
                  <p className="mt-2 text-[12px] font-bold leading-5 text-zinc-600 dark:text-zinc-300">
                    {flashMessage.detail}
                  </p>
                </div>
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
            className="mx-auto flex min-h-[78dvh] w-full max-w-[24.25rem] flex-col justify-center pt-12"
          >
            <Card noPadding className="mx-auto w-full overflow-visible border-transparent bg-transparent shadow-none">
              <div className="p-6 text-center">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                    {text.resultLabel}
                  </p>
                  <h2 className="mt-3 truncate text-[2.05rem] font-black uppercase leading-none tracking-[-0.05em] text-emerald-950 dark:text-white">
                    {selectedPallet.qr_code}
                  </h2>
                </div>

                <div className="mt-6 grid gap-5">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-emerald-100 text-emerald-700 shadow-sm dark:bg-[#203d31] dark:text-emerald-100">
                      <Package size={19} />
                    </div>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                      {text.summaryType}
                    </p>
                    <p className="mt-1 text-[15px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                      {getPalletTypeLabel(selectedPallet.type, language)}
                    </p>
                  </div>

                  <div className="relative flex flex-col items-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-emerald-100 text-emerald-700 shadow-sm dark:bg-[#203d31] dark:text-emerald-100">
                      <Truck size={19} />
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <p className="text-[10px] font-black uppercase leading-none tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                        {text.summaryClient}
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenChangeMenu((current) => (current === 'client' ? null : 'client'))}
                        disabled={draftStatusId !== 4}
                        className={cn(
                          changeTriggerClass,
                          draftStatusId !== 4 && 'cursor-not-allowed text-emerald-300'
                        )}
                      >
                        {text.changeLabel}
                        <ChevronDown
                          size={13}
                          className={cn('transition-transform', openChangeMenu === 'client' && 'rotate-180')}
                        />
                      </button>
                    </div>
                    <p className="mt-1 text-[15px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                      {selectedPallet.client_name || text.clientEmpty}
                    </p>
                    <AnimatePresence>
                      {openChangeMenu === 'client' && draftStatusId === 4 && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          className="absolute left-1/2 top-[calc(100%+0.55rem)] z-20 w-[12.5rem] -translate-x-1/2 overflow-hidden rounded-[1.2rem] border border-emerald-100 bg-white p-2 shadow-[0_24px_44px_-26px_rgba(0,166,85,0.45)] dark:border-white/10 dark:bg-[#1f3a2d] dark:shadow-[0_24px_44px_-26px_rgba(0,0,0,0.55)]"
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

                  <div className="flex flex-col items-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1.1rem] bg-emerald-100 text-emerald-700 shadow-sm dark:bg-[#203d31] dark:text-emerald-100">
                      <MapPin size={19} />
                    </div>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                      {text.summaryLocation}
                    </p>
                    <p className="mt-1 text-[15px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                      {selectedPallet.current_location}
                    </p>
                  </div>
                </div>

                <div className="mt-6 p-5 text-center">
                  <div className="relative flex flex-col items-center">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-black uppercase leading-none tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                        {text.currentStatus}
                      </p>
                      <button
                        type="button"
                        onClick={() => setOpenChangeMenu((current) => (current === 'status' ? null : 'status'))}
                        className={changeTriggerClass}
                      >
                        {text.changeLabel}
                        <ChevronDown
                          size={13}
                          className={cn('transition-transform', openChangeMenu === 'status' && 'rotate-180')}
                        />
                      </button>
                    </div>
                    <p className="mt-1.5 text-[15px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                      {getStatusLabel(selectedPallet.current_status_name, language)}
                    </p>
                    <AnimatePresence>
                      {openChangeMenu === 'status' && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          className="absolute left-1/2 top-[calc(100%+0.6rem)] z-20 w-[11.5rem] -translate-x-1/2 overflow-hidden rounded-[1.2rem] border border-emerald-100 bg-white p-2 shadow-[0_24px_44px_-26px_rgba(0,166,85,0.45)] dark:border-white/10 dark:bg-[#1f3a2d] dark:shadow-[0_24px_44px_-26px_rgba(0,0,0,0.55)]"
                        >
                          <div className="space-y-1">
                            {driverStatusOptions.map((status) => (
                              <button
                                key={status.id}
                                type="button"
                                onClick={() => handleStatusSelection(status.id)}
                                className={cn(
                                  'flex w-full items-center justify-center rounded-[0.95rem] px-3 py-2 text-center text-[12px] font-black uppercase tracking-tight transition-all',
                                  draftStatusId === status.id
                                    ? 'bg-emerald-50 text-emerald-800 dark:bg-white/10 dark:text-emerald-100'
                                    : 'text-zinc-600 hover:bg-emerald-50/80 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-emerald-100'
                                )}
                              >
                                {getStatusLabel(status.name, language)}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center space-y-3 p-5 pt-4">
                <input
                  ref={palletPhotoInputRef}
                  id="driver-pallet-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePalletPhotoChange}
                />

                <label
                  htmlFor="driver-pallet-photo"
                  className={actionButtonClass}
                >
                  <Camera size={20} className="mr-3 shrink-0" />
                  {text.capturePalletPhoto}
                </label>

                {palletPhotoUrl && (
                  <div className="w-full overflow-hidden rounded-[1.7rem] border border-emerald-100 bg-white p-2 shadow-[0_18px_40px_-28px_rgba(0,166,85,0.32)] dark:border-white/10 dark:bg-[#1a3327] dark:shadow-[0_18px_40px_-28px_rgba(0,0,0,0.55)]">
                    <div className="relative overflow-hidden rounded-[1.3rem] bg-emerald-50 dark:bg-[#203d31]">
                      <img
                        src={palletPhotoUrl}
                        alt={text.capturePalletPhoto}
                        className="h-40 w-full object-cover"
                      />
                      <div className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-emerald-600 shadow-[0_10px_24px_-16px_rgba(0,166,85,0.55)] dark:bg-[#172d22]/92 dark:text-emerald-200">
                        <CheckCircle2 size={18} />
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  className={actionButtonClass}
                  onClick={handleScanNext}
                >
                  <RefreshCcw size={20} className="mr-3 shrink-0" />
                  {text.scanNext}
                </Button>
              </div>
            </Card>
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
                          <p className="mt-1 truncate text-[11px] font-bold text-zinc-500 dark:text-[#9fcbb3]">
                            {pallet.client_name || text.clientEmpty}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:border dark:border-white/10 dark:bg-[#172d22] dark:text-emerald-100">
                          {getStatusLabel(pallet.current_status_name, language)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/60 p-4 dark:border-white/10 dark:bg-[#203d31]">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                    {text.resultLabel}
                  </p>
                  <p className="mt-2 text-[1.25rem] font-black uppercase tracking-[-0.04em] text-emerald-950 dark:text-white">
                    {activeScannedPallet.qr_code}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                        {text.summaryType}
                      </p>
                      <p className="mt-1 text-[12px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                        {getPalletTypeLabel(activeScannedPallet.type, language)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                        {text.currentStatus}
                      </p>
                      <p className="mt-1 text-[12px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                        {getStatusLabel(activeScannedPallet.current_status_name, language)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                        {text.summaryClient}
                      </p>
                      <p className="mt-1 text-[12px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                        {activeScannedPallet.client_name || text.clientEmpty}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                        {text.summaryLocation}
                      </p>
                      <p className="mt-1 text-[12px] font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                        {activeScannedPallet.current_location}
                      </p>
                    </div>
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
