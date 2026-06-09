import React, { useEffect, useRef, useState } from 'react';
import { Card, cn } from './ui';

export const adminTableStyles = {
  headerCellClass:
    'relative border-r border-zinc-200 px-3 py-3 pr-4 align-middle text-center last:border-r-0',
  headerIconClass:
    'flex h-[1.625rem] w-[1.625rem] shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500',
  headerIconButtonClass:
    'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700',
  headerContentClass: 'flex w-full min-w-0 items-center justify-center gap-2 whitespace-nowrap',
  bodyCellClass:
    'border-r border-zinc-100 px-3.5 py-3.5 align-middle text-center last:border-r-0',
  bodyCellInnerClass: 'flex min-h-[2.75rem] min-w-0 items-center justify-center',
  bodyTextClass: 'truncate text-[11px] font-bold tracking-tight',
} as const;

export type AdminTableHeaderCellRefs<K extends string> = React.MutableRefObject<
  Partial<Record<K, HTMLTableCellElement | null>>
>;

export type AdminTableRenderHelpers<K extends string> = {
  columnWidths: Record<K, number>;
  totalTableWidth: number;
  tableRef: React.MutableRefObject<HTMLDivElement | null>;
  registerHeaderCell: (key: K) => (element: HTMLTableCellElement | null) => void;
  renderResizeHandle: (key: K) => React.ReactNode;
};

interface AdminDataTableProps<K extends string> {
  columnOrder: readonly K[];
  initialColumnWidths: Record<K, number>;
  minColumnWidths: Record<K, number>;
  resizeAriaLabel: string;
  renderTable: (helpers: AdminTableRenderHelpers<K>) => React.ReactNode;
  isEmpty?: boolean;
  emptyState?: React.ReactNode;
  className?: string;
  tableWrapperClassName?: string;
  tableRef?: React.MutableRefObject<HTMLDivElement | null>;
  headerCellRefs?: AdminTableHeaderCellRefs<K>;
}

export const AdminDataTable = <K extends string>({
  columnOrder,
  initialColumnWidths,
  minColumnWidths,
  resizeAriaLabel,
  renderTable,
  isEmpty = false,
  emptyState = null,
  className,
  tableWrapperClassName,
  tableRef,
  headerCellRefs,
}: AdminDataTableProps<K>) => {
  const internalTableRef = useRef<HTMLDivElement | null>(null);
  const internalHeaderCellRefs = useRef<Partial<Record<K, HTMLTableCellElement | null>>>({});
  const resizeStateRef = useRef<{ key: K; startX: number; startWidth: number } | null>(null);
  const resolvedTableRef = tableRef ?? internalTableRef;
  const resolvedHeaderCellRefs = headerCellRefs ?? internalHeaderCellRefs;
  const [columnWidths, setColumnWidths] = useState<Record<K, number>>(initialColumnWidths);
  const [activeResizeKey, setActiveResizeKey] = useState<K | null>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;

      if (!resizeState) {
        return;
      }

      event.preventDefault();

      const nextWidth = Math.max(
        minColumnWidths[resizeState.key],
        resizeState.startWidth + (event.clientX - resizeState.startX)
      );

      setColumnWidths((current) =>
        current[resizeState.key] === nextWidth
          ? current
          : {
              ...current,
              [resizeState.key]: nextWidth,
            }
      );
    };

    const stopResize = () => {
      if (!resizeStateRef.current) {
        return;
      }

      resizeStateRef.current = null;
      setActiveResizeKey(null);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [minColumnWidths]);

  const registerHeaderCell = (key: K) => (element: HTMLTableCellElement | null) => {
    resolvedHeaderCellRefs.current[key] = element;
  };

  const startColumnResize = (event: React.PointerEvent<HTMLButtonElement>, key: K) => {
    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key],
    };

    setActiveResizeKey(key);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  const renderResizeHandle = (key: K) => (
    <button
      type="button"
      aria-label={resizeAriaLabel}
      onPointerDown={(event) => startColumnResize(event, key)}
      className={cn(
        'absolute inset-y-0 -right-2 z-10 w-5 cursor-ew-resize touch-none rounded-r-lg bg-transparent outline-none transition-colors',
        activeResizeKey === key
          ? 'bg-emerald-50/80'
          : 'hover:bg-zinc-100/80 focus-visible:bg-zinc-100/80'
      )}
    />
  );

  const totalTableWidth = columnOrder.reduce((sum, key) => sum + columnWidths[key], 0);

  return (
    <Card noPadding className={cn('overflow-hidden', className)}>
      <div
        ref={resolvedTableRef}
        className={cn('overflow-x-auto rounded-[inherit]', tableWrapperClassName)}
      >
        {renderTable({
          columnWidths,
          totalTableWidth,
          tableRef: resolvedTableRef,
          registerHeaderCell,
          renderResizeHandle,
        })}

        {isEmpty && emptyState}
      </div>
    </Card>
  );
};
