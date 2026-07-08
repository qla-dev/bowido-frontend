import React, { useState } from 'react';
import { 
  Package, Truck, AlertTriangle, Users, ArrowUpRight,
  Filter, MoreVertical, MapPin, Clock, Settings as SettingsIcon,
  Plus, History, ClipboardList, TrendingUp, Info, X
} from 'lucide-react';
import { StatCard, Card, Button, Input, Select, Badge } from './ui';
import { PalletScanner } from './PalletScanner';
import { DamageReportModal } from './DamageReportModal';
import { BillingList } from './BillingList';
import { RoleManager } from './RoleManager';
import { PalletTableView } from './PalletTableView';
import { PalletQrCode } from './PalletQrCode';
import { BillingCalendar } from './BillingCalendar';
import { UserManager } from './UserManager';
import { OverdueInvoiceModal, OverdueInvoicePreview } from './OverdueInvoiceModal';
import { AdminAuditLogs } from './AdminAuditLogs';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { NoQrPalletTableView } from './NoQrPalletTableView';
import { ClientTableView } from './ClientTableView';
import { AdminClientManagerView } from './AdminClientManagerView';
import { AdminRoleOperationsView } from './AdminRoleOperationsView';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import { motion, AnimatePresence } from 'motion/react';
import { RoleType, Pallet, PalletDashboardStats, PalletStatus, ClientDetail, User, AuditLog } from '../types';
import { CreditCard, Shield, Calendar as CalendarIcon, Eye, Send, Ghost, QrCode } from 'lucide-react';
import {
  getCountryLabel,
  getPalletTypeLabel,
  getStatusLabel,
  normalizePalletTypeCode,
  palletTypeValues,
} from '../i18n';
import { getPalletDisplayName } from '../lib/palletDisplay';

interface AdminDashboardProps {
  initialView?:
    | 'overview'
    | 'pallets'
    | 'clients'
    | 'users'
    | 'settings'
    | 'logs'
    | 'billing'
    | 'roles'
    | 'calendar'
    | 'noQrPallets'
    | 'clientManager'
    | 'adminService'
    | 'adminWarehouse'
    | 'adminFinance';
  user: User;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
  openPalletId?: number | null;
  onPalletDetailOpened?: () => void;
}

