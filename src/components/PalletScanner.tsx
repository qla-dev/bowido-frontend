import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, X, ScanLine, Camera, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button, Card, Badge, Input, cn } from './ui';
import { useApp } from '../AppContext';
import { User } from '../types';

interface ScannerProps {
  onClose: () => void;
  currentUser: User;
}

export const PalletScanner: React.FC<ScannerProps> = ({ onClose, currentUser }) => {
  const { pallets, statuses, clients, updatePalletStatus, t } = useApp();
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<number>(1);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [clientSearch, setClientSearch] = useState('');
  const [location, setLocation] = useState('');
  const [scanMode, setScanMode] = useState<'singular' | 'bulk' | null>(null);

  const getAllowedStatusIds = () => {
    switch (currentUser.role_id) {
      case 2:
        return [4, 5, 3];
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

  const simulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const randomPallet = pallets[Math.floor(Math.random() * pallets.length)];
      if (!randomPallet) {
        setIsScanning(false);
        return;
      }

      const code = randomPallet.qr_code;
      if (!scannedCodes.includes(code)) {
        setScannedCodes((prev) => [...prev, code]);
      }

      setIsScanning(false);
    }, 1000);
  };

  const handleComplete = () => {
    scannedCodes.forEach((code) => {
      const pallet = pallets.find((item) => item.qr_code === code);
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
    <div id="scanner-modal" className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl"
      >
        <Card noPadding className="shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col h-[90vh] md:h-auto md:max-h-[85vh] rounded-2xl">
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
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8">
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

                <div className="bg-zinc-50 rounded-2xl p-6 flex flex-col items-center border border-zinc-200">
                  <div className="relative aspect-square w-full max-w-[160px] mb-8 group cursor-pointer" onClick={simulateScan}>
                    <div className="absolute inset-0 bg-zinc-950 rounded-xl shadow-2xl overflow-hidden flex items-center justify-center border border-white/10">
                      {isScanning ? (
                        <div className="w-full h-full relative">
                          <motion.div
                            animate={{ y: [0, 160, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            className="absolute inset-x-0 h-0.5 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] z-10"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Camera size={32} className="text-white animate-pulse opacity-40" />
                          </div>
                        </div>
                      ) : (
                        <ScanLine size={48} className="text-white opacity-20 group-hover:opacity-40 transition-all duration-500" />
                      )}
                    </div>
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

          {scanMode && (
            <div className="p-8 border-t border-zinc-100 flex gap-4 shrink-0 bg-zinc-50">
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
