import React from 'react';
import { Clock3, Package, RotateCcw, Smartphone } from 'lucide-react';
import { StatCard, Card, Badge, Button } from './ui';
import { BillingList } from './BillingList';
import { useApp } from '../AppContext';
import { User } from '../types';
import { getPalletTypeLabel, getStatusLabel, localeMap } from '../i18n';

interface ClientDashboardProps {
  user: User;
  activeTab?: string;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ user, activeTab = 'dashboard' }) => {
  const { pallets, statuses, clients, setIsGhostReportOpen, t, updatePalletStatus, language } = useApp();

  const clientPallets = pallets.filter((pallet) => pallet.user_id === user.id);
  const clientInfo = clients.find((client) => client.user_id === user.id);

  const calculateDays = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getBillingStatus = (pallet: (typeof clientPallets)[number]) =>
    statuses.find((item) => item.id === pallet.current_status_id);

  const getGraceDays = (pallet: (typeof clientPallets)[number]) => {
    const status = getBillingStatus(pallet);
    return clientInfo?.grace_period_days ?? status?.grace_period_days ?? 0;
  };

  const getPricePerDay = (pallet: (typeof clientPallets)[number]) => {
    const status = getBillingStatus(pallet);
    return clientInfo?.price_per_day ?? status?.price_per_day ?? 0;
  };

  const calculateTotalDebt = () => {
    return clientPallets.reduce((accumulator, pallet) => accumulator + calculatePalletDebt(pallet), 0);
  };

  const calculatePalletDebt = (pallet: (typeof clientPallets)[number]) => {
    const status = getBillingStatus(pallet);
    if (!status || !status.is_billable) {
      return 0;
    }

    const graceDays = getGraceDays(pallet);
    const pricePerDay = getPricePerDay(pallet);
    const days = calculateDays(pallet.last_status_changed_at);

    if (days <= graceDays) {
      return 0;
    }

    return (days - graceDays) * pricePerDay;
  };

  const chargingPallets = clientPallets
    .filter((pallet) => calculatePalletDebt(pallet) > 0)
    .sort((left, right) => calculatePalletDebt(right) - calculatePalletDebt(left));

  const gracePallets = clientPallets.filter((pallet) => {
    const status = getBillingStatus(pallet);
    return Boolean(status?.is_billable) && calculatePalletDebt(pallet) === 0;
  });

  const chargingSoonPallets = clientPallets.filter((pallet) => {
    const status = getBillingStatus(pallet);
    if (!status?.is_billable || calculatePalletDebt(pallet) > 0) {
      return false;
    }

    const days = calculateDays(pallet.last_status_changed_at);
    const graceDays = getGraceDays(pallet);
    return graceDays > 0 && days >= Math.max(graceDays - 2, 0);
  });

  const returnRequestedPallets = clientPallets.filter((pallet) => pallet.current_status_id === 5);
  const atClientPallets = clientPallets.filter((pallet) => pallet.current_status_id === 4);

  const nextInvoiceDate = new Date();
  nextInvoiceDate.setDate(nextInvoiceDate.getDate() + 7);

  const nextInvoiceDateLabel = new Intl.DateTimeFormat(localeMap[language], {
    day: '2-digit',
    month: 'short',
  }).format(nextInvoiceDate);

  const attentionPallets = [...chargingPallets, ...returnRequestedPallets.filter((pallet) => calculatePalletDebt(pallet) === 0)]
    .slice(0, 4);

  const renderOverview = () => (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t('totalUnits')} value={clientPallets.length} />
        <StatCard label={t('activeCharges')} value={`EUR ${calculateTotalDebt().toFixed(0)}`} variant="success" />
        <StatCard label={t('unitsInGrace')} value={gracePallets.length} variant="info" />
        <StatCard label={t('returnRequests')} value={returnRequestedPallets.length} variant="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card title={t('billingSnapshot')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">{t('payableAmount')}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-emerald-950">{`EUR ${calculateTotalDebt().toFixed(2)}`}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-700">{t('unitsInGrace')}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-blue-950">{gracePallets.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-700">{t('chargingSoon')}</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-amber-950">{chargingSoonPallets.length}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500">{t('expectedInvoice')}</p>
              <p className="mt-2 text-lg font-black tracking-tight text-zinc-950">{nextInvoiceDateLabel}</p>
            </div>
          </div>
        </Card>

        <Card title={t('returnBoard')}>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-100 text-zinc-500">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('returnRequests')}</p>
                  <p className="text-sm font-black uppercase tracking-tight">{returnRequestedPallets.length}</p>
                </div>
              </div>
              <Badge variant="warning">{t('forPickup')}</Badge>
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-zinc-100 text-zinc-500">
                  <Package size={18} />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('activePallets')}</p>
                  <p className="text-sm font-black uppercase tracking-tight">{atClientPallets.length}</p>
                </div>
              </div>
              <Badge variant="info">{t('liveInventory')}</Badge>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('chargeAlert')}</p>
              <p className="mt-2 text-[12px] font-black uppercase tracking-tight text-zinc-900">
                {chargingPallets.length > 0 ? `${chargingPallets.length} ${t('activeCharges')}` : t('allUnitsStable')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <Card title={t('attentionRequired')} noPadding>
          {attentionPallets.length > 0 ? (
            <div className="divide-y divide-zinc-100">
              {attentionPallets.map((pallet) => {
                const palletDebt = calculatePalletDebt(pallet);
                const days = calculateDays(pallet.last_status_changed_at);

                return (
                  <div key={`attention-${pallet.id}`} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{pallet.qr_code}</span>
                        <Badge variant={palletDebt > 0 ? 'danger' : 'warning'}>
                          {getStatusLabel(pallet.current_status_name, language)}
                        </Badge>
                      </div>
                      <p className="mt-2 truncate text-[12px] font-black uppercase tracking-tight text-zinc-900">
                        {getPalletTypeLabel(pallet.type, language)}
                      </p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                        {pallet.current_location} / {days} d
                      </p>
                    </div>

                    <div className="text-right">
                      {palletDebt > 0 ? (
                        <p className="text-sm font-black uppercase tracking-tight text-rose-600">{`EUR ${palletDebt.toFixed(2)}`}</p>
                      ) : (
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">{t('forPickup')}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[180px] flex-col items-center justify-center text-center text-zinc-400">
              <Clock3 size={26} className="mb-3 opacity-30" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">{t('allUnitsStable')}</p>
            </div>
          )}
        </Card>

        <Card className="border-zinc-900 bg-zinc-900 shadow-zinc-900/10">
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-zinc-400">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase text-white leading-none mb-1">{t('ghostReportCardTitle')}</h3>
                <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{t('ghostReportCardText')}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full bg-transparent border-white/20 text-white hover:bg-white hover:text-black"
              onClick={() => setIsGhostReportOpen(true)}
            >
              {t('reportNow')}
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">{t('currentFleetDetail')}</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clientPallets.map((pallet) => {
            const days = calculateDays(pallet.last_status_changed_at);
            const palletDebt = calculatePalletDebt(pallet);
            const graceDays = getGraceDays(pallet);
            const isCharging = palletDebt > 0;

            return (
              <Card key={pallet.id} noPadding className="overflow-hidden">
                <div className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{pallet.qr_code}</span>
                        {isCharging && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                      </div>
                      <p className="mt-2 truncate text-[13px] font-black uppercase tracking-tight text-zinc-950">
                        {getPalletTypeLabel(pallet.type, language)}
                      </p>
                      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{pallet.current_location}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={pallet.current_status_id === 7 ? 'danger' : pallet.current_status_id === 5 ? 'warning' : 'info'}>
                        {getStatusLabel(pallet.current_status_name, language)}
                      </Badge>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">{days} d</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('chargeAlert')}</p>
                      <p className={`mt-2 text-sm font-black uppercase tracking-tight ${isCharging ? 'text-rose-600' : 'text-zinc-900'}`}>
                        {isCharging ? `EUR ${palletDebt.toFixed(2)}` : t('unitsInGrace')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 p-3">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{t('gracePeriodLabel')}</p>
                      <p className="mt-2 text-sm font-black uppercase tracking-tight text-zinc-900">{graceDays} d</p>
                    </div>
                  </div>

                  {pallet.current_status_id !== 5 && (
                    <Button
                      className="w-full"
                      onClick={() =>
                        updatePalletStatus(
                          pallet.id,
                          5,
                          user.id,
                          user.name,
                          pallet.current_location,
                          'Requested for return by client'
                        )
                      }
                    >
                      {t('requestReturn')}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}

          {clientPallets.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center rounded-[3rem] border-2 border-dashed border-zinc-100 bg-zinc-50 py-20 text-zinc-400">
              <Package size={32} className="mb-4 opacity-20" />
              <p className="text-[10px] font-black uppercase tracking-widest leading-none">{t('noActiveUnits')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="mb-6 flex flex-col gap-3 text-black md:mb-8 md:h-12 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          <span>{t('home')}</span>
          <span>/</span>
          <span className="text-black">{activeTab === 'invoices' ? t('billing') : t('overview')}</span>
        </div>
        <div className="text-left md:text-right">
          <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">{t('company')}</span>
          <p className="text-xs font-black uppercase">{clientInfo?.name || user.name}</p>
        </div>
      </header>

      {activeTab === 'invoices' ? <BillingList /> : renderOverview()}
    </div>
  );
};
