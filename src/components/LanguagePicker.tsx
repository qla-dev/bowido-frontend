import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { languageOptions } from '../i18n';
import { useApp } from '../AppContext';
import { cn } from './ui';

/** A search-free, app-styled language chooser used in settings. */
export const LanguagePicker = () => {
  const { t, language, setLanguage } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const currentOption = languageOptions.find((option) => option.code === language) || languageOptions[0];

  useEffect(() => {
    const closeOnOutsidePointer = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsidePointer);
    return () => document.removeEventListener('mousedown', closeOnOutsidePointer);
  }, []);

  return (
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-left dark:border-emerald-500/20 dark:bg-emerald-900/20">
      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
        {t('language')}
      </span>
      <div ref={pickerRef} className="relative mt-3">
        <button
          type="button"
          role="combobox"
          aria-label={t('language')}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 text-left text-[14px] font-semibold tracking-normal text-[var(--text-primary)] outline-none transition-all hover:border-emerald-300 focus:border-[color:var(--action-primary)] focus:bg-[var(--surface-panel)]"
        >
          <span className="min-w-0 truncate">{currentOption.nativeLabel}</span>
          <ChevronDown size={16} className={cn('shrink-0 text-emerald-700 transition-transform dark:text-emerald-200', isOpen && 'rotate-180')} />
        </button>
        {isOpen && (
          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-[140] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_20px_45px_-22px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#151d1a]">
            <div className="space-y-1">
              {languageOptions.map((option) => {
                const isSelected = option.code === language;

                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      setLanguage(option.code);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold transition-colors',
                      isSelected
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200'
                        : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/5'
                    )}
                  >
                    <span className="min-w-0 truncate">{option.nativeLabel}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">{option.shortLabel}</span>
                      {isSelected && <Check size={14} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
