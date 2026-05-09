import React from 'react';
import { motion } from 'motion/react';
import { 
  HelpCircle, Settings, BookOpen, ExternalLink, 
  PlayCircle, AlertTriangle, Smartphone, X 
} from 'lucide-react';
import { useApp } from '../AppContext';
import { RoleType } from '../types';
import { Button, Card } from './ui';

interface KnowledgeBaseProps {
  onClose: () => void;
  role: RoleType;
}

export const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ role, onClose }) => {
  const { t } = useApp();
  const getRoleContent = () => {
    switch (role) {
      case RoleType.ADMIN:
        return [
          { title: 'Global Settings', desc: 'Configure status behaviors, pricing, and grace periods.', icon: <Settings /> },
          { title: 'Debt Management', desc: 'Overview of client debts and pallet stay durations.', icon: <BookOpen /> },
          { title: 'Exporting Data', desc: 'How to export fleet reports to PDF/Excel.', icon: <ExternalLink /> },
        ];
      case RoleType.VOZAC:
        return [
          { title: 'Bulk Scanning', desc: 'Skenirajte više paleta odjednom za bržu isporuku.', icon: <PlayCircle /> },
          { title: 'Picking a Client', desc: 'Sistem automatski nudi pretragu klijenata kod Bij de klant statusa.', icon: <BookOpen /> },
          { title: 'Voor Retour', desc: 'Kako označiti palete koje su spremne za preuzimanje.', icon: <ExternalLink /> },
        ];
      case RoleType.MAGACINER:
        return [
          { title: 'Inbound/Outbound', desc: 'Evidencija ulaza i izlaza paleta iz skladišta BiH/NL.', icon: <PlayCircle /> },
          { title: 'Reporting Damage', desc: 'Obavezno slikanje i opis oštećenja pri slanju na servis.', icon: <AlertTriangle /> },
        ];
      case RoleType.KLIJENT:
        return [
          { title: 'Grace Period', desc: 'Kako funkcioniše besplatnih 14 dana stay perioda.', icon: <BookOpen /> },
          { title: 'Ghost Pallets', desc: 'Prijavite palete koje su stigle bez QR koda.', icon: <Smartphone /> },
        ];
      default:
        return [];
    }
  };

  const content = getRoleContent();

  return (
    <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <Card noPadding className="shadow-2xl rounded-2xl">
          <div className="p-6 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-950 text-white rounded-xl flex items-center justify-center">
                   <HelpCircle size={20} />
                </div>
                <div>
                   <h2 className="text-lg font-black uppercase tracking-tighter text-black font-display">{t('knowledgeBase')}</h2>
                   <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{t('contextualHelp')} {role}</p>
                </div>
             </div>
             <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-black">
                <X size={20} />
             </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] no-scrollbar">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {content.map((item, i) => (
                  <div key={i} className="p-5 bg-zinc-50 rounded-2xl border-2 border-transparent hover:border-black transition-all group cursor-pointer flex flex-col gap-4">
                    <div className="w-9 h-9 bg-white rounded-2xl border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-black transition-colors shadow-sm">
                      {React.cloneElement(item.icon as React.ReactElement, { size: 18 })}
                    </div>
                    <div>
                       <h3 className="font-black text-xs uppercase mb-1 text-black tracking-tight">{item.title}</h3>
                       <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
             </div>

             <div className="p-5 bg-blue-100/50 border border-blue-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                      <PlayCircle size={20} />
                   </div>
                   <div>
                      <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-tight font-display">{t('videoTutorial')}</h4>
                      <p className="text-[9px] text-blue-700 font-black uppercase tracking-widest">{t('watchGuide')} (3min)</p>
                   </div>
                </div>
                <Button variant="outline" size="sm" className="bg-white border-blue-200 text-blue-700 hover:bg-blue-50">
                   <ExternalLink size={14} className="mr-2" /> Open
                </Button>
             </div>
          </div>

          <div className="p-5 bg-zinc-50 border-t border-zinc-100 flex justify-center">
             <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">trackpal • {t('documentation')}</p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
