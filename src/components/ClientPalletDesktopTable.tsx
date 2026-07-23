import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpDown,
  Clock3,
  MapPin,
  Package,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { AdminTableStickyToolbar } from './AdminTableStickyToolbar';
import { Badge, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { AuditLog, ClientDetail, Pallet } from '../types';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService } from '../services/api';
import { getPalletDisplayName } from '../lib/palletDisplay';
import { useInfinitePagination } from '../hooks/useInfinitePagination';
import { formatAppDateTime } from '../lib/dateFormat';

type SortKey =
  | 'pallet'
  | 'type'
  | 'status'
  | 'lastUpdate'
  | 'location'
  | 'daysOut'
  | 'overdueDays'
  | 'debt';

type SortDirection = 'asc' | 'desc';
type FilterSelections = Record<SortKey, string[]>;
type FilterSearch = Record<SortKey, string>;

type PalletRow = {
  pallet: Pallet;
  palletLabel: string;
  typeLabel: string;
  statusLabel: string;
  lastUpdateLabel: string;
  lastUpdateValue: number;
  locationLabel: string;
  daysOut: number;
  overdueDays: number;
  debt: number;
  debtLabel: string;
};

const COLUMN_ORDER = [
  'pallet',
  'type',
  'status',
  'lastUpdate',
  'location',
  'daysOut',
  'overdueDays',
  'debt',
] as const satisfies readonly SortKey[];

const INITIAL_COLUMN_WIDTHS: Record<SortKey, number> = {
  pallet: 170,
  type: 145,
  status: 170,
  lastUpdate: 180,
  location: 230,
  daysOut: 135,
  overdueDays: 150,
  debt: 140,
};

const MIN_COLUMN_WIDTHS: Record<SortKey, number> = {
  pallet: 145,
  type: 120,
  status: 145,
  lastUpdate: 155,
  location: 190,
  daysOut: 115,
  overdueDays: 125,
  debt: 115,
};

const CLIENT_PALLET_PAGE_SIZE = 25;

const createEmptySelections = (): FilterSelections => ({
  pallet: [],
  type: [],
  status: [],
  lastUpdate: [],
  location: [],
  daysOut: [],
  overdueDays: [],
  debt: [],
});

const createEmptySearch = (): FilterSearch => ({
  pallet: '',
  type: '',
  status: '',
  lastUpdate: '',
  location: '',
  daysOut: '',
  overdueDays: '',
  debt: '',
});

interface ClientPalletDesktopTableProps {
  client: ClientDetail;
  summaryCards?: React.ReactNode;
}

