import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpDown,
  Banknote,
  CalendarClock,
  FileText,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
  X,
} from 'lucide-react';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { Badge, Button, cn } from './ui';
import { useApp } from '../AppContext';
import { Pallet } from '../types';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';

type ViewMode = 'service' | 'warehouse' | 'finance';
type SortDirection = 'asc' | 'desc';

type OperationRow = {
  id: string;
  pallet?: Pallet;
  primary: string;
  secondary: string;
  status: string;
  location: string;
  client: string;
  metric: string;
  amount: string;
  sortValues: Record<string, string | number>;
};

const COLUMN_WIDTHS: Record<string, number> = {
  primary: 190,
  secondary: 170,
  status: 170,
  location: 230,
  client: 190,
  metric: 170,
  amount: 170,
};

const MIN_WIDTHS: Record<string, number> = {
  primary: 150,
  secondary: 140,
  status: 140,
  location: 180,
  client: 150,
  metric: 135,
  amount: 135,
};

const getDaysSince = (date: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)));

export const AdminRoleOperationsView: React.FC<{ mode: ViewMode }> = ({ mode }) => {
  const { clients, pallets, statuses, serviceReports, invoices, language, updatePalletStatus, t } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<string, HTMLTableCellElement | null>>>({});
  const [selectedRow, setSelectedRow] = useState<OperationRow | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: SortDirection }>({
    key: 'primary',
    direction: 'asc',
  });
  const {
    headerCellClass,
    headerIconClass,
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
    () =>
      new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
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
        search: language === 'bs' ? 'Pretrazi servis' : language === 'nl' ? 'Zoek service' : 'Search service',
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
        search: language === 'bs' ? 'Pretrazi magacin' : language === 'nl' ? 'Zoek magazijn' : 'Search warehouse',
        empty: language === 'bs' ? 'Nema magacinskih stavki.' : language === 'nl' ? 'Geen magazijnitems.' : 'No warehouse items.',
        primary: language === 'bs' ? 'Paleta' : language === 'nl' ? 'Bok' : 'Pallet',
        secondary: language === 'bs' ? 'Tip' : language === 'nl' ? 'Type' : 'Type',
        status: language === 'bs' ? 'Tok' : language === 'nl' ? 'Flow' : 'Flow',
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
          ? 'Dugovanja, tarife, fakture i zakasnjenja po klijentima.'
          : language === 'nl'
            ? 'Schulden, tarieven, facturen en vertragingen per klant.'
            : 'Debts, rates, invoices and overdue days by client.',
      search: language === 'bs' ? 'Pretrazi finansije' : language === 'nl' ? 'Zoek financien' : 'Search finance',
      empty: language === 'bs' ? 'Nema finansijskih stavki.' : language === 'nl' ? 'Geen financiele items.' : 'No finance items.',
      primary: language === 'bs' ? 'Klijent' : language === 'nl' ? 'Klant' : 'Client',
      secondary: 'KVK',
      status: language === 'bs' ? 'Fakture' : language === 'nl' ? 'Facturen' : 'Invoices',
      location: language === 'bs' ? 'Adresa' : language === 'nl' ? 'Adres' : 'Address',
      client: language === 'bs' ? 'Palete kod kupca' : language === 'nl' ? 'Bokken bij klant' : 'Pallets at client',
      metric: language === 'bs' ? 'Dana kasnjenja' : language === 'nl' ? 'Dagen te laat' : 'Overdue days',
      amount: language === 'bs' ? 'Dug' : language === 'nl' ? 'Schuld' : 'Debt',
    };
  }, [language, mode]);

  const columns = useMemo(
    () =>
      [
        { key: 'primary', label: copy.primary, icon: mode === 'finance' ? FileText : Package },
        { key: 'secondary', label: copy.secondary, icon: mode === 'service' ? Wrench : ShieldCheck },
        { key: 'status', label: copy.status, icon: mode === 'finance' ? FileText : Truck },
        { key: 'location', label: copy.location, icon: MapPin },
        { key: 'client', label: copy.client, icon: mode === 'finance' ? Package : FileText },
        { key: 'metric', label: copy.metric, icon: CalendarClock },
        { key: 'amount', label: copy.amount, icon: mode === 'finance' ? Banknote : AlertTriangle },
      ] as const,
    [copy, mode]
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

    const relevantPallets =
      mode === 'service'
        ? pallets.filter((pallet) => pallet.current_status_id === 7 || serviceReports.some((report) => report.pallet_id === pallet.id && !report.resolved_at))
        : pallets.filter((pallet) => [1, 2, 3, 5, 6, 8].includes(pallet.current_status_id));

    return relevantPallets.map((pallet) => {
      const openReport = serviceReports.find((report) => report.pallet_id === pallet.id && !report.resolved_at);
      const days = getDaysSince(pallet.last_status_changed_at);
      const activity =
        mode === 'service'
          ? openReport?.problem_description || pallet.note || '-'
          : pallet.current_status_id === 5
            ? 'Return pickup'
            : pallet.current_status_id === 2 || pallet.current_status_id === 6
              ? 'Transport lane'
              : 'Warehouse stock';

      return {
        id: `${mode}-${pallet.id}`,
        pallet,
        primary: pallet.qr_code,
        secondary: getPalletTypeLabel(pallet.type, language),
        status: getStatusLabel(pallet.current_status_name, language),
        location: pallet.current_location || '-',
        client: pallet.client_name || '-',
        metric: `${days}`,
        amount: activity,
        sortValues: {
          primary: pallet.qr_code,
          secondary: pallet.type,
          status: pallet.current_status_name,
          location: pallet.current_location,
          client: pallet.client_name || '',
          metric: days,
          amount: activity,
        },
      };
    });
  }, [clients, currencyFormatter, invoices, language, mode, pallets, serviceReports, statuses]);

  const visibleRows = useMemo(() => {
    const nextRows = [...rows];

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
  }, [rows, sortConfig]);

  const toggleSort = (key: string) => {
    setSortConfig((current) =>
      current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
    );
  };

  const markServiceResolved = (row: OperationRow) => {
    if (!row.pallet) return;
    updatePalletStatus(row.pallet.id, 1, 1, 'Admin Service', row.pallet.current_location, 'Service resolved from admin service table.');
    setSelectedRow(null);
  };

  return (
    <div>
      <AdminDataTable<string>
        columnOrder={columns.map((column) => column.key)}
        initialColumnWidths={COLUMN_WIDTHS}
        minColumnWidths={MIN_WIDTHS}
        resizeAriaLabel={language === 'nl' ? 'Kolombreedte aanpassen' : language === 'bs' ? 'Promijeni sirinu kolone' : 'Resize column'}
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
                  const Icon = column.icon;
                  return (
                    <th key={`role-admin-header-${mode}-${column.key}`} ref={registerHeaderCell(column.key)} className={cn(headerCellClass, 'group')}>
                      <div className={headerContentClass}>
                        <div className={headerIconClass}>
                          <Icon size={16} />
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="flex min-w-0 items-center justify-center gap-1.5 overflow-hidden text-[9px] font-black uppercase tracking-[0.14em] leading-none text-zinc-900 transition-colors hover:text-zinc-700 dark:text-white"
                        >
                          <span className="block min-w-0 truncate">{column.label}</span>
                          <ArrowUpDown size={13} className="shrink-0" />
                        </button>
                      </div>
                      {renderResizeHandle(column.key)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/10">
              {visibleRows.map((row, index) => (
                <motion.tr
                  key={`role-admin-row-${row.id}`}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.01 }}
                  onClick={() => setSelectedRow(row)}
                  tabIndex={0}
                  role="button"
                  className="group cursor-pointer transition-colors hover:bg-zinc-50/60 focus-visible:bg-zinc-50/80 focus-visible:outline-none dark:hover:bg-white/5"
                >
                  {[row.primary, row.secondary, row.status, row.location, row.client, row.metric, row.amount].map((value, cellIndex) => (
                    <td key={`role-admin-cell-${row.id}-${cellIndex}`} className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        {cellIndex === 2 ? (
                          <Badge variant={row.pallet?.current_status_id === 7 ? 'danger' : row.pallet?.current_status_id === 5 ? 'warning' : 'info'} className="rounded-lg text-[9px]">
                            {value}
                          </Badge>
                        ) : (
                          <span className={cn(bodyTextClass, cellIndex === 6 && mode === 'finance' && !String(value).includes('0.00') ? 'text-rose-600' : 'text-zinc-600 dark:text-zinc-200')}>
                            {value}
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      />

      {selectedRow && (
        <div className="modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setSelectedRow(null)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] bg-white p-7 shadow-2xl no-scrollbar dark:bg-[#172d22]"
            onClick={(event) => event.stopPropagation()}
          >
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
                <div key={`role-admin-detail-${column.key}`} className="rounded-2xl bg-zinc-50 p-4 text-center dark:bg-[#203d31]">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{column.label}</p>
                  <p className="mt-2 text-xs font-black uppercase text-zinc-900 dark:text-white">
                    {[selectedRow.primary, selectedRow.secondary, selectedRow.status, selectedRow.location, selectedRow.client, selectedRow.metric, selectedRow.amount][index]}
                  </p>
                </div>
              ))}
            </div>

            {selectedRow.pallet && (
              <div className="mt-5 rounded-2xl border border-zinc-100 bg-white p-4 dark:border-white/10 dark:bg-[#203d31]">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{t('timestamp')}</p>
                <p className="mt-2 text-xs font-bold uppercase text-zinc-700 dark:text-zinc-200">
                  {dateFormatter.format(new Date(selectedRow.pallet.last_status_changed_at))}
                </p>
                {selectedRow.pallet.note && (
                  <p className="mt-3 text-xs font-bold leading-5 text-zinc-600 dark:text-zinc-200">{selectedRow.pallet.note}</p>
                )}
              </div>
            )}

            {mode === 'service' && selectedRow.pallet && (
              <Button type="button" className="mt-5 w-full py-4" onClick={() => markServiceResolved(selectedRow)}>
                {language === 'bs' ? 'Oznaci kao popravljeno' : language === 'nl' ? 'Als gerepareerd markeren' : 'Mark repaired'}
              </Button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};
