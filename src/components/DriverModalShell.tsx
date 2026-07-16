import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from './ui';

type DriverModalWidth = 'sm' | 'md' | 'lg';

interface DriverModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  width?: DriverModalWidth;
  overlayClassName?: string;
  contentClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  showHeaderDivider?: boolean;
  showFooterDivider?: boolean;
}

const widthClassMap: Record<DriverModalWidth, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-[24.25rem]',
  lg: 'md:max-w-[26rem]',
};

export const DriverModalShell: React.FC<DriverModalShellProps> = ({
  onClose,
  children,
  title,
  subtitle,
  header,
  footer,
  width = 'sm',
  overlayClassName,
  contentClassName,
  bodyClassName,
  headerClassName,
  footerClassName,
  showHeaderDivider = true,
  showFooterDivider = true,
}) => {
  const hasHeaderContent = header !== undefined || Boolean(title) || Boolean(subtitle);
  const resolvedHeader =
    header !== undefined ? (
      header
    ) : title || subtitle ? (
      <div>
        {title && (
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
            {title}
          </p>
        )}
        {subtitle && (
          <p className="mt-1 text-[13px] font-black uppercase tracking-[0.08em] text-emerald-950 dark:text-white">
            {subtitle}
          </p>
        )}
      </div>
    ) : (
      <div />
    );

  return (
    <motion.div
      data-lock-scroll-modal="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--surface-overlay)] p-0 backdrop-blur-[2px] md:items-center md:px-4 md:py-6',
        overlayClassName
      )}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          'flex h-[100dvh] max-h-[100dvh] w-full min-h-0 flex-col overflow-hidden rounded-none border-0 bg-[var(--surface-panel)] text-[var(--text-primary)] md:h-auto md:max-h-[92dvh] md:rounded-[2rem] md:border md:border-[color:var(--border-subtle)]',
          widthClassMap[width],
          contentClassName
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between gap-4 px-5 py-4',
            hasHeaderContent && showHeaderDivider && 'border-b border-emerald-100 dark:border-white/10',
            headerClassName
          )}
        >
          {resolvedHeader}
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-all active:scale-[0.98]"
          >
            <X size={18} />
          </button>
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName)}>{children}</div>

        {footer && (
          <div
            className={cn(
              showFooterDivider && 'border-t border-emerald-100 dark:border-white/10',
              footerClassName
            )}
          >
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
