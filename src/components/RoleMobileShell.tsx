import { type FC, type ReactNode } from 'react';
import { LogOut, Settings, Boxes, ChevronLeft } from 'lucide-react';
import { cn } from './ui';

interface RoleMobileShellProps {
  containerId: 'app-container' | 'driver-app-container';
  sentinelVariant: 'app' | 'driver';
  isNightMode?: boolean;
  settingsTitle: string;
  logoutTitle: string;
  settingsActive?: boolean;
  palletActive?: boolean;
  onToggleSettings: () => void;
  onLogout: () => void;
  logoSrc: string;
  bodyClassName?: string;
  children: ReactNode;
  bottomSlot?: ReactNode;
  showPalletIcon?: boolean;
  onPalletIconClick?: () => void;
  showBackToScan?: boolean;
  backToScanLabel: string;
  onBackToScan?: () => void;
}

export const RoleMobileShell: FC<RoleMobileShellProps> = ({
  containerId,
  sentinelVariant,
  isNightMode = false,
  settingsTitle,
  logoutTitle,
  settingsActive = false,
  palletActive = false,
  onToggleSettings,
  onLogout,
  logoSrc,
  bodyClassName,
  children,
  bottomSlot,
  showPalletIcon = false,
  onPalletIconClick,
  showBackToScan = false,
  backToScanLabel,
  onBackToScan,
}) => (
  <div
    id={containerId}
    className={cn(
      'bg-[var(--surface-page)] text-[var(--text-primary)] font-sans selection:bg-[var(--action-primary)] selection:text-white transition-colors',
      isNightMode && 'dark',
      'fixed inset-0 flex flex-col overflow-hidden'
    )}
  >
    <div className={cn('safari-tint-sentinel', `safari-tint-sentinel--${sentinelVariant}`)} aria-hidden="true" />
    <header className="shrink-0 border-b border-emerald-100/80 bg-white/92 backdrop-blur-xl dark:border-white/10 dark:bg-[#0c1110]/94">
      <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-4">
        <img src={logoSrc} alt="Trackpal logo" className="h-6 w-auto" />

        <div className="flex items-center gap-2">
          {showPalletIcon && (
            <button
              type="button"
              onClick={onPalletIconClick}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]',
                palletActive
                  ? 'border-[#00A655] bg-[#00A655] text-white'
                  : 'border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700'
              )}
            >
              <Boxes size={18} />
            </button>
          )}
          <button
            type="button"
            title={settingsTitle}
            onClick={onToggleSettings}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-raised)]',
              settingsActive
                ? 'border-[#00A655] bg-[#00A655] text-white'
                : 'border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700'
            )}
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            title={logoutTitle}
            onClick={onLogout}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-100 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>

    <main
      className={cn(
        'mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto overscroll-y-contain py-4 no-scrollbar dark:bg-transparent',
        showBackToScan && 'pb-[calc(env(safe-area-inset-bottom)+5.5rem)]'
      )}
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </main>

    {showBackToScan && onBackToScan && (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100]">
        <div className="pointer-events-auto mx-auto grid min-h-16 w-full max-w-md items-center border-t border-transparent bg-[#00A655] px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] shadow-[0_-12px_36px_rgba(0,166,85,0.35)]">
          <button
            type="button"
            onClick={onBackToScan}
            className="flex h-full w-full items-center justify-center gap-2 rounded-xl px-3 text-center text-[0.72rem] font-black uppercase tracking-[0.14em] text-white transition-colors active:scale-[0.99] hover:bg-white/10"
          >
            <ChevronLeft size={20} className="shrink-0" />
            {backToScanLabel}
          </button>
        </div>
      </div>
    )}

    {bottomSlot}
  </div>
);
