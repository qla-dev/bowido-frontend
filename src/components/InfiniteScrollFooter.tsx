import { useEffect, useRef } from 'react';
import { LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from './ui';
import type { AppLanguage } from '../i18n';

type InfiniteScrollFooterProps = {
  hasMore: boolean;
  isLoading: boolean;
  error?: unknown;
  onLoadMore: () => void;
  onRetry?: () => void;
  language: AppLanguage;
};

const copy = {
  bs: { loading: 'Učitavanje dodatnih rezultata...', end: 'Nema više rezultata', retry: 'Pokušaj ponovo' },
  nl: { loading: 'Meer resultaten laden...', end: 'Einde van de resultaten', retry: 'Opnieuw proberen' },
  en: { loading: 'Loading more results...', end: 'End of results', retry: 'Try again' },
} as const;

export function InfiniteScrollFooter({ hasMore, isLoading, error, onLoadMore, onRetry, language }: InfiniteScrollFooterProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef(onLoadMore);
  const labels = copy[language] || copy.en;

  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
      },
      { rootMargin: '0px 0px 320px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMore, isLoading]);

  if (error) {
    return <div ref={sentinelRef} className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-600">{String(error instanceof Error ? error.message : error)}</p>
      {onRetry && <Button type="button" variant="outline" className="h-10 gap-2" onClick={onRetry}><RotateCcw size={14} />{labels.retry}</Button>}
    </div>;
  }

  return <div ref={sentinelRef} className="flex min-h-16 items-center justify-center py-4 text-center">
    {isLoading ? <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400"><LoaderCircle size={15} className="animate-spin" />{labels.loading}</span>
      : !hasMore ? <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{labels.end}</span>
        : null}
  </div>;
}
