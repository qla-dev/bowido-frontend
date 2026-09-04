import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input, Badge, Button, cn } from './ui';
import {
  Search,
  ArrowUpDown,
  Package,
  Trash2,
  Plus,
  RotateCcw,
  FileSpreadsheet,
  Wrench,
  ChevronDown,
  Funnel,
  X,
  Check,
  LoaderCircle,
  QrCode,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { motion } from 'motion/react';
import { Pallet } from '../types';
import { getLocationLabel as getLocalizedLocationLabel, getPalletTypeLabel, getStatusLabel, palletTypeValues } from '../i18n';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { AdminTableStickyToolbar } from './AdminTableStickyToolbar';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { PageLoadingModal } from './PageLoadingModal';
import { appAlert } from './AppAlert';
import { apiService } from '../services/api';
import { type CustomerPalletReportText } from '../lib/customerPalletReportExport';
import { getPalletDisplayName } from '../lib/palletDisplay';
import { formatAppDate } from '../lib/dateFormat';
import { useInfinitePagination } from '../hooks/useInfinitePagination';
import { rankSearchResults } from '../lib/searchRanking';
import { type QrExportFormat } from '../lib/palletQrExport';

interface PalletTableViewProps {
  onAddPallet?: () => void;
  onEditPallet?: (pallet: Pallet) => void;
  onDeletePallet?: (pallet: Pallet) => void;
  deletedPalletId?: number | null;
}

type SortKey =
  | 'qr'
  | 'type'
  | 'client'
  | 'status'
  | 'lastUpdate'
  | 'dueDate'
  | 'deadline'
  | 'location';
type SortDirection = 'asc' | 'desc';
type ColumnKey = SortKey | 'actions';

type FilterOption = {
  value: string;
  label: string;
};

type FilterSelections = Record<SortKey, string[]>;
type FilterSearch = Record<SortKey, string>;
type ColumnWidths = Record<ColumnKey, number>;
type DeadlineTone = 'muted' | 'success' | 'warning' | 'danger';
type QuickFilterKey = 'status' | 'deadline';
type DeadlineFilter = 'overdue' | 'dueSoon' | 'withinTerm' | 'withoutTerm';
type PalletTimelineInfo = {
  dateLabel: string;
  dateFilterValue: string;
  dateSortValue: number | null;
  termLabel: string;
  termFilterValue: string;
  termSortValue: number | null;
  deadlineLabel: string;
  deadlineFilterValue: string;
  deadlineSortValue: number | null;
  tone: DeadlineTone;
};

const INITIAL_COLUMN_WIDTHS: ColumnWidths = {
  qr: 176,
  type: 176,
  client: 176,
  status: 176,
  dueDate: 176,
  deadline: 176,
  location: 176,
  lastUpdate: 176,
  actions: 176,
};

const PALLET_TABLE_COLUMN_ORDER = [
  'qr',
  'type',
  'client',
  'status',
  'lastUpdate',
  'dueDate',
  'deadline',
  'location',
  'actions',
] as const satisfies readonly ColumnKey[];

const MIN_COLUMN_WIDTHS: ColumnWidths = {
  qr: 144,
  type: 124,
  client: 152,
  status: 140,
  dueDate: 140,
  deadline: 168,
  location: 180,
  lastUpdate: 136,
  actions: 88,
};

const PALLET_PAGE_SIZE = 25;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const getQrExportFilename = (pallets: Array<{ pallet_name: string; qr_code: string }>) => {
  const labels = pallets.map((pallet) => pallet.pallet_name || pallet.qr_code).filter(Boolean);
  if (labels.length === 1) return `qr-export-${labels[0].replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const suffixes = labels.map((label) => label.match(/(\d+)$/)?.[1]);
  if (suffixes.length > 1 && suffixes.every(Boolean)) {
    const width = Math.max(...suffixes.map((suffix) => suffix!.length));
    const numbers = suffixes.map((suffix) => Number(suffix));
    return `qr-export-${String(Math.min(...numbers)).padStart(width, '0')}-${String(Math.max(...numbers)).padStart(width, '0')}`;
  }
  return 'qr-export';
};

const formatDateFilterValue = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const FIXED_WAREHOUSE_LOCATION_BY_STATUS_ID: Partial<Record<number, string>> = {
  1: 'Nikole Tesle 71',
  3: 'Maxwellstraat 2-4, 3316 GP Dordrecht',
};

export const PalletTableView: React.FC<PalletTableViewProps> = ({
  onAddPallet,
  onEditPallet,
  onDeletePallet,
  deletedPalletId,
}) => {
  const { pallets: cachedPallets, statuses, clients, t, language, updatePalletRepairStatus } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const quickFilterRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<ColumnKey, HTMLTableCellElement | null>>>({});
  const [selectedFilters, setSelectedFilters] = useState<FilterSelections>({
    qr: [],
    type: [],
    client: [],
    status: [],
    lastUpdate: [],
    dueDate: [],
    deadline: [],
    location: [],
  });
  const [filterSearch, setFilterSearch] = useState<FilterSearch>({
    qr: '',
    type: '',
    client: '',
    status: '',
    lastUpdate: '',
    dueDate: '',
    deadline: '',
    location: '',
  });
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'qr',
    direction: 'asc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterPallets, setFilterPallets] = useState<Pallet[]>([]);
  const [isFilterDatasetLoading, setIsFilterDatasetLoading] = useState(true);
  const [filterDatasetError, setFilterDatasetError] = useState<unknown>(null);
  const [filterDatasetRequestVersion, setFilterDatasetRequestVersion] = useState(0);
  const [openFilterKey, setOpenFilterKey] = useState<SortKey | null>(null);
  const [openQuickFilter, setOpenQuickFilter] = useState<QuickFilterKey | null>(null);
  const [selectedDeadlineFilters, setSelectedDeadlineFilters] = useState<DeadlineFilter[]>([]);
  const [showReportExportModal, setShowReportExportModal] = useState(false);
  const [isExportingExcelReport, setIsExportingExcelReport] = useState(false);
  const [showQrExportModal, setShowQrExportModal] = useState(false);
  const [qrExportFormats, setQrExportFormats] = useState<QrExportFormat[]>(['svg']);
  const [isExportingQrCodes, setIsExportingQrCodes] = useState(false);
  const [isLoadingQrExportData, setIsLoadingQrExportData] = useState(false);
  const [qrExportPallets, setQrExportPallets] = useState<Array<{ id: number; qr_code: string; pallet_name: string }>>([]);
  const [qrExportMode, setQrExportMode] = useState<'current' | 'range' | 'single'>('current');
  const [qrRangePrefix, setQrRangePrefix] = useState('BOWNL-');
  const [qrRangeStart, setQrRangeStart] = useState('');
  const [qrRangeEnd, setQrRangeEnd] = useState('');
  const [selectedQrExportPalletIds, setSelectedQrExportPalletIds] = useState<string[]>([]);
  const [isQrPalletPickerOpen, setIsQrPalletPickerOpen] = useState(false);
  const [qrPalletSearch, setQrPalletSearch] = useState('');
  const [selectedReportClientId, setSelectedReportClientId] = useState<string>('all');
  const [isReportClientSelectOpen, setIsReportClientSelectOpen] = useState(false);
  const reportClientSelectRef = useRef<HTMLDivElement | null>(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!isReportClientSelectOpen) {
      return;
    }

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!reportClientSelectRef.current?.contains(event.target as Node)) {
        setIsReportClientSelectOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsReportClientSelectOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isReportClientSelectOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchPage = useCallback((offset: number) => apiService.pallets.page({
    limit: PALLET_PAGE_SIZE,
    offset,
    has_qr_code: true,
    search: debouncedSearchQuery || undefined,
    sort_by: sortConfig.key,
    sort_direction: sortConfig.direction,
  }), [debouncedSearchQuery, sortConfig]);
  const { items: pallets, hasMore, isInitialLoading, isLoadingMore, error: paginationError, loadMore, retry, setItems: setPagedPallets } = useInfinitePagination({
    queryKey: `${debouncedSearchQuery}|${sortConfig.key}|${sortConfig.direction}`,
    pageSize: PALLET_PAGE_SIZE,
    fetchPage,
  });

  useEffect(() => {
    let isCurrentRequest = true;

    setIsFilterDatasetLoading(true);
    setFilterDatasetError(null);

    void apiService.pallets
      .list({
        has_qr_code: true,
        search: debouncedSearchQuery || undefined,
      })
      .then((allPallets) => {
        if (isCurrentRequest) {
          setFilterPallets(allPallets);
        }
      })
      .catch((error) => {
        if (isCurrentRequest) {
          setFilterDatasetError(error);
          setFilterPallets([]);
        }
      })
      .finally(() => {
        if (isCurrentRequest) {
          setIsFilterDatasetLoading(false);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [debouncedSearchQuery, filterDatasetRequestVersion]);

  useEffect(() => {
    if (cachedPallets.length === 0) {
      return;
    }

    setPagedPallets((current) =>
      current
        .map((pallet) => cachedPallets.find((cachedPallet) => cachedPallet.id === pallet.id) || pallet)
        .filter((pallet) => pallet.has_qr_code && !pallet.is_ghost)
    );
  }, [cachedPallets]);

  useEffect(() => {
    if (deletedPalletId === null || deletedPalletId === undefined) return;

    setPagedPallets((current) => current.filter((pallet) => pallet.id !== deletedPalletId));
    setFilterPallets((current) => current.filter((pallet) => pallet.id !== deletedPalletId));
  }, [deletedPalletId, setPagedPallets]);

  const togglePalletService = (pallet: Pallet) => {
    const nextIsForRepair = !pallet.is_for_repair;

    // This table is independently paginated, so update its row immediately instead of
    // waiting for the API response to reach the shared pallet cache.
    setPagedPallets((current) => current.map((item) =>
      item.id === pallet.id ? { ...item, is_for_repair: nextIsForRepair } : item
    ));
    setFilterPallets((current) => current.map((item) =>
      item.id === pallet.id ? { ...item, is_for_repair: nextIsForRepair } : item
    ));

    void updatePalletRepairStatus(pallet.id, nextIsForRepair).catch(() => {
      setPagedPallets((current) => current.map((item) => item.id === pallet.id ? pallet : item));
      setFilterPallets((current) => current.map((item) => item.id === pallet.id ? pallet : item));
    });
  };

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideTable = tableRef.current?.contains(target);
      const isInsideMenu = filterMenuRef.current?.contains(target);
      const isInsideQuickFilter = quickFilterRef.current?.contains(target);

      if (!isInsideTable && !isInsideMenu) {
        setOpenFilterKey(null);
      }

      if (!isInsideQuickFilter) {
        setOpenQuickFilter(null);
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
          case 'qr':
            return 240;
          case 'type':
            return 256;
          case 'client':
            return 288;
          case 'status':
            return 256;
          case 'lastUpdate':
            return 224;
          case 'dueDate':
            return 224;
          case 'deadline':
            return 256;
          case 'location':
            return 288;
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

  const searchPlaceholder =
    language === 'bs' ? 'Pretraži' : language === 'nl' ? 'Zoeken' : 'Search';
  const firstColumnLabel =
    language === 'bs' ? 'Paleta' : language === 'nl' ? 'Boknummer' : 'Pallet';
  const showAllLabel =
    language === 'bs' ? 'Prikaži sve' : language === 'nl' ? 'Alles tonen' : 'Show all';
  const noResultsLabel =
    language === 'bs' ? 'Nema rezultata' : language === 'nl' ? 'Geen resultaten' : 'No results';
  const addPalletLabel =
    language === 'bs' ? 'Dodaj paletu' : language === 'nl' ? 'Bok toevoegen' : 'Add pallet';
  const deadlineFilterOptions: Array<{ value: DeadlineFilter; label: string }> = language === 'bs'
    ? [
        { value: 'overdue', label: 'Kasni' },
        { value: 'dueSoon', label: 'Ističe za najviše 2 dana' },
        { value: 'withinTerm', label: 'U roku' },
        { value: 'withoutTerm', label: 'Bez termina' },
      ]
    : language === 'nl'
      ? [
          { value: 'overdue', label: 'Te laat' },
          { value: 'dueSoon', label: 'Verloopt binnen 2 dagen' },
          { value: 'withinTerm', label: 'Binnen termijn' },
          { value: 'withoutTerm', label: 'Geen termijn' },
        ]
      : [
          { value: 'overdue', label: 'Overdue' },
          { value: 'dueSoon', label: 'Due within 2 days' },
          { value: 'withinTerm', label: 'Within term' },
          { value: 'withoutTerm', label: 'No due date' },
        ];
  const reportCopy: CustomerPalletReportText & {
    fabLabel: string;
    modalTitle: string;
    selectedClientLabel: string;
    allClientsOptionLabel: string;
    clientsCountLabel: string;
    palletsCountLabel: string;
    totalDebtLabel: string;
    exportSelectedLabel: string;
    exportAllLabel: string;
    loadingLabel: string;
    emptyStateLabel: string;
    reportFilePrefix: string;
    reportClientFileFallback: string;
  } =
    language === 'bs'
      ? {
          workbookTitle: 'Palete po kupcu',
          summarySheetName: 'Pregled',
          summaryTitle: 'Pregled paleta po kupcu',
          summaryClientLabel: 'Kupac',
          summaryPalletsLabel: 'Broj paleta',
          summaryOverdueLabel: 'Palete s dugom',
          summaryDebtLabel: 'Ukupan dug (EUR)',
          clientSheetPrefix: 'Kupac',
          clientSheetFallback: 'Kupac',
          palletLabel: 'Paleta',
          typeLabel: 'Tip',
          statusLabel: 'Status',
          sentDateLabel: 'Poslana',
          daysAtClientLabel: 'Dana kod kupca',
          graceDaysLabel: 'Dani tolerancije',
          overdueDaysLabel: 'Dana preko',
          debtLabel: 'Dug (EUR)',
          locationLabel: 'Lokacija',
          totalLabel: 'Ukupno',
          fabLabel: 'Excel izvještaj',
          modalTitle: 'Excel izvještaj po kupcu',
          selectedClientLabel: 'Kupac',
          allClientsOptionLabel: 'Svi kupci',
          clientsCountLabel: 'Kupci',
          palletsCountLabel: 'Palete',
          totalDebtLabel: 'Ukupan dug',
          exportSelectedLabel: 'Izvezi kupca',
          exportAllLabel: 'Izvezi sve kupce',
          loadingLabel: 'Podaci se učitavaju, molimo sačekajte',
          emptyStateLabel: 'Nema paleta u naplativom statusu za ovaj izvještaj.',
          reportFilePrefix: 'palete-po-kupcu',
          reportClientFileFallback: 'kupac',
        }
      : language === 'nl'
        ? {
            workbookTitle: 'Bokken per klant',
            summarySheetName: 'Overzicht',
            summaryTitle: 'Overzicht bokken per klant',
            summaryClientLabel: 'Klant',
            summaryPalletsLabel: 'Aantal bokken',
            summaryOverdueLabel: 'Bokken met schuld',
            summaryDebtLabel: 'Totale schuld (EUR)',
            clientSheetPrefix: 'Klant',
            clientSheetFallback: 'Klant',
            palletLabel: 'Bok',
            typeLabel: 'Type',
            statusLabel: 'Status',
            sentDateLabel: 'Verzonden',
            daysAtClientLabel: 'Dagen bij klant',
            graceDaysLabel: 'Tolerantiedagen',
            overdueDaysLabel: 'Dagen te laat',
            debtLabel: 'Schuld (EUR)',
            locationLabel: 'Locatie',
            totalLabel: 'Totaal',
            fabLabel: 'Excel-rapport',
            modalTitle: 'Excel-rapport per klant',
            selectedClientLabel: 'Klant',
            allClientsOptionLabel: 'Alle klanten',
            clientsCountLabel: 'Klanten',
            palletsCountLabel: 'Bokken',
            totalDebtLabel: 'Totale schuld',
            exportSelectedLabel: 'Exporteer klant',
            exportAllLabel: 'Exporteer alle klanten',
            loadingLabel: 'Gegevens worden geladen, een moment geduld',
            emptyStateLabel: 'Geen bokken in factureerbare status voor dit rapport.',
            reportFilePrefix: 'bokken-per-klant',
            reportClientFileFallback: 'klant',
          }
        : {
            workbookTitle: 'Pallets by customer',
            summarySheetName: 'Summary',
            summaryTitle: 'Pallet overview by customer',
            summaryClientLabel: 'Customer',
            summaryPalletsLabel: 'Pallet count',
            summaryOverdueLabel: 'Pallets with debt',
            summaryDebtLabel: 'Total debt (EUR)',
            clientSheetPrefix: 'Customer',
            clientSheetFallback: 'Customer',
            palletLabel: 'Pallet',
            typeLabel: 'Type',
            statusLabel: 'Status',
            sentDateLabel: 'Sent',
            daysAtClientLabel: 'Days at client',
            graceDaysLabel: 'Grace',
            overdueDaysLabel: 'Days overdue',
            debtLabel: 'Debt (EUR)',
            locationLabel: 'Location',
            totalLabel: 'Total',
            fabLabel: 'Excel report',
            modalTitle: 'Excel report by customer',
            selectedClientLabel: 'Customer',
            allClientsOptionLabel: 'All customers',
            clientsCountLabel: 'Customers',
            palletsCountLabel: 'Pallets',
            totalDebtLabel: 'Total debt',
            exportSelectedLabel: 'Export customer',
            exportAllLabel: 'Export all customers',
            loadingLabel: 'Data is loading, please wait',
            emptyStateLabel: 'No pallets in billable status for this report.',
            reportFilePrefix: 'pallets-by-customer',
            reportClientFileFallback: 'customer',
          };
  const transportStatusIds = [2, 6];
  const exportFeedbackCopy =
    language === 'bs'
      ? { title: 'Priprema se izvoz', subtitle: 'Vaš fajl će se automatski preuzeti kada bude spreman.', error: 'Izvoz nije uspio. Molimo pokušajte ponovo.' }
      : language === 'nl'
        ? { title: 'Export wordt voorbereid', subtitle: 'Uw bestand wordt automatisch gedownload zodra het klaar is.', error: 'Exporteren is niet gelukt. Probeer het opnieuw.' }
        : { title: 'Preparing export', subtitle: 'Your file will download automatically when it is ready.', error: 'The export could not be completed. Please try again.' };
  const resizeAriaLabel =
    language === 'bs'
      ? 'Promijeni širinu kolone'
      : language === 'nl'
        ? 'Kolombreedte aanpassen'
        : 'Resize column';
  const timelineCopy =
    language === 'bs'
      ? {
          date: 'Datum',
          term: 'Termin',
          deadline: 'Rok',
          emptyValue: '-',
          daysLeft: 'dana u roku',
          daysLate: 'dana preko',
        }
      : language === 'nl'
        ? {
            date: 'Verzonden',
            term: 'Retour',
            deadline: 'Termijn',
            emptyValue: '-',
            daysLeft: 'dagen resterend',
            daysLate: 'dagen over',
          }
        : {
            date: 'Date',
            term: 'Term',
            deadline: 'Due',
            emptyValue: '-',
            daysLeft: 'days left',
            daysLate: 'days overdue',
          };
  const dateFormatter = useMemo(
    () => ({
      format: (value: string | number | Date) => formatAppDate(value, language),
    }),
    [language]
  );
  const getClientLabel = (pallet: Pallet) =>
    clients.find((client) => client.user_id === pallet.user_id)?.name ||
    pallet.client_name?.trim() ||
    '-';
  const isDeletedClientLabel = (pallet: Pallet) =>
    pallet.client_deleted &&
    !clients.some((client) => client.user_id === pallet.user_id);

  const getTypeLabel = (pallet: Pallet) => getPalletTypeLabel(pallet.type, language);

  const getStatusLabelText = (pallet: Pallet) =>
    getStatusLabel(pallet.current_status_name, language);

  const getLocationLabel = (pallet: Pallet) =>
    FIXED_WAREHOUSE_LOCATION_BY_STATUS_ID[pallet.current_status_id] ||
    getLocalizedLocationLabel(pallet.current_location, language) ||
    t('notAvailable');

  const palletTimelineMap = useMemo<Record<number, PalletTimelineInfo>>(
    () =>
      Object.fromEntries(
        Array.from(
          new Map(
            [...filterPallets, ...pallets].map((pallet) => [pallet.id, pallet]),
          ).values(),
        ).map((pallet) => {
          // A pickup request closes the customer timer. Its original start and
          // frozen finish are supplied by the API, while older pallets fall
          // back to their status-change timestamp.
          const statusSlug = pallet.current_status_slug || '';
          const usesCustomerTimer = ['bij-de-klant', 'ophalen-klant'].includes(statusSlug);
          const changedAt = new Date(
            usesCustomerTimer ? pallet.customer_timer_started_at || pallet.last_status_changed_at : pallet.last_status_changed_at,
          );
          const frozenAt = usesCustomerTimer && pallet.customer_timer_frozen_at
            ? new Date(pallet.customer_timer_frozen_at)
            : null;
          const status = statuses.find((item) => item.id === pallet.current_status_id);
          const client = pallet.user_id
            ? clients.find((item) => item.user_id === pallet.user_id)
            : undefined;
          const changedAtMidnight = new Date(
            changedAt.getFullYear(),
            changedAt.getMonth(),
            changedAt.getDate()
          );
          const today = new Date();
          const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const msPerDay = 24 * 60 * 60 * 1000;
          const counterEnd = frozenAt && !Number.isNaN(frozenAt.getTime()) ? frozenAt : today;
          const counterEndAtMidnight = new Date(
            counterEnd.getFullYear(),
            counterEnd.getMonth(),
            counterEnd.getDate(),
          );
          const daysSinceChange = Math.max(
            0,
            Math.floor((counterEndAtMidnight.getTime() - changedAtMidnight.getTime()) / msPerDay)
          );
          const isWarehouseStatus =
            ['bowido-nl', 'bowido-bih', 'bowido_warehouse', 'bowido_nl'].includes(statusSlug) ||
            pallet.current_status_id === 1 || pallet.current_status_id === 3;

          if (isWarehouseStatus) {
            return [
              pallet.id,
              {
                dateLabel: timelineCopy.emptyValue,
                dateFilterValue: timelineCopy.emptyValue,
                dateSortValue: null,
                termLabel: timelineCopy.emptyValue,
                termFilterValue: timelineCopy.emptyValue,
                termSortValue: null,
                deadlineLabel: timelineCopy.emptyValue,
                deadlineFilterValue: timelineCopy.emptyValue,
                deadlineSortValue: null,
                tone: 'muted' as const,
              },
            ];
          }

          let graceDays = 0;

          if (
            ['bih-nl-transport', 'nl-bih-transport', 'transport', 'transport_bih_nl', 'transport_nl_bih'].includes(statusSlug) ||
            transportStatusIds.includes(pallet.current_status_id)
          ) {
            graceDays = pallet.grace_days ?? status?.grace_period_days ?? 3;
          } else if (status?.is_billable || frozenAt) {
            graceDays = pallet.grace_days ?? client?.grace_period_days ?? status?.grace_period_days ?? 0;
          }

          if (graceDays <= 0) {
            return [
              pallet.id,
              {
                dateLabel: dateFormatter.format(changedAt),
                dateFilterValue: formatDateFilterValue(changedAt),
                dateSortValue: changedAt.getTime(),
                termLabel: timelineCopy.emptyValue,
                termFilterValue: timelineCopy.emptyValue,
                termSortValue: null,
                deadlineLabel: timelineCopy.emptyValue,
                deadlineFilterValue: timelineCopy.emptyValue,
                deadlineSortValue: null,
                tone: 'muted' as const,
              },
            ];
          }

          const dueDate = new Date(changedAtMidnight);
          dueDate.setDate(dueDate.getDate() + graceDays);
          const remainingDays = graceDays - daysSinceChange;
          const isOverdue = remainingDays < 0;
          const frozenLabel = frozenAt
            ? ` - ${language === 'bs' ? 'zaustavljeno' : language === 'nl' ? 'bevroren' : 'frozen'}`
            : '';

          return [
            pallet.id,
            {
              dateLabel: dateFormatter.format(changedAt),
              dateFilterValue: formatDateFilterValue(changedAt),
              dateSortValue: changedAt.getTime(),
              termLabel: dateFormatter.format(dueDate),
              termFilterValue: formatDateFilterValue(dueDate),
              termSortValue: dueDate.getTime(),
              deadlineLabel: `${isOverdue
                ? `${Math.abs(remainingDays)} ${timelineCopy.daysLate}`
                : `${remainingDays} ${timelineCopy.daysLeft}`}${frozenLabel}`,
              deadlineFilterValue: `${isOverdue
                ? `${Math.abs(remainingDays)} ${timelineCopy.daysLate}`
                : `${remainingDays} ${timelineCopy.daysLeft}`}${frozenLabel}`,
              deadlineSortValue: remainingDays,
              tone: isOverdue ? 'danger' : remainingDays <= 2 ? 'warning' : 'success',
            },
          ];
        })
      ),
    [clients, dateFormatter, filterPallets, pallets, statuses, timelineCopy, transportStatusIds]
  );

  const getTimelineInfo = (pallet: Pallet) => palletTimelineMap[pallet.id];
  // Client choices come from the already-loaded client directory. The actual
  // report data is intentionally fetched and calculated only by the backend.
  const reportExportClients = useMemo(
    () => [...clients]
      .filter((client) => client.is_active)
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })),
    [clients]
  );

  useEffect(() => {
    if (selectedReportClientId === 'all') {
      return;
    }

    if (!reportExportClients.some((client) => String(client.user_id) === selectedReportClientId)) {
      setSelectedReportClientId('all');
    }
  }, [reportExportClients, selectedReportClientId]);

  const selectedReportClient =
    selectedReportClientId === 'all'
      ? null
      : reportExportClients.find((client) => String(client.user_id) === selectedReportClientId) || null;
  const reportSummary = useMemo(() => {
    const clientIds = new Set<number>();
    let palletsCount = 0;
    let totalDebt = 0;

    filterPallets.forEach((pallet) => {
      const status = statuses.find((item) => item.id === pallet.current_status_id);
      if (!pallet.user_id || !status?.is_billable) return;

      const client = clients.find((item) => item.user_id === pallet.user_id);
      const clientName = client?.name || pallet.client_name?.trim() || '';
      if (!clientName || clientName.trim().toLocaleLowerCase() === 'na stanju') return;

      const startedAt = pallet.customer_timer_started_at || pallet.last_status_changed_at;
      const endAt = pallet.customer_timer_frozen_at || new Date().toISOString();
      const daysAtClient = Math.max(0, Math.floor((new Date(endAt).setHours(0, 0, 0, 0) - new Date(startedAt).setHours(0, 0, 0, 0)) / 86_400_000));
      const overdueDays = Math.max(0, daysAtClient - (client?.grace_period_days ?? status.grace_period_days ?? 0));

      clientIds.add(pallet.user_id);
      palletsCount += 1;
      totalDebt += overdueDays * (client?.price_per_day ?? status.price_per_day ?? 0);
    });

    return { clientsCount: clientIds.size, palletsCount, totalDebt: Number(totalDebt.toFixed(2)) };
  }, [clients, filterPallets, statuses]);
  const reportCurrencyFormatter = new Intl.NumberFormat(
    language === 'nl' ? 'nl-NL' : language === 'bs' ? 'bs-BA' : 'en-GB',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );
  // “Current list” must follow the same active column/deadline filters as the
  // table. Without a column filter, keep the complete search result instead of
  // only the currently rendered pagination page.
  const hasActiveQrExportFilters =
    selectedDeadlineFilters.length > 0 ||
    (Object.keys(selectedFilters) as SortKey[]).some((key) => selectedFilters[key].length > 0);
  const currentListPallets = hasActiveQrExportFilters
    ? filterPallets.filter((pallet) => {
        const timelineInfo = getTimelineInfo(pallet);
        const matchesColumnFilters = (Object.keys(selectedFilters) as SortKey[]).every((key) => {
          const values = selectedFilters[key];
          if (values.length === 0) return true;
          const value = key === 'qr' ? getPalletDisplayName(pallet)
            : key === 'type' ? getTypeLabel(pallet)
              : key === 'client' ? getClientLabel(pallet)
                : key === 'status' ? getStatusLabelText(pallet)
                  : key === 'lastUpdate' ? timelineInfo.dateFilterValue
                    : key === 'dueDate' ? timelineInfo.termFilterValue
                      : key === 'deadline' ? timelineInfo.deadlineFilterValue
                        : getLocationLabel(pallet);
          return values.includes(value);
        });
        const matchesDeadlineFilters = selectedDeadlineFilters.length === 0 || selectedDeadlineFilters.some((filter) =>
          (filter === 'overdue' && timelineInfo.tone === 'danger') ||
          (filter === 'dueSoon' && timelineInfo.tone === 'warning') ||
          (filter === 'withinTerm' && timelineInfo.tone === 'success') ||
          (filter === 'withoutTerm' && timelineInfo.tone === 'muted')
        );
        return matchesColumnFilters && matchesDeadlineFilters;
      })
    : filterPallets;
  const exportablePallets = currentListPallets.filter((pallet) => Boolean(pallet.qr_code?.trim()));
  const rangePallets = qrExportPallets.filter((pallet) => {
    const start = Number(qrRangeStart);
    const end = Number(qrRangeEnd);
    const normalizedPrefix = qrRangePrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!normalizedPrefix || !Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      return false;
    }

    // QR payloads may be a raw code or a scan URL, while pallet_name is always
    // the visible code. Match either value and compare the numeric suffix as a
    // number, so 15 and 0015 select exactly the same pallet.
    return [pallet.pallet_name, pallet.qr_code].some((value) => {
      const match = value.trim().toUpperCase().match(/([A-Z]+)[-_ ]*(\d+)\D*$/);
      return Boolean(
        match
          && match[1].replace(/[^A-Z0-9]/g, '') === normalizedPrefix
          && Number(match[2]) >= start
          && Number(match[2]) <= end
      );
    });
  });
  const selectedQrExportPallets = qrExportMode === 'current'
    ? (exportablePallets.length > 0 ? exportablePallets : qrExportPallets)
    : qrExportMode === 'range'
      ? rangePallets
      : qrExportPallets.filter((pallet) => selectedQrExportPalletIds.includes(String(pallet.id)));
  const visibleQrPalletOptions = useMemo(() => {
    const search = qrPalletSearch.trim().toLowerCase();
    const matchingPallets = qrExportPallets.filter((pallet) =>
      `${pallet.pallet_name} ${pallet.qr_code}`.toLowerCase().includes(search)
    );
    const selectedPallets = selectedQrExportPalletIds
      .map((id) => matchingPallets.find((pallet) => String(pallet.id) === id))
      .filter((pallet): pallet is { id: number; qr_code: string; pallet_name: string } => Boolean(pallet));
    const selectedIds = new Set(selectedQrExportPalletIds);
    return [...selectedPallets, ...matchingPallets.filter((pallet) => !selectedIds.has(String(pallet.id)))].slice(0, 80);
  }, [qrExportPallets, qrPalletSearch, selectedQrExportPalletIds]);
  const selectedQrPalletLabel = selectedQrExportPallets.length === 1
    ? selectedQrExportPallets[0].pallet_name
    : '';
  const qrSelectedCountLabel = language === 'nl'
    ? `${selectedQrExportPallets.length} ${selectedQrExportPallets.length === 1 ? 'bok' : 'bokken'} geselecteerd`
    : language === 'bs'
      ? `${selectedQrExportPallets.length} ${selectedQrExportPallets.length === 1 ? 'paleta' : 'paleta'} odabrano`
      : `${selectedQrExportPallets.length} ${selectedQrExportPallets.length === 1 ? 'pallet' : 'pallets'} selected`;
  const toggleQrExportFormat = (format: QrExportFormat) => setQrExportFormats((current) =>
    current.includes(format) ? current.filter((value) => value !== format) : [...current, format]
  );
  const handleExportQrCodes = async () => {
    if (qrExportFormats.length === 0 || selectedQrExportPallets.length === 0) return;
    setIsExportingQrCodes(true);
    try {
      const blob = await apiService.pallets.exportQr(selectedQrExportPallets.map((pallet) => pallet.id), qrExportFormats);
      downloadBlob(blob, `${getQrExportFilename(selectedQrExportPallets)}.zip`);
      setShowQrExportModal(false);
    } catch {
      void appAlert.fire({ icon: 'error', title: exportFeedbackCopy.error });
    } finally {
      setIsExportingQrCodes(false);
    }
  };
  const loadQrExportPallets = async () => {
    setIsLoadingQrExportData(true);
    try {
      setQrExportPallets(await apiService.pallets.qrExportList());
    } catch {
      setQrExportPallets(exportablePallets);
    } finally {
      setIsLoadingQrExportData(false);
    }
  };

  useEffect(() => {
    void loadQrExportPallets();
  }, []);

  const getFilterValue = (pallet: Pallet, key: SortKey) => {
    const timelineInfo = getTimelineInfo(pallet);

    switch (key) {
      case 'qr':
        return getPalletDisplayName(pallet);
      case 'type':
        return getTypeLabel(pallet);
      case 'client':
        return getClientLabel(pallet);
      case 'status':
        return getStatusLabelText(pallet);
      case 'lastUpdate':
        return timelineInfo.dateFilterValue;
      case 'dueDate':
        return timelineInfo.termFilterValue;
      case 'deadline':
        return timelineInfo.deadlineFilterValue;
      case 'location':
        return getLocationLabel(pallet);
      default:
        return '';
    }
  };

  const filterOptions = useMemo<Record<SortKey, FilterOption[]>>(
    () => ({
      qr: Array.from<string>(new Set(filterPallets.map((pallet) => getPalletDisplayName(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      type: Array.from<string>(
        new Set([...palletTypeValues, ...filterPallets.map((pallet) => getTypeLabel(pallet))])
      )
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      client: Array.from<string>(new Set(filterPallets.map((pallet) => getClientLabel(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      status: Array.from<string>(new Set(filterPallets.map((pallet) => getStatusLabelText(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      lastUpdate: Array.from<string>(
        new Set(filterPallets.map((pallet) => getTimelineInfo(pallet).dateFilterValue))
      )
        .sort((left, right) => {
          if (left === timelineCopy.emptyValue) {
            return 1;
          }

          if (right === timelineCopy.emptyValue) {
            return -1;
          }

          return right.localeCompare(left);
        })
        .map((value) => ({
          value,
          label: value === timelineCopy.emptyValue ? value : dateFormatter.format(new Date(value)),
        })),
      dueDate: Array.from<string>(
        new Set(filterPallets.map((pallet) => getTimelineInfo(pallet).termFilterValue))
      )
        .sort((left, right) => {
          if (left === timelineCopy.emptyValue) {
            return 1;
          }

          if (right === timelineCopy.emptyValue) {
            return -1;
          }

          return right.localeCompare(left);
        })
        .map((value) => ({
          value,
          label: value === timelineCopy.emptyValue ? value : dateFormatter.format(new Date(value)),
        })),
      deadline: Array.from<string>(
        new Set(filterPallets.map((pallet) => getTimelineInfo(pallet).deadlineFilterValue))
      )
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      location: Array.from<string>(new Set(filterPallets.map((pallet) => getLocationLabel(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
    }),
    [clients, dateFormatter, filterPallets, language, t, timelineCopy.emptyValue]
  );

  const quickStatusOptions = useMemo(
    () => statuses
      .filter((status) => status.is_active)
      .map((status) => ({ value: getStatusLabel(status.name, language), label: getStatusLabel(status.name, language) }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
    [language, statuses]
  );

  const hasActiveTableFilters = useMemo(
    () =>
      selectedDeadlineFilters.length > 0 ||
      (Object.keys(selectedFilters) as SortKey[]).some(
        (key) => selectedFilters[key].length > 0,
      ),
    [selectedDeadlineFilters, selectedFilters],
  );

  const filteredPallets = useMemo(() => {
    const sourcePallets = hasActiveTableFilters ? filterPallets : pallets;
    const matchingPallets = sourcePallets.filter((pallet) => {
      const matchesColumnFilters = (Object.keys(selectedFilters) as SortKey[]).every((key) => {
        const selectedValues = selectedFilters[key];

        if (selectedValues.length === 0) {
          return true;
        }

        return selectedValues.includes(getFilterValue(pallet, key));
      });
      const timelineInfo = getTimelineInfo(pallet);
      const matchesDeadlineFilters = selectedDeadlineFilters.length === 0 || selectedDeadlineFilters.some((filter) => {
        switch (filter) {
          case 'overdue': return timelineInfo.tone === 'danger';
          case 'dueSoon': return timelineInfo.tone === 'warning';
          case 'withinTerm': return timelineInfo.tone === 'success';
          case 'withoutTerm': return timelineInfo.tone === 'muted';
        }
      });

      return matchesColumnFilters && matchesDeadlineFilters;
    });

    if (!hasActiveTableFilters) {
      return matchingPallets;
    }

    const getSortValue = (pallet: Pallet): string | number | null => {
      const timelineInfo = getTimelineInfo(pallet);

      switch (sortConfig.key) {
        case 'qr':
          return getPalletDisplayName(pallet);
        case 'type':
          return getTypeLabel(pallet);
        case 'client':
          return getClientLabel(pallet);
        case 'status':
          return getStatusLabelText(pallet);
        case 'lastUpdate':
          return timelineInfo.dateSortValue;
        case 'dueDate':
          return timelineInfo.termSortValue;
        case 'deadline':
          return timelineInfo.deadlineSortValue;
        case 'location':
          return getLocationLabel(pallet);
        default:
          return null;
      }
    };

    return [...matchingPallets].sort((left, right) => {
      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);

      if (leftValue === null && rightValue === null) {
        return left.id - right.id;
      }

      if (leftValue === null) {
        return 1;
      }

      if (rightValue === null) {
        return -1;
      }

      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, {
              numeric: true,
              sensitivity: 'base',
            });

      if (comparison !== 0) {
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      return left.id - right.id;
    });
  }, [clients, filterPallets, hasActiveTableFilters, language, pallets, selectedDeadlineFilters, selectedFilters, sortConfig, palletTimelineMap]);

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: key === 'lastUpdate' ? 'desc' : 'asc',
      };
    });
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
    setSelectedFilters((current) => ({
      ...current,
      [key]: [],
    }));
    setFilterSearch((current) => ({
      ...current,
      [key]: '',
    }));
  };

  const resetFilters = () => {
    setSelectedFilters({
      qr: [],
      type: [],
      client: [],
      status: [],
      lastUpdate: [],
      dueDate: [],
      deadline: [],
      location: [],
    });
    setFilterSearch({
      qr: '',
      type: '',
      client: '',
      status: '',
      lastUpdate: '',
      dueDate: '',
      deadline: '',
      location: '',
    });
    setSortConfig({
      key: 'qr',
      direction: 'asc',
    });
    setSelectedDeadlineFilters([]);
    setOpenFilterKey(null);
    setOpenQuickFilter(null);
  };
  const handleExportCustomerReport = (mode: 'selected' | 'all') => {
    if (mode === 'selected' && !selectedReportClient) {
      return;
    }

    setIsExportingExcelReport(true);
    void apiService.pallets
      .exportExcelReport(mode === 'all' ? undefined : [selectedReportClient.user_id], language)
      .then((blob) => {
        downloadBlob(blob, `${reportCopy.reportFilePrefix}.xlsx`);
        setShowReportExportModal(false);
      })
      .catch(() => appAlert.fire({ icon: 'error', title: exportFeedbackCopy.error }))
      .finally(() => setIsExportingExcelReport(false));
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
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100'
              : 'border-transparent text-zinc-900 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-50'
          )}
        >
          <span className="block min-w-0 truncate">{label}</span>
          <ArrowUpDown
            size={13}
            className={cn('shrink-0 transition-transform', isActive && sortConfig.direction === 'desc' && 'rotate-180')}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenQuickFilter(null);
            setOpenFilterKey((current) => current === key ? null : key);
          }}
          aria-label={`${t('filter')}: ${label}`}
          aria-expanded={isFilterOpen}
          title={`${t('filter')}: ${label}`}
          className={cn(
            'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors',
            activeFilterCount > 0 || isFilterOpen
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100'
              : 'border-transparent text-zinc-400 hover:border-zinc-200 hover:bg-white hover:text-zinc-700 dark:text-zinc-500 dark:hover:border-white/15 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200'
          )}
        >
          <Funnel size={13} fill={activeFilterCount > 0 ? 'currentColor' : 'none'} />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#00A655] px-1 text-[8px] font-black leading-none text-white ring-2 ring-zinc-50 dark:ring-[#18181b]">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>
    );
  };

  const hasActiveFilter = (key: SortKey) => selectedFilters[key].length > 0;
  const {
    headerCellClass,
    headerContentClass,
    bodyCellClass,
    bodyCellInnerClass,
    bodyTextClass,
  } = adminTableStyles;
  const textFilterInputClass =
    'h-10 bg-white px-3 text-left text-[12px] normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal dark:bg-[#18181b] dark:text-zinc-100 dark:placeholder:text-zinc-500';
  const stickyActionsHeaderClass =
    'sticky right-0 z-20 border-l border-zinc-200 bg-zinc-50/95 shadow-[-14px_0_24px_-20px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/20 dark:bg-[#18181b]/95 dark:shadow-[-16px_0_30px_-18px_rgba(0,0,0,0.9)]';
  const stickyActionsCellClass =
    'sticky right-0 z-10 border-l border-zinc-100 bg-white/95 shadow-[-14px_0_24px_-20px_rgba(15,23,42,0.35)] backdrop-blur group-hover:bg-zinc-50/95 dark:border-white/20 dark:bg-[#141416]/95 dark:shadow-[-16px_0_30px_-18px_rgba(0,0,0,0.9)] dark:group-hover:bg-[#202024]/95';
  const getDeadlineToneClass = (tone: DeadlineTone) => {
    switch (tone) {
      case 'danger':
        return 'bg-rose-500 text-rose-600';
      case 'warning':
        return 'bg-amber-500 text-amber-600';
      case 'success':
        return 'bg-emerald-500 text-emerald-600';
      default:
        return 'bg-zinc-300 text-zinc-300';
    }
  };

  const toggleDeadlineFilter = (filter: DeadlineFilter) => {
    setSelectedDeadlineFilters((current) => current.includes(filter)
      ? current.filter((item) => item !== filter)
      : [...current, filter]);
  };

  const renderQuickFilterOption = (label: string, checked: boolean, onClick: () => void) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[11px] font-bold normal-case tracking-normal transition-colors',
        checked
          ? 'bg-emerald-50 text-emerald-800 dark:bg-white/[0.1] dark:text-zinc-50'
          : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/[0.07]'
      )}
    >
      <span className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        checked ? 'border-[#00A655] bg-[#00A655] text-white' : 'border-zinc-300 bg-white dark:border-white/30 dark:bg-transparent'
      )}>
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  );

  const renderQuickFilterMenu = (key: QuickFilterKey) => {
    if (openQuickFilter !== key) return null;

    const isStatus = key === 'status';
    const options = isStatus ? quickStatusOptions : deadlineFilterOptions;
    const selectedCount = isStatus ? selectedFilters.status.length : selectedDeadlineFilters.length;
    const toggleAll = () => {
      if (isStatus) {
        setSelectedFilters((current) => ({
          ...current,
          status: options.every((option) => current.status.includes(option.value))
            ? []
            : options.map((option) => option.value),
        }));
        return;
      }

      setSelectedDeadlineFilters((current) =>
        options.every((option) => current.includes(option.value as DeadlineFilter))
          ? []
          : options.map((option) => option.value as DeadlineFilter)
      );
    };

    return (
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.28)] dark:border-white/15 dark:bg-[#101113] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
        <button type="button" onClick={toggleAll} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-zinc-50">
          <span>{showAllLabel}</span><RotateCcw size={12} />
        </button>
        <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-100 bg-zinc-50/50 p-1 dark:border-white/15 dark:bg-[#18181b]">
          {options.length > 0 ? options.map((option) => {
            const value = option.value;
            const checked = isStatus
              ? selectedFilters.status.includes(value)
              : selectedDeadlineFilters.includes(value as DeadlineFilter);
            return renderQuickFilterOption(option.label, checked, () => isStatus
              ? toggleFilterSelection('status', value)
              : toggleDeadlineFilter(value as DeadlineFilter));
          }) : <p className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{noResultsLabel}</p>}
        </div>
        {selectedCount > 0 && <p className="px-3 pt-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-200">{selectedCount}</p>}
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
        className="fixed z-30 flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.28)] dark:border-white/15 dark:bg-[#101113] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
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
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-zinc-50"
          >
            <span>{showAllLabel}</span>
            <RotateCcw size={12} />
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-zinc-100 bg-zinc-50/50 p-1 dark:border-white/15 dark:bg-[#18181b]">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <label
                  key={`${key}-${option.value}`}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-[11px] font-bold normal-case tracking-normal transition-colors',
                    selectedFilters[key].includes(option.value)
                      ? 'bg-emerald-50 text-emerald-800 dark:bg-white/[0.1] dark:text-zinc-50'
                      : 'text-zinc-700 hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.07] dark:hover:text-zinc-50'
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
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-zinc-900 dark:text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
            <Package size={16} />
          </span>
          {t('adminPalletOverview')}
        </h2>
        <div ref={quickFilterRef} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-64">
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

      <AdminDataTable<ColumnKey>
        columnOrder={PALLET_TABLE_COLUMN_ORDER}
        initialColumnWidths={INITIAL_COLUMN_WIDTHS}
        minColumnWidths={MIN_COLUMN_WIDTHS}
        resizeAriaLabel={resizeAriaLabel}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isInitialLoading && filteredPallets.length === 0}
        emptyState={
          <div className="p-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-100 bg-zinc-50">
              <Search size={20} className="text-zinc-200" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
              {paginationError ? t('noMatchingResults') : t('noMatchingResults')}
            </p>
          </div>
        }
        renderTable={({
          columnWidths,
          totalTableWidth,
          registerHeaderCell,
          registerAutoSizeContent,
          renderResizeHandle,
        }) => (
          <table
            className="border-collapse text-left [table-layout:fixed]"
            style={{ width: `max(100%, ${totalTableWidth}px)` }}
          >
            <colgroup>
              <col style={{ width: columnWidths.qr }} />
              <col style={{ width: columnWidths.type }} />
              <col style={{ width: columnWidths.client }} />
              <col style={{ width: columnWidths.status }} />
              <col style={{ width: columnWidths.lastUpdate }} />
              <col style={{ width: columnWidths.dueDate }} />
              <col style={{ width: columnWidths.deadline }} />
              <col style={{ width: columnWidths.location }} />
              <col style={{ width: columnWidths.actions }} />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80 dark:border-white/20 dark:bg-[#18181b]">
              <tr>
                <th ref={registerHeaderCell('qr')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('qr', firstColumnLabel)}
                  </div>
                  {renderResizeHandle('qr')}
                </th>
                <th ref={registerHeaderCell('type')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('type', t('type'))}
                  </div>
                  {renderResizeHandle('type')}
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
                <th ref={registerHeaderCell('lastUpdate')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('lastUpdate', timelineCopy.date)}
                  </div>
                  {renderResizeHandle('lastUpdate')}
                </th>
                <th ref={registerHeaderCell('dueDate')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('dueDate', timelineCopy.term)}
                  </div>
                  {renderResizeHandle('dueDate')}
                </th>
                <th ref={registerHeaderCell('deadline')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('deadline', timelineCopy.deadline)}
                  </div>
                  {renderResizeHandle('deadline')}
                </th>
                <th ref={registerHeaderCell('location')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    {renderSortButton('location', t('location'))}
                  </div>
                  {renderResizeHandle('location')}
                </th>
                <th className={cn(headerCellClass, stickyActionsHeaderClass, 'group')}>
                  <div className={headerContentClass}>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] leading-none text-zinc-900 dark:text-zinc-300">
                      {t('actions')}
                    </p>
                  </div>
                  {renderResizeHandle('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/15">
              {filteredPallets.map((pallet, index) => {
                const clientLabel = getClientLabel(pallet);
                const timelineInfo = getTimelineInfo(pallet);

                return (
                  <motion.tr
                    key={`table-row-${pallet.id}`}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.01 }}
                    onClick={() => onEditPallet?.(pallet)}
                    onKeyDown={(event) => {
                      if (!onEditPallet) {
                        return;
                      }

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onEditPallet(pallet);
                      }
                    }}
                    tabIndex={onEditPallet ? 0 : -1}
                    role={onEditPallet ? 'button' : undefined}
                    className={cn(
                      'group transition-colors hover:bg-zinc-50/60 dark:hover:bg-white/[0.05]',
                      onEditPallet && 'cursor-pointer focus-visible:bg-zinc-50/80 focus-visible:outline-none dark:focus-visible:bg-white/[0.08]'
                    )}
                  >
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span className={cn(bodyTextClass, pallet.is_for_repair ? 'text-rose-600 dark:text-rose-300' : 'text-zinc-900 dark:text-zinc-300')}>
                          {getPalletDisplayName(pallet)}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span className={cn(bodyTextClass, 'uppercase text-zinc-600 dark:text-zinc-300')}>
                          {getTypeLabel(pallet)}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span
                          className={cn(
                            bodyTextClass,
                            'uppercase',
                            isDeletedClientLabel(pallet)
                              ? 'text-rose-600 dark:text-rose-300'
                              : 'text-zinc-900 dark:text-zinc-200',
                          )}
                        >
                          {clientLabel}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.75rem] items-center justify-center">
                        <Badge
                          variant={
                            pallet.is_for_repair
                              ? 'danger'
                              : pallet.current_status_id === 4
                                ? 'success'
                                : 'info'
                          }
                          className="min-h-[1.875rem] rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-tight normal-case"
                        >
                          {getStatusLabelText(pallet)}
                        </Badge>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span className={cn(bodyTextClass, 'text-zinc-400 dark:text-zinc-300')}>
                          {timelineInfo.dateLabel}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span className={cn(bodyTextClass, 'text-zinc-500 dark:text-zinc-300')}>
                          {timelineInfo.termLabel}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span
                          ref={registerAutoSizeContent('deadline')}
                          className={cn(
                            'inline-flex items-center gap-2.5 whitespace-nowrap text-[11px] font-bold tracking-tight',
                            timelineInfo.tone === 'muted'
                              ? 'text-zinc-300'
                              : getDeadlineToneClass(timelineInfo.tone).split(' ')[1]
                          )}
                        >
                          <span
                            className={cn(
                              'h-3 w-3 shrink-0 rounded-full',
                              getDeadlineToneClass(timelineInfo.tone).split(' ')[0]
                            )}
                          />
                          <span>
                            {timelineInfo.deadlineLabel}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span className={cn(bodyTextClass, 'text-zinc-500 dark:text-zinc-300')}>
                          {getLocationLabel(pallet)}
                        </span>
                      </div>
                    </td>
                    <td className={cn(bodyCellClass, stickyActionsCellClass)}>
                      <div className="flex min-h-[2.75rem] items-center justify-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className={cn(
                              'h-10 w-10 p-0',
                              pallet.is_for_repair
                                ? 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700'
                                : 'border-emerald-200 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800'
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePalletService(pallet);
                            }}
                            title={pallet.is_for_repair ? t('unmarkForRepair') : t('markForRepair')}
                            aria-label={pallet.is_for_repair ? t('unmarkForRepair') : t('markForRepair')}
                            aria-pressed={pallet.is_for_repair}
                          >
                            <Wrench size={15} />
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="xs"
                            className="h-10 w-10 p-0"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeletePallet?.(pallet);
                            }}
                            title={t('remove')}
                            aria-label={t('remove')}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        )}
      />
      <PageLoadingModal
        isOpen={isInitialLoading || (hasActiveTableFilters && isFilterDatasetLoading)}
        language={language}
      />
      <InfiniteScrollFooter
        hasMore={!hasActiveTableFilters && hasMore}
        isLoading={hasActiveTableFilters ? isFilterDatasetLoading : isLoadingMore}
        error={hasActiveTableFilters ? filterDatasetError : paginationError}
        onLoadMore={hasActiveTableFilters ? () => undefined : loadMore}
        onRetry={
          hasActiveTableFilters
            ? () => setFilterDatasetRequestVersion((current) => current + 1)
            : retry
        }
        language={language}
      />
      {openFilterKey && renderFilterMenu(openFilterKey)}

      {typeof document !== 'undefined' && createPortal(
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-20 flex items-center gap-3 md:bottom-20 md:right-8">
        <div className="group relative">
          <button
            type="button"
            onClick={() => setShowReportExportModal(true)}
            disabled={isExportingExcelReport}
            aria-busy={isExportingExcelReport}
            className={cn(
              'inline-flex h-14 items-center gap-2 rounded-full px-5 text-[11px] font-black uppercase tracking-[0.14em] shadow-[0_18px_36px_-18px_rgba(0,166,85,0.8)] transition-transform disabled:cursor-default',
              isExportingExcelReport
                ? 'bg-emerald-600 text-white/90'
                : 'bg-[#00A655] text-white hover:scale-[1.02]'
            )}
          >
            {isExportingExcelReport ? (
              <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            {reportCopy.fabLabel}
          </button>
        </div>

        <div className="group relative">
          <button
            type="button"
            onClick={() => setShowQrExportModal(true)}
            disabled={isLoadingQrExportData}
            aria-busy={isLoadingQrExportData}
            aria-describedby={isLoadingQrExportData ? 'qr-export-data-loading-tooltip' : undefined}
            className={cn(
              'inline-flex h-14 items-center gap-2 rounded-full px-5 text-[11px] font-black uppercase tracking-[0.14em] shadow-[0_18px_36px_-18px_rgba(0,166,85,0.8)] transition-transform disabled:cursor-default',
              isLoadingQrExportData
                ? 'bg-emerald-600 text-white/90'
                : 'bg-[#00A655] text-white hover:scale-[1.02]'
            )}
          >
            {isLoadingQrExportData ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <QrCode size={16} />}
            {t('qrExport')}
          </button>
          {isLoadingQrExportData && (
            <div id="qr-export-data-loading-tooltip" role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-3 w-max max-w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-center text-[11px] font-bold normal-case tracking-normal text-[var(--text-primary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {t('qrExportLoading')}
            </div>
          )}
        </div>

        {onAddPallet && (
          <button
            type="button"
            onClick={onAddPallet}
            className="inline-flex h-14 items-center gap-2 rounded-full bg-[#00A655] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_36px_-18px_rgba(0,166,85,0.8)] transition-transform hover:scale-[1.02]"
          >
            <Plus size={16} />
            {addPalletLabel}
          </button>
        )}
      </div>, document.body)}

      {(isExportingExcelReport || isExportingQrCodes) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-[2px]" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-[1.75rem] border border-zinc-200 bg-white p-7 text-center shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <LoaderCircle size={28} className="animate-spin" aria-hidden="true" />
            </div>
            <h3 className="mt-5 text-xl font-black tracking-tight text-zinc-950">{exportFeedbackCopy.title}</h3>
            <p className="mt-2 text-sm font-medium leading-6 text-zinc-500">{exportFeedbackCopy.subtitle}</p>
          </div>
        </div>
      )}

      {showReportExportModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  {reportCopy.fabLabel}
                </p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">
                  {reportCopy.modalTitle}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowReportExportModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900"
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{reportCopy.clientsCountLabel}</p>
                <p className="mt-2 text-xl font-black tracking-tight text-zinc-950">{reportSummary.clientsCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{reportCopy.palletsCountLabel}</p>
                <p className="mt-2 text-xl font-black tracking-tight text-zinc-950">{reportSummary.palletsCount}</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{reportCopy.totalDebtLabel}</p>
                <p className="mt-2 text-xl font-black tracking-tight text-zinc-950">{reportCurrencyFormatter.format(reportSummary.totalDebt)} EUR</p>
              </div>
            </div>

            {(
              <>
                <div className="mt-6">
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    {reportCopy.selectedClientLabel}
                  </label>
                  <div ref={reportClientSelectRef} className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={isReportClientSelectOpen}
                      onClick={() => setIsReportClientSelectOpen((isOpen) => !isOpen)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 text-left text-[14px] font-semibold tracking-normal text-[var(--text-primary)] outline-none transition-all hover:border-[color:var(--action-primary)] focus:border-[color:var(--action-primary)] focus:bg-[var(--surface-panel)]"
                    >
                      <span className="min-w-0 truncate">
                        {selectedReportClient?.name || reportCopy.allClientsOptionLabel}
                      </span>
                      <ChevronDown
                        size={16}
                        className={cn(
                          'shrink-0 text-[var(--text-muted)] transition-transform',
                          isReportClientSelectOpen && 'rotate-180'
                        )}
                        aria-hidden="true"
                      />
                    </button>

                    {isReportClientSelectOpen && (
                      <div
                        role="listbox"
                        aria-label={reportCopy.selectedClientLabel}
                        className="absolute z-40 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-panel)] p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.3)]"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={selectedReportClientId === 'all'}
                          onClick={() => {
                            setSelectedReportClientId('all');
                            setIsReportClientSelectOpen(false);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)]',
                            selectedReportClientId === 'all' && 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                          )}
                        >
                          <span className="min-w-0 truncate">{reportCopy.allClientsOptionLabel}</span>
                          {selectedReportClientId === 'all' && <Check size={15} className="shrink-0" />}
                        </button>
                        {reportExportClients.map((client) => {
                          const isSelected = selectedReportClientId === String(client.user_id);
                          return (
                            <button
                              key={`report-client-${client.user_id}`}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onClick={() => {
                                setSelectedReportClientId(String(client.user_id));
                                setIsReportClientSelectOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-raised)]',
                                isSelected && 'bg-[var(--status-success-bg)] text-[var(--status-success-text)]'
                              )}
                            >
                              <span className="min-w-0 truncate">{client.name}</span>
                              {isSelected && <Check size={15} className="shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="px-5 py-3"
                    onClick={() => handleExportCustomerReport('selected')}
                    disabled={!selectedReportClient || isExportingExcelReport}
                  >
                    {reportCopy.exportSelectedLabel}
                  </Button>
                  <Button
                    type="button"
                    className="px-5 py-3"
                    onClick={() => handleExportCustomerReport('all')}
                    disabled={isExportingExcelReport}
                  >
                    {reportCopy.exportAllLabel}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showQrExportModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-[1.75rem] border border-zinc-200 bg-white p-6 shadow-[0_30px_80px_-32px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{t('qrExport')}</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{t('qrExportTitle')}</h3>
              </div>
              <button type="button" onClick={() => setShowQrExportModal(false)} className="inline-flex h-10 min-h-10 w-10 min-w-10 shrink-0 basis-10 items-center justify-center rounded-full border border-zinc-200 p-0 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-zinc-900" aria-label={t('close')}><X size={16} /></button>
            </div>
            <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('qrExportPalletCount')}</p>
              <p className="mt-2 text-xl font-black tracking-tight text-zinc-950">{selectedQrExportPallets.length}</p>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-zinc-100 p-1.5">
              {(['current', 'range', 'single'] as const).map((mode) => <button key={mode} type="button" onClick={() => setQrExportMode(mode)} className={`rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-[0.1em] ${qrExportMode === mode ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}>{t(`qrExportMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`)}</button>)}
            </div>
            {qrExportMode === 'range' && <div className="mt-4 grid grid-cols-3 gap-2">
              <Input value={qrRangePrefix} onChange={(event) => setQrRangePrefix(event.target.value.toUpperCase())} placeholder={t('qrPrefix')} className="h-11 bg-zinc-50 text-xs font-bold" />
              <Input value={qrRangeStart} onChange={(event) => setQrRangeStart(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={t('rangeFrom')} className="h-11 bg-zinc-50 text-xs font-bold" />
              <Input value={qrRangeEnd} onChange={(event) => setQrRangeEnd(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder={t('rangeTo')} className="h-11 bg-zinc-50 text-xs font-bold" />
            </div>}
            {qrExportMode === 'single' && <div className="relative mt-4">
              <button type="button" onClick={() => setIsQrPalletPickerOpen((open) => !open)} className="flex h-11 w-full items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-left text-sm font-bold text-zinc-800 transition-colors hover:border-emerald-300"><span className="truncate">{selectedQrPalletLabel || (selectedQrExportPallets.length > 1 ? qrSelectedCountLabel : t('qrExportChoosePallet'))}</span><ChevronDown size={16} className={cn('shrink-0 text-zinc-400 transition-transform', isQrPalletPickerOpen && 'rotate-180')} /></button>
              {isQrPalletPickerOpen && <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.28)]">
                <Input autoFocus value={qrPalletSearch} onChange={(event) => setQrPalletSearch(event.target.value)} placeholder={t('qrExportSearchPallet')} className="h-10 bg-zinc-50 text-sm" />
                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg bg-zinc-50 p-1">
                  {visibleQrPalletOptions.map((pallet) => {
                    const isSelected = selectedQrExportPalletIds.includes(String(pallet.id));
                    const togglePallet = () => setSelectedQrExportPalletIds((current) =>
                      isSelected ? current.filter((id) => id !== String(pallet.id)) : [...current, String(pallet.id)]
                    );
                    return (
                      <div key={pallet.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors', isSelected ? 'bg-emerald-50' : 'hover:bg-white')}>
                        <button type="button" onClick={togglePallet} className={cn('min-w-0 flex-1 truncate px-1 text-left text-sm font-bold', isSelected ? 'text-emerald-800' : 'text-zinc-700')}>
                          {pallet.pallet_name || pallet.qr_code}
                        </button>
                        <button type="button" role="checkbox" aria-checked={isSelected} aria-label={pallet.pallet_name || pallet.qr_code} onClick={togglePallet} className={cn('inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors', isSelected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-zinc-200 bg-white text-transparent hover:border-emerald-300')}>
                          <Check size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>}
              <p className="mt-2 text-xs font-semibold text-zinc-500">{qrSelectedCountLabel}</p>
            </div>}
            <div className="mt-5 grid grid-cols-4 gap-2">
              {(['svg', 'png', 'jpg', 'pdf'] as QrExportFormat[]).map((format) => {
                const selected = qrExportFormats.includes(format);
                return <label key={format} className={`flex cursor-pointer items-center justify-center rounded-xl px-2 py-3 text-[10px] font-black uppercase tracking-widest transition-colors ${selected ? 'bg-emerald-600 text-white shadow-sm' : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}`}><input type="checkbox" checked={selected} onChange={() => toggleQrExportFormat(format)} className="sr-only" />{format}</label>;
              })}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowQrExportModal(false)}>{t('cancel')}</Button>
              <Button type="button" disabled={qrExportFormats.length === 0 || selectedQrExportPallets.length === 0 || isExportingQrCodes} onClick={() => void handleExportQrCodes()}>{isExportingQrCodes ? t('exporting') : t('download')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
