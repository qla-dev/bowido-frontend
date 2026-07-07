import React, { useEffect, useMemo, useState } from 'react';
import { History, QrCode, Search } from 'lucide-react';
import { AuditLog, ClientDetail, Pallet } from '../types';
import { Badge, Button, Card, Input, StatCard } from './ui';
import { AppLanguage, getStatusLabel, localeMap } from '../i18n';
import { ListPagination } from './ListPagination';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService, PaginationMeta } from '../services/api';

interface AdminAuditLogsProps {
  auditLogs: AuditLog[];
  pallets: Pallet[];
  clients: ClientDetail[];
  language: AppLanguage;
  t: (key: string) => string;
  onSelectPallet: (pallet: Pallet | null) => void;
  onExport: () => void;
}

type AuditFilter = 'all' | 'status' | 'qr_version';
const AUDIT_LOG_PAGE_SIZE = 25;

export const AdminAuditLogs: React.FC<AdminAuditLogsProps> = ({
  auditLogs: cachedAuditLogs,
  pallets,
  clients,
  language,
  t,
  onSelectPallet,
  onExport,
}) => {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filter, setFilter] = useState<AuditFilter>('all');
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

  useEffect(() => {
    setPageOffset(0);
  }, [debouncedQuery, filter]);

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
  }, [debouncedQuery, filter, pageLimit, pageOffset]);

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

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={t('totalLogs')} value={paginationMeta.total} />
        <StatCard label={t('statusChanges')} value={statusLogCount} variant="info" />
        <StatCard label={t('qrVersionChanges')} value={qrVersionLogCount} variant="success" />
      </div>

      <Card
        title={t('auditLogs')}
        action={
          <Button variant="outline" size="sm" onClick={onExport}>
            PDF
          </Button>
        }
        noPadding
      >
        <div className="border-b border-zinc-100 bg-zinc-50/60 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,28rem)] lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {([
                ['all', t('allLogTypes')],
                ['status', t('statusChange')],
                ['qr_version', t('qrVersionChange')],
              ] as Array<[AuditFilter, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition-all ${
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

        <div className="overflow-x-auto">
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

        <PageLoadingModal isOpen={isPageLoading} language={language} />

        <div className="border-t border-zinc-100 p-4">
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
    </div>
  );
};
