import React, { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, Minus, Plus, Send } from 'lucide-react';
import { useApp } from '../AppContext';
import { ClientDetail, RoleType, User } from '../types';
import { Button, Input, Select, cn } from './ui';
import { DriverModalShell } from './DriverModalShell';
import { formatAppDate } from '../lib/dateFormat';
import { FlatpickrDateInput } from './FlatpickrDateInput';

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

  const handleSubmit = () => {
    if (!selectedClient || isSubmitDisabled) {
      return;
    }

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
    }));

    reportGhostPallets(palletCount, selectedClient.user_id, selectedClient.name, {
      location: entries[0]?.location,
      note: sharedNote,
      entries,
    });
    onSubmitted?.(selectedClient.name, palletCount);
    onClose();
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
            disabled={isSubmitDisabled}
          >
            <Send size={15} className="mr-2" />
            {copy.sendLabel}
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
                  <div className="mt-3 space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400 dark:text-[#9fcbb3]">
                      {copy.locationLabel}
                    </label>
                    <Input
                      value={entry.details}
                      onChange={(event) => updateLocationEntry(index, { details: event.target.value })}
                      placeholder={copy.locationPlaceholder}
                      className="bg-zinc-50 normal-case tracking-normal dark:bg-[#151d1a]"
                    />
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
