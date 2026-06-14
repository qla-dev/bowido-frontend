import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
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
import { Button, cn, Input } from './ui';
import { useApp } from '../AppContext';
import { ClientDetail } from '../types';

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

const CLIENT_TABLE_COLUMN_ORDER = [
  'client',
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

interface ClientTableViewProps {
  onAddClient?: () => void;
  onEditClient?: (client: ClientDetail) => void;
}

export const ClientTableView: React.FC<ClientTableViewProps> = ({ onAddClient, onEditClient }) => {
  const { clients, pallets, statuses, t, language } = useApp();
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
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const searchPlaceholder =
    language === 'bs' ? 'Pretrazi' : language === 'nl' ? 'Zoeken' : 'Search';
  const showAllLabel =
    language === 'bs' ? 'Prikazi sve' : language === 'nl' ? 'Alles tonen' : 'Show all';
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

  const rows = useMemo<ClientTableRow[]>(
    () =>
      clients.map((client) => {
        const clientPallets = pallets.filter((pallet) => pallet.user_id === client.user_id);
        const palletsAtClient = clientPallets.filter((pallet) => pallet.current_status_id === 4);
        const returnReports = clientPallets.filter((pallet) => pallet.current_status_id === 5);
        const overdueTotalValue = clientPallets.reduce((total, pallet) => {
          const status = statuses.find((item) => item.id === pallet.current_status_id);

          if (!status?.is_billable) {
            return total;
          }

          const daysOutside = getDaysSince(pallet.last_status_changed_at);
          const overdueDays = Math.max(daysOutside - client.grace_period_days, 0);

          return total + overdueDays * client.price_per_day;
        }, 0);
        const warehouses = client.warehouse_addresses?.filter(Boolean) || [];

        return {
          client,
          clientName: client.name,
          kvkLabel: client.kvk_number || '-',
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
    [clients, currencyFormatter, pallets, statuses]
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

  return (
    <div className="space-y-6">
      <AdminDataTable<ColumnKey>
        columnOrder={CLIENT_TABLE_COLUMN_ORDER}
        initialColumnWidths={INITIAL_COLUMN_WIDTHS}
        minColumnWidths={MIN_COLUMN_WIDTHS}
        resizeAriaLabel={resizeAriaLabel}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={filteredRows.length === 0}
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
              <col style={{ width: columnWidths.client }} />
              <col style={{ width: columnWidths.kvk }} />
              <col style={{ width: columnWidths.warehouses }} />
              <col style={{ width: columnWidths.rate }} />
              <col style={{ width: columnWidths.overdueTotal }} />
              <col style={{ width: columnWidths.atClient }} />
              <col style={{ width: columnWidths.returnReports }} />
              <col style={{ width: columnWidths.actions }} />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80">
              <tr>
                <th ref={registerHeaderCell('client')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>
                    <div className={headerIconClass}>
                      <Building2 size={16} />
                    </div>
                    {renderSortButton('client', t('client'))}
                    {renderFilterButton('client')}
                  </div>
                  {renderResizeHandle('client')}
                </th>
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
                      <span className={cn(bodyTextClass, 'uppercase text-zinc-900')}>
                        {row.clientName}
                      </span>
                    </div>
                  </td>
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
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      />

      {openFilterKey && renderFilterMenu(openFilterKey)}

      {onAddClient && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-20 flex items-center gap-3 md:bottom-24 md:right-8">
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
