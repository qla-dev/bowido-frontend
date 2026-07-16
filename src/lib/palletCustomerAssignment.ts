import type { PalletStatus } from '../types';

export const CUSTOMER_ASSIGNABLE_STATUS_SLUGS = new Set(['bij-de-klant', 'ophalen-klant']);

export const statusAllowsCustomer = (status?: Pick<PalletStatus, 'slug'> | null) =>
  Boolean(status?.slug && CUSTOMER_ASSIGNABLE_STATUS_SLUGS.has(status.slug));

export const statusIdAllowsCustomer = (statuses: PalletStatus[], statusId?: number) =>
  statusAllowsCustomer(statuses.find(status => status.id === statusId));
