import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  QrCode,
  X,
  ScanLine,
  Camera,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Wrench,
} from 'lucide-react';
import { Button, Card, Badge, Input, cn } from './ui';
import { useApp } from '../AppContext';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';
import { Pallet, User } from '../types';

interface ScannerProps {
  onClose: () => void;
  currentUser: User;
}

type ScanMode = 'singular' | 'bulk';
type ActionMode = 'status' | 'service';

interface RoleScannerConfig {
  statusIds: number[];
  canReportDamage: boolean;
}

const roleScannerConfigById: Record<number, RoleScannerConfig> = {
  1: { statusIds: [1, 2, 3, 4, 5, 6], canReportDamage: true },
  2: { statusIds: [2, 4, 5, 6], canReportDamage: true },
  3: { statusIds: [1, 2, 3, 4, 5, 6], canReportDamage: true },
  4: { statusIds: [5], canReportDamage: true },
  5: { statusIds: [1], canReportDamage: true },
};

const getStatusVariant = (statusId: number): 'default' | 'info' | 'warning' | 'success' | 'danger' => {
  if (statusId === 7) return 'danger';
  if (statusId === 4) return 'success';
  if (statusId === 5) return 'warning';
  if ([2, 6].includes(statusId)) return 'info';
  return 'default';
};

