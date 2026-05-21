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
  sm: 'max-w-sm',
  md: 'max-w-[24.25rem]',
  lg: 'max-w-[26rem]',
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/25 px-4 py-6 backdrop-blur-[2px] dark:bg-black/45',
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
          'flex w-full flex-col overflow-hidden rounded-[2rem] border border-emerald-100 bg-white dark:border-white/10 dark:bg-[#172d22]',
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition-all active:scale-[0.98] dark:bg-[#1f3a2d] dark:text-emerald-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className={cn('flex-1', bodyClassName)}>{children}</div>

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
