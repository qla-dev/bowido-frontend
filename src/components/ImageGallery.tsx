import { useCallback, useEffect, useState } from 'react';
import { Image as ImageIcon, Search } from 'lucide-react';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import type { PalletPhoto } from '../types';
import { Card, Input, Select } from './ui';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { useInfinitePagination } from '../hooks/useInfinitePagination';

function SecureGalleryImage({ photo }: { photo: PalletPhoto }) {
  const [source, setSource] = useState('');
  useEffect(() => { let objectUrl = ''; if (photo.url) void apiService.gallery.image(photo.url).then(blob => { objectUrl = URL.createObjectURL(blob); setSource(objectUrl); }).catch(() => setSource('')); return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }; }, [photo.id, photo.url]);
  return source ? <img src={source} loading="lazy" alt={photo.pallet?.name || 'Pallet'} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><ImageIcon className="text-zinc-300"/></div>;
}

export function ImageGallery() {
  const { t, language } = useApp();
  const [filters, setFilters] = useState({ search: '', type: '', warehouse_scope: '', date_from: '', date_to: '' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), 200);
    return () => window.clearTimeout(timer);
  }, [filters]);

  const fetchPage = useCallback((offset: number) => apiService.gallery.page({ ...debouncedFilters, limit: 12, offset }), [debouncedFilters]);
  const { items: photos, hasMore, isInitialLoading, isLoadingMore, error, loadMore, retry } = useInfinitePagination({
    queryKey: JSON.stringify(debouncedFilters), pageSize: 12, fetchPage,
  });

  const update = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const dateLabels = language === 'bs'
    ? { start: 'Početni datum', end: 'Završni datum' }
    : language === 'nl'
      ? { start: 'Startdatum', end: 'Einddatum' }
      : { start: 'Start date', end: 'End date' };

  return <div className="space-y-5">
    <div><h2 className="text-3xl font-black uppercase tracking-tight dark:text-white">{t('imageGallery')}</h2><p className="text-sm text-zinc-400">{t('galleryDescription')}</p></div>
    <Card className="space-y-3 dark:bg-[#101715]">
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={filters.type} onChange={e => update('type', e.target.value)}><option value="">{t('allImageTypes')}</option><option value="scan">{t('statusChangeImage')}</option><option value="damage_report">{t('damageReportImage')}</option><option value="service_report">{t('serviceReportImage')}</option></Select>
        <Select value={filters.warehouse_scope} onChange={e => update('warehouse_scope', e.target.value)}><option value="">{t('allWarehouses')}</option><option value="warehouse_nl">Bowido NL</option><option value="warehouse_bih">Bowido BiH</option></Select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-300">{dateLabels.start}</span><Input type="date" value={filters.date_from} onChange={e => update('date_from', e.target.value)}/></label>
          <label className="space-y-1.5"><span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-300">{dateLabels.end}</span><Input type="date" min={filters.date_from || undefined} value={filters.date_to} onChange={e => update('date_to', e.target.value)}/></label>
        </div>
        <div className="relative pt-[22px]"><Search className="absolute left-3 top-[34px] text-zinc-400" size={16}/><Input className="pl-9" placeholder="Search creator or client" value={filters.search} onChange={e => update('search', e.target.value)}/></div>
      </div>
    </Card>
    {isInitialLoading ? <p className="py-16 text-center text-zinc-400">{t('loading')}</p> : photos.length === 0 ? <Card className="py-16 text-center dark:bg-[#101715]"><ImageIcon className="mx-auto mb-3 text-zinc-300"/><p>{t('galleryEmpty')}</p></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{photos.map(photo => <Card key={photo.id} noPadding className="overflow-hidden dark:bg-[#101715]">
      <div className="aspect-video bg-zinc-100 dark:bg-black/20"><SecureGalleryImage photo={photo}/></div>
      <div className="space-y-1 p-4 text-sm"><strong className="dark:text-white">{photo.pallet?.name || `#${photo.pallet_id}`}</strong><p className="text-zinc-500">{photo.pallet?.customer || '—'} · {photo.type}</p><p className="text-xs text-zinc-400">{photo.warehouse_scope === 'warehouse_nl' ? 'Bowido NL' : photo.warehouse_scope === 'warehouse_bih' ? 'Bowido BiH' : '—'} · {photo.uploader?.name || '—'}</p><p className="text-xs text-zinc-400">{new Date(photo.created_at).toLocaleString()}</p></div>
    </Card>)}</div>}
    <InfiniteScrollFooter hasMore={hasMore} isLoading={isLoadingMore} error={error} onLoadMore={loadMore} onRetry={retry} language={language} />
  </div>;
}
