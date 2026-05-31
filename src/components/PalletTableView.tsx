import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input, Badge, Card, Button, cn } from './ui';
import {
  Search,
  Hash,
  Package,
  User as UserIcon,
  MapPin,
  Edit,
  Trash2,
  Plus,
  Funnel,
  RotateCcw,
  Tag,
  Clock3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useApp } from '../AppContext';
import { motion } from 'motion/react';
import { Pallet } from '../types';
import { getStatusLabel, normalizePalletTypeCode, palletTypeValues } from '../i18n';

interface PalletTableViewProps {
  onAddPallet?: () => void;
  onEditPallet?: (pallet: Pallet) => void;
  onDeletePallet?: (pallet: Pallet) => void;
}

type SortKey = 'qr' | 'type' | 'client' | 'status' | 'location' | 'lastUpdate';
type SortDirection = 'asc' | 'desc';
type ColumnKey = SortKey | 'actions';

type FilterOption = {
  value: string;
  label: string;
};

type FilterSelections = Record<SortKey, string[]>;
type FilterSearch = Record<SortKey, string>;
type ColumnWidths = Record<ColumnKey, number>;

const INITIAL_COLUMN_WIDTHS: ColumnWidths = {
  qr: 176,
  type: 176,
  client: 176,
  status: 176,
  location: 176,
  lastUpdate: 176,
  actions: 176,
};

const MIN_COLUMN_WIDTHS: ColumnWidths = {
  qr: 144,
  type: 124,
  client: 152,
  status: 140,
  location: 180,
  lastUpdate: 136,
  actions: 88,
};

const formatDateFilterValue = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getCompactPalletTypeLabel = (type: string) => {
  return normalizePalletTypeCode(type) || type;
};

