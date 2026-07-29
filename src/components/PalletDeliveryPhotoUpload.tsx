import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, LoaderCircle, Upload, X } from 'lucide-react';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import { compressPhotoForUpload } from '../lib/imageCompression';

type PalletDeliveryPhotoUploadProps = {
  palletId: number;
  onUploaded?: () => void;
};

const copy = {
  en: { title: 'Delivery photo', hint: 'Photos are compressed to about 120 KB and saved as WebP.', choose: 'Choose photo', take: 'Take photo', save: 'Save photo', saving: 'Saving…', saved: 'Saved', remove: 'Remove', optimizing: 'Optimizing photo…', compressionError: 'The image could not be compressed. Please select another photo.', uploadError: 'The delivery photo could not be uploaded.', alt: 'Selected delivery photo' },
  nl: { title: 'Leveringsfoto', hint: 'Foto’s worden gecomprimeerd tot ongeveer 120 KB en opgeslagen als WebP.', choose: 'Foto kiezen', take: 'Foto nemen', save: 'Foto opslaan', saving: 'Opslaan…', saved: 'Opgeslagen', remove: 'Verwijderen', optimizing: 'Foto optimaliseren…', compressionError: 'De foto kon niet worden gecomprimeerd. Kies een andere foto.', uploadError: 'De leveringsfoto kon niet worden geüpload.', alt: 'Geselecteerde leveringsfoto' },
  bs: { title: 'Fotografija isporuke', hint: 'Fotografije se komprimiraju na oko 120 KB i čuvaju kao WebP.', choose: 'Odaberi fotografiju', take: 'Snimi fotografiju', save: 'Sačuvaj fotografiju', saving: 'Čuvanje…', saved: 'Sačuvano', remove: 'Ukloni', optimizing: 'Optimizacija fotografije…', compressionError: 'Fotografija se ne može komprimirati. Odaberite drugu fotografiju.', uploadError: 'Fotografija isporuke se ne može prenijeti.', alt: 'Odabrana fotografija isporuke' },
};

export function PalletDeliveryPhotoUpload({ palletId, onUploaded }: PalletDeliveryPhotoUploadProps) {
  const { language } = useApp();
  const text = copy[language] || copy.en;
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInProgressRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const clearSelection = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setPhoto(null);
    setIsUploaded(false);
    setError(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const selectPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;

    setError(null);
    setIsUploaded(false);
    setIsOptimizing(true);

    try {
      const compressed = await compressPhotoForUpload(selected);

      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const nextPreviewUrl = URL.createObjectURL(compressed);
      previewUrlRef.current = nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);
      setPhoto(compressed);
    } catch {
      setPhoto(null);
      setPreviewUrl(null);
      setError(text.compressionError);
    } finally {
      setIsOptimizing(false);
    }
  };

  const upload = async () => {
    if (!photo || isUploading || isUploaded || uploadInProgressRef.current) return;

    uploadInProgressRef.current = true;
    setIsUploading(true);
    setError(null);

    try {
      await apiService.pallets.uploadDeliveryPhoto(palletId, photo);
      setIsUploaded(true);
      onUploaded?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text.uploadError);
    } finally {
      uploadInProgressRef.current = false;
      setIsUploading(false);
    }
  };

  return (
    <section className="rounded-2xl bg-gray-50 p-4">
      <div className="mb-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500">{text.title}</h4>
        <p className="mt-1 text-xs text-gray-500">{text.hint}</p>
      </div>

      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={selectPhoto} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={selectPhoto} />

      {!previewUrl ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={isOptimizing} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-700 disabled:opacity-50">
            <ImagePlus size={15} /> {text.choose}
          </button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isOptimizing} className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50">
            <Camera size={15} /> {text.take}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <img src={previewUrl} alt={text.alt} className="h-40 w-full rounded-xl object-cover" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={upload} disabled={isUploading || isUploaded} className="inline-flex items-center gap-2 rounded-xl bg-[#00A655] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white disabled:opacity-50">
              {isUploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}
              {isUploaded ? text.saved : isUploading ? text.saving : text.save}
            </button>
            <button type="button" onClick={clearSelection} disabled={isUploading} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-700 disabled:opacity-50">
              <X size={15} /> {text.remove}
            </button>
          </div>
        </div>
      )}

      {isOptimizing && <p className="mt-3 flex items-center gap-2 text-xs text-gray-500"><LoaderCircle size={14} className="animate-spin" /> {text.optimizing}</p>}
      {error && <p role="alert" className="mt-3 text-xs font-bold text-red-600">{error}</p>}
    </section>
  );
}
