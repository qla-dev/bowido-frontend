import type { Pallet } from "../types";

const valuesEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

/**
 * Applies server changes to an open pallet editor without overwriting fields
 * the user has changed locally since the editor was opened.
 */
export const mergeLivePalletIntoDraft = (
  draft: Pallet,
  baseline: Pallet,
  live: Pallet,
): Pallet => {
  const next = { ...draft } as Record<string, unknown>;
  const draftRecord = draft as unknown as Record<string, unknown>;
  const baselineRecord = baseline as unknown as Record<string, unknown>;
  const liveRecord = live as unknown as Record<string, unknown>;

  Object.keys(liveRecord).forEach((key) => {
    if (valuesEqual(draftRecord[key], baselineRecord[key])) {
      next[key] = liveRecord[key];
    }
  });

  return next as unknown as Pallet;
};
