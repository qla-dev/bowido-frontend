import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from './ui';
import { rankSearchResults } from '../lib/searchRanking';

export type SearchableSelectOption = {
  value: string;
  label: string;
};

interface SearchableSelectProps {
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  searchPlaceholder: string;
  noResultsLabel: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  searchPlaceholder,
  noResultsLabel,
  disabled = false,
  ariaLabel,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 256 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const visibleOptions = rankSearchResults(options, searchQuery, (option) => option.label);

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setMenuPosition({
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(140, Math.min(300, window.innerHeight - rect.bottom - 12)),
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, options.length]);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          setSearchQuery('');
          setIsOpen((current) => !current);
        }}
        className={cn(
          'flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 text-left text-[12px] font-bold text-[var(--text-primary)] outline-none transition-colors focus:border-[color:var(--action-primary)] focus:bg-[var(--surface-panel)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="truncate">{selectedOption?.label || value}</span>
        <ChevronDown size={16} className={cn('shrink-0 text-[var(--text-muted)] transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className={cn(
            'pallet-detail-dropdown-portal overflow-y-auto rounded-2xl border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-2 text-[var(--text-primary)] shadow-[0_20px_45px_-22px_rgba(15,23,42,0.45)]',
            triggerRef.current?.closest('.dark') && 'dark',
          )}
          style={{
            top: menuPosition.top,
            left: menuPosition.left,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
          }}
        >
          <div className="relative mb-2">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoFocus
              className="h-11 w-full rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] pl-9 pr-3 text-[11px] font-bold text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus:border-[color:var(--action-primary)]"
            />
          </div>

          {visibleOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold transition-colors',
                option.value === value
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-100'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-input)]',
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && <Check size={14} className="shrink-0" />}
            </button>
          ))}

          {visibleOptions.length === 0 && (
            <p className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {noResultsLabel}
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
};
