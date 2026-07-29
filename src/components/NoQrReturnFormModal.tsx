import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Camera, MapPin, Minus, Plus, Send, X } from 'lucide-react';
import { useApp } from '../AppContext';
import { ClientDetail, DeliveryLocationInput, RoleType, User } from '../types';
import { Button, Input, Select, cn } from './ui';
import { DriverModalShell } from './DriverModalShell';
import { DeliveryLocationMap } from './DeliveryLocationMap';
import { formatAppDate } from '../lib/dateFormat';
import { FlatpickrDateInput } from './FlatpickrDateInput';
import { appAlert } from './AppAlert';
import { compressPhotoForUpload } from '../lib/imageCompression';

interface NoQrReturnFormModalProps {
  currentUser: User;
  onClose: () => void;
  onSubmitted?: (clientName: string, count: number) => void;
}

type LocationMode = 'warehouse' | 'other' | null;

type LocationEntryState = {
  mode: LocationMode;
  details: string;
  warehouseIndex: number | null;
  deliveryLocation?: DeliveryLocationInput;
};

const copyByLanguage = {
  en: {
    eyebrow: 'No QR return',
    title: 'Return pickup form',
    subtitle: 'Report pallets without a QR plate and mark them as ready for pickup.',
    companyLabel: 'Company name',
    countLabel: 'Number of pallets',
    locationsLabel: 'Where are the pallets?',
    entryLabel: 'Location',
    ownWarehouse: 'Own warehouse',
    otherLocation: 'Other location',
    chooseLocationType: 'Choose location type',
    chooseWarehouse: 'Choose warehouse',
    locationLabel: 'Location details',
    locationOptionalLabel: 'Location details (optional)',
    locationPlaceholder: 'e.g. loading dock, side yard, rear gate...',
    pickupLabel: 'Available for pickup',
    directPickup: 'Direct pickup',
    pickupDateLabel: 'Or choose a date',
    pickupDatePlaceholder: 'Choose pickup date',
    commentLabel: 'Comment',
    commentPlaceholder: 'Optional extra information or instructions',
    sendLabel: 'Send report',
    reportButtonLabel: 'Report pallet without QR',
    reportButtonText: 'Ready for return, but no QR plate available.',
    warehouseFallback: 'Client warehouse',
    otherLocationFallback: 'Other location',
    pickupDirectSummary: 'Direct pickup',
    pickupDateSummary: 'Pickup date',
    sourceLabel: 'Submitted from mobile no-QR form',
    reportSuccessTitle: 'Report saved',
    reportSuccessText: 'The pallet without a QR code was created successfully.',
    reportErrorTitle: 'Report not saved',
    reportErrorText: 'The report could not be saved. Please try again.',
  },
  nl: {
    eyebrow: 'Zonder QR',
    title: 'Leegmelden - Ophaalformulier',
    subtitle: 'Meld bokken zonder QR-plaat aan en zet ze klaar voor ophaling.',
    companyLabel: 'Uw bedrijfsnaam',
    countLabel: 'Aantal bokken',
    locationsLabel: 'Waar staan de bokken?',
    entryLabel: 'Locatie',
    ownWarehouse: 'Eigen magazijn',
    otherLocation: 'Andere locatie',
    chooseLocationType: 'Kies locatietype',
    chooseWarehouse: 'Kies magazijn',
    locationLabel: 'Locatie details',
    locationOptionalLabel: 'Locatie details (optioneel)',
    locationPlaceholder: 'bijv. laadkade, buitenruimte, achterpoort...',
    pickupLabel: 'Beschikbaar voor het ophalen',
    directPickup: 'Direct ophalen',
    pickupDateLabel: 'Ophaal',
    pickupDatePlaceholder: 'Ophaal kiezen',
    commentLabel: 'Commentaar',
    commentPlaceholder: 'Optioneel: extra informatie of opmerkingen',
    sendLabel: 'Verzenden',
    reportButtonLabel: 'Bokken zonder QR-code retour melden',
    reportButtonText: 'Bokken klaar voor retour, maar zonder QR-plaat.',
    warehouseFallback: 'Klantmagazijn',
    otherLocationFallback: 'Andere locatie',
    pickupDirectSummary: 'Direct ophalen',
    pickupDateSummary: 'Ophaaldatum',
    sourceLabel: 'Verstuurd via mobiel formulier zonder QR',
    reportSuccessTitle: 'Melding opgeslagen',
    reportSuccessText: 'De bok zonder QR-code is succesvol aangemaakt.',
    reportErrorTitle: 'Melding niet opgeslagen',
    reportErrorText: 'De melding kon niet worden opgeslagen. Probeer het opnieuw.',
  },
  bs: {
    eyebrow: 'Bez QR koda',
    title: 'Forma za prijavu povrata',
    subtitle: 'Prijavite palete bez QR plocice i oznacite ih kao spremne za preuzimanje.',
    companyLabel: 'Naziv firme',
    countLabel: 'Broj paleta',
    locationsLabel: 'Gdje se palete nalaze?',
    entryLabel: 'Lokacija',
    ownWarehouse: 'Vlastiti magacin',
    otherLocation: 'Druga lokacija',
    chooseLocationType: 'Odaberite tip lokacije',
    chooseWarehouse: 'Odaberite magacin',
    locationLabel: 'Detalji lokacije',
    locationOptionalLabel: 'Detalji lokacije (opcionalno)',
    locationPlaceholder: 'npr. rampa, vanjsko skladiste, zadnji ulaz...',
    pickupLabel: 'Dostupno za preuzimanje',
    directPickup: 'Odmah preuzeti',
    pickupDateLabel: 'Ili odaberi datum',
    pickupDatePlaceholder: 'Odaberi datum preuzimanja',
    commentLabel: 'Komentar',
    commentPlaceholder: 'Opcionalno: dodatne informacije ili napomena',
    sendLabel: 'Pošalji prijavu',
    reportButtonLabel: 'Prijavi paletu bez QR koda',
    reportButtonText: 'Spremno za povrat, ali bez QR plocice.',
    warehouseFallback: 'Magacin klijenta',
    otherLocationFallback: 'Druga lokacija',
    pickupDirectSummary: 'Odmah preuzeti',
    pickupDateSummary: 'Datum preuzimanja',
    sourceLabel: 'Poslano preko mobilne no-QR forme',
    reportSuccessTitle: 'Prijava je sačuvana',
    reportSuccessText: 'Paleta bez QR koda je uspješno kreirana.',
    reportErrorTitle: 'Prijava nije sačuvana',
    reportErrorText: 'Prijavu nije moguće sačuvati. Pokušajte ponovo.',
  },
} as const;

