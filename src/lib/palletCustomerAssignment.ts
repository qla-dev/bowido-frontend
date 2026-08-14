import type { PalletStatus } from '../types';

export const AT_CUSTOMER_STATUS_SLUGS = new Set([
  'bij-de-klant',
  // Kept while older cached/API records are being normalized.
  'at_customer',
  'bij_de_klant',
]);

export const CUSTOMER_ASSIGNABLE_STATUS_SLUGS = new Set([
  ...AT_CUSTOMER_STATUS_SLUGS,
  'ophalen-klant',
  'pending_return',
]);

export const statusIsAtCustomer = (status?: Pick<PalletStatus, 'slug'> | null) =>
  Boolean(status?.slug && AT_CUSTOMER_STATUS_SLUGS.has(status.slug));

export const statusAllowsCustomer = (status?: Pick<PalletStatus, 'slug'> | null) =>
  Boolean(status?.slug && CUSTOMER_ASSIGNABLE_STATUS_SLUGS.has(status.slug));

export const statusIdIsAtCustomer = (statuses: PalletStatus[], statusId?: number) =>
  statusIsAtCustomer(statuses.find(status => status.id === statusId));

export const statusIdAllowsCustomer = (statuses: PalletStatus[], statusId?: number) =>
  statusAllowsCustomer(statuses.find(status => status.id === statusId));
