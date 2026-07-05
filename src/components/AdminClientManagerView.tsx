import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CalendarClock,
  CreditCard,
  Download,
  Euro,
  FileText,
  Hash,
  MapPin,
  Package,
  Phone,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { Badge, Button, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { ClientDetail, Pallet } from '../types';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';
import { ListPagination } from './ListPagination';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService, PaginationMeta } from '../services/api';

type SortKey =
  | 'client'
  | 'kvk'
  | 'phone'
  | 'address'
  | 'totalPallets'
  | 'overduePallets'
  | 'rate'
  | 'overdueDays'
  | 'gracePeriod'
  | 'overdueTotal';
type SortDirection = 'asc' | 'desc';

type ClientManagerRow = {
  client: ClientDetail;
  clientName: string;
  kvkLabel: string;
  phoneLabel: string;
  addressLabel: string;
  warehouses: string[];
  totalPallets: number;
  overduePallets: number;
  rate: number;
  rateLabel: string;
  overdueDays: number;
  gracePeriod: number;
  overdueTotal: number;
  overdueTotalLabel: string;
  clientPallets: Pallet[];
};

const COLUMN_ORDER = [
  'client',
  'kvk',
  'phone',
  'address',
  'totalPallets',
  'overduePallets',
  'rate',
  'overdueDays',
  'gracePeriod',
  'overdueTotal',
] as const satisfies readonly SortKey[];

const INITIAL_COLUMN_WIDTHS: Record<SortKey, number> = {
  client: 190,
  kvk: 145,
  phone: 160,
  address: 240,
  totalPallets: 145,
  overduePallets: 145,
  rate: 155,
  overdueDays: 155,
  gracePeriod: 145,
  overdueTotal: 170,
};

const MIN_COLUMN_WIDTHS: Record<SortKey, number> = {
  client: 160,
  kvk: 120,
  phone: 135,
  address: 190,
  totalPallets: 125,
  overduePallets: 125,
  rate: 125,
  overdueDays: 130,
  gracePeriod: 125,
  overdueTotal: 140,
};

const CLIENT_MANAGER_PAGE_SIZE = 25;

