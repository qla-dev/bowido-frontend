import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input, Badge, Button, Select, cn } from './ui';
import {
  Search,
  ArrowUpDown,
  Package,
  Edit,
  Trash2,
  Plus,
  RotateCcw,
  FileSpreadsheet,
  Check,
  ChevronDown,
  CalendarClock,
  X,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { motion } from 'motion/react';
import { Pallet } from '../types';
import { getPalletTypeLabel, getStatusLabel, palletTypeValues } from '../i18n';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { ListPagination } from './ListPagination';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService, PaginationMeta } from '../services/api';
import {
  buildCustomerPalletReportWorkbook,
  type CustomerPalletReportGroup,
  type CustomerPalletReportRow,
  type CustomerPalletReportText,
} from '../lib/customerPalletReportExport';
import { getPalletDisplayName } from '../lib/palletDisplay';

interface PalletTableViewProps {
  onAddPallet?: () => void;
  onEditPallet?: (pallet: Pallet) => void;
  onDeletePallet?: (pallet: Pallet) => void;
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
}) => {
  const { pallets: cachedPallets, statuses, clients, t, language } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const quickFilterRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<ColumnKey, HTMLTableCellElement | null>>>({});
  const [pallets, setPagedPallets] = useState<Pallet[]>([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [pageLimit, setPageLimit] = useState(PALLET_PAGE_SIZE);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    total: 0,
    limit: PALLET_PAGE_SIZE,
    offset: 0,
    count: 0,
  });
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
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
    key: 'lastUpdate',
    direction: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [openFilterKey, setOpenFilterKey] = useState<SortKey | null>(null);
  const [openQuickFilter, setOpenQuickFilter] = useState<QuickFilterKey | null>(null);
  const [selectedDeadlineFilters, setSelectedDeadlineFilters] = useState<DeadlineFilter[]>([]);
  const [showReportExportModal, setShowReportExportModal] = useState(false);
  const [selectedReportClientId, setSelectedReportClientId] = useState<string>('all');
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      setIsPageLoading(true);
      setPageError(null);

      try {
        const page = await apiService.pallets.page({
          limit: pageLimit,
          offset: pageOffset,
          search: debouncedSearchQuery || undefined,
          sort_by: sortConfig.key,
          sort_direction: sortConfig.direction,
        });

        if (!isMounted) {
          return;
        }

        setPagedPallets(page.items);
        setPaginationMeta(page.meta);
      } catch (error) {
        console.error('Failed to load paginated pallets', error);

        if (isMounted) {
          setPageError('load_failed');
        }
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
  }, [debouncedSearchQuery, pageLimit, pageOffset, sortConfig]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    setPageOffset(0);
  }, [debouncedSearchQuery, sortConfig]);

  useEffect(() => {
    if (cachedPallets.length === 0) {
      return;
    }

    setPagedPallets((current) =>
      current.map((pallet) => cachedPallets.find((cachedPallet) => cachedPallet.id === pallet.id) || pallet)
    );
  }, [cachedPallets]);

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
  const statusFilterLabel = language === 'bs' ? 'Status' : language === 'nl' ? 'Status' : 'Status';
  const deadlineFilterLabel = language === 'bs' ? 'Rok' : language === 'nl' ? 'Termijn' : 'Due status';
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
    modalSubtitle: string;
    selectedClientLabel: string;
    allClientsOptionLabel: string;
    clientsCountLabel: string;
    palletsCountLabel: string;
    totalDebtLabel: string;
    exportSelectedLabel: string;
    exportAllLabel: string;
    emptyStateLabel: string;
    reportFilePrefix: string;
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
          palletLabel: 'Paleta',
          typeLabel: 'Tip',
          statusLabel: 'Status',
          sentDateLabel: 'Poslana',
          daysAtClientLabel: 'Dana kod kupca',
          graceDaysLabel: 'Grace',
          overdueDaysLabel: 'Dana preko',
          debtLabel: 'Dug (EUR)',
          locationLabel: 'Lokacija',
          totalLabel: 'Ukupno',
          fabLabel: 'Excel report',
          modalTitle: 'Excel report po kupcu',
          modalSubtitle: 'Izvoz paleta kod kupca sa brojem dana i dugom po kupcu.',
          selectedClientLabel: 'Kupac',
          allClientsOptionLabel: 'Svi kupci',
          clientsCountLabel: 'Kupci',
          palletsCountLabel: 'Palete',
          totalDebtLabel: 'Ukupan dug',
          exportSelectedLabel: 'Izvezi kupca',
          exportAllLabel: 'Izvezi sve kupce',
          emptyStateLabel: 'Nema paleta u naplativom statusu za ovaj report.',
          reportFilePrefix: 'palete-po-kupcu',
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
            palletLabel: 'Bok',
            typeLabel: 'Type',
            statusLabel: 'Status',
            sentDateLabel: 'Verzonden',
            daysAtClientLabel: 'Dagen bij klant',
            graceDaysLabel: 'Grace',
            overdueDaysLabel: 'Dagen te laat',
            debtLabel: 'Schuld (EUR)',
            locationLabel: 'Locatie',
            totalLabel: 'Totaal',
            fabLabel: 'Excel report',
            modalTitle: 'Excel report per klant',
            modalSubtitle: 'Exporteer bokken bij de klant met aantallen dagen en openstaande schuld.',
            selectedClientLabel: 'Klant',
            allClientsOptionLabel: 'Alle klanten',
            clientsCountLabel: 'Klanten',
            palletsCountLabel: 'Bokken',
            totalDebtLabel: 'Totale schuld',
            exportSelectedLabel: 'Exporteer klant',
            exportAllLabel: 'Exporteer alle klanten',
            emptyStateLabel: 'Geen bokken in factureerbare status voor dit rapport.',
            reportFilePrefix: 'bokken-per-klant',
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
            modalSubtitle: 'Export pallets at customer with day count and debt totals.',
            selectedClientLabel: 'Customer',
            allClientsOptionLabel: 'All customers',
            clientsCountLabel: 'Customers',
            palletsCountLabel: 'Pallets',
            totalDebtLabel: 'Total debt',
            exportSelectedLabel: 'Export customer',
            exportAllLabel: 'Export all customers',
            emptyStateLabel: 'No pallets in billable status for this report.',
            reportFilePrefix: 'pallets-by-customer',
          };
  const transportStatusIds = [2, 6];
  const resizeAriaLabel =
    language === 'bs'
      ? 'Promijeni sirinu kolone'
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
            date: 'Datum',
            term: 'Termijn',
            deadline: 'Status',
            emptyValue: '-',
            daysLeft: 'dagen resterend',
            daysLate: 'dagen over',
          }
        : {
            date: 'Date',
            term: 'Term',
            deadline: 'Status',
            emptyValue: '-',
            daysLeft: 'days left',
            daysLate: 'days overdue',
          };
  const dateFormatter = new Intl.DateTimeFormat(
    language === 'nl' ? 'nl-NL' : language === 'bs' ? 'bs-BA' : 'en-GB',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  );
  const getClientLabel = (pallet: Pallet) =>
    clients.find((client) => client.user_id === pallet.user_id)?.name || t('inStock');

  const getTypeLabel = (pallet: Pallet) => getPalletTypeLabel(pallet.type, language);

  const getStatusLabelText = (pallet: Pallet) =>
    getStatusLabel(pallet.current_status_name, language);

  const getLocationLabel = (pallet: Pallet) =>
    FIXED_WAREHOUSE_LOCATION_BY_STATUS_ID[pallet.current_status_id] ||
    pallet.current_location ||
    t('notAvailable');

  const palletTimelineMap = useMemo<Record<number, PalletTimelineInfo>>(
    () =>
      Object.fromEntries(
        pallets.map((pallet) => {
          const changedAt = new Date(pallet.last_status_changed_at);
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
          const daysSinceChange = Math.max(
            0,
            Math.floor((todayAtMidnight.getTime() - changedAtMidnight.getTime()) / msPerDay)
          );
          const isWarehouseStatus =
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

          if (transportStatusIds.includes(pallet.current_status_id)) {
            graceDays = status?.grace_period_days ?? 3;
          } else if (status?.is_billable) {
            graceDays = client?.grace_period_days ?? status?.grace_period_days ?? 0;
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

          return [
            pallet.id,
            {
              dateLabel: dateFormatter.format(changedAt),
              dateFilterValue: formatDateFilterValue(changedAt),
              dateSortValue: changedAt.getTime(),
              termLabel: dateFormatter.format(dueDate),
              termFilterValue: formatDateFilterValue(dueDate),
              termSortValue: dueDate.getTime(),
              deadlineLabel: isOverdue
                ? `${Math.abs(remainingDays)} ${timelineCopy.daysLate}`
                : `${remainingDays} ${timelineCopy.daysLeft}`,
              deadlineFilterValue: isOverdue
                ? `${Math.abs(remainingDays)} ${timelineCopy.daysLate}`
                : `${remainingDays} ${timelineCopy.daysLeft}`,
              deadlineSortValue: remainingDays,
              tone: isOverdue ? 'danger' : remainingDays <= 2 ? 'warning' : 'success',
            },
          ];
        })
      ),
    [clients, dateFormatter, pallets, statuses, timelineCopy, transportStatusIds]
  );

  const getTimelineInfo = (pallet: Pallet) => palletTimelineMap[pallet.id];
  const getDaysSinceStatusChange = (dateString: string) => {
    const changedAt = new Date(dateString);
    const changedAtMidnight = new Date(
      changedAt.getFullYear(),
      changedAt.getMonth(),
      changedAt.getDate()
    );
    const today = new Date();
    const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    return Math.max(
      0,
      Math.floor((todayAtMidnight.getTime() - changedAtMidnight.getTime()) / (24 * 60 * 60 * 1000))
    );
  };

  const customerReportGroups = useMemo<CustomerPalletReportGroup[]>(() => {
    const groupedReports = new Map<number, CustomerPalletReportGroup>();

    pallets.forEach((pallet) => {
      const status = statuses.find((item) => item.id === pallet.current_status_id);

      if (!status?.is_billable || !pallet.user_id) {
        return;
      }

      const client = clients.find((item) => item.user_id === pallet.user_id);
      const clientName = client?.name || pallet.client_name?.trim();

      if (!clientName) {
        return;
      }

      const daysAtClient = getDaysSinceStatusChange(pallet.last_status_changed_at);
      const graceDays = client?.grace_period_days ?? status.grace_period_days ?? 0;
      const ratePerDay = client?.price_per_day ?? status.price_per_day ?? 0;
      const overdueDays = Math.max(daysAtClient - graceDays, 0);
      const debt = Number((overdueDays * ratePerDay).toFixed(2));
      const row: CustomerPalletReportRow = {
        palletName: getPalletDisplayName(pallet),
        palletType: getTypeLabel(pallet),
        statusLabel: getStatusLabelText(pallet),
        sentDate: dateFormatter.format(new Date(pallet.last_status_changed_at)),
        daysAtClient,
        graceDays,
        overdueDays,
        debt,
        location: getLocationLabel(pallet),
      };
      const existingGroup = groupedReports.get(pallet.user_id);

      if (existingGroup) {
        existingGroup.rows.push(row);
        existingGroup.totalPallets += 1;
        existingGroup.overduePallets += overdueDays > 0 ? 1 : 0;
        existingGroup.totalDebt = Number((existingGroup.totalDebt + debt).toFixed(2));
        return;
      }

      groupedReports.set(pallet.user_id, {
        clientId: pallet.user_id,
        clientName,
        rows: [row],
        totalDebt: debt,
        totalPallets: 1,
        overduePallets: overdueDays > 0 ? 1 : 0,
      });
    });

    return Array.from(groupedReports.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((left, right) => {
          if (right.debt !== left.debt) {
            return right.debt - left.debt;
          }

          if (right.daysAtClient !== left.daysAtClient) {
            return right.daysAtClient - left.daysAtClient;
          }

          return left.palletName.localeCompare(right.palletName, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
        }),
      }))
      .sort((left, right) =>
        left.clientName.localeCompare(right.clientName, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
      );
  }, [clients, dateFormatter, pallets, statuses]);

  useEffect(() => {
    if (selectedReportClientId === 'all') {
      return;
    }

    if (!customerReportGroups.some((group) => String(group.clientId) === selectedReportClientId)) {
      setSelectedReportClientId('all');
    }
  }, [customerReportGroups, selectedReportClientId]);

  const selectedCustomerReportGroup =
    selectedReportClientId === 'all'
      ? null
      : customerReportGroups.find((group) => String(group.clientId) === selectedReportClientId) || null;
  const reportCustomersCount = customerReportGroups.length;
  const reportPalletsCount = customerReportGroups.reduce(
    (sum, group) => sum + group.totalPallets,
    0
  );
  const reportTotalDebt = customerReportGroups.reduce(
    (sum, group) => Number((sum + group.totalDebt).toFixed(2)),
    0
  );

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
      qr: Array.from<string>(new Set(pallets.map((pallet) => getPalletDisplayName(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      type: Array.from<string>(
        new Set([...palletTypeValues, ...pallets.map((pallet) => getTypeLabel(pallet))])
      )
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      client: Array.from<string>(new Set(pallets.map((pallet) => getClientLabel(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      status: Array.from<string>(new Set(pallets.map((pallet) => getStatusLabelText(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      lastUpdate: Array.from<string>(
        new Set(pallets.map((pallet) => getTimelineInfo(pallet).dateFilterValue))
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
        new Set(pallets.map((pallet) => getTimelineInfo(pallet).termFilterValue))
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
        new Set(pallets.map((pallet) => getTimelineInfo(pallet).deadlineFilterValue))
      )
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      location: Array.from<string>(new Set(pallets.map((pallet) => getLocationLabel(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
    }),
    [clients, dateFormatter, language, pallets, t, timelineCopy.emptyValue]
  );

  const quickStatusOptions = useMemo(
    () => statuses
      .filter((status) => status.is_active)
      .map((status) => ({ value: getStatusLabel(status.name, language), label: getStatusLabel(status.name, language) }))
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })),
    [language, statuses]
  );

  const filteredPallets = useMemo(() => {
    return pallets.filter((pallet) => {
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
  }, [clients, language, pallets, selectedDeadlineFilters, selectedFilters, palletTimelineMap]);

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
      key: 'lastUpdate',
      direction: 'desc',
    });
    setSelectedDeadlineFilters([]);
    setOpenFilterKey(null);
    setOpenQuickFilter(null);
  };
  const reportCurrencyFormatter = new Intl.NumberFormat(
    language === 'nl' ? 'nl-NL' : language === 'bs' ? 'bs-BA' : 'en-GB',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );

  const downloadReportWorkbook = (
    groups: CustomerPalletReportGroup[],
    fileNameBase: string
  ) => {
    const workbookXml = buildCustomerPalletReportWorkbook(groups, reportCopy);
    const blob = new Blob([workbookXml], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateSuffix = formatDateFilterValue(new Date());

    link.href = downloadUrl;
    link.download = `${fileNameBase}-${dateSuffix}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  const handleExportCustomerReport = (mode: 'selected' | 'all') => {
    const groupsToExport =
      mode === 'all'
        ? customerReportGroups
        : selectedCustomerReportGroup
          ? [selectedCustomerReportGroup]
          : [];

    if (groupsToExport.length === 0) {
      return;
    }

    const fileNameBase =
      mode === 'all'
        ? `${reportCopy.reportFilePrefix}-all`
        : `${reportCopy.reportFilePrefix}-${groupsToExport[0].clientName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'client'}`;

    downloadReportWorkbook(groupsToExport, fileNameBase);
    setShowReportExportModal(false);
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
    const clear = isStatus
      ? () => clearColumnFilter('status')
      : () => setSelectedDeadlineFilters([]);

    return (
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-72 overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.28)] dark:border-white/15 dark:bg-[#101113] dark:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]">
        <button type="button" onClick={clear} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/[0.08] dark:hover:text-zinc-50">
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
            onClick={() => clearColumnFilter(key)}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-zinc-900 dark:text-white">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300">
            <Package size={16} />
          </span>
          {t('pallets')}
        </h2>
        <div ref={quickFilterRef} className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative">
            <button type="button" onClick={() => setOpenQuickFilter((current) => current === 'status' ? null : 'status')} className={cn('flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.12em] transition-colors sm:w-36', selectedFilters.status.length > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-300/40 dark:bg-emerald-400/10 dark:text-emerald-100' : 'border-zinc-200 bg-white text-zinc-600 hover:border-emerald-200 dark:border-white/15 dark:bg-[#151d1a] dark:text-zinc-200')}>
              <span className="truncate">{statusFilterLabel}{selectedFilters.status.length > 0 ? ` (${selectedFilters.status.length})` : ''}</span><ChevronDown size={14} className={cn('shrink-0 transition-transform', openQuickFilter === 'status' && 'rotate-180')} />
            </button>
            {renderQuickFilterMenu('status')}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setOpenQuickFilter((current) => current === 'deadline' ? null : 'deadline')} className={cn('flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.12em] transition-colors sm:w-40', selectedDeadlineFilters.length > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-300/40 dark:bg-emerald-400/10 dark:text-emerald-100' : 'border-zinc-200 bg-white text-zinc-600 hover:border-emerald-200 dark:border-white/15 dark:bg-[#151d1a] dark:text-zinc-200')}>
              <span className="flex min-w-0 items-center gap-1.5 truncate"><CalendarClock size={14} className="shrink-0" />{deadlineFilterLabel}{selectedDeadlineFilters.length > 0 ? ` (${selectedDeadlineFilters.length})` : ''}</span><ChevronDown size={14} className={cn('shrink-0 transition-transform', openQuickFilter === 'deadline' && 'rotate-180')} />
            </button>
            {renderQuickFilterMenu('deadline')}
          </div>
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
      </div>

      <AdminDataTable<ColumnKey>
        columnOrder={PALLET_TABLE_COLUMN_ORDER}
        initialColumnWidths={INITIAL_COLUMN_WIDTHS}
        minColumnWidths={MIN_COLUMN_WIDTHS}
        resizeAriaLabel={resizeAriaLabel}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isPageLoading && filteredPallets.length === 0}
        emptyState={
          <div className="p-20 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-100 bg-zinc-50">
              <Search size={20} className="text-zinc-200" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
              {pageError ? t('noMatchingResults') : t('noMatchingResults')}
            </p>
          </div>
        }
        renderTable={({ columnWidths, totalTableWidth, registerHeaderCell, renderResizeHandle }) => (
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
                        <span className={cn(bodyTextClass, 'text-zinc-900 dark:text-zinc-300')}>
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
                        <span className={cn(bodyTextClass, 'uppercase text-zinc-900 dark:text-zinc-200')}>
                          {clientLabel}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.75rem] items-center justify-center">
                        <Badge
                          variant={
                            pallet.current_status_id === 7
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
                          className={cn(
                            'inline-flex min-w-0 items-center gap-2.5 whitespace-nowrap text-[11px] font-bold tracking-tight',
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
                          <span className="truncate">{timelineInfo.deadlineLabel}</span>
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
                            className="h-10 w-10 p-0"
                            onClick={(event) => {
                              event.stopPropagation();
                              onEditPallet?.(pallet);
                            }}
                            title={t('editData')}
                            aria-label={t('editData')}
                          >
                            <Edit size={15} />
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
      <PageLoadingModal isOpen={isPageLoading} language={language} />
      <ListPagination
        total={paginationMeta.total}
        limit={paginationMeta.limit}
        offset={paginationMeta.offset}
        count={paginationMeta.count}
        isLoading={isPageLoading}
        language={language}
        onPageChange={setPageOffset}
        onLimitChange={(limit) => {
          setPageOffset(0);
          setPageLimit(limit);
        }}
      />
      {openFilterKey && renderFilterMenu(openFilterKey)}

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-20 flex items-center gap-3 md:bottom-20 md:right-8">
        <button
          type="button"
          onClick={() => setShowReportExportModal(true)}
          disabled={customerReportGroups.length === 0}
          className={cn(
            'inline-flex h-14 items-center gap-2 rounded-full px-5 text-[11px] font-black uppercase tracking-[0.14em] shadow-[0_18px_36px_-18px_rgba(0,166,85,0.8)] transition-transform',
            customerReportGroups.length === 0
              ? 'cursor-not-allowed bg-emerald-200 text-white/80'
              : 'bg-[#00A655] text-white hover:scale-[1.02]'
          )}
        >
          <FileSpreadsheet size={16} />
          {reportCopy.fabLabel}
        </button>

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
      </div>

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
                <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-zinc-500">
                  {reportCopy.modalSubtitle}
                </p>
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
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  {reportCopy.clientsCountLabel}
                </p>
                <p className="mt-2 text-xl font-black tracking-tight text-zinc-950">
                  {reportCustomersCount}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  {reportCopy.palletsCountLabel}
                </p>
                <p className="mt-2 text-xl font-black tracking-tight text-zinc-950">
                  {reportPalletsCount}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  {reportCopy.totalDebtLabel}
                </p>
                <p className="mt-2 text-xl font-black tracking-tight text-zinc-950">
                  {reportCurrencyFormatter.format(reportTotalDebt)} EUR
                </p>
              </div>
            </div>

            {customerReportGroups.length > 0 ? (
              <>
                <div className="mt-6">
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    {reportCopy.selectedClientLabel}
                  </label>
                  <Select
                    value={selectedReportClientId}
                    onChange={(event) => setSelectedReportClientId(event.target.value)}
                    className="text-left normal-case tracking-normal"
                  >
                    <option value="all">{reportCopy.allClientsOptionLabel}</option>
                    {customerReportGroups.map((group) => (
                      <option key={`report-client-${group.clientId}`} value={String(group.clientId)}>
                        {group.clientName}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="px-5 py-3"
                    onClick={() => handleExportCustomerReport('selected')}
                    disabled={!selectedCustomerReportGroup}
                  >
                    {reportCopy.exportSelectedLabel}
                  </Button>
                  <Button
                    type="button"
                    className="px-5 py-3"
                    onClick={() => handleExportCustomerReport('all')}
                  >
                    {reportCopy.exportAllLabel}
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  {reportCopy.emptyStateLabel}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
