import { describe, expect, it } from 'vitest';
import {
  statusIdAllowsCustomer,
  statusIdIsAtCustomer,
} from './palletCustomerAssignment';
import type { PalletStatus } from '../types';

const statuses = [
  { id: 4, slug: 'bij-de-klant' },
  { id: 5, slug: 'ophalen-klant' },
] as PalletStatus[];

describe('pallet customer assignment statuses', () => {
  it('distinguishes a new at-customer period from customer pickup', () => {
    expect(statusIdIsAtCustomer(statuses, 4)).toBe(true);
    expect(statusIdIsAtCustomer(statuses, 5)).toBe(false);
  });

  it('keeps both statuses eligible for a client assignment', () => {
    expect(statusIdAllowsCustomer(statuses, 4)).toBe(true);
    expect(statusIdAllowsCustomer(statuses, 5)).toBe(true);
  });
});
