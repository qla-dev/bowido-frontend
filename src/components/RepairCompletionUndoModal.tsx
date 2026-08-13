import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, RefreshCcw } from 'lucide-react';
import { motion } from 'motion/react';
import type { AppLanguage } from '../i18n';

interface RepairCompletionUndoModalProps {
  palletLabel: string;
  language: AppLanguage;
  onUndo: () => void;
  onConfirm: () => void;
}

const getCopy = (language: AppLanguage) => {
  if (language === 'bs') {
    return {
      title: 'Paleta je popravljena',
      message: 'Paleta je uklonjena sa liste za popravak.',
      undo: 'Poništi',
      ok: 'U redu',
    };
  }

  if (language === 'nl') {
    return {
      title: 'Bok is gerepareerd',
      message: 'De bok is uit de reparatielijst verwijderd.',
      undo: 'Ongedaan maken',
      ok: 'OK',
    };
  }

  return {
    title: 'Pallet marked as repaired',
    message: 'The pallet has been removed from the repair list.',
    undo: 'Undo',
    ok: 'OK',
  };
};

export const RepairCompletionUndoModal: React.FC<RepairCompletionUndoModalProps> = ({
  palletLabel,
  language,
  onUndo,
  onConfirm,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(5);
  const onConfirmRef = useRef(onConfirm);
  const copy = getCopy(language);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  useEffect(() => {
    const countdown = window.setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);
    const closeTimeout = window.setTimeout(() => onConfirmRef.current(), 5000);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(closeTimeout);
    };
  }, []);

  return (
    <motion.div
      data-lock-scroll-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="repair-completion-title"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white shadow-[0_30px_80px_-32px_rgba(0,0,0,0.55)] dark:border-white/10 dark:bg-[#101715]"
      >
        <div className="p-6 text-center">
          <div className="mx-auto flex h-13 w-13 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-200">
            <CheckCircle2 size={25} />
          </div>
          <p
            id="repair-completion-title"
            className="mt-4 text-[13px] font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-100"
          >
            {copy.title}
          </p>
          <p className="mt-2 break-words text-sm font-black uppercase tracking-tight text-zinc-900 dark:text-white">
            {palletLabel}
          </p>
          <p className="mt-3 text-[12px] font-bold leading-5 text-zinc-500 dark:text-zinc-300">
            {copy.message}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-zinc-100 bg-zinc-50 p-4 dark:border-white/10 dark:bg-[#070b0a]">
          <button
            type="button"
            onClick={onUndo}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-500 px-3 text-[11px] font-black uppercase tracking-[0.1em] text-white transition-transform active:scale-[0.98]"
          >
            <RefreshCcw size={15} />
            {copy.undo} ({secondsRemaining})
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-12 items-center justify-center rounded-xl bg-[#00A655] px-3 text-[11px] font-black uppercase tracking-[0.1em] text-white transition-transform active:scale-[0.98]"
          >
            {copy.ok}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
