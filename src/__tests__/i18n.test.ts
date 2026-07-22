import { describe, expect, it } from "vitest";
import { getLocationLabel, getStatusLabel } from "../i18n";

describe("location translations", () => {
  it("translates the canonical transport location", () => {
    expect(getLocationLabel("Na putu", "bs")).toBe("Na putu");
    expect(getLocationLabel("Na putu", "nl")).toBe("Onderweg");
    expect(getLocationLabel("Na putu", "en")).toBe("In transport");
  });
});

describe("driver status translations", () => {
  it("translates customer pickup and repair statuses", () => {
    expect(getStatusLabel("Ophalen klant", "en")).toBe("Customer pickup");
    expect(getStatusLabel("Ophalen klant", "nl")).toBe("Ophalen klant");
    expect(getStatusLabel("Ophalen klant", "bs")).toBe(
      "Za preuzimanje kod klijenta",
    );
    expect(getStatusLabel("Voor reparatie", "en")).toBe("For repair");
    expect(getStatusLabel("Voor reparatie", "nl")).toBe("Voor reparatie");
    expect(getStatusLabel("Voor reparatie", "bs")).toBe("Za popravku");
  });
});
