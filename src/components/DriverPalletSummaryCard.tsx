import type { FC, ReactNode } from 'react';
import { cn } from './ui';

export type DriverPalletSummaryTheme = {
  surface: string;
  border: string;
  label: string;
  heading: string;
  body: string;
};

interface DriverPalletSummaryCardProps {
  nameLabel: string;
  code: string;
  typeLabel: string;
  typeValue: string;
  theme: DriverPalletSummaryTheme;
  alignTop?: boolean;
  children?: ReactNode;
}

export const DriverPalletSummaryCard: FC<DriverPalletSummaryCardProps> = ({
  nameLabel,
  code,
  typeLabel,
  typeValue,
  theme,
  alignTop = false,
  children,
}) => (
  <div
    className={cn(
      'mx-4 flex flex-col rounded-[1.45rem] border px-4 py-4',
      alignTop ? 'justify-start' : 'justify-center',
      theme.surface,
      theme.border
    )}
  >
    <div className="grid grid-cols-2 gap-4 text-left">
      <div className="min-w-0">
        <p className={cn('text-[11px] font-black uppercase tracking-[0.16em]', theme.label)}>
          {nameLabel}
        </p>
        <p className={cn('mt-1 break-words text-[1.16rem] font-black uppercase leading-6 tracking-[0.08em]', theme.heading)}>
          {code}
        </p>
      </div>
      <div className="min-w-0 text-right">
        <p className={cn('text-[11px] font-black uppercase tracking-[0.16em]', theme.label)}>
          {typeLabel}
        </p>
        <p className={cn('mt-1 break-words text-[1.16rem] font-black leading-6 tracking-[0.08em]', theme.body)}>
          {typeValue}
        </p>
      </div>
    </div>
    {children}
  </div>
);
