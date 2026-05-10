import React from 'react';
import { Smartphone, Package } from 'lucide-react';
import { StatCard, Card, Badge, Button } from './ui';
import { BillingList } from './BillingList';
import { useApp } from '../AppContext';
import { User } from '../types';
import { getPalletTypeLabel, getStatusLabel } from '../i18n';

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

  const calculateTotalDebt = () => {
    return clientPallets.reduce((accumulator, pallet) => {
      const status = statuses.find((item) => item.id === pallet.current_status_id);
      if (!status || !status.is_billable) {
        return accumulator;
      }

      const graceDays = clientInfo?.grace_period_days ?? status.grace_period_days;
      const pricePerDay = clientInfo?.price_per_day ?? status.price_per_day;
      const days = calculateDays(pallet.last_status_changed_at);

      if (days <= graceDays) {
        return accumulator;
      }

      return accumulator + (days - graceDays) * pricePerDay;
    }, 0);
  };

  const calculatePalletDebt = (pallet: (typeof clientPallets)[number]) => {
    const status = statuses.find((item) => item.id === pallet.current_status_id);
    if (!status || !status.is_billable) {
      return 0;
    }

    const graceDays = clientInfo?.grace_period_days ?? status.grace_period_days;
    const pricePerDay = clientInfo?.price_per_day ?? status.price_per_day;
    const days = calculateDays(pallet.last_status_changed_at);

    if (days <= graceDays) {
      return 0;
    }

    return (days - graceDays) * pricePerDay;
  };

  const renderOverview = () => (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('totalUnits')} value={clientPallets.length} />
        <StatCard label={t('activeCharges')} value={`EUR ${calculateTotalDebt().toFixed(0)}`} variant="success" />
        <StatCard
          label={t('stationary')}
          value={clientPallets.filter((pallet) => !statuses.find((item) => item.id === pallet.current_status_id)?.is_billable).length}
          variant="info"
        />
        <StatCard label={t('forPickup')} value={clientPallets.filter((pallet) => pallet.current_status_id === 5).length} variant="warning" />
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">{t('currentFleetDetail')}</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clientPallets.map((pallet) => {
            const days = calculateDays(pallet.last_status_changed_at);
            const palletDebt = calculatePalletDebt(pallet);
            const isCharging = palletDebt > 0;

            return (
              <Card key={pallet.id} noPadding className="group overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className="w-16 h-16 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0 border border-zinc-100 overflow-hidden relative">
                    <img
                      src="https://images.unsplash.com/photo-1591085686350-798c0f9faa7f?auto=format&fit=crop&q=80&w=200"
                      className="w-full h-full object-cover grayscale opacity-50 group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500"
                      alt=""
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{pallet.qr_code}</span>
                        {isCharging && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                      </div>
                      {isCharging && (
                        <span className="text-[12px] font-black text-rose-600 font-mono">EUR {palletDebt.toFixed(2)}</span>
                      )}
                    </div>
                    <p className="font-black text-[13px] truncate uppercase tracking-tight leading-none mb-2">{getPalletTypeLabel(pallet.type, language)}</p>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={pallet.current_status_id === 7 ? 'danger' : pallet.current_status_id === 5 ? 'warning' : 'info'}>
                          {getStatusLabel(pallet.current_status_name, language)}
                        </Badge>
                        <span className="text-[10px] font-black text-zinc-400 uppercase">{days} d</span>
                      </div>
                      {pallet.current_status_id !== 5 && (
                        <button
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
                          className="bg-zinc-950 text-white text-[8px] font-black uppercase px-2 py-1 rounded hover:bg-black transition-colors"
                        >
                          {t('requestReturn')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {clientPallets.length === 0 && (
            <div className="col-span-full py-20 bg-zinc-50 rounded-[3rem] border-2 border-dashed border-zinc-100 flex flex-col items-center justify-center text-zinc-400">
              <Package size={32} className="opacity-20 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest leading-none">{t('noActiveUnits')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="flex h-12 items-center justify-between mb-8 text-black">
        <div className="flex items-center gap-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
          <span>{t('home')}</span>
          <span>/</span>
          <span className="text-black">{activeTab === 'invoices' ? t('billing') : t('overview')}</span>
        </div>
        <div className="text-right">
          <span className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">{t('company')}</span>
          <p className="text-xs font-black uppercase">{clientInfo?.name || user.name}</p>
        </div>
      </header>

      {activeTab === 'invoices' ? <BillingList /> : renderOverview()}

      <Card className="bg-zinc-900 border-zinc-900 shadow-zinc-900/10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-zinc-400">
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase text-white leading-none mb-1">{t('ghostReportCardTitle')}</h3>
              <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{t('ghostReportCardText')}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full md:w-auto bg-transparent border-white/20 text-white hover:bg-white hover:text-black"
            onClick={() => setIsGhostReportOpen(true)}
          >
            {t('reportNow')}
          </Button>
        </div>
      </Card>
    </div>
  );
};