export const ClientPalletDesktopTable: React.FC<ClientPalletDesktopTableProps> = ({ client, summaryCards }) => {
  const { pallets: cachedPallets, statuses, auditLogs, t, language } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<SortKey, HTMLTableCellElement | null>>>({});
  const [selectedPallet, setSelectedPallet] = useState<PalletRow | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'pallet',
    direction: 'asc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState<FilterSelections>(createEmptySelections);
  const [filterSearch, setFilterSearch] = useState<FilterSearch>(createEmptySearch);
  const [openFilterKey, setOpenFilterKey] = useState<SortKey | null>(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const {
    headerCellClass,
    headerContentClass,
    bodyCellClass,
    bodyCellInnerClass,
    bodyTextClass,
  } = adminTableStyles;

  const locale = language === 'nl' ? 'nl-NL' : language === 'bs' ? 'bs-BA' : 'en-GB';
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );
  const dateFormatter = useMemo(
    () => ({
      format: (value: string | number | Date) =>
        formatAppDateTime(value, language),
    }),
    [language]
  );
  const searchPlaceholder =
    language === 'bs' ? 'Pretraži' : language === 'nl' ? 'Zoeken' : 'Search';
  const showAllLabel =
    language === 'bs' ? 'Prikaži sve' : language === 'nl' ? 'Alles tonen' : 'Show all';
  const noResultsLabel =
    language === 'bs' ? 'Nema rezultata' : language === 'nl' ? 'Geen resultaten' : 'No results';
  const daysOutLabel =
    language === 'bs' ? 'Dana vani' : language === 'nl' ? 'Dagen buiten' : 'Days out';
  const overdueDaysLabel =
    language === 'bs' ? 'Dana kašnjenja' : language === 'nl' ? 'Dagen te laat' : 'Overdue days';
  const debtLabel =
    language === 'bs' ? 'Iznos duga' : language === 'nl' ? 'Schuldbedrag' : 'Debt amount';
  const lastUpdateLabel =
    language === 'bs' ? 'Zadnja izmjena' : language === 'nl' ? 'Laatste wijziging' : 'Last update';
  const palletLabel =
    language === 'bs' ? 'Paleta' : language === 'nl' ? 'Bok' : 'Pallet';
  const pageTitle =
    language === 'bs' ? 'Moje palete' : language === 'nl' ? 'Mijn bokken' : 'My pallets';
  const pageSubtitle =
    language === 'bs'
      ? 'Pregled statusa, lokacije i obračuna vaših paleta.'
      : language === 'nl'
        ? 'Overzicht van status, locatie en kosten van uw bokken.'
        : 'Overview of your pallets, their status, location and charges.';
  const movementHistoryLabel =
    language === 'bs' ? 'Historija kretanja' : language === 'nl' ? 'Bewegingsgeschiedenis' : 'Movement history';
  const changedByLabel =
    language === 'bs' ? 'Promijenio' : language === 'nl' ? 'Gewijzigd door' : 'Changed by';
  const noHistoryLabel =
    language === 'bs' ? 'Nema historije kretanja.' : language === 'nl' ? 'Geen bewegingsgeschiedenis.' : 'No movement history.';
  const resizeAriaLabel =
    language === 'bs'
      ? 'Promijeni sirinu kolone'
      : language === 'nl'
        ? 'Kolombreedte aanpassen'
        : 'Resize column';

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchPage = useCallback((offset: number) => apiService.pallets.page({
    limit: CLIENT_PALLET_PAGE_SIZE,
    offset,
    user_id: client.user_id,
    search: debouncedSearchQuery || undefined,
    sort_by: sortConfig.key,
    sort_direction: sortConfig.direction,
  }), [client.user_id, debouncedSearchQuery, sortConfig]);
  const { items: pallets, hasMore, isInitialLoading, isLoadingMore, error: paginationError, loadMore, retry, setItems: setPagedPallets } = useInfinitePagination({
    queryKey: `${client.user_id}|${debouncedSearchQuery}|${sortConfig.key}|${sortConfig.direction}|${JSON.stringify(selectedFilters)}`,
    pageSize: CLIENT_PALLET_PAGE_SIZE,
    fetchPage,
  });

  useEffect(() => {
    if (cachedPallets.length === 0) {
      return;
    }

    setPagedPallets((current) =>
      current.map((pallet) => cachedPallets.find((cachedPallet) => cachedPallet.id === pallet.id) || pallet)
    );
  }, [cachedPallets]);

  const getDaysSince = (date: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));

  const rows = useMemo<PalletRow[]>(
    () =>
      pallets
        .filter((pallet) => pallet.user_id === client.user_id)
        .map((pallet) => {
          const status = statuses.find((item) => item.id === pallet.current_status_id);
          const daysOut = getDaysSince(pallet.last_status_changed_at);
          const overdueDays = status?.is_billable
            ? Math.max(daysOut - client.grace_period_days, 0)
            : 0;
          const debt = overdueDays * client.price_per_day;

          return {
            pallet,
            palletLabel: getPalletDisplayName(pallet),
            typeLabel: getPalletTypeLabel(pallet.type, language),
            statusLabel: getStatusLabel(pallet.current_status_name, language),
            lastUpdateLabel: dateFormatter.format(new Date(pallet.last_status_changed_at)),
            lastUpdateValue: new Date(pallet.last_status_changed_at).getTime(),
            locationLabel: pallet.current_location || '-',
            daysOut,
            overdueDays,
            debt,
            debtLabel: `EUR ${currencyFormatter.format(debt)}`,
          };
        }),
    [client.grace_period_days, client.price_per_day, client.user_id, currencyFormatter, dateFormatter, language, pallets, statuses]
  );

  const getFilterValue = (row: PalletRow, key: SortKey) => {
    switch (key) {
      case 'pallet':
        return row.palletLabel;
      case 'type':
        return row.typeLabel;
      case 'status':
        return row.statusLabel;
      case 'lastUpdate':
        return row.lastUpdateLabel;
      case 'location':
        return row.locationLabel;
      case 'daysOut':
        return String(row.daysOut);
      case 'overdueDays':
        return String(row.overdueDays);
      case 'debt':
        return row.debtLabel;
    }
  };

  const getSortValue = (row: PalletRow, key: SortKey) => {
    switch (key) {
      case 'lastUpdate':
        return row.lastUpdateValue;
      case 'daysOut':
        return row.daysOut;
      case 'overdueDays':
        return row.overdueDays;
      case 'debt':
        return row.debt;
      default:
        return getFilterValue(row, key);
    }
  };

  const filterOptions = useMemo(
    () =>
      Object.fromEntries(
        COLUMN_ORDER.map((key) => [
          key,
          Array.from(new Set<string>(rows.map((row) => getFilterValue(row, key))))
            .sort((left, right) =>
              left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
            )
            .map((value) => ({ value, label: value })),
        ])
      ) as Record<SortKey, Array<{ value: string; label: string }>>,
    [rows]
  );

  const filteredRows = useMemo(() => {
    const nextRows = rows.filter((row) =>
      COLUMN_ORDER.every((key) => {
        const selectedValues = selectedFilters[key];
        return selectedValues.length === 0 || selectedValues.includes(getFilterValue(row, key));
      })
    );

    nextRows.sort((left, right) => {
      const leftValue = getSortValue(left, sortConfig.key);
      const rightValue = getSortValue(right, sortConfig.key);
      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, {
              numeric: true,
              sensitivity: 'base',
            });

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return nextRows;
  }, [rows, selectedFilters, sortConfig]);

  const selectedPalletHistory = useMemo<AuditLog[]>(() => {
    if (!selectedPallet) {
      return [];
    }

    return auditLogs
      .filter(
        (log) =>
          log.pallet_id === selectedPallet.pallet.id &&
          (log.type || 'status') === 'status'
      )
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      );
  }, [auditLogs, selectedPallet]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!tableRef.current?.contains(target) && !filterMenuRef.current?.contains(target)) {
        setOpenFilterKey(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
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
      const width = openFilterKey === 'location' ? 320 : 248;
      const viewportPadding = 12;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, viewportPadding),
        window.innerWidth - width - viewportPadding
      );
      const top = rect.bottom + 8;

      setFilterMenuStyle({
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
  }, [openFilterKey]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const toggleFilterSelection = (key: SortKey, value: string) => {
    setSelectedFilters((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  const clearColumnFilter = (key: SortKey) => {
    setSelectedFilters((current) => ({ ...current, [key]: [] }));
    setFilterSearch((current) => ({ ...current, [key]: '' }));
  };

  const renderSortButton = (key: SortKey, label: string) => {
    const isActive = sortConfig.key === key;

    return (
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
        <ArrowUpDown
          size={13}
          className={cn('shrink-0 transition-transform', isActive && sortConfig.direction === 'desc' && 'rotate-180')}
        />
      </button>
    );
  };

  const renderFilterMenu = (key: SortKey) => {
    if (openFilterKey !== key || !filterMenuStyle) {
      return null;
    }

    const query = filterSearch[key].toLowerCase();
    const visibleOptions = filterOptions[key].filter(
      (option) =>
        !query ||
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
    );

    return (
      <div
        ref={filterMenuRef}
        style={filterMenuStyle}
        className="fixed z-30 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.28)]"
      >
        <Input
          value={filterSearch[key]}
          onChange={(event) =>
            setFilterSearch((current) => ({ ...current, [key]: event.target.value }))
          }
          placeholder={searchPlaceholder}
          className="h-10 bg-white px-3 text-left text-[12px] normal-case tracking-normal"
        />
        <button
          type="button"
          onClick={() => clearColumnFilter(key)}
          className="mt-2 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 hover:bg-zinc-50"
        >
          <span>{showAllLabel}</span>
          <RotateCcw size={12} />
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/50 p-1">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <label
                key={`${key}-${option.value}`}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-bold',
                  selectedFilters[key].includes(option.value)
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-zinc-700 hover:bg-white'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedFilters[key].includes(option.value)}
                  onChange={() => toggleFilterSelection(key, option.value)}
                  className="h-4 w-4 rounded border-zinc-300 text-[#00A655] focus:ring-[#00A655]"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </label>
            ))
          ) : (
            <p className="px-2.5 py-3 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
              {noResultsLabel}
            </p>
          )}
        </div>
      </div>
    );
  };

  const headerConfig: Record<SortKey, { label: string }> = {
    pallet: { label: palletLabel },
    type: { label: t('type') },
    status: { label: t('status') },
    lastUpdate: { label: lastUpdateLabel },
    location: { label: t('location') },
    daysOut: { label: daysOutLabel },
    overdueDays: { label: overdueDaysLabel },
    debt: { label: debtLabel },
  };

  return (
    <>
      <div className="mb-4 grid items-stretch gap-3 xl:grid-cols-12 [&>.client-summary-card]:xl:col-span-3">
        {summaryCards}
      </div>

      <AdminTableStickyToolbar className="mb-3 py-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#101715]">
          <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200">
            <Package size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-zinc-950 dark:text-white">
              {pageTitle}
            </h2>
            <p className="mt-1 line-clamp-2 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              {pageSubtitle}
            </p>
          </div>
          </div>
          <div className="relative w-full sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 bg-white pl-10 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal dark:bg-[#151d1a]"
          />
          </div>
        </div>
      </AdminTableStickyToolbar>

      <AdminDataTable<SortKey>
        columnOrder={COLUMN_ORDER}
        initialColumnWidths={INITIAL_COLUMN_WIDTHS}
        minColumnWidths={MIN_COLUMN_WIDTHS}
        resizeAriaLabel={resizeAriaLabel}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isInitialLoading && filteredRows.length === 0}
        emptyState={
          <div className="p-20 text-center">
            <Search size={20} className="mx-auto mb-4 text-zinc-200" />
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
              {t('noMatchingResults')}
            </p>
          </div>
        }
        renderTable={({ columnWidths, totalTableWidth, registerHeaderCell, renderResizeHandle }) => (
          <table
            className="border-collapse text-left [table-layout:fixed]"
            style={{ width: `max(100%, ${totalTableWidth}px)` }}
          >
            <colgroup>
              {COLUMN_ORDER.map((key) => (
                <col key={`client-pallet-col-${key}`} style={{ width: columnWidths[key] }} />
              ))}
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80">
              <tr>
                {COLUMN_ORDER.map((key) => (
                    <th
                      key={`client-pallet-header-${key}`}
                      ref={registerHeaderCell(key)}
                      className={cn(headerCellClass, 'group')}
                    >
                      <div className={headerContentClass}>
                        {renderSortButton(key, headerConfig[key].label)}
                      </div>
                      {renderResizeHandle(key)}
                    </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map((row) => (
                <tr
                  key={`client-pallet-row-${row.pallet.id}`}
                  onClick={() => setSelectedPallet(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedPallet(row);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="group cursor-pointer transition-colors hover:bg-zinc-50/60 focus-visible:bg-zinc-50/80 focus-visible:outline-none"
                >
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900')}>{row.palletLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'uppercase text-zinc-600')}>{row.typeLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <Badge
                        variant={
                          row.pallet.current_status_id === 7
                            ? 'danger'
                            : row.pallet.current_status_id === 4
                              ? 'success'
                              : 'info'
                        }
                        className="min-h-[1.875rem] rounded-lg px-2.5 py-1 text-[11px] font-bold normal-case"
                      >
                        {row.statusLabel}
                      </Badge>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500')}>{row.lastUpdateLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500')}>{row.locationLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900')}>{row.daysOut}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, row.overdueDays > 0 ? 'text-rose-600' : 'text-zinc-400')}>
                        {row.overdueDays}
                      </span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, row.debt > 0 ? 'text-rose-600' : 'text-zinc-400')}>
                        {row.debtLabel}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      />

      <PageLoadingModal isOpen={isInitialLoading} language={language} />

      <div className="mt-3">
        <InfiniteScrollFooter hasMore={hasMore} isLoading={isLoadingMore} error={paginationError} onLoadMore={loadMore} onRetry={retry} language={language} />
      </div>

      {openFilterKey && renderFilterMenu(openFilterKey)}

      {selectedPallet && (
        <div
          className="modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4"
          onClick={() => setSelectedPallet(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[3rem] bg-white p-8 shadow-2xl no-scrollbar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute left-0 right-0 top-0 h-2 bg-black" />

            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h3 className="mb-1 text-3xl font-black uppercase tracking-tighter">
                  {selectedPallet.palletLabel}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {selectedPallet.typeLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPallet(null)}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                aria-label={t('closeDetails')}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-gray-50 p-4">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {t('location')}
                </span>
                <p className="text-xs font-black uppercase">{selectedPallet.locationLabel}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {t('status')}
                </span>
                <p className="text-xs font-black uppercase text-blue-600">{selectedPallet.statusLabel}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {daysOutLabel}
                </span>
                <p className="text-xs font-black">{selectedPallet.daysOut}</p>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl bg-gray-50 p-4">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {overdueDaysLabel}
                </span>
                <p className="text-xs font-black">{selectedPallet.overdueDays}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {debtLabel}
                </span>
                <p className={cn('text-xs font-black', selectedPallet.debt > 0 ? 'text-rose-600' : 'text-zinc-900')}>
                  {selectedPallet.debtLabel}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {lastUpdateLabel}
                </span>
                <p className="text-xs font-black uppercase">{selectedPallet.lastUpdateLabel}</p>
              </div>
            </div>

            <div className="mb-8 space-y-4">
              <h4 className="ml-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                {movementHistoryLabel}
              </h4>
              <div className="max-h-[220px] space-y-2 overflow-y-auto no-scrollbar">
                {selectedPalletHistory.map((log) => (
                  <div
                    key={`client-pallet-history-${log.id}`}
                    className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-50">
                      <MapPin size={16} className="text-gray-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black uppercase tracking-tight text-gray-900">
                        {getStatusLabel(log.new_status_name, language)}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-gray-500">
                        {log.new_location || '-'}
                      </p>
                      <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                        {changedByLabel}: {log.made_by_user_name || `#${log.made_by_user_id}`}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                        <Clock3 size={12} />
                        <span>{dateFormatter.format(new Date(log.created_at))}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {selectedPalletHistory.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {noHistoryLabel}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {selectedPallet.pallet.note && (
              <div className="mb-8 rounded-2xl bg-gray-50 p-4">
                <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400">
                  {language === 'bs' ? 'Komentar' : language === 'nl' ? 'Commentaar' : 'Comment'}
                </span>
                <p className="text-xs font-bold text-zinc-700">{selectedPallet.pallet.note}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedPallet(null)}
              className="w-full rounded-2xl bg-black py-4 text-xs font-black uppercase text-white shadow-xl shadow-black/10"
            >
              {t('closeDetails')}
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
};
