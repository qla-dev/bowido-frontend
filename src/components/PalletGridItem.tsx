import React from 'react';
import { MapPin } from 'lucide-react';
import { Pallet, PalletStatus, ClientDetail } from '../types';
import { motion } from 'motion/react';
import { useApp } from '../AppContext';
import { Badge, cn } from './ui';

interface PalletGridItemProps {
  pallet: Pallet;
  statuses: PalletStatus[];
  clients: ClientDetail[];
  debt: number;
  onClick?: () => void;
}

export const PalletGridItem: React.FC<PalletGridItemProps> = ({ pallet, statuses, debt, onClick }) => {
  const { t } = useApp();
  
  const calculateDays = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const days = calculateDays(pallet.last_status_changed_at);

  const getPalletImage = () => {
    return "https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?auto=format&fit=crop&q=80&w=600";
  };

  const isOverdue = debt > 0;

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-white border border-zinc-200 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] flex flex-col h-full rounded-2xl overflow-hidden transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start p-5 bg-zinc-50 border-b border-zinc-100">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-black text-lg tracking-tighter text-zinc-950 uppercase">
              {pallet.qr_code}
            </span>
            {isOverdue && <Badge variant="danger">{t('overdue')}</Badge>}
          </div>
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500 truncate mt-0.5">
            {pallet.type}
          </p>
        </div>
        <Badge variant={pallet.current_status_id === 4 ? 'success' : pallet.current_status_id === 7 ? 'danger' : 'info'}>
          {pallet.current_status_name}
        </Badge>
      </div>

      <div className="flex-1 p-5 flex flex-col">
        <div className="aspect-[16/9] w-full rounded-xl overflow-hidden mb-4 bg-zinc-100 border border-zinc-200 shrink-0">
           <img 
             src={getPalletImage()} 
             alt={pallet.type}
             className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500 ease-out" 
             referrerPolicy="no-referrer"
           />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black text-zinc-950 truncate uppercase tracking-widest mb-1.5 font-display">
             {pallet.client_name || t('inventory')}
          </p>
          <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 uppercase tracking-tight">
            <MapPin size={10} className="text-zinc-400" />
            <span className="truncate">{pallet.current_location}</span>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 bg-zinc-50 border-t border-zinc-100 grid grid-cols-2 gap-4">
        <div>
          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block mb-1">{t('days')}</span>
          <p className={cn("text-[10px] font-black tracking-tight uppercase", days > 14 ? "text-rose-600" : "text-zinc-950")}>
            {days} Days
          </p>
        </div>
        <div className="text-right">
          <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block mb-1">{t('accruedCharge')}</span>
          <p className="text-[12px] font-mono font-black text-emerald-700">
            €{debt.toFixed(2)}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