export const NoQrReturnFormModal: React.FC<NoQrReturnFormModalProps> = ({
  currentUser,
  onClose,
  onSubmitted,
}) => {
  const { clients, language, reportGhostPallets } = useApp();
  const copy = copyByLanguage[language] || copyByLanguage.en;
  const isClient = currentUser.role_name === RoleType.KLIJENT;
  const roleClients = useMemo(() => {
    if (isClient) {
      return clients.filter((client) => client.user_id === currentUser.id);
    }

    return clients;
  }, [clients, currentUser.id, isClient]);
  const [selectedClientId, setSelectedClientId] = useState<number | ''>('');
  const [palletCount, setPalletCount] = useState(1);
  const [locationEntries, setLocationEntries] = useState<LocationEntryState[]>([
    { mode: null, details: '', warehouseIndex: null },
  ]);
  const [directPickup, setDirectPickup] = useState(true);
  const [pickupDate, setPickupDate] = useState('');
  const [comment, setComment] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (roleClients.length === 0) {
      setSelectedClientId('');
      return;
    }

    setSelectedClientId((previousValue) => {
      if (previousValue && roleClients.some((client) => client.user_id === previousValue)) {
        return previousValue;
      }

      return roleClients[0].user_id;
    });
  }, [roleClients]);

  useEffect(() => {
    setLocationEntries((current) =>
      Array.from(
        { length: palletCount },
        (_, index) => current[index] || { mode: null, details: '', warehouseIndex: null }
      )
    );
  }, [palletCount]);

  const selectedClient =
    roleClients.find((client) => client.user_id === selectedClientId) || null;
  const warehouseAddresses = useMemo(() => {
    const addresses = selectedClient?.warehouse_addresses?.filter((address) => Boolean(address?.trim())) || [];

    return addresses.length > 0 ? addresses : [copy.warehouseFallback];
  }, [copy.warehouseFallback, selectedClient?.warehouse_addresses]);

  useEffect(() => {
    setLocationEntries((current) =>
      current.map((entry) =>
        entry.mode === 'warehouse' ? { ...entry, warehouseIndex: null } : entry
      )
    );
  }, [selectedClientId]);

  const formatPickupDate = (value: string) => {
    if (!value) {
      return '';
    }

    return formatAppDate(new Date(`${value}T00:00:00`), language);
  };

  const resolveEntryLocation = (entry: LocationEntryState) => {
    const details = entry.details.trim();

    if (entry.mode === 'other' && details) {
      return details;
    }

    if (entry.mode === 'warehouse') {
      return warehouseAddresses[entry.warehouseIndex ?? 0] || copy.warehouseFallback;
    }

    return copy.otherLocationFallback;
  };

  const updateLocationEntry = (
    index: number,
    patch: Partial<LocationEntryState>
  ) => {
    setLocationEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry
      )
    );
  };

  const hasInvalidLocation = locationEntries.some(
    (entry) =>
      !entry.mode ||
      (entry.mode === 'warehouse' && entry.warehouseIndex === null) ||
      (entry.mode === 'other' && !entry.details.trim())
  );
  const isSubmitDisabled =
    !selectedClient ||
    (!directPickup && !pickupDate) ||
    hasInvalidLocation;

  const handleSubmit = async () => {
    if (!selectedClient || isSubmitDisabled) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const pickupSummary = directPickup
      ? copy.pickupDirectSummary
      : `${copy.pickupDateSummary}: ${formatPickupDate(pickupDate)}`;
    const sharedNote = [
      copy.sourceLabel,
      `${copy.pickupLabel}: ${pickupSummary}`,
      comment.trim() ? `${copy.commentLabel}: ${comment.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');
    const entries = locationEntries.map((entry, index) => ({
      location: resolveEntryLocation(entry),
      note: [
        `${copy.entryLabel} ${index + 1}`,
        entry.mode === 'warehouse' ? copy.ownWarehouse : copy.otherLocation,
      ].join(' | '),
      delivery_location: entry.deliveryLocation,
    }));

    try {
      await reportGhostPallets(palletCount, selectedClient.user_id, selectedClient.name, {
        location: entries[0]?.location,
        note: sharedNote,
        entries,
        image: image || undefined,
      });
      await appAlert.fire({
        icon: 'success',
        title: copy.reportSuccessTitle,
        text: copy.reportSuccessText,
      });
      onSubmitted?.(selectedClient.name, palletCount);
      onClose();
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : copy.reportErrorText;
      setSubmitError(message);
      await appAlert.fire({
        icon: 'error',
        title: copy.reportErrorTitle,
        text: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DriverModalShell
      onClose={onClose}
      title={copy.eyebrow}
      subtitle={copy.title}
      width="lg"
      overlayClassName="z-[110]"
      bodyClassName="bg-zinc-50/80 dark:bg-[#070b0a]"
      footer={
        <div className="bg-white px-5 py-4 dark:bg-[#0f1513]">
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitDisabled || isSubmitting}
          >
            <Send size={15} className="mr-2" />
            {isSubmitting ? 'Saving…' : copy.sendLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 px-5 py-5">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-[#9fcbb3]">
            {copy.companyLabel}
          </label>
          {isClient ? (
            <Input value={selectedClient?.name || currentUser.name} readOnly className="bg-white dark:bg-[#151d1a]" />
          ) : (
            <Select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(Number(event.target.value))}
            >
              {roleClients.map((client: ClientDetail) => (
                <option key={client.id} value={client.user_id}>
                  {client.name}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-[#9fcbb3]">
            Photo (optional)
          </label>
          {imagePreview ? (
            <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-[#151d1a]">
              <img src={imagePreview} alt="No QR pallet" className="h-40 w-full rounded-xl object-cover" />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(imagePreview);
                  setImagePreview(null);
                  setImage(null);
                }}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl bg-black/65 text-white"
                aria-label="Remove photo"
              >
                <X size={15} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-5 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-600 dark:border-white/15 dark:bg-[#151d1a] dark:text-zinc-200">
              <Camera size={16} />
              Take photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={async (event) => {
                  const nextImage = event.target.files?.[0];
                  event.target.value = '';
                  if (!nextImage) return;
                  try {
                    const compressed = await compressPhotoForUpload(nextImage);
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImage(compressed);
                    setImagePreview(URL.createObjectURL(compressed));
                  } catch (error) {
                    setSubmitError(error instanceof Error ? error.message : copy.reportErrorText);
                  }
                }}
              />
            </label>
          )}
          <p className="text-[10px] font-bold leading-4 text-zinc-400">The photo is saved in the database when you send this report.</p>
        </div>

        {submitError && <p className="text-sm font-semibold text-rose-600">{submitError}</p>}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-[#9fcbb3]">
            {copy.countLabel}
          </label>
          <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/10 dark:bg-[#101715]">
            <button
              type="button"
              onClick={() => setPalletCount((current) => Math.max(1, current - 1))}
              className="flex h-14 items-center justify-center border-r border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Minus size={18} />
            </button>
            <div className="flex h-14 items-center justify-center text-lg font-black tracking-tight text-zinc-950 dark:text-white">
              {palletCount}
            </div>
            <button
              type="button"
              onClick={() => setPalletCount((current) => current + 1)}
              className="flex h-14 items-center justify-center border-l border-zinc-200 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-[#9fcbb3]">
            {copy.locationsLabel}
          </label>

          <div className="space-y-3">
            {locationEntries.map((entry, index) => (
              <div
                key={`no-qr-location-${index}`}
                className="rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#101715]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-[#151d1a] dark:text-emerald-100">
                    <MapPin size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-zinc-950 dark:text-white">
                      {copy.entryLabel} {index + 1}
                    </p>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-zinc-500 dark:text-[#cce0d3]">
                      {entry.mode
                        ? entry.mode === 'warehouse'
                          ? copy.chooseWarehouse
                          : copy.locationLabel
                        : copy.chooseLocationType}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => updateLocationEntry(index, { mode: 'warehouse', details: '', warehouseIndex: null })}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                      entry.mode === 'warehouse'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100'
                        : 'border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-[#151d1a] dark:text-zinc-300'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                        entry.mode === 'warehouse'
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-zinc-300 bg-transparent dark:border-zinc-500'
                      )}
                    >
                      {entry.mode === 'warehouse' && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                      <Building2 size={14} className="shrink-0" />
                      {copy.ownWarehouse}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateLocationEntry(index, { mode: 'other', warehouseIndex: null })}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                      entry.mode === 'other'
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100'
                        : 'border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-[#151d1a] dark:text-zinc-300'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                        entry.mode === 'other'
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-zinc-300 bg-transparent dark:border-zinc-500'
                      )}
                    >
                      {entry.mode === 'other' && <span className="h-2 w-2 rounded-full bg-white" />}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                      <MapPin size={14} className="shrink-0" />
                      {copy.otherLocation}
                    </span>
                  </button>
                </div>

                {entry.mode === 'warehouse' && (
                  <div className="mt-3 space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-[#9fcbb3]">
                      {copy.chooseWarehouse}
                    </label>
                    <div className="space-y-2">
                      {warehouseAddresses.map((address, warehouseIndex) => (
                        <button
                          key={`no-qr-warehouse-${index}-${warehouseIndex}`}
                          type="button"
                          onClick={() => updateLocationEntry(index, { warehouseIndex })}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                            entry.warehouseIndex === warehouseIndex
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100'
                              : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-[#151d1a] dark:text-zinc-300'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                              entry.warehouseIndex === warehouseIndex
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-zinc-300 bg-transparent dark:border-zinc-500'
                            )}
                          >
                            {entry.warehouseIndex === warehouseIndex && <span className="h-2 w-2 rounded-full bg-white" />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black uppercase tracking-[0.12em]">
                              {copy.ownWarehouse} {warehouseIndex + 1}
                            </span>
                            <span className="mt-1 block truncate text-[11px] font-bold normal-case tracking-normal">
                              {address}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {entry.mode === 'other' && (
                  <div className="mt-3 space-y-3">
                    <DeliveryLocationMap
                      language={language}
                      initialLocationIsSaved={false}
                      onLocationSelected={(data) => {
                        const streetLine = [data.street, data.house_number].filter(Boolean).join(' ');
                        const localityLine = [data.postal_code, data.city].filter(Boolean).join(' ');
                        const location = [streetLine, localityLine].filter(Boolean).join(', ') || `${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;
                        updateLocationEntry(index, { details: location, deliveryLocation: data });
                      }}
                    />
                    <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-300">{entry.details || copy.locationPlaceholder}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-[#9fcbb3]">
            {copy.pickupLabel}
          </label>

          <button
            type="button"
            onClick={() =>
              setDirectPickup((current) => {
                const nextValue = !current;
                if (nextValue) {
                  setPickupDate('');
                }
                return nextValue;
              })
            }
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
              directPickup
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100'
                : 'border-zinc-200 bg-white text-zinc-600 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-300'
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                directPickup
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-zinc-300 dark:border-zinc-500'
              )}
            >
              {directPickup && <span className="h-2.5 w-2.5 rounded-sm bg-white" />}
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.12em]">
              {copy.directPickup}
            </span>
          </button>

          {!directPickup && (
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-[#9fcbb3]">
                {copy.pickupDateLabel}
              </label>
              <div className="relative">
                <FlatpickrDateInput
                  value={pickupDate}
                  onChange={setPickupDate}
                  language={language}
                  placeholder={copy.pickupDatePlaceholder}
                  ariaLabel={copy.pickupDatePlaceholder}
                  className="bg-white pr-11 dark:bg-[#151d1a]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-[#9fcbb3]">
            {copy.commentLabel}
          </label>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={copy.commentPlaceholder}
            className="min-h-28 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[12px] font-bold text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:border-[#00A655] dark:border-white/10 dark:bg-[#151d1a] dark:text-white dark:placeholder:text-zinc-500"
          />
        </div>
      </div>
    </DriverModalShell>
  );
};

export const getNoQrReturnButtonCopy = (language: 'en' | 'nl' | 'bs') =>
  copyByLanguage[language] || copyByLanguage.en;
