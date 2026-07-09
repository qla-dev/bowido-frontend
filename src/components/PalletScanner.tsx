import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, X, ScanLine, Camera, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button, Card, Badge, Input, cn } from './ui';
import { useApp } from '../AppContext';
import { Pallet, User } from '../types';
import { findPalletByScannedQr } from '../lib/palletQrMatching';
import { decodeQrFromVideo } from '../lib/videoQrDecoder';

const CAMERA_ZOOM_MIN = 1;
const CAMERA_ZOOM_MAX = 3;
const CAMERA_ZOOM_STEP = 0.1;

const clampCameraZoom = (value: number) =>
  Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, Number(value.toFixed(2))));

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

interface ScannerProps {
  onClose: () => void;
  currentUser: User;
  onPalletDetected?: (pallet: Pallet) => void;
}

export const PalletScanner: React.FC<ScannerProps> = ({ onClose, currentUser, onPalletDetected }) => {
  const { pallets, statuses, clients, updatePalletStatus, t, language } = useApp();
  const isDetailScan = Boolean(onPalletDetected);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<number>(1);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [clientSearch, setClientSearch] = useState('');
  const [location, setLocation] = useState('');
  const [scanMode, setScanMode] = useState<'singular' | 'bulk' | null>(isDetailScan ? 'singular' : null);
  const [cameraZoom, setCameraZoom] = useState(CAMERA_ZOOM_MIN);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const detectorRef = React.useRef<BarcodeDetectorLike | null>(null);
  const scanFrameRef = React.useRef<number | null>(null);
  const scanBusyRef = React.useRef(false);
  const lastDetectedAtRef = React.useRef(0);

  const getAllowedStatusIds = () => {
    switch (currentUser.role_id) {
      case 2:
        return [4, 5, 2, 6, 3, 1];
      case 3:
        return [1, 2, 3, 4, 6, 7];
      case 5:
        return [1];
      default:
        return statuses.map((status) => status.id);
    }
  };

  const allowedStatusIds = getAllowedStatusIds();
  const filteredStatuses = statuses.filter((status) => allowedStatusIds.includes(status.id));

  React.useEffect(() => {
    if (!allowedStatusIds.includes(selectedStatusId) && filteredStatuses.length > 0) {
      setSelectedStatusId(filteredStatuses[0].id);
    }
  }, [currentUser.role_id]);

  const handleDetectedPallet = React.useCallback((pallet: Pallet) => {
    if (onPalletDetected) {
      onPalletDetected(pallet);
      return;
    }

    const code = pallet.qr_code;
    setScannedCodes((prev) => prev.includes(code) ? prev : [...prev, code]);
  }, [onPalletDetected]);

  const handleDetectedCode = React.useCallback((rawValue: string) => {
    const matchedPallet = findPalletByScannedQr(rawValue, pallets);

    if (!matchedPallet) {
      lastDetectedAtRef.current = Date.now();
      return;
    }

    handleDetectedPallet(matchedPallet);
    lastDetectedAtRef.current = Date.now();
  }, [handleDetectedPallet, pallets]);

  const getBarcodeDetector = React.useCallback(async () => {
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

      return new detectorApi({ formats: ['qr_code'] });
    } catch {
      return null;
    }
  }, []);

  React.useEffect(() => {
    if (!scanMode) {
      return;
    }

    let cancelled = false;

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

      detectorRef.current = null;
      setIsCameraActive(false);
    };

    const detectFromCamera = async () => {
      const detector = detectorRef.current;
      const video = videoRef.current;

      if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || scanBusyRef.current) {
        return;
      }

      const now = Date.now();
      if (now - lastDetectedAtRef.current < 1200) {
        return;
      }

      scanBusyRef.current = true;

      try {
        let rawValue: string | null = null;

        if (detector) {
          const codes = await detector.detect(video);
          rawValue = codes.find((item) => item.rawValue?.trim())?.rawValue?.trim() || null;
        } else {
          rawValue = decodeQrFromVideo(video, scanCanvasRef);
        }

        if (rawValue) {
          handleDetectedCode(rawValue);
        }
      } finally {
        scanBusyRef.current = false;
      }
    };

    const runDetectionLoop = () => {
      scanFrameRef.current = window.requestAnimationFrame(async () => {
        await detectFromCamera();

        if (!cancelled) {
          runDetectionLoop();
        }
      });
    };

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return;
      }

      if (cancelled) {
        return;
      }

      try {
        const detector = await getBarcodeDetector();
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

        detectorRef.current = detector;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        setIsCameraActive(true);
        runDetectionLoop();
      } catch {
        stopCamera();
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [getBarcodeDetector, handleDetectedCode, scanMode]);

  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const randomPallet = pallets[Math.floor(Math.random() * pallets.length)];
      if (!randomPallet) {
        setIsScanning(false);
        return;
      }

      handleDetectedPallet(randomPallet);

      setIsScanning(false);
    }, 1000);
  };

  const updateCameraZoom = (value: number) => {
    setCameraZoom(clampCameraZoom(value));
  };
  const cameraZoomLabel =
    language === 'bs' ? 'Zoom kamere' : language === 'nl' ? 'Camera zoom' : 'Camera zoom';

  const handleComplete = () => {
    scannedCodes.forEach((code) => {
      const pallet = findPalletByScannedQr(code, pallets);
      if (pallet) {
        updatePalletStatus(
          pallet.id,
          selectedStatusId,
          currentUser.id,
          currentUser.name,
          location,
          '',
          selectedClientId
        );
      }
    });

    onClose();
  };

  return (
    <div id="scanner-modal" className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="my-auto flex w-full max-w-4xl items-center justify-center"
      >
        <Card noPadding className="mx-auto flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-[1.75rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] md:h-auto md:max-h-[85vh]">
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-950 text-white shrink-0">
            <div className="flex items-center gap-2">
              <QrCode size={18} />
              <h2 className="text-lg font-black uppercase tracking-tighter font-display">{t('operationCenter')}</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center overflow-y-auto bg-white p-5 md:p-8 no-scrollbar">
            {!scanMode ? (
              <div className="w-full max-w-2xl py-12 space-y-8 flex flex-col items-center">
                <div className="text-center space-y-1">
                  <h3 className="text-2xl font-black tracking-tighter uppercase text-black font-display">{t('selectOperation')}</h3>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{t('chooseProcessingMode')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => setScanMode('singular')}
                    className="flex flex-col items-center gap-4 p-8 bg-zinc-50 rounded-2xl border-2 border-zinc-200 hover:border-zinc-950 transition-all group active:scale-95"
                  >
                    <div className="w-16 h-16 bg-white shadow-xl shadow-black/5 rounded-xl flex items-center justify-center group-hover:bg-zinc-950 group-hover:text-white transition-all border border-zinc-100">
                      <ScanLine size={32} />
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-black block uppercase tracking-tight text-black font-display">{t('regularScan')}</span>
                      <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.1em]">{t('singleUpdate')}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setScanMode('bulk')}
                    className="flex flex-col items-center gap-4 p-8 bg-zinc-50 rounded-2xl border-2 border-zinc-200 hover:border-zinc-950 transition-all group active:scale-95"
                  >
                    <div className="w-16 h-16 bg-white shadow-xl shadow-black/5 rounded-xl flex items-center justify-center group-hover:bg-zinc-950 group-hover:text-white transition-all border border-zinc-100">
                      <QrCode size={32} />
                    </div>
                    <div className="text-center">
                      <span className="text-lg font-black block uppercase tracking-tight text-black font-display">{t('bulkScan')}</span>
                      <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.1em]">{t('multiProcess')}</span>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className={cn("w-full grid grid-cols-1 gap-8", isDetailScan ? "max-w-xl" : "md:grid-cols-2")}>
                {!isDetailScan && (
                <div className="space-y-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setScanMode(null);
                      setScannedCodes([]);
                    }}
                    className="text-zinc-400 -ml-2"
                  >
                    <ChevronRight size={14} className="rotate-180 mr-2" /> {t('changeProcessType')}
                  </Button>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">1. {t('status')}</h3>
                      <Badge variant="default" className="text-[8px]">{t('roleRestricted')}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredStatuses.map((status) => (
                        <button
                          key={status.id}
                          onClick={() => setSelectedStatusId(status.id)}
                          className={cn(
                            'p-3 rounded-2xl border-2 transition-all text-left group',
                            selectedStatusId === status.id
                              ? 'border-black bg-black text-white shadow-xl shadow-black/20'
                              : 'border-zinc-100 bg-zinc-50 text-zinc-400 hover:border-zinc-200'
                          )}
                        >
                          <p className="text-[10px] font-black uppercase tracking-tight">{status.name}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedStatusId === 4 && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">2. {t('selectClient')}</h3>
                        <input
                          type="text"
                          placeholder={t('search')}
                          value={clientSearch}
                          onChange={(event) => setClientSearch(event.target.value)}
                          className="text-[9px] bg-zinc-50 border border-zinc-100 focus:border-black rounded-full px-3 py-1 font-black uppercase outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto no-scrollbar pr-1">
                        {clients.filter((client) => client.name.toLowerCase().includes(clientSearch.toLowerCase())).map((client) => (
                          <button
                            key={client.id}
                            onClick={() => setSelectedClientId(client.user_id)}
                            className={cn(
                              'w-full p-3 rounded-2xl border transition-all text-left flex items-center justify-between transition-all',
                              selectedClientId === client.user_id
                                ? 'border-black bg-white shadow-lg shadow-black/5'
                                : 'border-transparent bg-zinc-50/50 text-zinc-400 hover:border-zinc-200'
                            )}
                          >
                            <div>
                              <p className="text-[10px] font-black text-black uppercase tracking-tight">{client.name}</p>
                              <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest">{client.country}</p>
                            </div>
                            {selectedClientId === client.user_id && <CheckCircle2 size={14} className="text-black" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 px-1">3. {t('currentLocation')}</h3>
                    <Input
                      placeholder={t('currentLocationPlaceholder')}
                      value={location}
                      onChange={(event) => setLocation(event.target.value)}
                    />
                  </div>
                </div>
                )}

                <div className="bg-zinc-50 rounded-2xl p-6 flex flex-col items-center border border-zinc-200">
                  <div
                    className="relative mb-3 aspect-square w-full max-w-[240px] select-none group"
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl">
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className={cn(
                          "absolute inset-0 h-full w-full origin-center object-cover transition-[opacity,transform] duration-300",
                          isCameraActive ? "opacity-100" : "opacity-0"
                        )}
                        style={{ transform: `scale(${cameraZoom})` }}
                      />
                      <div
                        className={cn(
                          "absolute inset-0 origin-center transition-[opacity,transform] duration-300 ease-out",
                          isCameraActive ? "opacity-20" : "opacity-100"
                        )}
                        style={{ transform: `scale(${cameraZoom})` }}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,166,85,0.2),transparent_48%),linear-gradient(135deg,rgba(255,255,255,0.12),transparent_36%),#07110d]" />
                        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:28px_28px]" />
                        <div className="absolute inset-8 rounded-full border border-emerald-400/10 bg-emerald-400/5 blur-sm" />
                      </div>

                      <div className="absolute inset-4 border border-white/10" />
                      <div className="absolute left-4 top-4 h-7 w-7 border-l-2 border-t-2 border-emerald-400" />
                      <div className="absolute right-4 top-4 h-7 w-7 border-r-2 border-t-2 border-emerald-400" />
                      <div className="absolute bottom-4 left-4 h-7 w-7 border-b-2 border-l-2 border-emerald-400" />
                      <div className="absolute bottom-4 right-4 h-7 w-7 border-b-2 border-r-2 border-emerald-400" />

                      <div className="trackpal-scan-line" />

                      <div className="absolute inset-0 flex items-center justify-center">
                        {isScanning ? (
                          <Camera size={36} className="text-white/45 animate-pulse" />
                        ) : isCameraActive ? (
                          <ScanLine size={54} className="text-white/25 transition-all duration-500" />
                        ) : (
                          <ScanLine size={54} className="text-white/20 transition-all duration-500 group-hover:text-white/35" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sticky top-0 z-10 mx-auto mb-6 w-3/4 max-w-[180px] rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label htmlFor="scanner-camera-zoom" className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                        {cameraZoomLabel}
                      </label>
                      <span className="font-mono text-[10px] font-black text-zinc-700">
                        {cameraZoom.toFixed(1)}x
                      </span>
                    </div>
                    <input
                      id="scanner-camera-zoom"
                      type="range"
                      min={CAMERA_ZOOM_MIN}
                      max={CAMERA_ZOOM_MAX}
                      step={CAMERA_ZOOM_STEP}
                      value={cameraZoom}
                      onChange={(event) => updateCameraZoom(Number(event.target.value))}
                      className="h-2 w-full cursor-pointer accent-[#00A655]"
                      aria-label={cameraZoomLabel}
                    />
                  </div>

                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{t('queue')} ({scannedCodes.length})</h3>
                      <button onClick={() => setScannedCodes([])} className="text-[8px] font-black text-zinc-300 hover:text-black uppercase tracking-widest transition-colors">{t('clear')}</button>
                    </div>

                    <Card noPadding className="bg-white max-h-[140px] overflow-y-auto no-scrollbar">
                      <AnimatePresence mode="popLayout">
                        {scannedCodes.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-zinc-200">
                            <AlertCircle size={24} className="mb-2 opacity-50" />
                            <p className="text-[9px] font-black uppercase tracking-widest">{t('readyToScan')}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            {scannedCodes.map((code) => (
                              <motion.div
                                key={`scanned-code-${code}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center justify-between p-3 border-b border-zinc-50 last:border-0"
                              >
                                <span className="font-mono font-black text-[10px] tracking-tight">{code}</span>
                                <Button variant="ghost" size="xs" onClick={() => setScannedCodes((prev) => prev.filter((item) => item !== code))}>
                                  <X size={12} className="text-zinc-300" />
                                </Button>
                              </motion.div>
                            )).reverse()}
                          </div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </div>
                </div>
              </div>
            )}
          </div>

          {scanMode && !isDetailScan && (
            <div className="flex shrink-0 flex-col gap-3 border-t border-zinc-100 bg-zinc-50 p-4 sm:flex-row sm:p-6 md:p-8">
              <Button variant="outline" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
              <Button
                className="flex-[2]"
                disabled={
                  scannedCodes.length === 0 ||
                  (selectedStatusId === 4 && !selectedClientId) ||
                  (scanMode === 'singular' && scannedCodes.length > 1)
                }
                onClick={handleComplete}
              >
                {t('confirm')} {scannedCodes.length} {scannedCodes.length === 1 ? 'Movement' : 'Movements'}
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};
