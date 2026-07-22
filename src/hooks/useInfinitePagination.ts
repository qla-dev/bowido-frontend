import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedResult, PaginationMeta } from '../services/api';

type InfinitePaginationOptions<T> = {
  queryKey: string;
  pageSize: number;
  fetchPage: (offset: number) => Promise<PaginatedResult<T>>;
  getItemKey?: (item: T) => string | number;
};

const emptyMeta = (limit: number): PaginationMeta => ({ total: 0, limit, offset: 0, count: 0 });
const defaultItemKey = <T,>(item: T) => String((item as { id?: string | number }).id ?? JSON.stringify(item));

/**
 * Keeps offset-based server pagination while exposing an append-only list for
 * infinite scrolling. `queryKey` must change whenever the active query changes.
 */
export function useInfinitePagination<T>({
  queryKey,
  pageSize,
  fetchPage,
  getItemKey = defaultItemKey,
}: InfinitePaginationOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(() => emptyMeta(pageSize));
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const activeQueryKeyRef = useRef<string | null>(null);
  const requestGenerationRef = useRef(0);
  const requestedOffsetsRef = useRef(new Set<number>());
  const loadedOffsetsRef = useRef(new Set<number>());
  const loadingOffsetRef = useRef<number | null>(null);
  const nextOffsetRef = useRef(0);
  const hasMoreRef = useRef(true);

  const requestPage = useCallback(async (offset: number, replace = false) => {
    if (
      loadingOffsetRef.current !== null ||
      requestedOffsetsRef.current.has(offset) ||
      loadedOffsetsRef.current.has(offset) ||
      (!replace && !hasMoreRef.current)
    ) {
      return;
    }

    requestedOffsetsRef.current.add(offset);
    loadingOffsetRef.current = offset;
    const requestGeneration = requestGenerationRef.current;
    setError(null);
    if (replace) setIsInitialLoading(true);
    else setIsLoadingMore(true);

    try {
      const page = await fetchPage(offset);
      if (requestGeneration !== requestGenerationRef.current) return;

      loadedOffsetsRef.current.add(offset);
      nextOffsetRef.current = offset + page.meta.count;
      hasMoreRef.current = page.meta.count > 0 && nextOffsetRef.current < page.meta.total;
      setMeta(page.meta);
      setItems((current) => {
        const existingKeys = new Set(replace ? [] : current.map(getItemKey));
        const nextItems = page.items.filter((item) => {
          const key = getItemKey(item);
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });
        return replace ? nextItems : [...current, ...nextItems];
      });
    } catch (reason) {
      if (requestGeneration !== requestGenerationRef.current) return;
      requestedOffsetsRef.current.delete(offset);
      setError(reason);
    } finally {
      if (requestGeneration !== requestGenerationRef.current) return;
      loadingOffsetRef.current = null;
      if (replace) setIsInitialLoading(false);
      else setIsLoadingMore(false);
    }
  }, [fetchPage, getItemKey]);

  useEffect(() => {
    if (activeQueryKeyRef.current === queryKey) return;

    activeQueryKeyRef.current = queryKey;
    requestGenerationRef.current += 1;
    requestedOffsetsRef.current.clear();
    loadedOffsetsRef.current.clear();
    loadingOffsetRef.current = null;
    nextOffsetRef.current = 0;
    hasMoreRef.current = true;
    setItems([]);
    setMeta(emptyMeta(pageSize));
    setError(null);
    void requestPage(0, true);
  }, [pageSize, queryKey, requestPage]);

  const loadMore = useCallback(() => {
    if (isInitialLoading || isLoadingMore || !hasMoreRef.current) return;
    void requestPage(nextOffsetRef.current);
  }, [isInitialLoading, isLoadingMore, requestPage]);

  const retry = useCallback(() => {
    if (isInitialLoading || isLoadingMore) return;
    void requestPage(loadedOffsetsRef.current.size === 0 ? 0 : nextOffsetRef.current, loadedOffsetsRef.current.size === 0);
  }, [isInitialLoading, isLoadingMore, requestPage]);

  return {
    items,
    meta,
    error,
    hasMore: hasMoreRef.current,
    isInitialLoading,
    isLoadingMore,
    loadMore,
    retry,
    setItems,
  };
}
