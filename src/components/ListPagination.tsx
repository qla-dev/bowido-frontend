import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './ui';
import { AppLanguage } from '../i18n';

type ListPaginationProps = {
  total: number;
  limit: number;
  offset: number;
  count: number;
  isLoading?: boolean;
  language: AppLanguage;
  onPageChange: (offset: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: readonly number[];
};

const DEFAULT_LIMIT_OPTIONS: readonly number[] = [10, 25, 50];

const copyByLanguage = {
  bs: {
    page: 'Stranica',
    of: 'od',
    shown: 'Prikazano',
    rows: 'Redova',
    previous: 'Prethodna',
    next: 'Sljedeca',
  },
  nl: {
    page: 'Pagina',
    of: 'van',
    shown: 'Getoond',
    rows: 'Rijen',
    previous: 'Vorige',
    next: 'Volgende',
  },
  en: {
    page: 'Page',
    of: 'of',
    shown: 'Showing',
    rows: 'Rows',
    previous: 'Previous',
    next: 'Next',
  },
} as const;

export const ListPagination: React.FC<ListPaginationProps> = ({
  total,
  limit,
  offset,
  count,
  isLoading = false,
  language,
  onPageChange,
  onLimitChange,
  limitOptions = DEFAULT_LIMIT_OPTIONS,
}) => {
  const copy = copyByLanguage[language] || copyByLanguage.en;
  const safeLimit = Math.max(limit, 1);
  const visibleLimitOptions = limitOptions.includes(safeLimit)
    ? limitOptions
    : [...limitOptions, safeLimit].sort((left, right) => left - right);
  const currentPage = Math.floor(offset / safeLimit) + 1;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const canGoPrevious = offset > 0 && !isLoading;
  const canGoNext = offset + count < total && !isLoading;
  const firstItem = total === 0 ? 0 : offset + 1;
  const lastItem = total === 0 ? 0 : Math.min(offset + count, total);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-zinc-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-[10px] font-black uppercase tracking-[0.14em]">
        {copy.shown} {firstItem}-{lastItem} {copy.of} {total}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        {onLimitChange && (
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
            <span>{copy.rows}</span>
            <select
              value={safeLimit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              disabled={isLoading}
              className={cn(
                'h-9 rounded-xl border bg-white px-3 pr-8 text-[10px] font-black uppercase tracking-[0.12em] outline-none transition-colors',
                isLoading
                  ? 'cursor-not-allowed border-zinc-100 bg-zinc-50 text-zinc-300'
                  : 'cursor-pointer border-zinc-200 text-zinc-700 hover:border-emerald-200 focus:border-[#00A655]'
              )}
              aria-label={copy.rows}
            >
              {visibleLimitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
          {copy.page} {currentPage} {copy.of} {totalPages}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, offset - safeLimit))}
            disabled={!canGoPrevious}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
              canGoPrevious
                ? 'border-zinc-200 bg-white text-zinc-700 hover:border-emerald-200 hover:text-emerald-700'
                : 'border-zinc-100 bg-zinc-50 text-zinc-300'
            )}
            aria-label={copy.previous}
            title={copy.previous}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(offset + safeLimit)}
            disabled={!canGoNext}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
              canGoNext
                ? 'border-zinc-200 bg-white text-zinc-700 hover:border-emerald-200 hover:text-emerald-700'
                : 'border-zinc-100 bg-zinc-50 text-zinc-300'
            )}
            aria-label={copy.next}
            title={copy.next}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