export const PalletScanner: React.FC<ScannerProps> = ({ onClose, currentUser }) => {
  const { pallets, statuses, clients, updatePalletStatus, reportDamage, t, language } = useApp();
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [clientSearch, setClientSearch] = useState('');
  const [location, setLocation] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode | null>(null);
  const [activeAction, setActiveAction] = useState<ActionMode | null>(null);
  const [serviceNote, setServiceNote] = useState('');

  const scannerConfig = roleScannerConfigById[currentUser.role_id] || roleScannerConfigById[1];
  const availableStatuses = statuses.filter((status) => scannerConfig.statusIds.includes(status.id));
  const scannedPallets = scannedCodes
    .map((code) => pallets.find((pallet) => pallet.qr_code === code))
    .filter((pallet): pallet is Pallet => Boolean(pallet));
  const primaryPallet = scanMode === 'singular' ? scannedPallets[0] || null : null;
  const requiresClientSelection = activeAction === 'status' && selectedStatusId === 4;
  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const resetActionState = () => {
    setActiveAction(null);
    setSelectedStatusId(null);
    setSelectedClientId(undefined);
    setClientSearch('');
    setServiceNote('');
  };

  const handleModeSelect = (mode: ScanMode) => {
    setScanMode(mode);
    setScannedCodes([]);
    setLocation('');
    setIsScanning(false);
    resetActionState();
  };

  const handleChangeProcessType = () => {
    setScanMode(null);
    setScannedCodes([]);
    setLocation('');
    setIsScanning(false);
    resetActionState();
  };

  const handleSelectStatus = (statusId: number) => {
    setActiveAction('status');
    setSelectedStatusId(statusId);
    setServiceNote('');

    if (statusId === 4 && scanMode === 'singular' && primaryPallet?.user_id) {
      setSelectedClientId(primaryPallet.user_id);
    } else if (statusId !== 4) {
      setSelectedClientId(undefined);
    }
  };

  const handleSelectService = () => {
    setActiveAction('service');
    setSelectedStatusId(null);
  };

  const simulateScan = () => {
    if (isScanning || !scanMode) {
      return;
    }

    setIsScanning(true);

    window.setTimeout(() => {
      const pool =
        scanMode === 'bulk'
          ? pallets.filter((pallet) => !scannedCodes.includes(pallet.qr_code))
          : pallets;
      const nextPallet =
        pool[Math.floor(Math.random() * pool.length)] ||
        pallets[Math.floor(Math.random() * pallets.length)];

      if (!nextPallet) {
        setIsScanning(false);
        return;
      }

      setScannedCodes((prev) =>
        scanMode === 'singular'
          ? [nextPallet.qr_code]
          : prev.includes(nextPallet.qr_code)
            ? prev
            : [...prev, nextPallet.qr_code]
      );
      setLocation((prev) => prev || nextPallet.current_location);
      resetActionState();

      if (scanMode === 'singular' && nextPallet.user_id) {
        setSelectedClientId(nextPallet.user_id);
      }

      setIsScanning(false);
    }, 900);
  };

  const removeScannedCode = (code: string) => {
    setScannedCodes((prev) => prev.filter((entry) => entry !== code));
    if (scanMode === 'singular') {
      resetActionState();
      setLocation('');
    }
  };

  const clearScannedCodes = () => {
    setScannedCodes([]);
    setLocation('');
    resetActionState();
  };

  const handleComplete = () => {
    if (scannedPallets.length === 0 || !activeAction) {
      return;
    }

    if (activeAction === 'service') {
      const note = serviceNote.trim();

      scannedPallets.forEach((pallet) => {
        reportDamage({
          pallet_id: pallet.id,
          reported_by_user_id: currentUser.id,
          reported_by_user_name: currentUser.name,
          problem_description: location
            ? `${note} (${t('currentLocation')}: ${location})`
            : note,
        });
      });

      onClose();
      return;
    }

    if (!selectedStatusId) {
      return;
    }

    scannedPallets.forEach((pallet) => {
      updatePalletStatus(
        pallet.id,
        selectedStatusId,
        currentUser.id,
        currentUser.name,
        location || pallet.current_location,
        '',
        selectedStatusId === 4 ? selectedClientId : undefined
      );
    });

    onClose();
  };

  const confirmDisabled =
    scannedPallets.length === 0 ||
    !activeAction ||
    (activeAction === 'status' && !selectedStatusId) ||
    (requiresClientSelection && !selectedClientId) ||
    (activeAction === 'service' && !serviceNote.trim());

  const confirmLabel = activeAction === 'service' ? t('applyServiceReport') : t('applyStatusUpdate');

  return (
    <div id="scanner-modal" className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-5xl"
      >
        <Card noPadding className="shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[90vh] rounded-2xl">
          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-zinc-950 text-white shrink-0">
            <div className="flex items-center gap-2">
              <QrCode size={18} />
              <h2 className="text-lg font-black uppercase tracking-tighter font-display">{t('operationCenter')}</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col items-center bg-white no-scrollbar">
            {!scanMode ? (
              <div className="w-full max-w-2xl py-12 space-y-8 flex flex-col items-center">
                <div className="text-center space-y-1">
                  <h3 className="text-2xl font-black tracking-tighter uppercase text-black font-display">{t('selectOperation')}</h3>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">{t('chooseProcessingMode')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  <button
                    onClick={() => handleModeSelect('singular')}
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
                    onClick={() => handleModeSelect('bulk')}
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
              <div className="w-full max-w-5xl mx-auto space-y-8">
                <div className="w-full">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleChangeProcessType}
                    className="text-zinc-400 -ml-2"
                  >
                    <ChevronRight size={14} className="rotate-180 mr-2" /> {t('changeProcessType')}
                  </Button>
                </div>

                <div className="space-y-4 text-center max-w-2xl mx-auto">
                  <Badge variant="default">
                    {scanMode === 'bulk' ? t('bulkScan') : t('regularScan')}
                  </Badge>
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter uppercase text-black font-display">{t('scanCenterTitle')}</h3>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-2">{t('scanCenterSubtitle')}</p>
                  </div>
                </div>

                <div className="w-full flex justify-center">
                  <button
                    onClick={simulateScan}
                    className="relative w-full max-w-[27rem] aspect-[4/3] rounded-[2rem] bg-zinc-950 border border-white/10 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)] overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.16),transparent_62%)]" />
                    {isScanning ? (
                      <div className="absolute inset-0">
                        <motion.div
                          animate={{ y: [0, 320, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                          className="absolute inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] z-10"
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                          <Camera size={42} className="text-white animate-pulse opacity-50" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">{t('scanAction')}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
                        <div className="w-24 h-24 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all">
                          <ScanLine size={52} className="text-white/70 group-hover:text-white transition-all" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-black uppercase tracking-[0.18em] text-white">{t('scanAction')}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{t('readyToScan')}</p>
                        </div>
                      </div>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.95fr)] gap-6">
                  <Card
                    title={scanMode === 'bulk' ? `${t('scannedUnits')} (${scannedPallets.length})` : t('detectedUnit')}
                    action={
                      scannedPallets.length > 0 ? (
                        <Button variant="ghost" size="xs" onClick={clearScannedCodes}>
                          {t('clear')}
                        </Button>
                      ) : undefined
                    }
                    noPadding
                  >
                    {scannedPallets.length === 0 ? (
                      <div className="px-6 py-12 flex flex-col items-center justify-center text-center text-zinc-300 gap-3">
                        <AlertCircle size={28} className="opacity-50" />
                        <p className="text-[10px] font-black uppercase tracking-[0.18em]">{t('readyToScan')}</p>
                        <p className="text-[11px] font-bold text-zinc-400 max-w-sm leading-relaxed">
                          {scanMode === 'bulk' ? t('scanBulkHint') : t('scanSingleHint')}
                        </p>
                      </div>
                    ) : scanMode === 'singular' && primaryPallet ? (
                      <div className="p-6 space-y-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-mono text-lg font-black tracking-tight">{primaryPallet.qr_code}</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mt-1">
                              {getPalletTypeLabel(primaryPallet.type, language)}
                            </p>
                          </div>
                          <Badge variant={getStatusVariant(primaryPallet.current_status_id)}>
                            {t('currentStatusLabel')}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/70">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">{t('currentStatusLabel')}</p>
                            <Badge variant={getStatusVariant(primaryPallet.current_status_id)}>
                              {getStatusLabel(primaryPallet.current_status_name, language)}
                            </Badge>
                          </div>
                          <div className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/70">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">{t('currentLocation')}</p>
                            <p className="text-[11px] font-black leading-tight text-zinc-900">{primaryPallet.current_location}</p>
                          </div>
                          <div className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/70">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">{t('currentClientLabel')}</p>
                            <p className="text-[11px] font-black leading-tight text-zinc-900">
                              {primaryPallet.client_name || t('noClient')}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button variant="ghost" size="xs" onClick={() => removeScannedCode(primaryPallet.qr_code)}>
                            <X size={12} className="mr-1.5" /> {t('remove')}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3 max-h-[25rem] overflow-y-auto no-scrollbar">
                        {scannedPallets.map((pallet) => (
                          <div
                            key={`bulk-scan-${pallet.id}`}
                            className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/70 flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <p className="font-mono text-[11px] font-black tracking-tight">{pallet.qr_code}</p>
                              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 mt-1 truncate">
                                {getPalletTypeLabel(pallet.type, language)}
                              </p>
                              <p className="text-[10px] font-bold text-zinc-500 mt-2 truncate">
                                {pallet.client_name || t('noClient')}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <Badge variant={getStatusVariant(pallet.current_status_id)}>
                                {getStatusLabel(pallet.current_status_name, language)}
                              </Badge>
                              <div className="flex items-center justify-end gap-1 mt-3 text-zinc-400">
                                <MapPin size={11} />
                                <span className="text-[9px] font-black uppercase tracking-[0.16em]">{pallet.current_location}</span>
                              </div>
                              <button
                                onClick={() => removeScannedCode(pallet.qr_code)}
                                className="mt-3 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-300 hover:text-black transition-colors"
                              >
                                {t('remove')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card
                    title={t('allowedUpdates')}
                    action={<Badge variant="default">{t('roleRestricted')}</Badge>}
                  >
                    {scannedPallets.length === 0 ? (
                      <div className="space-y-3 text-center py-10">
                        <AlertCircle size={24} className="mx-auto text-zinc-300" />
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                          {scanMode === 'bulk' ? t('scanBulkHint') : t('scanSingleHint')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('availableStatusChanges')}</p>
                          {availableStatuses.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {availableStatuses.map((status) => (
                                <button
                                  key={status.id}
                                  onClick={() => handleSelectStatus(status.id)}
                                  className={cn(
                                    'p-4 rounded-2xl border-2 transition-all text-left',
                                    activeAction === 'status' && selectedStatusId === status.id
                                      ? 'border-black bg-black text-white shadow-xl shadow-black/20'
                                      : 'border-zinc-100 bg-zinc-50 text-zinc-500 hover:border-zinc-200'
                                  )}
                                >
                                  <p className="text-[10px] font-black uppercase tracking-tight">{getStatusLabel(status.name, language)}</p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] font-bold text-zinc-400 leading-relaxed">{t('noAllowedStatusChanges')}</p>
                          )}
                        </div>

                        {scannerConfig.canReportDamage && (
                          <button
                            onClick={handleSelectService}
                            className={cn(
                              'w-full p-4 rounded-2xl border-2 transition-all flex items-start gap-3 text-left',
                              activeAction === 'service'
                                ? 'border-rose-500 bg-rose-50 text-rose-700'
                                : 'border-rose-100 bg-rose-50/60 text-rose-600 hover:bg-rose-50'
                            )}
                          >
                            <div className="w-10 h-10 rounded-xl bg-white/70 border border-current/10 flex items-center justify-center shrink-0">
                              <Wrench size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.16em]">{t('serviceDamageAction')}</p>
                              <p className="text-[11px] font-bold leading-relaxed mt-1 opacity-80">{t('serviceDamageHint')}</p>
                            </div>
                          </button>
                        )}

                        {activeAction && (
                          <div className="pt-5 border-t border-zinc-100 space-y-4">
                            {requiresClientSelection && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('selectClient')}</p>
                                  <input
                                    type="text"
                                    placeholder={t('search')}
                                    value={clientSearch}
                                    onChange={(event) => setClientSearch(event.target.value)}
                                    className="text-[9px] bg-zinc-50 border border-zinc-100 focus:border-black rounded-full px-3 py-1 font-black uppercase outline-none transition-all"
                                  />
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-[11rem] overflow-y-auto no-scrollbar pr-1">
                                  {filteredClients.map((client) => (
                                    <button
                                      key={client.id}
                                      onClick={() => setSelectedClientId(client.user_id)}
                                      className={cn(
                                        'w-full p-3 rounded-2xl border transition-all text-left flex items-center justify-between',
                                        selectedClientId === client.user_id
                                          ? 'border-black bg-white shadow-lg shadow-black/5'
                                          : 'border-transparent bg-zinc-50/60 text-zinc-500 hover:border-zinc-200'
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

                            <div className="space-y-2">
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('currentLocation')}</p>
                              <Input
                                placeholder={t('currentLocationPlaceholder')}
                                value={location}
                                onChange={(event) => setLocation(event.target.value)}
                              />
                            </div>

                            {activeAction === 'service' && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('damageDescription')}</p>
                                <textarea
                                  className="w-full p-4 bg-zinc-50 border border-zinc-200 focus:border-black rounded-2xl font-black text-[11px] outline-none transition-all resize-none h-28 placeholder:text-zinc-300"
                                  placeholder={t('serviceNotePlaceholder')}
                                  value={serviceNote}
                                  onChange={(event) => setServiceNote(event.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>

          {scanMode && (
            <div className="p-6 md:p-8 border-t border-zinc-100 flex gap-4 shrink-0 bg-zinc-50">
              <Button variant="outline" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
              <Button
                className="flex-[2]"
                disabled={confirmDisabled}
                onClick={handleComplete}
              >
                {confirmLabel} {scannedPallets.length} {scannedPallets.length === 1 ? t('updateSingular') : t('updatePlural')}
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};
