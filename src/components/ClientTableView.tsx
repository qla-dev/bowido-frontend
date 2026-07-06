import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpDown,
  CreditCard,
  Edit,
  Funnel,
  Hash,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Search,
  Undo2,
} from 'lucide-react';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { ClientPalletDesktopTable } from './ClientPalletDesktopTable';
import { DriverModalShell } from './DriverModalShell';
import { NoQrReturnFormModal } from './NoQrReturnFormModal';
import { Button, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { ClientDetail, Pallet, RoleType } from '../types';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';
import { ListPagination } from './ListPagination';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService, PaginationMeta } from '../services/api';

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

type MobileClientPalletItem = {
  pallet: Pallet;
  daysOutside: number;
  overdueDays: number;
  overdueCost: number;
};

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

interface ClientTableViewProps {
  onAddClient?: () => void;
  onEditClient?: (client: ClientDetail) => void;
  clientIdFilter?: number;
}

export const ClientTableView: React.FC<ClientTableViewProps> = ({ onAddClient, onEditClient, clientIdFilter }) => {
  const { clients: cachedClients, pallets, statuses, t, language } = useApp();
  const [clients, setPagedClients] = useState<ClientDetail[]>([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [pageLimit, setPageLimit] = useState(CLIENT_PAGE_SIZE);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    total: 0,
    limit: CLIENT_PAGE_SIZE,
    offset: 0,
    count: 0,
  });
  const [isPageLoading, setIsPageLoading] = useState(false);
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
    setPageOffset(0);
  }, [clientIdFilter]);

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      setIsPageLoading(true);

      try {
        const page = await apiService.clients.page({
          limit: clientIdFilter === undefined ? pageLimit : 1,
          offset: clientIdFilter === undefined ? pageOffset : 0,
          user_id: clientIdFilter,
        });

        if (!isMounted) {
          return;
        }

        setPagedClients(page.items);
        setPaginationMeta(page.meta);
      } catch (error) {
        console.error('Failed to load paginated clients', error);
      } finally {
        if (isMounted) {
          setIsPageLoading(false);
        }
      }
    };

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, [clientIdFilter, pageLimit, pageOffset]);

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
    headerIconClass,
    headerIconButtonClass,
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
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'client',
    direction: 'asc',
  });
  const [openFilterKey, setOpenFilterKey] = useState<SortKey | null>(null);
  const [isDesktopReturnFormOpen, setIsDesktopReturnFormOpen] = useState(false);
  const [activeMobilePalletList, setActiveMobilePalletList] = useState<MobilePalletListView | null>(null);
  const [selectedMobilePallet, setSelectedMobilePallet] = useState<{
    item: MobileClientPalletItem;
    index: number;
    view: MobilePalletListView;
  } | null>(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const searchPlaceholder =
    language === 'bs' ? 'Pretraži' : language === 'nl' ? 'Zoeken' : 'Search';
  const showAllLabel =
    language === 'bs' ? 'Prikaži sve' : language === 'nl' ? 'Alles tonen' : 'Show all';
  const noResultsLabel =
    language === 'bs' ? 'Nema rezultata' : language === 'nl' ? 'Geen resultaten' : 'No results';
  const warehousesHeaderLabel =
    language === 'bs' ? 'Adrese magacina' : language === 'nl' ? 'Magazijnadressen' : 'Warehouse addresses';
  const overdueTotalHeaderLabel =
    language === 'bs' ? 'Dug' : language === 'nl' ? 'Achterstand' : 'Overdue total';
  const atClientHeaderLabel =
    language === 'bs' ? 'Kod kupca' : language === 'nl' ? 'Bij klant' : 'At client';
  const returnReportsHeaderLabel =
    language === 'bs' ? 'Prijave povrata' : language === 'nl' ? 'Retourmeldingen' : 'Return reports';
  const mobileProfileLabel =
    language === 'bs' ? 'Profil klijenta' : language === 'nl' ? 'Klantprofiel' : 'Client profile';
  const mobileOverviewLabel =
    language === 'bs' ? 'Pregled paleta' : language === 'nl' ? 'Bokkenoverzicht' : 'Pallet overview';
  const mobileReportedPalletsLabel =
    language === 'bs' ? 'Prijavljene palete' : language === 'nl' ? 'Gemelde bokken' : 'Reported pallets';
  const mobileWithQrLabel =
    language === 'bs' ? 'Sa QR kodom' : language === 'nl' ? 'Met QR code' : 'With QR code';
  const mobileWithoutQrLabel =
    language === 'bs' ? 'Bez QR koda' : language === 'nl' ? 'Zonder QR code' : 'Without QR code';
  const mobilePalletsAtClientLabel =
    language === 'bs' ? 'Palete kod klijenta' : language === 'nl' ? 'Bokken bij klant' : 'Pallets at client';
  const mobileOverdueDaysLabel =
    language === 'bs' ? 'Ukupno dana kašnjenja' : language === 'nl' ? 'Totale overduedagen' : 'Total overdue days';
  const mobileTotalDebtLabel =
    language === 'bs' ? 'Ukupan dug' : language === 'nl' ? 'Totale schuld' : 'Total debt';
  const reportReturnLabel =
    language === 'bs'
      ? 'Prijavi povrat'
      : language === 'nl'
        ? 'Retour melden'
        : 'Report return';
  const mobileNoClientPalletsLabel =
    language === 'bs' ? 'Klijent nema prijavljenih paleta.' : language === 'nl' ? 'De klant heeft geen gemelde bokken.' : 'This client has no reported pallets.';
  const mobileNoQrListEmptyLabel =
    language === 'bs' ? 'Nema prijavljenih paleta bez QR koda.' : language === 'nl' ? 'Geen bokken zonder QR-code.' : 'No pallets without a QR code.';
  const mobileWithQrListEmptyLabel =
    language === 'bs' ? 'Nema paleta sa QR kodom.' : language === 'nl' ? 'Geen bokken met QR-code.' : 'No pallets with a QR code.';
  const mobileNoQrEmptyLabel =
    language === 'bs' ? 'Nema prijavljenih paleta bez QR koda.' : language === 'nl' ? 'Geen gemelde bokken zonder QR-code.' : 'No pallets reported without a QR code.';
  const mobilePalletNumberLabel =
    language === 'bs' ? 'Redni broj palete' : language === 'nl' ? 'Volgnummer bok' : 'Pallet number';
  const mobileReturnDateLabel =
    language === 'bs' ? 'Datum retour' : language === 'nl' ? 'Datum retour' : 'Return date';
  const mobileCommentLabel =
    language === 'bs' ? 'Komentar' : language === 'nl' ? 'Commentaar' : 'Comment';
  const mobileStatusVoorRetourLabel =
    language === 'bs' ? 'Voor retour' : language === 'nl' ? 'Voor retour' : 'For return';
  const resizeAriaLabel =
    language === 'bs'
      ? 'Promijeni sirinu kolone'
      : language === 'nl'
        ? 'Kolombreedte aanpassen'
        : 'Resize column';
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
  const mobileDateFormatter = new Intl.DateTimeFormat(
    language === 'nl' ? 'nl-NL' : language === 'bs' ? 'bs-BA' : 'en-GB',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );

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
        const clientPallets = pallets.filter((pallet) => pallet.user_id === client.user_id);
        const palletsAtClient = clientPallets.filter((pallet) => pallet.current_status_id === 4);
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
          atClientLabel: `${palletsAtClient.length}`,
          atClientCount: palletsAtClient.length,
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
      .filter((pallet) => pallet.user_id === mobileClientRow.client.user_id)
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
    () => mobileClientPallets.filter(({ pallet }) => !pallet.is_ghost),
    [mobileClientPallets]
  );

  const mobileNoQrPallets = useMemo(
    () => mobileClientPallets.filter(({ pallet }) => pallet.is_ghost),
    [mobileClientPallets]
  );

  const mobileTotalOverdueDays = mobileClientPallets.reduce(
    (total, item) => total + item.overdueDays,
    0
  );

  const activeMobilePalletItems =
    activeMobilePalletList === 'withoutQr' ? mobileNoQrPallets : mobileQrPallets;
  const activeMobilePalletTitle =
    activeMobilePalletList === 'withoutQr' ? mobileWithoutQrLabel : mobileWithQrLabel;
  const activeMobilePalletEmptyLabel =
    activeMobilePalletList === 'withoutQr' ? mobileNoQrListEmptyLabel : mobileWithQrListEmptyLabel;
  const getMobilePalletDate = (item: MobileClientPalletItem) =>
    mobileDateFormatter.format(
      new Date(item.pallet.is_ghost ? item.pallet.created_at : item.pallet.last_status_changed_at)
    );
  const closeMobilePalletListModal = () => {
    setActiveMobilePalletList(null);
    setSelectedMobilePallet(null);
  };

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

  const hasActiveFilter = (key: SortKey) => selectedFilters[key].length > 0;

  const renderSortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden text-[9px] font-black uppercase tracking-[0.14em] leading-none text-zinc-900 transition-colors hover:text-zinc-700"
    >
      <span className="block min-w-0 truncate">{label}</span>
      <ArrowUpDown size={13} className="shrink-0" />
    </button>
  );

  const renderFilterButton = (key: SortKey) => (
    <button
      type="button"
      onClick={() => setOpenFilterKey((current) => (current === key ? null : key))}
      className={cn(
        headerIconButtonClass,
        hasActiveFilter(key) && 'border-emerald-300 bg-emerald-50 text-emerald-700'
      )}
    >
      <Funnel size={12} />
    </button>
  );

  const renderFilterMenu = (key: SortKey) => {
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
                  {mobileProfileLabel}
                </p>
                <p className="mt-2 text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.clientName}
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
                  onClick={() => setActiveMobilePalletList('withQr')}
                  className="flex w-full items-center justify-between rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-zinc-900 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#151d1a] dark:text-white"
                >
                  <span>{mobileWithQrLabel}</span>
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-700 dark:bg-[#101715] dark:text-[#d5f1de]">
                    {mobileQrPallets.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobilePalletList('withoutQr')}
                  className="flex w-full items-center justify-between rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.14em] text-zinc-900 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] transition-colors hover:border-zinc-300 dark:border-white/10 dark:bg-[#151d1a] dark:text-white"
                >
                  <span>{mobileWithoutQrLabel}</span>
                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-black text-zinc-700 dark:bg-[#101715] dark:text-[#d5f1de]">
                    {mobileNoQrPallets.length}
                  </span>
                </button>
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
                    <span>{language === 'bs' ? 'Kasni' : language === 'nl' ? 'Te laat' : 'Late'}</span>
                    <span>EUR</span>
                  </div>
                  <ul className="divide-y divide-zinc-100 dark:divide-white/10">
                  {mobileClientPallets.map(({ pallet, daysOutside, overdueDays, overdueCost }) => (
                    <li
                      key={`client-mobile-pallet-${pallet.id}`}
                      className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1.15fr)_58px_58px_76px] items-center gap-4 py-2.5"
                      title={`${getPalletTypeLabel(pallet.type, language)} • ${pallet.current_location || '-'}`}
                    >
                      <span className="truncate text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {pallet.qr_code}
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
                width="sm"
                overlayClassName="z-[110] items-center p-4"
                contentClassName="h-auto max-h-[82dvh] max-w-sm rounded-[1.75rem] border border-emerald-100 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)] dark:border-white/10"
                bodyClassName="bg-zinc-50/80 px-4 py-3 dark:bg-[#070b0a]"
              >
                {activeMobilePalletItems.length > 0 ? (
                  <div className="overflow-hidden rounded-[1.25rem] border border-zinc-100 bg-zinc-50/60 dark:border-white/10 dark:bg-[#151d1a]">
                    {activeMobilePalletList === 'withoutQr' ? (
                      <>
                        <div className="grid grid-cols-[42px_minmax(0,1fr)_82px] items-center gap-2 border-b border-zinc-100 px-3 py-2.5 text-[8px] font-black uppercase tracking-[0.12em] text-zinc-400 dark:border-white/10 dark:text-[#9fcbb3]">
                          <span className="text-center leading-none">{mobilePalletNumberLabel}</span>
                          <span className="text-center leading-none">{t('status')}</span>
                          <span className="text-right leading-none">{mobileReturnDateLabel}</span>
                        </div>

                        <ul className="max-h-[56vh] divide-y divide-zinc-100 overflow-y-auto dark:divide-white/10">
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
                                className="grid min-h-[3.1rem] w-full grid-cols-[42px_minmax(0,1fr)_82px] items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-white/70 dark:hover:bg-white/5"
                              >
                                <span className="inline-flex items-center justify-center text-center text-[10px] font-black uppercase leading-none tracking-tight text-zinc-950 dark:text-white">
                                  {index + 1}
                                </span>
                                <span className="inline-flex min-h-[1.25rem] items-center justify-center text-center text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-zinc-500 dark:text-[#d8e8de]">
                                  {mobileStatusVoorRetourLabel}
                                </span>
                                <span className="inline-flex items-center justify-end text-right text-[10px] font-black uppercase leading-none tracking-tight text-zinc-950 dark:text-white">
                                  {getMobilePalletDate(item)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_34px_34px_52px] items-center gap-2.5 border-b border-zinc-100 px-3 py-2 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:border-white/10 dark:text-[#9fcbb3]">
                          <span>{t('qrCode')}</span>
                          <span>{t('status')}</span>
                          <span className="text-right">{t('daysOut')}</span>
                          <span className="text-right">{language === 'bs' ? 'Kasni' : language === 'nl' ? 'Te laat' : 'Late'}</span>
                          <span className="text-right">EUR</span>
                        </div>

                        <ul className="max-h-[56vh] divide-y divide-zinc-100 overflow-y-auto dark:divide-white/10">
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
                                className="grid w-full grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_34px_34px_52px] items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-white/70 dark:hover:bg-white/5"
                                title={`${getPalletTypeLabel(item.pallet.type, language)} - ${item.pallet.current_location || '-'}`}
                              >
                                <span className="truncate text-[10px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                                  {item.pallet.qr_code}
                                </span>
                                <span className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-[#d8e8de]">
                                  {getStatusLabel(item.pallet.current_status_name, language)}
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
                      </>
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
              </DriverModalShell>
            )}
            {selectedMobilePallet && (
              <DriverModalShell
                onClose={() => setSelectedMobilePallet(null)}
                title={mobileClientRow.clientName}
                subtitle={
                  selectedMobilePallet.view === 'withoutQr'
                    ? `${mobilePalletNumberLabel} ${selectedMobilePallet.index + 1}`
                    : selectedMobilePallet.item.pallet.qr_code
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
                          : selectedMobilePallet.item.pallet.qr_code}
                      </p>
                    </div>
                    <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                        {t('status')}
                      </p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {selectedMobilePallet.view === 'withoutQr'
                          ? mobileStatusVoorRetourLabel
                          : getStatusLabel(selectedMobilePallet.item.pallet.current_status_name, language)}
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
                    <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                      <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                        {t('location')}
                      </p>
                      <p className="mt-2 text-[11px] font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                        {selectedMobilePallet.item.pallet.current_location || t('notAvailable')}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[1.15rem] border border-zinc-100 bg-white px-3 py-3 dark:border-white/10 dark:bg-[#151d1a]">
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-zinc-400 dark:text-[#9fcbb3]">
                      {mobileCommentLabel}
                    </p>
                    <p className="mt-2 text-[11px] font-bold leading-5 text-zinc-700 dark:text-zinc-200">
                      {selectedMobilePallet.item.pallet.note || t('notAvailable')}
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
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  {t('companyName')}
                </p>
                <p className="mt-3 text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.clientName}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  KVK
                </p>
                <p className="mt-3 text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.kvkLabel}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  {t('ratePerDayLabel')}
                </p>
                <p className="mt-3 text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                  {mobileClientRow.rateLabel}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-[#101715]">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400 dark:text-[#9fcbb3]">
                  {mobileTotalDebtLabel}
                </p>
                <p
                  className={cn(
                    'mt-3 text-lg font-black uppercase tracking-tight dark:text-white',
                    mobileClientRow.overdueTotalValue > 0 ? 'text-rose-600 dark:text-rose-200' : 'text-zinc-950'
                  )}
                >
                  {mobileClientRow.overdueTotalLabel}
                </p>
              </div>
            </div>

            <ClientPalletDesktopTable client={mobileClientRow.client} />

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
      <AdminDataTable<ColumnKey>
        columnOrder={columnOrder}
        initialColumnWidths={INITIAL_COLUMN_WIDTHS}
        minColumnWidths={MIN_COLUMN_WIDTHS}
        resizeAriaLabel={resizeAriaLabel}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isPageLoading && filteredRows.length === 0}
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
                    <div className={headerIconClass}>
                      <Hash size={16} />
                    </div>
                    {renderSortButton('kvk', 'KVK')}
                    {renderFilterButton('kvk')}
                  </div>
                  {renderResizeHandle('kvk')}
                </th>
                <th ref={registerHeaderCell('warehouses')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    <div className={headerIconClass}>
                      <MapPin size={16} />
                    </div>
                    {renderSortButton('warehouses', warehousesHeaderLabel)}
                    {renderFilterButton('warehouses')}
                  </div>
                  {renderResizeHandle('warehouses')}
                </th>
                <th ref={registerHeaderCell('rate')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    <div className={headerIconClass}>
                      <CreditCard size={16} />
                    </div>
                    {renderSortButton('rate', t('ratePerDayLabel'))}
                    {renderFilterButton('rate')}
                  </div>
                  {renderResizeHandle('rate')}
                </th>
                <th ref={registerHeaderCell('overdueTotal')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    <div className={headerIconClass}>
                      <AlertTriangle size={16} />
                    </div>
                    {renderSortButton('overdueTotal', overdueTotalHeaderLabel)}
                    {renderFilterButton('overdueTotal')}
                  </div>
                  {renderResizeHandle('overdueTotal')}
                </th>
                <th ref={registerHeaderCell('atClient')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    <div className={headerIconClass}>
                      <Package size={16} />
                    </div>
                    {renderSortButton('atClient', atClientHeaderLabel)}
                    {renderFilterButton('atClient')}
                  </div>
                  {renderResizeHandle('atClient')}
                </th>
                <th ref={registerHeaderCell('returnReports')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    <div className={headerIconClass}>
                      <Undo2 size={16} />
                    </div>
                    {renderSortButton('returnReports', returnReportsHeaderLabel)}
                    {renderFilterButton('returnReports')}
                  </div>
                  {renderResizeHandle('returnReports')}
                </th>
                {clientIdFilter === undefined && (
                  <th className={cn(headerCellClass, stickyActionsHeaderClass, 'group')}>
                    <div className={headerContentClass}>
                      <div className={headerIconClass}>
                        <Edit size={16} />
                      </div>
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

      <PageLoadingModal isOpen={isPageLoading} language={language} />

      {clientIdFilter === undefined && (
        <ListPagination
          total={paginationMeta.total}
          limit={paginationMeta.limit}
          offset={paginationMeta.offset}
          count={paginationMeta.count}
          isLoading={isPageLoading}
          language={language}
          onPageChange={setPageOffset}
          onLimitChange={
            clientIdFilter === undefined
              ? (limit) => {
                  setPageOffset(0);
                  setPageLimit(limit);
                }
              : undefined
          }
        />
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
