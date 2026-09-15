import type { PalletStatus } from '../types';

// Presentation-only order for status selectors. It leaves backend IDs and
// sort-order values untouched while following the operational pallet flow.
const STATUS_RANK_BY_SLUG: Record<string, number> = {
  'bij-de-klant': 0,
  at_customer: 0,
  'ophalen-klant': 1,
  pending_return: 1,
  'bih-nl-transport': 2,
  transport_bih_nl: 2,
  'nl-bih-transport': 3,
  transport_nl_bih: 3,
  'bowido-nl': 4,
  bowido_nl: 4,
  'bowido-bih': 5,
  bowido_warehouse: 5,
  onbekend: 6,
  unknown: 6,
  'bih-drugo': Number.MAX_SAFE_INTEGER,
};

export const orderStatusesForDisplay = (statuses: PalletStatus[]): PalletStatus[] =>
  statuses
    .map((status, index) => ({ status, index }))
    .sort((left, right) => {
      const leftRank = STATUS_RANK_BY_SLUG[left.status.slug] ?? 100;
      const rightRank = STATUS_RANK_BY_SLUG[right.status.slug] ?? 100;

      return leftRank - rightRank || left.index - right.index;
    })
    .map(({ status }) => status);
