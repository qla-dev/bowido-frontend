import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react';
import type { PalletPhoto } from '../types';
import { apiService } from '../services/api';
import { cn } from './ui';

function SecurePhoto({
  photo,
  className,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  photo: PalletPhoto;
  className?: string;
  style?: CSSProperties;
  onPointerDown?: (event: ReactPointerEvent<HTMLImageElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLImageElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLImageElement>) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLImageElement>) => void;
}) {
  const [source, setSource] = useState('');

  useEffect(() => {
    let objectUrl = '';
    if (photo.url) {
      void apiService.gallery.image(photo.url).then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      }).catch(() => setSource(''));
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photo.id, photo.url]);

  return source ? <img src={source} alt="Damage report" className={cn('h-full w-full object-contain', className)} style={style} draggable={false} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} /> : null;
}

export function ServiceReportPhotoLightbox({ photos, onClose }: { photos: PalletPhoto[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{ pointerId: number; originX: number; originY: number; maxX: number; maxY: number } | null>(null);
  const photo = photos[index];
  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); setIsPanning(false); };
  const selectPhoto = (nextIndex: number) => { setIndex(nextIndex); resetView(); };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const changeZoom = (amount: number) => setZoom((current) => {
    const next = Math.max(1, Math.min(3, Number((current + amount).toFixed(2))));
    if (next === 1) setOffset({ x: 0, y: 0 });
    return next;
  });
  const startPan = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (zoom <= 1) return;
    const viewport = viewportRef.current?.getBoundingClientRect();
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (!viewport || !naturalWidth || !naturalHeight) return;
    const scale = Math.min(viewport.width / naturalWidth, viewport.height / naturalHeight);
    const maxX = Math.max(0, (naturalWidth * scale * zoom - viewport.width) / 2);
    const maxY = Math.max(0, (naturalHeight * scale * zoom - viewport.height) / 2);
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, originX: event.clientX - offset.x, originY: event.clientY - offset.y, maxX, maxY };
    setIsPanning(true);
  };
  const movePan = (event: ReactPointerEvent<HTMLImageElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setOffset({ x: Math.max(-pan.maxX, Math.min(pan.maxX, event.clientX - pan.originX)), y: Math.max(-pan.maxY, Math.min(pan.maxY, event.clientY - pan.originY)) });
  };
  const stopPan = (event: ReactPointerEvent<HTMLImageElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    panRef.current = null;
    setIsPanning(false);
  };

  return <div className="modal-overlay fixed inset-0 z-[2300] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
    <div className="relative flex h-full max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-zinc-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <button type="button" onClick={onClose} className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur hover:bg-black/80" aria-label="Close"><X size={20} /></button>
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {photo && <SecurePhoto photo={photo} className={cn('select-none', zoom > 1 ? isPanning ? 'cursor-grabbing' : 'cursor-grab' : 'transition-transform duration-200')} style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})` }} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} />}
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 overflow-hidden rounded-full bg-black/65 text-white shadow-lg backdrop-blur">
          <button type="button" onClick={() => changeZoom(-0.25)} disabled={zoom <= 1} className="flex h-11 w-11 items-center justify-center hover:bg-black/80 disabled:opacity-40" aria-label="Zoom out"><Minus size={20} /></button>
          <span className="flex min-w-14 items-center justify-center border-x border-white/15 text-xs font-black tabular-nums">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => changeZoom(0.25)} disabled={zoom >= 3} className="flex h-11 w-11 items-center justify-center hover:bg-black/80 disabled:opacity-40" aria-label="Zoom in"><Plus size={20} /></button>
        </div>
        {photos.length > 1 && <>
          <button type="button" onClick={() => selectPhoto((index - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur hover:bg-black/80" aria-label="Previous photo"><ChevronLeft size={22} /></button>
          <button type="button" onClick={() => selectPhoto((index + 1) % photos.length)} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur hover:bg-black/80" aria-label="Next photo"><ChevronRight size={22} /></button>
        </>}
      </div>
      {photos.length > 1 && <div className="flex shrink-0 gap-2 overflow-x-auto bg-zinc-900 px-4 py-3 no-scrollbar">
        {photos.map((item, itemIndex) => <button key={item.id} type="button" onClick={() => selectPhoto(itemIndex)} className={cn('h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-black', itemIndex === index ? 'border-[#00A655]' : 'border-transparent opacity-65')}><SecurePhoto photo={item} /></button>)}
      </div>}
      <div className="shrink-0 bg-zinc-950 px-5 py-4 text-right text-xs font-black text-zinc-300">{index + 1} / {photos.length}</div>
    </div>
  </div>;
}
