import { useEffect } from "react";
import { useApp } from "../AppContext";
import type { Pallet } from "../types";

/** Registers an open pallet with the shared poll and resolves its latest value. */
export const useLivePallet = (palletId: number | null): Pallet | null => {
  const { pallets, watchPallet } = useApp();

  useEffect(() => {
    if (palletId === null) {
      return;
    }
    return watchPallet(palletId);
  }, [palletId, watchPallet]);

  return palletId === null
    ? null
    : pallets.find((pallet) => pallet.id === palletId) || null;
};
