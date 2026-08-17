import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
  Clock3,
  Edit,
  Funnel,
  List,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Search,
  Smartphone,
  Table2,
  Undo2,
} from 'lucide-react';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { AdminTableStickyToolbar } from './AdminTableStickyToolbar';
import { ClientPalletDesktopTable } from './ClientPalletDesktopTable';
import { DriverModalShell } from './DriverModalShell';
import { NoQrReturnFormModal } from './NoQrReturnFormModal';
import { Button, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { ClientDetail, Pallet, RoleType } from '../types';
import { formatServiceReportDescription, getLocationLabel, getPalletTypeLabel, getStatusLabel } from '../i18n';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService } from '../services/api';
import { getPalletDisplayName } from '../lib/palletDisplay';
import { useInfinitePagination } from '../hooks/useInfinitePagination';
import { formatAppDate } from '../lib/dateFormat';
import { rankSearchResults } from '../lib/searchRanking';

type SortKey =
  | 'client'
  | 'kvk'
  | 'warehouses'
  | 'rate'
  | 'overdueTotal'
  | 'atClient'
  | 'returnReports';
type ColumnKey = SortKey | 'actions';
type SortDirection = 'asc' | 'desc';

type FilterOption = {
  value: string;
  label: string;
};

type ClientTableRow = {
  client: ClientDetail;
  clientName: string;
  kvkLabel: string;
  warehouseAddresses: string[];
  warehousesLabel: string;
  rateLabel: string;
  rateValue: number;
  overdueTotalLabel: string;
  overdueTotalValue: number;
  atClientLabel: string;
  atClientCount: number;
  returnReportsLabel: string;
  returnReportsCount: number;
};

type FilterSelections = Record<SortKey, string[]>;
type FilterSearch = Record<SortKey, string>;
type MobilePalletListView = 'withQr' | 'withoutQr';
type MobilePalletDisplayMode = 'compact' | 'full';

type MobileClientPalletItem = {
  pallet: Pallet;
  daysOutside: number;
  overdueDays: number;
  overdueCost: number;
};

const isAtClientStatus = (pallet: Pallet) =>
  pallet.current_status_id === 4 ||
  ['bij-de-klant', 'at_customer', 'at-client'].includes(pallet.current_status_slug || '');

const isCustomerPickupStatus = (pallet: Pallet) =>
  pallet.current_status_id === 5 ||
  ['ophalen-klant', 'pending_return'].includes(pallet.current_status_slug || '');

const isClientPossessionStatus = (pallet: Pallet) =>
  isAtClientStatus(pallet) || isCustomerPickupStatus(pallet);

const CLIENT_TABLE_COLUMN_ORDER = [
  'kvk',
  'warehouses',
  'rate',
  'overdueTotal',
  'atClient',
  'returnReports',
  'actions',
] as const satisfies readonly ColumnKey[];

const INITIAL_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  client: 176,
  kvk: 176,
  warehouses: 176,
  rate: 176,
  overdueTotal: 176,
  atClient: 176,
  returnReports: 176,
  actions: 176,
};

const MIN_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  client: 160,
  kvk: 132,
  warehouses: 180,
  rate: 140,
  overdueTotal: 160,
  atClient: 148,
  returnReports: 156,
  actions: 92,
};

const CLIENT_PAGE_SIZE = 25;
const SERVER_SORT_BY_KEY: Partial<Record<SortKey, string>> = {
  client: 'client',
  kvk: 'kvk',
  warehouses: 'warehouses',
  rate: 'rate',
};

interface ClientTableViewProps {
  onAddClient?: () => void;
  onEditClient?: (client: ClientDetail) => void;
  clientIdFilter?: number;
}

