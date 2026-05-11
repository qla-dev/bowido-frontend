import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, ClipboardList, Package, QrCode, Wrench } from 'lucide-react';
import { useApp } from '../AppContext';
import { User } from '../types';
import { StatCard, Card, Button, Badge } from './ui';
import { getPalletTypeLabel } from '../i18n';

interface ServiceDashboardProps {
  user: User;
}

export const ServiceDashboard: React.FC<ServiceDashboardProps> = ({ user }) => {
  const { pallets, updatePalletStatus, t, language, serviceReports, setIsScannerOpen } = useApp();

  const servicePallets = pallets.filter(
    (pallet) =>
      pallet.current_status_id === 7 ||
      serviceReports.some((report) => report.pallet_id === pallet.id && !report.resolved_at)
  );
  const openReports = serviceReports.filter((report) => !report.resolved_at);
  const resolvedToday = serviceReports.filter((report) => {
    if (!report.resolved_at) return false;

    const resolvedDate = new Date(report.resolved_at);
    const today = new Date();
    return (
      resolvedDate.getDate() === today.getDate() &&
      resolvedDate.getMonth() === today.getMonth() &&
      resolvedDate.getFullYear() === today.getFullYear()
    );
  }).length;
  const leadPallet = servicePallets[0];
  const leadReport = leadPallet
    ? serviceReports.find((report) => report.pallet_id === leadPallet.id && !report.resolved_at)
    : undefined;
  const recentServiceReports = [...serviceReports]
    .sort(
      (left, right) =>
        new Date(right.resolved_at || right.created_at).getTime() -
        new Date(left.resolved_at || left.created_at).getTime()
    )
    .slice(0, 6);
  const toolButtonClass = 'flex min-h-[96px] w-full items-center justify-between rounded-[1.75rem] border-2 p-4 text-left';
  const toolButtonContentClass = 'flex min-w-0 items-center gap-4';

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleFix = (palletId: number) => {
    const pallet = pallets.find((item) => item.id === palletId);

    updatePalletStatus(
      palletId,
      1,
      user.id,
      user.name,
      pallet?.current_location || 'Warehouse BiH',
      t('markAsFixed')
    );
  };

  return (
    <div className="space-y-6 pb-20 md:pb-4">
      <Card title={t('serviceTools')}>
        <div className="space-y-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className={`${toolButtonClass} border-emerald-100 bg-emerald-50`}
          >
            <div className={toolButtonContentClass}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
                <QrCode size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase leading-none text-emerald-900">{t('qrScan')}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600">{t('scanToUpdateHint')}</p>
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-emerald-300" />
          </button>

          <button
            onClick={() => scrollToSection('service-queue-section')}
            className={`${toolButtonClass} border-amber-100 bg-amber-50`}
          >
            <div className={toolButtonContentClass}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
                <Wrench size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase leading-none text-amber-900">{t('serviceQueue')}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-amber-600">
                  {openReports.length} {t('pendingRepair')}
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-amber-300" />
          </button>

          <button
            onClick={() => scrollToSection('service-jobs-section')}
            className={`${toolButtonClass} border-blue-100 bg-blue-50`}
          >
            <div className={toolButtonContentClass}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white">
                <ClipboardList size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase leading-none text-blue-900">{t('activeJobs')}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-blue-600">
                  {servicePallets.length} {t('service')}
                </p>
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-blue-300" />
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card id="service-queue-section" title={t('serviceQueue')} className="overflow-hidden">
          {leadPallet ? (
            <div className="space-y-4">
              <div className="rounded-[2rem] border border-amber-100 bg-[linear-gradient(135deg,#fff8eb_0%,#ffffff_55%,#f7fbff_100%)] p-5 dark:bg-[linear-gradient(135deg,#4a3917_0%,#1a3327_58%,#203d5f_100%)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Wrench size={16} />
                      <span className="text-[9px] font-black uppercase tracking-[0.18em]">{t('technician')}</span>
                    </div>
                    <p className="text-lg font-black uppercase tracking-tight text-amber-950">{leadPallet.qr_code}</p>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                      {getPalletTypeLabel(leadPallet.type, language)}
                    </p>
                  </div>
                  <Badge variant="danger">{t('service')}</Badge>
                </div>

                <div className="mt-5 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-white shadow-sm">
                    <Package size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('currentLocation')}</p>
                    <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                      {leadPallet.current_location || t('inWarehouse')}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-100 bg-white shadow-sm">
                    <ClipboardList size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">{t('damageDescription')}</p>
                    <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                      {leadReport?.problem_description || leadPallet.note || t('serviceDamageHint')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center text-center opacity-30">
              <Wrench size={34} className="mb-3" />
              <p className="text-[10px] font-black uppercase tracking-widest">{t('allUnitsStable')}</p>
            </div>
          )}
        </Card>

        <Card id="service-jobs-section" title={t('activeJobs')} noPadding>
          <div className="divide-y divide-zinc-100">
            {servicePallets.length > 0 ? (
              servicePallets.map((pallet) => {
                const report = serviceReports.find((item) => item.pallet_id === pallet.id && !item.resolved_at);

                return (
                  <div key={`service-job-${pallet.id}`} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{pallet.qr_code}</span>
                        <Badge variant="danger">{t('service')}</Badge>
                      </div>
                      <p className="mt-2 truncate text-[12px] font-black uppercase tracking-tight text-zinc-900">
                        {getPalletTypeLabel(pallet.type, language)}
                      </p>
                      <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                        {report?.problem_description || pallet.note || t('serviceDamageHint')}
                      </p>
                    </div>
                    <Button size="xs" variant="secondary" onClick={() => handleFix(pallet.id)}>
                      <CheckCircle2 size={12} className="mr-1.5" />
                      {t('markAsFixed')}
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center opacity-40">
                <ClipboardList size={32} className="mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">{t('allUnitsStable')}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label={t('pendingRepair')} value={servicePallets.length} variant="danger" />
        <StatCard label={t('repairedToday')} value={resolvedToday} variant="success" />
        <StatCard label={t('partsStock')} value="OK" variant="info" />
        <StatCard label={t('serviceQueue')} value={openReports.length} variant="warning" />
      </div>

      <Card id="service-log-section" title={t('serviceLog')} noPadding>
        <div className="divide-y divide-zinc-100">
          {recentServiceReports.length > 0 ? (
            recentServiceReports.map((report) => {
              const pallet = pallets.find((item) => item.id === report.pallet_id);

              return (
                <motion.div
                  key={`service-report-${report.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {pallet?.qr_code || `PAL-${report.pallet_id}`}
                      </span>
                      <Badge variant={report.resolved_at ? 'success' : 'danger'}>
                        {report.resolved_at ? t('markAsFixed') : t('pendingRepair')}
                      </Badge>
                    </div>
                    <p className="mt-2 truncate text-[12px] font-black uppercase tracking-tight text-zinc-900">
                      {pallet ? getPalletTypeLabel(pallet.type, language) : t('service')}
                    </p>
                    <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.14em] text-zinc-400">
                      {report.problem_description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-zinc-300">
                    {new Date(report.resolved_at || report.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </motion.div>
              );
            })
          ) : (
            <div className="p-12 text-center opacity-40">
              <ClipboardList size={32} className="mx-auto mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">{t('allUnitsStable')}</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
