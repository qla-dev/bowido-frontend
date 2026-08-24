import type { AppLanguage } from '../i18n';
import type { ClientDetail, Pallet, PalletStatus } from '../types';

export type PalletTimelineTone = 'muted' | 'success' | 'warning' | 'danger';

export type ClientPalletTimeline = {
  sentAt: Date | null;
  sentLabel: string;
  returnAt: Date | null;
  returnLabel: string;
  deadlineLabel: string;
  deadlineTone: PalletTimelineTone;
  daysOutside: number;
  overdueDays: number;
  cost: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const atMidnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const getClientPalletTimeline = ({
  pallet,
  status,
  client,
  language,
  formatDate,
  now = new Date(),
}: {
  pallet: Pallet;
  status?: PalletStatus;
  client?: ClientDetail;
  language: AppLanguage;
  formatDate: (value: Date) => string;
  now?: Date;
}): ClientPalletTimeline => {
  const statusSlug = pallet.current_status_slug || status?.slug || '';
  const usesCustomerTimer = ['bij-de-klant', 'at_customer', 'at-client', 'ophalen-klant', 'pending_return'].includes(statusSlug)
    || [4, 5].includes(pallet.current_status_id);
  const sourceDate = usesCustomerTimer
    ? pallet.customer_timer_started_at || pallet.last_status_changed_at
    : pallet.last_status_changed_at;
  const parsedSentAt = new Date(sourceDate);
  const isWarehouseStatus =
    ['bowido-nl', 'bowido-bih', 'bowido_warehouse', 'bowido_nl'].includes(statusSlug)
    || [1, 3].includes(pallet.current_status_id);
  const sentAt = !Number.isNaN(parsedSentAt.getTime()) && !isWarehouseStatus
    ? parsedSentAt
    : null;

  const transportStatus =
    ['bih-nl-transport', 'nl-bih-transport', 'transport', 'transport_bih_nl', 'transport_nl_bih'].includes(statusSlug)
    || [2, 6].includes(pallet.current_status_id);
  const frozenAt = usesCustomerTimer && pallet.customer_timer_frozen_at
    ? new Date(pallet.customer_timer_frozen_at)
    : null;
  const effectiveToday = frozenAt && !Number.isNaN(frozenAt.getTime()) ? frozenAt : now;
  const daysOutside = sentAt
    ? Math.max(0, Math.floor((atMidnight(effectiveToday).getTime() - atMidnight(sentAt).getTime()) / MS_PER_DAY))
    : 0;
  const graceDays = transportStatus
    ? pallet.grace_days ?? status?.grace_period_days ?? 3
    : status?.is_billable || Boolean(frozenAt)
      ? pallet.grace_days ?? client?.grace_period_days ?? status?.grace_period_days ?? 0
      : 0;
  const returnAt = sentAt && graceDays > 0 ? atMidnight(sentAt) : null;
  returnAt?.setDate(returnAt.getDate() + graceDays);
  const remainingDays = returnAt ? graceDays - daysOutside : null;
  const overdueDays = remainingDays === null ? 0 : Math.max(-remainingDays, 0);
  const frozenSuffix = frozenAt
    ? ` - ${language === 'bs' ? 'zaustavljeno' : language === 'nl' ? 'bevroren' : 'frozen'}`
    : '';
  const deadlineLabel = remainingDays === null
    ? '-'
    : remainingDays < 0
      ? `${Math.abs(remainingDays)} ${language === 'bs' ? 'dana kasni' : language === 'nl' ? 'dagen te laat' : 'days late'}${frozenSuffix}`
      : `${remainingDays} ${language === 'bs' ? 'dana u roku' : language === 'nl' ? 'dagen resterend' : 'days left'}${frozenSuffix}`;

  return {
    sentAt,
    sentLabel: sentAt ? formatDate(sentAt) : '-',
    returnAt,
    returnLabel: returnAt ? formatDate(returnAt) : '-',
    deadlineLabel,
    deadlineTone: remainingDays === null
      ? 'muted'
      : remainingDays < 0
        ? 'danger'
        : remainingDays <= 2
          ? 'warning'
          : 'success',
    daysOutside,
    overdueDays,
    cost: overdueDays * (client?.price_per_day ?? status?.price_per_day ?? 0),
  };
};
