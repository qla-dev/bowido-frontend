import React, { useState } from 'react';
import { StatCard, Card, Button, Input, Badge } from './ui';
import { PalletScanner } from './PalletScanner';
import { DamageReportModal } from './DamageReportModal';
import { RoleType, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../AppContext';
import { QrCode, Package, ArrowRight, AlertTriangle, MapPin, History, CheckCircle2, Ghost, Truck, Route } from 'lucide-react';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';

interface WorkerDashboardProps {
  role: RoleType;
  user: User;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ role, user }) => {
  const { pallets, auditLogs, t, serviceReports, pairGhostPallet, resolveService, setIsGhostReportOpen, setIsScannerOpen, language } = useApp();
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [selectedGhostId, setSelectedGhostId] = useState<number | null>(null);
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(null);
  const [newQrCode, setNewQrCode] = useState('');
  const [activeTab, setActiveTab] = useState<'scan' | 'inventory' | 'history' | 'service'>('scan');
  const isDriver = role === RoleType.VOZAC;
  const isWarehouse = role === RoleType.MAGACINER;
  const isTechnician = role === RoleType.SERVISER;
  const roleLabel = isDriver ? t('driver') : isWarehouse ? t('warehouse') : t('technician');

  // Set initial tab for technician
  React.useEffect(() => {
    if (isTechnician) setActiveTab('service');
    if ((isDriver || isWarehouse) && activeTab === 'inventory') setActiveTab('scan');
  }, [isTechnician, isDriver, isWarehouse]);

  const todayLogs = auditLogs.filter(log => {
      const logDate = new Date(log.created_at);
      const today = new Date();
      return logDate.getDate() === today.getDate() && 
             logDate.getMonth() === today.getMonth() &&
             logDate.getFullYear() === today.getFullYear() &&
             log.made_by_user_id === user.id;
  });

  const pendingPickups = pallets.filter(p => p.current_status_id === 5); // Voor retour
  const inTransport = pallets.filter(p => [2, 6].includes(p.current_status_id));
  const warehouseDispatch = pallets.filter(p => [2, 6].includes(p.current_status_id));
  const warehouseReturns = pallets.filter(p => p.current_status_id === 5);
  const serviceJobs = pallets.filter(p => p.current_status_id === 7 || serviceReports.some(r => r.pallet_id === p.id && !r.resolved_at));
  const ghostPallets = pallets.filter(p => p.is_ghost);
  const driverStops = (pendingPickups.length > 0 ? pendingPickups : inTransport).slice(0, 4);
  const warehouseQueue = pallets.filter(p => [5, 2, 6, 7, 1, 3].includes(p.current_status_id)).slice(0, 6);
  const activeRoutePallet = inTransport[0] || pendingPickups[0] || pallets[0];
  const nextStopLabel = pendingPickups[0]?.current_location || activeRoutePallet?.current_location || 'Eindhoven Hub';
  const routeClientLabel = pendingPickups[0]?.client_name || activeRoutePallet?.client_name || t('client');
  const routeUnitsLabel = activeRoutePallet ? activeRoutePallet.qr_code : 'PAL-0000';

  const [resolvingReportId, setResolvingReportId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  return (
    <div className="min-h-full flex flex-col gap-4 pb-20 md:pb-4">
      <header className="flex min-h-14 items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.3em]">{roleLabel}</span>
          <h2 className="text-xl font-black tracking-tighter uppercase">{t('home')}</h2>
        </div>
        {isDriver && (
          <div className="hidden md:flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-700">
            <Truck size={16} />
            <span className="text-[9px] font-black uppercase tracking-[0.18em]">{t('activeRoute')}</span>
          </div>
        )}
        {isWarehouse && (
          <div className="hidden md:flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-sky-700">
            <Package size={16} />
            <span className="text-[9px] font-black uppercase tracking-[0.18em]">{t('readyForHandling')}</span>
          </div>
        )}
      </header>

      <div className="flex p-1 bg-zinc-100 rounded-2xl">
         <button 
           onClick={() => setActiveTab('scan')}
           className={`flex-1 py-3 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all ${activeTab === 'scan' ? 'bg-white shadow-sm text-black' : 'text-zinc-400'}`}
         >
           {t('dashboard')}
         </button>
         {!isDriver && !isWarehouse && (
           <button 
             onClick={() => setActiveTab('inventory')}
             className={`flex-1 py-3 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all ${activeTab === 'inventory' ? 'bg-white shadow-sm text-black' : 'text-zinc-400'}`}
           >
             {t('inventory')}
           </button>
         )}
         {!isTechnician && (
           <button 
             onClick={() => setActiveTab('history')}
             className={`flex-1 py-3 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-black' : 'text-zinc-400'}`}
           >
             {t('history')}
           </button>
         )}
         {(isTechnician || role === RoleType.ADMIN) && (
           <button 
             onClick={() => setActiveTab('service')}
             className={`flex-1 py-3 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all ${activeTab === 'service' ? 'bg-white shadow-sm text-black' : 'text-zinc-400'}`}
           >
             {t('service')}
           </button>
         )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'scan' && (
          <motion.div 
            key="scan"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-1 flex-col gap-4"
          >
            {isWarehouse ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard label={t('readyForDispatch')} value={warehouseDispatch.length} variant="info" />
                  <StatCard label={t('inboundReturns')} value={warehouseReturns.length} variant="warning" />
                  <StatCard label={t('serviceQueue')} value={serviceJobs.length} variant="success" />
                  <StatCard label={t('exceptionQueue')} value={ghostPallets.length} variant="danger" />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)]">
                  <Card title={t('warehouseFlow')}>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-100 text-zinc-500">
                            <Package size={18} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('inboundReturns')}</p>
                            <p className="text-sm font-black uppercase tracking-tight">{t('forPickup')}</p>
                          </div>
                        </div>
                        <Badge variant="warning">{warehouseReturns.length}</Badge>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-100 text-zinc-500">
                            <Truck size={18} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('readyForDispatch')}</p>
                            <p className="text-sm font-black uppercase tracking-tight">{t('onRoute')}</p>
                          </div>
                        </div>
                        <Badge variant="info">{warehouseDispatch.length}</Badge>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-100 text-zinc-500">
                            <AlertTriangle size={18} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('serviceQueue')}</p>
                            <p className="text-sm font-black uppercase tracking-tight">{t('reportDamage')}</p>
                          </div>
                        </div>
                        <Badge variant="danger">{serviceJobs.length}</Badge>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-100 text-zinc-500">
                            <Ghost size={18} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('exceptionQueue')}</p>
                            <p className="text-sm font-black uppercase tracking-tight">{t('ghostReport')}</p>
                          </div>
                        </div>
                        <Badge variant="default">{ghostPallets.length}</Badge>
                      </div>
                    </div>
                  </Card>

                  <Card title={t('warehouseTools')}>
                    <div className="space-y-3">
                      <button
                        onClick={() => setIsScannerOpen(true)}
                        className="flex w-full items-center justify-between rounded-[1.75rem] border-2 border-emerald-100 bg-emerald-50 p-4 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                            <QrCode size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase leading-none text-emerald-900">{t('scanToUpdate')}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600">{t('scanToUpdateHint')}</p>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-emerald-300" />
                      </button>

                      <button
                        onClick={() => setShowDamageModal(true)}
                        className="flex w-full items-center justify-between rounded-[1.75rem] border-2 border-amber-100 bg-amber-50 p-4 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                            <AlertTriangle size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase leading-none text-amber-900">{t('service')}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-amber-600">{serviceJobs.length} {t('activeJobs')}</p>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-amber-300" />
                      </button>

                      <button
                        onClick={() => setIsGhostReportOpen(true)}
                        className="flex w-full items-center justify-between rounded-[1.75rem] border-2 border-rose-100 bg-rose-50 p-4 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white">
                            <Ghost size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase leading-none text-rose-900">{t('ghostReport')}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-rose-600">{ghostPallets.length} | {t('openReports')}</p>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-rose-300" />
                      </button>
                    </div>
                  </Card>
                </div>

                <Card title={t('readyForHandling')} noPadding>
                  <div className="divide-y divide-zinc-100">
                    {warehouseQueue.length > 0 ? (
                      warehouseQueue.map((pallet) => (
                        <div key={`warehouse-queue-${pallet.id}`} className="flex items-center justify-between gap-4 p-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{pallet.qr_code}</span>
                              <Badge variant={pallet.current_status_id === 7 ? 'danger' : pallet.current_status_id === 5 ? 'warning' : 'info'}>
                                {getStatusLabel(pallet.current_status_name, language)}
                              </Badge>
                            </div>
                            <p className="mt-2 truncate text-[12px] font-black uppercase tracking-tight text-zinc-900">
                              {getPalletTypeLabel(pallet.type, language)}
                            </p>
                            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{pallet.current_location}</p>
                          </div>
                          <Button size="xs" variant="secondary" onClick={() => setIsScannerOpen(true)}>
                            {t('scanAction')}
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center opacity-40">
                        <Package size={32} className="mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">{t('noAssignedUnits')}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                  <Card title={t('activeRoute')} className="overflow-hidden">
                    <div className="space-y-4">
                      <div className="rounded-[2rem] border border-emerald-100 bg-[linear-gradient(135deg,#effcf5_0%,#ffffff_55%,#f4fbff_100%)] p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-emerald-700">
                              <Truck size={16} />
                              <span className="text-[9px] font-black uppercase tracking-[0.18em]">{t('driver')}</span>
                            </div>
                            <p className="text-lg font-black uppercase tracking-tight text-emerald-950">{routeClientLabel}</p>
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">{routeUnitsLabel}</p>
                          </div>
                          <Badge variant="info">{t('onRoute')}</Badge>
                        </div>

                        <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-white shadow-sm">
                            <MapPin size={16} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('activeRoute')}</p>
                            <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900">{activeRoutePallet?.current_location || 'Sarajevo Hub'}</p>
                          </div>

                          <div className="relative flex h-16 w-10 items-center justify-center">
                            <div className="absolute h-full w-px bg-emerald-200" />
                            <div className="absolute top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                            <div className="absolute bottom-1 h-2.5 w-2.5 rounded-full bg-zinc-300 ring-4 ring-white" />
                            <Route size={14} className="relative z-10 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('nextStop')}</p>
                            <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900">{nextStopLabel}</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </Card>

                  <Card title={t('pickupBoard')} noPadding>
                    <div className="divide-y divide-zinc-100">
                      {driverStops.length > 0 ? (
                        driverStops.map((pallet) => (
                          <div key={`driver-stop-${pallet.id}`} className="flex items-center justify-between gap-4 p-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{pallet.qr_code}</span>
                                <Badge variant={pallet.current_status_id === 5 ? 'warning' : 'info'}>
                                  {getStatusLabel(pallet.current_status_name, language)}
                                </Badge>
                              </div>
                              <p className="mt-2 truncate text-[12px] font-black uppercase tracking-tight text-zinc-900">
                                {pallet.client_name || t('client')}
                              </p>
                              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                                {pallet.current_location}
                              </p>
                            </div>
                            <Button size="xs" variant="secondary" onClick={() => setIsScannerOpen(true)}>
                              {t('scanAction')}
                            </Button>
                          </div>
                        ))
                      ) : (
                        <div className="p-12 text-center opacity-40">
                          <MapPin size={28} className="mx-auto mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest">{t('noAssignedUnits')}</p>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <StatCard label={t('todayLabel')} value={todayLogs.length} />
                  <StatCard label={t('onRoute')} value={inTransport.length} variant="info" />
                  <StatCard label={t('pickupsWaiting')} value={pendingPickups.length} variant="warning" />
                  <StatCard label={t('activeJobs')} value={serviceJobs.length} variant="success" />
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
                  <Card
                    title={t('activityLog')}
                    action={
                      todayLogs.length > 0 ? (
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">
                          {todayLogs.length} {t('scansToday')}
                        </span>
                      ) : null
                    }
                    noPadding
                  >
                    <div className="divide-y divide-zinc-100">
                      {todayLogs.length > 0 ? (
                        todayLogs.slice(0, 6).map((log) => {
                          const pallet = pallets.find(p => p.qr_code === log.pallet_qr);
                          return (
                            <div
                              key={log.id}
                              onClick={() => pallet && setSelectedPalletId(pallet.id)}
                              className="flex cursor-pointer items-center gap-4 p-4 transition-all hover:bg-zinc-50"
                            >
                              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm shrink-0">
                                <img
                                  src="https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?auto=format&fit=crop&q=80&w=100"
                                  className="h-full w-full object-cover grayscale opacity-60"
                                  alt=""
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{log.pallet_qr}</span>
                                  <span className="text-[9px] font-black uppercase text-zinc-300">
                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="mt-1 truncate text-[12px] font-black uppercase tracking-tight text-zinc-900">
                                  {pallet ? getPalletTypeLabel(pallet.type, language) : t('standardUnit')}
                                </p>
                                <div className="mt-2 flex items-center gap-2">
                                  <Badge variant={log.new_status_name.toLowerCase().includes('damage') ? 'danger' : 'success'} className="px-1.5 py-0 text-[8px]">
                                    {getStatusLabel(log.new_status_name, language)}
                                  </Badge>
                                  <span className="truncate text-[9px] font-black uppercase text-zinc-300">{log.new_location}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex min-h-[220px] flex-col items-center justify-center opacity-20 grayscale">
                          <Package size={36} className="mb-4" />
                          <p className="text-[10px] font-black uppercase tracking-widest">{t('noActivityYet')}</p>
                        </div>
                      )}
                    </div>
                  </Card>

                  <Card title={t('driverTools')}>
                    <div className="space-y-3">
                      <button
                        onClick={() => setIsScannerOpen(true)}
                        className="flex w-full items-center justify-between rounded-[1.75rem] border-2 border-emerald-100 bg-emerald-50 p-4 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                            <QrCode size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase leading-none text-emerald-900">{t('scanToUpdate')}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600">{t('scanToUpdateHint')}</p>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-emerald-300" />
                      </button>

                      <button
                        onClick={() => setIsGhostReportOpen(true)}
                        className="flex w-full items-center justify-between rounded-[1.75rem] border-2 border-rose-100 bg-rose-50 p-4 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white">
                            <Ghost size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase leading-none text-rose-900">{t('ghostReport')}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-rose-600">{ghostPallets.length} | {t('openReports')}</p>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-rose-300" />
                      </button>

                      <button
                        onClick={() => setShowDamageModal(true)}
                        className="flex w-full items-center justify-between rounded-[1.75rem] border-2 border-amber-100 bg-amber-50 p-4 text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
                            <AlertTriangle size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase leading-none text-amber-900">{t('reportDamage')}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-amber-600">{t('serviceDamageHint')}</p>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-amber-300" />
                      </button>
                    </div>
                  </Card>
                </div>
              </div>
            )}

             {ghostPallets.length > 0 && (
               <Card title={t('unlabeledUnitsGhosts')} noPadding>
                    <div className="divide-y divide-zinc-50">
                      {ghostPallets.map(ghost => (
                        <div key={`ghost-${ghost.id}`} className="p-4 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
                                 <Package size={20} />
                              </div>
                              <div>
                                 <p className="text-[11px] font-black uppercase tracking-tight leading-none mb-1">{ghost.qr_code}</p>
                                 <p className="text-[9px] font-bold text-zinc-400 uppercase">{t('fromClient')} {ghost.client_name || t('client')}</p>
                              </div>
                           </div>
                           <Button 
                             size="xs"
                             onClick={() => {
                               setSelectedGhostId(ghost.id);
                               setShowPairModal(true);
                             }}
                           >
                              {t('pair')}
                           </Button>
                        </div>
                      ))}
                   </div>
               </Card>
             )}
          </motion.div>
        )}

         {activeTab === 'inventory' && (
          <motion.div 
            key="inventory"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {isDriver && pendingPickups.length > 0 && (
              <div className="space-y-3">
                 <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-500">{t('pickupsWaiting')}</h3>
                    <Badge variant="danger">{pendingPickups.length} {t('totalUnits')}</Badge>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {pendingPickups.map(p => (
                   <Card key={p.id} className="border-rose-100 bg-rose-50/20">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                           <MapPin size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1 truncate">{p.client_name || t('individualLabel')}</p>
                           <p className="text-[11px] font-black uppercase tracking-tight leading-tight mb-2">{p.current_location}</p>
                           <Badge variant="danger">{p.qr_code}</Badge>
                        </div>
                        <Button 
                          variant="secondary"
                          size="xs"
                          onClick={() => setIsScannerOpen(true)}
                        >
                           {t('scanAction')}
                        </Button>
                      </div>
                   </Card>
                 ))}
                 </div>
              </div>
            )}

            <Card title={t('currentAssignments')} noPadding>
               <div className="divide-y divide-zinc-50">
                  {pallets.filter(p => [2, 6, 7].includes(p.current_status_id)).map(p => (
                    <div key={p.id} className="p-4 flex items-center justify-between">
                       <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0">
                             <Package size={18} className="text-zinc-400" />
                          </div>
                          <div className="min-w-0">
                             <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">{p.qr_code}</p>
                             <p className="text-[11px] font-black uppercase tracking-tight truncate">{getPalletTypeLabel(p.type, language)}</p>
                          </div>
                       </div>
                       <Badge variant={p.current_status_id === 7 ? 'danger' : 'info'}>
                          {getStatusLabel(p.current_status_name, language)}
                       </Badge>
                    </div>
                  ))}
                  {pallets.filter(p => [2, 6, 7].includes(p.current_status_id)).length === 0 && (
                    <div className="p-12 text-center opacity-40">
                       <Package size={32} className="mx-auto mb-2" />
                       <p className="text-[10px] font-black uppercase tracking-widest">{t('noAssignedUnits')}</p>
                    </div>
                  )}
               </div>
            </Card>
          </motion.div>
        )}

        {activeTab === 'history' && (
           <motion.div 
             key="history"
             initial={{ opacity: 0, x: -10 }}
             animate={{ opacity: 1, x: 0 }}
             className="space-y-4"
           >
              <Card title={t('recentLogs')} noPadding>
                 <div className="divide-y divide-zinc-50">
                    {todayLogs.map(log => (
                       <div key={log.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-8 h-8 bg-zinc-50 rounded-xl flex items-center justify-center">
                                <History size={14} className="text-zinc-400" />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">{log.pallet_qr}</p>
                                <p className="text-[11px] font-black uppercase">{getStatusLabel(log.new_status_name, language)}</p>
                             </div>
                          </div>
                          <p className="text-[10px] font-black text-zinc-300 uppercase">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                       </div>
                    ))}
                    {todayLogs.length === 0 && (
                       <div className="p-12 text-center opacity-40">
                          <History size={32} className="mx-auto mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest">{t('noActivityLoggedToday')}</p>
                       </div>
                    )}
                 </div>
              </Card>
           </motion.div>
        )}

         {activeTab === 'service' && (
           <motion.div 
             key="service"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             className="space-y-6"
           >
              <div className="flex items-center justify-between">
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('pendingRepair')}</h3>
                 <Badge variant="success">{serviceJobs.length} {t('pallets')}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {serviceJobs.map(pallet => {
                    const report = serviceReports.find(r => r.pallet_id === pallet.id && !r.resolved_at);
                    return (
                       <Card key={pallet.id} noPadding className="overflow-hidden">
                          {report?.image_path && (
                            <div className="aspect-video w-full bg-zinc-100 overflow-hidden">
                               <img src={report.image_path} className="w-full h-full object-cover grayscale" alt="Damage" />
                            </div>
                          )}
                          <div className="p-5 space-y-4">
                             <div className="flex justify-between items-start">
                                <div>
                                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">{pallet.qr_code}</p>
                                   <h4 className="text-lg font-black uppercase tracking-tighter">{getPalletTypeLabel(pallet.type, language)}</h4>
                                </div>
                                <Badge variant="danger">{t('service')}</Badge>
                             </div>

                             {report && (
                               <div className="p-4 bg-zinc-50 rounded-2xl">
                                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t('damageDescription')}</p>
                                  <p className="text-[11px] font-bold text-zinc-700 leading-tight">{report.problem_description}</p>
                               </div>
                             )}

                             {resolvingReportId === report?.id ? (
                               <div className="space-y-3 pt-2">
                                  <textarea 
                                    className="w-full p-4 bg-zinc-50 border-2 border-transparent focus:border-black rounded-2xl font-bold text-[11px] h-24 outline-none transition-all placeholder:text-zinc-300"
                                    placeholder={t('resolutionDetailsPlaceholder')}
                                    value={resolutionNote}
                                    onChange={e => setResolutionNote(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                     <Button 
                                       variant="ghost"
                                       className="flex-1"
                                       onClick={() => setResolvingReportId(null)}
                                     >
                                        {t('cancel')}
                                     </Button>
                                     <Button 
                                       className="flex-1"
                                       onClick={() => {
                                          if (report) {
                                            resolveService(report.id, user.id, resolutionNote);
                                            setResolvingReportId(null);
                                            setResolutionNote('');
                                          }
                                       }}
                                     >
                                        {t('save')}
                                     </Button>
                                  </div>
                               </div>
                             ) : (
                               <Button 
                                 className="w-full py-4 text-xs"
                                 onClick={() => setResolvingReportId(report?.id || null)}
                               >
                                  {t('markAsFixed')}
                               </Button>
                             )}
                          </div>
                       </Card>
                    );
                 })}
                 {serviceJobs.length === 0 && (
                    <div className="col-span-full p-20 text-center bg-zinc-50 border-2 border-dashed border-zinc-100">
                       <CheckCircle2 size={40} className="mx-auto text-emerald-500 opacity-20 mb-4" />
                       <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">{t('allGood')}</p>
                    </div>
                 )}
              </div>
           </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPalletId && (
          <div className="modal-overlay fixed inset-0 z-[200] flex items-center justify-center p-4">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white overflow-hidden rounded-[3rem] w-full max-w-md shadow-2xl relative"
             >
                {(() => {
                  const pallet = pallets.find(p => p.id === selectedPalletId);
                  if (!pallet) return null;
                  return (
                    <>
                      <div className="aspect-video w-full bg-zinc-100 overflow-hidden relative">
                         <img 
                           src="https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?auto=format&fit=crop&q=80&w=800" 
                           className="w-full h-full object-cover grayscale" 
                           alt="" 
                         />
                         <div className="absolute top-6 left-6">
                            <Badge className="px-3 py-1 text-[10px]">{pallet.qr_code}</Badge>
                         </div>
                         <button 
                           onClick={() => setSelectedPalletId(null)}
                           className="absolute top-6 right-6 w-10 h-10 bg-white shadow-xl rounded-full flex items-center justify-center text-black"
                         >
                            <ArrowRight size={20} className="rotate-180" />
                         </button>
                      </div>
                      <div className="p-8 space-y-6">
                         <div className="space-y-1">
                            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('inventory')}</p>
                            <h3 className="text-2xl font-black uppercase tracking-tighter">{getPalletTypeLabel(pallet.type, language)}</h3>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-50 p-4 rounded-2xl">
                               <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t('status')}</p>
                               <Badge variant={pallet.current_status_id === 7 ? 'danger' : 'info'}>{getStatusLabel(pallet.current_status_name, language)}</Badge>
                            </div>
                            <div className="bg-zinc-50 p-4 rounded-2xl">
                               <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{t('location')}</p>
                               <p className="text-[11px] font-black uppercase truncate">{pallet.current_location}</p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t('unitLifecycle')}</h4>
                            <div className="space-y-3">
                               {auditLogs.filter(l => l.pallet_qr === pallet.qr_code).slice(0, 3).map(log => (
                                 <div key={log.id} className="flex gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 mt-1.5 shrink-0" />
                                    <div>
                                       <p className="text-[11px] font-black uppercase leading-tight">{getStatusLabel(log.new_status_name, language)}</p>
                                       <p className="text-[9px] font-bold text-zinc-400 uppercase">{new Date(log.created_at).toLocaleDateString()}</p>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>

                         <Button className="w-full py-4 uppercase text-[11px]" onClick={() => setSelectedPalletId(null)}>
                            {t('closeDetails')}
                         </Button>
                      </div>
                    </>
                  );
                })()}
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPairModal && (
          <div className="modal-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-black uppercase mb-6 text-center">{t('pairUnit')}</h3>
                <div className="space-y-6">
                   <div className="space-y-2 text-center">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">{t('newQrCode')}</label>
                      <Input 
                        className="text-center text-2xl uppercase tracking-tighter"
                        placeholder="TP-XXXXXX"
                        value={newQrCode}
                        onChange={e => setNewQrCode(e.target.value.toUpperCase())}
                        autoFocus
                      />
                   </div>
                   <div className="flex gap-4">
                      <Button variant="ghost" className="flex-1" onClick={() => { setShowPairModal(false); setNewQrCode(''); }}>{t('cancel')}</Button>
                      <Button 
                        className="flex-1"
                        onClick={() => {
                          if (selectedGhostId && newQrCode) {
                            pairGhostPallet(selectedGhostId, newQrCode);
                            setShowPairModal(false);
                            setNewQrCode('');
                          }
                        }}
                      >
                         {t('confirm')}
                      </Button>
                   </div>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDamageModal && (
          <DamageReportModal 
            currentUser={user}
            onClose={() => setShowDamageModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
