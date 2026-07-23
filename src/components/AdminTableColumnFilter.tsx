import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Funnel, RotateCcw } from 'lucide-react';
import { cn, Input } from './ui';

export type AdminTableFilterOption = {
  value: string;
  label: string;
};

interface AdminTableColumnFilterProps {
  label: string;
  options: AdminTableFilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  filterLabel: string;
  searchLabel: string;
  showAllLabel: string;
  noResultsLabel: string;
}

export const AdminTableColumnFilter: React.FC<AdminTableColumnFilterProps> = ({
  label,
  options,
  selectedValues,
  onToggle,
  onClear,
  filterLabel,
  searchLabel,
  showAllLabel,
  noResultsLabel,
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 256, maxHeight: 320 });

  const visibleOptions = options.filter((option) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return !normalizedQuery
      || option.label.toLocaleLowerCase().includes(normalizedQuery)
      || option.value.toLocaleLowerCase().includes(normalizedQuery);
  });

  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(288, window.innerWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(rect.right - width, viewportPadding),
        window.innerWidth - width - viewportPadding
      );
      const top = rect.bottom + 8;
      setPosition({
        top,
        left,
        width,
        maxHeight: Math.max(180, window.innerHeight - top - viewportPadding),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  const menu = isOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={menuRef}
          style={position}
          className="fixed z-[80] flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-[0_18px_40px_-22px_rgba(0,0,0,0.28)] dark:border-white/15 dark:bg-[#101113] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
        >
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchLabel}
            className="h-10 bg-white px-3 text-left text-[12px] normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal dark:bg-[#18181b] dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              onClear();
              setQuery('');
            }}
            className="mt-2 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
          >
            <span>{showAllLabel}</span>
            <RotateCcw size={12} />
          </button>
          <div className="mt-1 min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/50 p-1 dark:border-white/15 dark:bg-[#18181b]">
            {visibleOptions.length > 0 ? visibleOptions.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-bold normal-case tracking-normal transition-colors',
                  selectedValues.includes(option.value)
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-white/[0.1] dark:text-white'
                    : 'text-zinc-700 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/[0.07]'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#00A655] focus:ring-[#00A655]"
                />
                <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
              </label>
            )) : (
              <p className="px-2.5 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                {noResultsLabel}
              </p>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`${filterLabel}: ${label}`}
        aria-expanded={isOpen}
        title={`${filterLabel}: ${label}`}
        className={cn(
          'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
          selectedValues.length > 0 || isOpen
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100'
            : 'border-transparent text-zinc-400 hover:border-zinc-200 hover:bg-white hover:text-zinc-700 dark:text-zinc-500 dark:hover:border-white/15 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200'
        )}
      >
        <Funnel size={13} fill={selectedValues.length > 0 ? 'currentColor' : 'none'} />
        {selectedValues.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00A655] px-1 text-[8px] font-black leading-none text-white ring-2 ring-zinc-50 dark:ring-[#18181b]">
            {selectedValues.length}
          </span>
        )}
      </button>
      {menu}
    </>
  );
};