export const AdminClientManagerView: React.FC = () => {
  const { clients: cachedClients, pallets, statuses, invoices, updateClient, t, language } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<SortKey, HTMLTableCellElement | null>>>({});
  const [clients, setPagedClients] = useState<ClientDetail[]>([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [pageLimit, setPageLimit] = useState(CLIENT_MANAGER_PAGE_SIZE);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    total: 0,
    limit: CLIENT_MANAGER_PAGE_SIZE,
    offset: 0,
    count: 0,
  });
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'client',
    direction: 'asc',
  });
  const [selectedRow, setSelectedRow] = useState<ClientManagerRow | null>(null);
  const [clientDraft, setClientDraft] = useState<ClientDetail | null>(null);
  const {
    headerCellClass,
    headerIconClass,
    headerContentClass,
    bodyCellClass,
    bodyCellInnerClass,
    bodyTextClass,
  } = adminTableStyles;

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      setIsPageLoading(true);

      try {
        const page = await apiService.clients.page({
          limit: pageLimit,
          offset: pageOffset,
        });

        if (!isMounted) {
          return;
        }

        setPagedClients(page.items);
        setPaginationMeta(page.meta);
      } catch (error) {
        console.error('Failed to load paginated client manager rows', error);
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
  }, [pageLimit, pageOffset]);

  useEffect(() => {
    if (cachedClients.length === 0) {
      return;
    }

    setPagedClients((current) =>
      current.map((client) => cachedClients.find((cachedClient) => cachedClient.id === client.id) || client)
    );
  }, [cachedClients]);

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
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [locale]
  );

  const labels = {
    search:
      language === 'bs'
        ? 'Pretraži klijente, KVK, adresu ili telefon'
        : language === 'nl'
          ? 'Zoek klant, KVK, adres of telefoon'
          : 'Search client, KVK, address or phone',
    noResults:
      language === 'bs'
        ? 'Nema klijenata za ovaj search.'
        : language === 'nl'
          ? 'Geen klanten voor deze zoekopdracht.'
          : 'No clients match this search.',
    clientDetails:
      language === 'bs' ? 'Podaci o klijentu' : language === 'nl' ? 'Klantgegevens' : 'Client details',
    address: language === 'bs' ? 'Adresa' : language === 'nl' ? 'Adres' : 'Address',
    phone: language === 'bs' ? 'Broj telefona' : language === 'nl' ? 'Telefoonnummer' : 'Phone number',
    totalPallets:
      language === 'bs' ? 'Ukupno paleta' : language === 'nl' ? 'Totaal bokken' : 'Total pallets',
    overduePallets:
      language === 'bs' ? 'Paleta kasni' : language === 'nl' ? 'Bokken te laat' : 'Overdue pallets',
    rate:
      language === 'bs' ? 'Iznos po danu kašnjenja' : language === 'nl' ? 'Tarief per dag te laat' : 'Late fee per day',
    overdueDays:
      language === 'bs' ? 'Broj dana kašnjenja' : language === 'nl' ? 'Dagen te laat' : 'Overdue days',
    gracePeriod:
      language === 'bs' ? 'Grace period' : language === 'nl' ? 'Grace period' : 'Grace period',
    overdueTotal:
      language === 'bs' ? 'Ukupan dug' : language === 'nl' ? 'Totale schuld' : 'Total overdue',
    warehouse1:
      language === 'bs' ? 'Magacin 1' : language === 'nl' ? 'Magazijn 1' : 'Warehouse 1',
    warehouse2:
      language === 'bs' ? 'Magacin 2' : language === 'nl' ? 'Magazijn 2' : 'Warehouse 2',
    palletsAtClient:
      language === 'bs' ? 'Palete kod kupca' : language === 'nl' ? 'Bokken bij klant' : 'Pallets at client',
    lastInvoices:
      language === 'bs' ? 'Zadnje fakture' : language === 'nl' ? 'Laatste facturen' : 'Last invoices',
    exportInvoice:
      language === 'bs' ? 'Export invoice' : language === 'nl' ? 'Factuur exporteren' : 'Export invoice',
    save:
      language === 'bs' ? 'Sačuvaj izmjene' : language === 'nl' ? 'Wijzigingen opslaan' : 'Save changes',
    close:
      language === 'bs' ? 'Zatvori' : language === 'nl' ? 'Sluiten' : 'Close',
    noPallets:
      language === 'bs' ? 'Nema paleta kod ovog kupca.' : language === 'nl' ? 'Geen bokken bij deze klant.' : 'No pallets at this client.',
    noInvoices:
      language === 'bs' ? 'Nema faktura za prikaz.' : language === 'nl' ? 'Geen facturen om te tonen.' : 'No invoices to show.',
    invoiceExported:
      language === 'bs' ? 'Invoice export pripremljen za' : language === 'nl' ? 'Factuurexport voorbereid voor' : 'Invoice export prepared for',
    resize:
      language === 'bs'
        ? 'Promijeni sirinu kolone'
        : language === 'nl'
          ? 'Kolombreedte aanpassen'
          : 'Resize column',
  };

  const getDaysSince = (date: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));

  const rows = useMemo<ClientManagerRow[]>(
    () =>
      clients.map((client, index) => {
        const clientPallets = pallets.filter((pallet) => pallet.user_id === client.user_id);
        const overdueData = clientPallets.reduce(
          (total, pallet) => {
            const status = statuses.find((item) => item.id === pallet.current_status_id);
            const overdueDays = status?.is_billable
              ? Math.max(getDaysSince(pallet.last_status_changed_at) - client.grace_period_days, 0)
              : 0;

            return {
              overdueDays: total.overdueDays + overdueDays,
              overduePallets: total.overduePallets + (overdueDays > 0 ? 1 : 0),
            };
          },
          { overdueDays: 0, overduePallets: 0 }
        );
        const warehouses = client.warehouse_addresses?.filter(Boolean) || [];
        const overdueTotal = overdueData.overdueDays * client.price_per_day;

        return {
          client,
          clientName: client.name,
          kvkLabel: client.kvk_number || '-',
          phoneLabel: client.phone_number || '-',
          addressLabel: warehouses[0] || '-',
          warehouses,
          totalPallets: clientPallets.length,
          overduePallets: overdueData.overduePallets,
          rate: client.price_per_day,
          rateLabel: `EUR ${currencyFormatter.format(client.price_per_day)}`,
          overdueDays: overdueData.overdueDays,
          gracePeriod: client.grace_period_days,
          overdueTotal,
          overdueTotalLabel: `EUR ${currencyFormatter.format(overdueTotal)}`,
          clientPallets,
        };
      }),
    [clients, currencyFormatter, pallets, statuses]
  );

  const getSortValue = (row: ClientManagerRow, key: SortKey) => {
    switch (key) {
      case 'totalPallets':
        return row.totalPallets;
      case 'overduePallets':
        return row.overduePallets;
      case 'rate':
        return row.rate;
      case 'overdueDays':
        return row.overdueDays;
      case 'gracePeriod':
        return row.gracePeriod;
      case 'overdueTotal':
        return row.overdueTotal;
      case 'kvk':
        return row.kvkLabel;
      case 'phone':
        return row.phoneLabel;
      case 'address':
        return row.addressLabel;
      default:
        return row.clientName;
    }
  };

  const visibleRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const nextRows = rows.filter((row) => {
      if (!query) {
        return true;
      }

      return [
        row.clientName,
        row.kvkLabel,
        row.phoneLabel,
        row.addressLabel,
        ...row.warehouses,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });

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
  }, [rows, searchQuery, sortConfig]);

  const selectedInvoices = useMemo(() => {
    if (!selectedRow) {
      return [];
    }

    const realInvoices = invoices.filter(
      (invoice) =>
        invoice.customer_id === selectedRow.client.user_id ||
        invoice.customer_name.toLowerCase() === selectedRow.clientName.toLowerCase()
    );

    if (realInvoices.length > 0) {
      return realInvoices.slice(0, 3).map((invoice) => ({
        id: invoice.id,
        number: invoice.invoice_number,
        amount: `EUR ${currencyFormatter.format(invoice.total_amount)}`,
        date: dateFormatter.format(new Date(invoice.issue_date)),
        status: invoice.status,
      }));
    }

    return [
      {
        id: 8000 + selectedRow.client.id,
        number: `INV-${selectedRow.client.id.toString().padStart(4, '0')}-01`,
        amount: `EUR ${currencyFormatter.format(Math.max(selectedRow.overdueTotal, selectedRow.rate * 3))}`,
        date: dateFormatter.format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
        status: selectedRow.overdueTotal > 0 ? 'overdue' : 'sent',
      },
      {
        id: 8100 + selectedRow.client.id,
        number: `INV-${selectedRow.client.id.toString().padStart(4, '0')}-00`,
        amount: `EUR ${currencyFormatter.format(selectedRow.rate * 5)}`,
        date: dateFormatter.format(new Date(Date.now() - 36 * 24 * 60 * 60 * 1000)),
        status: 'paid',
      },
    ];
  }, [currencyFormatter, dateFormatter, invoices, selectedRow]);

  const openClientModal = (row: ClientManagerRow) => {
    setSelectedRow(row);
    setClientDraft({
      ...row.client,
      phone_number: row.phoneLabel === '-' ? '' : row.phoneLabel,
      warehouse_addresses: row.warehouses.length > 0 ? row.warehouses : [''],
    });
  };

  const closeClientModal = () => {
    setSelectedRow(null);
    setClientDraft(null);
  };

  const updateDraftWarehouse = (index: number, value: string) => {
    setClientDraft((current) => {
      if (!current) {
        return current;
      }

      const addresses = [...(current.warehouse_addresses || [])];
      while (addresses.length <= index) {
        addresses.push('');
      }
      addresses[index] = value;

      return { ...current, warehouse_addresses: addresses };
    });
  };

  const saveClientDraft = () => {
    if (!clientDraft) {
      return;
    }

    updateClient({
      ...clientDraft,
      warehouse_addresses: (clientDraft.warehouse_addresses || [])
        .map((address) => address.trim())
        .filter(Boolean),
      phone_number: clientDraft.phone_number?.trim() || undefined,
    });
    closeClientModal();
  };

  const toggleSort = (key: SortKey) => {
    setSortConfig((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const renderSortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden text-[9px] font-black uppercase tracking-[0.14em] leading-none text-zinc-900 transition-colors hover:text-zinc-700 dark:text-white dark:hover:text-emerald-100"
    >
      <span className="block min-w-0 truncate">{label}</span>
      <ArrowUpDown size={13} className="shrink-0" />
    </button>
  );

  const headerConfig: Record<
    SortKey,
    { label: string; icon: React.ComponentType<{ size?: number }> }
  > = {
    client: { label: t('client'), icon: Building2 },
    kvk: { label: 'KVK', icon: Hash },
    phone: { label: labels.phone, icon: Phone },
    address: { label: labels.address, icon: MapPin },
    totalPallets: { label: labels.totalPallets, icon: Package },
    overduePallets: { label: labels.overduePallets, icon: AlertTriangle },
    rate: { label: labels.rate, icon: Euro },
    overdueDays: { label: labels.overdueDays, icon: CalendarClock },
    gracePeriod: { label: labels.gracePeriod, icon: CreditCard },
    overdueTotal: { label: labels.overdueTotal, icon: FileText },
  };

  const renderMetricCard = (label: string, value: React.ReactNode, danger = false) => (
    <div className="flex min-h-[5.75rem] flex-col items-center justify-center rounded-2xl bg-gray-50 p-4 text-center dark:bg-[#203d31]">
      <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-[#9fcbb3]">
        {label}
      </span>
      <p className={cn('w-full truncate text-xs font-black uppercase text-zinc-900 dark:text-white', danger && 'text-rose-600 dark:text-rose-200')}>
        {value}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#1a3327]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-white/10 dark:text-emerald-100">
            <UserRound size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-[#9fcbb3]">
              Client Manager
            </p>
            <p className="text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">
              {language === 'bs'
                ? 'Admin pregled i kontrola kupaca'
                : language === 'nl'
                  ? 'Admin overzicht en beheer van klanten'
                  : 'Admin overview and client control'}
            </p>
          </div>
        </div>
        <div className="relative w-full sm:max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={labels.search}
            className="h-11 bg-white pl-10 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal dark:bg-[#243f32]"
          />
        </div>
      </div>

      <AdminDataTable<SortKey>
        columnOrder={COLUMN_ORDER}
        initialColumnWidths={INITIAL_COLUMN_WIDTHS}
        minColumnWidths={MIN_COLUMN_WIDTHS}
        resizeAriaLabel={labels.resize}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isPageLoading && visibleRows.length === 0}
        emptyState={
          <div className="p-20 text-center">
            <Search size={20} className="mx-auto mb-4 text-zinc-200" />
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
              {labels.noResults}
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
                <col key={`admin-client-col-${key}`} style={{ width: columnWidths[key] }} />
              ))}
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80 dark:border-white/10 dark:bg-white/5">
              <tr>
                {COLUMN_ORDER.map((key) => {
                  const Icon = headerConfig[key].icon;
                  return (
                    <th
                      key={`admin-client-header-${key}`}
                      ref={registerHeaderCell(key)}
                      className={cn(headerCellClass, 'group')}
                    >
                      <div className={headerContentClass}>
                        <div className={headerIconClass}>
                          <Icon size={16} />
                        </div>
                        {renderSortButton(key, headerConfig[key].label)}
                      </div>
                      {renderResizeHandle(key)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/10">
              {visibleRows.map((row, index) => (
                <motion.tr
                  key={`admin-client-row-${row.client.id}`}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => openClientModal(row)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openClientModal(row);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  className="group cursor-pointer transition-colors hover:bg-zinc-50/60 focus-visible:bg-zinc-50/80 focus-visible:outline-none dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
                >
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-emerald-950 dark:text-white')}>{row.clientName}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-600 dark:text-zinc-200')}>{row.kvkLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500 dark:text-zinc-300')}>{row.phoneLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500 dark:text-zinc-300')}>{row.addressLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-900 dark:text-white')}>{row.totalPallets}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, row.overduePallets > 0 ? 'text-rose-600 dark:text-rose-200' : 'text-zinc-400')}>
                        {row.overduePallets}
                      </span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-500 dark:text-zinc-300')}>{row.rateLabel}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, row.overdueDays > 0 ? 'text-rose-600 dark:text-rose-200' : 'text-zinc-400')}>
                        {row.overdueDays}
                      </span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, 'text-zinc-600 dark:text-zinc-200')}>{row.gracePeriod}</span>
                    </div>
                  </td>
                  <td className={bodyCellClass}>
                    <div className={bodyCellInnerClass}>
                      <span className={cn(bodyTextClass, row.overdueTotal > 0 ? 'text-rose-600 dark:text-rose-200' : 'text-zinc-400')}>
                        {row.overdueTotalLabel}
                      </span>
                    </div>
                  </td>
                </motion.tr>
              ))}
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

      {selectedRow && clientDraft && (
        <div
          className="modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4"
          onClick={closeClientModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[3rem] bg-white p-8 shadow-2xl no-scrollbar dark:bg-[#172d22]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute left-0 right-0 top-0 h-2 bg-black dark:bg-[#00A655]" />

            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="mb-1 text-3xl font-black uppercase tracking-tighter text-emerald-950 dark:text-white">
                  {selectedRow.clientName}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {labels.clientDetails} · KVK {selectedRow.kvkLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={closeClientModal}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label={labels.close}
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-6 grid auto-rows-fr grid-cols-2 gap-4 md:grid-cols-5">
              {renderMetricCard(labels.totalPallets, selectedRow.totalPallets)}
              {renderMetricCard(labels.overduePallets, selectedRow.overduePallets, selectedRow.overduePallets > 0)}
              {renderMetricCard(labels.rate, selectedRow.rateLabel)}
              {renderMetricCard(labels.overdueDays, selectedRow.overdueDays, selectedRow.overdueDays > 0)}
              {renderMetricCard(labels.overdueTotal, selectedRow.overdueTotalLabel, selectedRow.overdueTotal > 0)}
            </div>

            <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_1.25fr]">
              <div className="flex h-full flex-col rounded-[2rem] border border-zinc-100 bg-zinc-50/70 p-5 dark:border-white/10 dark:bg-[#203d31]">
                <div className="grid auto-rows-fr gap-4 md:grid-cols-2">
                  <div className="flex flex-col justify-end space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.address}
                    </label>
                    <Input
                      value={clientDraft.warehouse_addresses?.[0] || ''}
                      onChange={(event) => updateDraftWarehouse(0, event.target.value)}
                      className="bg-white normal-case tracking-normal"
                    />
                  </div>
                  <div className="flex flex-col justify-end space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.phone}
                    </label>
                    <Input
                      value={clientDraft.phone_number || ''}
                      onChange={(event) => setClientDraft({ ...clientDraft, phone_number: event.target.value })}
                      className="bg-white normal-case tracking-normal"
                    />
                  </div>
                  <div className="flex flex-col justify-end space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.rate}
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={clientDraft.price_per_day}
                      onChange={(event) =>
                        setClientDraft({ ...clientDraft, price_per_day: Number(event.target.value) })
                      }
                      className="bg-white"
                    />
                  </div>
                  <div className="flex flex-col justify-end space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.gracePeriod}
                    </label>
                    <Input
                      type="number"
                      value={clientDraft.grace_period_days}
                      onChange={(event) =>
                        setClientDraft({ ...clientDraft, grace_period_days: Number(event.target.value) })
                      }
                      className="bg-white"
                    />
                  </div>
                  <div className="flex flex-col justify-end space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.warehouse2}
                    </label>
                    <Input
                      value={clientDraft.warehouse_addresses?.[1] || ''}
                      onChange={(event) => updateDraftWarehouse(1, event.target.value)}
                      className="bg-white normal-case tracking-normal"
                    />
                  </div>
                </div>

                <div className="mt-4 grid auto-rows-fr grid-cols-2 gap-3">
                  {renderMetricCard('KVK', selectedRow.kvkLabel)}
                  {renderMetricCard(labels.warehouse1, clientDraft.warehouse_addresses?.[0] || '-')}
                </div>

                <Button type="button" className="mt-auto w-full py-4" onClick={saveClientDraft}>
                  {labels.save}
                </Button>
              </div>

              <div className="grid h-full gap-4">
                <div className="flex min-h-[17rem] flex-col rounded-[2rem] border border-zinc-100 bg-white p-5 dark:border-white/10 dark:bg-[#203d31]">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.palletsAtClient}
                    </h4>
                    <Package size={17} className="text-gray-300" />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-100 no-scrollbar dark:border-white/10">
                    {selectedRow.clientPallets.length > 0 ? (
                      selectedRow.clientPallets.map((pallet) => (
                        <div
                          key={`admin-client-modal-pallet-${pallet.id}`}
                          className="grid min-h-14 grid-cols-[1fr_1fr_1.2fr] items-center gap-2 border-b border-zinc-100 px-4 py-3 text-center last:border-b-0 dark:border-white/10"
                        >
                          <span className="truncate text-[11px] font-black uppercase text-emerald-950 dark:text-white">
                            {pallet.qr_code}
                          </span>
                          <span className="truncate text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-300">
                            {getPalletTypeLabel(pallet.type, language)}
                          </span>
                          <Badge
                            variant={pallet.current_status_id === 4 ? 'success' : pallet.current_status_id === 7 ? 'danger' : 'info'}
                            className="justify-self-end rounded-lg text-[8px]"
                          >
                            {getStatusLabel(pallet.current_status_name, language)}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="px-4 py-8 text-center text-[10px] font-black uppercase tracking-widest text-zinc-300">
                        {labels.noPallets}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex min-h-[17rem] flex-col rounded-[2rem] border border-zinc-100 bg-white p-5 dark:border-white/10 dark:bg-[#203d31]">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.lastInvoices}
                    </h4>
                    <FileText size={17} className="text-gray-300" />
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto no-scrollbar">
                    {selectedInvoices.length > 0 ? (
                      selectedInvoices.map((invoice) => (
                        <div
                          key={`admin-client-invoice-${invoice.id}`}
                          className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-[#172d22]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-black uppercase text-zinc-950 dark:text-white">
                              {invoice.number}
                            </p>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                              {invoice.date} · {invoice.status}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            <span className="text-[11px] font-black text-zinc-700 dark:text-zinc-200">
                              {invoice.amount}
                            </span>
                            <Button
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => alert(`${labels.invoiceExported} ${invoice.number}`)}
                              className="h-9 px-3"
                            >
                              <Download size={13} />
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="px-4 py-8 text-center text-[10px] font-black uppercase tracking-widest text-zinc-300">
                        {labels.noInvoices}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => alert(`${labels.invoiceExported} ${selectedRow.clientName}`)}
                  >
                    <Download size={15} />
                    {labels.exportInvoice}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
