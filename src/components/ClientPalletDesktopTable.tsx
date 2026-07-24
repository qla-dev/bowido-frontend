import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpDown,
  ChevronDown,
  Clock3,
  Funnel,
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
import { formatAppDate } from '../lib/dateFormat';
import { DeliveryLocationMap } from './DeliveryLocationMap';
import { DriverModalShell } from './DriverModalShell';

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
  'location',
  'lastUpdate',
  'daysOut',
  'overdueDays',
  'debt',
] as const satisfies readonly SortKey[];

const INITIAL_COLUMN_WIDTHS: Record<SortKey, number> = {
  pallet: 170,
  type: 145,
  status: 170,
  location: 230,
  lastUpdate: 150,
  daysOut: 135,
  overdueDays: 150,
  debt: 140,
};

const MIN_COLUMN_WIDTHS: Record<SortKey, number> = {
  pallet: 145,
  type: 120,
  status: 145,
  location: 190,
  lastUpdate: 130,
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
  const { pallets: cachedPallets, statuses, t, language, updatePallet, updatePalletStatus, savePalletDeliveryLocation } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const locationMenuRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<SortKey, HTMLTableCellElement | null>>>({});
  const locationButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [gpsLocationPallet, setGpsLocationPallet] = useState<Pallet | null>(null);
  // Details are now shown directly in the list. Kept null so legacy detail markup
  // remains inert until it is removed in the next table cleanup.
  const selectedPallet: PalletRow | null = null;
  const selectedPalletHistory: AuditLog[] = [];
  const setSelectedPallet = (_pallet: PalletRow | null) => undefined;
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
  const [openLocationMenuPalletId, setOpenLocationMenuPalletId] = useState<number | null>(null);
  const [locationMenuStyle, setLocationMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
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
        formatAppDate(value, language),
    }),
    [language]
  );
  const searchPlaceholder =
    language === 'bs' ? 'Pretraži' : language === 'nl' ? 'Zoeken' : 'Search';
  const showAllLabel =
    language === 'bs' ? 'Prikaži sve' : language === 'nl' ? 'Alles tonen' : 'Show all';
  const noResultsLabel =
    language === 'bs' ? 'Nema rezultata' : language === 'nl' ? 'Geen resultaten' : 'No results';
  const daysOutLabel = language === 'bs' ? 'Povrat' : language === 'nl' ? 'Retour' : 'Return';
  const overdueDaysLabel = language === 'bs' ? 'Rok' : language === 'nl' ? 'Termijn' : 'Term';
  const debtLabel =
    language === 'bs' ? 'Iznos duga' : language === 'nl' ? 'Schuldbedrag' : 'Debt amount';
  const lastUpdateLabel = language === 'bs' ? 'Poslano' : language === 'nl' ? 'Verzonden' : 'Sent';
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
  const warehouseOneLabel = language === 'bs' ? 'Magacin 1' : language === 'nl' ? 'Magazijn 1' : 'Warehouse 1';
  const warehouseTwoLabel = language === 'bs' ? 'Magacin 2' : language === 'nl' ? 'Magazijn 2' : 'Warehouse 2';
  const otherLocationLabel = language === 'bs' ? 'Druga lokacija' : language === 'nl' ? 'Andere locatie' : 'Other location';
  const mapLocationLabel = language === 'bs' ? 'Odaberite lokaciju na mapi' : language === 'nl' ? 'Kies locatie op kaart' : 'Choose location on map';
  const movementHistoryLabel = language === 'bs' ? 'Historija kretanja' : language === 'nl' ? 'Bewegingsgeschiedenis' : 'Movement history';
  const changedByLabel = language === 'bs' ? 'Promijenio' : language === 'nl' ? 'Gewijzigd door' : 'Changed by';
  const noHistoryLabel = language === 'bs' ? 'Nema historije kretanja.' : language === 'nl' ? 'Geen bewegingsgeschiedenis.' : 'No movement history.';
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
    queryKey: `${client.user_id}|${debouncedSearchQuery}|${sortConfig.key}|${sortConfig.direction}`,
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

  const getDaysSince = (date: string) => {
    const changedAt = new Date(date);
    const changedAtMidnight = new Date(changedAt.getFullYear(), changedAt.getMonth(), changedAt.getDate());
    const today = new Date();
    const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.floor((todayAtMidnight.getTime() - changedAtMidnight.getTime()) / (24 * 60 * 60 * 1000)));
  };

  const rows = useMemo<PalletRow[]>(
    () =>
      pallets
        .filter((pallet) => pallet.user_id === client.user_id)
        .map((pallet) => {
          const status = statuses.find((item) => item.id === pallet.current_status_id);
          const daysOut = getDaysSince(pallet.last_status_changed_at);
          const graceDays = status?.is_billable ? client.grace_period_days : 0;
          const overdueDays = graceDays > 0 ? Math.max(daysOut - graceDays, 0) : 0;
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

  const returnStatus = statuses.find((status) => status.slug === 'ophalen-klant' || status.name.toLowerCase() === 'ophalen klant') || statuses.find((status) => status.id === 5);
  const atClientStatus = statuses.find((status) => status.slug === 'bij-de-klant' || status.name.toLowerCase() === 'bij de klant') || statuses.find((status) => status.id === 4);
  const updateLocation = (pallet: Pallet, location: string) => {
    const nextLocation = location.trim();
    if (!nextLocation || nextLocation === pallet.current_location) return;
    updatePallet({ ...pallet, current_location: nextLocation });
  };

  const getTimelineInfo = (row: PalletRow) => {
    const status = statuses.find((item) => item.id === row.pallet.current_status_id);
    const graceDays = status?.is_billable ? client.grace_period_days : 0;
    if (graceDays <= 0) return { returnLabel: '-', deadlineLabel: '-', tone: 'muted' as const };

    const changedAt = new Date(row.pallet.last_status_changed_at);
    const dueDate = new Date(changedAt.getFullYear(), changedAt.getMonth(), changedAt.getDate());
    dueDate.setDate(dueDate.getDate() + graceDays);
    const remainingDays = graceDays - row.daysOut;
    return {
      returnLabel: dateFormatter.format(dueDate),
      deadlineLabel: remainingDays < 0
        ? `${Math.abs(remainingDays)} ${language === 'bs' ? 'dana kasni' : language === 'nl' ? 'dagen te laat' : 'days late'}`
        : `${remainingDays} ${language === 'bs' ? 'dana preostalo' : language === 'nl' ? 'dagen over' : 'days left'}`,
      tone: remainingDays < 0 ? 'danger' as const : remainingDays <= 2 ? 'warning' as const : 'success' as const,
    };
  };

  const warehouseLocations = [
    {
      label: warehouseOneLabel,
      fields: [client.warehouse1_street, client.warehouse1_house_number, client.warehouse1_postal_code, client.warehouse1_city],
      address: [[client.warehouse1_street, client.warehouse1_house_number].filter(Boolean).join(' '), [client.warehouse1_postal_code, client.warehouse1_city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    },
    {
      label: warehouseTwoLabel,
      fields: [client.warehouse2_street, client.warehouse2_house_number, client.warehouse2_postal_code, client.warehouse2_city],
      address: [[client.warehouse2_street, client.warehouse2_house_number].filter(Boolean).join(' '), [client.warehouse2_postal_code, client.warehouse2_city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    },
  ].filter((warehouse) => warehouse.fields.some((field) => field?.trim()));

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!tableRef.current?.contains(target) && !filterMenuRef.current?.contains(target)) {
        setOpenFilterKey(null);
      }
      if (!tableRef.current?.contains(target) && !locationMenuRef.current?.contains(target)) {
        setOpenLocationMenuPalletId(null);
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

  useEffect(() => {
    if (openLocationMenuPalletId === null) {
      setLocationMenuStyle(null);
      return;
    }

    const updatePosition = () => {
      const button = locationButtonRefs.current[openLocationMenuPalletId];
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const width = Math.min(360, Math.max(260, rect.width));
      const viewportPadding = 12;
      setLocationMenuStyle({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - width - viewportPadding),
        width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [openLocationMenuPalletId]);

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

  const selectLocation = (pallet: Pallet, location: string) => {
    setOpenLocationMenuPalletId(null);
    if (location === '__other__') {
      setGpsLocationPallet(pallet);
      return;
    }
    updateLocation(pallet, location);
  };

  const getLocationOptions = (pallet: Pallet) => {
    const options = warehouseLocations.map((warehouse) => ({
      value: warehouse.address,
      label: `${warehouse.label}: ${warehouse.address}`,
    }));
    if (pallet.current_location && !options.some((option) => option.value === pallet.current_location)) {
      options.unshift({ value: pallet.current_location, label: pallet.current_location });
    }
    return options;
  };

  const renderLocationMenu = () => {
    if (openLocationMenuPalletId === null || !locationMenuStyle) return null;
    const pallet = filteredRows.find((row) => row.pallet.id === openLocationMenuPalletId)?.pallet;
    if (!pallet) return null;

    return (
      <div
        ref={locationMenuRef}
        style={locationMenuStyle}
        className="fixed z-40 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-1.5 shadow-[0_18px_40px_-18px_rgba(0,82,48,0.32)] dark:border-emerald-300/15 dark:bg-[#151d1a]"
      >
        <p className="px-2.5 pb-1 pt-1 text-[9px] font-black uppercase tracking-[0.13em] text-emerald-600 dark:text-emerald-200">
          {language === 'bs' ? 'Odaberite lokaciju' : language === 'nl' ? 'Kies locatie' : 'Choose location'}
        </p>
        {getLocationOptions(pallet).map((option) => {
          const isSelected = option.value === pallet.current_location;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectLocation(pallet, option.value)}
              className={cn(
                'flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-bold leading-4 transition-colors',
                isSelected
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-100'
                  : 'text-zinc-700 hover:bg-emerald-50/80 dark:text-zinc-100 dark:hover:bg-white/5'
              )}
            >
              <MapPin size={14} className="shrink-0 text-emerald-600 dark:text-emerald-200" />
              <span className="min-w-0 break-words">{option.label}</span>
              {isSelected && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#00A655]" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => selectLocation(pallet, '__other__')}
          className="mt-1 flex w-full items-center gap-2 rounded-xl border-t border-emerald-100 px-2.5 py-2.5 text-left text-[11px] font-black text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-white/10 dark:text-emerald-100 dark:hover:bg-white/5"
        >
          <MapPin size={14} className="shrink-0" />
          {otherLocationLabel}
        </button>
      </div>
    );
  };

  const renderSortButton = (key: SortKey, label: string) => {
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
                <React.Fragment key={`client-pallet-row-${row.pallet.id}`}>
                <tr className="group transition-colors hover:bg-zinc-50/60">
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
                        {(row.pallet.current_status_id === atClientStatus?.id || row.pallet.current_status_id === returnStatus?.id) ? (
                          <button
                            type="button"
                            onClick={() => {
                              const nextStatus = row.pallet.current_status_id === atClientStatus?.id ? returnStatus : atClientStatus;
                              if (nextStatus) updatePalletStatus(row.pallet.id, nextStatus.id, client.user_id, client.name, row.pallet.current_location, undefined, client.user_id);
                            }}
                            title={language === 'bs' ? 'Zatraži povrat' : language === 'nl' ? 'Retour aanvragen' : 'Request return'}
                            className="-my-1 -mx-1 rounded px-1 py-1 text-left underline-offset-2 hover:underline"
                          >
                            {row.statusLabel}
                          </button>
                        ) : row.statusLabel}
                      </Badge>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={cn(bodyCellInnerClass, 'relative')}>
                      <button
                        ref={(element) => { locationButtonRefs.current[row.pallet.id] = element; }}
                        type="button"
                        onClick={() => setOpenLocationMenuPalletId((current) => current === row.pallet.id ? null : row.pallet.id)}
                        aria-haspopup="menu"
                        aria-expanded={openLocationMenuPalletId === row.pallet.id}
                        className="flex h-9 w-full items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 py-1 pl-2.5 pr-2 text-left text-[11px] font-black text-emerald-950 shadow-sm outline-none transition-colors hover:border-emerald-200 hover:bg-emerald-50 focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 dark:border-emerald-300/15 dark:bg-emerald-400/10 dark:text-emerald-50 dark:hover:bg-emerald-400/15 dark:focus:bg-[#151d1a]"
                      >
                        <MapPin size={13} className="shrink-0 text-emerald-600 dark:text-emerald-200" />
                        <span className="min-w-0 flex-1 truncate">
                          {getLocationOptions(row.pallet).find((option) => option.value === row.pallet.current_location)?.label || otherLocationLabel}
                        </span>
                        <ChevronDown size={14} className={cn('shrink-0 text-emerald-600 transition-transform dark:text-emerald-200', openLocationMenuPalletId === row.pallet.id && 'rotate-180')} />
                      </button>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500')}>{row.lastUpdateLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900')}>{getTimelineInfo(row).returnLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'flex items-center gap-1.5', getTimelineInfo(row).tone === 'danger' ? 'text-rose-600' : getTimelineInfo(row).tone === 'warning' ? 'text-amber-600' : 'text-emerald-600')}>
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', getTimelineInfo(row).tone === 'danger' ? 'bg-rose-500' : getTimelineInfo(row).tone === 'warning' ? 'bg-amber-500' : getTimelineInfo(row).tone === 'success' ? 'bg-emerald-500' : 'bg-zinc-300')} />
                        {getTimelineInfo(row).deadlineLabel}
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
                </React.Fragment>
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
      {renderLocationMenu()}

      {gpsLocationPallet && (
        <DriverModalShell
          onClose={() => setGpsLocationPallet(null)}
          title={otherLocationLabel}
          subtitle={mapLocationLabel}
          width="lg"
          bodyClassName="p-4"
        >
          <DeliveryLocationMap
            palletId={gpsLocationPallet.id}
            language={language}
            initialLocation={gpsLocationPallet.delivery_location}
            onSave={async (palletId, data) => {
              const savedLocation = await savePalletDeliveryLocation(palletId, data);
              setGpsLocationPallet(null);
              return savedLocation;
            }}
          />
        </DriverModalShell>
      )}

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
