import { describe, expect, it } from "vitest";
import {
  formatInvoiceItemDescription,
  formatServiceReportDescription,
  formatSystemNote,
  getLocationLabel,
  getStatusLabel,
} from "../i18n";

describe("location translations", () => {
  it("translates the canonical transport location", () => {
    expect(getLocationLabel("Na putu", "bs")).toBe("Na putu");
    expect(getLocationLabel("Na putu", "nl")).toBe("Onderweg");
    expect(getLocationLabel("Na putu", "en")).toBe("In transport");
  });
});

describe("driver status translations", () => {
  it("translates customer pickup and repair statuses", () => {
    expect(getStatusLabel("Voor retour", "en")).toBe("Ready for Return");
    expect(getStatusLabel("Voor retour", "nl")).toBe("Voor retour");
    expect(getStatusLabel("Voor retour", "bs")).toBe(
      "Za povrat",
    );
    expect(getStatusLabel("Voor reparatie", "en")).toBe("For repair");
    expect(getStatusLabel("Voor reparatie", "nl")).toBe("Voor reparatie");
    expect(getStatusLabel("Voor reparatie", "bs")).toBe("Za popravku");
  });
});

describe("system note translations", () => {
  it("renders saved no-QR note labels in the viewer's language", () => {
    const bosnianNote = "Poslano preko mobilne no-QR forme | Lokacija 1 | Vlastiti magacin | Dostupno za preuzimanje: Odmah preuzeti | Komentar: Leave at the gate";

    expect(formatSystemNote(bosnianNote, "en")).toBe(
      "Submitted from mobile no-QR form | Location 1 | Own warehouse | Available for pickup: Direct pickup | Comment: Leave at the gate",
    );
    expect(formatSystemNote(bosnianNote, "nl")).toBe(
      "Verstuurd via mobiel formulier zonder QR | Locatie 1 | Eigen magazijn | Beschikbaar voor het ophalen: Direct ophalen | Commentaar: Leave at the gate",
    );
  });

  it("translates the saved no-QR pairing annotation in every viewer language", () => {
    const pairedNote = "Comment: Leave at the gate (Paired from a pallet without a QR code on 17-08-2026)";

    expect(formatSystemNote(pairedNote, "nl")).toBe(
      "Commentaar: Leave at the gate (Gekoppeld vanuit een bok zonder QR-code op 17-08-2026)",
    );
    expect(formatSystemNote(pairedNote, "bs")).toBe(
      "Komentar: Leave at the gate (Upareno s paletom bez QR koda dana 17-08-2026)",
    );
  });
});

describe("invoice item translations", () => {
  it("renders stored generated invoice descriptions in the selected language", () => {
    expect(formatInvoiceItemDescription("Storage billing for pallet BOW-001", "nl")).toBe(
      "Opslagfacturatie voor pallet BOW-001",
    );
    expect(formatInvoiceItemDescription("Storage billing for pallet BOW-001", "bs")).toBe(
      "Obračun skladištenja za paletu BOW-001",
    );
    expect(formatInvoiceItemDescription("Custom line item", "nl")).toBe("Custom line item");
  });
});

describe("service report translations", () => {
  it("renders generated driver report descriptions in the viewer's language", () => {
    expect(
      formatServiceReportDescription("Driver marked pallet in Bowido warehouse.", "nl"),
    ).toBe("Chauffeur heeft de bok gemarkeerd als in Bowido-magazijn.");
    expect(
      formatServiceReportDescription("Driver marked pallet in transport.", "bs"),
    ).toBe("Vozač je označio paletu kao u transportu.");
    expect(formatServiceReportDescription("Custom service note", "bs")).toBe(
      "Custom service note",
    );
  });

  it("translates every generated note in a multi-line description while preserving manual notes", () => {
    expect(
      formatServiceReportDescription(
        "Bowido Admin admitted pallet to service.\nBowido Admin je uklonio paletu iz servisa.\nDriver marked pallet in repair.\nManual damage note",
        "nl",
      ),
    ).toBe(
      "Bowido Admin heeft de bok aangemeld voor service.\nBowido Admin heeft de bok uit service verwijderd.\nChauffeur heeft de bok gemarkeerd voor reparatie.\nManual damage note",
    );
  });

  it("renders role-based pallet status notes in the viewer's language", () => {
    expect(
      formatServiceReportDescription("Customer marked pallet as Ready for Return.", "nl"),
    ).toBe("Klant heeft de bok gemarkeerd als Voor retour.");
    expect(
      formatServiceReportDescription("Warehouse employee marked pallet as At client.", "bs"),
    ).toBe("Magacinski radnik je označio paletu kao Kod klijenta.");
  });

  it("also formats no-QR system notes shown in pallet comment views", () => {
    expect(
      formatServiceReportDescription("Comment: Leave at the gate", "nl"),
    ).toBe("Commentaar: Leave at the gate");
  });
});
