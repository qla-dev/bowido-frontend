import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpDown,
  Banknote,
  Search,
  Warehouse,
  Wrench,
  Check,
  X,
} from 'lucide-react';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { AdminTableColumnFilter, type AdminTableFilterOption } from './AdminTableColumnFilter';
import { AdminTableStickyToolbar } from './AdminTableStickyToolbar';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { Badge, Button, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { Pallet, ServiceReport } from '../types';
import { formatServiceReportDescription, getLocationLabel, getPalletTypeLabel, getStatusLabel } from '../i18n';
import { getPalletDisplayName } from '../lib/palletDisplay';
import { formatAppDateTime } from '../lib/dateFormat';
import { apiService } from '../services/api';
import { useInfinitePagination } from '../hooks/useInfinitePagination';
import { ServiceReportPhotoLightbox } from './ServiceReportPhotoLightbox';
import { SoftHyphenatedText } from './SoftHyphenatedText';
import { RepairCompletionUndoModal } from './RepairCompletionUndoModal';
import { useLivePallet } from '../hooks/useLivePallet';

type ViewMode = 'service' | 'warehouse' | 'finance';
type SortDirection = 'asc' | 'desc';
type OperationColumnKey = 'primary' | 'secondary' | 'status' | 'location' | 'client' | 'metric' | 'amount' | 'actions';

type OperationRow = {
  id: string;
  pallet?: Pallet;
  serviceReport?: ServiceReport;
  primary: string;
  secondary: string;
  status: string;
  location: string;
  client: string;
  metric: string;
  amount: string;
  sortValues: Record<string, string | number>;
};

type RepairCompletionUndo = {
  pallet: Pallet;
  completionPromise: Promise<Pallet>;
};

const COLUMN_WIDTHS: Record<string, number> = {
  primary: 190,
  secondary: 170,
  status: 170,
  location: 230,
  client: 190,
  metric: 170,
  amount: 170,
  actions: 110,
};

const MIN_WIDTHS: Record<string, number> = {
  primary: 150,
  secondary: 140,
  status: 140,
  location: 180,
  client: 150,
  metric: 135,
  amount: 135,
  actions: 90,
};

const ADMIN_ROLE_PAGE_SIZE = 25;

const getDaysSince = (date: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));

