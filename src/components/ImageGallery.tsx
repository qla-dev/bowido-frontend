import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, Minus, Plus, Search, X } from 'lucide-react';
import { useApp } from '../AppContext';
import { getStatusLabel } from '../i18n';
import { apiService } from '../services/api';
import type { ClientDetail, PalletPhoto } from '../types';
import { Card, Input, cn } from './ui';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { useInfinitePagination } from '../hooks/useInfinitePagination';
import { formatAppDateTime } from '../lib/dateFormat';
import { FlatpickrDateInput } from './FlatpickrDateInput';
import { rankSearchResults } from '../lib/searchRanking';
import { AdminTableStickyToolbar } from './AdminTableStickyToolbar';

function SecureGalleryImage({
  photo,
  className,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  draggable,
}: {
  photo: PalletPhoto;
  className?: string;
  style?: CSSProperties;
  onPointerDown?: (event: ReactPointerEvent<HTMLImageElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLImageElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLImageElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLImageElement>) => void;
  draggable?: boolean;
}) {
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
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      draggable={draggable}
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

type GalleryFilterOption = {
  value: string;
  label: string;
};

function GalleryFilterDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: GalleryFilterOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    const closeDropdown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', closeDropdown);
    return () => document.removeEventListener('mousedown', closeDropdown);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 text-left text-[12px] font-black uppercase tracking-tight text-[var(--text-primary)] outline-none transition-colors focus:border-[color:var(--action-primary)]"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown size={15} className={cn('shrink-0 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-full min-w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_20px_45px_-22px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#151d1a]">
          <div className="max-h-64 space-y-1 overflow-y-auto overscroll-contain">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] font-bold', isSelected ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200' : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/5')}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
  const [selectedPalletId, setSelectedPalletId] = useState<number | null>(null);
  const [selectedPalletPhotos, setSelectedPalletPhotos] = useState<PalletPhoto[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedPhotoZoom, setSelectedPhotoZoom] = useState(1);
  const [selectedPhotoOffset, setSelectedPhotoOffset] = useState({ x: 0, y: 0 });
  const [isPanningSelectedPhoto, setIsPanningSelectedPhoto] = useState(false);
  const [isPalletGalleryLoading, setIsPalletGalleryLoading] = useState(false);
  const clientFilterRef = useRef<HTMLDivElement | null>(null);
  const imageViewportRef = useRef<HTMLDivElement | null>(null);
  const selectedPhotoPanRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    maxX: number;
    maxY: number;
  } | null>(null);

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
    if (selectedPalletId === null) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPalletId(null);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [selectedPalletId]);

  const fetchPage = useCallback(
    (offset: number) => apiService.gallery.page({ ...debouncedFilters, limit: 12, offset }),
    [debouncedFilters],
  );
  const { items: photos, hasMore, isInitialLoading, isLoadingMore, error, loadMore, retry } = useInfinitePagination({
    queryKey: JSON.stringify(debouncedFilters), pageSize: 12, fetchPage,
  });
  const palletPhotoGroups = useMemo(() => {
    const groups = new Map<number, PalletPhoto[]>();

    photos.forEach((photo) => {
      const group = groups.get(photo.pallet_id) || [];
      group.push(photo);
      groups.set(photo.pallet_id, group);
    });

    return Array.from(groups.entries()).map(([palletId, palletPhotos]) => ({
      palletId,
      photos: palletPhotos,
      cover: palletPhotos[0],
    }));
  }, [photos]);

  const selectedPhoto = selectedPalletPhotos[selectedPhotoIndex] || null;

  const closePalletGallery = () => {
    setSelectedPalletId(null);
    setSelectedPalletPhotos([]);
    setSelectedPhotoIndex(0);
    setSelectedPhotoZoom(1);
    setSelectedPhotoOffset({ x: 0, y: 0 });
    setIsPanningSelectedPhoto(false);
    setIsPalletGalleryLoading(false);
  };

  const openPalletGallery = async (palletId: number, initiallyLoaded: PalletPhoto[]) => {
    setSelectedPalletId(palletId);
    setSelectedPalletPhotos(initiallyLoaded);
    setSelectedPhotoIndex(0);
    setSelectedPhotoZoom(1);
    setSelectedPhotoOffset({ x: 0, y: 0 });
    setIsPalletGalleryLoading(true);

    try {
      const allPalletPhotos = await apiService.gallery.list({ pallet_id: palletId });
      if (allPalletPhotos.length > 0) {
        setSelectedPalletPhotos(allPalletPhotos);
        setSelectedPhotoIndex(0);
        setSelectedPhotoZoom(1);
        setSelectedPhotoOffset({ x: 0, y: 0 });
      }
    } catch (error) {
      console.error('Failed to load all gallery photos for pallet', error);
    } finally {
      setIsPalletGalleryLoading(false);
    }
  };

  const update = (key: keyof GalleryFilters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const selectPhoto = (index: number) => {
    setSelectedPhotoIndex(index);
    setSelectedPhotoZoom(1);
    setSelectedPhotoOffset({ x: 0, y: 0 });
    setIsPanningSelectedPhoto(false);
  };
  const changeSelectedPhotoZoom = (amount: number) =>
    setSelectedPhotoZoom((current) => {
      const next = Math.min(3, Math.max(1, Number((current + amount).toFixed(2))));
      if (next === 1) {
        setSelectedPhotoOffset({ x: 0, y: 0 });
      }
      return next;
    });
  const startPanningSelectedPhoto = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (selectedPhotoZoom <= 1) return;

    const viewport = imageViewportRef.current?.getBoundingClientRect();
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!viewport || !naturalWidth || !naturalHeight) return;

    const baseScale = Math.min(viewport.width / naturalWidth, viewport.height / naturalHeight);
    const displayedWidth = naturalWidth * baseScale * selectedPhotoZoom;
    const displayedHeight = naturalHeight * baseScale * selectedPhotoZoom;
    const maxX = Math.max(0, (displayedWidth - viewport.width) / 2);
    const maxY = Math.max(0, (displayedHeight - viewport.height) / 2);

    event.currentTarget.setPointerCapture(event.pointerId);
    selectedPhotoPanRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX - selectedPhotoOffset.x,
      originY: event.clientY - selectedPhotoOffset.y,
      maxX,
      maxY,
    };
    setIsPanningSelectedPhoto(true);
  };
  const panSelectedPhoto = (event: ReactPointerEvent<HTMLImageElement>) => {
    const pan = selectedPhotoPanRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;

    setSelectedPhotoOffset({
      x: Math.max(-pan.maxX, Math.min(pan.maxX, event.clientX - pan.originX)),
      y: Math.max(-pan.maxY, Math.min(pan.maxY, event.clientY - pan.originY)),
    });
  };
  const stopPanningSelectedPhoto = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (selectedPhotoPanRef.current?.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    selectedPhotoPanRef.current = null;
    setIsPanningSelectedPhoto(false);
  };
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
  const palletPhotosLabel = language === 'bs'
    ? 'fotografija'
    : language === 'nl'
      ? "foto's"
      : 'photos';
  const photoTypeLabel = (type: PalletPhoto['type']) => ({
    scan: t('statusChangeImage'),
    status_change: t('statusChangeImage'),
    damage_report: t('damageReportImage'),
    service_report: t('serviceReportImage'),
    no_qr_report: t('noQrReportImage'),
    delivery_photo: t('deliveryReportImage'),
  }[type]);
  const statusOptions: GalleryFilterOption[] = [
    { value: '', label: t('allStatuses') },
    ...statuses.map((status) => ({ value: String(status.id), label: getStatusLabel(status.name, language) })),
  ];
  const selectedClient = galleryClients.find((client) => String(client.user_id) === filters.client_id);
  const filteredClients = useMemo(
    () => rankSearchResults(
      galleryClients,
      clientSearch,
      (client) => client.name,
      (client, query) => [client.kvk_number, client.billing_email]
        .some((value) => String(value || '').toLocaleLowerCase().includes(query)),
    ),
    [clientSearch, galleryClients],
  );

  return <div className="space-y-5">
    <AdminTableStickyToolbar flushToPageTop className="py-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.35)] sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[#101715]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-white/10 dark:text-emerald-100">
            <ImageIcon size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-400">{t('imageGallery')}</p>
            <p className="text-sm font-black uppercase tracking-tight text-zinc-950 dark:text-white">{t('galleryDescription')}</p>
          </div>
        </div>
      </div>
    </AdminTableStickyToolbar>
    <Card className="dark:bg-[#101715]" contentClassName="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <GalleryFilterDropdown value={filters.status_id} options={statusOptions} onChange={(value) => update('status_id', value)} />
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
    {isInitialLoading ? (
      <p className="py-16 text-center text-zinc-400">{t('loading')}</p>
    ) : palletPhotoGroups.length === 0 ? (
      <Card className="py-16 text-center dark:bg-[#101715]">
        <ImageIcon className="mx-auto mb-3 text-zinc-300" />
        <p>{t('galleryEmpty')}</p>
      </Card>
    ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {palletPhotoGroups.map((group) => {
          const photo = group.cover;

          return (
            <Card key={group.palletId} noPadding className="overflow-hidden dark:bg-[#101715]">
              <button
                type="button"
                onClick={() => void openPalletGallery(group.palletId, group.photos)}
                className="group relative aspect-video w-full bg-zinc-100 text-left dark:bg-black/20"
                aria-label={`${photo.pallet?.name || 'Pallet'} - ${group.photos.length} ${palletPhotosLabel}`}
              >
                <SecureGalleryImage photo={photo} />
                <span className="absolute left-3 top-3 rounded-full bg-[#00A655] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
                  {group.photos.length} {palletPhotosLabel}
                </span>
                <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Maximize2 size={16} />
                </span>
              </button>
              <div className="space-y-1 p-4 text-sm">
                <strong className="dark:text-white">{photo.pallet?.name || `#${photo.pallet_id}`}</strong>
                <p className="text-zinc-500">{photo.pallet?.customer || '-'}</p>
                <p className="text-xs text-zinc-400">
                  {photo.status?.name
                    ? getStatusLabel(photo.status.name, language)
                    : photo.pallet?.status
                      ? getStatusLabel(photo.pallet.status, language)
                      : '-'} / {formatAppDateTime(photo.created_at, language)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    )}
    <InfiniteScrollFooter hasMore={hasMore} isLoading={isLoadingMore} error={error} onLoadMore={loadMore} onRetry={retry} language={language} />

    {selectedPalletId !== null && (
      <div className="modal-overlay fixed inset-0 z-[2200] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={closePalletGallery}>
        <div className="relative flex h-full max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={closePalletGallery} className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur hover:bg-black/80" aria-label={t('close')}><X size={20} /></button>

          <div ref={imageViewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
            {selectedPhoto ? (
              <SecureGalleryImage
                photo={selectedPhoto}
                className={cn(
                  'object-contain select-none',
                  selectedPhotoZoom > 1
                    ? isPanningSelectedPhoto ? 'cursor-grabbing' : 'cursor-grab'
                    : 'transition-transform duration-200',
                )}
                style={{ transform: `translate3d(${selectedPhotoOffset.x}px, ${selectedPhotoOffset.y}px, 0) scale(${selectedPhotoZoom})` }}
                onPointerDown={startPanningSelectedPhoto}
                onPointerMove={panSelectedPhoto}
                onPointerUp={stopPanningSelectedPhoto}
                onPointerCancel={stopPanningSelectedPhoto}
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400">{t('loading')}</div>
            )}

            {selectedPhoto && (
              <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 overflow-hidden rounded-full bg-black/65 text-white shadow-lg backdrop-blur">
                <button
                  type="button"
                  onClick={() => changeSelectedPhotoZoom(-0.25)}
                  disabled={selectedPhotoZoom <= 1}
                  className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Zoom out"
                >
                  <Minus size={20} />
                </button>
                <span className="flex min-w-14 items-center justify-center border-x border-white/15 text-xs font-black tabular-nums">
                  {Math.round(selectedPhotoZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => changeSelectedPhotoZoom(0.25)}
                  disabled={selectedPhotoZoom >= 3}
                  className="flex h-11 w-11 items-center justify-center transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Zoom in"
                >
                  <Plus size={20} />
                </button>
              </div>
            )}

            {selectedPalletPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => selectPhoto((selectedPhotoIndex - 1 + selectedPalletPhotos.length) % selectedPalletPhotos.length)}
                  className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur hover:bg-black/80"
                  aria-label="Previous photo"
                >
                  <ChevronLeft size={22} />
                </button>
                <button
                  type="button"
                  onClick={() => selectPhoto((selectedPhotoIndex + 1) % selectedPalletPhotos.length)}
                  className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur hover:bg-black/80"
                  aria-label="Next photo"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}
          </div>

          {selectedPalletPhotos.length > 1 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto bg-zinc-900 px-4 py-3 no-scrollbar">
              {selectedPalletPhotos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => selectPhoto(index)}
                  className={cn(
                    'h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-black',
                    index === selectedPhotoIndex ? 'border-[#00A655]' : 'border-transparent opacity-65',
                  )}
                >
                  <SecureGalleryImage photo={photo} />
                </button>
              ))}
            </div>
          )}

          {selectedPhoto && (
            <div className="shrink-0 bg-zinc-950 px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black">{selectedPhoto.pallet?.name || `#${selectedPhoto.pallet_id}`}</p>
                  <p className="mt-1 text-xs font-semibold text-white/85">{selectedPhoto.pallet?.customer || '-'} / {photoTypeLabel(selectedPhoto.type)} / {formatAppDateTime(selectedPhoto.created_at, language)}</p>
                </div>
                <span className="shrink-0 text-xs font-black text-zinc-300">
                  {selectedPhotoIndex + 1} / {selectedPalletPhotos.length}
                </span>
              </div>
              {isPalletGalleryLoading && <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400">{t('loading')}</p>}
            </div>
          )}
        </div>
      </div>
    )}
  </div>;
}
