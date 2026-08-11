import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Camera, X, Search, Package, AlertCircle } from 'lucide-react';
import { useApp } from '../AppContext';
import { Pallet, User } from '../types';
import { Button, Card, Input } from './ui';
import { getPalletTypeLabel } from '../i18n';
import { compressPhotoForUpload } from '../lib/imageCompression';
import {
  DAMAGE_DESCRIPTION_MAX_LENGTH,
  getDamageDescriptionCharacterCount,
  limitDamageDescription,
} from '../lib/damageDescription';

interface DamageReportModalProps {
  onClose: () => void;
  currentUser: User;
}

export const DamageReportModal: React.FC<DamageReportModalProps> = ({ onClose }) => {
  const { pallets, reportDamage, t, language } = useApp();
  const [search, setSearch] = useState('');
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<Array<{ file: File; preview: string }>>([]);
  const imagePreviewsRef = useRef<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredPallets =
    search.length > 1
      ? pallets.filter((pallet) => pallet.qr_code.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
      : [];

  const handleSubmit = async () => {
    if (!selectedPallet || !description) return;

    setIsSubmitting(true);

    try {
      await reportDamage({
        pallet_id: selectedPallet.id,
        problem_description: description,
        images: images.map((image) => image.file),
      });
      onClose();
    } catch (error) {
      console.error('Failed to create damage report', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    imagePreviewsRef.current = images.map((image) => image.preview);
  }, [images]);

  useEffect(() => () => imagePreviewsRef.current.forEach((preview) => URL.revokeObjectURL(preview)), []);

  const addImages = async (files: FileList | null) => {
    if (!files) return;

    try {
      const preparedImages = await Promise.all(
        Array.from(files).slice(0, Math.max(0, 10 - images.length)).map(async (file) => {
          const compressed = await compressPhotoForUpload(file);
          return { file: compressed, preview: URL.createObjectURL(compressed) };
        }),
      );
      setImages((current) => [...current, ...preparedImages]);
    } catch (error) {
      console.error('Failed to compress damage photo', error);
    }
  };

  const removeImage = (index: number) => {
    setImages((current) => {
      const image = current[index];
      if (image) URL.revokeObjectURL(image.preview);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-xl"
      >
        <Card noPadding className="shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-6 border-b-2 border-rose-50 flex justify-between items-center bg-rose-50/10">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-rose-600">{t('reportDamage')}</h3>
              <p className="text-[9px] font-black text-rose-400 uppercase tracking-[0.2em]">{t('tagForService')}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-rose-400 hover:bg-rose-50/50">
              <X size={20} />
            </Button>
          </div>

          <div className="p-6 overflow-y-auto no-scrollbar space-y-6">
            {!selectedPallet ? (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">1. {t('selectUnit')}</h4>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                  <Input
                    placeholder={t('searchQr')}
                    className="pl-12 h-12 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-1.5">
                  {filteredPallets.map((pallet) => (
                    <button
                      key={pallet.id}
                      onClick={() => setSelectedPallet(pallet)}
                      className="w-full p-4 bg-zinc-50 border-2 border-transparent rounded-2xl flex items-center justify-between hover:border-rose-100 hover:bg-white transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white border border-zinc-100 rounded-xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-all">
                          <Package size={18} />
                        </div>
                        <div className="text-left">
                          <p className="text-[11px] font-black uppercase tracking-tight text-black">{pallet.qr_code}</p>
                          <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-tight">
                            {getPalletTypeLabel(pallet.type, language)} / {pallet.current_location}
                          </p>
                        </div>
                      </div>
                      <AlertCircle size={16} className="text-zinc-200 group-hover:text-rose-500 transition-colors" />
                    </button>
                  ))}
                  {search.length > 1 && filteredPallets.length === 0 && (
                    <p className="text-center py-6 text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                      {t('noPalletsMatching')} "{search}"
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-2xl border-2 border-zinc-100/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <Package size={16} className="text-rose-600" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-tight text-black">{selectedPallet.qr_code}</p>
                      <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{getPalletTypeLabel(selectedPallet.type, language)}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="xs" onClick={() => setSelectedPallet(null)} className="text-rose-500">
                    {t('cancel')}
                  </Button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">2. {t('damageDescription')}</h4>
                  <textarea
                    className="w-full p-4 bg-zinc-50 border-2 border-transparent focus:border-rose-500 rounded-2xl font-black text-xs h-24 outline-none transition-all resize-none uppercase tracking-tight placeholder:text-zinc-300"
                    placeholder={t('damageIssuePlaceholder')}
                    value={description}
                    onChange={(e) => setDescription(limitDamageDescription(e.target.value))}
                  />
                  <p className="px-1 text-right text-[9px] font-black uppercase tracking-widest text-zinc-400" aria-live="polite">
                    {getDamageDescriptionCharacterCount(description)} / {DAMAGE_DESCRIPTION_MAX_LENGTH} {t('characters')}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">3. {t('evidencePhoto')}</h4>
                  <div className="space-y-4">
                    {images.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {images.map((image, index) => (
                          <div key={image.preview} className="relative overflow-hidden rounded-2xl border-2 border-rose-50">
                            <img src={image.preview} className="h-28 w-full object-cover" alt={`Damage ${index + 1}`} />
                            <button type="button" onClick={() => removeImage(index)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white" aria-label={t('remove')}>
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {images.length < 10 && (
                      <>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          multiple
                          onChange={async (e) => {
                            await addImages(e.target.files);
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="damage-photo"
                        />
                        <label
                          htmlFor="damage-photo"
                          className="w-full py-10 bg-zinc-50 border-2 border-dashed border-zinc-100/80 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-white hover:border-rose-200 transition-all text-zinc-300 hover:text-rose-600 cursor-pointer group"
                        >
                          {isSubmitting ? (
                            <div className="w-5 h-5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Camera size={24} className="group-hover:scale-110 transition-transform" />
                              <span className="text-[9px] font-black uppercase tracking-widest">{t('evidencePhoto')}</span>
                            </>
                          )}
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-zinc-50/30 border-t-2 border-rose-50 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              disabled={!selectedPallet || !description || images.length === 0 || isSubmitting}
              onClick={handleSubmit}
              className="flex-[2] bg-rose-600 border-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-900/10"
            >
              {t('submitReport')}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
