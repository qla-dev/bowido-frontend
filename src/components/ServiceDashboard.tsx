import React from 'react';
import { motion } from 'motion/react';
import { ImageIcon, CheckCircle2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { User } from '../types';
import { StatCard, Card, Button, Badge } from './ui';
import { getPalletTypeLabel } from '../i18n';

interface ServiceDashboardProps {
  user: User;
}

export const ServiceDashboard: React.FC<ServiceDashboardProps> = ({ user }) => {
  const { pallets, updatePalletStatus, t, language } = useApp();
  
  const servicePallets = pallets.filter(p => p.current_status_id === 7);

  const handleFix = (palletId: number) => {
    updatePalletStatus(
      palletId,
      1, // Bowido BIH
      user.id,
      user.name,
      'Warehouse BiH',
      'Repair completed'
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex h-12 items-center justify-between">
        <div className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          <span>{t('home')}</span>
          <span>/</span>
          <span className="text-black">{t('serviceLog')}</span>
        </div>
        <div className="text-right">
           <span className="text-[9px] font-black uppercase text-zinc-300 tracking-widest">{t('technician')}</span>
           <p className="text-[11px] font-black uppercase tracking-tight">{user.name}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label={t('pendingRepair')} 
          value={servicePallets.length} 
          variant="danger"
        />
        <StatCard 
          label={t('repairedToday')} 
          value={4} 
          variant="success"
        />
        <StatCard 
          label={t('partsStock')} 
          value="OK" 
          variant="info"
        />
      </div>

      <Card 
        title={t('activeJobs')}
      >
        <div className="space-y-3">
          {servicePallets.length === 0 ? (
            <div className="p-12 text-center text-zinc-300 font-black uppercase text-[10px] tracking-[0.2em]">
               All pallets are currently healthy
            </div>
          ) : (
            servicePallets.map((pallet) => (
              <motion.div 
                key={pallet.id} 
                whileHover={{ x: 2 }}
                className="flex flex-col md:flex-row gap-4 p-4 bg-zinc-50 rounded-2xl border-2 border-transparent hover:border-zinc-100 transition-all group"
              >
                <div className="w-full md:w-20 md:h-20 bg-white rounded-xl flex items-center justify-center border border-zinc-100 shrink-0">
                   <ImageIcon size={20} className="text-zinc-200" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                   <div className="flex justify-between items-start gap-4 mb-3">
                      <div>
                          <div className="flex items-center gap-2 mb-1">
                             <span className="font-mono font-black text-black text-sm uppercase tracking-tighter">{pallet.qr_code}</span>
                             <Badge variant="danger" className="text-[8px] italic">IN SERVICE</Badge>
                          </div>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{getPalletTypeLabel(pallet.type, language)} • DAMAGE REPORT</p>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleFix(pallet.id)}
                        className="shadow-lg shadow-black/10"
                      >
                         <CheckCircle2 size={12} className="mr-2" />
                         {t('markAsFixed')}
                      </Button>
                   </div>
                   <div className="p-3 bg-white rounded-xl border border-zinc-100/50 italic text-[10px] font-bold text-zinc-500 leading-relaxed uppercase tracking-tight">
                      {pallet.note || "Structural damage reported. Requires technician inspection."}
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