type DeleteConfirmState =
  | { kind: 'pallet'; pallet: Pallet }
  | { kind: 'status'; status: PalletStatus }
  | null;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialView = 'overview',
  user,
  isNightMode = false,
  onToggleNightMode,
  openPalletId = null,
  onPalletDetailOpened,
}) => {
  const { 
    pallets, statuses, clients, auditLogs, serviceReports,
    updateStatusSettings, addStatus, deleteStatus, addPallet, addPalletBatch, updatePallet, deletePallet,
    addClient, updateClient, setIsGhostReportOpen, fetchAuditLogs, t, language
  } = useApp();
  const [view, setView] = useState<
    'overview' | 'pallets' | 'clients' | 'users' | 'settings' | 'logs' | 'billing' | 'roles' | 'calendar' | 'noQrPallets' | 'clientManager' | 'adminService' | 'adminWarehouse' | 'adminFinance'
  >(initialView);
  const [editingStatus, setEditingStatus] = useState<PalletStatus | null>(null);
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [newStatusData, setNewStatusData] = useState<Omit<PalletStatus, 'id'>>({
    name: '',
    is_active: true,
    is_billable: false,
    grace_period_days: 14,
    price_per_day: 0
  });
  
  // Modals
  const [showAddPallet, setShowAddPallet] = useState(false);
  const [newPalletMode, setNewPalletMode] = useState<'single' | 'bulk'>('single');
  const [newPalletQr, setNewPalletQr] = useState('');
  const [newPalletType, setNewPalletType] = useState<string>(palletTypeValues[0]);
  const [bulkQrPrefix, setBulkQrPrefix] = useState('BOWNL-');
  const [bulkQrStart, setBulkQrStart] = useState('');
  const [bulkQrEnd, setBulkQrEnd] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDetail | null>(null);
  const [clientPasswordDraft, setClientPasswordDraft] = useState('');
  const [clientPasswordMessage, setClientPasswordMessage] = useState<string | null>(null);
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [editingPallet, setEditingPallet] = useState<Pallet | null>(null);
  const [showEditingPalletDetails, setShowEditingPalletDetails] = useState(false);
  const [qrPreview, setQrPreview] = useState<{ value: string; label: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [selectedOverduePalletId, setSelectedOverduePalletId] = useState<number | null>(null);
  const [sentInvoiceTimestamps, setSentInvoiceTimestamps] = useState<Record<number, string>>({});
  const [dashboardStats, setDashboardStats] = useState<PalletDashboardStats | null>(null);
  const [palletAuditLogsById, setPalletAuditLogsById] = useState<Record<number, AuditLog[]>>({});

  const handleExportPdf = () => {
    alert('Generating PDF Delivery/Stock Report...');
  };

  // Sync view with prop changes (e.g. from sidebar)
  React.useEffect(() => {
    setView(initialView);
  }, [initialView]);

  React.useEffect(() => {
    if (view === 'logs') {
      void fetchAuditLogs();
    }
  }, [view]);

  React.useEffect(() => {
    if (view !== 'overview') {
      return;
    }

    let isCancelled = false;

    void apiService.pallets
      .stats()
      .then((stats) => {
        if (!isCancelled) {
          setDashboardStats(stats);
        }
      })
      .catch((error) => {
        console.error('Failed to load pallet dashboard stats', error);

        if (!isCancelled) {
          setDashboardStats(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [view, pallets]);

  React.useEffect(() => {
    if (!openPalletId) {
      return;
    }

    const pallet = pallets.find((item) => item.id === openPalletId);

    if (pallet) {
      setSelectedPallet(pallet);
      onPalletDetailOpened?.();
    }
  }, [openPalletId, onPalletDetailOpened, pallets]);

  const activeDetailPalletId = selectedPallet?.id ?? editingPallet?.id ?? null;

  React.useEffect(() => {
    if (!activeDetailPalletId || palletAuditLogsById[activeDetailPalletId]) {
      return;
    }

    let isCancelled = false;

    void apiService.auditLogs
      .list({
        pallet_id: activeDetailPalletId,
        limit: 100,
        sort_by: 'created_at',
        sort_direction: 'desc',
      })
      .then((logs) => {
        if (isCancelled) {
          return;
        }

        setPalletAuditLogsById((current) => ({
          ...current,
          [activeDetailPalletId]: logs,
        }));
      })
      .catch((error) => console.error('Failed to load pallet audit history', error));

    return () => {
      isCancelled = true;
    };
  }, [activeDetailPalletId]);

  const calculateDays = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const calculateDebt = (p: Pallet) => {
    const status = statuses.find(s => s.id === p.current_status_id);
    if (!status || !status.is_billable) return 0;
    
    const client = clients.find(c => c.user_id === p.user_id);
    const graceDays = client?.grace_period_days ?? status.grace_period_days;
    const pricePerDay = client?.price_per_day ?? status.price_per_day;
    
    const days = calculateDays(p.last_status_changed_at);
    if (days <= graceDays) return 0;
    return (days - graceDays) * pricePerDay;
  };

  const isNetherlandsCountry = (country: string) =>
    country === 'NL' || country === 'Netherlands';

  const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const addPalletModeLabel = language === 'bs' ? 'Nacin unosa' : language === 'nl' ? 'Invoermodus' : 'Entry mode';
  const singlePalletLabel = language === 'bs' ? 'Jedna paleta' : language === 'nl' ? 'Eén bok' : 'Single pallet';
  const bulkPalletLabel = language === 'bs' ? 'Bulk unos' : language === 'nl' ? 'Bulk invoer' : 'Bulk entry';
  const qrPrefixLabel = language === 'bs' ? 'QR prefiks' : language === 'nl' ? 'QR prefix' : 'QR prefix';
  const rangeFromLabel = language === 'bs' ? 'Od broja' : language === 'nl' ? 'Vanaf nummer' : 'From number';
  const rangeToLabel = language === 'bs' ? 'Do broja' : language === 'nl' ? 'Tot nummer' : 'To number';
  const totalCreateLabel = language === 'bs' ? 'Za kreiranje' : language === 'nl' ? 'Te maken' : 'To create';
  const invalidRangeLabel = language === 'bs' ? 'Unesi ispravan raspon.' : language === 'nl' ? 'Vul een geldig bereik in.' : 'Enter a valid range.';
  const bulkHintLabel = language === 'bs' ? 'Status novih paleta' : language === 'nl' ? 'Status van nieuwe bokken' : 'Status for new pallets';
  const createBulkLabel = language === 'bs' ? 'Kreiraj palete' : language === 'nl' ? 'Bokken aanmaken' : 'Create pallets';
  const referenceCodeLabel = language === 'bs' ? 'Stari QR / referenca' : language === 'nl' ? 'Oude QR / referentie' : 'Old QR / reference';

  const parseBulkNumber = (value: string) => {
    const trimmedValue = value.trim();
    return /^\d+$/.test(trimmedValue) ? Number(trimmedValue) : null;
  };

  const bulkStartNumber = parseBulkNumber(bulkQrStart);
  const bulkEndNumber = parseBulkNumber(bulkQrEnd);
  const hasValidBulkRange =
    bulkStartNumber !== null && bulkEndNumber !== null && bulkEndNumber >= bulkStartNumber;
  const bulkCreateCount = hasValidBulkRange ? bulkEndNumber - bulkStartNumber + 1 : 0;

  const resetAddPalletForm = () => {
    setNewPalletMode('single');
    setNewPalletQr('');
    setNewPalletType(palletTypeValues[0]);
    setBulkQrPrefix('BOWNL-');
    setBulkQrStart('');
    setBulkQrEnd('');
  };

  const openAddPalletModal = () => {
    resetAddPalletForm();
    setShowAddPallet(true);
  };

  const closeAddPalletModal = () => {
    resetAddPalletForm();
    setShowAddPallet(false);
  };

  const buildBulkQrCodes = () => {
    if (!hasValidBulkRange || bulkStartNumber === null || bulkEndNumber === null) {
      return [];
    }

    const paddingLength = Math.max(bulkQrStart.trim().length, bulkQrEnd.trim().length, 1);

    return Array.from({ length: bulkCreateCount }, (_, index) => {
      const nextNumber = bulkStartNumber + index;
      return `${bulkQrPrefix}${String(nextNumber).padStart(paddingLength, '0')}`.toUpperCase();
    });
  };

  const handleCreatePallets = () => {
    const normalizedType = normalizePalletTypeCode(newPalletType) || newPalletType;

    if (newPalletMode === 'single') {
      if (!newPalletQr.trim()) {
        return;
      }

      addPallet(newPalletQr, normalizedType);
      closeAddPalletModal();
      return;
    }

    const qrCodes = buildBulkQrCodes();

    if (qrCodes.length === 0) {
      return;
    }

    addPalletBatch(qrCodes.map((qrCode) => ({ qrCode, type: normalizedType })));
    closeAddPalletModal();
  };

  const buildOverdueInvoicePreview = (pallet: Pallet): OverdueInvoicePreview => {
    const client = clients.find(c => c.user_id === pallet.user_id);
    const status = statuses.find(s => s.id === pallet.current_status_id);
    const graceDays = client?.grace_period_days ?? status?.grace_period_days ?? 0;
    const pricePerDay = client?.price_per_day ?? status?.price_per_day ?? 0;
    const totalDays = calculateDays(pallet.last_status_changed_at);
    const overdueDays = Math.max(totalDays - graceDays, 1);
    const now = new Date();
    const sentAt = sentInvoiceTimestamps[pallet.id];
    const billingEnd = new Date(now);
    const billingStart = new Date(now);
    billingStart.setDate(billingStart.getDate() - overdueDays + 1);
    const issuedAt = new Date(now.getTime() - (pallet.id + 15) * 60 * 1000);

    return {
      id: 9000 + pallet.id,
      invoice_number: `INV-OVD-2026-${String(pallet.id).padStart(4, '0')}`,
      pallet_id: pallet.id,
      pallet_qr: getPalletDisplayName(pallet),
      customer_name: client?.name || pallet.client_name || 'Warehouse Holding',
      recipient_email: client?.billing_email || '',
      user_id: pallet.user_id ?? 1,
      billing_period_start: formatDateOnly(billingStart),
      billing_period_end: formatDateOnly(billingEnd),
      total_amount: calculateDebt(pallet),
      status: sentAt ? 'sent' : 'active',
      issued_at: formatDateTime(issuedAt),
      created_at: formatDateTime(issuedAt),
      updated_at: sentAt || formatDateTime(new Date(issuedAt.getTime() + 15 * 60 * 1000)),
      overdue_days: overdueDays,
      rate_per_day: pricePerDay,
      location: pallet.current_location,
    };
  };

  const selectedOverdueInvoice = selectedOverduePalletId
    ? (() => {
        const pallet = pallets.find(item => item.id === selectedOverduePalletId);
        return pallet ? buildOverdueInvoicePreview(pallet) : null;
      })()
    : null;

  const handleSendInvoice = (pallet: Pallet) => {
    setSentInvoiceTimestamps(prev => ({
      ...prev,
      [pallet.id]: formatDateTime(new Date()),
    }));
  };

  const handleEditPallet = (pallet: Pallet) => {
    setSelectedPallet(null);
    setShowEditingPalletDetails(false);
    setEditingPallet({
      ...pallet,
      type: normalizePalletTypeCode(pallet.type) || pallet.type,
    });
  };

  const handleDeletePallet = (pallet: Pallet) => {
    setDeleteConfirm({ kind: 'pallet', pallet });
  };

  const handleEditClient = (client: ClientDetail) => {
    setEditingClient(client);
    setClientPasswordDraft('');
    setClientPasswordMessage(null);
  };

  const handleCloseClientModal = () => {
    setEditingClient(null);
    setClientPasswordDraft('');
    setClientPasswordMessage(null);
  };

  const handleClientPasswordReset = async () => {
    if (!editingClient || !clientPasswordDraft.trim()) {
      return;
    }

    try {
      await apiService.users.update(editingClient.user_id, {
        password: clientPasswordDraft.trim(),
      });
      setClientPasswordDraft('');
      setClientPasswordMessage(
        language === 'bs'
          ? 'Lozinka je promijenjena.'
          : language === 'nl'
            ? 'Wachtwoord is gewijzigd.'
            : 'Password has been updated.'
      );
    } catch {
      setClientPasswordMessage(
        language === 'bs'
          ? 'Nije pronadjen povezani korisnicki nalog.'
          : language === 'nl'
            ? 'Geen gekoppeld gebruikersaccount gevonden.'
            : 'No linked user account was found.'
      );
    }
  };

  const handleDeleteStatus = (status: PalletStatus) => {
    setDeleteConfirm({ kind: 'status', status });
  };

  const confirmDeleteAction = () => {
    if (!deleteConfirm) {
      return;
    }

    if (deleteConfirm.kind === 'pallet') {
      deletePallet(deleteConfirm.pallet.id);
      setEditingPallet(current => (current?.id === deleteConfirm.pallet.id ? null : current));
      setSelectedPallet(current => (current?.id === deleteConfirm.pallet.id ? null : current));
    }

    if (deleteConfirm.kind === 'status') {
      deleteStatus(deleteConfirm.status.id);
      setEditingStatus(current => (current?.id === deleteConfirm.status.id ? null : current));
    }

    setDeleteConfirm(null);
  };

  const databasePalletTypeOptions = React.useMemo(
    () =>
      Array.from<string>(
        new Set(
          pallets
            .map((pallet) => normalizePalletTypeCode(pallet.type) || pallet.type)
            .filter((value): value is string => Boolean(value && value.trim()))
        )
      ).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })),
    [pallets]
  );

  const getPalletTypeOptions = (currentType?: string) =>
    Array.from(
      new Set(
        [normalizePalletTypeCode(currentType || ''), ...databasePalletTypeOptions, ...palletTypeValues].filter(
          (value): value is string => Boolean(value && value.trim())
        )
      )
    );

  const openQrPreview = (pallet: Pallet) => {
    const value = pallet.qr_code.trim();
    if (!value) return;

    setQrPreview({
      value,
      label: getPalletDisplayName(pallet) || value,
    });
  };

  const detailToggleLabel =
    language === 'bs' ? 'Prikaz detalja' : language === 'nl' ? 'Details tonen' : 'Show details';
  const hideDetailLabel =
    language === 'bs' ? 'Sakrij detalje' : language === 'nl' ? 'Details verbergen' : 'Hide details';
  const daysOutsideLabel =
    language === 'bs' ? 'Dana vani' : language === 'nl' ? 'Dagen buiten' : 'Days out';
  const noMovementHistoryLabel =
    language === 'bs'
      ? 'Nema zabiljezene historije kretanja.'
      : language === 'nl'
        ? 'Geen bewegingshistoriek beschikbaar.'
        : 'No movement history available.';
  const notAvailableLabel = language === 'bs' ? 'Nije dostupno' : language === 'nl' ? 'Niet beschikbaar' : 'Not available';
  const formatDaysOutsideValue = (days: number) => {
    if (language === 'bs') {
      return `${days} ${days === 1 ? 'dan' : 'dana'}`;
    }

    if (language === 'nl') {
      return `${days} ${days === 1 ? 'dag' : 'dagen'}`;
    }

    return `${days} ${days === 1 ? 'day' : 'days'}`;
  };
  const detailDateFormatter = new Intl.DateTimeFormat(
    language === 'nl' ? 'nl-NL' : language === 'bs' ? 'bs-BA' : 'en-GB',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  );
  const buildFallbackStatusLog = (pallet: Pallet): AuditLog => {
    return {
      id: -pallet.id,
      pallet_id: pallet.id,
      pallet_qr: getPalletDisplayName(pallet),
      made_by_user_id: 0,
      made_by_user_name: '',
      type: 'status',
      old_status_id: pallet.current_status_id,
      new_status_id: pallet.current_status_id,
      old_status_name: pallet.current_status_name,
      new_status_name: pallet.current_status_name,
      old_client_id: pallet.user_id,
      new_client_id: pallet.user_id,
      old_location: pallet.current_location,
      new_location: pallet.current_location,
      note: '',
      created_at: pallet.last_status_changed_at || pallet.created_at,
    };
  };
  const matchesPalletCurrentState = (log: AuditLog, pallet: Pallet) =>
    (log.type || 'status') === 'status' &&
    log.new_status_id === pallet.current_status_id &&
    log.new_status_name === pallet.current_status_name &&
    (log.new_location || '').trim() === (pallet.current_location || '').trim();
  const ensureCurrentStatusLog = (logs: AuditLog[], pallet: Pallet) => {
    const currentStateLogIndex = logs.findIndex((log) =>
      matchesPalletCurrentState(log, pallet)
    );

    if (currentStateLogIndex === 0) {
      return logs;
    }

    if (currentStateLogIndex > 0) {
      const currentStateLog = logs[currentStateLogIndex];
      return [
        currentStateLog,
        ...logs.filter((_, index) => index !== currentStateLogIndex),
      ];
    }

    return logs;
  };
  const getPalletStatusHistory = (pallet: Pallet) => {
    const loadedLogs = palletAuditLogsById[pallet.id] || [];
    const logsById = new Map<number, AuditLog>();

    [...auditLogs, ...loadedLogs].forEach((log) => {
      if (log.pallet_id === pallet.id && (log.type || 'status') === 'status') {
        logsById.set(log.id, log);
      }
    });

    const logs = Array.from(logsById.values())
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      );

    if (logs.length === 0) {
      return [buildFallbackStatusLog(pallet)];
    }

    return ensureCurrentStatusLog(logs, pallet);
  };
  const getAuditActorLabel = (log: AuditLog) =>
    log.made_by_user_name?.trim() ||
    (log.made_by_user_id ? `#${log.made_by_user_id}` : notAvailableLabel);
  const selectedPalletStatusHistory = selectedPallet ? getPalletStatusHistory(selectedPallet) : [];
  const latestSelectedPalletStatusLog = selectedPalletStatusHistory[0] || null;
  const editingPalletStatusHistory = editingPallet ? getPalletStatusHistory(editingPallet) : [];
  const latestEditingPalletStatusLog = editingPalletStatusHistory[0] || null;

  const renderOverview = () => {
    const overduePallets = pallets.filter(p => calculateDebt(p) > 0);
    const topOverduePallets = [...overduePallets]
      .sort((left, right) => calculateDebt(right) - calculateDebt(left))
      .slice(0, 10);
    const totalDebt = pallets.reduce((acc, p) => acc + calculateDebt(p), 0);
    const ghostPallets = pallets.filter(p => p.is_ghost);
    const overviewStats = dashboardStats ?? {
      total_pallets: pallets.length,
      in_transport: pallets.filter(p => [2, 6].includes(p.current_status_id)).length,
      overdue_units: overduePallets.length,
    };
    
    return (
      <div className="space-y-6 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('totalPallets')} value={overviewStats.total_pallets.toString()} />
          <StatCard label={t('inTransit')} value={overviewStats.in_transport.toString()} variant="info" />
          <StatCard label={t('overdueUnits')} value={overviewStats.overdue_units.toString()} trend={overviewStats.overdue_units > 0 ? t('actionRequired') : t('allGood')} trendUp={false} variant="danger" />
          <StatCard label={t('totalAccrued')} value={`\u20AC${totalDebt.toFixed(2)}`} trend="Live" trendUp variant="success" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {overduePallets.length > 0 && (
              <Card title={`${t('revenueRecovery')} (${t('overdue')})`} noPadding>
                 <div className="p-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700">
                      <AlertTriangle size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{t('actionRequired')} ({overduePallets.length})</span>
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50/50 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100 text-center">
                        <tr>
                          <th className="px-6 py-3 align-middle">{t('qrCode')}</th>
                          <th className="px-6 py-3 align-middle">{t('client')}</th>
                          <th className="px-6 py-3 align-middle">{t('owed')}</th>
                          <th className="px-6 py-3 align-middle">{t('invoiceLabel')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] divide-y divide-zinc-50">
                        {topOverduePallets.map(p => {
                           const client = clients.find(c => c.user_id === p.user_id);
                           const invoiceWasSent = Boolean(sentInvoiceTimestamps[p.id]);
                           return (
                            <tr key={p.id} className="hover:bg-rose-50/30 transition-colors">
                              <td className="px-6 py-3 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => openQrPreview(p)}
                                  title={t('showQrCode')}
                                  aria-label={`${t('showQrCode')}: ${getPalletDisplayName(p)}`}
                                  className="rounded-lg px-2 py-1 font-mono font-black text-emerald-700 underline decoration-emerald-300 underline-offset-4 transition-colors hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                                >
                                  {p.qr_code}
                                </button>
                              </td>
                              <td className="px-6 py-3 text-center align-middle">
                                <p className="font-bold text-zinc-900 leading-none mb-1">{client?.name || t('inWarehouse')}</p>
                                <p className="text-[9px] text-zinc-400 uppercase tracking-tighter leading-none">{p.current_location}</p>
                              </td>
                              <td className="px-6 py-3 text-center text-rose-600 font-mono font-black align-middle">
                                 {"\u20AC"}{calculateDebt(p).toFixed(2)}
                              </td>
                              <td className="px-6 py-3 align-middle">
                                <div className="grid min-w-[17rem] max-w-md mx-auto grid-cols-1 gap-2 sm:grid-cols-2">
                                  <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={() => setSelectedOverduePalletId(p.id)}
                                    className="w-full justify-center"
                                  >
                                    <Eye size={13} className="mr-1.5" />
                                    {t('viewInvoice')}
                                  </Button>
                                  <Button
                                    variant={invoiceWasSent ? 'secondary' : 'primary'}
                                    size="xs"
                                    onClick={() => handleSendInvoice(p)}
                                    disabled={invoiceWasSent}
                                    className="w-full justify-center"
                                  >
                                    <Send size={13} className="mr-1.5" />
                                    {invoiceWasSent ? t('sentLabel') : t('sendInvoice')}
                                  </Button>
                                </div>
                              </td>
                              <td className="hidden px-6 py-3 text-center text-rose-600 font-mono font-black align-middle">
                                 {"\u20AC"}{calculateDebt(p).toFixed(2)}
                              </td>
                            </tr>
                           );
                        })}
                      </tbody>
                    </table>
                 </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card 
                title={t('activity')} 
                noPadding
                action={<Button variant="ghost" size="xs" onClick={() => setView('logs')}>{t('viewHistory')}</Button>}
              >
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50/50 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3">{t('qrCode')}</th>
                          <th className="px-6 py-3">{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] divide-y divide-zinc-50">
                        {auditLogs.filter(log => (log.type || 'status') === 'status').slice(0, 5).map(log => (
                          <tr key={`audit-log-${log.id}`} className="hover:bg-zinc-50/50">
                            <td className="px-6 py-3 font-mono font-black underline underline-offset-2">{log.pallet_qr}</td>
                            <td className="px-6 py-3">
                              <span className="font-black text-zinc-900 block leading-none mb-1">{getStatusLabel(log.new_status_name, language)}</span>
                              <span className="text-[9px] text-zinc-400 uppercase tracking-tighter block leading-none">{new Date(log.created_at).toLocaleTimeString()}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </Card>

              <Card 
                title={t('inventory')} 
                noPadding
                action={<Button variant="ghost" size="xs" onClick={() => setView('pallets')}>{t('manageAll')}</Button>}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50/50 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                      <tr>
                        <th className="px-6 py-3">{t('qrCode')}</th>
                        <th className="px-6 py-3">{t('owed')}</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] divide-y divide-zinc-50">
                      {pallets.slice(0, 5).map((pallet) => (
                        <tr key={`pallet-overview-${pallet.id}`} className="hover:bg-zinc-50">
                          <td className="px-6 py-3 font-mono font-black">{getPalletDisplayName(pallet)}</td>
                          <td className="px-6 py-3 font-mono font-black text-emerald-600">{"\u20AC"}{calculateDebt(pallet).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card title={t('quickAnalysis')}>
               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-500" />
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{t('utilizationRate')}</span>
                     </div>
                     <span className="text-xs font-black">84.2%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                     <div style={{ width: '84.2%' }} className="h-full bg-black rounded-full" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                       <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                       <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-800 mb-1">{t('logisticsNote')}</p>
                          <p className="text-[11px] font-bold text-blue-700 leading-tight">{t('logisticsNoteText')}</p>
                       </div>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                       <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                       <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-amber-800 mb-1">{t('overdueWarning')}</p>
                          <p className="text-[11px] font-bold text-amber-700 leading-tight">{t('overdueWarningText')}</p>
                       </div>
                    </div>
                  </div>
               </div>
            </Card>

            <Card
              title="Ghost Reports"
              action={
                <Button variant="ghost" size="xs" onClick={() => setIsGhostReportOpen(true)}>
                  Otvori
                </Button>
              }
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-rose-100 bg-rose-50/60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center">
                      <Ghost size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-rose-500">Otvorene prijave</p>
                      <p className="text-lg font-black uppercase tracking-tight text-rose-700">{ghostPallets.length}</p>
                    </div>
                  </div>
                  <Badge variant={ghostPallets.length > 0 ? 'warning' : 'success'}>
                    {ghostPallets.length > 0 ? 'Akcija' : 'Čisto'}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {ghostPallets.length > 0 ? (
                    ghostPallets.slice(0, 3).map((ghostPallet) => (
                      <div key={`admin-ghost-${ghostPallet.id}`} className="p-4 rounded-2xl border border-zinc-100 bg-white">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                              {ghostPallet.client_name || 'Nepoznat klijent'}
                            </p>
                            <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900 mt-1 truncate">
                              {ghostPallet.current_location}
                            </p>
                          </div>
                          <Badge variant="warning">Ghost</Badge>
                        </div>
                        <p className="text-[10px] font-bold text-zinc-500 mt-3 leading-relaxed">
                          {ghostPallet.note || 'Prijavljena paleta bez QR koda.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                        Trenutno nema otvorenih ghost prijava.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderPallets = () => {
    return (
      <PalletTableView
        onAddPallet={openAddPalletModal}
        onEditPallet={handleEditPallet}
        onDeletePallet={handleDeletePallet}
      />
    );
  };

  const renderNoQrPallets = () => <NoQrPalletTableView />;

  const renderClients = () => (
    <ClientTableView
      onAddClient={() => setShowAddClient(true)}
      onEditClient={handleEditClient}
    />
  );

  const renderClientManager = () => <AdminClientManagerView />;
  const renderAdminService = () => <AdminRoleOperationsView mode="service" />;
  const renderAdminWarehouse = () => <AdminRoleOperationsView mode="warehouse" />;
  const renderAdminFinance = () => <AdminRoleOperationsView mode="finance" />;

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-xl font-black uppercase tracking-tighter">{t('configs')}</h2>
         <button 
           onClick={() => setShowAddStatus(true)}
           className="px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-black/10 hover:scale-105 transition-transform"
         >
            <Plus size={16} />
            {t('addStatus')}
         </button>
      </div>

      <Card title={t('settings')}>
         <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
               <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">{t('nightMode')}</p>
               <p className="mt-2 text-lg font-black uppercase tracking-tight text-emerald-950">{isNightMode ? t('on') : t('off')}</p>
            </div>
            <button
              type="button"
              onClick={() => onToggleNightMode?.()}
              className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-emerald-300"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">{t('updateSettings')}</p>
              <p className="mt-2 text-lg font-black uppercase tracking-tight text-zinc-950">{t('nightMode')}</p>
            </button>
         </div>
      </Card>

      <Card title={t('statusConfiguratorTitle')}>
         <div className="p-4 space-y-2">
            {statuses.map(status => (
              <div key={`status-cfg-${status.id}`} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:border-black transition-all group">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest">{getStatusLabel(status.name, language)}</span>
                  <div className="flex gap-4 mt-1">
                     <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-[9px] font-bold text-gray-400 uppercase">
                          {t('activeCounterLabel')} {status.is_active ? t('on') : t('off')}
                        </span>
                     </div>
                     <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.is_billable ? 'bg-blue-500' : 'bg-gray-300'}`} />
                        <span className="text-[9px] font-bold text-gray-400 uppercase">
                          {t('billableStatusLabel')} {status.is_billable ? t('on') : t('off')}
                        </span>
                     </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDeleteStatus(status)}
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                     <AlertTriangle size={14} />
                  </button>
                  <button 
                    onClick={() => setEditingStatus(status)}
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white rounded-lg"
                  >
                     <SettingsIcon size={14} />
                  </button>
                </div>
              </div>
            ))}
         </div>
      </Card>

      {showAddStatus && (
        <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
           <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative">
             <h2 className="text-xl font-black mb-6 uppercase">{t('newStatus')}</h2>
             <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('statusName')}</label>
                   <input 
                     type="text" 
                     value={newStatusData.name} 
                     onChange={e => setNewStatusData({...newStatusData, name: e.target.value})} 
                     className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" 
                     placeholder={t('exampleReturnedPlaceholder')}
                   />
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('activeCounterLabel')}</span>
                   <button onClick={() => setNewStatusData({...newStatusData, is_active: !newStatusData.is_active})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_active ? 'bg-black' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_active ? 'left-5' : 'left-1'}`} />
                   </button>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('gracePeriodDaysLabel')}</label>
                   <input type="number" value={newStatusData.grace_period_days} onChange={e => setNewStatusData({...newStatusData, grace_period_days: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('pricePerDayLabel')} ({'\u20AC'})</label>
                   <input type="number" step="0.1" value={newStatusData.price_per_day} onChange={e => setNewStatusData({...newStatusData, price_per_day: parseFloat(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                </div>
                <div className="flex items-center justify-between pt-2">
                   <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('isBillable')}</span>
                   <button onClick={() => setNewStatusData({...newStatusData, is_billable: !newStatusData.is_billable})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_billable ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_billable ? 'left-5' : 'left-1'}`} />
                   </button>
                </div>
             </div>
             <div className="flex gap-3 mt-8">
                <button onClick={() => setShowAddStatus(false)} className="flex-1 py-3 font-bold text-gray-400 hover:text-black transition-colors uppercase text-xs">{t('cancel')}</button>
                <button 
                  onClick={() => { 
                    addStatus(newStatusData); 
                    setShowAddStatus(false);
                    setNewStatusData({ name: '', is_active: true, is_billable: false, grace_period_days: 14, price_per_day: 0 });
                  }} 
                  className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-xs shadow-xl shadow-black/10"
                >
                  {t('save')}
                </button>
             </div>
           </motion.div>
        </div>
      )}

       {editingStatus && (
         <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative">
              <h2 className="text-xl font-black mb-6 uppercase">{t('configureStatus')}: {getStatusLabel(editingStatus.name, language)}</h2>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('activeCounterLabel')}</span>
                    <button onClick={() => setEditingStatus({...editingStatus, is_active: !editingStatus.is_active})} className={`w-10 h-6 rounded-full transition-colors relative ${editingStatus.is_active ? 'bg-black' : 'bg-gray-200'}`}>
                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingStatus.is_active ? 'left-5' : 'left-1'}`} />
                    </button>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('gracePeriodDaysLabel')}</label>
                    <input type="number" value={editingStatus.grace_period_days} onChange={e => setEditingStatus({...editingStatus, grace_period_days: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('pricePerDayLabel')} ({'\u20AC'})</label>
                    <input type="number" step="0.1" value={editingStatus.price_per_day} onChange={e => setEditingStatus({...editingStatus, price_per_day: parseFloat(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                 </div>
                 <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('billableStatusLabel')}</span>
                    <button onClick={() => setEditingStatus({...editingStatus, is_billable: !editingStatus.is_billable})} className={`w-10 h-6 rounded-full transition-colors relative ${editingStatus.is_billable ? 'bg-blue-600' : 'bg-gray-200'}`}>
                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingStatus.is_billable ? 'left-5' : 'left-1'}`} />
                    </button>
                 </div>
              </div>
              <div className="flex gap-3 mt-8">
                 <button onClick={() => setEditingStatus(null)} className="flex-1 py-3 font-bold text-gray-400 hover:text-black transition-colors uppercase text-xs">{t('cancel')}</button>
                 <button onClick={() => { updateStatusSettings(editingStatus); setEditingStatus(null); }} className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-xs shadow-xl shadow-black/10">{t('saveRules')}</button>
              </div>
            </div>
         </div>
       )}
    </div>
  );

  return (
    <div className="pb-16 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {view === 'overview' && renderOverview()}
      {view === 'pallets' && renderPallets()}
      {view === 'noQrPallets' && renderNoQrPallets()}
      {view === 'clients' && renderClients()}
      {view === 'clientManager' && renderClientManager()}
      {view === 'adminService' && renderAdminService()}
      {view === 'adminWarehouse' && renderAdminWarehouse()}
      {view === 'adminFinance' && renderAdminFinance()}
      {view === 'users' && <UserManager currentUser={user} />}
      {view === 'settings' && renderSettings()}
      {view === 'billing' && <BillingList />}
      {view === 'calendar' && <BillingCalendar />}
      {view === 'roles' && <RoleManager />}

      {/* Modals for CRUD operations */}
      <AnimatePresence>
        {selectedPallet && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[3rem] w-full max-w-xl shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-2 bg-black"></div>
               <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter uppercase mb-1">{selectedPallet.qr_code}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{getPalletTypeLabel(selectedPallet.type, language)}</span>
                  </div>
                  <div className="flex gap-2">
                    {user.role_name === RoleType.ADMIN && (
                      <button 
                        onClick={() => setEditingPallet(selectedPallet)}
                        className="px-4 py-2 bg-gray-50 text-black border border-gray-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors"
                      >
                         {t('editData')}
                      </button>
                    )}
                    <button onClick={() => setSelectedPallet(null)} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400"><X size={20} /></button>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-4">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t('location')}</span>
                    <p className="text-xs font-black uppercase">{selectedPallet.current_location}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t('status')}</span>
                    <p className="text-xs font-black uppercase text-blue-600">{getStatusLabel(selectedPallet.current_status_name, language)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t('daysOut')}</span>
                    <p className="text-xs font-black">{calculateDays(selectedPallet.last_status_changed_at)} {t('days')}</p>
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-6 mb-8">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">{t('timestamp')}</span>
                    <p className="text-xs font-black uppercase">
                      {latestSelectedPalletStatusLog
                        ? detailDateFormatter.format(new Date(latestSelectedPalletStatusLog.created_at))
                        : notAvailableLabel}
                    </p>
                  </div>
               </div>

               <div className="space-y-4 mb-8">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">{t('movementHistory')}</h4>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar">
                    {selectedPalletStatusHistory.map((log) => (
                      <div
                        key={`selected-log-${log.id}`}
                        className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-50">
                          <MapPin size={16} className="text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-black uppercase tracking-tight text-gray-900">
                            {getStatusLabel(log.new_status_name, language)}
                          </p>
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-gray-500">
                            {log.new_location || notAvailableLabel}
                          </p>
                          <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                            {t('changedBy')}: {getAuditActorLabel(log)}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                            <Clock size={12} />
                            <span>{detailDateFormatter.format(new Date(log.created_at))}</span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {selectedPalletStatusHistory.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          {noMovementHistoryLabel}
                        </p>
                      </div>
                    )}
                  </div>
               </div>

               <div className="mt-8 flex gap-3">
                  <button onClick={() => setSelectedPallet(null)} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-black/10">{t('closeDetails')}</button>
               </div>
            </motion.div>
          </div>
        )}

        {editingPallet && (
          <div className="modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-3xl overflow-y-auto rounded-[3rem] border-t-[6px] border-emerald-600 bg-white p-8 shadow-2xl max-h-[95vh] no-scrollbar"
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-4xl font-black uppercase tracking-tight text-emerald-900">
                    {editingPallet.qr_code}
                  </h3>
                  <p className="mt-2 text-sm font-black uppercase tracking-[0.14em] text-zinc-400">
                    {getPalletTypeLabel(editingPallet.type, language)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    title={t('showQrCode')}
                    aria-label={t('showQrCode')}
                    onClick={() => openQrPreview(editingPallet)}
                    disabled={!editingPallet.qr_code.trim()}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-emerald-800 transition-colors hover:border-zinc-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <QrCode size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditingPalletDetails((current) => !current)}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-800 transition-colors hover:border-zinc-300 hover:bg-white"
                  >
                    {showEditingPalletDetails ? hideDetailLabel : detailToggleLabel}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPallet(null);
                      setShowEditingPalletDetails(false);
                    }}
                    className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('qrCode')}</label>
                      <input 
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-black" 
                        value={editingPallet.qr_code} 
                        onChange={e => setEditingPallet({...editingPallet, qr_code: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{referenceCodeLabel}</label>
                      <input
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-black"
                        value={editingPallet.reference_code || ''}
                        onChange={e => setEditingPallet({...editingPallet, reference_code: e.target.value || undefined})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('palletType')}</label>
                      <select
                        value={editingPallet.type}
                        onChange={e => setEditingPallet({...editingPallet, type: e.target.value})}
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      >
                        {getPalletTypeOptions(editingPallet.type).map((palletType) => (
                          <option
                            key={palletType}
                            value={palletType}
                          >
                            {getPalletTypeLabel(palletType, language)}
                          </option>
                        ))}
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('globalStatus')}</label>
                      <select 
                        value={editingPallet.current_status_id}
                        onChange={e => {
                          const sid = parseInt(e.target.value);
                          const sname = statuses.find(s => s.id === sid)?.name || '';
                          setEditingPallet({...editingPallet, current_status_id: sid, current_status_name: sname});
                        }}
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      >
                         {statuses.map(s => <option key={`filter-status-${s.id}`} value={s.id}>{getStatusLabel(s.name, language)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('assignedClient')}</label>
                      <select 
                        value={editingPallet.user_id || ''}
                        onChange={e => {
                          const uid = e.target.value ? parseInt(e.target.value) : undefined;
                          const cname = clients.find(c => c.user_id === uid)?.name || '';
                          setEditingPallet({...editingPallet, user_id: uid, client_name: cname});
                        }}
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      >
                         <option value="">{t('noClient')}</option>
                         {clients.map(c => <option key={`edit-client-${c.id}`} value={c.user_id}>{c.name}</option>)}
                      </select>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('physicalLocation')}</label>
                    <input 
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                      value={editingPallet.current_location} 
                      onChange={e => setEditingPallet({...editingPallet, current_location: e.target.value})}
                    />
                 </div>

                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('customOperationalNotes')}</label>
                     <textarea 
                      placeholder={t('addOperationalNotes')} 
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold text-sm h-24"
                      value={editingPallet.note || ''}
                      onChange={e => setEditingPallet({...editingPallet, note: e.target.value})}
                     />
                  </div>

                  <AnimatePresence initial={false}>
                    {showEditingPalletDetails && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-gray-100 pt-6"
                      >
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {t('location')}
                            </p>
                            <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                              {editingPallet.current_location || notAvailableLabel}
                            </p>
                          </div>
                          <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {t('status')}
                            </p>
                            <p className="mt-3 text-lg font-black uppercase leading-tight text-blue-600">
                              {getStatusLabel(editingPallet.current_status_name, language)}
                            </p>
                          </div>
                          <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {daysOutsideLabel}
                            </p>
                            <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                              {formatDaysOutsideValue(calculateDays(editingPallet.last_status_changed_at))}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4">
                          <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {t('timestamp')}
                            </p>
                            <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                              {latestEditingPalletStatusLog
                                ? detailDateFormatter.format(new Date(latestEditingPalletStatusLog.created_at))
                                : notAvailableLabel}
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div className="flex items-center gap-2">
                            <History size={16} className="text-gray-400" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                              {t('movementHistory')}
                            </h4>
                          </div>

                          <div className="space-y-2 max-h-[260px] overflow-y-auto no-scrollbar">
                            {editingPalletStatusHistory.map((log) => (
                              <div
                                key={`editing-log-${log.id}`}
                                className="flex items-start gap-4 rounded-[1.5rem] border border-gray-100 bg-white p-4"
                              >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-50">
                                  <MapPin size={16} className="text-gray-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-black uppercase tracking-tight text-gray-900">
                                    {getStatusLabel(log.new_status_name, language)}
                                  </p>
                                  <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-gray-500">
                                    {log.new_location || notAvailableLabel}
                                  </p>
                                  <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                                    {t('changedBy')}: {getAuditActorLabel(log)}
                                  </p>
                                  <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                                    <Clock size={12} />
                                    <span>{detailDateFormatter.format(new Date(log.created_at))}</span>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {editingPalletStatusHistory.length === 0 && (
                              <div className="rounded-[1.5rem] border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                  {noMovementHistoryLabel}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                      </motion.div>
                    )}
                  </AnimatePresence>
              </div>
              <div className="mt-8 grid grid-cols-3 items-center gap-4 border-t border-gray-100 pt-4">
                 <button 
                   onClick={() => {
                     handleDeletePallet(editingPallet);
                   }}
                   className="h-14 rounded-2xl border border-rose-100 bg-rose-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-100"
                 >
                    {t('remove')}
                  </button>
                  <button
                    onClick={() => {
                      setEditingPallet(null);
                      setShowEditingPalletDetails(false);
                    }}
                    className="h-14 rounded-2xl px-4 text-xs font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                  >
                    {t('cancel')}
                  </button>
                  <button onClick={() => {
                    updatePallet(editingPallet, { id: user.id, name: user.name });
                    setEditingPallet(null);
                    setShowEditingPalletDetails(false);
                    setSelectedPallet(null);
                  }} className="h-14 rounded-2xl bg-black px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-black/20 transition-transform hover:scale-[1.02]">{t('saveChanges')}</button>
               </div>
            </motion.div>
          </div>
        )}

        {qrPreview && (
          <div className="modal-overlay fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-6 text-center shadow-2xl"
            >
              <div className="mb-5 flex items-start justify-between gap-4 text-left">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                    {t('palletQrCode')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setQrPreview(null)}
                  className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="rounded-[2rem] border border-zinc-100 bg-zinc-50 p-4 text-zinc-950">
                <PalletQrCode value={qrPreview.value} className="mx-auto aspect-square w-full max-w-[260px]" />
              </div>

              <p className="mt-4 break-all rounded-2xl bg-zinc-50 px-4 py-3 text-xs font-black uppercase tracking-tight text-zinc-700">
                {qrPreview.label}
              </p>

              <button
                type="button"
                onClick={() => setQrPreview(null)}
                className="mt-5 h-12 w-full rounded-2xl bg-black px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-black/10"
              >
                {t('close')}
              </button>
            </motion.div>
          </div>
        )}

        {showAddStatus && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-black uppercase mb-6 text-center">{t('newStatus')}</h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('statusName')}</label>
                    <input 
                      autoFocus 
                      placeholder={t('exampleReturnedPlaceholder')} 
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      value={newStatusData.name}
                      onChange={e => setNewStatusData({...newStatusData, name: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                       <span className="text-[10px] font-black uppercase text-gray-400">{t('activeLabel')}</span>
                       <button onClick={() => setNewStatusData({...newStatusData, is_active: !newStatusData.is_active})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_active ? 'bg-black' : 'bg-gray-200'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_active ? 'left-5' : 'left-1'}`} />
                       </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                       <span className="text-[10px] font-black uppercase text-gray-400">{t('isBillable')}</span>
                       <button onClick={() => setNewStatusData({...newStatusData, is_billable: !newStatusData.is_billable})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_billable ? 'bg-blue-600' : 'bg-gray-200'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_billable ? 'left-5' : 'left-1'}`} />
                       </button>
                    </div>
                 </div>
                 {newStatusData.is_billable && (
                   <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('gracePeriodDaysLabel')}</label>
                         <input type="number" value={newStatusData.grace_period_days} onChange={e => setNewStatusData({...newStatusData, grace_period_days: parseInt(e.target.value)})} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('pricePerDayLabel')} ({'\u20AC'})</label>
                         <input type="number" step="0.1" value={newStatusData.price_per_day} onChange={e => setNewStatusData({...newStatusData, price_per_day: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                      </div>
                   </div>
                 )}
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setShowAddStatus(false)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">{t('cancel')}</button>
                 <button 
                  onClick={() => {
                    if (newStatusData.name) {
                      addStatus(newStatusData);
                      setShowAddStatus(false);
                      setNewStatusData({ name: '', is_active: true, is_billable: false, grace_period_days: 14, price_per_day: 0 });
                    }
                  }} 
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-black/20"
                >
                  {t('createStatus')}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddPallet && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
              <h3 className="text-xl font-black uppercase mb-6">{t('newPalletEntry')}</h3>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{addPalletModeLabel}</label>
                    <div className="grid grid-cols-2 gap-3 rounded-[1.5rem] bg-zinc-100 p-1.5">
                      <button
                        type="button"
                        onClick={() => setNewPalletMode('single')}
                        className={`rounded-[1.15rem] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                          newPalletMode === 'single'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-zinc-500 hover:text-black'
                        }`}
                      >
                        {singlePalletLabel}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPalletMode('bulk')}
                        className={`rounded-[1.15rem] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                          newPalletMode === 'bulk'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-zinc-500 hover:text-black'
                        }`}
                      >
                        {bulkPalletLabel}
                      </button>
                    </div>
                 </div>

                 {newPalletMode === 'single' ? (
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('qrCodeIdentification')}</label>
                      <input
                        autoFocus
                        placeholder={t('qrPlaceholder')}
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                        value={newPalletQr}
                        onChange={(event) => setNewPalletQr(event.target.value)}
                      />
                   </div>
                 ) : (
                   <div className="space-y-4 rounded-[1.8rem] border border-zinc-100 bg-zinc-50/80 p-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{qrPrefixLabel}</label>
                        <input
                          className="w-full p-4 bg-white border border-zinc-200 rounded-2xl font-bold uppercase"
                          value={bulkQrPrefix}
                          onChange={(event) => setBulkQrPrefix(event.target.value.toUpperCase())}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{rangeFromLabel}</label>
                          <input
                            autoFocus
                            inputMode="numeric"
                            className="w-full p-4 bg-white border border-zinc-200 rounded-2xl font-bold"
                            value={bulkQrStart}
                            onChange={(event) => setBulkQrStart(event.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{rangeToLabel}</label>
                          <input
                            inputMode="numeric"
                            className="w-full p-4 bg-white border border-zinc-200 rounded-2xl font-bold"
                            value={bulkQrEnd}
                            onChange={(event) => setBulkQrEnd(event.target.value.replace(/\D/g, ''))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{totalCreateLabel}</p>
                          <p className="mt-2 text-lg font-black tracking-tight text-zinc-900">
                            {hasValidBulkRange ? bulkCreateCount : '--'}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">{bulkHintLabel}</p>
                          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-900">
                            {getStatusLabel('Onbekend', language)}
                          </p>
                        </div>
                      </div>

                      {!hasValidBulkRange && (bulkQrStart || bulkQrEnd) && (
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-500">
                          {invalidRangeLabel}
                        </p>
                      )}
                   </div>
                 )}

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('palletType')}</label>
                    <select
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      value={newPalletType}
                      onChange={(event) => setNewPalletType(event.target.value)}
                    >
                      {getPalletTypeOptions().map((palletType) => (
                        <option
                          key={palletType}
                          value={palletType}
                        >
                          {getPalletTypeLabel(palletType, language)}
                        </option>
                      ))}
                    </select>
                  </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={closeAddPalletModal} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">{t('cancel')}</button>
                 <button
                   onClick={handleCreatePallets}
                   disabled={newPalletMode === 'single' ? !newPalletQr.trim() : !hasValidBulkRange}
                   className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs disabled:cursor-not-allowed disabled:opacity-40"
                 >
                   {newPalletMode === 'bulk' ? createBulkLabel : t('createUnit')}
                 </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddClient && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
              <h3 className="text-xl font-black uppercase mb-6">{t('onboardNewClient')}</h3>
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('companyName')}</label>
                     <input id="new-client-name" placeholder={t('companyNamePlaceholder')} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                  </div>
                  <div className="col-span-2 space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">KVK</label>
                     <input
                       id="new-client-kvk"
                       placeholder="e.g. 74291836"
                       className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                     />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('gracePeriodDaysLabel')}</label>
                     <input id="new-client-grace" type="number" defaultValue={14} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                  </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('ratePerDayLabel')} ({'\u20AC'})</label>
                    <input id="new-client-rate" type="number" step="0.1" defaultValue={2.5} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('locationMarket')}</label>
                    <select id="new-client-country" className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold">
                       <option value="NL">{getCountryLabel('NL', language)}</option>
                       <option value="BiH">{getCountryLabel('BiH', language)}</option>
                       <option value="DE">{getCountryLabel('DE', language)}</option>
                    </select>
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       {language === 'bs' ? 'Adresa magacina 1' : language === 'nl' ? 'Magazijnadres 1' : 'Warehouse Address 1'}
                    </label>
                    <input id="new-client-address1" placeholder={language === 'bs' ? 'npr. Veldhovenweg 18, Eindhoven' : 'e.g. Veldhovenweg 18, Eindhoven'} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       {language === 'bs' ? 'Adresa magacina 2' : language === 'nl' ? 'Magazijnadres 2' : 'Warehouse Address 2'}
                    </label>
                    <input id="new-client-address2" placeholder={language === 'bs' ? 'npr. Waalhaven Zuidzijde 19, Rotterdam' : 'e.g. Waalhaven Zuidzijde 19, Rotterdam'} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setShowAddClient(false)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">{t('cancel')}</button>
                  <button onClick={() => {
                     const name = (document.getElementById('new-client-name') as HTMLInputElement).value;
                     const kvk = (document.getElementById('new-client-kvk') as HTMLInputElement).value.trim();
                     const grace = parseInt((document.getElementById('new-client-grace') as HTMLInputElement).value);
                     const rate = parseFloat((document.getElementById('new-client-rate') as HTMLInputElement).value);
                     const country = (document.getElementById('new-client-country') as HTMLSelectElement).value;
                     const address1 = (document.getElementById('new-client-address1') as HTMLInputElement).value.trim();
                     const address2 = (document.getElementById('new-client-address2') as HTMLInputElement).value.trim();
                    if (name) {
                        addClient({ 
                          name, 
                          kvk_number: kvk || undefined,
                          grace_period_days: grace, 
                          price_per_day: rate, 
                          country, 
                          is_active: true,
                          warehouse_addresses: [address1, address2].filter(Boolean) 
                        });
                        setShowAddClient(false);
                     }
                 }} className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs">{t('registerClient')}</button>
              </div>
            </motion.div>
          </div>
        )}

        {editingClient && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase">{t('editClientRules')}</h3>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{t('clientIdLabel')}: {editingClient.user_id}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">KVK</label>
                    <input
                      type="text"
                      value={editingClient.kvk_number || ''}
                      onChange={e => setEditingClient({...editingClient, kvk_number: e.target.value})}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                    />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('gracePeriodDaysLabel')}</label>
                    <input 
                      type="number" 
                      value={editingClient.grace_period_days} 
                      onChange={e => setEditingClient({...editingClient, grace_period_days: parseInt(e.target.value)})}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                    />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('dailyRateOverride')} ({'\u20AC'})</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={editingClient.price_per_day} 
                      onChange={e => setEditingClient({...editingClient, price_per_day: parseFloat(e.target.value)})}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                    />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       {language === 'bs' ? 'Adresa magacina 1' : language === 'nl' ? 'Magazijnadres 1' : 'Warehouse Address 1'}
                    </label>
                    <input 
                      type="text" 
                      value={editingClient.warehouse_addresses?.[0] || ''} 
                      onChange={e => {
                        const addresses = [...(editingClient.warehouse_addresses || [])];
                        // Make sure we have enough space in array
                        if (addresses.length < 1) {
                          addresses[0] = '';
                        }
                        addresses[0] = e.target.value;
                        setEditingClient({...editingClient, warehouse_addresses: addresses});
                      }}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                    />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       {language === 'bs' ? 'Adresa magacina 2' : language === 'nl' ? 'Magazijnadres 2' : 'Warehouse Address 2'}
                    </label>
                    <input 
                      type="text" 
                      value={editingClient.warehouse_addresses?.[1] || ''} 
                      onChange={e => {
                        const addresses = [...(editingClient.warehouse_addresses || [])];
                        // Make sure we have enough space in array
                        while (addresses.length < 2) {
                          addresses.push('');
                        }
                        addresses[1] = e.target.value;
                        setEditingClient({...editingClient, warehouse_addresses: addresses});
                      }}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                    />
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setEditingClient(null)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">{t('discard')}</button>
                 <button onClick={() => {
                    const cleanedAddresses = (editingClient.warehouse_addresses || [])
                      .map(a => a.trim())
                      .filter(Boolean);
                    updateClient({...editingClient, warehouse_addresses: cleanedAddresses});
                    setEditingClient(null);
                  }} className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs">{t('updateSettings')}</button>
              </div>
            </motion.div>
          </div>
        )}

        {showDamageModal && (
          <DamageReportModal 
            currentUser={user}
            onClose={() => setShowDamageModal(false)}
          />
        )}

        <DeleteConfirmModal
          open={Boolean(deleteConfirm)}
          title={`${t('remove')}?`}
          subject={
            deleteConfirm
              ? deleteConfirm.kind === 'pallet'
                ? getPalletDisplayName(deleteConfirm.pallet)
                : getStatusLabel(deleteConfirm.status.name, language)
              : undefined
          }
          message={
            deleteConfirm
              ? deleteConfirm.kind === 'pallet'
                ? t('confirmDeleteUnit')
                : t('confirmDeleteStatus')
              : ''
          }
          confirmLabel={t('remove')}
          cancelLabel={t('cancel')}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={confirmDeleteAction}
        />

        {showScanner && (
          <PalletScanner 
            currentUser={user} 
            onClose={() => setShowScanner(false)} 
            onPalletDetected={(pallet) => {
              setShowScanner(false);
              setSelectedPallet(pallet);
            }}
          />
        )}

        {selectedOverdueInvoice && (
          <OverdueInvoiceModal
            invoice={selectedOverdueInvoice}
            onClose={() => setSelectedOverduePalletId(null)}
            onSend={() => {
              const pallet = pallets.find(item => item.id === selectedOverdueInvoice.pallet_id);
              if (pallet) {
                handleSendInvoice(pallet);
              }
            }}
          />
        )}
      </AnimatePresence>
      {view === 'logs' && (
        <AdminAuditLogs
          auditLogs={auditLogs}
          pallets={pallets}
          clients={clients}
          language={language}
          t={t}
          onSelectPallet={setSelectedPallet}
          onExport={handleExportPdf}
        />
      )}
    </div>
  );
};
