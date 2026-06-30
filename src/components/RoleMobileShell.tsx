import type { FC, ReactNode } from 'react';
import { LogOut, Settings, Boxes } from 'lucide-react';
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
}) => (
  <div
    id={containerId}
    className={cn(
      'bg-white text-emerald-900 font-sans selection:bg-[#00A655] selection:text-white transition-colors dark:bg-[#13241b] dark:text-white',
      isNightMode && 'dark',
      'fixed inset-0 flex flex-col overflow-hidden'
    )}
  >
    <div className={cn('safari-tint-sentinel', `safari-tint-sentinel--${sentinelVariant}`)} aria-hidden="true" />
    <header className="shrink-0 border-b border-emerald-100/80 bg-white/92 backdrop-blur-xl dark:border-white/10 dark:bg-[#172d22]/92">
      <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between px-4">
        <img src={logoSrc} alt="Trackpal logo" className="h-6 w-auto" />

        <div className="flex items-center gap-2">
          {showPalletIcon && (
            <button
              type="button"
              onClick={onPalletIconClick}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-100',
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
              'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-100',
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
      className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto overscroll-y-contain py-4 no-scrollbar dark:bg-transparent"
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    >
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </main>

    {bottomSlot}
  </div>
);
