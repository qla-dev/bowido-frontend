import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Badge, Button, Card, Input, Select } from './ui';
import { useApp } from '../AppContext';
import { ClientDetail, Pallet, RoleType, User } from '../types';
import {
  AlertTriangle,
  Ghost,
  Link2,
  PackageSearch,
  Search,
  Send,
  X,
} from 'lucide-react';

interface GhostPalletCenterProps {
  currentUser: User;
  onClose: () => void;
}

const getGhostActionStyles = (isHighlighted: boolean) =>
  isHighlighted
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : 'border-zinc-200 bg-white text-zinc-700';

export const GhostPalletCenter: React.FC<GhostPalletCenterProps> = ({ currentUser, onClose }) => {
  const { pallets, clients, reportGhostPallets, pairGhostPallet, t } = useApp();
  const [ghostCount, setGhostCount] = useState(1);
  const [ghostNote, setGhostNote] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [pairingGhostId, setPairingGhostId] = useState<number | null>(null);
  const [newQrCode, setNewQrCode] = useState('');
  const [ghostSearch, setGhostSearch] = useState('');

  const isClient = currentUser.role_name === RoleType.KLIJENT;
  const isDriver = currentUser.role_name === RoleType.VOZAC;
  const emphasizeGhost = isClient || isDriver;
  const roleClients = useMemo(() => {
    if (isClient) {
      return clients.filter(client => client.user_id === currentUser.id);
    }

    return clients;
  }, [clients, currentUser.id, isClient]);

  const ghostPallets = useMemo(
    () =>
      pallets
        .filter(pallet => pallet.is_ghost)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [pallets]
  );

  const filteredGhostPallets = useMemo(() => {
    const normalizedSearch = ghostSearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return ghostPallets;
    }

    return ghostPallets.filter(pallet =>
      [pallet.qr_code, pallet.client_name, pallet.current_location, pallet.note]
        .filter(Boolean)
        .some(value => value!.toLowerCase().includes(normalizedSearch))
    );
  }, [ghostPallets, ghostSearch]);

  const selectedClient = roleClients.find(client => client.user_id === selectedClientId);
  const openGhostCount = ghostPallets.length;
  const affectedClientCount = new Set(ghostPallets.map(pallet => pallet.user_id).filter(Boolean)).size;

  useEffect(() => {
    if (roleClients.length === 0) {
      setSelectedClientId('');
      return;
    }

    setSelectedClientId(previousValue => {
      if (previousValue && roleClients.some(client => client.user_id === previousValue)) {
        return previousValue;
      }

      return roleClients[0].user_id;
    });
  }, [roleClients]);

  const handleReport = () => {
    if (!selectedClient) {
      return;
    }

    reportGhostPallets(ghostCount, selectedClient.user_id, selectedClient.name, ghostNote.trim());
    setGhostCount(1);
    setGhostNote('');
  };

  const handlePair = (ghostPallet: Pallet) => {
    if (!newQrCode.trim()) {
      return;
    }

    pairGhostPallet(ghostPallet.id, newQrCode.trim().toUpperCase());
    setPairingGhostId(null);
    setNewQrCode('');
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[160] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-6xl"
      >
        <Card noPadding className="overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.18)]">
          <div className="px-6 md:px-8 py-5 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={getGhostActionStyles(emphasizeGhost) + ' w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0'}>
                <Ghost size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-emerald-950 font-display">
                  {t('ghostReportTitle')}
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 truncate">
                  {t('ghostReportSubtitle')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:border-emerald-300 hover:text-emerald-700 transition-all flex items-center justify-center shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 md:p-8 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className={emphasizeGhost ? 'border-rose-100 bg-rose-50/50' : ''}>
                <div className="flex items-center gap-3">
                  <div className={getGhostActionStyles(emphasizeGhost) + ' w-10 h-10 rounded-xl border flex items-center justify-center shrink-0'}>
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('openReports')}</p>
                    <p className="text-2xl font-black tracking-tight text-emerald-950">{openGhostCount}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0 text-zinc-500">
                    <Ghost size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('affectedClients')}</p>
                    <p className="text-2xl font-black tracking-tight text-emerald-950">{affectedClientCount}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-center shrink-0 text-zinc-500">
                    <Link2 size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('readyForPairing')}</p>
                    <p className="text-2xl font-black tracking-tight text-emerald-950">{openGhostCount}</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6 items-start">
              <Card title={t('newReport')}>
                <div className="space-y-5">
                  <div className={getGhostActionStyles(emphasizeGhost) + ' p-4 rounded-2xl border'}>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                      {emphasizeGhost ? t('specialImportant') : t('quickReport')}
                    </p>
                    <p className="text-[12px] font-bold leading-relaxed mt-2">
                      {t('ghostReportHelp')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                      {t('client')}
                    </label>
                    <Select
                      value={selectedClientId}
                      onChange={(event) => setSelectedClientId(Number(event.target.value))}
                      disabled={roleClients.length === 0 || isClient}
                    >
                      {roleClients.map((client: ClientDetail) => (
                        <option key={client.id} value={client.user_id}>
                          {client.name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                      {t('quantity')}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      value={ghostCount}
                      onChange={(event) => setGhostCount(Math.max(1, Number(event.target.value) || 1))}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                      {t('note')}
                    </label>
                    <textarea
                      value={ghostNote}
                      onChange={(event) => setGhostNote(event.target.value)}
                      placeholder={t('ghostNotePlaceholder')}
                      className="w-full min-h-28 px-4 py-3 bg-zinc-50 border border-zinc-200 focus:border-[#00A655] focus:bg-white rounded-xl font-black text-[12px] outline-none transition-all placeholder:text-zinc-300 tracking-tight resize-none"
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleReport}
                    disabled={!selectedClient}
                  >
                    <Send size={15} className="mr-2" />
                    {t('sendReport')}
                  </Button>
                </div>
              </Card>

              <Card title={t('openGhostEntries')} noPadding>
                <div className="p-5 border-b border-zinc-100 bg-zinc-50/50 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      {t('reviewAndPair')}
                    </p>
                    <p className="text-[12px] font-bold text-zinc-600 mt-1">
                      {t('reviewAndPairDescription')}
                    </p>
                  </div>
                  <div className="relative w-full md:w-64">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                    <Input
                      value={ghostSearch}
                      onChange={(event) => setGhostSearch(event.target.value)}
                      placeholder={t('searchReports')}
                      className="pl-11 bg-white"
                    />
                  </div>
                </div>

                <div className="divide-y divide-zinc-100">
                  {filteredGhostPallets.length > 0 ? (
                    filteredGhostPallets.map((ghostPallet) => {
                      const isPairingThisGhost = pairingGhostId === ghostPallet.id;

                      return (
                        <div key={`ghost-center-${ghostPallet.id}`} className="p-5">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="warning">Ghost</Badge>
                                <Badge variant="default">{t('withoutQr')}</Badge>
                              </div>
                              <h3 className="text-sm font-black uppercase tracking-tight text-emerald-950">
                                {ghostPallet.client_name || t('unknownClient')}
                              </h3>
                              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 mt-1">
                                {ghostPallet.current_location}
                              </p>
                              <p className="text-[11px] font-bold text-zinc-600 mt-3 leading-relaxed">
                                {ghostPallet.note || t('noAdditionalNote')}
                              </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2 lg:items-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setPairingGhostId(ghostPallet.id);
                                  setNewQrCode('');
                                }}
                              >
                                <PackageSearch size={15} className="mr-2" />
                                {t('reviewAndPairAction')}
                              </Button>
                            </div>
                          </div>

                          {isPairingThisGhost && (
                            <div className="mt-4 p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50">
                              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
                                <div className="space-y-2">
                                  <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                                    {t('newQrCode')}
                                  </label>
                                  <Input
                                    value={newQrCode}
                                    onChange={(event) => setNewQrCode(event.target.value.toUpperCase())}
                                    placeholder="TP-2026-0001"
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setPairingGhostId(null);
                                      setNewQrCode('');
                                    }}
                                  >
                                    {t('cancel')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handlePair(ghostPallet)}
                                    disabled={!newQrCode.trim()}
                                  >
                                    <Link2 size={15} className="mr-2" />
                                    {t('pair')}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-10 text-center text-zinc-400">
                      <Ghost size={28} className="mx-auto mb-3 opacity-40" />
                      <p className="text-[10px] font-black uppercase tracking-[0.18em]">
                        {t('noOpenGhostReports')}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
