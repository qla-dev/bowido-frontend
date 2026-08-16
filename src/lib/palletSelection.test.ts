import { describe, expect, it } from "vitest";
import type { Pallet } from "../types";
import { resolveSelectedPallet } from "./palletSelection";

const makePallet = (id: number, statusName: string): Pallet =>
  ({
    id,
    current_status_name: statusName,
  }) as Pallet;

describe("resolveSelectedPallet", () => {
  it("retains a freshly scanned pallet when restricted polling omits it", () => {
    const scannedPallet = makePallet(1013, "Bij de klant");

    expect(resolveSelectedPallet([], 1013, scannedPallet)).toBe(scannedPallet);
  });

  it("prefers refreshed server data after the pallet becomes visible", () => {
    const scannedPallet = makePallet(1013, "Bij de klant");
    const claimedPallet = makePallet(1013, "Ophalen klant");

    expect(
      resolveSelectedPallet([claimedPallet], 1013, scannedPallet),
    ).toBe(claimedPallet);
  });

  it("does not use a snapshot belonging to another selection", () => {
    expect(resolveSelectedPallet([], 2020, makePallet(1013, "Bij de klant"))).toBeNull();
  });
});