export const ClientTableView: React.FC<ClientTableViewProps> = ({ onAddClient, onEditClient, clientIdFilter }) => {
  const { clients: cachedClients, pallets, statuses, t, language } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'client',
    direction: 'asc',
  });
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(max-width: 767px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleResize = () => setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchPage = useCallback((offset: number) => apiService.clients.page({
    limit: clientIdFilter === undefined ? CLIENT_PAGE_SIZE : 1,
    offset: clientIdFilter === undefined ? offset : 0,
    user_id: clientIdFilter,
    search: clientIdFilter === undefined ? debouncedSearchQuery || undefined : undefined,
    sort_by: clientIdFilter === undefined ? SERVER_SORT_BY_KEY[sortConfig.key] : undefined,
    sort_direction: sortConfig.direction,
  }), [clientIdFilter, debouncedSearchQuery, sortConfig]);
  const { items: clients, hasMore, isInitialLoading, isLoadingMore, error: paginationError, loadMore, retry, setItems: setPagedClients } = useInfinitePagination({
    queryKey: `${clientIdFilter ?? 'all'}|${debouncedSearchQuery}|${sortConfig.key}|${sortConfig.direction}`,
    pageSize: clientIdFilter === undefined ? CLIENT_PAGE_SIZE : 1,
    fetchPage,
  });

  useEffect(() => {
    if (cachedClients.length === 0) {
      return;
    }

    setPagedClients((current) =>
      current.map((client) => cachedClients.find((cachedClient) => cachedClient.id === client.id) || client)
    );
  }, [cachedClients]);

  const filteredClients = useMemo(() => {
    if (clientIdFilter !== undefined) {
      return clients.filter(c => c.user_id === clientIdFilter);
    }
    return clients;
  }, [clients, clientIdFilter]);

  const columnOrder = useMemo<readonly ColumnKey[]>(() => {
    if (clientIdFilter !== undefined) {
      return CLIENT_TABLE_COLUMN_ORDER.filter(col => col !== 'actions');
    }
    return CLIENT_TABLE_COLUMN_ORDER;
  }, [clientIdFilter]);

  const tableRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<ColumnKey, HTMLTableCellElement | null>>>({});
  const {
    headerCellClass,
    headerContentClass,
    bodyCellClass,
    bodyCellInnerClass,
    bodyTextClass,
  } = adminTableStyles;
  const [selectedFilters, setSelectedFilters] = useState<FilterSelections>({
    client: [],
    kvk: [],
    warehouses: [],
    rate: [],
    overdueTotal: [],
    atClient: [],
    returnReports: [],
  });
  const [filterSearch, setFilterSearch] = useState<FilterSearch>({
    client: '',
    kvk: '',
    warehouses: '',
    rate: '',
    overdueTotal: '',
    atClient: '',
    returnReports: '',
  });
  const [openFilterKey, setOpenFilterKey] = useState<SortKey | null>(null);
  const [isDesktopReturnFormOpen, setIsDesktopReturnFormOpen] = useState(false);
  const [activeMobilePalletList, setActiveMobilePalletList] = useState<MobilePalletListView | null>(null);
  const [selectedMobilePallet, setSelectedMobilePallet] = useState<{
    item: MobileClientPalletItem;
    index: number;
    view: MobilePalletListView;
  } | null>(null);
  const [mobilePalletDisplayMode, setMobilePalletDisplayMode] = useState<MobilePalletDisplayMode>('compact');
  const [mobilePalletSearch, setMobilePalletSearch] = useState('');
  const [mobilePalletStatusFilter, setMobilePalletStatusFilter] = useState('all');
  const [showMobileRotateHint, setShowMobileRotateHint] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.localStorage.getItem('trackpal_mobile_pallet_rotate_hint_seen') !== '1';
  });
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const searchPlaceholder = t('search');
  const showAllLabel = t('showAll');
  const noResultsLabel = t('noResults');
  const warehousesHeaderLabel = t('warehouseAddresses');
  const overdueTotalHeaderLabel = t('overdueTotal');
  const atClientHeaderLabel = t('atClientLabel');
  const returnReportsHeaderLabel = t('returnReports');
  const mobileGracePeriodLabel = t('gracePeriodLabel');
  const mobileOverviewLabel = t('palletOverview');
  const mobileReportedPalletsLabel = t('reportedPallets');
  const mobileWithQrLabel = t('withQr');
  const mobileWithoutQrLabel = t('withoutQrCode');
  const mobileInUseLabel = t('inUse');
  const mobileForPickupLabel = t('forClientPickup');
  const mobilePalletsAtClientLabel = t('palletsAtClient');
  const mobileOverdueDaysLabel = t('totalOverdueDays');
  const mobileTotalDebtLabel = t('totalDebt');
  const reportReturnLabel = t('reportReturn');
  const mobileNoClientPalletsLabel = t('noClientPallets');
  const mobileNoQrListEmptyLabel = t('noQrPallets');
  const mobileWithQrListEmptyLabel = t('noPalletsWithQr');
  const mobileNoQrEmptyLabel = t('noQrReportedPallets');
  const mobilePalletNumberLabel = t('palletNumber');
  const mobileReturnDateLabel = t('returnDate');
  const mobileCommentLabel = t('comment');
  const mobileStatusVoorRetourLabel = t('forReturn');
  const mobileRotateHint =
    language === 'bs'
      ? 'Za bolji pregled okrenite telefon vodoravno.'
      : language === 'nl'
        ? 'Draai je telefoon voor een beter overzicht.'
        : 'For a better view, rotate your screen.';
  const mobileScrollHint =
    language === 'bs'
      ? 'Prevucite tabelu lijevo ili desno za sve kolone.'
      : language === 'nl'
        ? 'Veeg de tabel naar links of rechts om alle kolommen te zien.'
        : 'Swipe the table left or right to see every column.';
  const mobileOrientationLabel =
    language === 'bs'
      ? 'Okrenite uređaj za bolji pregled'
      : language === 'nl'
        ? 'Draai je apparaat voor een beter overzicht'
        : 'Rotate your device for a better view';
  const mobilePalletViewCopy =
    language === 'bs'
      ? {
          compact: 'Kompaktno',
          full: 'Puna tabela',
          search: 'Pretraži palete...',
          allStatuses: 'Svi statusi',
          timeInStatus: 'Vrijeme u statusu',
          days: 'dana',
          overdue: 'Prekoračeno',
          numberShort: 'Broj',
          locationShort: 'Lok.',
          daysShort: 'Dana',
          overdueShort: 'Kasni',
          dateShort: 'Datum',
          noMatches: 'Nema paleta koje odgovaraju filterima.',
        }
      : language === 'nl'
        ? {
            compact: 'Compact',
            full: 'Volledige tabel',
            search: 'Zoek bokken...',
            allStatuses: 'Alle statussen',
            timeInStatus: 'Tijd in status',
            days: 'dagen',
            overdue: 'Te laat',
            numberShort: 'Nr.',
            locationShort: 'Locatie',
            daysShort: 'Dagen',
            overdueShort: 'Te laat',
            dateShort: 'Datum',
            noMatches: 'Geen pallets gevonden voor deze filters.',
          }
        : {
            compact: 'Compact',
            full: 'Full table',
            search: 'Search pallets...',
            allStatuses: 'All statuses',
            timeInStatus: 'Time in status',
            days: 'days',
            overdue: 'Overdue',
            numberShort: 'No.',
            locationShort: 'Location',
            daysShort: 'Days',
            overdueShort: 'Late',
            dateShort: 'Date',
            noMatches: 'No pallets match these filters.',
          };
  const resizeAriaLabel = t('resizeColumn');
  const stickyActionsHeaderClass =
    'sticky right-0 z-20 border-l border-zinc-200 bg-zinc-50/95 shadow-[-14px_0_24px_-20px_rgba(15,23,42,0.45)] backdrop-blur';
  const stickyActionsCellClass =
    'sticky right-0 z-10 border-l border-zinc-100 bg-white/95 shadow-[-14px_0_24px_-20px_rgba(15,23,42,0.35)] backdrop-blur group-hover:bg-zinc-50/95';
  const textFilterInputClass =
    'h-10 bg-white px-3 text-left text-[12px] normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal';
  const currencyFormatter = new Intl.NumberFormat(language === 'nl' ? 'nl-NL' : 'en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const mobileDateFormatter = {
    format: (value: string | number | Date) => formatAppDate(value, language),
  };

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
      const width = openFilterKey === 'warehouses' ? 320 : 248;
      const viewportPadding = 12;
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - width / 2, viewportPadding),
        window.innerWidth - width - viewportPadding
      );
      const top = rect.bottom + 8;
      const maxHeight = Math.max(180, window.innerHeight - top - viewportPadding);

      setFilterMenuStyle({ top, left, width, maxHeight });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [openFilterKey]);

  const getDaysSince = (date: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));

  const getBillingStatus = (pallet: Pallet) =>
    statuses.find((item) => item.id === pallet.current_status_id);

  const getPalletOverdueDays = (pallet: Pallet, client: ClientDetail) => {
    const status = getBillingStatus(pallet);

    if (!status?.is_billable) {
      return 0;
    }

    return Math.max(getDaysSince(pallet.last_status_changed_at) - client.grace_period_days, 0);
  };

  const getPalletOverdueCost = (pallet: Pallet, client: ClientDetail) =>
    getPalletOverdueDays(pallet, client) * client.price_per_day;

  const rows = useMemo<ClientTableRow[]>(
    () =>
      filteredClients.map((client) => {
        const assignedClientPallets = pallets.filter(
          (pallet) => pallet.user_id === client.user_id,
        );
        const clientPallets = pallets.filter(
          (pallet) => pallet.user_id === client.user_id && pallet.has_qr_code && !pallet.is_ghost,
        );
        const returnReports = clientPallets.filter((pallet) => pallet.current_status_id === 5);
        const overdueTotalValue = clientPallets.reduce(
          (total, pallet) => total + getPalletOverdueCost(pallet, client),
          0
        );
        const warehouses = client.warehouse_addresses?.filter(Boolean) || [];

        return {
          client,
          clientName: client.name,
          kvkLabel: client.kvk_number || '-',
          warehouseAddresses: warehouses,
          warehousesLabel: warehouses.length > 0 ? warehouses.join(' | ') : '-',
          rateLabel: `EUR ${currencyFormatter.format(client.price_per_day)}`,
          rateValue: client.price_per_day,
          overdueTotalLabel: `EUR ${currencyFormatter.format(overdueTotalValue)}`,
          overdueTotalValue,
          atClientLabel: `${assignedClientPallets.length}`,
          atClientCount: assignedClientPallets.length,
          returnReportsLabel: `${returnReports.length}`,
          returnReportsCount: returnReports.length,
        };
      }),
    [currencyFormatter, filteredClients, pallets, statuses]
  );

  const getFilterValue = (row: ClientTableRow, key: SortKey) => {
    switch (key) {
      case 'client':
        return row.clientName;
      case 'kvk':
        return row.kvkLabel;
      case 'warehouses':
        return row.warehousesLabel;
      case 'rate':
        return row.rateLabel;
      case 'overdueTotal':
        return row.overdueTotalLabel;
      case 'atClient':
        return row.atClientLabel;
      case 'returnReports':
        return row.returnReportsLabel;
      default:
        return '';
    }
  };

  const getSortValue = (row: ClientTableRow, key: SortKey) => {
    switch (key) {
      case 'rate':
        return row.rateValue;
      case 'overdueTotal':
        return row.overdueTotalValue;
      case 'atClient':
        return row.atClientCount;
      case 'returnReports':
        return row.returnReportsCount;
      default:
        return getFilterValue(row, key);
    }
  };

  const filterOptions = useMemo<Record<SortKey, FilterOption[]>>(
    () => ({
      client: Array.from<string>(new Set(rows.map((row) => row.clientName)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      kvk: Array.from<string>(new Set(rows.map((row) => row.kvkLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      warehouses: Array.from<string>(new Set(rows.map((row) => row.warehousesLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      rate: Array.from<string>(new Set(rows.map((row) => row.rateLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      overdueTotal: Array.from<string>(new Set(rows.map((row) => row.overdueTotalLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      atClient: Array.from<string>(new Set(rows.map((row) => row.atClientLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
      returnReports: Array.from<string>(new Set(rows.map((row) => row.returnReportsLabel)))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
        .map((value) => ({ value, label: value })),
    }),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const nextRows = rows.filter((row) =>
      (Object.keys(selectedFilters) as SortKey[]).every((key) => {
        const selectedValues = selectedFilters[key];

        if (selectedValues.length === 0) {
          return true;
        }

        return selectedValues.includes(getFilterValue(row, key));
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

  const mobileClientRow = filteredRows[0] || null;

  const mobileClientPallets = useMemo<MobileClientPalletItem[]>(() => {
    if (!mobileClientRow) {
      return [];
    }

    return pallets
      .filter((pallet) => pallet.user_id === mobileClientRow.client.user_id && pallet.has_qr_code && !pallet.is_ghost)
      .map((pallet) => ({
        pallet,
        daysOutside: getDaysSince(pallet.last_status_changed_at),
        overdueDays: getPalletOverdueDays(pallet, mobileClientRow.client),
        overdueCost: getPalletOverdueCost(pallet, mobileClientRow.client),
      }))
      .sort((left, right) => {
        if (right.overdueCost !== left.overdueCost) {
          return right.overdueCost - left.overdueCost;
        }

        return (
          new Date(right.pallet.last_status_changed_at).getTime() -
          new Date(left.pallet.last_status_changed_at).getTime()
        );
      });
  }, [mobileClientRow, pallets, statuses]);

  const mobileQrPallets = useMemo(
    () => mobileClientPallets,
    [mobileClientPallets]
  );

  const mobileNoQrPallets = useMemo<MobileClientPalletItem[]>(() => {
    if (!mobileClientRow) {
      return [];
    }

    return pallets
      .filter(
        (pallet) =>
          pallet.user_id === mobileClientRow.client.user_id &&
          pallet.is_ghost &&
          isClientPossessionStatus(pallet),
      )
      .map((pallet) => ({
        pallet,
        daysOutside: getDaysSince(pallet.last_status_changed_at),
        overdueDays: getPalletOverdueDays(pallet, mobileClientRow.client),
        overdueCost: getPalletOverdueCost(pallet, mobileClientRow.client),
      }))
      .sort(
        (left, right) =>
          new Date(right.pallet.last_status_changed_at).getTime() -
          new Date(left.pallet.last_status_changed_at).getTime(),
      );
  }, [mobileClientRow, pallets, statuses]);

  const mobileClientStatusCounts = useMemo(() => {
    const clientPallets = mobileClientRow
      ? pallets.filter((pallet) => pallet.user_id === mobileClientRow.client.user_id)
      : [];

    return {
      inUse: clientPallets.filter(isAtClientStatus).length,
      forPickup: clientPallets.filter(isCustomerPickupStatus).length,
    };
  }, [mobileClientRow, pallets]);

  const mobileTotalOverdueDays = mobileClientPallets.reduce(
    (total, item) => total + item.overdueDays,
    0
  );

  const unfilteredActiveMobilePalletItems =
    activeMobilePalletList === 'withoutQr' ? mobileNoQrPallets : mobileQrPallets;
  const mobilePalletStatusOptions = useMemo(() => {
    const options = new Map<string, string>();

    unfilteredActiveMobilePalletItems.forEach(({ pallet }) => {
      options.set(
        String(pallet.current_status_id),
        pallet.is_ghost
          ? mobileStatusVoorRetourLabel
          : getStatusLabel(pallet.current_status_name, language),
      );
    });

    return Array.from(options, ([value, label]) => ({ value, label })).sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
    );
  }, [language, mobileStatusVoorRetourLabel, unfilteredActiveMobilePalletItems]);
  const activeMobilePalletItems = useMemo(() => {
    const normalizedSearch = mobilePalletSearch.trim().toLocaleLowerCase();

    return unfilteredActiveMobilePalletItems.filter(({ pallet }) => {
      if (
        mobilePalletStatusFilter !== 'all' &&
        String(pallet.current_status_id) !== mobilePalletStatusFilter
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        getPalletDisplayName(pallet),
        pallet.qr_code,
        pallet.current_status_name,
        pallet.current_location,
        pallet.note,
      ].some((value) => String(value || '').toLocaleLowerCase().includes(normalizedSearch));
    });
  }, [mobilePalletSearch, mobilePalletStatusFilter, unfilteredActiveMobilePalletItems]);
  const activeMobilePalletTitle =
    activeMobilePalletList === 'withoutQr' ? mobileWithoutQrLabel : mobileWithQrLabel;
  const activeMobilePalletEmptyLabel =
    activeMobilePalletList === 'withoutQr' ? mobileNoQrEmptyLabel : mobileWithQrListEmptyLabel;
  const getMobilePalletDate = (item: MobileClientPalletItem) =>
    mobileDateFormatter.format(
      new Date(item.pallet.is_ghost ? item.pallet.created_at : item.pallet.last_status_changed_at)
    );
  const closeMobilePalletListModal = () => {
    setActiveMobilePalletList(null);
    setSelectedMobilePallet(null);
    setShowMobileRotateHint(false);
  };
  const openMobilePalletListModal = (view: MobilePalletListView) => {
    setMobilePalletDisplayMode('compact');
    setMobilePalletSearch('');
    setMobilePalletStatusFilter('all');
    setSelectedMobilePallet(null);
    setActiveMobilePalletList(view);
  };

  useEffect(() => {
    if (!activeMobilePalletList || !showMobileRotateHint || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('trackpal_mobile_pallet_rotate_hint_seen', '1');
    const timeoutId = window.setTimeout(() => setShowMobileRotateHint(false), 3200);

    return () => window.clearTimeout(timeoutId);
  }, [activeMobilePalletList, showMobileRotateHint]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const toggleFilterSelection = (key: SortKey, value: string) => {
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

  const clearColumnFilter = (key: SortKey) => {
    setSelectedFilters((current) => ({ ...current, [key]: [] }));
    setFilterSearch((current) => ({ ...current, [key]: '' }));
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

    const visibleOptions = rankSearchResults(
      filterOptions[key],
      filterSearch[key],
      (option) => option.label,
      (option, query) => option.value.toLocaleLowerCase().includes(query),
    );

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
            onClick={() => setSelectedFilters((current) => ({
              ...current,
              [key]: filterOptions[key].every((option) => current[key].includes(option.value))
                ? []
                : filterOptions[key].map((option) => option.value),
            }))}
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

  if (isMobile && clientIdFilter !== undefined) {
    return (
      <div className="space-y-4">
        {!mobileClientRow ? (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-12 text-center dark:border-white/10 dark:bg-[#151d1a]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#101715]">
              <Search size={18} className="text-zinc-300 dark:text-[#9fcbb3]" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
              {t('noMatchingResults')}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 px-1">
              <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                {mobileOverviewLabel}
              </p>
              <h4 className="mt-2 truncate text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                {mobileClientRow.clientName}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-white/10 dark:bg-[#151d1a]">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                  {mobileGracePeriodLabel}
                </p>
                <p className="mt-2 text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.client.grace_period_days} {t('days')}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-white/10 dark:bg-[#151d1a]">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                  {t('pricePerDayLabel')}
                </p>
                <p className="mt-2 text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.rateLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-white/10 dark:bg-[#151d1a]">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                  {mobilePalletsAtClientLabel}
                </p>
                <p className="mt-2 text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.atClientLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3 dark:border-white/10 dark:bg-[#151d1a]">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                  {mobileOverdueDaysLabel}
                </p>
                <p className="mt-2 text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileTotalOverdueDays}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-100 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-[#151d1a]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-white text-zinc-500 dark:border-white/10 dark:bg-[#101715] dark:text-[#d5f1de]">
                  <AlertTriangle size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-[#9fcbb3]">
                    {mobileTotalDebtLabel}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-[13px] font-black uppercase tracking-tight dark:text-white',
                      mobileClientRow.overdueTotalValue > 0
                        ? 'text-rose-600 dark:text-rose-200'
                        : 'text-zinc-950'
                    )}
                  >
                    {mobileClientRow.overdueTotalLabel}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 pt-4 dark:border-white/10">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => openMobilePalletListModal('withQr')}
                  className="flex w-full items-center justify-between rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-zinc-900 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#151d1a] dark:text-white"
                >
                  <span>{mobileWithQrLabel}</span>
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-700 dark:bg-[#101715] dark:text-[#d5f1de]">
                    {mobileQrPallets.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openMobilePalletListModal('withoutQr')}
                  className="flex w-full items-center justify-between rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-zinc-900 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#151d1a] dark:text-white"
                >
                  <span>{mobileWithoutQrLabel}</span>
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-700 dark:bg-[#101715] dark:text-[#d5f1de]">
                    {mobileNoQrPallets.length}
                  </span>
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="flex w-full items-center justify-between rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-zinc-900 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#151d1a] dark:text-white">
                  <span>
                    {mobileInUseLabel}
                  </span>
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-700 dark:bg-[#101715] dark:text-[#d5f1de]">
                    {mobileClientStatusCounts.inUse}
                  </span>
                </div>
                <div className="flex w-full items-center justify-between rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-zinc-900 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#151d1a] dark:text-white">
                  <span>
                    {mobileForPickupLabel}
                  </span>
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-700 dark:bg-[#101715] dark:text-[#d5f1de]">
                    {mobileClientStatusCounts.forPickup}
                  </span>
                </div>
              </div>
            </div>

              <div className="hidden">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-[#9fcbb3]">
                  {mobileReportedPalletsLabel}
                </p>
                {mobileClientPallets.length > 0 ? (
                  <div className="max-h-[360px] overflow-auto">
                <div className="min-w-[540px]">
                  <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.7fr)_minmax(0,1.15fr)_58px_58px_76px] items-center gap-4 border-b border-zinc-100 bg-white pb-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:border-white/10 dark:bg-[#101715] dark:text-[#9fcbb3]">
                    <span>{t('qrCode')}</span>
                    <span>{t('status')}</span>
                    <span>{t('daysOut')}</span>
                    <span>{t('overdueShort')}</span>
                    <span>EUR</span>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-white/10">
                  {mobileClientPallets.map(({ pallet, daysOutside, overdueDays, overdueCost }) => (
                    <li
                      key={`client-mobile-pallet-${pallet.id}`}
                      className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1.15fr)_58px_58px_76px] items-center gap-4 py-2.5"
                      title={`${getPalletTypeLabel(pallet.type, language)} • ${getLocationLabel(pallet.current_location, language) || '-'}`}
                    >
                      <span className="truncate text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {getPalletDisplayName(pallet)}
                      </span>
                      <span className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-[#d8e8de]">
                        {getStatusLabel(pallet.current_status_name, language)}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {daysOutside}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {overdueDays}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-black uppercase tracking-tight dark:text-white',
                          overdueCost > 0 ? 'text-rose-600 dark:text-rose-200' : 'text-zinc-950'
                        )}
                      >
                        {currencyFormatter.format(overdueCost)}
                      </span>
                    </li>
                  ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-8 text-center dark:border-white/10 dark:bg-[#151d1a]">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#101715]">
                  <Package size={18} className="text-zinc-300 dark:text-[#9fcbb3]" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  {mobileNoClientPalletsLabel}
                </p>
              </div>
              )}
            </div>
            </div>

            {activeMobilePalletList && (
              <DriverModalShell
                onClose={closeMobilePalletListModal}
                title={mobileClientRow.clientName}
                subtitle={activeMobilePalletTitle}
                width="lg"
                overlayClassName="mobile-pallet-modal-overlay z-[110]"
                contentClassName="mobile-pallet-modal md:h-[90dvh] md:max-w-5xl"
                headerClassName="mobile-pallet-modal-header"
                bodyClassName="mobile-pallet-modal-body overflow-hidden bg-zinc-50/80 px-3 py-3 dark:bg-[#070b0a] sm:px-4"
              >
                {unfilteredActiveMobilePalletItems.length > 0 ? (
                  <div className="mobile-pallet-modal-content flex h-full min-h-0 flex-col gap-3">
                    <div className="mobile-pallet-toolbar sticky top-0 z-30 shrink-0 space-y-2 rounded-[1.1rem] border border-zinc-100 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-[#101715]">
                      <div className="mobile-pallet-toolbar-filters grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <div className="relative min-w-0">
                          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                          <Input
                            type="search"
                            value={mobilePalletSearch}
                            onChange={(event) => setMobilePalletSearch(event.target.value)}
                            placeholder={mobilePalletViewCopy.search}
                            className="h-10 bg-zinc-50 pl-9 text-[11px] normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal dark:bg-[#151d1a]"
                          />
                        </div>
                        <select
                          value={mobilePalletStatusFilter}
                          onChange={(event) => setMobilePalletStatusFilter(event.target.value)}
                          aria-label={t('status')}
                          className="h-10 max-w-[8.75rem] rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-[9px] font-black uppercase tracking-[0.08em] text-zinc-700 outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-[#151d1a] dark:text-white"
                        >
                          <option value="all">{mobilePalletViewCopy.allStatuses}</option>
                          {mobilePalletStatusOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="mobile-pallet-view-toggle grid grid-cols-2 rounded-xl bg-zinc-100 p-1 dark:bg-[#151d1a]">
                        <button
                          type="button"
                          onClick={() => setMobilePalletDisplayMode('compact')}
                          className={cn(
                            'inline-flex h-8 items-center justify-center gap-2 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-colors',
                            mobilePalletDisplayMode === 'compact'
                              ? 'bg-white text-emerald-700 shadow-sm dark:bg-[#22302a] dark:text-emerald-200'
                              : 'text-zinc-500 dark:text-zinc-300',
                          )}
                        >
                          <List size={13} />
                          {mobilePalletViewCopy.compact}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobilePalletDisplayMode('full')}
                          className={cn(
                            'inline-flex h-8 items-center justify-center gap-2 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] transition-colors',
                            mobilePalletDisplayMode === 'full'
                              ? 'bg-white text-emerald-700 shadow-sm dark:bg-[#22302a] dark:text-emerald-200'
                              : 'text-zinc-500 dark:text-zinc-300',
                          )}
                        >
                          <Table2 size={13} />
                          {mobilePalletViewCopy.full}
                        </button>
                      </div>
                    </div>

                    {activeMobilePalletItems.length === 0 ? (
                      <div className="flex min-h-0 flex-1 items-center justify-center rounded-[1.25rem] border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-8 text-center dark:border-white/10 dark:bg-[#151d1a]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                          {mobilePalletViewCopy.noMatches}
                        </p>
                      </div>
                    ) : mobilePalletDisplayMode === 'compact' ? (
                      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-2">
                        {activeMobilePalletItems.map((item, index) => {
                          const statusLabel = getStatusLabel(item.pallet.current_status_name, language);
                          const isOverdue = item.overdueDays > 0;

                          return (
                            <button
                              key={`client-mobile-compact-${item.pallet.id}`}
                              type="button"
                              onClick={() => setSelectedMobilePallet({
                                item,
                                index,
                                view: activeMobilePalletList,
                              })}
                              className={cn(
                                'w-full rounded-[1.2rem] border bg-white p-3.5 text-left shadow-[0_12px_28px_-24px_rgba(15,23,42,0.5)] transition-colors dark:bg-[#151d1a]',
                                isOverdue
                                  ? 'border-rose-200 hover:border-rose-300 dark:border-rose-400/30'
                                  : 'border-zinc-100 hover:border-emerald-200 dark:border-white/10',
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate text-[12px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                                      {item.pallet.is_ghost ? `${mobilePalletNumberLabel} ${index + 1}` : getPalletDisplayName(item.pallet)}
                                    </p>
                                    <span className={cn(
                                      'inline-flex rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.09em]',
                                      isOverdue
                                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
                                    )}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 text-zinc-500 dark:text-zinc-300">
                                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[10px] font-semibold">
                                      <MapPin size={12} className="shrink-0" />
                                      <span className="truncate">{getLocationLabel(item.pallet.current_location, language) || t('notAvailable')}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-black uppercase tracking-tight">
                                      <Clock3 size={12} />
                                      {item.daysOutside} {mobilePalletViewCopy.days}
                                    </span>
                                  </div>
                                  {isOverdue && (
                                    <p className="mt-2 text-[9px] font-black uppercase tracking-[0.1em] text-rose-600 dark:text-rose-200">
                                      {mobilePalletViewCopy.overdue}: {item.overdueDays} {mobilePalletViewCopy.days}
                                    </p>
                                  )}
                                </div>
                                <ChevronRight size={17} className="mt-1 shrink-0 text-zinc-300 dark:text-zinc-500" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                    <div className="mobile-pallet-full-table min-h-0 flex-1 overflow-auto overscroll-contain rounded-[1.25rem] border border-zinc-100 bg-zinc-50/60 dark:border-white/10 dark:bg-[#151d1a]">
                      {activeMobilePalletList === 'withoutQr' ? (
                        <div className="min-w-[460px]">
                        <div className="mobile-pallet-table-header sticky top-0 z-10 isolate grid grid-cols-[64px_minmax(150px,1fr)_125px] items-center gap-3 border-b border-zinc-100 bg-white px-4 py-3 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-400 dark:border-white/10 dark:bg-[#101715] dark:text-[#9fcbb3]">
                          <span className="mobile-pallet-sticky-column mobile-pallet-sticky-column--narrow sticky left-0 z-20 justify-center bg-white text-center leading-none shadow-[12px_0_18px_-18px_rgba(15,23,42,0.7)] dark:bg-[#101715]">{mobilePalletViewCopy.numberShort}</span>
                          <span className="text-center leading-none">{t('status')}</span>
                          <span className="bg-white text-right leading-none dark:bg-[#101715]">{mobilePalletViewCopy.dateShort}</span>
                        </div>

                        <ul className="divide-y divide-zinc-100 dark:divide-white/10">
                          {activeMobilePalletItems.map((item, index) => (
                            <li key={`client-mobile-noqr-${item.pallet.id}`}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedMobilePallet({
                                    item,
                                    index,
                                    view: 'withoutQr',
                                  })
                                }
                                className="mobile-pallet-table-row grid min-h-[3.25rem] w-full grid-cols-[64px_minmax(150px,1fr)_125px] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/70 dark:hover:bg-white/5"
                              >
                                <span className="mobile-pallet-sticky-column mobile-pallet-sticky-column--narrow sticky left-0 z-10 inline-flex items-center justify-center bg-zinc-50 text-center text-[10px] font-black uppercase leading-none tracking-tight text-zinc-950 shadow-[12px_0_18px_-18px_rgba(15,23,42,0.65)] dark:bg-[#151d1a] dark:text-white">
                                  {index + 1}
                                </span>
                                <span className="inline-flex min-h-[1.25rem] items-center justify-center text-center text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-500 dark:text-[#d8e8de]">
                                  {getStatusLabel(item.pallet.current_status_name, language)}
                                </span>
                                <span className="inline-flex items-center justify-end text-right text-[10px] font-black uppercase leading-none tracking-tight text-zinc-950 dark:text-white">
                                  {getMobilePalletDate(item)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        </div>
                    ) : (
                      <div className="min-w-[740px]">
                        <div className="mobile-pallet-table-header sticky top-0 z-10 isolate grid grid-cols-[150px_120px_190px_58px_58px_70px] items-center gap-3 border-b border-zinc-100 bg-white px-4 py-3 text-[9px] font-black uppercase tracking-[0.11em] text-zinc-400 dark:border-white/10 dark:bg-[#101715] dark:text-[#9fcbb3]">
                          <span className="mobile-pallet-sticky-column sticky left-0 z-20 bg-white shadow-[12px_0_18px_-18px_rgba(15,23,42,0.7)] dark:bg-[#101715]">QR</span>
                          <span>{t('status')}</span>
                          <span>{mobilePalletViewCopy.locationShort}</span>
                          <span className="text-right">{mobilePalletViewCopy.daysShort}</span>
                          <span className="text-right">{mobilePalletViewCopy.overdueShort}</span>
                          <span className="h-full bg-white text-right dark:bg-[#101715]">EUR</span>
                        </div>

                        <ul className="divide-y divide-zinc-100 dark:divide-white/10">
                          {activeMobilePalletItems.map((item, index) => (
                            <li key={`client-mobile-qr-${item.pallet.id}`}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedMobilePallet({
                                    item,
                                    index,
                                    view: 'withQr',
                                  })
                                }
                                className={cn(
                                  'mobile-pallet-table-row grid w-full grid-cols-[150px_120px_190px_58px_58px_70px] items-center gap-3 px-4 py-3 text-left transition-colors dark:hover:bg-white/5',
                                  item.overdueDays > 0 ? 'bg-rose-50/70 hover:bg-rose-50 dark:bg-rose-400/5' : 'hover:bg-white/70',
                                )}
                                title={`${getPalletTypeLabel(item.pallet.type, language)} - ${getLocationLabel(item.pallet.current_location, language) || '-'}`}
                              >
                                <span className={cn(
                                  'mobile-pallet-sticky-column sticky left-0 z-10 truncate text-[10px] font-black uppercase tracking-tight text-zinc-950 shadow-[12px_0_18px_-18px_rgba(15,23,42,0.65)] dark:text-white',
                                  item.overdueDays > 0 ? 'bg-rose-50 dark:bg-[#1b1516]' : 'bg-zinc-50 dark:bg-[#151d1a]',
                                )}>
                                  {getPalletDisplayName(item.pallet)}
                                </span>
                                <span className={cn(
                                  'inline-flex w-fit max-w-full truncate rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-[0.09em]',
                                  item.overdueDays > 0
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200',
                                )}>
                                  {getStatusLabel(item.pallet.current_status_name, language)}
                                </span>
                                <span className="truncate text-[10px] font-semibold text-zinc-600 dark:text-zinc-200">
                                  {getLocationLabel(item.pallet.current_location, language) || '-'}
                                </span>
                                <span className="text-right text-[10px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                                  {item.daysOutside}
                                </span>
                                <span className="text-right text-[10px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                                  {item.overdueDays}
                                </span>
                                <span
                                  className={cn(
                                    'text-right text-[10px] font-black uppercase tracking-tight dark:text-white',
                                    item.overdueCost > 0 ? 'text-rose-600 dark:text-rose-200' : 'text-zinc-950'
                                  )}
                                >
                                  {currencyFormatter.format(item.overdueCost)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-8 text-center dark:border-white/10 dark:bg-[#151d1a]">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#101715]">
                      <Package size={18} className="text-zinc-300 dark:text-[#9fcbb3]" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                      {activeMobilePalletEmptyLabel}
                    </p>
                  </div>
                )}
                {showMobileRotateHint && (
                  <button
                    type="button"
                    onClick={() => setShowMobileRotateHint(false)}
                    className="mobile-orientation-toast"
                    role="status"
                  >
                    <Smartphone size={17} className="mobile-phone-rotation-icon shrink-0" />
                    <span>
                      {mobileRotateHint} {mobilePalletDisplayMode === 'full' ? mobileScrollHint : ''}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMobileRotateHint((current) => !current)}
                  aria-label={mobileOrientationLabel}
                  aria-expanded={showMobileRotateHint}
                  title={mobileOrientationLabel}
                  className="mobile-orientation-fab"
                >
                  <Smartphone size={20} className="mobile-phone-rotation-icon" />
                  <span className="sr-only">{mobileOrientationLabel}</span>
                </button>
              </DriverModalShell>
            )}
            {selectedMobilePallet && (
              <DriverModalShell
                onClose={() => setSelectedMobilePallet(null)}
                title={mobileClientRow.clientName}
                subtitle={
                  selectedMobilePallet.view === 'withoutQr'
                    ? `${mobilePalletNumberLabel} ${selectedMobilePallet.index + 1}`
                    : getPalletDisplayName(selectedMobilePallet.item.pallet)
                }
                width="sm"
                overlayClassName="z-[120] items-center p-4"
                contentClassName="h-auto max-h-[72dvh] max-w-sm rounded-[1.75rem] border border-emerald-100 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)] dark:border-white/10"
                bodyClassName="bg-zinc-50/80 px-4 py-4 dark:bg-[#070b0a]"
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                        {selectedMobilePallet.view === 'withoutQr' ? mobilePalletNumberLabel : t('qrCode')}
                      </p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {selectedMobilePallet.view === 'withoutQr'
                          ? selectedMobilePallet.index + 1
                          : getPalletDisplayName(selectedMobilePallet.item.pallet)}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                        {t('status')}
                      </p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {getStatusLabel(selectedMobilePallet.item.pallet.current_status_name, language)}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                        {mobileReturnDateLabel}
                      </p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {getMobilePalletDate(selectedMobilePallet.item)}
                      </p>
                    </div>
                    {!selectedMobilePallet.item.pallet.is_ghost && (
                      <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                          {t('location')}
                        </p>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                          {getLocationLabel(selectedMobilePallet.item.pallet.current_location, language) || t('notAvailable')}
                        </p>
                      </div>
                    )}
                    <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                        {t('palletType')}
                      </p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {getPalletTypeLabel(selectedMobilePallet.item.pallet.type, language)}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                        {mobilePalletViewCopy.timeInStatus}
                      </p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {selectedMobilePallet.item.daysOutside} {mobilePalletViewCopy.days}
                      </p>
                    </div>
                    {selectedMobilePallet.item.overdueDays > 0 && (
                      <div className="rounded-[1.15rem] border border-rose-200 bg-rose-50 px-3 py-3 dark:border-rose-400/30 dark:bg-rose-400/10">
                        <p className="text-[8px] font-black uppercase tracking-[0.14em] text-rose-500 dark:text-rose-200">
                          {mobilePalletViewCopy.overdue}
                        </p>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-rose-700 dark:text-rose-100">
                          {selectedMobilePallet.item.overdueDays} {mobilePalletViewCopy.days} · EUR {currencyFormatter.format(selectedMobilePallet.item.overdueCost)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                      {mobileCommentLabel}
                    </p>
                    <p className="mt-2 text-[11px] font-bold leading-5 text-zinc-700 dark:text-zinc-200">
                      {formatServiceReportDescription(selectedMobilePallet.item.pallet.note, language) ||
                        t('notAvailable')}
                    </p>
                  </div>
                </div>
              </DriverModalShell>
            )}
          </>
        )}
      </div>
    );
  }

  if (clientIdFilter !== undefined || !isMobile) {
    return (
      <div className="space-y-6">
        {!mobileClientRow ? (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-200 bg-zinc-50/70 px-5 py-12 text-center dark:border-white/10 dark:bg-[#151d1a]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#101715]">
              <Search size={18} className="text-zinc-300 dark:text-[#9fcbb3]" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
              {t('noMatchingResults')}
            </p>
          </div>
        ) : (
          <>
            <ClientPalletDesktopTable
              client={mobileClientRow.client}
              summaryCards={
                <>
              <div className="client-summary-card h-[5.75rem] overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white p-3.5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  {t('companyName')}
                </p>
                <p className="mt-1.5 truncate text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.clientName}
                </p>
              </div>
              <div className="client-summary-card h-[5.75rem] overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white p-3.5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  KVK
                </p>
                <p className="mt-1.5 truncate text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.kvkLabel}
                </p>
              </div>
              <div className="client-summary-card h-[5.75rem] overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white p-3.5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  {t('ratePerDayLabel')}
                </p>
                <p className="mt-1.5 truncate text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.rateLabel}
                </p>
              </div>
              <div className="client-summary-card h-[5.75rem] overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white p-3.5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  {mobileTotalDebtLabel}
                </p>
                <p
                  className={cn(
                    'mt-1.5 truncate text-lg font-black uppercase tracking-tight dark:text-white',
                    mobileClientRow.overdueTotalValue > 0 ? 'text-rose-600 dark:text-rose-200' : 'text-zinc-950'
                  )}
                >
                  {mobileClientRow.overdueTotalLabel}
                </p>
              </div>
                </>
              }
            />

            <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-20 flex items-center gap-3 md:bottom-20 md:right-8">
              <button
                type="button"
                onClick={() => setIsDesktopReturnFormOpen(true)}
                className="inline-flex h-14 items-center gap-2 rounded-full bg-[#00A655] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_36px_-18px_rgba(0,166,85,0.8)] transition-transform hover:scale-[1.02]"
              >
                <Undo2 size={16} />
                {reportReturnLabel}
              </button>
            </div>

            {isDesktopReturnFormOpen && (
              <NoQrReturnFormModal
                currentUser={{
                  id: mobileClientRow.client.user_id,
                  name: mobileClientRow.client.name,
                  email: '',
                  role_id: 4,
                  role_name: RoleType.KLIJENT,
                }}
                onClose={() => setIsDesktopReturnFormOpen(false)}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminTableStickyToolbar flushToPageTop className="flex justify-end py-3">
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

      <AdminDataTable<ColumnKey>
        columnOrder={columnOrder}
        initialColumnWidths={INITIAL_COLUMN_WIDTHS}
        minColumnWidths={MIN_COLUMN_WIDTHS}
        resizeAriaLabel={resizeAriaLabel}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isInitialLoading && filteredRows.length === 0}
        emptyState={
          <div className="p-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-100 bg-zinc-50">
              <Search size={20} className="text-zinc-200" />
            </div>
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
              <col style={{ width: columnWidths.kvk }} />
              <col style={{ width: columnWidths.warehouses }} />
              <col style={{ width: columnWidths.rate }} />
              <col style={{ width: columnWidths.overdueTotal }} />
              <col style={{ width: columnWidths.atClient }} />
              <col style={{ width: columnWidths.returnReports }} />
              {clientIdFilter === undefined && <col style={{ width: columnWidths.actions }} />}
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80">
              <tr>
                <th ref={registerHeaderCell('kvk')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('kvk', 'KVK')}
                  </div>
                  {renderResizeHandle('kvk')}
                </th>
                <th ref={registerHeaderCell('warehouses')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('warehouses', warehousesHeaderLabel)}
                  </div>
                  {renderResizeHandle('warehouses')}
                </th>
                <th ref={registerHeaderCell('rate')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('rate', t('ratePerDayLabel'))}
                  </div>
                  {renderResizeHandle('rate')}
                </th>
                <th ref={registerHeaderCell('overdueTotal')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('overdueTotal', overdueTotalHeaderLabel)}
                  </div>
                  {renderResizeHandle('overdueTotal')}
                </th>
                <th ref={registerHeaderCell('atClient')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('atClient', atClientHeaderLabel)}
                  </div>
                  {renderResizeHandle('atClient')}
                </th>
                <th ref={registerHeaderCell('returnReports')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('returnReports', returnReportsHeaderLabel)}
                  </div>
                  {renderResizeHandle('returnReports')}
                </th>
                {clientIdFilter === undefined && (
                  <th className={cn(headerCellClass, stickyActionsHeaderClass, 'group')}>
                    <div className={headerContentClass}>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] leading-none text-zinc-900">
                        {t('actions')}
                      </p>
                    </div>
                    {renderResizeHandle('actions')}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredRows.map((row, index) => (
                <motion.tr
                  key={`client-row-${row.client.id}`}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => onEditClient?.(row.client)}
                  onKeyDown={(event) => {
                    if (!onEditClient) {
                      return;
                    }

                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onEditClient(row.client);
                    }
                  }}
                  tabIndex={onEditClient ? 0 : -1}
                  role={onEditClient ? 'button' : undefined}
                  className={cn(
                    'group transition-colors hover:bg-zinc-50/60',
                    onEditClient && 'cursor-pointer focus-visible:bg-zinc-50/80 focus-visible:outline-none'
                  )}
                >
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-600')}>{row.kvkLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500')}>{row.warehousesLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500')}>{row.rateLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span
                        className={cn(
                          bodyTextClass,
                          row.overdueTotalValue > 0 ? 'text-rose-600' : 'text-zinc-400'
                        )}
                      >
                        {row.overdueTotalLabel}
                      </span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900')}>{row.atClientLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900')}>
                        {row.returnReportsLabel}
                      </span>
                    </div>
                  </td>
                  {clientIdFilter === undefined && (
                    <td className={cn(bodyCellClass, stickyActionsCellClass)}>
                      <div className="flex min-h-[2.75rem] items-center justify-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-10 w-10 p-0"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEditClient?.(row.client);
                          }}
                          title={t('editData')}
                          aria-label={t('editData')}
                        >
                          <Edit size={15} />
                        </Button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      />

      <PageLoadingModal isOpen={isInitialLoading} language={language} />

      {clientIdFilter === undefined && (
        <InfiniteScrollFooter hasMore={hasMore} isLoading={isLoadingMore} error={paginationError} onLoadMore={loadMore} onRetry={retry} language={language} />
      )}

      {openFilterKey && renderFilterMenu(openFilterKey)}

      {onAddClient && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-20 flex items-center gap-3 md:bottom-20 md:right-8">
          <button
            type="button"
            onClick={onAddClient}
            className="inline-flex h-14 items-center gap-2 rounded-full bg-[#00A655] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_36px_-18px_rgba(0,166,85,0.8)] transition-transform hover:scale-[1.02]"
          >
            <Plus size={16} />
            {t('addNew')}
          </button>
        </div>
      )}
    </div>
  );
};
