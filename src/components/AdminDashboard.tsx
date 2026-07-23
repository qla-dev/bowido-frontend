import React, { useState } from "react";
import {
  Package,
  Truck,
  AlertTriangle,
  Users,
  Filter,
  MoreVertical,
  MapPin,
  Clock,
  Settings as SettingsIcon,
  Plus,
  History,
  ClipboardList,
  TrendingUp,
  Info,
  Search,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import { StatCard, Card, Button, Input, Select, Badge, cn } from "./ui";
import { PalletScanner } from "./PalletScanner";
import { DamageReportModal } from "./DamageReportModal";
import { BillingList } from "./BillingList";
import { RoleManager } from "./RoleManager";
import { PalletTableView } from "./PalletTableView";
import { PalletQrCode } from "./PalletQrCode";
import { BillingCalendar } from "./BillingCalendar";
import { UserManager } from "./UserManager";
import {
  OverdueInvoiceModal,
  OverdueInvoicePreview,
} from "./OverdueInvoiceModal";
import { AdminAuditLogs } from "./AdminAuditLogs";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { NoQrPalletTableView } from "./NoQrPalletTableView";
import { ClientTableView } from "./ClientTableView";
import { AdminClientManagerView } from "./AdminClientManagerView";
import { AdminRoleOperationsView } from "./AdminRoleOperationsView";
import { useApp } from "../AppContext";
import { apiService } from "../services/api";
import { motion, AnimatePresence } from "motion/react";
import { appAlert } from "./AppAlert";
import {
  RoleType,
  Pallet,
  PalletDashboardStats,
  PalletStatus,
  ClientDetail,
  User,
  AuditLog,
} from "../types";
import {
  CreditCard,
  Shield,
  Calendar as CalendarIcon,
  Eye,
  Send,
  Ghost,
  QrCode,
} from "lucide-react";
import {
  getCountryLabel,
  getLocationLabel,
  getPalletTypeLabel,
  getStatusLabel,
  normalizePalletTypeCode,
  palletTypeValues,
} from "../i18n";
import { getPalletDisplayName } from "../lib/palletDisplay";
import { statusIdAllowsCustomer } from "../lib/palletCustomerAssignment";
import { formatAppDateTime, formatAppTime } from "../lib/dateFormat";

interface AdminDashboardProps {
  initialView?:
    | "overview"
    | "pallets"
    | "clients"
    | "users"
    | "settings"
    | "logs"
    | "billing"
    | "roles"
    | "calendar"
    | "noQrPallets"
    | "clientManager"
    | "adminService"
    | "adminWarehouse"
    | "adminFinance";
  user: User;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
  openPalletId?: number | null;
  onPalletDetailOpened?: () => void;
}

type DeleteConfirmState =
  | { kind: "pallet"; pallet: Pallet }
  | { kind: "status"; status: PalletStatus }
  | null;

const FIXED_WAREHOUSE_LOCATION_BY_STATUS_ID: Partial<Record<number, string>> = {
  1: "Nikole Tesle 71",
  3: "Maxwellstraat 2-4, 3316 GP Dordrecht",
};

const getFixedWarehouseLocation = (statusId?: number, statusName?: string) => {
  if (statusId && FIXED_WAREHOUSE_LOCATION_BY_STATUS_ID[statusId]) {
    return FIXED_WAREHOUSE_LOCATION_BY_STATUS_ID[statusId];
  }

  const normalizedStatusName = (statusName || "")
    .toLowerCase()
    .replace(/\s+/g, "");

  if (
    normalizedStatusName === "bowido(nl)" ||
    normalizedStatusName === "bowidonl"
  ) {
    return "Maxwellstraat 2-4, 3316 GP Dordrecht";
  }

  if (normalizedStatusName === "bowidobih") {
    return "Nikole Tesle 71";
  }

  return undefined;
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  initialView = "overview",
  user,
  isNightMode = false,
  onToggleNightMode,
  openPalletId = null,
  onPalletDetailOpened,
}) => {
  const {
    pallets,
    statuses,
    clients,
    auditLogs,
    serviceReports,
    updateStatusSettings,
    addStatus,
    deleteStatus,
    addPallet,
    addPalletBatch,
    updatePallet,
    deletePallet,
    addClient,
    updateClient,
    setIsGhostReportOpen,
    fetchAuditLogs,
    t,
    language,
  } = useApp();
  const [view, setView] = useState<
    | "overview"
    | "pallets"
    | "clients"
    | "users"
    | "settings"
    | "logs"
    | "billing"
    | "roles"
    | "calendar"
    | "noQrPallets"
    | "clientManager"
    | "adminService"
    | "adminWarehouse"
    | "adminFinance"
  >(initialView);
  const [editingStatus, setEditingStatus] = useState<PalletStatus | null>(null);
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [newStatusData, setNewStatusData] = useState<Omit<PalletStatus, "id">>({
    name: "",
    is_active: true,
    is_billable: false,
    grace_period_days: 14,
    price_per_day: 0,
  });

  // Modals
  const [showAddPallet, setShowAddPallet] = useState(false);
  const [newPalletMode, setNewPalletMode] = useState<"single" | "bulk">(
    "single",
  );
  const [newPalletQr, setNewPalletQr] = useState("");
  const [newPalletType, setNewPalletType] = useState<string>(
    palletTypeValues[0],
  );
  const [bulkQrPrefix, setBulkQrPrefix] = useState("BOWNL-");
  const [bulkQrStart, setBulkQrStart] = useState("");
  const [bulkQrEnd, setBulkQrEnd] = useState("");
  const [showAddClient, setShowAddClient] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDetail | null>(null);
  const [clientPasswordDraft, setClientPasswordDraft] = useState("");
  const [clientPasswordMessage, setClientPasswordMessage] = useState<
    string | null
  >(null);
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [editingPallet, setEditingPallet] = useState<Pallet | null>(null);
  const [editingPalletClientSearch, setEditingPalletClientSearch] =
    useState("");
  const [isEditingPalletClientListOpen, setIsEditingPalletClientListOpen] =
    useState(false);
  const [showEditingPalletDetails, setShowEditingPalletDetails] =
    useState(false);
  const [qrPreview, setQrPreview] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [selectedOverduePalletId, setSelectedOverduePalletId] = useState<
    number | null
  >(null);
  const [sentInvoiceTimestamps, setSentInvoiceTimestamps] = useState<
    Record<number, string>
  >({});
  const [sendingInvoicePalletIds, setSendingInvoicePalletIds] = useState<
    number[]
  >([]);
  const [invoiceDeliveryError, setInvoiceDeliveryError] =
    useState<Pallet | null>(null);
  const [dashboardStats, setDashboardStats] =
    useState<PalletDashboardStats | null>(null);
  const [palletAuditLogsById, setPalletAuditLogsById] = useState<
    Record<number, AuditLog[]>
  >({});

  // Sync view with prop changes (e.g. from sidebar)
  React.useEffect(() => {
    setView(initialView);
  }, [initialView]);

  React.useEffect(() => {
    if (view === "logs") {
      void fetchAuditLogs();
    }
  }, [view]);

  React.useEffect(() => {
    if (view !== "overview") {
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
        console.error("Failed to load pallet dashboard stats", error);

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
        sort_by: "created_at",
        sort_direction: "desc",
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
      .catch((error) =>
        console.error("Failed to load pallet audit history", error),
      );

    return () => {
      isCancelled = true;
    };
  }, [activeDetailPalletId]);

  const calculateDays = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const calculateDebt = (p: Pallet) => {
    const status = statuses.find((s) => s.id === p.current_status_id);
    if (!status || !status.is_billable) return 0;

    const client = clients.find((c) => c.user_id === p.user_id);
    const graceDays = client?.grace_period_days ?? status.grace_period_days;
    const pricePerDay = client?.price_per_day ?? status.price_per_day;

    const days = calculateDays(p.last_status_changed_at);
    if (days <= graceDays) return 0;
    return (days - graceDays) * pricePerDay;
  };

  const isNetherlandsCountry = (country: string) =>
    country === "NL" || country === "Netherlands";

  const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const addPalletModeLabel = t("entryMode");
  const singlePalletLabel = t("singlePallet");
  const bulkPalletLabel = t("bulkEntry");
  const qrPrefixLabel = t("qrPrefix");
  const rangeFromLabel = t("rangeFrom");
  const rangeToLabel = t("rangeTo");
  const totalCreateLabel = t("totalToCreate");
  const invalidRangeLabel = t("invalidRange");
  const bulkHintLabel = t("newPalletStatus");
  const createBulkLabel = t("createPallets");

  const parseBulkNumber = (value: string) => {
    const trimmedValue = value.trim();
    return /^\d+$/.test(trimmedValue) ? Number(trimmedValue) : null;
  };

  const bulkStartNumber = parseBulkNumber(bulkQrStart);
  const bulkEndNumber = parseBulkNumber(bulkQrEnd);
  const hasValidBulkRange =
    bulkStartNumber !== null &&
    bulkEndNumber !== null &&
    bulkEndNumber >= bulkStartNumber;
  const bulkCreateCount = hasValidBulkRange
    ? bulkEndNumber - bulkStartNumber + 1
    : 0;

  const resetAddPalletForm = () => {
    setNewPalletMode("single");
    setNewPalletQr("");
    setNewPalletType(palletTypeValues[0]);
    setBulkQrPrefix("BOWNL-");
    setBulkQrStart("");
    setBulkQrEnd("");
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
    if (
      !hasValidBulkRange ||
      bulkStartNumber === null ||
      bulkEndNumber === null
    ) {
      return [];
    }

    const paddingLength = Math.max(
      bulkQrStart.trim().length,
      bulkQrEnd.trim().length,
      1,
    );

    return Array.from({ length: bulkCreateCount }, (_, index) => {
      const nextNumber = bulkStartNumber + index;
      return `${bulkQrPrefix}${String(nextNumber).padStart(paddingLength, "0")}`.toUpperCase();
    });
  };

  const handleCreatePallets = () => {
    const normalizedType =
      normalizePalletTypeCode(newPalletType) || newPalletType;

    if (newPalletMode === "single") {
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

  const buildOverdueInvoicePreview = (
    pallet: Pallet,
  ): OverdueInvoicePreview => {
    const client = clients.find((c) => c.user_id === pallet.user_id);
    const status = statuses.find((s) => s.id === pallet.current_status_id);
    const graceDays =
      client?.grace_period_days ?? status?.grace_period_days ?? 0;
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
      invoice_number: `INV-OVD-2026-${String(pallet.id).padStart(4, "0")}`,
      pallet_id: pallet.id,
      pallet_qr: getPalletDisplayName(pallet),
      customer_name: client?.name || pallet.client_name || "Warehouse Holding",
      recipient_email: client?.billing_email || "",
      user_id: pallet.user_id ?? 1,
      billing_period_start: formatDateOnly(billingStart),
      billing_period_end: formatDateOnly(billingEnd),
      total_amount: calculateDebt(pallet),
      status: sentAt ? "sent" : "active",
      issued_at: formatDateTime(issuedAt),
      created_at: formatDateTime(issuedAt),
      updated_at:
        sentAt || formatDateTime(new Date(issuedAt.getTime() + 15 * 60 * 1000)),
      overdue_days: overdueDays,
      rate_per_day: pricePerDay,
      location: pallet.current_location,
    };
  };

  const selectedOverdueInvoice = selectedOverduePalletId
    ? (() => {
        const pallet = pallets.find(
          (item) => item.id === selectedOverduePalletId,
        );
        return pallet ? buildOverdueInvoicePreview(pallet) : null;
      })()
    : null;

  const handleSendInvoice = async (pallet: Pallet) => {
    const client = clients.find((item) => item.user_id === pallet.user_id);
    console.info("[TrackPal] Dashboard invoice button clicked", {
      palletId: pallet.id,
      pallet: getPalletDisplayName(pallet),
      recipient: client?.billing_email || null,
      action: "request_overdue_invoice_delivery",
    });

    setSendingInvoicePalletIds((current) => [...current, pallet.id]);

    try {
      const result = await apiService.pallets.sendOverdueInvoice(pallet.id);
      console.info("[TrackPal] Dashboard invoice delivered", {
        palletId: pallet.id,
        invoiceId: result.invoice_id,
        recipient: result.recipient,
      });
      setSentInvoiceTimestamps((prev) => ({
        ...prev,
        [pallet.id]: formatDateTime(new Date()),
      }));
    } catch (error) {
      console.error("[TrackPal] Dashboard invoice delivery failed", {
        palletId: pallet.id,
        error,
      });
      setInvoiceDeliveryError(pallet);
    } finally {
      setSendingInvoicePalletIds((current) =>
        current.filter((id) => id !== pallet.id),
      );
    }
  };

  const handleEditPallet = (pallet: Pallet) => {
    const fixedLocation = getFixedWarehouseLocation(
      pallet.current_status_id,
      pallet.current_status_name,
    );

    setSelectedPallet(null);
    setShowEditingPalletDetails(false);
    setEditingPalletClientSearch(
      clients.find((client) => client.user_id === pallet.user_id)?.name ||
        pallet.client_name ||
        "",
    );
    setIsEditingPalletClientListOpen(false);
    setEditingPallet({
      ...pallet,
      current_location: fixedLocation || pallet.current_location,
      type: normalizePalletTypeCode(pallet.type) || pallet.type,
    });
  };

  const handleDeletePallet = (pallet: Pallet) => {
    setDeleteConfirm({ kind: "pallet", pallet });
  };

  const handleEditClient = (client: ClientDetail) => {
    setEditingClient(client);
    setClientPasswordDraft("");
    setClientPasswordMessage(null);
  };

  const handleCloseClientModal = () => {
    setEditingClient(null);
    setClientPasswordDraft("");
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
      setClientPasswordDraft("");
      setClientPasswordMessage(t("passwordUpdated"));
    } catch {
      setClientPasswordMessage(t("linkedUserNotFound"));
    }
  };

  const handleDeleteStatus = (status: PalletStatus) => {
    setDeleteConfirm({ kind: "status", status });
  };

  const confirmDeleteAction = () => {
    if (!deleteConfirm) {
      return;
    }

    if (deleteConfirm.kind === "pallet") {
      deletePallet(deleteConfirm.pallet.id);
      setEditingPallet((current) =>
        current?.id === deleteConfirm.pallet.id ? null : current,
      );
      setSelectedPallet((current) =>
        current?.id === deleteConfirm.pallet.id ? null : current,
      );
    }

    if (deleteConfirm.kind === "status") {
      deleteStatus(deleteConfirm.status.id);
      setEditingStatus((current) =>
        current?.id === deleteConfirm.status.id ? null : current,
      );
    }

    setDeleteConfirm(null);
  };

  const databasePalletTypeOptions = React.useMemo(
    () =>
      Array.from<string>(
        new Set(
          pallets
            .map(
              (pallet) => normalizePalletTypeCode(pallet.type) || pallet.type,
            )
            .filter((value): value is string => Boolean(value && value.trim())),
        ),
      ).sort((left, right) =>
        left.localeCompare(right, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
    [pallets],
  );

  const getPalletTypeOptions = (currentType?: string) =>
    Array.from(
      new Set(
        [
          normalizePalletTypeCode(currentType || ""),
          ...databasePalletTypeOptions,
          ...palletTypeValues,
        ].filter((value): value is string => Boolean(value && value.trim())),
      ),
    );

  const openQrPreview = (pallet: Pallet) => {
    const value = pallet.qr_code.trim();
    if (!value) return;

    setQrPreview({
      value,
      label: getPalletDisplayName(pallet) || value,
    });
  };

  const hideDetailLabel = t("hideDetails");
  const showDetailLabel = t("showDetails");
  const palletDetailTitleLabel = language === "nl" ? "Boknummer" : t("pallets");
  const palletDetailFieldLabel = language === "nl" ? "Boknummer" : t("palletLabel");
  const daysOutsideLabel = t("daysOut");
  const detailsSectionLabel = t("details");
  const noMovementHistoryLabel = t("noMovementHistory");
  const notAvailableLabel = t("valueUnavailable");
  const getAssignedClient = (pallet: Pallet) =>
    pallet.user_id
      ? clients.find((client) => client.user_id === pallet.user_id)
      : undefined;
  const getPrimaryClientAddress = (client?: ClientDetail) =>
    client?.warehouse_addresses?.map((address) => address.trim()).find(Boolean);
  const isAtCustomerStatus = (pallet: Pallet) =>
    pallet.current_status_id === 4 ||
    pallet.current_status_name === "Bij de klant" ||
    pallet.current_status_name === "At Customer";
  const getStatusLocationLabel = (pallet: Pallet) => {
    const fixedLocation = getFixedWarehouseLocation(
      pallet.current_status_id,
      pallet.current_status_name,
    );
    const assignedClient = getAssignedClient(pallet);
    const clientAddress = getPrimaryClientAddress(assignedClient);

    if (fixedLocation) {
      return fixedLocation;
    }

    if (isAtCustomerStatus(pallet)) {
      return (
        getLocationLabel(pallet.current_location?.trim(), language) ||
        clientAddress ||
        notAvailableLabel
      );
    }

    return (
      getLocationLabel(pallet.current_location?.trim(), language) ||
      clientAddress ||
      notAvailableLabel
    );
  };
  const getAssignedClientLabel = (pallet: Pallet) =>
    getAssignedClient(pallet)?.name || pallet.client_name || t("noClient");
  const getPalletTitleLabel = (pallet: Pallet) =>
    getPalletDisplayName(pallet) || notAvailableLabel;
  const getAuditPalletDisplayName = (log: AuditLog) =>
    getPalletDisplayName(
      pallets.find((pallet) => pallet.id === log.pallet_id),
    ) || log.pallet_qr;
  const renderPalletInfoTile = (
    label: string,
    value: React.ReactNode,
    className?: string,
  ) => (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/[0.06]",
        className,
      )}
    >
      <p className="text-[11px] font-bold tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="mt-2 break-words text-[15px] font-black leading-5 text-zinc-950 dark:text-white">
        {value}
      </div>
    </div>
  );
  const formatDaysOutsideValue = (days: number) => {
    return `${days} ${days === 1 ? t("daySingular") : t("dayPlural")}`;
  };
  const detailDateFormatter = {
    format: (value: string | number | Date) =>
      formatAppDateTime(value, language, notAvailableLabel),
  };
  const buildFallbackStatusLog = (pallet: Pallet): AuditLog => {
    return {
      id: -pallet.id,
      pallet_id: pallet.id,
      pallet_qr: getPalletDisplayName(pallet),
      made_by_user_id: 0,
      made_by_user_name: "",
      type: "status",
      old_status_id: pallet.current_status_id,
      new_status_id: pallet.current_status_id,
      old_status_name: pallet.current_status_name,
      new_status_name: pallet.current_status_name,
      old_client_id: pallet.user_id,
      new_client_id: pallet.user_id,
      old_location: pallet.current_location,
      new_location: pallet.current_location,
      note: "",
      created_at: pallet.last_status_changed_at || pallet.created_at,
    };
  };
  const matchesPalletCurrentState = (log: AuditLog, pallet: Pallet) =>
    (log.type || "status") === "status" &&
    log.new_status_id === pallet.current_status_id &&
    log.new_status_name === pallet.current_status_name &&
    (log.new_location || "").trim() === (pallet.current_location || "").trim();
  const ensureCurrentStatusLog = (logs: AuditLog[], pallet: Pallet) => {
    const currentStateLogIndex = logs.findIndex((log) =>
      matchesPalletCurrentState(log, pallet),
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
      if (log.pallet_id === pallet.id && (log.type || "status") === "status") {
        logsById.set(log.id, log);
      }
    });

    const logs = Array.from(logsById.values()).sort(
      (left, right) =>
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime(),
    );

    if (logs.length === 0) {
      return [buildFallbackStatusLog(pallet)];
    }

    return ensureCurrentStatusLog(logs, pallet);
  };
  const getAuditActorLabel = (log: AuditLog) =>
    log.made_by_user_name?.trim() ||
    (log.made_by_user_id ? `#${log.made_by_user_id}` : notAvailableLabel);
  const getAuditClientLabel = (clientId?: number) =>
    clientId
      ? clients.find((client) => client.user_id === clientId)?.name ||
        `#${clientId}`
      : "";
  const selectedPalletStatusHistory = selectedPallet
    ? getPalletStatusHistory(selectedPallet)
    : [];
  const latestSelectedPalletStatusLog = selectedPalletStatusHistory[0] || null;
  const editingPalletStatusHistory = editingPallet
    ? getPalletStatusHistory(editingPallet)
    : [];
  const editingPalletAuditHistory = editingPalletStatusHistory.filter(
    (log) => log.id > 0,
  );
  const latestEditingPalletStatusLog = editingPalletStatusHistory[0] || null;
  const isEditingPalletPickupCustomer =
    statuses.find(
      (status) => status.id === editingPallet?.current_status_id,
    )?.slug === "ophalen-klant";
  const filteredEditingPalletClients = React.useMemo(() => {
    const query = editingPalletClientSearch.trim().toLocaleLowerCase();

    return clients
      .filter((client) => {
        if (!query) {
          return true;
        }

        return [
          client.name,
          client.country,
          client.kvk_number,
          String(client.user_id),
        ].some((value) => value?.toLocaleLowerCase().includes(query));
      })
      .sort((left, right) =>
        left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
  }, [clients, editingPalletClientSearch]);

  const renderOverview = () => {
    const overduePallets = pallets.filter((p) => calculateDebt(p) > 0);
    const topOverduePallets = [...overduePallets]
      .sort((left, right) => calculateDebt(right) - calculateDebt(left))
      .slice(0, 10);
    const totalDebt = pallets.reduce((acc, p) => acc + calculateDebt(p), 0);
    const ghostPallets = pallets.filter((p) => p.is_ghost);
    const latestActivityLogs = auditLogs
      .filter((log) => (log.type || "status") === "status")
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      )
      .slice(0, 5);
    const latestInventoryPallets = [...pallets]
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      )
      .slice(0, 5);
    const activePallets = pallets.filter(
      (pallet) => pallet.is_active && !pallet.is_ghost,
    );
    const deployedPallets = activePallets.filter(
      (pallet) =>
        statusIdAllowsCustomer(statuses, pallet.current_status_id) ||
        [2, 6].includes(pallet.current_status_id),
    );
    const utilizationRate =
      activePallets.length > 0
        ? (deployedPallets.length / activePallets.length) * 100
        : 0;
    const activeClientCount = new Set(
      deployedPallets.map((pallet) => pallet.user_id).filter(Boolean),
    ).size;
    const quickAnalysisCopy =
      language === "bs"
        ? {
            logistics: `${deployedPallets.length} od ${activePallets.length} aktivnih paleta je kod klijenata ili u transportu, kod ${activeClientCount} klijenata.`,
            overdue:
              overduePallets.length > 0
                ? `${overduePallets.length} paleta je u kašnjenju i zahtijeva akciju (€${totalDebt.toFixed(2)} dugovanja).`
                : "Nema paleta u kašnjenju koje zahtijevaju akciju.",
          }
        : language === "nl"
          ? {
              logistics: `${deployedPallets.length} van ${activePallets.length} actieve bokken zijn bij klanten of onderweg, verdeeld over ${activeClientCount} klanten.`,
              overdue:
                overduePallets.length > 0
                  ? `${overduePallets.length} bokken zijn te laat en vereisen actie (€${totalDebt.toFixed(2)} openstaand).`
                  : "Er zijn geen achterstallige bokken die actie vereisen.",
            }
          : {
              logistics: `${deployedPallets.length} of ${activePallets.length} active pallets are deployed or in transport across ${activeClientCount} clients.`,
              overdue:
                overduePallets.length > 0
                  ? `${overduePallets.length} overdue pallets require action (€${totalDebt.toFixed(2)} outstanding).`
                  : "No overdue pallets require action.",
            };
    const overviewStats = dashboardStats ?? {
      total_pallets: pallets.length,
      in_transport: pallets.filter((p) => [2, 6].includes(p.current_status_id))
        .length,
      overdue_units: overduePallets.length,
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("totalPallets")}
            value={overviewStats.total_pallets.toString()}
          />
          <StatCard
            label={t("inTransit")}
            value={overviewStats.in_transport.toString()}
            variant="info"
          />
          <StatCard
            label={t("overdueUnits")}
            value={overviewStats.overdue_units.toString()}
            trend={
              overviewStats.overdue_units > 0
                ? t("actionRequired")
                : t("allGood")
            }
            trendUp={false}
            variant="danger"
          />
          <StatCard
            label={t("totalAccrued")}
            value={`\u20AC${totalDebt.toFixed(2)}`}
            trend="Live"
            trendUp
            variant="success"
          />
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(22rem,0.8fr)]">
          <div className="grid min-w-0 gap-4 xl:grid-rows-[auto_minmax(24rem,1fr)]">
            <Card
              title={`${t("revenueRecovery")} (${t("overdue")})`}
              noPadding
              className="overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50 px-4 py-2.5">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={14} />
                  <span className="text-[11px] font-bold tracking-[0.08em]">
                    {overduePallets.length > 0
                      ? `${t("actionRequired")} (${overduePallets.length})`
                      : t("allGood")}
                  </span>
                </div>
                <Badge
                  variant={overduePallets.length > 0 ? "danger" : "success"}
                >
                  {overduePallets.length > 0 ? t("overdue") : t("allGood")}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                {overduePallets.length > 0 ? (
                  <table className="w-full">
                    <thead className="border-b border-zinc-200 bg-zinc-50/95 text-center text-[9px] font-black uppercase tracking-widest text-zinc-700 dark:border-white/15 dark:bg-[#111817] dark:text-white">
                      <tr>
                        <th className="px-4 py-2.5 align-middle">
                          {t("palletLabel")}
                        </th>
                        <th className="px-4 py-2.5 align-middle">
                          {t("client")}
                        </th>
                        <th className="px-4 py-2.5 align-middle">
                          {t("owed")}
                        </th>
                        <th className="px-4 py-2.5 align-middle">
                          <div className="ml-auto min-w-[15rem] max-w-sm text-center">
                            {t("invoiceLabel")}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] divide-y divide-zinc-50">
                      {topOverduePallets.map((p) => {
                        const client = clients.find(
                          (c) => c.user_id === p.user_id,
                        );
                        const invoiceWasSent = Boolean(
                          sentInvoiceTimestamps[p.id],
                        );
                        const invoiceIsSending =
                          sendingInvoicePalletIds.includes(p.id);
                        return (
                          <tr
                            key={p.id}
                            className="hover:bg-rose-50/30 transition-colors"
                          >
                            <td className="px-4 py-2.5 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => openQrPreview(p)}
                                title={t("showQrCode")}
                                aria-label={`${t("showQrCode")}: ${getPalletDisplayName(p)}`}
                                className="rounded-lg px-2 py-1 font-mono font-black text-emerald-700 underline decoration-emerald-300 underline-offset-4 transition-colors hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                              >
                                {getPalletDisplayName(p)}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-center align-middle">
                              <p className="font-bold text-zinc-900 leading-none mb-1">
                                {client?.name || t("inWarehouse")}
                              </p>
                              <p className="text-[11px] leading-4 text-zinc-500">
                                {getLocationLabel(p.current_location, language)}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 text-center text-rose-600 font-mono font-black align-middle">
                              {"\u20AC"}
                              {calculateDebt(p).toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 text-right align-middle">
                              <div className="ml-auto grid min-w-[15rem] max-w-sm grid-cols-1 gap-1.5 sm:grid-cols-2">
                                <Button
                                  variant="outline"
                                  size="xs"
                                  onClick={() =>
                                    setSelectedOverduePalletId(p.id)
                                  }
                                  className="w-full justify-center"
                                >
                                  <Eye size={13} className="mr-1.5" />
                                  {t("viewInvoice")}
                                </Button>
                                <Button
                                  variant={
                                    invoiceWasSent ? "secondary" : "primary"
                                  }
                                  size="xs"
                                  onClick={() => void handleSendInvoice(p)}
                                  disabled={invoiceWasSent || invoiceIsSending}
                                  className="w-full justify-center"
                                >
                                  <Send size={13} className="mr-1.5" />
                                  {invoiceWasSent
                                    ? t("sentLabel")
                                    : t("sendInvoice")}
                                </Button>
                              </div>
                            </td>
                            <td className="hidden px-4 py-2.5 text-center text-rose-600 font-mono font-black align-middle">
                              {"\u20AC"}
                              {calculateDebt(p).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex min-h-[12rem] items-center justify-center px-6 text-center">
                    <div>
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
                        <TrendingUp size={20} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        {t("allGood")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
              <Card
                title={t("activity")}
                noPadding
                className="h-full min-h-[24rem] overflow-hidden"
                action={
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setView("logs")}
                  >
                    {t("viewHistory")}
                  </Button>
                }
              >
                <div className="flex h-full min-h-[19.5rem] overflow-x-auto">
                  {latestActivityLogs.length > 0 ? (
                    <table className="w-full table-fixed text-left">
                      <thead className="border-b border-zinc-200 bg-zinc-50/95 text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:border-white/15 dark:bg-[#111817] dark:text-white">
                        <tr>
                          <th className="w-[48%] px-5 py-3.5 align-middle">
                            {t("palletLabel")}
                          </th>
                          <th className="px-5 py-3.5 align-middle">
                            {t("status")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-[13px]">
                        {latestActivityLogs.map((log) => (
                          <tr
                            key={`audit-log-${log.id}`}
                            className="hover:bg-zinc-50/50"
                          >
                            <td className="px-5 py-4 align-middle font-mono font-black underline underline-offset-2">
                              {getAuditPalletDisplayName(log)}
                            </td>
                            <td className="px-5 py-4 align-middle">
                              <span className="mb-1.5 block truncate font-black leading-tight text-zinc-900">
                                {getStatusLabel(log.new_status_name, language)}
                              </span>
                              <span className="block text-[10px] font-black uppercase leading-none tracking-wider text-zinc-400">
                                {formatAppTime(log.created_at)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-1 items-center justify-center px-6 text-center">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        {noMovementHistoryLabel}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              <Card
                title={t("inventory")}
                noPadding
                className="h-full min-h-[24rem] overflow-hidden"
                action={
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setView("pallets")}
                  >
                    {t("manageAll")}
                  </Button>
                }
              >
                <div className="flex h-full min-h-[19.5rem] overflow-x-auto">
                  {latestInventoryPallets.length > 0 ? (
                    <table className="w-full table-fixed text-left">
                      <thead className="border-b border-zinc-200 bg-zinc-50/95 text-[10px] font-black uppercase tracking-widest text-zinc-700 dark:border-white/15 dark:bg-[#111817] dark:text-white">
                        <tr>
                          <th className="w-[58%] px-5 py-3.5 align-middle">
                            {t("palletLabel")}
                          </th>
                          <th className="px-5 py-3.5 text-right align-middle">
                            {t("owed")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 text-[13px]">
                        {latestInventoryPallets.map((pallet) => (
                          <tr
                            key={`pallet-overview-${pallet.id}`}
                            className="hover:bg-zinc-50"
                          >
                            <td className="px-5 py-4 align-middle font-mono font-black">
                              {getPalletDisplayName(pallet)}
                            </td>
                            <td className="px-5 py-4 text-right align-middle font-mono font-black text-emerald-600">
                              {"\u20AC"}
                              {calculateDebt(pallet).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-1 items-center justify-center px-6 text-center">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        {t("noPalletsFound")}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="grid min-w-0 gap-4 xl:grid-rows-[auto_minmax(0,1fr)]">
            <Card title={t("quickAnalysis")} noPadding>
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-500" />
                    <span className="text-[11px] font-bold tracking-[0.08em] text-zinc-500">
                      {t("utilizationRate")}
                    </span>
                  </div>
                  <span className="text-xs font-black">
                    {utilizationRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    style={{ width: `${utilizationRate}%` }}
                    className="h-full bg-black rounded-full"
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="flex gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                    <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="mb-1 text-[11px] font-bold tracking-[0.06em] text-blue-800">
                        {t("logisticsNote")}
                      </p>
                      <p className="text-[12px] font-medium leading-5 text-blue-700">
                        {t("logisticsNoteText")}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-3">
                    <AlertTriangle
                      size={14}
                      className="text-amber-600 shrink-0 mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="mb-1 text-[11px] font-bold tracking-[0.06em] text-amber-800">
                        {t("overdueWarning")}
                      </p>
                      <p className="text-[12px] font-medium leading-5 text-amber-700">
                        {t("overdueWarningText")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card
              title={t("ghostReport")}
              noPadding
              className="h-full overflow-hidden"
              action={
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsGhostReportOpen(true)}
                >
                  {t("open")}
                </Button>
              }
            >
              <div className="flex h-full min-h-0 flex-col space-y-3 p-4">
                <div className="flex items-center justify-between rounded-2xl border border-rose-100 bg-rose-50/60 p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center">
                      <Ghost size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold tracking-[0.08em] text-rose-600">
                        {t("openReports")}
                      </p>
                      <p className="text-base font-black uppercase tracking-tight text-rose-700">
                        {ghostPallets.length}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={ghostPallets.length > 0 ? "warning" : "success"}
                  >
                    {ghostPallets.length > 0
                      ? t("actionRequired")
                      : t("allGood")}
                  </Badge>
                </div>

                <div className="max-h-[18rem] min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1 no-scrollbar xl:max-h-none">
                  {ghostPallets.length > 0 ? (
                    ghostPallets.map((ghostPallet) => (
                      <div
                        key={`admin-ghost-${ghostPallet.id}`}
                        className="rounded-2xl border border-zinc-100 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold tracking-[0.06em] text-zinc-500">
                              {ghostPallet.client_name || t("unknownClient")}
                            </p>
                            <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900 mt-1 truncate">
                              {ghostPallet.current_location}
                            </p>
                          </div>
                          <Badge variant="warning">Ghost</Badge>
                        </div>
                        <p className="mt-3 text-[12px] font-medium leading-5 text-zinc-600">
                          {ghostPallet.note || t("ghostReportCardText")}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3 text-center">
                      <p className="text-[11px] font-bold tracking-[0.08em] text-zinc-500">
                        {t("noOpenGhostReports")}
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
  const renderAdminWarehouse = () => (
    <AdminRoleOperationsView mode="warehouse" />
  );
  const renderAdminFinance = () => <AdminRoleOperationsView mode="finance" />;

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-black uppercase tracking-tighter">
          {t("configs")}
        </h2>
        <button
          onClick={() => setShowAddStatus(true)}
          className="px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-black/10 hover:scale-105 transition-transform"
        >
          <Plus size={16} />
          {t("addStatus")}
        </button>
      </div>

      <Card title={t("settings")}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
              {t("nightMode")}
            </p>
            <p className="mt-2 text-lg font-black uppercase tracking-tight text-emerald-950">
              {isNightMode ? t("on") : t("off")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onToggleNightMode?.()}
            className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-emerald-300"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
              {t("updateSettings")}
            </p>
            <p className="mt-2 text-lg font-black uppercase tracking-tight text-zinc-950">
              {t("nightMode")}
            </p>
          </button>
        </div>
      </Card>

      <Card title={t("statusConfiguratorTitle")}>
        <div className="p-4 space-y-2">
          {statuses.map((status) => (
            <div
              key={`status-cfg-${status.id}`}
              className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:border-black transition-all group"
            >
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest">
                  {getStatusLabel(status.name, language)}
                </span>
                <div className="flex gap-4 mt-1">
                  <div className="flex items-center gap-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${status.is_active ? "bg-green-500" : "bg-gray-300"}`}
                    />
                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                      {t("activeCounterLabel")}{" "}
                      {status.is_active ? t("on") : t("off")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${status.is_billable ? "bg-blue-500" : "bg-gray-300"}`}
                    />
                    <span className="text-[9px] font-bold text-gray-400 uppercase">
                      {t("billableStatusLabel")}{" "}
                      {status.is_billable ? t("on") : t("off")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteStatus(status)}
                  className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:bg-rose-50 rounded-lg dark:bg-rose-600 dark:text-white dark:hover:bg-rose-700"
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
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative"
          >
            <h2 className="text-xl font-black mb-6 uppercase">
              {t("newStatus")}
            </h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t("statusName")}
                </label>
                <input
                  type="text"
                  value={newStatusData.name}
                  onChange={(e) =>
                    setNewStatusData({ ...newStatusData, name: e.target.value })
                  }
                  className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold"
                  placeholder={t("exampleReturnedPlaceholder")}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {t("activeCounterLabel")}
                </span>
                <button
                  onClick={() =>
                    setNewStatusData({
                      ...newStatusData,
                      is_active: !newStatusData.is_active,
                    })
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_active ? "bg-black" : "bg-gray-200"}`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_active ? "left-5" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t("gracePeriodDaysLabel")}
                </label>
                <input
                  type="number"
                  value={newStatusData.grace_period_days}
                  onChange={(e) =>
                    setNewStatusData({
                      ...newStatusData,
                      grace_period_days: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t("pricePerDayLabel")} ({"\u20AC"})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={newStatusData.price_per_day}
                  onChange={(e) =>
                    setNewStatusData({
                      ...newStatusData,
                      price_per_day: parseFloat(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {t("isBillable")}
                </span>
                <button
                  onClick={() =>
                    setNewStatusData({
                      ...newStatusData,
                      is_billable: !newStatusData.is_billable,
                    })
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_billable ? "bg-blue-600" : "bg-gray-200"}`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_billable ? "left-5" : "left-1"}`}
                  />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setShowAddStatus(false)}
                className="flex-1 py-3 font-bold text-gray-400 hover:text-black transition-colors uppercase text-xs"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  addStatus(newStatusData);
                  setShowAddStatus(false);
                  setNewStatusData({
                    name: "",
                    is_active: true,
                    is_billable: false,
                    grace_period_days: 14,
                    price_per_day: 0,
                  });
                }}
                className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-xs shadow-xl shadow-black/10"
              >
                {t("save")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {editingStatus && (
        <div className="modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative">
            <h2 className="text-xl font-black mb-6 uppercase">
              {t("configureStatus")}:{" "}
              {getStatusLabel(editingStatus.name, language)}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {t("activeCounterLabel")}
                </span>
                <button
                  onClick={() =>
                    setEditingStatus({
                      ...editingStatus,
                      is_active: !editingStatus.is_active,
                    })
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative ${editingStatus.is_active ? "bg-black" : "bg-gray-200"}`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingStatus.is_active ? "left-5" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t("gracePeriodDaysLabel")}
                </label>
                <input
                  type="number"
                  value={editingStatus.grace_period_days}
                  onChange={(e) =>
                    setEditingStatus({
                      ...editingStatus,
                      grace_period_days: parseInt(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {t("pricePerDayLabel")} ({"\u20AC"})
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={editingStatus.price_per_day}
                  onChange={(e) =>
                    setEditingStatus({
                      ...editingStatus,
                      price_per_day: parseFloat(e.target.value),
                    })
                  }
                  className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {t("billableStatusLabel")}
                </span>
                <button
                  onClick={() =>
                    setEditingStatus({
                      ...editingStatus,
                      is_billable: !editingStatus.is_billable,
                    })
                  }
                  className={`w-10 h-6 rounded-full transition-colors relative ${editingStatus.is_billable ? "bg-blue-600" : "bg-gray-200"}`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingStatus.is_billable ? "left-5" : "left-1"}`}
                  />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setEditingStatus(null)}
                className="flex-1 py-3 font-bold text-gray-400 hover:text-black transition-colors uppercase text-xs"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => {
                  updateStatusSettings(editingStatus);
                  setEditingStatus(null);
                }}
                className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-xs shadow-xl shadow-black/10"
              >
                {t("saveRules")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={`${view === "overview" ? "pb-0" : "pb-16"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
    >
      {view === "overview" && renderOverview()}
      {view === "pallets" && renderPallets()}
      {view === "noQrPallets" && renderNoQrPallets()}
      {view === "clients" && renderClients()}
      {view === "clientManager" && renderClientManager()}
      {view === "adminService" && renderAdminService()}
      {view === "adminWarehouse" && renderAdminWarehouse()}
      {view === "adminFinance" && renderAdminFinance()}
      {view === "users" && <UserManager currentUser={user} />}
      {view === "settings" && renderSettings()}
      {view === "billing" && <BillingList />}
      {view === "calendar" && <BillingCalendar />}
      {view === "roles" && <RoleManager />}

      {/* Modals for CRUD operations */}
      <AnimatePresence>
        {selectedPallet && (
          <div
            key={`selected-pallet-${selectedPallet.id}`}
            className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[3rem] w-full max-w-xl shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-black"></div>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter uppercase mb-1">
                    {getPalletTitleLabel(selectedPallet)}
                  </h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {getPalletTypeLabel(selectedPallet.type, language)}
                  </span>
                </div>
                <div className="flex gap-2">
                  {user.role_name === RoleType.ADMIN && (
                    <button
                      onClick={() => handleEditPallet(selectedPallet)}
                      className="px-4 py-2 bg-gray-50 text-black border border-gray-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors"
                    >
                      {t("editData")}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPallet(null)}
                    className="p-2 hover:bg-gray-50 rounded-xl text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-4">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    {t("location")}
                  </span>
                  <p className="text-xs font-black uppercase">
                    {getStatusLocationLabel(selectedPallet)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    {t("status")}
                  </span>
                  <p className="text-xs font-black uppercase text-blue-600">
                    {getStatusLabel(
                      selectedPallet.current_status_name,
                      language,
                    )}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    {t("daysOut")}
                  </span>
                  <p className="text-xs font-black">
                    {calculateDays(selectedPallet.last_status_changed_at)}{" "}
                    {t("days")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 mb-8">
                <div className="p-4 bg-gray-50 rounded-2xl">
                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    {t("timestamp")}
                  </span>
                  <p className="text-xs font-black uppercase">
                    {latestSelectedPalletStatusLog
                      ? detailDateFormatter.format(
                          new Date(latestSelectedPalletStatusLog.created_at),
                        )
                      : notAvailableLabel}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-8">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">
                  {t("movementHistory")}
                </h4>
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
                          {getLocationLabel(log.new_location, language) ||
                            notAvailableLabel}
                        </p>
                        <p className="mt-2 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                          {t("changedBy")}: {getAuditActorLabel(log)}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-tight text-gray-400">
                          <Clock size={12} />
                          <span>
                            {detailDateFormatter.format(
                              new Date(log.created_at),
                            )}
                          </span>
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
                <button
                  onClick={() => setSelectedPallet(null)}
                  className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-black/10"
                >
                  {t("closeDetails")}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingPallet && (
          <div
            key={`editing-pallet-${editingPallet.id}`}
            className="modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#101715]"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 dark:border-white/10 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                    {palletDetailTitleLabel}
                  </p>
                  <h3 className="mt-1 truncate text-xl font-black uppercase tracking-tight text-zinc-950 dark:text-white sm:text-2xl">
                    {getPalletTitleLabel(editingPallet)}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label={t("closeDetails")}
                    onClick={() => {
                      setEditingPallet(null);
                      setShowEditingPalletDetails(false);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-white/[0.07] dark:text-zinc-300 dark:hover:bg-white/[0.12] dark:hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5 no-scrollbar sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
                  <div className="space-y-4">
                    <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/50 p-5 dark:border-white/10 dark:bg-white/[0.06]">
                      <div className="flex flex-col gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                            {t("currentStatusLabel")}
                          </p>
                          <p className="mt-2 break-words text-3xl font-black uppercase leading-none tracking-tight text-emerald-950 dark:text-white">
                            {getStatusLabel(
                              editingPallet.current_status_name,
                              language,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {renderPalletInfoTile(
                        palletDetailFieldLabel,
                        getPalletTitleLabel(editingPallet),
                      )}
                      {renderPalletInfoTile(
                        t("palletType"),
                        getPalletTypeLabel(editingPallet.type, language),
                      )}
                      {renderPalletInfoTile(
                        t("location"),
                        getStatusLocationLabel(editingPallet),
                      )}
                      {statusIdAllowsCustomer(
                        statuses,
                        editingPallet.current_status_id,
                      ) &&
                        renderPalletInfoTile(
                          t("client"),
                          <span
                            className={
                              editingPallet.client_deleted &&
                              !getAssignedClient(editingPallet)
                                ? "text-rose-600 dark:text-rose-300"
                                : undefined
                            }
                          >
                            {getAssignedClientLabel(editingPallet)}
                          </span>,
                        )}
                    </div>
                  </div>

                  {editingPallet.qr_code.trim() ? (
                    <PalletQrCode
                      value={editingPallet.qr_code.trim()}
                      className="block aspect-square w-full self-start text-zinc-950"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center border border-dashed border-zinc-200 px-4 text-center text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300 dark:border-white/10 dark:bg-[#101715]">
                      {t("notAvailable")}
                    </div>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {showEditingPalletDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 overflow-hidden border-t border-zinc-100 pt-5 dark:border-white/10"
                    >
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                            {detailsSectionLabel}
                          </p>
                          <h4 className="mt-1 text-lg font-black uppercase tracking-tight text-zinc-950 dark:text-white">
                            {t("editData")}
                          </h4>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div
                          className={cn(
                            "grid gap-4",
                            statusIdAllowsCustomer(
                              statuses,
                              editingPallet.current_status_id,
                            )
                              ? "md:grid-cols-3"
                              : "md:grid-cols-2",
                          )}
                        >
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              {t("palletType")}
                            </label>
                            <select
                              value={editingPallet.type}
                              onChange={(e) =>
                                setEditingPallet({
                                  ...editingPallet,
                                  type: e.target.value,
                                })
                              }
                              className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                            >
                              {getPalletTypeOptions(editingPallet.type).map(
                                (palletType) => (
                                  <option key={palletType} value={palletType}>
                                    {getPalletTypeLabel(palletType, language)}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              {t("globalStatus")}
                            </label>
                            <select
                              value={editingPallet.current_status_id}
                              onChange={(e) => {
                                const sid = parseInt(e.target.value);
                                const selectedStatus = statuses.find(
                                  (s) => s.id === sid,
                                );
                                const sname = selectedStatus?.name || "";
                                const isTransportStatus =
                                  [2, 6].includes(sid) ||
                                  [
                                    "bih-nl-transport",
                                    "nl-bih-transport",
                                  ].includes(selectedStatus?.slug || "");
                                const allowsCustomer = statusIdAllowsCustomer(
                                  statuses,
                                  sid,
                                );
                                const selectedClient = allowsCustomer
                                  ? clients.find(
                                      (client) =>
                                        client.user_id ===
                                        editingPallet.user_id,
                                    )
                                  : undefined;
                                setEditingPalletClientSearch(
                                  allowsCustomer
                                    ? selectedClient?.name ||
                                        editingPallet.client_name ||
                                        ""
                                    : "",
                                );
                                setIsEditingPalletClientListOpen(false);
                                setEditingPallet({
                                  ...editingPallet,
                                  current_status_id: sid,
                                  user_id: allowsCustomer
                                    ? editingPallet.user_id
                                    : undefined,
                                  client_name: allowsCustomer
                                    ? editingPallet.client_name
                                    : undefined,
                                  current_status_name: sname,
                                  current_location: isTransportStatus
                                    ? "Na putu"
                                    : allowsCustomer
                                      ? selectedClient
                                          ?.warehouse_addresses?.[0] || ""
                                      : getFixedWarehouseLocation(sid, sname) ||
                                        editingPallet.current_location,
                                });
                              }}
                              className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                            >
                              {statuses.map((s) => (
                                <option
                                  key={`filter-status-${s.id}`}
                                  value={s.id}
                                >
                                  {getStatusLabel(s.name, language)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {statusIdAllowsCustomer(
                            statuses,
                            editingPallet.current_status_id,
                          ) && (
                            <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              {t("assignedClient")}
                            </label>
                            <div
                              className="relative"
                              onBlur={(event) => {
                                if (
                                  !event.currentTarget.contains(
                                    event.relatedTarget as Node | null,
                                  )
                                ) {
                                  setIsEditingPalletClientListOpen(false);
                                  setEditingPalletClientSearch("");
                                }
                              }}
                            >
                              <button
                                type="button"
                                disabled={
                                  isEditingPalletPickupCustomer ||
                                  !statusIdAllowsCustomer(
                                    statuses,
                                    editingPallet.current_status_id,
                                  )
                                }
                                onClick={() => {
                                  setEditingPalletClientSearch("");
                                  setIsEditingPalletClientListOpen(
                                    (current) => !current,
                                  );
                                }}
                                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-transparent bg-gray-100 p-4 text-left font-bold outline-none transition-colors focus:border-emerald-300 disabled:cursor-not-allowed disabled:text-gray-500"
                                role="combobox"
                                aria-expanded={isEditingPalletClientListOpen}
                                aria-controls="editing-pallet-client-list"
                              >
                                <span className="truncate">
                                  {clients.find(
                                    (client) =>
                                      client.user_id === editingPallet.user_id,
                                  )?.name ||
                                    editingPallet.client_name ||
                                    t("noClient")}
                                </span>
                                <ChevronDown
                                  size={16}
                                  className={cn(
                                    "shrink-0 text-zinc-400 transition-transform",
                                    isEditingPalletClientListOpen &&
                                      "rotate-180",
                                  )}
                                />
                              </button>

                              {isEditingPalletClientListOpen &&
                                !isEditingPalletPickupCustomer &&
                                statusIdAllowsCustomer(
                                  statuses,
                                  editingPallet.current_status_id,
                                ) && (
                                  <div
                                    id="editing-pallet-client-list"
                                    className="relative z-40 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_20px_45px_-22px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#151d1a]"
                                  >
                                    <div className="bg-white pb-2 dark:bg-[#151d1a]">
                                      <div className="relative">
                                        <Search
                                          size={15}
                                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                                        />
                                        <input
                                          type="search"
                                          value={editingPalletClientSearch}
                                          onChange={(event) =>
                                            setEditingPalletClientSearch(
                                              event.target.value,
                                            )
                                          }
                                          placeholder={t("search")}
                                          className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-[11px] font-bold outline-none transition-colors focus:border-emerald-300 dark:border-white/10 dark:bg-white/5 sm:h-auto sm:py-2.5"
                                          autoComplete="off"
                                          autoFocus
                                        />
                                      </div>
                                    </div>
                                    <div
                                      role="listbox"
                                      className="max-h-[calc(100dvh-16rem)] space-y-1 overflow-y-auto overscroll-contain pr-1 sm:max-h-52"
                                    >
                                      <button
                                        type="button"
                                        role="option"
                                        aria-selected={!editingPallet.user_id}
                                        onMouseDown={(event) =>
                                          event.preventDefault()
                                        }
                                        onClick={() => {
                                          setEditingPallet({
                                            ...editingPallet,
                                            user_id: undefined,
                                            client_name: undefined,
                                            current_location: "",
                                          });
                                          setEditingPalletClientSearch("");
                                          setIsEditingPalletClientListOpen(false);
                                        }}
                                        className={cn(
                                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] font-bold transition-colors",
                                          !editingPallet.user_id
                                            ? "bg-emerald-50 text-emerald-800"
                                            : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-white/5",
                                        )}
                                      >
                                        <span>{t("noClient")}</span>
                                        {!editingPallet.user_id && (
                                          <Check size={14} />
                                        )}
                                      </button>

                                      {filteredEditingPalletClients.map(
                                        (client) => (
                                          <button
                                            key={"edit-client-" + client.id}
                                            type="button"
                                            role="option"
                                            aria-selected={
                                              editingPallet.user_id ===
                                              client.user_id
                                            }
                                            onMouseDown={(event) =>
                                              event.preventDefault()
                                            }
                                            onClick={() => {
                                              setEditingPallet({
                                                ...editingPallet,
                                                user_id: client.user_id,
                                                client_name: client.name,
                                                current_location:
                                                  client
                                                    .warehouse_addresses?.[0] ||
                                                  "",
                                              });
                                              setEditingPalletClientSearch("");
                                              setIsEditingPalletClientListOpen(
                                                false,
                                              );
                                            }}
                                            className={cn(
                                              "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                                              editingPallet.user_id ===
                                                client.user_id
                                                ? "bg-emerald-50 text-emerald-800"
                                                : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-white/5",
                                            )}
                                          >
                                            <span className="min-w-0">
                                              <span className="block truncate text-[11px] font-black">
                                                {client.name}
                                              </span>
                                              <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                                                {client.country} / #
                                                {client.user_id}
                                              </span>
                                            </span>
                                            {editingPallet.user_id ===
                                              client.user_id && (
                                              <Check
                                                size={14}
                                                className="shrink-0"
                                              />
                                            )}
                                          </button>
                                        ),
                                      )}

                                      {filteredEditingPalletClients.length ===
                                        0 && (
                                        <p className="px-3 py-5 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                          {t("noResults")}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                        </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {t("physicalLocation")}
                          </label>
                          <input
                            className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold disabled:text-gray-500"
                            value={
                              [2, 6].includes(
                                editingPallet.current_status_id,
                              ) ||
                              ["bih-nl-transport", "nl-bih-transport"].includes(
                                statuses.find(
                                  (status) =>
                                    status.id ===
                                    editingPallet.current_status_id,
                                )?.slug || "",
                              )
                                ? getLocationLabel("Na putu", language)
                                : getFixedWarehouseLocation(
                                    editingPallet.current_status_id,
                                    editingPallet.current_status_name,
                                  ) || editingPallet.current_location
                            }
                            disabled={
                              Boolean(
                                getFixedWarehouseLocation(
                                  editingPallet.current_status_id,
                                  editingPallet.current_status_name,
                                ),
                              ) ||
                              [2, 6].includes(
                                editingPallet.current_status_id,
                              ) ||
                              ["bih-nl-transport", "nl-bih-transport"].includes(
                                statuses.find(
                                  (status) =>
                                    status.id ===
                                    editingPallet.current_status_id,
                                )?.slug || "",
                              )
                            }
                            onChange={(e) =>
                              setEditingPallet({
                                ...editingPallet,
                                current_location: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {t("customOperationalNotes")}
                          </label>
                          <textarea
                            placeholder={t("addOperationalNotes")}
                            className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold text-sm h-24"
                            value={editingPallet.note || ""}
                            onChange={(e) =>
                              setEditingPallet({
                                ...editingPallet,
                                note: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {daysOutsideLabel}
                              </p>
                              <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                                {formatDaysOutsideValue(
                                  calculateDays(
                                    editingPallet.last_status_changed_at,
                                  ),
                                )}
                              </p>
                            </div>
                            <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {t("timestamp")}
                              </p>
                              <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                                {latestEditingPalletStatusLog
                                  ? detailDateFormatter.format(
                                      new Date(
                                        latestEditingPalletStatusLog.created_at,
                                      ),
                                    )
                                  : notAvailableLabel}
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 space-y-4">
                            <div className="flex items-center gap-2">
                              <History size={16} className="text-gray-400" />
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {t("movementHistory")}
                              </h4>
                            </div>

                            {editingPalletAuditHistory.length > 0 ? (
                              <div className="max-h-[420px] space-y-3 overflow-y-auto pr-2">
                                {editingPalletAuditHistory.map(
                                  (latestEditingPalletAuditLog) => (
                              <div
                                key={
                                  "editing-audit-card-" +
                                  latestEditingPalletAuditLog.id
                                }
                                className="rounded-[1.5rem] border border-zinc-200 bg-white px-5 py-4 shadow-[0_14px_35px_-28px_rgba(15,23,42,0.55)] dark:border-white/10 dark:bg-[#151d1a]"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-100 pb-3 dark:border-white/10">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                                      {t("statusChange")}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] font-black text-zinc-900 dark:text-white">
                                      {latestEditingPalletAuditLog.pallet_qr ||
                                        getPalletTitleLabel(editingPallet)}
                                    </p>
                                  </div>
                                  <p className="text-[10px] font-bold text-zinc-400">
                                    {detailDateFormatter.format(
                                      new Date(
                                        latestEditingPalletAuditLog.created_at,
                                      ),
                                    )}
                                  </p>
                                </div>

                                <dl className="divide-y divide-zinc-100 text-[11px] dark:divide-white/10">
                                  <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                                    <dt className="font-black uppercase tracking-[0.12em] text-zinc-400">
                                      {t("changedBy")}
                                    </dt>
                                    <dd className="font-bold text-zinc-900 dark:text-white">
                                      {getAuditActorLabel(
                                        latestEditingPalletAuditLog,
                                      )}{" "}
                                      <span className="text-zinc-400">
                                        #
                                        {latestEditingPalletAuditLog.made_by_user_id ||
                                          "-"}
                                      </span>
                                    </dd>
                                  </div>

                                  <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                                    <dt className="font-black uppercase tracking-[0.12em] text-zinc-400">
                                      {t("status")}
                                    </dt>
                                    <dd className="font-black text-zinc-900 dark:text-white">
                                      {getStatusLabel(
                                        latestEditingPalletAuditLog.old_status_name ||
                                          "-",
                                        language,
                                      )}{" "}
                                      <span className="px-1 text-emerald-500">
                                        -&gt;
                                      </span>{" "}
                                      {getStatusLabel(
                                        latestEditingPalletAuditLog.new_status_name ||
                                          "-",
                                        language,
                                      )}
                                    </dd>
                                  </div>

                                  {(latestEditingPalletAuditLog.old_location ||
                                    latestEditingPalletAuditLog.new_location) && (
                                    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                                      <dt className="font-black uppercase tracking-[0.12em] text-zinc-400">
                                        {t("location")}
                                      </dt>
                                      <dd className="break-words font-bold text-zinc-600 dark:text-zinc-200">
                                        {getLocationLabel(
                                          latestEditingPalletAuditLog.old_location,
                                          language,
                                        ) || "-"}{" "}
                                        <span className="px-1 text-zinc-300">
                                          -&gt;
                                        </span>{" "}
                                        {getLocationLabel(
                                          latestEditingPalletAuditLog.new_location,
                                          language,
                                        ) || "-"}
                                      </dd>
                                    </div>
                                  )}

                                  {(getAuditClientLabel(
                                    latestEditingPalletAuditLog.old_client_id,
                                  ) ||
                                    getAuditClientLabel(
                                      latestEditingPalletAuditLog.new_client_id,
                                    )) && (
                                    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                                      <dt className="font-black uppercase tracking-[0.12em] text-zinc-400">
                                        {t("client")}
                                      </dt>
                                      <dd className="break-words font-bold text-zinc-600 dark:text-zinc-200">
                                        {getAuditClientLabel(
                                          latestEditingPalletAuditLog.old_client_id,
                                        ) || "-"}{" "}
                                        <span className="px-1 text-zinc-300">
                                          -&gt;
                                        </span>{" "}
                                        {getAuditClientLabel(
                                          latestEditingPalletAuditLog.new_client_id,
                                        ) || "-"}
                                      </dd>
                                    </div>
                                  )}

                                  {latestEditingPalletAuditLog.note && (
                                    <div className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                                      <dt className="font-black uppercase tracking-[0.12em] text-zinc-400">
                                        {t("note")}
                                      </dt>
                                      <dd className="font-bold leading-5 text-zinc-600 dark:text-zinc-200">
                                        {latestEditingPalletAuditLog.note}
                                      </dd>
                                    </div>
                                  )}
                                </dl>
                              </div>
                                  ),
                                )}
                              </div>
                            ) : (
                              <p className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {noMovementHistoryLabel}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="grid shrink-0 grid-cols-3 items-center gap-4 border-t border-zinc-100 p-4 dark:border-white/10 sm:p-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowEditingPalletDetails((current) => !current)
                  }
                  className="h-14 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 transition-colors hover:border-emerald-200 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-emerald-100 dark:hover:bg-white/[0.1]"
                >
                  {showEditingPalletDetails ? hideDetailLabel : showDetailLabel}
                </button>
                <button
                  onClick={() => {
                    setEditingPallet(null);
                    setShowEditingPalletDetails(false);
                  }}
                  className="h-14 rounded-2xl border border-rose-100 bg-rose-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-100"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => {
                    updatePallet(
                      {
                        ...editingPallet,
                        current_location:
                          getFixedWarehouseLocation(
                            editingPallet.current_status_id,
                            editingPallet.current_status_name,
                          ) || editingPallet.current_location,
                      },
                      { id: user.id, name: user.name },
                    );
                    setEditingPallet(null);
                    setShowEditingPalletDetails(false);
                    setSelectedPallet(null);
                    void appAlert.fire({
                      icon: "success",
                      title: t("saveChanges"),
                      text:
                        language === "bs"
                          ? "Paleta je uspješno ažurirana."
                          : language === "nl"
                            ? "De bok is succesvol bijgewerkt."
                            : "The pallet was updated successfully.",
                    });
                  }}
                  className="h-14 rounded-2xl bg-black px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-black/20 transition-transform hover:scale-[1.02]"
                >
                  {t("saveChanges")}
                </button>
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
                    {t("palletQrCode")}
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
                <PalletQrCode
                  value={qrPreview.value}
                  className="mx-auto aspect-square w-full max-w-[260px]"
                />
              </div>

              <p className="mt-4 break-all rounded-2xl bg-zinc-50 px-4 py-3 text-xs font-black uppercase tracking-tight text-zinc-700">
                {qrPreview.label}
              </p>

              <button
                type="button"
                onClick={() => setQrPreview(null)}
                className="mt-5 h-12 w-full rounded-2xl bg-black px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-black/10"
              >
                {t("close")}
              </button>
            </motion.div>
          </div>
        )}

        {showAddStatus && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-black uppercase mb-6 text-center">
                {t("newStatus")}
              </h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("statusName")}
                  </label>
                  <input
                    autoFocus
                    placeholder={t("exampleReturnedPlaceholder")}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                    value={newStatusData.name}
                    onChange={(e) =>
                      setNewStatusData({
                        ...newStatusData,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[10px] font-black uppercase text-gray-400">
                      {t("activeLabel")}
                    </span>
                    <button
                      onClick={() =>
                        setNewStatusData({
                          ...newStatusData,
                          is_active: !newStatusData.is_active,
                        })
                      }
                      className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_active ? "bg-black" : "bg-gray-200"}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_active ? "left-5" : "left-1"}`}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[10px] font-black uppercase text-gray-400">
                      {t("isBillable")}
                    </span>
                    <button
                      onClick={() =>
                        setNewStatusData({
                          ...newStatusData,
                          is_billable: !newStatusData.is_billable,
                        })
                      }
                      className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_billable ? "bg-blue-600" : "bg-gray-200"}`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_billable ? "left-5" : "left-1"}`}
                      />
                    </button>
                  </div>
                </div>
                {newStatusData.is_billable && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {t("gracePeriodDaysLabel")}
                      </label>
                      <input
                        type="number"
                        value={newStatusData.grace_period_days}
                        onChange={(e) =>
                          setNewStatusData({
                            ...newStatusData,
                            grace_period_days: parseInt(e.target.value),
                          })
                        }
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {t("pricePerDayLabel")} ({"\u20AC"})
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={newStatusData.price_per_day}
                        onChange={(e) =>
                          setNewStatusData({
                            ...newStatusData,
                            price_per_day: parseFloat(e.target.value),
                          })
                        }
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setShowAddStatus(false)}
                  className="flex-1 py-4 font-black uppercase text-xs text-gray-400"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => {
                    if (newStatusData.name) {
                      addStatus(newStatusData);
                      setShowAddStatus(false);
                      setNewStatusData({
                        name: "",
                        is_active: true,
                        is_billable: false,
                        grace_period_days: 14,
                        price_per_day: 0,
                      });
                    }
                  }}
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-black/20"
                >
                  {t("createStatus")}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddPallet && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl"
            >
              <h3 className="text-xl font-black uppercase mb-6">
                {t("newPalletEntry")}
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {addPalletModeLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-3 rounded-[1.5rem] bg-zinc-100 p-1.5">
                    <button
                      type="button"
                      onClick={() => setNewPalletMode("single")}
                      className={`rounded-[1.15rem] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                        newPalletMode === "single"
                          ? "bg-white text-black shadow-sm"
                          : "text-zinc-500 hover:text-black"
                      }`}
                    >
                      {singlePalletLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewPalletMode("bulk")}
                      className={`rounded-[1.15rem] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-colors ${
                        newPalletMode === "bulk"
                          ? "bg-white text-black shadow-sm"
                          : "text-zinc-500 hover:text-black"
                      }`}
                    >
                      {bulkPalletLabel}
                    </button>
                  </div>
                </div>

                {newPalletMode === "single" ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      {t("qrCodeIdentification")}
                    </label>
                    <input
                      autoFocus
                      placeholder={t("qrPlaceholder")}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      value={newPalletQr}
                      onChange={(event) => setNewPalletQr(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-4 rounded-[1.8rem] border border-zinc-100 bg-zinc-50/80 p-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {qrPrefixLabel}
                      </label>
                      <input
                        className="w-full p-4 bg-white border border-zinc-200 rounded-2xl font-bold uppercase"
                        value={bulkQrPrefix}
                        onChange={(event) =>
                          setBulkQrPrefix(event.target.value.toUpperCase())
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {rangeFromLabel}
                        </label>
                        <input
                          autoFocus
                          inputMode="numeric"
                          className="w-full p-4 bg-white border border-zinc-200 rounded-2xl font-bold"
                          value={bulkQrStart}
                          onChange={(event) =>
                            setBulkQrStart(
                              event.target.value.replace(/\D/g, ""),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          {rangeToLabel}
                        </label>
                        <input
                          inputMode="numeric"
                          className="w-full p-4 bg-white border border-zinc-200 rounded-2xl font-bold"
                          value={bulkQrEnd}
                          onChange={(event) =>
                            setBulkQrEnd(event.target.value.replace(/\D/g, ""))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                          {totalCreateLabel}
                        </p>
                        <p className="mt-2 text-lg font-black tracking-tight text-zinc-900">
                          {hasValidBulkRange ? bulkCreateCount : "--"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center">
                        <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                          {bulkHintLabel}
                        </p>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-900">
                          {getStatusLabel("Onbekend", language)}
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
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("palletType")}
                  </label>
                  <select
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                    value={newPalletType}
                    onChange={(event) => setNewPalletType(event.target.value)}
                  >
                    {getPalletTypeOptions().map((palletType) => (
                      <option key={palletType} value={palletType}>
                        {getPalletTypeLabel(palletType, language)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={closeAddPalletModal}
                  className="flex-1 py-4 font-black uppercase text-xs text-gray-400"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleCreatePallets}
                  disabled={
                    newPalletMode === "single"
                      ? !newPalletQr.trim()
                      : !hasValidBulkRange
                  }
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {newPalletMode === "bulk" ? createBulkLabel : t("createUnit")}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddClient && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl"
            >
              <h3 className="text-xl font-black uppercase mb-6">
                {t("onboardNewClient")}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("companyName")}
                  </label>
                  <input
                    id="new-client-name"
                    placeholder={t("companyNamePlaceholder")}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    KVK
                  </label>
                  <input
                    id="new-client-kvk"
                    placeholder="e.g. 74291836"
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("gracePeriodDaysLabel")}
                  </label>
                  <input
                    id="new-client-grace"
                    type="number"
                    defaultValue={14}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("ratePerDayLabel")} ({"\u20AC"})
                  </label>
                  <input
                    id="new-client-rate"
                    type="number"
                    step="0.1"
                    defaultValue={2.5}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("locationMarket")}
                  </label>
                  <select
                    id="new-client-country"
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  >
                    <option value="NL">
                      {getCountryLabel("NL", language)}
                    </option>
                    <option value="BiH">
                      {getCountryLabel("BiH", language)}
                    </option>
                    <option value="DE">
                      {getCountryLabel("DE", language)}
                    </option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("warehouseAddressOne")}
                  </label>
                  <input
                    id="new-client-address1"
                    placeholder={t("warehouseAddressOnePlaceholder")}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("warehouseAddressTwo")}
                  </label>
                  <input
                    id="new-client-address2"
                    placeholder={t("warehouseAddressTwoPlaceholder")}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setShowAddClient(false)}
                  className="flex-1 py-4 font-black uppercase text-xs text-gray-400"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={() => {
                    const name = (
                      document.getElementById(
                        "new-client-name",
                      ) as HTMLInputElement
                    ).value;
                    const kvk = (
                      document.getElementById(
                        "new-client-kvk",
                      ) as HTMLInputElement
                    ).value.trim();
                    const grace = parseInt(
                      (
                        document.getElementById(
                          "new-client-grace",
                        ) as HTMLInputElement
                      ).value,
                    );
                    const rate = parseFloat(
                      (
                        document.getElementById(
                          "new-client-rate",
                        ) as HTMLInputElement
                      ).value,
                    );
                    const country = (
                      document.getElementById(
                        "new-client-country",
                      ) as HTMLSelectElement
                    ).value;
                    const address1 = (
                      document.getElementById(
                        "new-client-address1",
                      ) as HTMLInputElement
                    ).value.trim();
                    const address2 = (
                      document.getElementById(
                        "new-client-address2",
                      ) as HTMLInputElement
                    ).value.trim();
                    if (name) {
                      addClient({
                        name,
                        kvk_number: kvk || undefined,
                        grace_period_days: grace,
                        price_per_day: rate,
                        country,
                        is_active: true,
                        warehouse_addresses: [address1, address2].filter(
                          Boolean,
                        ),
                      });
                      setShowAddClient(false);
                    }
                  }}
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs"
                >
                  {t("registerClient")}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingClient && (
          <div className="modal-overlay fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase">
                  {t("editClientRules")}
                </h3>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
                  {t("clientIdLabel")}: {editingClient.user_id}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    KVK
                  </label>
                  <input
                    type="text"
                    value={editingClient.kvk_number || ""}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        kvk_number: e.target.value,
                      })
                    }
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("gracePeriodDaysLabel")}
                  </label>
                  <input
                    type="number"
                    value={editingClient.grace_period_days}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        grace_period_days: parseInt(e.target.value),
                      })
                    }
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("dailyRateOverride")} ({"\u20AC"})
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingClient.price_per_day}
                    onChange={(e) =>
                      setEditingClient({
                        ...editingClient,
                        price_per_day: parseFloat(e.target.value),
                      })
                    }
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("warehouseAddressOne")}
                  </label>
                  <input
                    type="text"
                    value={editingClient.warehouse_addresses?.[0] || ""}
                    onChange={(e) => {
                      const addresses = [
                        ...(editingClient.warehouse_addresses || []),
                      ];
                      // Make sure we have enough space in array
                      if (addresses.length < 1) {
                        addresses[0] = "";
                      }
                      addresses[0] = e.target.value;
                      setEditingClient({
                        ...editingClient,
                        warehouse_addresses: addresses,
                      });
                    }}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t("warehouseAddressTwo")}
                  </label>
                  <input
                    type="text"
                    value={editingClient.warehouse_addresses?.[1] || ""}
                    onChange={(e) => {
                      const addresses = [
                        ...(editingClient.warehouse_addresses || []),
                      ];
                      // Make sure we have enough space in array
                      while (addresses.length < 2) {
                        addresses.push("");
                      }
                      addresses[1] = e.target.value;
                      setEditingClient({
                        ...editingClient,
                        warehouse_addresses: addresses,
                      });
                    }}
                    className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => setEditingClient(null)}
                  className="flex-1 py-4 font-black uppercase text-xs text-gray-400"
                >
                  {t("discard")}
                </button>
                <button
                  onClick={() => {
                    const cleanedAddresses = (
                      editingClient.warehouse_addresses || []
                    )
                      .map((a) => a.trim())
                      .filter(Boolean);
                    updateClient({
                      ...editingClient,
                      warehouse_addresses: cleanedAddresses,
                    });
                    setEditingClient(null);
                  }}
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs"
                >
                  {t("updateSettings")}
                </button>
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
          title={`${t("remove")}?`}
          subject={
            deleteConfirm
              ? deleteConfirm.kind === "pallet"
                ? getPalletDisplayName(deleteConfirm.pallet)
                : getStatusLabel(deleteConfirm.status.name, language)
              : undefined
          }
          message={
            deleteConfirm
              ? deleteConfirm.kind === "pallet"
                ? t("confirmDeleteUnit")
                : t("confirmDeleteStatus")
              : ""
          }
          confirmLabel={t("remove")}
          cancelLabel={t("cancel")}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={confirmDeleteAction}
        />

        {invoiceDeliveryError && (
          <div className="fixed bottom-5 right-5 z-[150] w-[calc(100%-2.5rem)] max-w-md rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 shadow-xl sm:w-full">
            <p className="text-sm font-bold text-[var(--status-danger-text)]">
              {t("invoiceDeliveryFailed")}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => void handleSendInvoice(invoiceDeliveryError)}
              >
                {t("retry")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setInvoiceDeliveryError(null)}
              >
                {t("close")}
              </Button>
            </div>
          </div>
        )}

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
              const pallet = pallets.find(
                (item) => item.id === selectedOverdueInvoice.pallet_id,
              );
              if (pallet) {
                handleSendInvoice(pallet);
              }
            }}
          />
        )}
      </AnimatePresence>
      {view === "logs" && (
        <AdminAuditLogs
          auditLogs={auditLogs}
          pallets={pallets}
          clients={clients}
          language={language}
          t={t}
          onSelectPallet={setSelectedPallet}
        />
      )}
    </div>
  );
};
