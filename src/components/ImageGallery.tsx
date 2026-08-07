import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Image as ImageIcon, Maximize2, Search, X } from 'lucide-react';
import { useApp } from '../AppContext';
import { getStatusLabel } from '../i18n';
import { apiService } from '../services/api';
import type { ClientDetail, PalletPhoto } from '../types';
import { Card, Input, Select, cn } from './ui';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { useInfinitePagination } from '../hooks/useInfinitePagination';
import { formatAppDateTime } from '../lib/dateFormat';
import { FlatpickrDateInput } from './FlatpickrDateInput';

function SecureGalleryImage({ photo, className }: { photo: PalletPhoto; className?: string }) {
  const [source, setSource] = useState('');

  useEffect(() => {
    let objectUrl = '';

    if (photo.url) {
      void apiService.gallery.image(photo.url)
        .then((blob) => {
          objectUrl = URL.createObjectURL(blob);
          setSource(objectUrl);
        })
        .catch(() => setSource(''));
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [photo.id, photo.url]);

  return source ? (
    <img
      src={source}
      loading="lazy"
      alt={photo.pallet?.name || 'Pallet'}
      className={cn('h-full w-full object-cover', className)}
    />
  ) : (
    <div className="flex h-full items-center justify-center">
      <ImageIcon className="text-zinc-300" />
    </div>
  );
}

type GalleryFilters = {
  search: string;
  type: string;
  client_id: string;
  status_id: string;
  date_from: string;
  date_to: string;
};

export function ImageGallery() {
  const { clients: cachedClients, statuses, t, language } = useApp();
  const [filters, setFilters] = useState<GalleryFilters>({
    search: '',
    type: '',
    client_id: '',
    status_id: '',
    date_from: '',
    date_to: '',
  });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [galleryClients, setGalleryClients] = useState<ClientDetail[]>(cachedClients);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PalletPhoto | null>(null);
  const clientFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isCurrentRequest = true;

    void apiService.clients.list()
      .then((allClients) => {
        if (isCurrentRequest) {
          setGalleryClients(allClients);
        }
      })
      .catch(() => {
        if (isCurrentRequest) {
          setGalleryClients(cachedClients);
        }
      });

    return () => {
      isCurrentRequest = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedFilters(filters), 200);
    return () => window.clearTimeout(timer);
  }, [filters]);

  useEffect(() => {
    const closeClientFilter = (event: MouseEvent) => {
      if (!clientFilterRef.current?.contains(event.target as Node)) {
        setIsClientFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', closeClientFilter);
    return () => document.removeEventListener('mousedown', closeClientFilter);
  }, []);

  useEffect(() => {
    if (!selectedPhoto) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPhoto(null);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedPhoto]);

  const fetchPage = useCallback(
    (offset: number) => apiService.gallery.page({ ...debouncedFilters, limit: 12, offset }),
    [debouncedFilters],
  );
  const { items: photos, hasMore, isInitialLoading, isLoadingMore, error, loadMore, retry } = useInfinitePagination({
    queryKey: JSON.stringify(debouncedFilters), pageSize: 12, fetchPage,
  });

  const update = (key: keyof GalleryFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const dateLabels = language === 'bs'
    ? { start: 'Početni datum', end: 'Završni datum' }
    : language === 'nl'
      ? { start: 'Startdatum', end: 'Einddatum' }
      : { start: 'Start date', end: 'End date' };
  const generalSearchPlaceholder = language === 'bs'
    ? 'Pretraži paletu ili autora'
    : language === 'nl'
      ? 'Zoek bok of uploader'
      : 'Search pallet or uploader';
  const photoTypeLabel = (type: PalletPhoto['type']) => ({
    scan: t('statusChangeImage'),
    status_change: t('statusChangeImage'),
    damage_report: t('damageReportImage'),
    service_report: t('serviceReportImage'),
    no_qr_report: t('noQrReportImage'),
    delivery_photo: t('deliveryReportImage'),
  }[type]);
  const selectedClient = galleryClients.find((client) => String(client.user_id) === filters.client_id);
  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLocaleLowerCase();

    return [...galleryClients]
      .filter((client) => {
        if (!query) {
          return true;
        }

        return [client.name, client.kvk_number, client.billing_email]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(query));
      })
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  }, [clientSearch, galleryClients]);

  return <div className="space-y-5">
    <div><h2 className="text-3xl font-black uppercase tracking-tight dark:text-white">{t('imageGallery')}</h2><p className="text-sm text-zinc-400">{t('galleryDescription')}</p></div>
    <Card className="dark:bg-[#101715]" contentClassName="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Select className="h-11 py-0" value={filters.type} onChange={(event) => update('type', event.target.value)}>
          <option value="">{t('allImageTypes')}</option>
          <option value="scan">{t('statusChangeImage')}</option>
          <option value="damage_report">{t('damageReportImage')}</option>
          <option value="service_report">{t('serviceReportImage')}</option>
          <option value="no_qr_report">{t('noQrReportImage')}</option>
          <option value="delivery_photo">{t('deliveryReportImage')}</option>
        </Select>
        <Select className="h-11 py-0" value={filters.status_id} onChange={(event) => update('status_id', event.target.value)}>
          <option value="">{t('allStatuses')}</option>
          {statuses.map((status) => (
            <option key={`gallery-status-${status.id}`} value={String(status.id)}>
              {getStatusLabel(status.name, language)}
            </option>
          ))}
        </Select>
        <div ref={clientFilterRef} className="relative">
          <button
            type="button"
            role="combobox"
            aria-expanded={isClientFilterOpen}
            onClick={() => {
              setClientSearch('');
              setIsClientFilterOpen((current) => !current);
            }}
            className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 text-left text-[12px] font-black uppercase tracking-tight text-[var(--text-primary)] outline-none transition-colors focus:border-[color:var(--action-primary)]"
          >
            <span className="truncate">{selectedClient?.name || t('allClients')}</span>
            <ChevronDown size={15} className={cn('shrink-0 transition-transform', isClientFilterOpen && 'rotate-180')} />
          </button>
          {isClientFilterOpen && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-full min-w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_20px_45px_-22px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#151d1a]">
              <div className="relative pb-2">
                <Search size={15} className="pointer-events-none absolute left-3 top-[1.15rem] -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder={t('search')}
                  autoFocus
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[11px] font-bold outline-none focus:border-emerald-300 dark:border-white/10 dark:bg-white/5"
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
                <button
                  type="button"
                  onClick={() => {
                    update('client_id', '');
                    setIsClientFilterOpen(false);
                  }}
                  className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] font-bold', !filters.client_id ? 'bg-emerald-50 text-emerald-800' : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/5')}
                >
                  <span>{t('allClients')}</span>
                  {!filters.client_id && <Check size={14} />}
                </button>
                {filteredClients.map((client) => (
                  <button
                    key={`gallery-client-${client.id}`}
                    type="button"
                    onClick={() => {
                      update('client_id', String(client.user_id));
                      setIsClientFilterOpen(false);
                    }}
                    className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] font-bold', filters.client_id === String(client.user_id) ? 'bg-emerald-50 text-emerald-800' : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/5')}
                  >
                    <span className="truncate">{client.name}</span>
                    {filters.client_id === String(client.user_id) && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <FlatpickrDateInput value={filters.date_from} onChange={(value) => update('date_from', value)} language={language} ariaLabel={dateLabels.start} placeholder={dateLabels.start} maxDate={filters.date_to || undefined} popupPosition="below left" className="h-11 py-0 text-[9px] font-black text-zinc-950 placeholder:text-zinc-950 placeholder:opacity-100 dark:text-zinc-100 dark:placeholder:text-zinc-100" />
          <FlatpickrDateInput value={filters.date_to} onChange={(value) => update('date_to', value)} language={language} ariaLabel={dateLabels.end} placeholder={dateLabels.end} minDate={filters.date_from || undefined} popupPosition="below right" className="h-11 py-0 text-[9px] font-black text-zinc-950 placeholder:text-zinc-950 placeholder:opacity-100 dark:text-zinc-100 dark:placeholder:text-zinc-100" />
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
          <Input className="h-11 py-0 pl-9" placeholder={generalSearchPlaceholder} value={filters.search} onChange={(event) => update('search', event.target.value)} />
        </div>
      </div>
    </Card>
    {isInitialLoading ? <p className="py-16 text-center text-zinc-400">{t('loading')}</p> : photos.length === 0 ? <Card className="py-16 text-center dark:bg-[#101715]"><ImageIcon className="mx-auto mb-3 text-zinc-300" /><p>{t('galleryEmpty')}</p></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{photos.map((photo) => <Card key={photo.id} noPadding className="overflow-hidden dark:bg-[#101715]">
      <button type="button" onClick={() => setSelectedPhoto(photo)} className="group relative aspect-video w-full bg-zinc-100 text-left dark:bg-black/20" aria-label={`${photo.pallet?.name || 'Pallet'} - ${photoTypeLabel(photo.type)}`}>
        <SecureGalleryImage photo={photo} />
        <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 size={16} /></span>
      </button>
      <div className="space-y-1 p-4 text-sm"><strong className="dark:text-white">{photo.pallet?.name || `#${photo.pallet_id}`}</strong><p className="text-zinc-500">{photo.pallet?.customer || '-'} / {photoTypeLabel(photo.type)}</p><p className="text-xs text-zinc-400">{photo.status?.name ? getStatusLabel(photo.status.name, language) : photo.pallet?.status ? getStatusLabel(photo.pallet.status, language) : '-'} / {photo.uploader?.name || '-'}</p><p className="text-xs text-zinc-400">{formatAppDateTime(photo.created_at, language)}</p></div>
    </Card>)}</div>}
    <InfiniteScrollFooter hasMore={hasMore} isLoading={isLoadingMore} error={error} onLoadMore={loadMore} onRetry={retry} language={language} />

    {selectedPhoto && (
      <div className="modal-overlay fixed inset-0 z-[2200] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={() => setSelectedPhoto(null)}>
        <div className="relative flex h-full max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => setSelectedPhoto(null)} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur hover:bg-black/80" aria-label={t('close')}><X size={20} /></button>
          <div className="min-h-0 flex-1 bg-black"><SecureGalleryImage photo={selectedPhoto} className="object-contain" /></div>
          <div className="shrink-0 bg-zinc-950 px-5 py-4 text-white"><p className="font-black">{selectedPhoto.pallet?.name || `#${selectedPhoto.pallet_id}`}</p><p className="mt-1 text-xs text-zinc-400">{selectedPhoto.pallet?.customer || '-'} / {photoTypeLabel(selectedPhoto.type)} / {formatAppDateTime(selectedPhoto.created_at, language)}</p></div>
        </div>
      </div>
    )}
  </div>;
}
