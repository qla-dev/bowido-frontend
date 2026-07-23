import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpDown,
  Funnel,
  Ghost,
  RotateCcw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Badge, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { getStatusLabel } from '../i18n';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { AdminTableStickyToolbar } from './AdminTableStickyToolbar';
import { Pallet } from '../types';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { PageLoadingModal } from './PageLoadingModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { apiService } from '../services/api';
import { statusIdAllowsCustomer } from '../lib/palletCustomerAssignment';
import { useInfinitePagination } from '../hooks/useInfinitePagination';
import { formatAppDate } from '../lib/dateFormat';

type NoQrColumnKey =
  | 'serial'
  | 'client'
  | 'status'
  | 'location'
  | 'reportedAt'
  | 'pickup'
  | 'comment';
type SortDirection = 'asc' | 'desc';

type FilterOption = {
  value: string;
  label: string;
};

type NoQrTableRow = {
  pallet: Pallet;
  id: number;
  serial: number;
  clientName: string;
  statusLabel: string;
  locationLabel: string;
  returnReportedAtLabel: string;
  pickupLabel: string;
  commentLabel: string;
};

type FilterSelections = Record<NoQrColumnKey, string[]>;
type FilterSearch = Record<NoQrColumnKey, string>;

const NO_QR_TABLE_COLUMN_ORDER = [
  'serial',
  'client',
  'status',
  'location',
  'reportedAt',
  'pickup',
  'comment',
] as const satisfies readonly NoQrColumnKey[];

const NO_QR_INITIAL_COLUMN_WIDTHS: Record<NoQrColumnKey, number> = {
  serial: 184,
  client: 184,
  status: 184,
  location: 184,
  reportedAt: 184,
  pickup: 184,
  comment: 184,
};

const NO_QR_MIN_COLUMN_WIDTHS: Record<NoQrColumnKey, number> = {
  serial: 88,
  client: 152,
  status: 140,
  location: 180,
  reportedAt: 152,
  pickup: 128,
  comment: 200,
};

const NO_QR_PAGE_SIZE = 25;

