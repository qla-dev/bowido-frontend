import React from 'react';
import { motion } from 'motion/react';
import { Smartphone, Package, Search } from 'lucide-react';
import { StatCard, Card, Badge, Button, Input } from './ui';
import { BillingList } from './BillingList';
import { useApp } from '../AppContext';
import { User } from '../types';

interface ClientDashboardProps {
  user: User;
  activeTab?: string;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, activeTab = 'dashboard' }) => {
  const { pallets, statuses, clients, reportGhostPallets, t } = useApp();
  const [showGhostModal, setShowGhostModal] = React.useState(false);
  const [ghostCount, setGhostCount] = React.useState(1);
  const [ghostNote, setGhostNote] = React.useState('');
  
  const clientPallets = pallets.filter(p => p.user_id === user.id);
  const clientInfo = clients.find(c => c.user_id === user.id);

  const calculateDays = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const calculateTotalDebt = () => {
    return clientPallets.reduce((acc, p) => {
       const status = statuses.find(s => s.id === p.current_status_id);
       if (!status || !status.is_billable) return acc;
       
       const graceDays = clientInfo?.grace_period_days ?? status.grace_period_days;
       const pricePerDay = clientInfo?.price_per_day ?? status.price_per_day;
       
       const days = calculateDays(p.last_status_changed_at);
       if (days <= graceDays) return acc;
       return acc + (days - graceDays) * pricePerDay;
    }, 0);
  };

  const calculatePalletDebt = (pallet: any) => {
    const status = statuses.find(s => s.id === pallet.current_status_id);
    if (!status || !status.is_billable) return 0;
    
    const graceDays = clientInfo?.grace_period_days ?? status.grace_period_days;
    const pricePerDay = clientInfo?.price_per_day ?? status.price_per_day;
    
    const days = calculateDays(pallet.last_status_changed_at);
    if (days <= graceDays) return 0;
    return (days - graceDays) * pricePerDay;
  };

  const renderOverview = () => (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Units" value={clientPallets.length} />
        <StatCard label="Active Charges" value={`€${calculateTotalDebt().toFixed(0)}`} variant="success" />
        <StatCard label="Stationary" value={clientPallets.filter(p => !statuses.find(s => s.id === p.current_status_id)?.is_billable).length} variant="info" />
        <StatCard label="For Pickup" value={clientPallets.filter(p => p.current_status_id === 5).length} variant="warning" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">Current Fleet Detail</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {clientPallets.map(p => {
             const days = calculateDays(p.last_status_changed_at);
             const status = statuses.find(s => s.id === p.current_status_id);
             const palletDebt = calculatePalletDebt(p);
             const isCharging = palletDebt > 0;

             return (
               <Card key={p.id} noPadding className="group overflow-hidden">
                  <div className="flex items-center gap-4 p-4">
                    <div className="w-16 h-16 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0 border border-zinc-100 overflow-hidden relative">
                      <img 
                        src={`https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?auto=format&fit=crop&q=80&w=200`} 
                        className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500"
                        alt="" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{p.qr_code}</span>
                          {isCharging && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>}
                        </div>
                        {isCharging && (
                          <span className="text-[12px] font-black text-rose-600 font-mono">€{palletDebt.toFixed(2)}</span>
                        )}
                      </div>
                      <p className="font-black text-[13px] truncate uppercase tracking-tight leading-none mb-2">{p.type}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Badge variant={p.current_status_id === 7 ? 'danger' : p.current_status_id === 5 ? 'warning' : 'info'}>
                              {p.current_status_name}
                           </Badge>
                           <span className="text-[10px] font-black text-zinc-400 uppercase">{days} d</span>
                        </div>
                        {p.current_status_id !== 5 && (
                          <button 
                            onClick={() => useApp().updatePalletStatus(p.id, 5, user.id, user.name, p.current_location, 'Requested for return by client')}
                            className="bg-zinc-950 text-white text-[8px] font-black uppercase px-2 py-1 rounded hover:bg-black transition-colors"
                          >
                            Voor retour
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
               </Card>
             );
           })}
           {clientPallets.length === 0 && (
             <div className="col-span-full py-20 bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center text-zinc-400">
                <Package size={32} className="opacity-20 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">No active units at your location</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex h-12 items-center justify-between mb-8 text-black">
        <div className="flex items-center gap-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          <span>{t('home')}</span>
          <span>/</span>
          <span className="text-black">{activeTab === 'invoices' ? t('billing') : t('overview')}</span>
        </div>
        <div className="text-right">
           <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">{t('company')}</span>
           <p className="text-xs font-black uppercase">{clientInfo?.name || user.name}</p>
        </div>
      </header>

      {activeTab === 'invoices' ? (
        <BillingList />
      ) : activeTab === 'my-pallets' ? (
        renderOverview()
      ) : (
        renderOverview()
      )}
      
      <Card className="bg-zinc-900 border-zinc-900 shadow-zinc-900/10">
         <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex gap-4 items-center">
               <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-zinc-400">
                  <Smartphone size={24} />
               </div>
               <div>
                  <h3 className="text-sm font-black uppercase text-white leading-none mb-1">Prijava palete bez koda</h3>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Prijavite jedinice bez QR labela na stanju</p>
               </div>
            </div>
            <Button variant="outline" className="w-full md:w-auto bg-transparent border-white/20 text-white hover:bg-white hover:text-black" onClick={() => setShowGhostModal(true)}>
               {t('reportNow')}
            </Button>
         </div>
      </Card>

      {showGhostModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
           <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[3rem] w-full max-w-md shadow-2xl relative">
              <h3 className="text-xl font-black uppercase mb-6 text-center font-display">Prijava palete bez koda</h3>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Količina / Quantity</label>
                    <Input 
                       type="number" 
                       min={1} 
                       value={ghostCount}
                       onChange={e => setGhostCount(parseInt(e.target.value))}
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Napomena / Note</label>
                    <textarea 
                       placeholder="Lokacija, stanje ili tip palete..."
                       className="w-full p-4 bg-zinc-50 border-2 border-transparent focus:border-black rounded-2xl font-bold text-[11px] h-32 outline-none transition-all"
                       value={ghostNote}
                       onChange={e => setGhostNote(e.target.value)}
                    />
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <Button variant="ghost" className="flex-1" onClick={() => setShowGhostModal(false)}>Odustani</Button>
                 <Button 
                   className="flex-1"
                   onClick={() => {
                     if (clientInfo) {
                       reportGhostPallets(ghostCount, clientInfo.user_id, clientInfo.name, ghostNote);
                       setShowGhostModal(false);
                       setGhostCount(1);
                       setGhostNote('');
                     }
                   }}
                 >
                    Pošalji prijavu
                 </Button>
              </div>
           </motion.div>
        </div>
      )}
    </div>
  );
};
