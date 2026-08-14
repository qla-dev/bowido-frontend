import type { Pallet } from "../types";

export const resolveSelectedPallet = (
  pallets: Pallet[],
  selectedPalletId: number | null,
  selectedPalletSnapshot: Pallet | null,
): Pallet | null => {
  if (selectedPalletId === null) {
    return null;
  }

  return (
    pallets.find((pallet) => pallet.id === selectedPalletId) ||
    (selectedPalletSnapshot?.id === selectedPalletId
      ? selectedPalletSnapshot
      : null)
  );
};
