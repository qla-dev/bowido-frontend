import { Pallet } from '../types';

export const normalizeQrCodeForStorage = (value?: string | null) => {
  const trimmedValue = (value || '').trim();

  if (/^https?:\/\//i.test(trimmedValue)) {
    return trimmedValue.replace(/\s+/g, '');
  }

  return trimmedValue.replace(/\s+/g, '').toUpperCase();
};

const normalizeQrValue = (value?: string | null) =>
  (value || '').trim().replace(/\s+/g, '').toUpperCase();

const getUrlCandidates = (value?: string | null) => {
  const trimmedValue = (value || '').trim();

  if (!/^https?:\/\//i.test(trimmedValue)) {
    return [];
  }

  try {
    const url = new URL(trimmedValue);
    url.protocol = url.protocol.toLowerCase();
    url.hostname = url.hostname.toLowerCase();
    url.hash = '';

    const fullUrl = url.toString().replace(/\/+$/, '');
    url.search = '';

    return [fullUrl, url.toString().replace(/\/+$/, '')];
  } catch {
    return [trimmedValue.replace(/\s+/g, '').replace(/\/+$/, '')];
  }
};

const getBaseQrValue = (value?: string | null) => normalizeQrValue(value).split(';')[0] || '';

const addQrCandidates = (candidates: Set<string>, value?: string | null) => {
  const normalizedValue = normalizeQrValue(value);
  const normalizedBase = getBaseQrValue(value);

  [normalizedValue, normalizedBase, ...getUrlCandidates(value)].forEach((candidate) => {
    if (candidate && candidate.length >= 3) {
      candidates.add(candidate);
    }
  });
};

export const getPalletQrCandidates = (pallet: Pallet) => {
  const candidates = new Set<string>();

  addQrCandidates(candidates, pallet.qr_code);
  addQrCandidates(candidates, pallet.pallet_name);
  addQrCandidates(candidates, pallet.reference_code);

  return Array.from(candidates);
};

export const findPalletByScannedQr = (rawValue: string, pallets: Pallet[]) => {
  const scannedCandidates = new Set<string>();
  addQrCandidates(scannedCandidates, rawValue);

  if (scannedCandidates.size === 0) {
    return null;
  }

  const scannedValues = Array.from(scannedCandidates);

  return (
    pallets.find((pallet) =>
      getPalletQrCandidates(pallet).some((candidate) =>
        scannedValues.some((scannedValue) =>
          scannedValue === candidate ||
          scannedValue.includes(candidate) ||
          candidate.includes(scannedValue)
        )
      )
    ) || null
  );
};
