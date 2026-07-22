import React from 'react';
import { cn } from './ui';

interface AdminTableStickyToolbarProps {
  children: React.ReactNode;
  className?: string;
  flushToPageTop?: boolean;
}

export const AdminTableStickyToolbar: React.FC<AdminTableStickyToolbarProps> = ({
  children,
  className,
  flushToPageTop = false,
}) => (
  <div
    className={cn(
      'sticky top-0 z-30 -mx-4 border-b border-zinc-100 bg-white px-4 sm:-mx-5 sm:px-5 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8 dark:border-white/10 dark:bg-[#070b0a]',
      flushToPageTop && '-mt-4 sm:-mt-5 md:-mt-6 lg:-mt-8',
      className
    )}
  >
    {children}
  </div>
);
