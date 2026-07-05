import { Pallet } from '../types';

const normalizeQrValue = (value?: string | null) =>
  (value || '').trim().replace(/\s+/g, '').toUpperCase();

const getBaseQrValue = (value?: string | null) => normalizeQrValue(value).split(';')[0] || '';

export const getPalletQrCandidates = (pallet: Pallet) => {
  const candidates = new Set<string>();
  const qrCode = normalizeQrValue(pallet.qr_code);
  const palletName = normalizeQrValue(pallet.pallet_name);
  const qrBase = getBaseQrValue(pallet.qr_code);
  const nameBase = getBaseQrValue(pallet.pallet_name);

  [qrCode, palletName, qrBase, nameBase].forEach((candidate) => {
    if (candidate) {
      candidates.add(candidate);
    }
  });

  return Array.from(candidates).filter((candidate) => candidate.length >= 3);
};

export const findPalletByScannedQr = (rawValue: string, pallets: Pallet[]) => {
  const normalized = normalizeQrValue(rawValue);
  const normalizedBase = getBaseQrValue(rawValue);

  if (!normalized) {
    return null;
  }

  return (
    pallets.find((pallet) =>
      getPalletQrCandidates(pallet).some((candidate) =>
        normalized === candidate ||
        normalizedBase === candidate ||
        normalized.includes(candidate) ||
        candidate.includes(normalized)
      )
    ) || null
  );
};