export const PalletTableView: React.FC<PalletTableViewProps> = ({
  onAddPallet,
  onEditPallet,
  onDeletePallet,
}) => {
  const { pallets, statuses, clients, t, language } = useApp();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const resizeStateRef = useRef<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);
  const headerCellRefs = useRef<Partial<Record<SortKey, HTMLTableCellElement | null>>>({});
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(INITIAL_COLUMN_WIDTHS);
  const [selectedFilters, setSelectedFilters] = useState<FilterSelections>({
    qr: [],
    type: [],
    client: [],
    status: [],
    location: [],
    lastUpdate: [],
  });
  const [filterSearch, setFilterSearch] = useState<FilterSearch>({
    qr: '',
    type: '',
    client: '',
    status: '',
    location: '',
    lastUpdate: '',
  });
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'lastUpdate',
    direction: 'desc',
  });
  const [openFilterKey, setOpenFilterKey] = useState<SortKey | null>(null);
  const [activeResizeKey, setActiveResizeKey] = useState<ColumnKey | null>(null);
  const [filterMenuStyle, setFilterMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

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
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current;

      if (!resizeState) {
        return;
      }

      event.preventDefault();

      const nextWidth = Math.max(
        MIN_COLUMN_WIDTHS[resizeState.key],
        resizeState.startWidth + (event.clientX - resizeState.startX)
      );

      setColumnWidths((current) =>
        current[resizeState.key] === nextWidth
          ? current
          : {
              ...current,
              [resizeState.key]: nextWidth,
            }
      );
    };

    const stopResize = () => {
      if (!resizeStateRef.current) {
        return;
      }

      resizeStateRef.current = null;
      setActiveResizeKey(null);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
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
          case 'location':
            return 288;
          case 'lastUpdate':
            return 224;
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
    language === 'bs' ? 'Dodaj paletu' : language === 'nl' ? 'Pallet toevoegen' : 'Add pallet';
  const totalTableWidth = (Object.values(columnWidths) as number[]).reduce(
    (sum, value) => sum + value,
    0
  );

  const getClientLabel = (pallet: Pallet) =>
    clients.find((client) => client.user_id === pallet.user_id)?.name || t('inStock');

  const getTypeLabel = (pallet: Pallet) => getCompactPalletTypeLabel(pallet.type);

  const getStatusLabelText = (pallet: Pallet) =>
    getStatusLabel(pallet.current_status_name, language);

  const getLocationLabel = (pallet: Pallet) => pallet.current_location || t('notAvailable');

  const getLastUpdateLabel = (pallet: Pallet) =>
    new Date(pallet.last_status_changed_at).toLocaleDateString();

  const getFilterValue = (pallet: Pallet, key: SortKey) => {
    switch (key) {
      case 'qr':
        return pallet.qr_code;
      case 'type':
        return getTypeLabel(pallet);
      case 'client':
        return getClientLabel(pallet);
      case 'status':
        return getStatusLabelText(pallet);
      case 'location':
        return getLocationLabel(pallet);
      case 'lastUpdate':
        return formatDateFilterValue(pallet.last_status_changed_at);
      default:
        return '';
    }
  };

  const filterOptions = useMemo<Record<SortKey, FilterOption[]>>(
    () => ({
      qr: Array.from<string>(new Set(pallets.map((pallet) => pallet.qr_code)))
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
      location: Array.from<string>(new Set(pallets.map((pallet) => getLocationLabel(pallet))))
        .sort((left, right) =>
          left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
        )
        .map((value) => ({ value, label: value })),
      lastUpdate: Array.from<string>(
        new Set(pallets.map((pallet) => formatDateFilterValue(pallet.last_status_changed_at)))
      )
        .sort((left, right) => right.localeCompare(left))
        .map((value) => ({
          value,
          label: new Date(value).toLocaleDateString(),
        })),
    }),
    [clients, language, pallets, t]
  );

  const filteredPallets = useMemo(() => {
    const nextPallets = pallets.filter((pallet) =>
      (Object.keys(selectedFilters) as SortKey[]).every((key) => {
        const selectedValues = selectedFilters[key];

        if (selectedValues.length === 0) {
          return true;
        }

        return selectedValues.includes(getFilterValue(pallet, key));
      })
    );

    nextPallets.sort((left, right) => {
      const leftValue =
        sortConfig.key === 'lastUpdate'
          ? new Date(left.last_status_changed_at).getTime()
          : getFilterValue(left, sortConfig.key);
      const rightValue =
        sortConfig.key === 'lastUpdate'
          ? new Date(right.last_status_changed_at).getTime()
          : getFilterValue(right, sortConfig.key);

      const comparison =
        typeof leftValue === 'number' && typeof rightValue === 'number'
          ? leftValue - rightValue
          : String(leftValue).localeCompare(String(rightValue), undefined, {
              numeric: true,
              sensitivity: 'base',
            });

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return nextPallets;
  }, [pallets, selectedFilters, sortConfig]);

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
      location: [],
      lastUpdate: [],
    });
    setFilterSearch({
      qr: '',
      type: '',
      client: '',
      status: '',
      location: '',
      lastUpdate: '',
    });
    setSortConfig({
      key: 'lastUpdate',
      direction: 'desc',
    });
    setOpenFilterKey(null);
  };

  const renderSortButton = (key: SortKey, label: string) => {
    const isActive = sortConfig.key === key;
    const SortIcon = !isActive ? ArrowUpDown : sortConfig.direction === 'asc' ? ArrowUp : ArrowDown;

    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={cn(
          'flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] transition-colors',
          isActive ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
        )}
      >
        <span>{label}</span>
        <SortIcon size={13} />
      </button>
    );
  };

  const hasActiveFilter = (key: SortKey) => selectedFilters[key].length > 0;
  const headerCellClass =
    'relative border-r border-zinc-200 px-3 py-2.5 pr-4 align-middle text-center last:border-r-0';
  const headerIconClass =
    'flex h-6 w-6 items-center justify-center rounded-md bg-zinc-100 text-zinc-500';
  const headerIconButtonClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400 transition-colors hover:border-zinc-300 hover:text-zinc-700';
  const bodyCellClass =
    'border-r border-zinc-100 px-3 py-3 align-middle text-center last:border-r-0';
  const textFilterInputClass =
    'h-9 bg-white px-3 text-left text-[11px] normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal';

  const startColumnResize = (event: React.PointerEvent<HTMLButtonElement>, key: ColumnKey) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = {
      key,
      startX: event.clientX,
      startWidth: columnWidths[key],
    };
    setOpenFilterKey(null);
    setActiveResizeKey(key);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const renderResizeHandle = (key: ColumnKey) => (
    <button
      type="button"
      aria-label={`Resize ${key} column`}
      onPointerDown={(event) => startColumnResize(event, key)}
      className="absolute inset-y-0 -right-1 z-10 flex w-3 cursor-col-resize touch-none items-center justify-center"
    >
      <span
        className={cn(
          'h-7 w-px rounded-full bg-zinc-200 transition-colors',
          activeResizeKey === key && 'bg-[#00A655]',
          activeResizeKey !== key && 'group-hover:bg-zinc-300'
        )}
      />
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
      <Card noPadding>
        <div ref={tableRef} className="overflow-x-auto">
          <table
            className="border-collapse text-left [table-layout:fixed]"
            style={{ width: `max(100%, ${totalTableWidth}px)` }}
          >
            <colgroup>
              <col style={{ width: columnWidths.qr }} />
              <col style={{ width: columnWidths.type }} />
              <col style={{ width: columnWidths.client }} />
              <col style={{ width: columnWidths.status }} />
              <col style={{ width: columnWidths.location }} />
              <col style={{ width: columnWidths.lastUpdate }} />
              <col style={{ width: columnWidths.actions }} />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80">
              <tr>
                <th
                  ref={(element) => {
                    headerCellRefs.current.qr = element;
                  }}
                  className={cn(headerCellClass, 'group')}
                >
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <div className={headerIconClass}>
                      <Hash size={16} />
                    </div>
                    {renderSortButton('qr', firstColumnLabel)}
                    <button
                      type="button"
                      onClick={() => setOpenFilterKey((current) => (current === 'qr' ? null : 'qr'))}
                      className={cn(
                        headerIconButtonClass,
                        hasActiveFilter('qr') && 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      )}
                    >
                      <Funnel size={12} />
                    </button>
                  </div>
                  {renderResizeHandle('qr')}
                </th>
                <th
                  ref={(element) => {
                    headerCellRefs.current.type = element;
                  }}
                  className={cn(headerCellClass, 'group')}
                >
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <div className={headerIconClass}>
                      <Package size={16} />
                    </div>
                    {renderSortButton('type', t('type'))}
                    <button
                      type="button"
                      onClick={() => setOpenFilterKey((current) => (current === 'type' ? null : 'type'))}
                      className={cn(
                        headerIconButtonClass,
                        hasActiveFilter('type') && 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      )}
                    >
                      <Funnel size={12} />
                    </button>
                  </div>
                  {renderResizeHandle('type')}
                </th>
                <th
                  ref={(element) => {
                    headerCellRefs.current.client = element;
                  }}
                  className={cn(headerCellClass, 'group')}
                >
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <div className={headerIconClass}>
                      <UserIcon size={16} />
                    </div>
                    {renderSortButton('client', t('client'))}
                    <button
                      type="button"
                      onClick={() => setOpenFilterKey((current) => (current === 'client' ? null : 'client'))}
                      className={cn(
                        headerIconButtonClass,
                        hasActiveFilter('client') && 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      )}
                    >
                      <Funnel size={12} />
                    </button>
                  </div>
                  {renderResizeHandle('client')}
                </th>
                <th
                  ref={(element) => {
                    headerCellRefs.current.status = element;
                  }}
                  className={cn(headerCellClass, 'group')}
                >
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <div className={headerIconClass}>
                      <Tag size={16} />
                    </div>
                    {renderSortButton('status', t('status'))}
                    <button
                      type="button"
                      onClick={() => setOpenFilterKey((current) => (current === 'status' ? null : 'status'))}
                      className={cn(
                        headerIconButtonClass,
                        hasActiveFilter('status') && 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      )}
                    >
                      <Funnel size={12} />
                    </button>
                  </div>
                  {renderResizeHandle('status')}
                </th>
                <th
                  ref={(element) => {
                    headerCellRefs.current.location = element;
                  }}
                  className={cn(headerCellClass, 'group')}
                >
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <div className={headerIconClass}>
                      <MapPin size={16} />
                    </div>
                    {renderSortButton('location', t('location'))}
                    <button
                      type="button"
                      onClick={() => setOpenFilterKey((current) => (current === 'location' ? null : 'location'))}
                      className={cn(
                        headerIconButtonClass,
                        hasActiveFilter('location') && 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      )}
                    >
                      <Funnel size={12} />
                    </button>
                  </div>
                  {renderResizeHandle('location')}
                </th>
                <th
                  ref={(element) => {
                    headerCellRefs.current.lastUpdate = element;
                  }}
                  className={cn(headerCellClass, 'group')}
                >
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <div className={headerIconClass}>
                      <Clock3 size={16} />
                    </div>
                    {renderSortButton('lastUpdate', t('lastUpdate'))}
                    <button
                      type="button"
                      onClick={() => setOpenFilterKey((current) => (current === 'lastUpdate' ? null : 'lastUpdate'))}
                      className={cn(
                        headerIconButtonClass,
                        hasActiveFilter('lastUpdate') && 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      )}
                    >
                      <Funnel size={12} />
                    </button>
                  </div>
                  {renderResizeHandle('lastUpdate')}
                </th>
                <th className={cn(headerCellClass, 'group')}>
                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                    <div className={headerIconClass}>
                      <Edit size={16} />
                    </div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400">
                      {t('actions')}
                    </p>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className={headerIconButtonClass}
                      title={t('reset')}
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                  {renderResizeHandle('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredPallets.map((pallet, index) => {
                const clientLabel = getClientLabel(pallet);

                return (
                  <motion.tr
                    key={`table-row-${pallet.id}`}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.01 }}
                    className="transition-colors hover:bg-zinc-50/60"
                  >
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.25rem] min-w-0 items-center justify-center">
                        <span className="truncate font-mono text-[11px] font-black tracking-tight">
                          {pallet.qr_code}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.25rem] min-w-0 items-center justify-center">
                        <span className="truncate text-[10px] font-black uppercase text-zinc-600">
                          {getTypeLabel(pallet)}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.25rem] min-w-0 items-center justify-center">
                        <span className="truncate text-[10px] font-black uppercase tracking-tight text-black">
                          {clientLabel}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.25rem] items-center justify-center">
                        <Badge
                          variant={
                            pallet.current_status_id === 7
                              ? 'danger'
                              : pallet.current_status_id === 4
                                ? 'success'
                                : 'info'
                          }
                        >
                          {getStatusLabelText(pallet)}
                        </Badge>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.25rem] min-w-0 items-center justify-center">
                        <span className="truncate text-[10px] font-bold uppercase text-zinc-500">
                          {getLocationLabel(pallet)}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.25rem] items-center justify-center text-[9px] font-black uppercase tracking-tight text-zinc-300">
                        {getLastUpdateLabel(pallet)}
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className="flex min-h-[2.25rem] items-center justify-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            className="h-9 w-9 p-0"
                            onClick={() => onEditPallet?.(pallet)}
                            title={t('editData')}
                            aria-label={t('editData')}
                          >
                            <Edit size={14} />
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            size="xs"
                            className="h-9 w-9 p-0"
                            onClick={() => onDeletePallet?.(pallet)}
                            title={t('remove')}
                            aria-label={t('remove')}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>

          {filteredPallets.length === 0 && (
            <div className="p-20 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-zinc-100 bg-zinc-50">
                <Search size={20} className="text-zinc-200" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                {t('noMatchingResults')}
              </p>
            </div>
          )}
        </div>
      </Card>
      {openFilterKey && renderFilterMenu(openFilterKey)}

      {onAddPallet && (
        <button
          type="button"
          onClick={onAddPallet}
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] right-4 z-20 inline-flex h-14 items-center gap-2 rounded-full bg-[#00A655] px-5 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_36px_-18px_rgba(0,166,85,0.8)] transition-transform hover:scale-[1.02] md:bottom-24 md:right-8"
        >
          <Plus size={16} />
          {addPalletLabel}
        </button>
      )}
    </div>
  );
};
