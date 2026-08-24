import { describe, expect, it } from 'vitest';
import type { ClientDetail, Pallet, PalletStatus } from '../types';
import { getClientPalletTimeline } from './clientPalletTimeline';

const client = {
  id: 1,
  user_id: 10,
  name: 'Client',
  country: 'NL',
  warehouse_addresses: [],
  grace_period_days: 10,
  price_per_day: 2,
  is_active: true,
} satisfies ClientDetail;

const status = {
  id: 4,
  name: 'Bij de klant',
  slug: 'bij-de-klant',
  is_active: true,
  is_billable: true,
  grace_period_days: 5,
  price_per_day: 1,
} satisfies PalletStatus;

const pallet = {
  id: 1,
  qr_code: 'PAL-1',
  current_status_id: 4,
  current_status_name: 'Bij de klant',
  current_status_slug: 'bij-de-klant',
  user_id: 10,
  type: 'EURO',
  current_location: 'Client',
  has_qr_code: true,
  is_ghost: false,
  is_for_repair: false,
  is_active: true,
  last_status_changed_at: '2026-07-10T15:00:00Z',
  customer_timer_started_at: '2026-07-10T15:00:00Z',
  created_at: '2026-07-10T15:00:00Z',
} satisfies Pallet;

describe('client pallet timeline', () => {
  it('uses the customer timer and client billing values for mobile and desktop', () => {
    const result = getClientPalletTimeline({
      pallet,
      status,
      client,
      language: 'nl',
      now: new Date(2026, 6, 30),
      formatDate: (value) => `${value.getDate()}-${value.getMonth() + 1}`,
    });

    expect(result.sentLabel).toBe('10-7');
    expect(result.returnLabel).toBe('20-7');
    expect(result.deadlineLabel).toBe('10 dagen te laat');
    expect(result.overdueDays).toBe(10);
    expect(result.cost).toBe(20);
  });

  it('respects pallet grace overrides and a frozen customer timer', () => {
    const result = getClientPalletTimeline({
      pallet: {
        ...pallet,
        grace_days: 3,
        customer_timer_frozen_at: '2026-07-15T08:00:00Z',
      },
      status,
      client,
      language: 'en',
      now: new Date(2026, 7, 20),
      formatDate: (value) => `${value.getDate()}-${value.getMonth() + 1}`,
    });

    expect(result.deadlineLabel).toBe('2 days late - frozen');
    expect(result.cost).toBe(4);
  });
});
