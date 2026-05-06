import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Camera, X, Search, Package, AlertCircle } from 'lucide-react';
import { useApp } from '../AppContext';
import { Pallet, User } from '../types';
import { Button, Card, Badge, Input } from './ui';

interface DamageReportModalProps {
  onClose: () => void;
  currentUser: User;
}

export const DamageReportModal: React.FC<DamageReportModalProps> = ({ onClose, currentUser }) => {
  const { pallets, reportDamage, t } = useApp();
  const [search, setSearch] = useState('');
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const filteredPallets = search.length > 1 
    ? pallets.filter(p => p.qr_code.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : [];

  const handleSubmit = () => {
    if (!selectedPallet || !description) return;

    reportDamage({
      pallet_id: selectedPallet.id,
      reported_by_user_id: currentUser.id,
      problem_description: description,
      image_path: image || undefined
    });
    
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl"
      >
        <Card noPadding className="shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 border-b-2 border-rose-50 flex justify-between items-center bg-rose-50/10">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-rose-600">{t('reportDamage')}</h3>
              <p className="text-[9px] font-black text-rose-400 uppercase tracking-[0.2em]">{t('tagForService')}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-rose-400 hover:bg-rose-50/50">
              <X size={20} />
            </Button>
          </div>

          <div className="p-6 overflow-y-auto no-scrollbar space-y-6">
            {!selectedPallet ? (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">1. {t('selectUnit')}</h4>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                  <Input 
                    placeholder={t('searchQr')}
                    className="pl-12 h-12 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  {filteredPallets.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPallet(p)}
                      className="w-full p-4 bg-zinc-50 border-2 border-transparent rounded-2xl flex items-center justify-between hover:border-rose-100 hover:bg-white transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white border border-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all">
                          <Package size={18} />
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] font-black uppercase tracking-tight text-black">{p.qr_code}</p>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">{p.type} • {p.current_location}</p>
                        </div>
                      </div>
                      <AlertCircle size={16} className="text-zinc-200 group-hover:text-rose-500 transition-colors" />
                    </button>
                  ))}
                  {search.length > 1 && filteredPallets.length === 0 && (
                    <p className="text-center py-6 text-[10px] font-black text-zinc-300 uppercase tracking-widest">No pallets matching "{search}"</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl border-2 border-zinc-100/50">
                   <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <Package size={16} className="text-rose-600" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-tight text-black">{selectedPallet.qr_code}</p>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{selectedPallet.type}</p>
                      </div>
                   </div>
                   <Button variant="ghost" size="xs" onClick={() => setSelectedPallet(null)} className="text-rose-500">{t('cancel')}</Button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">2. {t('damageDescription')}</h4>
                  <textarea 
                    className="w-full p-4 bg-zinc-50 border-2 border-transparent focus:border-rose-500 rounded-2xl font-black text-xs h-24 outline-none transition-all resize-none uppercase tracking-tight placeholder:text-zinc-300"
                    placeholder="Briefly describe the issue..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">3. {t('evidencePhoto')}</h4>
                  {image ? (
                    <div className="relative rounded-2xl overflow-hidden group border-2 border-rose-50">
                      <img src={image} className="w-full h-40 object-cover" alt="Damage" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          variant="danger"
                          size="sm"
                          onClick={() => setImage(null)}
                        >
                          <X size={14} className="mr-2" /> {t('remove')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsUploading(true);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setImage(reader.result as string);
                              setIsUploading(false);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="hidden" 
                        id="damage-photo"
                      />
                      <label 
                        htmlFor="damage-photo"
                        className="w-full py-10 bg-zinc-50 border-2 border-dashed border-zinc-100/80 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white hover:border-rose-200 transition-all text-zinc-300 hover:text-rose-600 cursor-pointer group"
                      >
                        {isUploading ? (
                          <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Camera size={24} className="group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{t('evidencePhoto')}</span>
                          </>
                        )}
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-zinc-50/30 border-t-2 border-rose-50 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>{t('cancel')}</Button>
            <Button 
              disabled={!selectedPallet || !description || !image || isUploading}
              onClick={handleSubmit}
              className="flex-[2] bg-rose-600 border-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-900/10"
            >
              {t('submitReport')}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
