import { Pallet } from '../types';

export const getPalletDisplayName = (
  pallet?: Pick<Pallet, 'pallet_name' | 'reference_code' | 'qr_code'> | null
) => pallet?.pallet_name || pallet?.reference_code || pallet?.qr_code || '';