export const NoQrPalletTableView: React.FC = () => {
  const { pallets: cachedPallets, clients, statuses, updatePallet, deletePallet, t, language } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<NoQrColumnKey, HTMLTableCellElement | null>>>({});
  const [palletPendingDeletion, setPalletPendingDeletion] = useState<Pallet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: NoQrColumnKey; direction: SortDirection }>({
    key: 'serial',
    direction: 'asc',
  });
  const {
    headerCellClass,
    headerContentClass,
    bodyCellClass,
    bodyCellInnerClass,
    bodyTextClass,
  } = adminTableStyles;
  const emptyValueLabel = '-';
  const returnReportedLabel =
    language === 'bs' ? 'Prijavljen povrat' : language === 'nl' ? 'Retour gemeld' : 'Return reported';
  const pickupLabel = language === 'bs' ? 'Pickup' : language === 'nl' ? 'Pickup' : 'Pickup';
  const directPickupLabel =
    language === 'bs' ? 'Direktno' : language === 'nl' ? 'Direct' : 'Direct';
  const commentLabel = language === 'bs' ? 'Komentar' : language === 'nl' ? 'Commentaar' : 'Comment';
  const searchPlaceholder =
    language === 'bs' ? 'Pretraži' : language === 'nl' ? 'Zoeken' : 'Search';
  const showAllLabel =
    language === 'bs' ? 'Prikaži sve' : language === 'nl' ? 'Alles tonen' : 'Show all';
  const noResultsLabel =
    language === 'bs' ? 'Nema rezultata' : language === 'nl' ? 'Geen resultaten' : 'No results';
  const commentModalTitle =
    language === 'bs' ? 'Komentar' : language === 'nl' ? 'Commentaar' : 'Comment';
  const fullCommentLabel =
    language === 'bs'
      ? 'Prikaži cijeli komentar'
      : language === 'nl'
        ? 'Toon volledig commentaar'
        : 'Show full comment';
  const detailTitle =
    language === 'bs' ? 'Detalji palete bez QR koda' : language === 'nl' ? 'Details bok zonder QR-code' : 'No-QR pallet details';
  const assignedClientLabel =
    language === 'bs' ? 'Dodijeljeni klijent' : language === 'nl' ? 'Toegewezen klant' : 'Assigned client';
  const saveLabel =
    language === 'bs' ? 'Sačuvaj izmjene' : language === 'nl' ? 'Wijzigingen opslaan' : 'Save changes';
  const deleteLabel =
    language === 'bs' ? 'Obrisi paletu' : language === 'nl' ? 'Bok verwijderen' : 'Delete pallet';
  const deleteConfirmLabel =
    language === 'bs'
      ? 'Obrisati ovu paletu bez QR koda?'
      : language === 'nl'
        ? 'Deze bok zonder QR-code verwijderen?'
        : 'Delete this pallet without a QR code?';
  const resizeAriaLabel =
    language === 'bs'
      ? 'Promijeni sirinu kolone'
      : language === 'nl'
        ? 'Kolombreedte aanpassen'
        : 'Resize column';
  const textFilterInputClass =
    'h-10 bg-white px-3 text-left text-[12px] normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal';
  const dateFormatter = useMemo(
    () => ({
      format: (value: string | number | Date) => formatAppDate(value, language),
    }),
    [language]
  );
  const [selectedFilters, setSelectedFilters] = useState<FilterSelections>({
    serial: [],
    client: [],
    status: [],
    location: [],
    reportedAt: [],
    pickup: [],
    comment: [],
  });
  const [filterSearch, setFilterSearch] = useState<FilterSearch>({
    serial: '',
    client: '',
    status: '',
    location: '',
    reportedAt: '',
    pickup: '',
    comment: '',
  });
  const [openFilterKey, setOpenFilterKey] = useState<NoQrColumnKey | null>(null);
  const [activeCommentRow, setActiveCommentRow] = useState<NoQrTableRow | null>(null);
  const [editingPallet, setEditingPallet] = useState<Pallet | null>(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchPage = useCallback((offset: number) => apiService.pallets.page({
    limit: NO_QR_PAGE_SIZE,
    offset,
    is_ghost: true,
    search: debouncedSearchQuery || undefined,
    sort_by: 'created_at',
    sort_direction: 'desc',
  }), [debouncedSearchQuery]);
  const { items: pallets, hasMore, isInitialLoading, isLoadingMore, error: paginationError, loadMore, retry, setItems: setPagedPallets } = useInfinitePagination({
    queryKey: debouncedSearchQuery,
    pageSize: NO_QR_PAGE_SIZE,
    fetchPage,
  });

  useEffect(() => {
    if (cachedPallets.length === 0) {
      return;
    }

    setPagedPallets((current) =>
      current
        .map((pallet) => cachedPallets.find((cachedPallet) => cachedPallet.id === pallet.id) || pallet)
        .filter((pallet) => pallet.is_ghost)
    );
  }, [cachedPallets]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTable = tableRef.current?.contains(target);
      const isInsideMenu = filterMenuRef.current?.contains(target);

      if (!isInsideTable && !isInsideMenu) {
        setOpenFilterKey(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!openFilterKey) {
      setFilterMenuStyle(null);
      return;
    }

    const updatePosition = () => {
      const headerCell = headerCellRefs.current[openFilterKey];

      if (!headerCell) {
        return;
      }

      const rect = headerCell.getBoundingClientRect();
      const width = (() => {
        switch (openFilterKey) {
          case 'serial':
            return 216;
          case 'client':
          case 'location':
          case 'comment':
            return 288;
          case 'status':
          case 'pickup':
            return 240;
          case 'reportedAt':
            return 224;
          default:
            return 256;
        }
      })();
      const viewportPadding = 12;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, viewportPadding),
        window.innerWidth - width - viewportPadding
      );
      const top = rect.bottom + 8;
      const maxHeight = Math.max(180, window.innerHeight - top - viewportPadding);

      setFilterMenuStyle({
        top,
        left,
        width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [openFilterKey]);

  const rows = useMemo<NoQrTableRow[]>(
    () =>
      pallets
        .filter((pallet) => pallet.is_ghost)
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .map((pallet, index) => ({
          pallet,
          id: pallet.id,
          serial: index + 1,
          clientName:
            clients.find((client) => client.user_id === pallet.user_id)?.name ||
            pallet.client_name ||
            t('unknownClient'),
          statusLabel: getStatusLabel('Voor retour', language),
          locationLabel: pallet.current_location || t('notAvailable'),
          returnReportedAtLabel: dateFormatter.format(new Date(pallet.created_at)),
          pickupLabel: directPickupLabel,
          commentLabel: pallet.note?.trim() || emptyValueLabel,
        })),
    [clients, dateFormatter, directPickupLabel, language, pallets, t]
  );

  const getFilterValue = (row: NoQrTableRow, key: NoQrColumnKey) => {
    switch (key) {
      case 'serial':
        return String(row.serial);
      case 'client':
        return row.clientName;
      case 'status':
        return row.statusLabel;
      case 'location':
        return row.locationLabel;
      case 'reportedAt':
        return row.returnReportedAtLabel;
      case 'pickup':
        return row.pickupLabel;
      case 'comment':
        return row.commentLabel;
      default:
        return '';
    }
  };

  const getSortValue = (row: NoQrTableRow, key: NoQrColumnKey): string | number => {
    switch (key) {
      case 'serial':
        return row.serial;
      case 'reportedAt':
        return new Date(row.pallet.created_at).getTime();
      case 'client':
        return row.clientName;
      case 'status':
        return row.statusLabel;
      case 'location':
        return row.locationLabel;
      case 'pickup':
        return row.pickupLabel;
      case 'comment':
        return row.commentLabel;
      default:
        return '';
    }
  };

  const filterOptions = useMemo<Record<NoQrColumnKey, FilterOption[]>>(
    () => ({
      serial: rows.map((row) => ({ value: String(row.serial), label: String(row.serial) })),
      client: Array.from<string>(new Set(rows.map((row) => row.clientName)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      status: Array.from<string>(new Set(rows.map((row) => row.statusLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      location: Array.from<string>(new Set(rows.map((row) => row.locationLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      reportedAt: Array.from<string>(new Set(rows.map((row) => row.returnReportedAtLabel)))
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      pickup: Array.from<string>(new Set(rows.map((row) => row.pickupLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      comment: Array.from<string>(new Set(rows.map((row) => row.commentLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
    }),
    [rows]
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        (Object.keys(selectedFilters) as NoQrColumnKey[]).every((key) => {
          const selectedValues = selectedFilters[key];

          if (selectedValues.length === 0) {
            return true;
          }

          return selectedValues.includes(getFilterValue(row, key));
        })
      ),
    [rows, selectedFilters]
  );

  const sortedRows = useMemo(() => {
    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

    return [...filteredRows].sort((left, right) => {
      const leftValue = getSortValue(left, sortConfig.key);
      const rightValue = getSortValue(right, sortConfig.key);

      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * directionMultiplier;
      }

      return String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * directionMultiplier;
    });
  }, [filteredRows, sortConfig]);

  const toggleSort = (key: NoQrColumnKey) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const renderSortButton = (key: NoQrColumnKey, label: string) => {
    const isActive = sortConfig.key === key;
    const activeFilterCount = selectedFilters[key].length;
    const isFilterOpen = openFilterKey === key;

    return (
      <div className="flex min-w-0 items-center justify-center gap-0.5">
        <button
          type="button"
          onClick={() => toggleSort(key)}
          aria-pressed={isActive}
          className={cn(
            'flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] leading-none transition-colors',
            isActive
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm'
              : 'border-transparent text-zinc-900 hover:text-zinc-700'
          )}
        >
          <span className="block min-w-0 truncate">{label}</span>
          <ArrowUpDown size={13} className={cn('shrink-0 transition-transform', isActive && sortConfig.direction === 'desc' && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={() => setOpenFilterKey((current) => current === key ? null : key)}
          aria-label={`${t('filter')}: ${label}`}
          aria-expanded={isFilterOpen}
          title={`${t('filter')}: ${label}`}
          className={cn(
            'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
            activeFilterCount > 0 || isFilterOpen
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm'
              : 'border-transparent text-zinc-400 hover:border-zinc-200 hover:bg-white hover:text-zinc-700'
          )}
        >
          <Funnel size={13} fill={activeFilterCount > 0 ? 'currentColor' : 'none'} />
          {activeFilterCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00A655] px-1 text-[8px] font-black leading-none text-white ring-2 ring-zinc-50">{activeFilterCount}</span>}
        </button>
      </div>
    );
  };

  const toggleFilterSelection = (key: NoQrColumnKey, value: string) => {
    setSelectedFilters((current) => {
      const selectedValues = current[key];
      const hasValue = selectedValues.includes(value);

      return {
        ...current,
        [key]: hasValue
          ? selectedValues.filter((item) => item !== value)
          : [...selectedValues, value],
      };
    });
  };

  const clearColumnFilter = (key: NoQrColumnKey) => {
    setSelectedFilters((current) => ({
      ...current,
      [key]: [],
    }));
    setFilterSearch((current) => ({
      ...current,
      [key]: '',
    }));
  };

  const hasActiveFilter = (key: NoQrColumnKey) => selectedFilters[key].length > 0;

  const renderFilterMenu = (key: NoQrColumnKey) => {
    if (openFilterKey !== key || !filterMenuStyle) {
      return null;
    }

    const currentQuery = filterSearch[key].toLowerCase();
    const visibleOptions = filterOptions[key].filter((option) => {
      if (!currentQuery) {
        return true;
      }

      return (
        option.label.toLowerCase().includes(currentQuery) ||
        option.value.toLowerCase().includes(currentQuery)
      );
    });

    return (
      <div
        ref={filterMenuRef}
        style={{
          top: filterMenuStyle.top,
          left: filterMenuStyle.left,
          width: filterMenuStyle.width,
          maxHeight: filterMenuStyle.maxHeight,
        }}
        className="fixed z-30 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.28)]"
      >
        <Input
          value={filterSearch[key]}
          onChange={(event) =>
            setFilterSearch((current) => ({
              ...current,
              [key]: event.target.value,
            }))
          }
          placeholder={searchPlaceholder}
          className={textFilterInputClass}
        />

        <div className="mt-2 flex min-h-0 flex-1 flex-col space-y-1">
          <button
            type="button"
            onClick={() => clearColumnFilter(key)}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <span>{showAllLabel}</span>
            <RotateCcw size={12} />
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-100 bg-zinc-50/50 p-1">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <label
                  key={`${key}-${option.value}`}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] font-bold normal-case tracking-normal transition-colors',
                    selectedFilters[key].includes(option.value)
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'text-zinc-700 hover:bg-white hover:text-zinc-900'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedFilters[key].includes(option.value)}
                    onChange={() => toggleFilterSelection(key, option.value)}
                    className="h-4 w-4 rounded border-zinc-300 text-[#00A655] focus:ring-[#00A655]"
                  />
                  <span className="min-w-0 flex-1 truncate whitespace-nowrap" title={option.label}>
                    {option.label}
                  </span>
                </label>
              ))
            ) : (
              <div className="px-2.5 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                {noResultsLabel}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <AdminTableStickyToolbar
        flushToPageTop
        className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-zinc-900">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm">
            <Ghost size={16} />
          </span>
          {t('noQrPallets')}
        </h2>
        <div className="relative w-full sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 bg-white pl-10 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal"
          />
        </div>
      </AdminTableStickyToolbar>

      <AdminDataTable<NoQrColumnKey>
        columnOrder={NO_QR_TABLE_COLUMN_ORDER}
        initialColumnWidths={NO_QR_INITIAL_COLUMN_WIDTHS}
        minColumnWidths={NO_QR_MIN_COLUMN_WIDTHS}
        resizeAriaLabel={resizeAriaLabel}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isInitialLoading && sortedRows.length === 0}
        emptyState={
          <div className="p-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-100 bg-zinc-50">
              <Search size={20} className="text-zinc-200" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
              {rows.length === 0 ? t('noOpenGhostReports') : t('noMatchingResults')}
            </p>
          </div>
        }
        renderTable={({ columnWidths, totalTableWidth, registerHeaderCell, renderResizeHandle }) => (
          <table
            className="border-collapse text-left [table-layout:fixed]"
            style={{ width: `max(100%, ${totalTableWidth}px)` }}
          >
            <colgroup>
              <col style={{ width: columnWidths.serial }} />
              <col style={{ width: columnWidths.client }} />
              <col style={{ width: columnWidths.status }} />
              <col style={{ width: columnWidths.location }} />
              <col style={{ width: columnWidths.reportedAt }} />
              <col style={{ width: columnWidths.pickup }} />
              <col style={{ width: columnWidths.comment }} />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80">
              <tr>
                <th ref={registerHeaderCell('serial')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('serial', '#')}
                  </div>
                  {renderResizeHandle('serial')}
                </th>
                <th ref={registerHeaderCell('client')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('client', t('client'))}
                  </div>
                  {renderResizeHandle('client')}
                </th>
                <th ref={registerHeaderCell('status')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('status', t('status'))}
                  </div>
                  {renderResizeHandle('status')}
                </th>
                <th ref={registerHeaderCell('location')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('location', t('location'))}
                  </div>
                  {renderResizeHandle('location')}
                </th>
                <th ref={registerHeaderCell('reportedAt')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('reportedAt', returnReportedLabel)}
                  </div>
                  {renderResizeHandle('reportedAt')}
                </th>
                <th ref={registerHeaderCell('pickup')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('pickup', pickupLabel)}
                  </div>
                  {renderResizeHandle('pickup')}
                </th>
                <th ref={registerHeaderCell('comment')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('comment', commentLabel)}
                  </div>
                  {renderResizeHandle('comment')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {sortedRows.map((row, index) => (
                <motion.tr
                  key={`no-qr-row-${row.id}`}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => {
                    setOpenFilterKey(null);
                    setEditingPallet(row.pallet);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setOpenFilterKey(null);
                      setEditingPallet(row.pallet);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="cursor-pointer transition-colors hover:bg-zinc-50/60 focus-visible:bg-zinc-50/80 focus-visible:outline-none"
                >
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900')}>{row.serial}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900')}>{row.clientName}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <Badge
                        variant="warning"
                        className="min-h-[1.875rem] rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight normal-case"
                      >
                        {row.statusLabel}
                      </Badge>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500')}>{row.locationLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500')}>
                        {row.returnReportedAtLabel}
                      </span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-600')}>{row.pickupLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={cn(bodyCellInnerClass, 'justify-start px-1')}>
                      {row.commentLabel !== emptyValueLabel ? (
                        <button
                          type="button"
                          title={fullCommentLabel}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenFilterKey(null);
                            setActiveCommentRow(row);
                          }}
                          className={cn(
                            bodyTextClass,
                            'w-full truncate text-left text-zinc-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-zinc-900'
                          )}
                        >
                          {row.commentLabel}
                        </button>
                      ) : (
                        <span className={cn(bodyTextClass, 'text-left text-zinc-500')}>
                          {row.commentLabel}
                        </span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      />
      <PageLoadingModal isOpen={isInitialLoading} language={language} />
      <InfiniteScrollFooter hasMore={hasMore} isLoading={isLoadingMore} error={paginationError} onLoadMore={loadMore} onRetry={retry} language={language} />
      {openFilterKey && renderFilterMenu(openFilterKey)}
      {activeCommentRow && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-[2px]"
          onClick={() => setActiveCommentRow(null)}
        >
          <div
            className="w-full max-w-lg rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  {commentModalTitle}
                </p>
                <h3 className="mt-2 text-xl font-black tracking-tight text-zinc-950">
                  {activeCommentRow.clientName}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveCommentRow(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900"
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
              <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-zinc-700">
                {activeCommentRow.commentLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      {editingPallet && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-[2px]"
          onClick={() => setEditingPallet(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)] no-scrollbar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute inset-x-0 top-0 h-1.5 bg-[#00A655]" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  {detailTitle}
                </p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-zinc-950">
                  #{rows.find((row) => row.id === editingPallet.id)?.serial || editingPallet.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPallet(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900"
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  {assignedClientLabel}
                </label>
                <select
                  value={editingPallet.user_id || ''}
                  disabled={!statusIdAllowsCustomer(statuses, editingPallet.current_status_id)}
                  onChange={(event) => {
                    const userId = event.target.value ? Number(event.target.value) : undefined;
                    const clientName = clients.find((client) => client.user_id === userId)?.name;
                    setEditingPallet({
                      ...editingPallet,
                      user_id: userId,
                      client_name: clientName,
                    });
                  }}
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-[12px] font-bold text-zinc-900 outline-none focus:border-emerald-400"
                >
                  <option value="">{t('noClient')}</option>
                  {clients.map((client) => (
                    <option key={`no-qr-edit-client-${client.id}`} value={client.user_id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  {t('status')}
                </label>
                <select
                  value={editingPallet.current_status_id}
                  onChange={(event) => {
                    const statusId = Number(event.target.value);
                    const statusName =
                      statuses.find((status) => status.id === statusId)?.name ||
                      editingPallet.current_status_name;
                    setEditingPallet({
                      ...editingPallet,
                      current_status_id: statusId,
                      current_status_name: statusName,
                      user_id: statusIdAllowsCustomer(statuses, statusId) ? editingPallet.user_id : undefined,
                      client_name: statusIdAllowsCustomer(statuses, statusId) ? editingPallet.client_name : undefined,
                    });
                  }}
                  className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-[12px] font-bold text-zinc-900 outline-none focus:border-emerald-400"
                >
                  {statuses.map((status) => (
                    <option key={`no-qr-edit-status-${status.id}`} value={status.id}>
                      {getStatusLabel(status.name, language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                {t('location')}
              </label>
              <Input
                value={editingPallet.current_location}
                onChange={(event) =>
                  setEditingPallet({ ...editingPallet, current_location: event.target.value })
                }
                className="bg-zinc-50"
              />
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                {commentLabel}
              </label>
              <textarea
                value={editingPallet.note || ''}
                onChange={(event) =>
                  setEditingPallet({ ...editingPallet, note: event.target.value })
                }
                className="min-h-32 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[12px] font-bold text-zinc-800 outline-none transition-colors focus:border-emerald-400"
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setPalletPendingDeletion(editingPallet)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-rose-200 px-5 text-[10px] font-black uppercase tracking-[0.14em] text-rose-600 transition-colors hover:bg-rose-50 sm:w-auto dark:border-rose-600 dark:bg-rose-600 dark:text-white dark:hover:bg-rose-700"
              >
                <Trash2 size={15} />
                {deleteLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  updatePallet(editingPallet);
                  setEditingPallet(null);
                }}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#00A655] px-5 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-transform hover:scale-[1.01]"
              >
                <Save size={15} />
                {saveLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      <DeleteConfirmModal
        open={Boolean(palletPendingDeletion)}
        title={`${deleteLabel}?`}
        subject={palletPendingDeletion ? `#${palletPendingDeletion.id}` : undefined}
        message={deleteConfirmLabel}
        confirmLabel={t('remove')}
        cancelLabel={t('cancel')}
        onClose={() => setPalletPendingDeletion(null)}
        onConfirm={() => {
          if (!palletPendingDeletion) return;
          deletePallet(palletPendingDeletion.id);
          setEditingPallet(null);
          setPalletPendingDeletion(null);
        }}
      />
    </div>
  );
};
