import { describe, expect, it } from "vitest";
import {
  formatAppDate,
  formatAppDateTime,
  formatAppMonthYear,
  MONTH_NAMES,
  WEEKDAY_LABELS_MONDAY_FIRST,
} from "../lib/dateFormat";

describe("global date formatting", () => {
  const date = new Date(2026, 6, 2, 9, 5);

  it("formats Bosnian dates as dd.mm.yyyy.", () => {
    expect(formatAppDate(date, "bs")).toBe("02.07.2026.");
    expect(formatAppDateTime(date, "bs")).toBe("02.07.2026. 09:05");
  });

  it("formats Dutch dates as dd-mm-yyyy", () => {
    expect(formatAppDate(date, "nl")).toBe("02-07-2026");
    expect(formatAppDateTime(date, "nl")).toBe("02-07-2026 09:05");
  });

  it("provides shared localized month and weekday arrays", () => {
    expect(MONTH_NAMES.bs[6]).toBe("juli");
    expect(MONTH_NAMES.nl[2]).toBe("maart");
    expect(WEEKDAY_LABELS_MONDAY_FIRST.bs[3]).toBe("Čet");
    expect(formatAppMonthYear(2026, 6, "nl")).toBe("juli 2026");
  });
});

