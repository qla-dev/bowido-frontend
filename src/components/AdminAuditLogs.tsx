import React, { useEffect, useMemo, useRef, useState } from 'react';
import { History, QrCode, Search } from 'lucide-react';
import { AuditLog, ClientDetail, Pallet } from '../types';
import { Badge, Card, cn, Input, StatCard } from './ui';
import { AppLanguage, getStatusLabel, localeMap } from '../i18n';
import { ListPagination } from './ListPagination';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService, PaginationMeta } from '../services/api';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';

interface AdminAuditLogsProps {
  auditLogs: AuditLog[];
  pallets: Pallet[];
  clients: ClientDetail[];
  language: AppLanguage;
  t: (key: string) => string;
  onSelectPallet: (pallet: Pallet | null) => void;
}

type AuditFilter = 'all' | 'status' | 'qr_version';
type AuditColumnKey = 'timestamp' | 'logType' | 'pallet' | 'changedBy' | 'changeSummary' | 'note';
const AUDIT_LOG_PAGE_SIZE = 25;

const AUDIT_TABLE_COLUMN_ORDER = [
  'timestamp',
  'logType',
  'pallet',
  'changedBy',
  'changeSummary',
  'note',
] as const satisfies readonly AuditColumnKey[];

const AUDIT_INITIAL_COLUMN_WIDTHS: Record<AuditColumnKey, number> = {
  timestamp: 190,
  logType: 170,
  pallet: 180,
  changedBy: 190,
  changeSummary: 300,
  note: 240,
};

const AUDIT_MIN_COLUMN_WIDTHS: Record<AuditColumnKey, number> = {
  timestamp: 160,
  logType: 140,
  pallet: 150,
  changedBy: 160,
  changeSummary: 240,
  note: 180,
};

