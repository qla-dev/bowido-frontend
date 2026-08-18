import { describe, expect, it } from "vitest";
import type { Pallet } from "../types";
import { mergeLivePalletIntoDraft } from "./livePalletDraft";

const pallet = (overrides: Partial<Pallet> = {}): Pallet => ({
  id: 21,
  qr_code: "BOWNL-0021",
  current_status_id: 2,
  current_status_name: "Bowido BiH",
  current_location: "Nikole Tesle 71",
  type: "Blauw L120",
  has_qr_code: true,
  is_ghost: false,
  is_for_repair: false,
  is_active: true,
  last_status_changed_at: "2026-08-18T09:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

describe("mergeLivePalletIntoDraft", () => {
  it("updates every untouched field from the live pallet", () => {
    const baseline = pallet();
    const live = pallet({
      current_status_id: 6,
      current_status_name: "Transport BiH/NL",
      current_location: "Na putu",
      last_status_changed_at: "2026-08-18T09:39:00Z",
    });

    expect(mergeLivePalletIntoDraft(baseline, baseline, live)).toMatchObject(live);
  });

  it("preserves locally edited fields while refreshing the rest", () => {
    const baseline = pallet();
    const draft = pallet({ note: "Unsaved desktop note" });
    const live = pallet({
      current_status_id: 6,
      current_status_name: "Transport BiH/NL",
      current_location: "Na putu",
      note: "Mobile note",
    });
    const merged = mergeLivePalletIntoDraft(draft, baseline, live);

    expect(merged.current_status_name).toBe("Transport BiH/NL");
    expect(merged.current_location).toBe("Na putu");
    expect(merged.note).toBe("Unsaved desktop note");
  });
});