export const AdminRoleOperationsView: React.FC<{ mode: ViewMode }> = ({ mode }) => {
  const { clients, pallets, statuses, serviceReports, invoices, language, updatePalletRepairStatus, t } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<string, HTMLTableCellElement | null>>>({});
  const [selectedRow, setSelectedRow] = useState<OperationRow | null>(null);
  useLivePallet(selectedRow?.pallet?.id ?? null);
  const [serviceReportImageUrl, setServiceReportImageUrl] = useState('');
  const [isServiceReportImageLoading, setIsServiceReportImageLoading] = useState(false);
  const [serviceReportImageFailed, setServiceReportImageFailed] = useState(false);
  const [isServiceReportPhotoViewerOpen, setIsServiceReportPhotoViewerOpen] = useState(false);
  const [repairCompletionUndo, setRepairCompletionUndo] = useState<RepairCompletionUndo | null>(null);
  const [visibleCount, setVisibleCount] = useState(ADMIN_ROLE_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection }>({
    key: 'primary',
    direction: 'asc',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<OperationColumnKey, string[]>>({
    primary: [],
    secondary: [],
    status: [],
    location: [],
    client: [],
    metric: [],
    amount: [],
    actions: [],
  });
  const repairPalletPage = useMemo(
    () => (offset: number) => mode === 'service'
      ? apiService.pallets.page({
          limit: ADMIN_ROLE_PAGE_SIZE,
          offset,
          is_for_repair: true,
          sort_by: 'pallet_name',
          sort_direction: 'asc',
        })
      : Promise.resolve({
          items: [],
          meta: { total: 0, limit: ADMIN_ROLE_PAGE_SIZE, offset, count: 0 },
        }),
    [mode],
  );
  const {
    items: repairPallets,
    hasMore: hasMoreRepairPallets,
    isInitialLoading: isRepairPalletsLoading,
    isLoadingMore: isLoadingMoreRepairPallets,
    error: repairPalletsError,
    loadMore: loadMoreRepairPallets,
    retry: retryRepairPallets,
    setItems: setRepairPallets,
  } = useInfinitePagination({
    queryKey: `repair-pallets-${mode}`,
    pageSize: ADMIN_ROLE_PAGE_SIZE,
    fetchPage: repairPalletPage,
  });
  const warehousePalletPage = useMemo(
    () => (offset: number) => mode === 'warehouse'
      ? apiService.pallets.page({
          limit: ADMIN_ROLE_PAGE_SIZE,
          offset,
          sort_by: 'pallet_name',
          sort_direction: 'asc',
        })
      : Promise.resolve({
          items: [],
          meta: { total: 0, limit: ADMIN_ROLE_PAGE_SIZE, offset, count: 0 },
        }),
    [mode],
  );
  const {
    items: warehousePallets,
    hasMore: hasMoreWarehousePallets,
    isInitialLoading: isWarehousePalletsLoading,
    isLoadingMore: isLoadingMoreWarehousePallets,
    error: warehousePalletsError,
    loadMore: loadMoreWarehousePallets,
    retry: retryWarehousePallets,
  } = useInfinitePagination({
    queryKey: `warehouse-pallets-${mode}`,
    pageSize: ADMIN_ROLE_PAGE_SIZE,
    fetchPage: warehousePalletPage,
  });
  const {
    headerCellClass,
    headerContentClass,
    bodyCellClass,
    bodyCellInnerClass,
    bodyTextClass,
  } = adminTableStyles;

  useEffect(() => {
    const imagePath = selectedRow?.serviceReport?.photos?.[0]?.url || selectedRow?.serviceReport?.image_path;
    let objectUrl = '';
    let cancelled = false;

    setServiceReportImageUrl('');
    setServiceReportImageFailed(false);

    if (!imagePath) {
      setIsServiceReportImageLoading(false);
      return;
    }

    setIsServiceReportImageLoading(true);

    void apiService.gallery
      .image(imagePath)
      .then((blob) => {
        if (cancelled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setServiceReportImageUrl(objectUrl);
      })
      .catch((error) => {
        console.error('Failed to load service report photo', error);
        if (!cancelled) {
          setServiceReportImageFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsServiceReportImageLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedRow?.serviceReport?.id, selectedRow?.serviceReport?.image_path, selectedRow?.serviceReport?.photos]);

  useEffect(() => {
    setIsServiceReportPhotoViewerOpen(false);
  }, [selectedRow?.id]);

  const locale = language === 'nl' ? 'nl-NL' : language === 'bs' ? 'bs-BA' : 'en-GB';
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );

  const copy = useMemo(() => {
    if (mode === 'service') {
      return {
        title: language === 'bs' ? 'Admin Servis' : language === 'nl' ? 'Admin Service' : 'Admin Service',
        subtitle:
          language === 'bs'
            ? 'Servisni red, lokacije i palete prijavljene za popravak.'
            : language === 'nl'
              ? 'Servicerij, locaties en bokken gemeld voor reparatie.'
              : 'Repair queue, locations and pallets reported for service.',
        search: language === 'bs' ? 'Pretraži servis' : language === 'nl' ? 'Zoek service' : 'Search service',
        empty: language === 'bs' ? 'Nema servisnih zadataka.' : language === 'nl' ? 'Geen service taken.' : 'No service tasks.',
        primary: language === 'bs' ? 'Paleta' : language === 'nl' ? 'Bok' : 'Pallet',
        secondary: language === 'bs' ? 'Tip' : language === 'nl' ? 'Type' : 'Type',
        status: language === 'bs' ? 'Status' : language === 'nl' ? 'Status' : 'Status',
        location: language === 'bs' ? 'Lokacija' : language === 'nl' ? 'Locatie' : 'Location',
        client: language === 'bs' ? 'Klijent' : language === 'nl' ? 'Klant' : 'Client',
        metric: language === 'bs' ? 'Dana u servisu' : language === 'nl' ? 'Dagen in service' : 'Days in service',
        amount: language === 'bs' ? 'Prijava' : language === 'nl' ? 'Melding' : 'Report',
      };
    }

    if (mode === 'warehouse') {
      return {
        title: language === 'bs' ? 'Admin Magacin' : language === 'nl' ? 'Admin Magazijn' : 'Admin Warehouse',
        subtitle:
          language === 'bs'
            ? 'Operativni pregled paleta u magacinu, transportu i povratu.'
            : language === 'nl'
              ? 'Operationeel overzicht van bokken in magazijn, transport en retour.'
              : 'Operational overview of pallets in warehouse, transport and return.',
        search: language === 'bs' ? 'Pretraži magacin' : language === 'nl' ? 'Zoek magazijn' : 'Search warehouse',
        empty: language === 'bs' ? 'Nema magacinskih stavki.' : language === 'nl' ? 'Geen magazijnitems.' : 'No warehouse items.',
        primary: language === 'bs' ? 'Paleta' : language === 'nl' ? 'Bok' : 'Pallet',
        secondary: language === 'bs' ? 'Tip' : language === 'nl' ? 'Type' : 'Type',
        status: 'Status',
        location: language === 'bs' ? 'Lokacija' : language === 'nl' ? 'Locatie' : 'Location',
        client: language === 'bs' ? 'Klijent' : language === 'nl' ? 'Klant' : 'Client',
        metric: language === 'bs' ? 'Dana u statusu' : language === 'nl' ? 'Dagen in status' : 'Days in status',
        amount: language === 'bs' ? 'Aktivnost' : language === 'nl' ? 'Activiteit' : 'Activity',
      };
    }

    return {
      title:
        language === 'bs'
          ? 'Admin Finansije i Administracija'
          : language === 'nl'
            ? 'Admin Financien en Administratie'
            : 'Admin Finance and Administration',
      subtitle:
        language === 'bs'
          ? 'Dugovanja, tarife, fakture i zakašnjenja po klijentima.'
          : language === 'nl'
            ? 'Schulden, tarieven, facturen en vertragingen per klant.'
            : 'Debts, rates, invoices and overdue days by client.',
      search: language === 'bs' ? 'Pretraži finansije' : language === 'nl' ? 'Zoek financien' : 'Search finance',
      empty: language === 'bs' ? 'Nema finansijskih stavki.' : language === 'nl' ? 'Geen financiele items.' : 'No finance items.',
      primary: language === 'bs' ? 'Klijent' : language === 'nl' ? 'Klant' : 'Client',
      secondary: 'KVK',
      status: language === 'bs' ? 'Fakture' : language === 'nl' ? 'Facturen' : 'Invoices',
      location: language === 'bs' ? 'Adresa' : language === 'nl' ? 'Adres' : 'Address',
      client: language === 'bs' ? 'Palete kod kupca' : language === 'nl' ? 'Bokken bij klant' : 'Pallets at client',
      metric: language === 'bs' ? 'Dana kašnjenja' : language === 'nl' ? 'Dagen te laat' : 'Overdue days',
      amount: language === 'bs' ? 'Dug' : language === 'nl' ? 'Schuld' : 'Debt',
    };
  }, [language, mode]);

  const columns = useMemo(
    () =>
      [
        { key: 'primary', label: copy.primary },
        { key: 'secondary', label: copy.secondary },
        { key: 'status', label: copy.status },
        { key: 'location', label: copy.location },
        { key: 'client', label: copy.client },
        { key: 'metric', label: copy.metric },
        { key: 'amount', label: copy.amount },
        { key: 'actions', label: language === 'bs' ? 'Akcije' : language === 'nl' ? 'Acties' : 'Actions' },
      ] as const,
    [copy]
  );

  const rows = useMemo<OperationRow[]>(() => {
    if (mode === 'finance') {
      return clients.map((client) => {
        const clientPallets = pallets.filter((pallet) => pallet.user_id === client.user_id);
        const overdueDays = clientPallets.reduce((total, pallet) => {
          const status = statuses.find((item) => item.id === pallet.current_status_id);
          return total + (status?.is_billable ? Math.max(getDaysSince(pallet.last_status_changed_at) - client.grace_period_days, 0) : 0);
        }, 0);
        const debt = overdueDays * client.price_per_day;
        const invoiceCount = invoices.filter((invoice) => invoice.customer_id === client.user_id || invoice.customer_name === client.name).length;

        return {
          id: `finance-${client.id}`,
          primary: client.name,
          secondary: client.kvk_number || '-',
          status: `${invoiceCount}`,
          location: client.warehouse_addresses?.[0] || '-',
          client: `${clientPallets.filter((pallet) => pallet.current_status_id === 4).length}`,
          metric: `${overdueDays}`,
          amount: `EUR ${currencyFormatter.format(debt)}`,
          sortValues: {
            primary: client.name,
            secondary: client.kvk_number || '',
            status: invoiceCount,
            location: client.warehouse_addresses?.[0] || '',
            client: clientPallets.length,
            metric: overdueDays,
            amount: debt,
          },
        };
      });
    }

    const relevantPalletSnapshots =
      mode === 'service'
        ? repairPallets
        : mode === 'warehouse'
          ? warehousePallets
          : pallets;
    const relevantPallets = relevantPalletSnapshots.map(
      (pallet) => pallets.find((current) => current.id === pallet.id) || pallet,
    );

    return relevantPallets.map((pallet) => {
      const openReport = serviceReports.find((report) => report.pallet_id === pallet.id && !report.resolved_at);
      const days = getDaysSince(pallet.last_status_changed_at);
      const serviceDescription = formatServiceReportDescription(openReport?.problem_description, language);
      const palletNote = formatServiceReportDescription(pallet.note, language);
      const activityLabels =
        language === 'bs'
          ? {
              returnPickup: 'Preuzimanje povrata',
              transport: 'Transport',
              atClient: 'Kod klijenta',
              warehouseStock: 'Zaliha u magacinu',
            }
          : language === 'nl'
            ? {
                returnPickup: 'Retour ophalen',
                transport: 'Transport',
                atClient: 'Bij klant',
                warehouseStock: 'Magazijnvoorraad',
              }
            : {
                returnPickup: 'Return pickup',
                transport: 'Transport',
                atClient: 'At client',
                warehouseStock: 'Warehouse stock',
              };
      const isAtClient =
        pallet.current_status_id === 4 ||
        ['bij-de-klant', 'at_customer', 'at-client'].includes(pallet.current_status_slug || '');
      const activity =
        mode === 'service'
          ? serviceDescription || palletNote || '-'
          : isAtClient
            ? activityLabels.atClient
            : pallet.current_status_id === 5
            ? activityLabels.returnPickup
            : pallet.current_status_id === 2 || pallet.current_status_id === 6
              ? activityLabels.transport
              : activityLabels.warehouseStock;

      return {
        id: `${mode}-${pallet.id}`,
        pallet,
        serviceReport: openReport,
        primary: getPalletDisplayName(pallet),
        secondary: getPalletTypeLabel(pallet.type, language),
        status: getStatusLabel(pallet.current_status_name, language),
        location: getLocationLabel(pallet.current_location, language) || '-',
        client: pallet.client_name || '-',
        metric: `${days}`,
        amount: activity,
        sortValues: {
          primary: getPalletDisplayName(pallet),
          secondary: pallet.type,
          status: pallet.current_status_name,
          location: getLocationLabel(pallet.current_location, language),
          client: pallet.client_name || '',
          metric: days,
          amount: activity,
        },
      };
    });
  }, [clients, currencyFormatter, invoices, language, mode, pallets, repairPallets, serviceReports, statuses, warehousePallets]);

  useEffect(() => {
    setSelectedRow((current) => {
      if (!current) return current;
      const refreshedRow = rows.find((row) => row.id === current.id);
      return refreshedRow || current;
    });
  }, [rows]);

  const getOperationValue = (row: OperationRow, key: OperationColumnKey) => key === 'actions' ? '' : row[key];
  const filterOptions = useMemo<Record<OperationColumnKey, AdminTableFilterOption[]>>(
    () => Object.fromEntries(
      columns.map((column) => [
        column.key,
        Array.from<string>(new Set<string>(rows.map((row) => getOperationValue(row, column.key))))
          .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
          .map((value) => ({ value, label: value })),
      ])
    ) as Record<OperationColumnKey, AdminTableFilterOption[]>,
    [columns, rows]
  );

  const visibleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const searchedRows = normalizedQuery
      ? rows.filter((row) =>
          [row.primary, row.secondary, row.status, row.location, row.client, row.metric, row.amount]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery)
        )
      : [...rows];
    const nextRows = searchedRows.filter((row) =>
      columns.every((column) =>
        columnFilters[column.key].length === 0
        || columnFilters[column.key].includes(getOperationValue(row, column.key))
      )
    );

    nextRows.sort((left, right) => {
      const leftValue = left.sortValues[sortConfig.key] ?? '';
      const rightValue = right.sortValues[sortConfig.key] ?? '';
      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return nextRows;
  }, [columnFilters, columns, rows, searchQuery, sortConfig]);

  const paginatedRows = useMemo(() => visibleRows.slice(0, visibleCount), [visibleCount, visibleRows]);

  useEffect(() => {
    setVisibleCount(ADMIN_ROLE_PAGE_SIZE);
  }, [columnFilters, mode, searchQuery, sortConfig]);

  useEffect(() => {
    setColumnFilters({
      primary: [],
      secondary: [],
      status: [],
      location: [],
      client: [],
      metric: [],
      amount: [],
      actions: [],
    });
  }, [mode]);

  useEffect(() => {
    setVisibleCount((current) => Math.min(current, Math.max(visibleRows.length, ADMIN_ROLE_PAGE_SIZE)));
  }, [visibleRows.length]);

  const toggleSort = (key: string) => {
    setSortConfig((current) =>
      current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
    );
  };

  const markPalletAsRepaired = (pallet: Pallet) => {
    // Remove the job before the request completes so it immediately leaves the technician queue.
    setRepairPallets((current) => current.filter((item) => item.id !== pallet.id));
    setSelectedRow((current) => current?.pallet?.id === pallet.id ? null : current);

    const completionPromise = updatePalletRepairStatus(pallet.id, false);
    setRepairCompletionUndo({ pallet, completionPromise });

    void completionPromise.catch(() => {
      setRepairCompletionUndo((current) => current?.pallet.id === pallet.id ? null : current);
      setRepairPallets((current) => current.some((item) => item.id === pallet.id) ? current : [pallet, ...current]);
    });
  };

  const undoPalletRepairCompletion = () => {
    const pendingCompletion = repairCompletionUndo;
    if (!pendingCompletion) return;

    setRepairCompletionUndo(null);
    void pendingCompletion.completionPromise
      .then(() => updatePalletRepairStatus(pendingCompletion.pallet.id, true))
      .then((restoredPallet) => {
        setRepairPallets((current) => current.some((item) => item.id === restoredPallet.id)
          ? current
          : [restoredPallet, ...current]
        );
      })
      .catch(() => {
        // The shared pallet state restores itself when a request fails. Keeping the page entry removed
        // avoids showing a completed job until the next refresh if the undo request did not save.
      });
  };

  const markServiceResolved = (row: OperationRow) => {
    if (!row.pallet) return;
    markPalletAsRepaired(row.pallet);
  };
  const ModeIcon = mode === 'service' ? Wrench : mode === 'warehouse' ? Warehouse : Banknote;

  return (
    <div className="space-y-4">
      <AdminTableStickyToolbar flushToPageTop className="py-3">
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#101715]">
          <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-200">
            <ModeIcon size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-zinc-950 dark:text-white">
              {copy.title}
            </h2>
            <p className="mt-1 line-clamp-2 text-[10px] font-bold uppercase tracking-[0.08em] text-zinc-400">
              {copy.subtitle}
            </p>
          </div>
          </div>
          <div className="relative w-full sm:max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={copy.search}
            className="h-11 bg-white pl-10 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal dark:bg-[#151d1a]"
          />
          </div>
        </div>
      </AdminTableStickyToolbar>

      <AdminDataTable<string>
        columnOrder={columns.map((column) => column.key)}
        initialColumnWidths={COLUMN_WIDTHS}
        minColumnWidths={MIN_WIDTHS}
        resizeAriaLabel={language === 'nl' ? 'Kolombreedte aanpassen' : language === 'bs' ? 'Promijeni širinu kolone' : 'Resize column'}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={visibleRows.length === 0}
        emptyState={
          <div className="p-20 text-center">
            <Search size={20} className="mx-auto mb-4 text-zinc-200" />
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">{copy.empty}</p>
          </div>
        }
        renderTable={({ columnWidths, totalTableWidth, registerHeaderCell, renderResizeHandle }) => (
          <table className="border-collapse text-left [table-layout:fixed]" style={{ width: `max(100%, ${totalTableWidth}px)` }}>
            <colgroup>
              {columns.map((column) => (
                <col key={`role-admin-col-${mode}-${column.key}`} style={{ width: columnWidths[column.key] }} />
              ))}
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80 dark:border-white/10 dark:bg-white/5">
              <tr>
                {columns.map((column) => {
                  const isActiveSort = sortConfig.key === column.key;

                  if (column.key === 'actions') {
                    return (
                      <th key={`role-admin-header-${mode}-${column.key}`} ref={registerHeaderCell(column.key)} className={cn(headerCellClass, 'group')}>
                        <div className={headerContentClass}>
                          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-900 dark:text-white">
                            {column.label}
                          </span>
                        </div>
                        {renderResizeHandle(column.key)}
                      </th>
                    );
                  }

                  return (
                    <th key={`role-admin-header-${mode}-${column.key}`} ref={registerHeaderCell(column.key)} className={cn(headerCellClass, 'group')}>
                      <div className={headerContentClass}>
                        <div className="flex min-w-0 items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          aria-pressed={isActiveSort}
                          className={cn(
                            'flex min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] leading-none transition-colors',
                            isActiveSort
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100'
                              : 'border-transparent text-zinc-900 hover:text-zinc-700 dark:text-white'
                          )}
                        >
                          <span className="block min-w-0 truncate">{column.label}</span>
                          <ArrowUpDown
                            size={13}
                            className={cn(
                              'shrink-0 transition-transform',
                              isActiveSort && sortConfig.direction === 'desc' && 'rotate-180'
                            )}
                          />
                        </button>
                        <AdminTableColumnFilter
                          label={column.label}
                          options={filterOptions[column.key]}
                          selectedValues={columnFilters[column.key]}
                          onToggle={(value) => setColumnFilters((current) => ({
                            ...current,
                            [column.key]: current[column.key].includes(value)
                              ? current[column.key].filter((item) => item !== value)
                              : [...current[column.key], value],
                          }))}
                          onSelectAll={() => setColumnFilters((current) => ({
                            ...current,
                            [column.key]: filterOptions[column.key].map((option) => option.value),
                          }))}
                          onClear={() => setColumnFilters((current) => ({ ...current, [column.key]: [] }))}
                          filterLabel={t('filter')}
                          searchLabel={t('search')}
                          showAllLabel={t('showAll')}
                          noResultsLabel={t('noResults')}
                        />
                        </div>
                      </div>
                      {renderResizeHandle(column.key)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/10">
              {paginatedRows.map((row, index) => (
                <motion.tr
                  key={`role-admin-row-${row.id}`}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => setSelectedRow(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRow(row);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="group cursor-pointer transition-colors hover:bg-zinc-50/60 focus-visible:bg-zinc-50/80 focus-visible:outline-none dark:hover:bg-white/5"
                >
                  {[row.primary, row.secondary, row.status, row.location, row.client, row.metric, row.amount].map((value, cellIndex) => (
                    <td key={`role-admin-cell-${row.id}-${cellIndex}`} className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        {cellIndex === 2 ? (
                          <Badge variant={row.pallet?.is_for_repair ? 'danger' : row.pallet?.current_status_id === 5 ? 'warning' : 'info'} className="rounded-lg text-[9px]">
                            {value}
                          </Badge>
                        ) : (
                          <span
                            className={cn(
                              bodyTextClass,
                              cellIndex === 6 && mode === 'finance' && Number(row.sortValues.amount) > 0
                                ? 'text-rose-600'
                              : cellIndex === 0 && row.pallet?.is_for_repair
                                ? 'text-rose-600 dark:text-rose-300'
                                : 'text-zinc-600 dark:text-zinc-200'
                            )}
                          >
                            {value}
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className={bodyCellClass} onClick={(event) => event.stopPropagation()}>
                    <div className={bodyCellInnerClass}>
                      {mode === 'service' && row.pallet ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className={cn(
                            'h-9 w-9 p-0',
                            row.pallet.is_for_repair
                              ? 'border-emerald-600 bg-emerald-600 text-white hover:border-emerald-700 hover:bg-emerald-700'
                              : 'border-emerald-200 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800'
                          )}
                          title={row.pallet.is_for_repair ? 'Unmark the pallet for repair' : 'Mark the pallet for repair'}
                          aria-label={row.pallet.is_for_repair ? 'Unmark the pallet for repair' : 'Mark the pallet for repair'}
                          aria-pressed={row.pallet.is_for_repair}
                          onClick={() => {
                            const pallet = row.pallet!;
                            if (pallet.is_for_repair) {
                              markPalletAsRepaired(pallet);
                            }
                          }}
                        >
                          <Check size={15} />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      />
      <InfiniteScrollFooter
        hasMore={paginatedRows.length < visibleRows.length || (mode === 'service' && hasMoreRepairPallets) || (mode === 'warehouse' && hasMoreWarehousePallets)}
        isLoading={(mode === 'service' && (isRepairPalletsLoading || isLoadingMoreRepairPallets)) || (mode === 'warehouse' && (isWarehousePalletsLoading || isLoadingMoreWarehousePallets))}
        error={mode === 'service' ? repairPalletsError : mode === 'warehouse' ? warehousePalletsError : undefined}
        onLoadMore={() => {
          if (paginatedRows.length < visibleRows.length) {
            setVisibleCount((current) => Math.min(current + ADMIN_ROLE_PAGE_SIZE, visibleRows.length));
            return;
          }
          if (mode === 'service') {
            loadMoreRepairPallets();
          }
          if (mode === 'warehouse') {
            loadMoreWarehousePallets();
          }
        }}
        onRetry={mode === 'service' ? retryRepairPallets : mode === 'warehouse' ? retryWarehousePallets : undefined}
        language={language}
      />

      {selectedRow && (
        <div className="modal-overlay fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4" onClick={() => setSelectedRow(null)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={cn(
              'relative max-h-[88vh] w-full overflow-y-auto bg-white shadow-2xl no-scrollbar dark:bg-[#0f1513]',
              mode === 'service' && selectedRow.pallet
                ? 'my-auto flex h-[calc(100dvh-1.5rem)] max-h-[88vh] max-w-3xl flex-col overflow-hidden rounded-[2.5rem] p-0 sm:h-[calc(100dvh-2rem)]'
                : mode === 'warehouse' && selectedRow.pallet
                ? 'max-w-xl overflow-hidden rounded-[3rem] p-8'
                : 'max-w-2xl rounded-[2.5rem] p-7'
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {mode === 'service' && selectedRow.pallet ? (
              <>
                <div className="h-2 w-full bg-[#00A655]" />

                <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
                  <div className="mb-7 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200">
                        {t('serviceReportImage')}
                      </p>
                      <h3 className="mt-2 break-words text-2xl font-black uppercase leading-none tracking-tight text-zinc-950 dark:text-white sm:text-3xl">
                        {selectedRow.primary}
                      </h3>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                        {selectedRow.secondary}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t('closeDetails')}
                      onClick={() => setSelectedRow(null)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-white/[0.07] dark:text-zinc-300 dark:hover:bg-white/[0.12] dark:hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.9fr)] lg:items-stretch">
                    <div className="overflow-hidden rounded-[1.5rem] border border-zinc-100 bg-zinc-50 dark:border-white/10 dark:bg-[#151d1a]">
                      {serviceReportImageUrl ? (
                        <button
                          type="button"
                          onClick={() => setIsServiceReportPhotoViewerOpen(true)}
                          disabled={!selectedRow.serviceReport?.photos?.length}
                          className="group relative block h-80 w-full disabled:cursor-default"
                        >
                          <img
                            src={serviceReportImageUrl}
                            alt={formatServiceReportDescription(selectedRow.serviceReport.problem_description, language)}
                            className="h-80 w-full object-cover"
                          />
                          {!!selectedRow.serviceReport?.photos?.length && (
                            <span className="absolute left-3 top-3 rounded-full bg-[#00A655] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
                              {selectedRow.serviceReport.photos.length} {selectedRow.serviceReport.photos.length === 1 ? 'photo' : 'photos'}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="flex h-80 items-center justify-center px-6 text-center">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                            {isServiceReportImageLoading
                              ? language === 'bs'
                                ? 'Učitavanje fotografije...'
                                : language === 'nl'
                                  ? 'Foto laden...'
                                  : 'Loading photo...'
                              : serviceReportImageFailed
                                ? language === 'bs'
                                  ? 'Fotografiju nije moguće učitati'
                                  : language === 'nl'
                                    ? 'Foto kan niet worden geladen'
                                    : 'Photo could not be loaded'
                                : language === 'bs'
                                  ? 'Fotografija nije priložena'
                                  : language === 'nl'
                                    ? 'Geen foto toegevoegd'
                                    : 'No photo attached'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 lg:flex lg:h-80 lg:flex-col lg:space-y-0">
                      <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/60 p-5 dark:border-white/10 dark:bg-white/[0.06] lg:min-h-0 lg:flex-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-200">
                          {language === 'bs'
                            ? 'Opis oštećenja'
                            : language === 'nl'
                              ? 'Omschrijving schade'
                              : 'Damage description'}
                        </p>
                        <SoftHyphenatedText className="mt-3 block whitespace-pre-wrap text-sm font-bold leading-6 text-emerald-950 dark:text-white">
                          {formatServiceReportDescription(selectedRow.serviceReport?.problem_description, language) ||
                            formatServiceReportDescription(selectedRow.pallet.note, language) ||
                            '-'}
                        </SoftHyphenatedText>
                      </div>

                      <div className="grid grid-cols-2 gap-3 lg:mt-3 lg:shrink-0">
                        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a] lg:h-24">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                            {copy.status}
                          </p>
                          <p className="mt-2 break-words text-xs font-black uppercase text-rose-600 dark:text-rose-300">
                            {selectedRow.status}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a] lg:h-24">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                            {copy.metric}
                          </p>
                          <p className="mt-2 text-xs font-black uppercase text-zinc-950 dark:text-white">
                            {getDaysSince(
                              selectedRow.serviceReport?.created_at ||
                                selectedRow.pallet.last_status_changed_at
                            )}{' '}
                            {t('days')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isServiceReportPhotoViewerOpen && selectedRow.serviceReport?.photos && selectedRow.serviceReport.photos.length > 0 && (
                    <ServiceReportPhotoLightbox
                      photos={selectedRow.serviceReport.photos}
                      onClose={() => setIsServiceReportPhotoViewerOpen(false)}
                    />
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        {copy.location}
                      </p>
                      <p className="mt-2 break-words text-xs font-black text-zinc-950 dark:text-white">
                        {selectedRow.location}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        {copy.client}
                      </p>
                      <p className="mt-2 break-words text-xs font-black text-zinc-950 dark:text-white">
                        {selectedRow.client}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        {language === 'bs'
                          ? 'Vrijeme prijave'
                          : language === 'nl'
                            ? 'Gemeld op'
                            : 'Reported at'}
                      </p>
                      <p className="mt-2 text-xs font-black text-zinc-950 dark:text-white">
                        {formatAppDateTime(
                          selectedRow.serviceReport?.created_at ||
                            selectedRow.pallet.last_status_changed_at,
                          language
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                        {language === 'bs'
                          ? 'Prijavio'
                          : language === 'nl'
                            ? 'Gemeld door'
                            : 'Reported by'}
                      </p>
                      <p className="mt-2 break-words text-xs font-black text-zinc-950 dark:text-white">
                        {selectedRow.serviceReport?.reported_by_user?.name ||
                          (selectedRow.serviceReport
                            ? `#${selectedRow.serviceReport.reported_by_user_id}`
                            : '-')}
                      </p>
                    </div>
                  </div>

                </div>
                <div className="shrink-0 border-t border-zinc-100 bg-white p-5 dark:border-white/10 dark:bg-[#0f1513] sm:p-6">
                  <Button
                    type="button"
                    className="mt-6 w-full py-4"
                    onClick={() => markServiceResolved(selectedRow)}
                  >
                    {language === 'bs'
                      ? 'Označi kao popravljeno'
                      : language === 'nl'
                        ? 'Als gerepareerd markeren'
                        : 'Mark repaired'}
                  </Button>
                </div>
              </>
            ) : mode === 'warehouse' && selectedRow.pallet ? (
              <>
                <div className="absolute inset-x-0 top-0 h-2 bg-black dark:bg-emerald-400" />

                <div className="mb-8 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 pr-3">
                    <h3 className="mb-1 break-all text-3xl font-black uppercase leading-none tracking-tighter text-zinc-950 dark:text-white">
                      {selectedRow.primary}
                    </h3>
                    <span className="block truncate text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {selectedRow.secondary}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={t('closeDetails')}
                    onClick={() => setSelectedRow(null)}
                    className="shrink-0 rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-6 md:grid-cols-3">
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {copy.location}
                    </span>
                    <p className="break-words text-xs font-black uppercase text-zinc-950 dark:text-white">
                      {selectedRow.location}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {copy.status}
                    </span>
                    <p className="text-xs font-black uppercase text-blue-600 dark:text-blue-300">
                      {selectedRow.status}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {copy.metric}
                    </span>
                    <p className="text-xs font-black text-zinc-950 dark:text-white">
                      {selectedRow.metric} {t('days')}
                    </p>
                  </div>
                </div>

                <div className="mb-4 grid gap-6 sm:grid-cols-2">
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {copy.client}
                    </span>
                    <p className="break-words text-xs font-black uppercase text-zinc-950 dark:text-white">
                      {selectedRow.client}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                    <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {copy.amount}
                    </span>
                    <p className="break-words text-xs font-black uppercase text-zinc-950 dark:text-white">
                      {selectedRow.amount}
                    </p>
                  </div>
                </div>

                <div className="mb-8 rounded-2xl bg-zinc-50 p-4 dark:bg-[#151d1a]">
                  <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    {t('timestamp')}
                  </span>
                  <p className="text-xs font-black uppercase text-zinc-950 dark:text-white">
                    {formatAppDateTime(selectedRow.pallet.last_status_changed_at, language)}
                  </p>
                  {selectedRow.pallet.note && (
                    <p className="mt-3 text-xs font-bold leading-5 text-zinc-600 dark:text-zinc-200">
                      {formatServiceReportDescription(selectedRow.pallet.note, language)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  className="w-full rounded-2xl bg-black py-4 text-xs font-black uppercase text-white shadow-xl shadow-black/10 transition-transform active:scale-[0.99] dark:bg-emerald-500 dark:text-emerald-950"
                >
                  {t('closeDetails')}
                </button>
              </>
            ) : (
              <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{copy.title}</p>
                <h3 className="mt-2 truncate text-3xl font-black uppercase tracking-tight text-emerald-950 dark:text-white">{selectedRow.primary}</h3>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-white/10">
                <X size={20} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {columns.map((column, index) => (
                <div key={`role-admin-detail-${column.key}`} className="rounded-2xl bg-zinc-50 p-4 text-center dark:bg-[#151d1a]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{column.label}</p>
                  <p className="mt-2 text-xs font-black uppercase text-zinc-900 dark:text-white">
                    {[selectedRow.primary, selectedRow.secondary, selectedRow.status, selectedRow.location, selectedRow.client, selectedRow.metric, selectedRow.amount][index]}
                  </p>
                </div>
              ))}
            </div>

            {selectedRow.pallet && (
              <div className="mt-5 rounded-2xl border border-zinc-100 bg-white p-4 dark:border-white/10 dark:bg-[#151d1a]">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{t('timestamp')}</p>
                <p className="mt-2 text-xs font-bold uppercase text-zinc-700 dark:text-zinc-200">
                  {formatAppDateTime(selectedRow.pallet.last_status_changed_at, language)}
                </p>
                {selectedRow.pallet.note && (
                  <p className="mt-3 text-xs font-bold leading-5 text-zinc-600 dark:text-zinc-200">
                    {formatServiceReportDescription(selectedRow.pallet.note, language)}
                  </p>
                )}
              </div>
            )}

              </>
            )}
          </motion.div>
        </div>
      )}

      {repairCompletionUndo && (
        <RepairCompletionUndoModal
          palletLabel={getPalletDisplayName(repairCompletionUndo.pallet)}
          language={language}
          onUndo={undoPalletRepairCompletion}
          onConfirm={() => setRepairCompletionUndo(null)}
        />
      )}
    </div>
  );
};
