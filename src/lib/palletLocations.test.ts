import { describe, expect, it } from "vitest";
import type { ClientDetail } from "../types";
import { hasClientWarehouseOneAddress } from "./palletLocations";

const client = (overrides: Partial<ClientDetail>): ClientDetail => ({
  id: 1,
  user_id: 1,
  name: "Test client",
  country: "NL",
  warehouse_addresses: [],
  grace_period_days: 14,
  price_per_day: 2,
  is_active: true,
  ...overrides,
});

describe("hasClientWarehouseOneAddress", () => {
  it("does not treat Warehouse 2 as Warehouse 1", () => {
    expect(hasClientWarehouseOneAddress(client({
      warehouse2_street: "Second warehouse street",
      warehouse2_city: "Dordrecht",
      warehouse_addresses: ["Second warehouse street, Dordrecht"],
    }))).toBe(false);
  });

  it("recognizes a structured Warehouse 1 address", () => {
    expect(hasClientWarehouseOneAddress(client({
      warehouse1_street: "First warehouse street",
      warehouse1_city: "Dordrecht",
    }))).toBe(true);
  });

  it("keeps the primary address available for legacy clients", () => {
    expect(hasClientWarehouseOneAddress(client({
      warehouse_addresses: ["Legacy warehouse address"],
    }))).toBe(true);
  });
});
