import React from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AppLanguage } from '../i18n';

type PageLoadingModalProps = {
  isOpen: boolean;
  language: AppLanguage;
};

const loadingCopy: Record<AppLanguage, string> = {
  bs: 'Učitavanje',
  nl: 'Laden',
  en: 'Loading',
};

const hasDarkShell = () => {
  if (typeof document === 'undefined') {
    return false;
  }

  return Boolean(
    document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark') ||
      document.getElementById('app-container')?.classList.contains('dark') ||
      document.getElementById('driver-app-container')?.classList.contains('dark')
  );
};

export const PageLoadingModal: React.FC<PageLoadingModalProps> = ({ isOpen, language }) => {
  const modal = (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`modal-overlay fixed inset-0 z-[180] flex items-center justify-center bg-zinc-950/25 p-4 backdrop-blur-[2px] dark:bg-black/45 ${hasDarkShell() ? 'dark' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          aria-label={loadingCopy[language] || loadingCopy.en}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16 }}
            className="flex min-w-48 flex-col items-center gap-4 rounded-2xl border border-zinc-100 bg-white px-8 py-7 text-center shadow-2xl dark:border-white/10 dark:bg-[#172d22]"
          >
            <LoaderCircle className="animate-spin text-[#00A655]" size={30} />
            <p className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">
              {loadingCopy[language] || loadingCopy.en}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') {
    return modal;
  }

  return createPortal(modal, document.body);
};
