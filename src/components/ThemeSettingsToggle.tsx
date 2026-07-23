import type { FC } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from './ui';

interface ThemeSettingsToggleProps {
  isNightMode: boolean;
  onToggle: () => void;
  label: string;
  onLabel: string;
  offLabel: string;
}

export const ThemeSettingsToggle: FC<ThemeSettingsToggleProps> = ({
  isNightMode,
  onToggle,
  label,
  onLabel,
  offLabel,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={isNightMode}
    onClick={onToggle}
    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-emerald-300 dark:border-white/10 dark:bg-[#101715] dark:hover:border-emerald-400/40"
  >
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600 dark:bg-white/[0.07] dark:text-zinc-200">
        {isNightMode ? <Sun size={18} /> : <Moon size={18} />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-black uppercase tracking-[0.14em] text-zinc-950 dark:text-white">
          {label}
        </span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">
          {isNightMode ? onLabel : offLabel}
        </span>
      </span>
    </span>

    <span
      aria-hidden="true"
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors',
        isNightMode ? 'bg-[#00A655]' : 'bg-zinc-200 dark:bg-zinc-700'
      )}
    >
      <span
        className={cn(
          'absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          isNightMode && 'translate-x-5'
        )}
      />
    </span>
  </button>
);