export const AdminAuditLogs: React.FC<AdminAuditLogsProps> = ({
  auditLogs: cachedAuditLogs,
  pallets,
  clients,
  language,
  t,
  onSelectPallet,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pageOffset, setPageOffset] = useState(0);
  const [pageLimit, setPageLimit] = useState(AUDIT_LOG_PAGE_SIZE);
  const [paginationMeta, setPaginationMeta] = useState<PaginationMeta>({
    total: 0,
    limit: AUDIT_LOG_PAGE_SIZE,
    offset: 0,
    count: 0,
  });
  const [isPageLoading, setIsPageLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);
  const headerCellRefs = useRef<Partial<Record<AuditColumnKey, HTMLTableCellElement | null>>>({});
  const {
    headerCellClass,
    headerContentClass,
    bodyCellClass,
    bodyCellInnerClass,
    bodyTextClass,
  } = adminTableStyles;

  useEffect(() => {
    setPageOffset(0);
  }, [debouncedQuery, filter, createdFrom, createdTo]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    let isMounted = true;

    const loadPage = async () => {
      setIsPageLoading(true);

      try {
        const page = await apiService.auditLogs.page({
          limit: pageLimit,
          offset: pageOffset,
          search: debouncedQuery || undefined,
          sort_by: 'created_at',
          sort_direction: 'desc',
          created_from: createdFrom || undefined,
          created_to: createdTo || undefined,
          event_type:
            filter === 'qr_version'
              ? 'qr_code_changed'
              : filter === 'status'
                ? 'status_changed'
                : undefined,
        });

        if (!isMounted) {
          return;
        }

        setAuditLogs(page.items);
        setPaginationMeta(page.meta);
      } catch (error) {
        console.error('Failed to load paginated audit logs', error);
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
  }, [createdFrom, createdTo, debouncedQuery, filter, pageLimit, pageOffset]);

  useEffect(() => {
    if (cachedAuditLogs.length === 0) {
      return;
    }

    setAuditLogs((current) =>
      current.map((log) => cachedAuditLogs.find((cachedLog) => cachedLog.id === log.id) || log)
    );
  }, [cachedAuditLogs]);

  const sortedLogs = useMemo(
    () =>
      [...auditLogs].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      ),
    [auditLogs]
  );

  const filteredLogs = sortedLogs;

  const statusLogCount = auditLogs.filter((log) => (log.type || 'status') === 'status').length;
  const qrVersionLogCount = auditLogs.filter((log) => log.type === 'qr_version').length;

  const getClientName = (clientId?: number) =>
    clientId ? clients.find((client) => client.user_id === clientId)?.name || `#${clientId}` : null;
  const dateFromLabel = language === 'bs' ? 'Od' : language === 'nl' ? 'Van' : 'From';
  const dateToLabel = language === 'bs' ? 'Do' : language === 'nl' ? 'Tot' : 'To';
  const openDatePickerFromPill = (event: React.MouseEvent<HTMLLabelElement>) => {
    const input = event.currentTarget.querySelector('input');

    if (!input) {
      return;
    }

    input.focus();

    try {
      (input as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
    } catch {
      // Some browsers only allow showPicker from direct input interaction.
    }
  };
  const dateRangeFilter = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-0"
        onClick={openDatePickerFromPill}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
          {dateFromLabel}
        </span>
        <Input
          type="date"
          value={createdFrom}
          onChange={(event) => setCreatedFrom(event.target.value)}
          className="h-full w-[7.5rem] cursor-pointer border-none bg-transparent px-0 py-0 text-[10px] normal-case tracking-normal leading-none"
        />
      </label>
      <label
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-0"
        onClick={openDatePickerFromPill}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
          {dateToLabel}
        </span>
        <Input
          type="date"
          value={createdTo}
          onChange={(event) => setCreatedTo(event.target.value)}
          className="h-full w-[7.5rem] cursor-pointer border-none bg-transparent px-0 py-0 text-[10px] normal-case tracking-normal leading-none"
        />
      </label>
    </div>
  );

  const renderHeaderLabel = (label: string) => (
    <p className="truncate text-[9px] font-black uppercase tracking-[0.14em] leading-none text-zinc-900 dark:text-zinc-300">
      {label}
    </p>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={t('totalLogs')} value={paginationMeta.total} />
        <StatCard label={t('statusChanges')} value={statusLogCount} variant="info" />
        <StatCard label={t('qrVersionChanges')} value={qrVersionLogCount} variant="success" />
      </div>

      <Card
        title={t('auditLogs')}
        action={dateRangeFilter}
        noPadding
      >
        <div className="border-b border-zinc-100 bg-zinc-50/60 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,28rem)] lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {([
                ['all', t('allLogTypes')],
                ['status', t('statusChange')],
                ['qr_version', t('qrVersionChange')],
              ] as Array<[AuditFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`inline-flex h-9 cursor-pointer items-center rounded-xl border px-3 py-0 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
                    filter === value
                      ? 'border-[#00A655] bg-emerald-50 text-emerald-700'
                      : 'border-zinc-200 bg-white text-zinc-500 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchPallets')}
                className="pl-11 bg-white"
              />
            </div>
          </div>
        </div>

        <div className="hidden">
          <table className="w-full min-w-[980px] text-left">
            <thead className="border-b border-zinc-100 bg-zinc-50/50 text-[9px] font-black uppercase tracking-widest text-zinc-400">
              <tr>
                <th className="px-6 py-4">{t('timestamp')}</th>
                <th className="px-6 py-4">{t('logType')}</th>
                <th className="px-6 py-4">{t('pallets')}</th>
                <th className="px-6 py-4">{t('changedBy')}</th>
                <th className="px-6 py-4">{t('changeSummary')}</th>
                <th className="px-6 py-4">{t('note')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 text-[11px]">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const pallet = pallets.find((item) => item.id === log.pallet_id) || null;
                  const logType = log.type || 'status';
                  const oldClientName = getClientName(log.old_client_id);
                  const newClientName = getClientName(log.new_client_id);

                  return (
                    <tr key={`audit-screen-${log.id}`} className="hover:bg-zinc-50/70 transition-colors align-top">
                      <td className="px-6 py-4 whitespace-nowrap text-zinc-400 font-bold">
                        {new Date(log.created_at).toLocaleString(localeMap[language], {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={logType === 'qr_version' ? 'success' : 'info'}>
                          {logType === 'qr_version' ? t('qrVersionChange') : t('statusChange')}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => onSelectPallet(pallet)}
                          className="text-left hover:opacity-80 transition-opacity"
                        >
                          <span className="block font-mono font-black text-zinc-900 underline underline-offset-4">
                            {log.pallet_qr}
                          </span>
                          {logType === 'qr_version' && log.qr_version && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-600">
                              <QrCode size={11} />
                              {t('versionLabel')} {log.qr_version}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                            <History size={14} />
                          </div>
                          <div>
                            <p className="font-black text-zinc-900">{log.made_by_user_name}</p>
                            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400">#{log.made_by_user_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {logType === 'qr_version' ? (
                          <div className="space-y-2">
                            <p className="font-black text-zinc-900">
                              {log.old_qr_code || '-'} <span className="text-zinc-300">→</span> {log.new_qr_code || '-'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                              <span>{t('oldQrCode')}: {log.old_qr_code || '-'}</span>
                              <span>{t('newQrCode')}: {log.new_qr_code || '-'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="font-black text-zinc-900">
                              {getStatusLabel(log.old_status_name || '-', language)} <span className="text-zinc-300">→</span>{' '}
                              {getStatusLabel(log.new_status_name, language)}
                            </p>
                            <div className="space-y-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                              <p>{log.old_location || '-'} <span className="text-zinc-300">→</span> {log.new_location}</p>
                              {(oldClientName || newClientName) && (
                                <p>{oldClientName || '-'} <span className="text-zinc-300">→</span> {newClientName || '-'}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-500">
                        <p className="max-w-xs leading-relaxed">{log.note || '-'}</p>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-zinc-400">
                    <History size={28} className="mx-auto mb-3 opacity-40" />
                    <p className="text-[10px] font-black uppercase tracking-[0.16em]">{t('noAuditLogs')}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hidden">
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
        </div>
      </Card>

      <AdminDataTable<AuditColumnKey>
        columnOrder={AUDIT_TABLE_COLUMN_ORDER}
        initialColumnWidths={AUDIT_INITIAL_COLUMN_WIDTHS}
        minColumnWidths={AUDIT_MIN_COLUMN_WIDTHS}
        resizeAriaLabel={language === 'nl' ? 'Kolombreedte aanpassen' : language === 'bs' ? 'Promijeni sirinu kolone' : 'Resize column'}
        tableRef={tableRef}
        headerCellRefs={headerCellRefs}
        isEmpty={!isPageLoading && filteredLogs.length === 0}
        emptyState={
          <div className="p-20 text-center text-zinc-400">
            <History size={28} className="mx-auto mb-3 opacity-40" />
            <p className="text-[10px] font-black uppercase tracking-[0.16em]">{t('noAuditLogs')}</p>
          </div>
        }
        renderTable={({ columnWidths, totalTableWidth, registerHeaderCell, renderResizeHandle }) => (
          <table
            className="border-collapse text-left [table-layout:fixed]"
            style={{ width: `max(100%, ${totalTableWidth}px)` }}
          >
            <colgroup>
              <col style={{ width: columnWidths.timestamp }} />
              <col style={{ width: columnWidths.logType }} />
              <col style={{ width: columnWidths.pallet }} />
              <col style={{ width: columnWidths.changedBy }} />
              <col style={{ width: columnWidths.changeSummary }} />
              <col style={{ width: columnWidths.note }} />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-50/80 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th ref={registerHeaderCell('timestamp')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>{renderHeaderLabel(t('timestamp'))}</div>
                  {renderResizeHandle('timestamp')}
                </th>
                <th ref={registerHeaderCell('logType')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>{renderHeaderLabel(t('logType'))}</div>
                  {renderResizeHandle('logType')}
                </th>
                <th ref={registerHeaderCell('pallet')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>{renderHeaderLabel(t('pallets'))}</div>
                  {renderResizeHandle('pallet')}
                </th>
                <th ref={registerHeaderCell('changedBy')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>{renderHeaderLabel(t('changedBy'))}</div>
                  {renderResizeHandle('changedBy')}
                </th>
                <th ref={registerHeaderCell('changeSummary')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>{renderHeaderLabel(t('changeSummary'))}</div>
                  {renderResizeHandle('changeSummary')}
                </th>
                <th ref={registerHeaderCell('note')} className={cn(headerCellClass, 'group')}>
                  <div className={headerContentClass}>{renderHeaderLabel(t('note'))}</div>
                  {renderResizeHandle('note')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/10">
              {filteredLogs.map((log) => {
                const pallet = pallets.find((item) => item.id === log.pallet_id) || null;
                const logType = log.type || 'status';
                const oldClientName = getClientName(log.old_client_id);
                const newClientName = getClientName(log.new_client_id);

                return (
                  <tr key={`audit-screen-table-${log.id}`} className="transition-colors hover:bg-zinc-50/60 dark:hover:bg-white/5">
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <span className={cn(bodyTextClass, 'whitespace-normal text-zinc-500')}>
                          {new Date(log.created_at).toLocaleString(localeMap[language], {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <Badge variant={logType === 'qr_version' ? 'success' : 'info'}>
                          {logType === 'qr_version' ? t('qrVersionChange') : t('statusChange')}
                        </Badge>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <button
                          type="button"
                          onClick={() => onSelectPallet(pallet)}
                          className="min-w-0 text-center transition-opacity hover:opacity-80"
                        >
                          <span className="block truncate font-mono text-[11px] font-black text-zinc-900 underline underline-offset-4 dark:text-zinc-100">
                            {log.pallet_qr}
                          </span>
                          {logType === 'qr_version' && log.qr_version && (
                            <span className="mt-1 inline-flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-600">
                              <QrCode size={11} />
                              {t('versionLabel')} {log.qr_version}
                            </span>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        <div className="min-w-0 text-center">
                          <p className="truncate text-[11px] font-black text-zinc-900 dark:text-zinc-100">
                            {log.made_by_user_name || '-'}
                          </p>
                          <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                            #{log.made_by_user_id || '-'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={bodyCellClass}>
                      <div className={bodyCellInnerClass}>
                        {logType === 'qr_version' ? (
                          <div className="min-w-0 space-y-2 text-center">
                            <p className="truncate text-[11px] font-black text-zinc-900 dark:text-zinc-100">
                              {log.old_qr_code || '-'} <span className="text-zinc-300">{'->'}</span> {log.new_qr_code || '-'}
                            </p>
                            <div className="space-y-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                              <p className="truncate">{t('oldQrCode')}: {log.old_qr_code || '-'}</p>
                              <p className="truncate">{t('newQrCode')}: {log.new_qr_code || '-'}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="min-w-0 space-y-2 text-center">
                            <p className="truncate text-[11px] font-black text-zinc-900 dark:text-zinc-100">
                              {getStatusLabel(log.old_status_name || '-', language)} <span className="text-zinc-300">{'->'}</span>{' '}
                              {getStatusLabel(log.new_status_name, language)}
                            </p>
                            <div className="space-y-1 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">
                              <p className="truncate">{log.old_location || '-'} <span className="text-zinc-300">{'->'}</span> {log.new_location}</p>
                              {(oldClientName || newClientName) && (
                                <p className="truncate">{oldClientName || '-'} <span className="text-zinc-300">{'->'}</span> {newClientName || '-'}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                      <td className={bodyCellClass}>
                        <div className={bodyCellInnerClass}>
                          <div className="space-y-2 text-center">
                            {log.status_change_photo_url && <img src={log.status_change_photo_url} alt="Status change pallet" className="mx-auto h-14 w-20 rounded-lg object-cover" />}
                            <p className={cn(bodyTextClass, 'whitespace-normal text-zinc-500')}>{log.note || '-'}</p>
                          </div>
                        </div>
                      </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      />

      <PageLoadingModal isOpen={isPageLoading} language={language} />

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-[#101715]">
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
      </div>
    </div>
  );
};
