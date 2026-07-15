import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Euro,
  FileText,
  Hash,
  Image as ImageIcon,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { Badge, Button, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { ClientDetail, Pallet, PalletPhoto } from '../types';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';
import { ListPagination } from './ListPagination';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService, PaginationMeta } from '../services/api';
import { getPalletDisplayName } from '../lib/palletDisplay';

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

type PhotoViewerState = {
  palletId: number;
  palletName: string;
  photos: PalletPhoto[];
  index: number;
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
const SERVER_SORT_BY_KEY: Partial<Record<SortKey, string>> = {
  client: 'client',
  kvk: 'kvk',
  phone: 'phone',
  address: 'address',
  rate: 'rate',
  gracePeriod: 'gracePeriod',
};

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
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'client',
    direction: 'asc',
  });
  const [selectedRow, setSelectedRow] = useState<ClientManagerRow | null>(null);
  const [clientDraft, setClientDraft] = useState<ClientDetail | null>(null);
  const [clientPhotos, setClientPhotos] = useState<PalletPhoto[]>([]);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState | null>(null);
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
          search: debouncedSearchQuery || undefined,
          sort_by: SERVER_SORT_BY_KEY[sortConfig.key],
          sort_direction: sortConfig.direction,
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
    companyName:
      language === 'bs' ? 'Naziv firme' : language === 'nl' ? 'Bedrijfsnaam' : 'Company name',
    address: language === 'bs' ? 'Adresa' : language === 'nl' ? 'Adres' : 'Address',
    phone: language === 'bs' ? 'Broj telefona' : language === 'nl' ? 'Telefoonnummer' : 'Phone number',
    totalPallets:
      language === 'bs' ? 'Ukupno paleta' : language === 'nl' ? 'Totaal bokken' : 'Total pallets',
    overduePallets:
      language === 'bs' ? 'Paleta kasni' : language === 'nl' ? 'Bokken te laat' : 'Overdue pallets',
    rate:
      language === 'bs' ? 'Dnevna tarifa' : language === 'nl' ? 'Dagtarief' : 'Daily rate',
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
      language === 'bs' ? 'Izvezi fakturu' : language === 'nl' ? 'Factuur exporteren' : 'Export invoice',
    viewPhotos:
      language === 'bs' ? 'Prikaži fotografije palete' : language === 'nl' ? 'Palletfoto\'s bekijken' : 'View pallet photos',
    noPhotos:
      language === 'bs' ? 'Nema fotografija za ovog kupca' : language === 'nl' ? 'Geen foto\'s voor deze klant' : 'No photos for this customer',
    photos: language === 'bs' ? 'Fotografije' : language === 'nl' ? 'Foto\'s' : 'Photos',
    previous: language === 'bs' ? 'Prethodna fotografija' : language === 'nl' ? 'Vorige foto' : 'Previous photo',
    next: language === 'bs' ? 'Sljedeća fotografija' : language === 'nl' ? 'Volgende foto' : 'Next photo',
    save:
      language === 'bs' ? 'Sačuvaj izmjene' : language === 'nl' ? 'Wijzigingen opslaan' : 'Save changes',
    close:
      language === 'bs' ? 'Zatvori' : language === 'nl' ? 'Sluiten' : 'Close',
    noPallets:
      language === 'bs' ? 'Nema paleta kod ovog kupca.' : language === 'nl' ? 'Geen bokken bij deze klant.' : 'No pallets at this client.',
    noInvoices:
      language === 'bs' ? 'Nema faktura za prikaz.' : language === 'nl' ? 'Geen facturen om te tonen.' : 'No invoices to show.',
    invoiceExported:
      language === 'bs' ? 'Izvoz fakture pripremljen za' : language === 'nl' ? 'Factuurexport voorbereid voor' : 'Invoice export prepared for',
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
    const nextRows = [...rows];

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
  }, [rows, sortConfig]);

  const selectedInvoices = useMemo(() => {
    if (!selectedRow) {
      return [];
    }

    const realInvoices = invoices.filter(
      (invoice) =>
        invoice.customer_id === selectedRow.client.user_id ||
        invoice.customer_name.toLowerCase() === selectedRow.clientName.toLowerCase()
    );

    return realInvoices.slice(0, 3).map((invoice) => ({
      id: invoice.id,
      number: invoice.invoice_number,
      amount: `EUR ${currencyFormatter.format(invoice.total_amount)}`,
      date: dateFormatter.format(new Date(invoice.issue_date)),
      status: invoice.status,
    }));
  }, [currencyFormatter, dateFormatter, invoices, selectedRow]);

  const clientPhotosByPallet = useMemo(() => {
    const photosByPallet = new Map<number, PalletPhoto[]>();

    clientPhotos.forEach((photo) => {
      const photos = photosByPallet.get(photo.pallet_id) || [];
      photos.push(photo);
      photosByPallet.set(photo.pallet_id, photos);
    });

    return photosByPallet;
  }, [clientPhotos]);

  useEffect(() => {
    let isMounted = true;

    if (!selectedRow) {
      setClientPhotos([]);
      return () => {
        isMounted = false;
      };
    }

    setClientPhotos([]);

    void apiService.clients
      .palletPhotos(selectedRow.client.id)
      .then((photos) => {
        if (isMounted) {
          setClientPhotos(photos);
        }
      })
      .catch((error) => console.error('Failed to load customer pallet photos', error));

    return () => {
      isMounted = false;
    };
  }, [selectedRow]);

  useEffect(() => {
    if (!photoViewer) {
      return;
    }

    const latestPhotos = clientPhotosByPallet.get(photoViewer.palletId);

    if (!latestPhotos && photoViewer.photos.length === 0) {
      return;
    }

    if (latestPhotos !== photoViewer.photos) {
      setPhotoViewer((current) => current && ({
        ...current,
        photos: latestPhotos || [],
        index: Math.min(current.index, Math.max((latestPhotos?.length || 1) - 1, 0)),
      }));
    }
  }, [clientPhotosByPallet, photoViewer]);

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
    setPhotoViewer(null);
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

  const addDraftWarehouse = () => {
    setClientDraft((current) => {
      if (!current) {
        return current;
      }

      const addresses = [...(current.warehouse_addresses || [])];
      if (addresses.length >= 2) {
        return current;
      }

      return { ...current, warehouse_addresses: [...addresses, ''] };
    });
  };

  const removeDraftWarehouse = (index: number) => {
    setClientDraft((current) => {
      if (!current) {
        return current;
      }

      const addresses = [...(current.warehouse_addresses || [])];
      addresses.splice(index, 1);

      return { ...current, warehouse_addresses: addresses.length > 0 ? addresses : [''] };
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
            : 'border-transparent text-zinc-900 hover:text-zinc-700 dark:text-white dark:hover:text-emerald-100'
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
    <div className="flex min-h-[5.75rem] flex-col items-center justify-center rounded-2xl bg-gray-50 p-4 text-center dark:bg-[#151d1a]">
      <span className="mb-2 block text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-400">
        {label}
      </span>
      <p className={cn('w-full truncate text-xs font-black uppercase text-zinc-900 dark:text-white', danger && 'text-rose-600 dark:text-rose-200')}>
        {value}
      </p>
    </div>
  );

  const visiblePhoto = photoViewer?.photos[photoViewer.index];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#101715]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-white/10 dark:text-emerald-100">
            <UserRound size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-400">
              {t('clientManager')}
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
            className="h-11 bg-white pl-10 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal dark:bg-[#151d1a]"
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
            className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[3rem] bg-white p-8 shadow-2xl no-scrollbar dark:bg-[#0f1513]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="absolute left-0 right-0 top-0 h-2 bg-black dark:bg-[#00A655]" />

            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="mb-1 text-3xl font-black uppercase tracking-tighter text-emerald-950 dark:text-white">
                  {selectedRow.clientName}
                </h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  {labels.clientDetails}
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

            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <div className="flex h-full flex-col rounded-[2rem] border border-zinc-100 bg-zinc-50/70 p-5 dark:border-white/10 dark:bg-[#151d1a]">
                <div className="mb-4 rounded-[1.5rem] border border-emerald-100 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#101715]">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                    <Hash size={13} />
                    KVK
                  </div>
                  <p className="mt-1 text-base font-black uppercase tracking-tight text-emerald-950 dark:text-white">
                    {selectedRow.kvkLabel}
                  </p>
                </div>

                <div className="grid auto-rows-fr gap-4 md:grid-cols-3">
                  <div className="flex min-w-0 flex-col justify-end space-y-1 md:col-span-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.companyName}
                    </label>
                    <Input
                      value={clientDraft.name}
                      onChange={(event) => setClientDraft({ ...clientDraft, name: event.target.value })}
                      className="bg-white normal-case tracking-normal"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col justify-end space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.phone}
                    </label>
                    <Input
                      value={clientDraft.phone_number || ''}
                      onChange={(event) => setClientDraft({ ...clientDraft, phone_number: event.target.value })}
                      className="bg-white normal-case tracking-normal"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col justify-end space-y-1">
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
                  <div className="flex min-w-0 flex-col justify-end space-y-1">
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
                </div>

                <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-white/10">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {language === 'bs' ? 'Magacini' : language === 'nl' ? 'Magazijnen' : 'Warehouses'}
                    </h4>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-300">
                      {(clientDraft.warehouse_addresses || []).filter(Boolean).length}/2
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: Math.max(1, Math.min(2, (clientDraft.warehouse_addresses || []).length)) }).map((_, index) => (
                      <div
                        key={`client-warehouse-editor-${index}`}
                        className="flex min-h-[9.5rem] flex-col justify-between rounded-[1.5rem] border border-zinc-100 bg-white p-4 dark:border-white/10 dark:bg-[#101715]"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <label className="flex min-w-0 items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-400">
                            <MapPin size={13} className="shrink-0" />
                            <span className="truncate">{index === 0 ? labels.warehouse1 : labels.warehouse2}</span>
                          </label>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => removeDraftWarehouse(index)}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 hover:text-rose-700 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                              aria-label={
                                language === 'bs'
                                  ? 'Ukloni magacin'
                                  : language === 'nl'
                                    ? 'Magazijn verwijderen'
                                    : 'Delete warehouse'
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        <div
                          className="group relative"
                          title={
                            language === 'bs'
                              ? 'Klikni za uređivanje adrese'
                              : language === 'nl'
                                ? 'Klik om adres te bewerken'
                                : 'Click to edit address'
                          }
                        >
                          <Input
                            value={clientDraft.warehouse_addresses?.[index] || ''}
                            onChange={(event) => updateDraftWarehouse(index, event.target.value)}
                            placeholder={
                              index === 0
                                ? labels.warehouse1
                                : language === 'bs'
                                  ? 'Dodaj drugi magacin'
                                  : language === 'nl'
                                    ? 'Tweede magazijn toevoegen'
                                    : 'Add second warehouse'
                            }
                            className="w-full bg-zinc-50 normal-case tracking-normal transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus:border-emerald-400 dark:bg-[#151d1a] dark:hover:bg-white/[0.07]"
                          />
                          <span className="pointer-events-none absolute -top-8 left-3 z-10 rounded-full bg-emerald-950 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-emerald-100 dark:text-emerald-950">
                            {language === 'bs'
                              ? 'Klikni za edit'
                              : language === 'nl'
                                ? 'Klik om te bewerken'
                                : 'Click to edit address'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {(clientDraft.warehouse_addresses || []).length === 1 && (
                      <button
                        type="button"
                        onClick={addDraftWarehouse}
                        className="flex min-h-[9.5rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-emerald-200 bg-emerald-50/50 p-4 text-center text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"
                      >
                        <Plus size={18} />
                        <span className="mt-2 text-[10px] font-black uppercase tracking-widest">
                          {language === 'bs' ? 'Dodaj magacin 2' : language === 'nl' ? 'Magazijn 2 toevoegen' : 'Add warehouse 2'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-auto grid gap-3 pt-5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={addDraftWarehouse}
                    disabled={(clientDraft.warehouse_addresses || []).length >= 2}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition-colors hover:border-emerald-300 hover:text-emerald-900 disabled:cursor-not-allowed disabled:border-zinc-100 disabled:text-zinc-300 dark:border-white/10 dark:bg-[#101715] dark:text-emerald-100 dark:hover:bg-white/[0.07] dark:disabled:text-zinc-500"
                  >
                    <Plus size={14} />
                    {language === 'bs' ? 'Dodaj magacin' : language === 'nl' ? 'Magazijn toevoegen' : 'Add warehouse'}
                  </button>
                  <Button type="button" className="h-12 w-full justify-center" onClick={saveClientDraft}>
                    {labels.save}
                  </Button>
                </div>
              </div>

              <div className="grid h-full gap-4">
                <div className="flex min-h-[17rem] flex-col rounded-[2rem] border border-zinc-100 bg-white p-5 dark:border-white/10 dark:bg-[#151d1a]">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                      {labels.palletsAtClient}
                    </h4>
                    <Package size={17} className="text-gray-300" />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-zinc-100 no-scrollbar dark:border-white/10">
                    {selectedRow.clientPallets.length > 0 ? (
                      selectedRow.clientPallets.map((pallet) => {
                        const palletPhotos = clientPhotosByPallet.get(pallet.id) || [];
                        const hasPalletPhotos = palletPhotos.length > 0;

                        return (
                          <div
                            key={`admin-client-modal-pallet-${pallet.id}`}
                            className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_2rem] items-center gap-2 border-b border-zinc-100 px-4 py-3 text-center last:border-b-0 dark:border-white/10"
                          >
                            <span className="truncate text-[11px] font-black uppercase text-emerald-950 dark:text-white">
                              {getPalletDisplayName(pallet)}
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
                            <button
                              type="button"
                              onClick={() => setPhotoViewer({
                                palletId: pallet.id,
                                palletName: getPalletDisplayName(pallet),
                                photos: palletPhotos,
                                index: 0,
                              })}
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-white/10"
                              title={hasPalletPhotos ? labels.viewPhotos : labels.noPhotos}
                              aria-label={hasPalletPhotos ? labels.viewPhotos : labels.noPhotos}
                            >
                              <ImageIcon size={16} />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <p className="px-4 py-8 text-center text-[10px] font-black uppercase tracking-widest text-zinc-300">
                        {labels.noPallets}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex min-h-[17rem] flex-col rounded-[2rem] border border-zinc-100 bg-white p-5 dark:border-white/10 dark:bg-[#151d1a]">
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
                          className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-[#101715]"
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
                              title={labels.exportInvoice}
                              aria-label={labels.exportInvoice}
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

      {photoViewer && (
        <div className="modal-overlay fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setPhotoViewer(null)}>
          <div
            className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-3 text-zinc-950">
              <div className="min-w-0">
                <p className="truncate text-sm font-black uppercase tracking-tight">{photoViewer.palletName}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {photoViewer.photos.length > 0
                    ? `${labels.photos} ${photoViewer.index + 1}/${photoViewer.photos.length}`
                    : labels.noPhotos}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoViewer(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
                aria-label={labels.close}
                title={labels.close}
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-zinc-100 p-4">
              {visiblePhoto?.url ? (
                <img
                  src={visiblePhoto.url}
                  alt={`${photoViewer.palletName} ${labels.photos.toLowerCase()}`}
                  className="max-h-[72vh] max-w-full object-contain"
                />
              ) : (
                <p className="text-sm font-semibold text-zinc-500">{labels.noPhotos}</p>
              )}

              {photoViewer.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPhotoViewer((current) => current && ({
                      ...current,
                      index: (current.index - 1 + current.photos.length) % current.photos.length,
                    }))}
                    className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white transition-colors hover:bg-black/85"
                    aria-label={labels.previous}
                    title={labels.previous}
                  >
                    <ChevronLeft size={22} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhotoViewer((current) => current && ({
                      ...current,
                      index: (current.index + 1) % current.photos.length,
                    }))}
                    className="absolute right-3 flex h-10 w-10 items-center justify-center rounded-lg bg-black/60 text-white transition-colors hover:bg-black/85"
                    aria-label={labels.next}
                    title={labels.next}
                  >
                    <ChevronRight size={22} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
