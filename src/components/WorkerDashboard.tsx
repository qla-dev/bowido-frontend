import React, { useState, useEffect } from 'react';
import { StatCard, Card, Button, Input, Badge } from './ui';
import { PalletScanner } from './PalletScanner';
import { DamageReportModal } from './DamageReportModal';
import { RoleType, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../AppContext';
import { QrCode, Package, ArrowRight, AlertTriangle, MapPin, History, CheckCircle2 } from 'lucide-react';

interface WorkerDashboardProps {
  role: RoleType;
  user: User;
}

export const WorkerDashboard: React.FC<WorkerDashboardProps> = ({ role, user }) => {
  const { pallets, auditLogs, t, serviceReports, pairGhostPallet, resolveService } = useApp();
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [selectedGhostId, setSelectedGhostId] = useState<number | null>(null);
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(null);
  const [newQrCode, setNewQrCode] = useState('');
  const [activeTab, setActiveTab] = useState<'scan' | 'inventory' | 'history' | 'service'>('scan');
  const isDriver = role === RoleType.VOZAC;
  const isWarehouse = role === RoleType.MAGACINER;
  const isTechnician = role === RoleType.SERVISER;

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
  const serviceJobs = pallets.filter(p => p.current_status_id === 7 || serviceReports.some(r => r.pallet_id === p.id && !r.resolved_at));
  const ghostPallets = pallets.filter(p => p.is_ghost);

  const [resolvingReportId, setResolvingReportId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  return (
    <div className="space-y-6 pb-20">
      <header className="flex h-16 items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] font-black uppercase text-zinc-400 tracking-[0.3em]">{isDriver ? 'Driver Terminal' : 'Warehouse Terminal'}</span>
          <h2 className="text-xl font-black tracking-tighter uppercase">{t('home')}</h2>
        </div>
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
            className="space-y-6"
          >
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               <StatCard label="Today" value={todayLogs.length} />
               <StatCard label="On Route" value={inTransport.length} variant="info" />
               <div className="hidden md:block col-span-2">
                 <div className="h-full bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center px-4">
                    <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{isDriver ? 'Fleet active' : 'Warehouse operating'}</p>
                 </div>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-6 relative">
               {/* Recent Scans List - Full Width */}
               <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Activity Log</h3>
                    {todayLogs.length > 0 && <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">{todayLogs.length} Scans today</span>}
                  </div>
                  
                  <div className="bg-white border border-zinc-100 rounded-[2.5rem] p-2 space-y-1 min-h-[300px]">
                    {todayLogs.length > 0 ? (
                      todayLogs.slice(0, 10).map(log => {
                        const pallet = pallets.find(p => p.qr_code === log.pallet_qr);
                        return (
                          <div 
                            key={log.id} 
                            onClick={() => pallet && setSelectedPalletId(pallet.id)}
                            className="flex items-center gap-4 p-4 bg-zinc-50/50 hover:bg-zinc-50 border border-transparent hover:border-zinc-100 rounded-3xl transition-all group cursor-pointer"
                          >
                             <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-zinc-100 overflow-hidden">
                                <img 
                                  src="https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?auto=format&fit=crop&q=80&w=100" 
                                  className="w-full h-full object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                                  alt="" 
                                />
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                   <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{log.pallet_qr}</span>
                                      <Badge variant={log.new_status_name.toLowerCase().includes('damage') ? 'danger' : 'success'} className="px-1.5 py-0 text-[8px]">
                                        {log.new_status_name}
                                      </Badge>
                                   </div>
                                   <span className="text-[9px] font-black text-zinc-300 uppercase">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-[12px] font-black uppercase tracking-tight truncate mb-1">{pallet?.type || 'Standard Unit'}</p>
                                <div className="flex items-center gap-2">
                                   <MapPin size={8} className="text-zinc-300" />
                                   <span className="text-[9px] font-black text-zinc-300 uppercase truncate">{log.new_location}</span>
                                </div>
                             </div>
                             <ArrowRight size={14} className="text-zinc-300 group-hover:translate-x-1 transition-transform" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="h-full min-h-[280px] flex flex-col items-center justify-center opacity-20 grayscale">
                         <Package size={40} className="mb-4" />
                         <p className="text-[10px] font-black uppercase tracking-widest">No activity yet</p>
                      </div>
                    )}
                    {todayLogs.length > 10 && (
                      <button 
                        onClick={() => setActiveTab('history')}
                        className="w-full py-4 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 shadow-sm bg-white rounded-2xl mt-2 hover:bg-zinc-50 transition-colors"
                      >
                        Explore history Archive
                      </button>
                    )}
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('service')}
                  className="flex items-center justify-between p-6 bg-emerald-50 border-2 border-emerald-100 rounded-[2rem] group"
                >
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center">
                         <CheckCircle2 size={20} />
                      </div>
                      <div className="text-left">
                         <p className="text-xs font-black text-emerald-900 uppercase leading-none mb-1">{t('service')}</p>
                         <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">{serviceJobs.length} {t('activeJobs')}</p>
                      </div>
                   </div>
                   <ArrowRight size={16} className="text-emerald-300 group-hover:translate-x-1 transition-transform" />
                </button>
                <button 
                  onClick={() => setShowDamageModal(true)}
                  className="flex items-center justify-between p-6 bg-rose-50 border-2 border-rose-100 rounded-[2rem] group"
                >
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-rose-500 text-white rounded-xl flex items-center justify-center">
                         <AlertTriangle size={20} />
                      </div>
                      <div className="text-left">
                         <p className="text-xs font-black text-rose-900 uppercase leading-none mb-1">{t('reportDamage')}</p>
                         <p className="text-[9px] font-bold text-rose-600 uppercase tracking-widest">{t('technician')}</p>
                      </div>
                   </div>
                   <ArrowRight size={16} className="text-rose-300 group-hover:translate-x-1 transition-transform" />
                </button>
             </div>

             {ghostPallets.length > 0 && (
               <Card title="Unlabeled Units (Ghosts)" noPadding>
                    <div className="divide-y divide-zinc-50">
                      {ghostPallets.map(ghost => (
                        <div key={`ghost-${ghost.id}`} className="p-4 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400">
                                 <Package size={20} />
                              </div>
                              <div>
                                 <p className="text-[11px] font-black uppercase tracking-tight leading-none mb-1">{ghost.qr_code}</p>
                                 <p className="text-[9px] font-bold text-zinc-400 uppercase">From {ghost.client_name || 'Client'}</p>
                              </div>
                           </div>
                           <Button 
                             size="xs"
                             onClick={() => {
                               setSelectedGhostId(ghost.id);
                               setShowPairModal(true);
                             }}
                           >
                              Pair
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
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-500">Pickups Waiting</h3>
                    <Badge variant="danger">{pendingPickups.length} Units</Badge>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {pendingPickups.map(p => (
                   <Card key={p.id} className="border-rose-100 bg-rose-50/20">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-rose-500 shadow-sm shrink-0">
                           <MapPin size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1 truncate">{p.client_name || 'Individual'}</p>
                           <p className="text-[11px] font-black uppercase tracking-tight leading-tight mb-2">{p.current_location}</p>
                           <Badge variant="danger">{p.qr_code}</Badge>
                        </div>
                        <Button 
                          variant="secondary"
                          size="xs"
                          onClick={() => useApp().setIsScannerOpen(true)}
                        >
                           Scan
                        </Button>
                      </div>
                   </Card>
                 ))}
                 </div>
              </div>
            )}

            <Card title="Current Assignments" noPadding>
               <div className="divide-y divide-zinc-50">
                  {pallets.filter(p => [2, 6, 7].includes(p.current_status_id)).map(p => (
                    <div key={p.id} className="p-4 flex items-center justify-between">
                       <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0">
                             <Package size={18} className="text-zinc-400" />
                          </div>
                          <div className="min-w-0">
                             <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">{p.qr_code}</p>
                             <p className="text-[11px] font-black uppercase tracking-tight truncate">{p.type}</p>
                          </div>
                       </div>
                       <Badge variant={p.current_status_id === 7 ? 'danger' : 'info'}>
                          {p.current_status_name}
                       </Badge>
                    </div>
                  ))}
                  {pallets.filter(p => [2, 6, 7].includes(p.current_status_id)).length === 0 && (
                    <div className="p-12 text-center opacity-40">
                       <Package size={32} className="mx-auto mb-2" />
                       <p className="text-[10px] font-black uppercase tracking-widest">No assigned units</p>
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
              <Card title="Recent Logs" noPadding>
                 <div className="divide-y divide-zinc-50">
                    {todayLogs.map(log => (
                       <div key={log.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-8 h-8 bg-zinc-50 rounded-xl flex items-center justify-center">
                                <History size={14} className="text-zinc-400" />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">{log.pallet_qr}</p>
                                <p className="text-[11px] font-black uppercase">{log.new_status_name}</p>
                             </div>
                          </div>
                          <p className="text-[10px] font-black text-zinc-300 uppercase">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                       </div>
                    ))}
                    {todayLogs.length === 0 && (
                       <div className="p-12 text-center opacity-40">
                          <History size={32} className="mx-auto mb-2" />
                          <p className="text-[10px] font-black uppercase tracking-widest">No activity logged today</p>
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
                                   <h4 className="text-lg font-black uppercase tracking-tighter">{pallet.type}</h4>
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
                                    placeholder="Resolution details (what was fixed?)..."
                                    value={resolutionNote}
                                    onChange={e => setResolutionNote(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                     <Button 
                                       variant="ghost"
                                       className="flex-1"
                                       onClick={() => setResolvingReportId(null)}
                                     >
                                        Cancel
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
                                        Save
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
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
                            <h3 className="text-2xl font-black uppercase tracking-tighter">{pallet.type}</h3>
                         </div>
                         
                         <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-50 p-4 rounded-2xl">
                               <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Status</p>
                               <Badge variant={pallet.current_status_id === 7 ? 'danger' : 'info'}>{pallet.current_status_name}</Badge>
                            </div>
                            <div className="bg-zinc-50 p-4 rounded-2xl">
                               <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Location</p>
                               <p className="text-[11px] font-black uppercase truncate">{pallet.current_location}</p>
                            </div>
                         </div>

                         <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Unit Lifecycle</h4>
                            <div className="space-y-3">
                               {auditLogs.filter(l => l.pallet_qr === pallet.qr_code).slice(0, 3).map(log => (
                                 <div key={log.id} className="flex gap-4">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-200 mt-1.5 shrink-0" />
                                    <div>
                                       <p className="text-[11px] font-black uppercase leading-tight">{log.new_status_name}</p>
                                       <p className="text-[9px] font-bold text-zinc-400 uppercase">{new Date(log.created_at).toLocaleDateString()}</p>
                                    </div>
                                 </div>
                               ))}
                            </div>
                         </div>

                         <Button className="w-full py-4 uppercase text-[11px]" onClick={() => setSelectedPalletId(null)}>
                            Close Details
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
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-black uppercase mb-6 text-center">Pair Unit</h3>
                <div className="space-y-6">
                   <div className="space-y-2 text-center">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">New QR Code</label>
                      <Input 
                        className="text-center text-2xl uppercase tracking-tighter"
                        placeholder="TP-XXXXXX"
                        value={newQrCode}
                        onChange={e => setNewQrCode(e.target.value.toUpperCase())}
                        autoFocus
                      />
                   </div>
                   <div className="flex gap-4">
                      <Button variant="ghost" className="flex-1" onClick={() => { setShowPairModal(false); setNewQrCode(''); }}>Cancel</Button>
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
                         Confirm
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
