import React, { useState } from "react";
import { createPortal } from "react-dom";
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
  Wrench,
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
import { NoQrCodeIcon } from "./NoQrCodeIcon";
import { useApp } from "../AppContext";
import { apiService } from "../services/api";
import { motion, AnimatePresence } from "motion/react";
import { appAlert } from "./AppAlert";
import {
  RoleType,
  Pallet,
  PalletStatus,
  ClientDetail,
  User,
  AuditLog,
  DeliveryLocationInput,
} from "../types";
import {
  CreditCard,
  Shield,
  Calendar as CalendarIcon,
  Eye,
  Send,
  QrCode,
} from "lucide-react";
import {
  formatSystemNote,
  getCountryLabel,
  getLocationLabel,
  getPalletTypeLabel,
  getStatusLabel,
  normalizePalletTypeCode,
  palletTypeValues,
} from "../i18n";
import { getPalletDisplayName } from "../lib/palletDisplay";
import { rankSearchResults } from "../lib/searchRanking";
import { statusIdAllowsCustomer } from "../lib/palletCustomerAssignment";
import { SearchableSelect as PalletDetailDropdown } from "./SearchableSelect";
import { formatAppDate, formatAppDateTime, formatAppTime } from "../lib/dateFormat";
import { deduplicateAuditLogs } from "../lib/auditLog";
import { ThemeSettingsToggle } from "./ThemeSettingsToggle";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { useLivePallet } from "../hooks/useLivePallet";
import { mergeLivePalletIntoDraft } from "../lib/livePalletDraft";
import { PalletDeliveryPhotoUpload } from "./PalletDeliveryPhotoUpload";
import { DeliveryLocationMap } from "./DeliveryLocationMap";
import { DriverModalShell } from "./DriverModalShell";
import {
  formatPalletLocationAddress,
  getClientWarehouseAddress,
  getDeliveryLocationAddress,
} from "../lib/palletLocations";

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
    palletDashboardStats: dashboardStats,
    updateStatusSettings,
    addStatus,
    deleteStatus,
    addPallet,
    addPalletBatch,
    updatePallet,
    savePalletDeliveryLocation,
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
  const [isSavingStatus, setIsSavingStatus] = useState(false);
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
  const editingPalletBaselineRef = React.useRef<Pallet | null>(null);
  const liveDetailPallet = useLivePallet(selectedPallet?.id ?? editingPallet?.id ?? null);
  const [editingPalletClientSearch, setEditingPalletClientSearch] =
    useState("");
  const [isEditingPalletClientListOpen, setIsEditingPalletClientListOpen] =
    useState(false);
  const [isEditingPalletClientListOpeningUpward, setIsEditingPalletClientListOpeningUpward] =
    useState(false);
  const [editingPalletClientListMaxHeight, setEditingPalletClientListMaxHeight] =
    useState(256);
  const editingPalletClientTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const editingPalletClientMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [editingPalletClientMenuPosition, setEditingPalletClientMenuPosition] = useState({ top: 0, left: 0, width: 0 });
  const [showEditingPalletDeliveryMap, setShowEditingPalletDeliveryMap] =
    useState(false);
  const [editingPalletPendingDeliveryLocation, setEditingPalletPendingDeliveryLocation] =
    useState<DeliveryLocationInput | null>(null);
  const [
    isEditingPalletMapLocationSelected,
    setIsEditingPalletMapLocationSelected,
  ] = useState(false);
  const [showEditingPalletDetails, setShowEditingPalletDetails] =
    useState(false);
  const [qrPreview, setQrPreview] = useState<{
    value: string;
    label: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);
  const [deletedPalletId, setDeletedPalletId] = useState<number | null>(null);
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

  React.useEffect(() => {
    if (!isEditingPalletClientListOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!editingPalletClientTriggerRef.current?.contains(target) && !editingPalletClientMenuRef.current?.contains(target)) {
        setIsEditingPalletClientListOpen(false);
        setEditingPalletClientSearch("");
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [isEditingPalletClientListOpen]);

  React.useEffect(() => {
    if (!isEditingPalletClientListOpen) return;

    const updatePosition = () => {
      const rect = editingPalletClientTriggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setIsEditingPalletClientListOpeningUpward(false);
      setEditingPalletClientListMaxHeight(
        Math.max(140, Math.min(300, window.innerHeight - rect.bottom - 12)),
      );
      setEditingPalletClientMenuPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isEditingPalletClientListOpen, editingPallet?.current_status_id]);
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
    if (!openPalletId) {
      return;
    }

    const pallet = pallets.find((item) => item.id === openPalletId);

    if (pallet) {
      setSelectedPallet(pallet);
      onPalletDetailOpened?.();
    }
  }, [openPalletId, onPalletDetailOpened, pallets]);

  React.useEffect(() => {
    if (!liveDetailPallet) {
      return;
    }

    setSelectedPallet((current) =>
      current?.id === liveDetailPallet.id ? liveDetailPallet : current,
    );
    setEditingPallet((current) => {
      if (!current || current.id !== liveDetailPallet.id) {
        return current;
      }

      const baseline = editingPalletBaselineRef.current;
      const next = baseline && baseline.id === current.id
        ? mergeLivePalletIntoDraft(current, baseline, liveDetailPallet)
        : liveDetailPallet;
      editingPalletBaselineRef.current = liveDetailPallet;
      return next;
    });
  }, [liveDetailPallet]);

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
    if (!p.user_id || !status || !status.is_billable) return 0;

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

  React.useEffect(() => {
    if (!showAddPallet) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAddPalletModal();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [showAddPallet]);

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
      location: getLocationLabel(pallet.current_location, language),
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
    setShowEditingPalletDeliveryMap(false);
    setEditingPalletPendingDeliveryLocation(null);
    setIsEditingPalletMapLocationSelected(Boolean(pallet.delivery_location));
    const editingDraft = {
      ...pallet,
      current_location: fixedLocation || pallet.current_location,
      type: normalizePalletTypeCode(pallet.type) || pallet.type,
    };
    editingPalletBaselineRef.current = editingDraft;
    setEditingPallet(editingDraft);
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

  const handleSaveStatusSettings = async () => {
    if (!editingStatus || isSavingStatus) {
      return;
    }

    setIsSavingStatus(true);

    try {
      await updateStatusSettings(editingStatus);
      setEditingStatus(null);
      await appAlert.fire({
        icon: "success",
        title: t("settingsSaved"),
        text: t("settingsSavedDetails"),
      });
    } catch (error) {
      console.error("Failed to save status settings", error);
      await appAlert.fire({
        icon: "error",
        title: t("changesNotSaved"),
      });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const confirmDeleteAction = () => {
    if (!deleteConfirm) {
      return;
    }

    if (deleteConfirm.kind === "pallet") {
      deletePallet(deleteConfirm.pallet.id);
      setDeletedPalletId(deleteConfirm.pallet.id);
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
  const palletTimelineDateFormatter = {
    format: (value: string | number | Date) =>
      formatAppDate(value, language, notAvailableLabel),
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
      if (log.pallet_id === pallet.id && ["status", "repair"].includes(log.type || "status")) {
        logsById.set(log.id, log);
      }
    });

    const logs = deduplicateAuditLogs(Array.from(logsById.values())).sort(
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
  const canUploadSelectedPalletDeliveryPhoto = Boolean(
    selectedPallet &&
      ['bij-de-klant', 'ophalen-klant'].includes(
        selectedPallet.current_status_slug ||
          statuses.find((status) => status.id === selectedPallet.current_status_id)?.slug ||
          '',
      ),
  );
  const editingPalletStatusHistory = editingPallet
    ? getPalletStatusHistory(editingPallet)
    : [];
  const editingPalletAuditHistory = editingPalletStatusHistory.filter(
    (log) => log.id > 0,
  );
  const latestEditingPalletStatusLog = editingPalletStatusHistory[0] || null;
  const editingPalletStatus = statuses.find(
    (status) => status.id === editingPallet?.current_status_id,
  );
  const editingPalletClient = clients.find(
    (client) => client.user_id === editingPallet?.user_id,
  );
  // The status object follows the modal draft immediately. The pallet slug can
  // still describe the persisted status until the modal is saved.
  const editingPalletStatusSlug = editingPalletStatus?.slug || editingPallet?.current_status_slug || "";
  const editingPalletUsesCustomerTimer = ["bij-de-klant", "ophalen-klant"].includes(
    editingPalletStatusSlug,
  );
  const isEditingPalletTransportStatus =
    [2, 6].includes(editingPallet?.current_status_id || 0) ||
    ["bih-nl-transport", "nl-bih-transport", "transport", "transport_bih_nl", "transport_nl_bih"].includes(
      editingPalletStatusSlug,
    );
  const editingPalletChangedAt = editingPallet
    ? new Date(
        editingPalletUsesCustomerTimer
          ? editingPallet.customer_timer_started_at || editingPallet.last_status_changed_at
          : editingPallet.last_status_changed_at,
      )
    : null;
  const editingPalletIsAtWarehouse = Boolean(
    editingPallet &&
      (getFixedWarehouseLocation(
        editingPallet.current_status_id,
        editingPallet.current_status_name,
      ) || ["bowido-nl", "bowido-bih", "bowido_warehouse", "bowido_nl"].includes(editingPalletStatusSlug)),
  );
  const editingPalletHasSentDate = Boolean(
    editingPalletChangedAt &&
      !Number.isNaN(editingPalletChangedAt.getTime()) &&
      !editingPalletIsAtWarehouse,
  );
  const editingPalletFrozenAt = editingPalletUsesCustomerTimer && editingPallet?.customer_timer_frozen_at
    ? new Date(editingPallet.customer_timer_frozen_at)
    : null;
  const editingPalletHasFrozenTimer = Boolean(
    editingPalletFrozenAt && !Number.isNaN(editingPalletFrozenAt.getTime()),
  );
  const editingPalletGraceDays = editingPallet
    ? editingPalletIsAtWarehouse
      ? 0
      : isEditingPalletTransportStatus
        ? editingPallet.grace_days ?? editingPalletStatus?.grace_period_days ?? 3
        : editingPalletStatus?.is_billable || editingPalletHasFrozenTimer
          ? editingPallet.grace_days ?? editingPalletClient?.grace_period_days ?? editingPalletStatus?.grace_period_days ?? 0
          : 0
    : 0;
  const editingPalletReturnDate =
    editingPalletHasSentDate && editingPalletChangedAt && editingPalletGraceDays > 0
      ? (() => {
          const dueDate = new Date(
            editingPalletChangedAt.getFullYear(),
            editingPalletChangedAt.getMonth(),
            editingPalletChangedAt.getDate(),
          );
          dueDate.setDate(dueDate.getDate() + editingPalletGraceDays);
          return dueDate;
        })()
      : null;
  const editingPalletTermDays =
    editingPalletHasSentDate && editingPalletChangedAt && editingPalletGraceDays > 0
      ? (() => {
          const counterEnd = editingPalletHasFrozenTimer ? editingPalletFrozenAt! : new Date();
          const changedAtMidnight = new Date(
            editingPalletChangedAt.getFullYear(),
            editingPalletChangedAt.getMonth(),
            editingPalletChangedAt.getDate(),
          );
          const counterEndMidnight = new Date(
            counterEnd.getFullYear(),
            counterEnd.getMonth(),
            counterEnd.getDate(),
          );
          const elapsedDays = Math.max(
            0,
            Math.floor((counterEndMidnight.getTime() - changedAtMidnight.getTime()) / (1000 * 60 * 60 * 24)),
          );
          return editingPalletGraceDays - elapsedDays;
        })()
      : null;
  const isEditingPalletUnknownStatus = editingPalletStatus?.slug === "onbekend";
  const editingPalletFixedLocation = editingPallet
    ? getFixedWarehouseLocation(
        editingPallet.current_status_id,
        editingPallet.current_status_name,
      )
    : undefined;
  const editingPalletWarehouseOne = getClientWarehouseAddress(
    editingPalletClient,
    1,
  );
  const editingPalletWarehouseTwo = getClientWarehouseAddress(
    editingPalletClient,
    2,
  );
  const editingPalletPendingDeliveryAddress = editingPalletPendingDeliveryLocation
    ? formatPalletLocationAddress(
        editingPalletPendingDeliveryLocation.street,
        editingPalletPendingDeliveryLocation.house_number,
        editingPalletPendingDeliveryLocation.postal_code,
        editingPalletPendingDeliveryLocation.city,
      )
    : "";
  const editingPalletDeliveryAddress =
    editingPalletPendingDeliveryAddress || getDeliveryLocationAddress(editingPallet);
  const canSelectEditingPalletLocation = Boolean(
    editingPallet &&
      editingPalletClient &&
      statusIdAllowsCustomer(statuses, editingPallet.current_status_id) &&
      !isEditingPalletTransportStatus &&
      !editingPalletFixedLocation,
  );
  const filteredEditingPalletClients = React.useMemo(
    () => rankSearchResults(
      clients,
      editingPalletClientSearch,
      (client) => client.name,
      (client, query) => [client.country, client.kvk_number, String(client.user_id)]
        .some((value) => value?.toLocaleLowerCase().includes(query)),
    ),
    [clients, editingPalletClientSearch],
  );

  const renderOverview = () => {
    const overduePallets = pallets.filter((p) => calculateDebt(p) > 0);
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
    // These counters must come from the aggregate endpoint. `pallets` is a
    // deliberately small first page, so using it as a fallback briefly shows
    // an incorrect total before the real count arrives.
    const overviewStats = dashboardStats;
    const topOverdueClients = overviewStats?.top_overdue_clients ?? [];
    const customerPickupUnits = overviewStats?.customer_pickup_units;
    const customerPickupAnalysis =
      customerPickupUnits === undefined
        ? "—"
        : language === "bs"
          ? `${customerPickupUnits} paleta je označeno za preuzimanje kod klijenta.`
          : language === "nl"
            ? `${customerPickupUnits} bokken staan gemarkeerd voor ophalen bij de klant.`
            : `${customerPickupUnits} pallets are marked for customer pickup.`;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("totalPallets")}
            value={overviewStats ? overviewStats.total_pallets.toString() : "—"}
          />
          <StatCard
            label={t("inTransit")}
            value={overviewStats ? overviewStats.in_transport.toString() : "—"}
            variant="info"
          />
          <StatCard
            label={t("overdueUnits")}
            value={overviewStats ? overviewStats.overdue_units.toString() : "—"}
            trend={
              overviewStats && overviewStats.overdue_units > 0
                ? t("actionRequired")
                : overviewStats
                  ? t("allGood")
                  : "—"
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
                    {overviewStats
                      ? topOverdueClients.length > 0
                        ? `${t("actionRequired")} (${topOverdueClients.length})`
                        : t("allGood")
                      : "—"}
                  </span>
                </div>
                <Badge
                  variant={topOverdueClients.length > 0 ? "danger" : "success"}
                >
                  {topOverdueClients.length > 0 ? t("overdue") : t("allGood")}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                {topOverdueClients.length > 0 ? (
                  <table className="w-full">
                    <thead className="border-b border-zinc-200 bg-zinc-50/95 text-center text-[9px] font-black uppercase tracking-widest text-zinc-700 dark:border-white/15 dark:bg-[#111817] dark:text-white">
                      <tr>
                        <th className="px-4 py-2.5 align-middle">
                          {t("client")}
                        </th>
                        <th className="px-4 py-2.5 align-middle">
                          {t("overdueUnits")}
                        </th>
                        <th className="px-4 py-2.5 align-middle">
                          {t("owed")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] divide-y divide-zinc-50">
                      {topOverdueClients.map((client) => (
                        <tr
                          key={client.user_id ?? "no-client"}
                          className="hover:bg-rose-50/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-center align-middle font-bold text-zinc-900">
                            {client.client_name}
                          </td>
                          <td className="px-4 py-3 text-center align-middle font-mono font-black text-zinc-700">
                            {client.overdue_pallets}
                          </td>
                          <td className="px-4 py-3 text-center align-middle font-mono font-black text-rose-600">
                            {"\u20AC"}
                            {client.debt_eur.toFixed(2)}
                          </td>
                        </tr>
                      ))}
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
                      <tbody className="text-[13px]">
                        {latestActivityLogs.map((log, index) => (
                          <tr
                            key={`audit-log-${log.id}`}
                            className="hover:bg-zinc-50/50"
                          >
                            <td
                              className={cn(
                                "px-5 py-4 align-middle font-mono font-black underline underline-offset-2",
                                index > 0 && "border-t border-zinc-50 dark:border-[var(--dark-border)]",
                              )}
                            >
                              {getAuditPalletDisplayName(log)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-4 align-middle",
                                index > 0 && "border-t border-zinc-50 dark:border-[var(--dark-border)]",
                              )}
                            >
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
                      <tbody className="text-[13px]">
                        {latestInventoryPallets.map((pallet, index) => (
                          <tr
                            key={`pallet-overview-${pallet.id}`}
                            className="hover:bg-zinc-50"
                          >
                            <td
                              className={cn(
                                "px-5 py-4 align-middle font-mono font-black",
                                index > 0 && "border-t border-zinc-50 dark:border-[var(--dark-border)]",
                              )}
                            >
                              {getPalletDisplayName(pallet)}
                            </td>
                            <td
                              className={cn(
                                "px-5 py-4 text-right align-middle font-mono font-black text-emerald-600",
                                index > 0 && "border-t border-zinc-50 dark:border-[var(--dark-border)]",
                              )}
                            >
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
              <div className="p-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                      <div>
                        <p className="text-[11px] font-bold tracking-[0.06em] text-blue-800">
                          {getStatusLabel("Voor retour", language)}
                        </p>
                        <p className="mt-1 text-[12px] font-medium leading-5 text-blue-700">
                          {customerPickupAnalysis}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-2xl font-black text-blue-800">
                      {customerPickupUnits ?? "—"}
                    </span>
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
                      <NoQrCodeIcon size={18} />
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
                              {getLocationLabel(
                                ghostPallet.current_location,
                                language,
                              ) ||
                                formatSystemNote(
                                  ghostPallet.current_location,
                                  language,
                                )}
                            </p>
                          </div>
                          <Badge variant="warning">{t("withoutQr")}</Badge>
                        </div>
                        <p className="mt-3 text-[12px] font-medium leading-5 text-zinc-600">
                          {formatSystemNote(ghostPallet.note, language) ||
                            t("ghostReportCardText")}
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
        deletedPalletId={deletedPalletId}
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
        <ThemeSettingsToggle
          isNightMode={isNightMode}
          onToggle={() => onToggleNightMode?.()}
          label={t("nightMode")}
          onLabel={t("on")}
          offLabel={t("off")}
        />
        <PasswordChangeForm />
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
                disabled={isSavingStatus}
                className="flex-1 py-3 font-bold text-gray-400 hover:text-black transition-colors uppercase text-xs"
              >
                {t("cancel")}
              </button>
              <button
                onClick={() => void handleSaveStatusSettings()}
                disabled={isSavingStatus}
                className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-xs shadow-xl shadow-black/10 disabled:cursor-wait disabled:opacity-60"
              >
                {isSavingStatus ? t("saving") : t("saveRules")}
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
                  <h3 className={cn("text-3xl font-black tracking-tighter uppercase mb-1", selectedPallet.is_for_repair && "text-rose-600")}>
                    {getPalletTitleLabel(selectedPallet)}
                  </h3>
                  {selectedPallet.is_for_repair && (
                    <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-rose-700">
                      <Wrench size={11} /> For repair
                    </span>
                  )}
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

              {canUploadSelectedPalletDeliveryPhoto && <PalletDeliveryPhotoUpload palletId={selectedPallet.id} />}

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
                        {log.type === "repair" ? <Wrench size={16} className="text-rose-500" /> : <MapPin size={16} className="text-gray-400" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-black uppercase tracking-tight text-gray-900">
                          {log.type === "repair"
                            ? (log.context?.new_is_for_repair ? "Marked for repair" : "Unmarked for repair")
                            : getStatusLabel(log.new_status_name, language)}
                        </p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-tight text-gray-500">
                          {log.type === "repair"
                            ? log.note || notAvailableLabel
                            : getLocationLabel(log.new_location, language) || notAvailableLabel}
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
              data-pallet-editor
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-visible rounded-[2rem] border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#101715]"
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
                      setEditingPalletPendingDeliveryLocation(null);
                      setShowEditingPalletDetails(false);
                      setShowEditingPalletDeliveryMap(false);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:bg-white/[0.07] dark:text-zinc-300 dark:hover:bg-white/[0.12] dark:hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="relative z-10 min-h-0 flex-1 overflow-y-auto p-5 no-scrollbar sm:p-6">
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
                          {editingPallet.is_for_repair && (
                            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-rose-700 dark:bg-rose-500/15 dark:text-rose-200">
                              <Wrench size={12} /> For repair
                            </span>
                          )}
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
                      style={{ overflow: "visible" }}
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
                            <PalletDetailDropdown
                              value={editingPallet.type}
                              options={getPalletTypeOptions(editingPallet.type).map((palletType) => ({
                                value: palletType,
                                label: getPalletTypeLabel(palletType, language),
                              }))}
                              onChange={(type) => setEditingPallet({ ...editingPallet, type })}
                              searchPlaceholder={t("search")}
                              noResultsLabel={t("noResults")}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              {t("globalStatus")}
                            </label>
                            <PalletDetailDropdown
                              value={String(editingPallet.current_status_id)}
                              options={statuses.map((status) => ({
                                value: String(status.id),
                                label: getStatusLabel(status.name, language),
                              }))}
                              onChange={(value) => {
                                const sid = parseInt(value);
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
                                const wasAssignedToCustomer =
                                  statusIdAllowsCustomer(
                                    statuses,
                                    editingPallet.current_status_id,
                                  );
                                const needsClientAssignment =
                                  allowsCustomer && !wasAssignedToCustomer;
                                const selectedClient =
                                  allowsCustomer && !needsClientAssignment
                                    ? clients.find(
                                        (client) =>
                                          client.user_id ===
                                          editingPallet.user_id,
                                      )
                                    : undefined;
                                setEditingPalletClientSearch(
                                  allowsCustomer && !needsClientAssignment
                                    ? selectedClient?.name ||
                                        editingPallet.client_name ||
                                        ""
                                    : "",
                                );
                                setIsEditingPalletClientListOpen(
                                  needsClientAssignment,
                                );
                                setShowEditingPalletDeliveryMap(false);
                                if (
                                  isTransportStatus ||
                                  selectedStatus?.slug === "onbekend" ||
                                  Boolean(getFixedWarehouseLocation(sid, sname))
                                ) {
                                  setEditingPalletPendingDeliveryLocation(null);
                                }
                                setEditingPallet({
                                  ...editingPallet,
                                  current_status_id: sid,
                                  current_status_slug: selectedStatus?.slug,
                                  user_id: allowsCustomer && !needsClientAssignment
                                    ? editingPallet.user_id
                                    : undefined,
                                  client_name: allowsCustomer && !needsClientAssignment
                                    ? editingPallet.client_name
                                    : undefined,
                                  current_status_name: sname,
                                  current_location: selectedStatus?.slug === "onbekend"
                                    ? ""
                                    : isTransportStatus
                                    ? "Na putu"
                                    : needsClientAssignment
                                      ? ""
                                      : allowsCustomer
                                        ? editingPallet.current_location
                                      : getFixedWarehouseLocation(sid, sname) ||
                                        editingPallet.current_location,
                                });
                              }}
                              searchPlaceholder={t("search")}
                              noResultsLabel={t("noResults")}
                            />
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
                              className={cn(
                                "relative",
                                isEditingPalletClientListOpen && "z-[100]",
                              )}
                            >
                              <button
                                ref={editingPalletClientTriggerRef}
                                type="button"
                                disabled={!statusIdAllowsCustomer(
                                  statuses,
                                  editingPallet.current_status_id,
                                )}
                                onClick={() => {
                                  setEditingPalletClientSearch("");
                                  const rect = editingPalletClientTriggerRef.current?.getBoundingClientRect();
                                  if (rect) {
                                    setIsEditingPalletClientListOpeningUpward(false);
                                    setEditingPalletClientListMaxHeight(
                                      Math.max(140, Math.min(300, window.innerHeight - rect.bottom - 12)),
                                    );
                                    setEditingPalletClientMenuPosition({
                                      top: rect.bottom + 8,
                                      left: rect.left,
                                      width: rect.width,
                                    });
                                  }
                                  setIsEditingPalletClientListOpen(
                                    (current) => !current,
                                  );
                                }}
                                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-transparent bg-gray-100 px-4 py-3 text-left text-[12px] font-bold outline-none transition-colors focus:border-emerald-300 disabled:cursor-not-allowed disabled:text-gray-500"
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
                                statusIdAllowsCustomer(
                                  statuses,
                                  editingPallet.current_status_id,
                                ) && createPortal(
                                  <div
                                    ref={editingPalletClientMenuRef}
                                    id="editing-pallet-client-list"
                                    className="pallet-detail-dropdown-portal overflow-hidden rounded-2xl border border-zinc-200 bg-white p-2 shadow-[0_20px_45px_-22px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#151d1a]"
                                    style={{
                                      top: editingPalletClientMenuPosition.top,
                                      left: editingPalletClientMenuPosition.left,
                                      width: editingPalletClientMenuPosition.width,
                                      maxHeight: editingPalletClientListMaxHeight,
                                    }}
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
                                        />
                                      </div>
                                    </div>
                                    <div
                                      role="listbox"
                                      className="space-y-1 overflow-y-auto overscroll-contain pr-1"
                                      style={{ maxHeight: Math.max(80, editingPalletClientListMaxHeight - 72) }}
                                    >
                                      <button
                                        type="button"
                                        role="option"
                                        aria-selected={!editingPallet.user_id}
                                        onMouseDown={(event) =>
                                          event.preventDefault()
                                        }
                                        onClick={() => {
                                          setEditingPalletPendingDeliveryLocation(null);
                                          setEditingPallet({
                                            ...editingPallet,
                                            user_id: undefined,
                                            client_name: undefined,
                                            current_location: "",
                                          });
                                          setEditingPalletClientSearch("");
                                          setIsEditingPalletClientListOpen(false);
                                          setShowEditingPalletDeliveryMap(false);
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
                                          setEditingPalletPendingDeliveryLocation(null);
                                          setEditingPallet({
                                            ...editingPallet,
                                            user_id: client.user_id,
                                            client_name: client.name,
                                          });
                                              setEditingPalletClientSearch("");
                                              setIsEditingPalletClientListOpen(
                                                false,
                                              );
                                              setShowEditingPalletDeliveryMap(
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
                                                {client.kvk_number || t("notAvailable")}
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
                                  </div>,
                                  document.body,
                                )}
                            </div>
                        </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            {t("physicalLocation")}
                          </label>
                          {canSelectEditingPalletLocation ? (
                            <>
                              <div className="grid gap-2 md:grid-cols-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPalletPendingDeliveryLocation(null);
                                    setEditingPallet({
                                      ...editingPallet,
                                      current_location:
                                        editingPalletWarehouseOne,
                                    });
                                    setShowEditingPalletDeliveryMap(false);
                                  }}
                                  className={cn(
                                    "min-h-24 rounded-2xl border p-3 text-left transition-colors",
                                    editingPallet.current_location ===
                                      editingPalletWarehouseOne
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                                      : "border-gray-100 bg-gray-50 text-gray-700 hover:border-emerald-200",
                                  )}
                                >
                                  <span className="block text-[9px] font-black uppercase tracking-widest text-emerald-600">
                                    {t("warehouseAddressOne")}
                                  </span>
                                  <span className="mt-2 block text-xs font-bold leading-5">
                                    {editingPalletWarehouseOne ||
                                      t("notAvailable")}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  disabled={!editingPalletWarehouseTwo}
                                  onClick={() => {
                                    setEditingPalletPendingDeliveryLocation(null);
                                    setEditingPallet({
                                      ...editingPallet,
                                      current_location:
                                        editingPalletWarehouseTwo,
                                    });
                                    setShowEditingPalletDeliveryMap(false);
                                  }}
                                  className={cn(
                                    "min-h-24 rounded-2xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                                    editingPalletWarehouseTwo &&
                                      editingPallet.current_location ===
                                        editingPalletWarehouseTwo
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                                      : "border-gray-100 bg-gray-50 text-gray-700 hover:border-emerald-200",
                                  )}
                                >
                                  <span className="block text-[9px] font-black uppercase tracking-widest text-emerald-600">
                                    {t("warehouseAddressTwo")}
                                  </span>
                                  <span className="mt-2 block text-xs font-bold leading-5">
                                    {editingPalletWarehouseTwo ||
                                      t("notAvailable")}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditingPalletMapLocationSelected(
                                      Boolean(editingPallet.delivery_location),
                                    );
                                    setShowEditingPalletDeliveryMap(true);
                                  }}
                                  className={cn(
                                    "min-h-24 rounded-2xl border p-3 text-left transition-colors",
                                    showEditingPalletDeliveryMap ||
                                      (editingPalletDeliveryAddress &&
                                        editingPallet.current_location ===
                                          editingPalletDeliveryAddress)
                                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                                      : "border-gray-100 bg-gray-50 text-gray-700 hover:border-emerald-200",
                                  )}
                                >
                                  <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                                    <MapPin size={12} />
                                    {t("otherDeliveryAddress")}
                                  </span>
                                  <span className="mt-2 block text-xs font-bold leading-5">
                                    {editingPalletDeliveryAddress ||
                                      t("searchAddressOnMap")}
                                  </span>
                                </button>
                              </div>
                            </>
                          ) : (
                            <input
                              className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold disabled:text-gray-500"
                              value={
                                isEditingPalletTransportStatus
                                  ? getLocationLabel("Na putu", language)
                                  : isEditingPalletUnknownStatus
                                    ? ""
                                  : editingPalletFixedLocation ||
                                    editingPallet.current_location
                              }
                              disabled={Boolean(
                                  editingPalletFixedLocation ||
                                  isEditingPalletTransportStatus ||
                                  isEditingPalletUnknownStatus,
                              )}
                              onChange={(e) =>
                                setEditingPallet({
                                  ...editingPallet,
                                  current_location: e.target.value,
                                })
                              }
                            />
                          )}
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {language === "bs" ? "Datum" : language === "nl" ? "Verzonden" : "Date"}
                              </p>
                              <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                                {editingPalletHasSentDate && editingPalletChangedAt
                                  ? palletTimelineDateFormatter.format(editingPalletChangedAt)
                                  : notAvailableLabel}
                              </p>
                            </div>
                            <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {t("returnLabel")}
                              </p>
                              <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                                {editingPalletReturnDate
                                  ? palletTimelineDateFormatter.format(editingPalletReturnDate)
                                  : notAvailableLabel}
                              </p>
                            </div>
                            <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50 px-5 py-5">
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                {t("termLabel")}
                              </p>
                              <p className="mt-3 text-lg font-black uppercase leading-tight text-emerald-900">
                                {editingPalletTermDays === null
                                  ? notAvailableLabel
                                  : `${editingPalletTermDays < 0
                                      ? `${Math.abs(editingPalletTermDays)} ${language === "bs" ? "dana preko" : language === "nl" ? "dagen over" : "days overdue"}`
                                      : `${editingPalletTermDays} ${language === "bs" ? "dana u roku" : language === "nl" ? "dagen resterend" : "days left"}`}${editingPalletHasFrozenTimer ? ` - ${language === "bs" ? "zaustavljeno" : language === "nl" ? "bevroren" : "frozen"}` : ""}`}
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
              <div data-pallet-editor-footer className="relative z-0 grid shrink-0 grid-cols-3 items-center gap-4 border-t border-zinc-100 p-4 dark:border-white/10 sm:p-5">
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
                    setEditingPalletPendingDeliveryLocation(null);
                    setShowEditingPalletDetails(false);
                    setShowEditingPalletDeliveryMap(false);
                  }}
                  className="h-14 rounded-2xl border border-rose-100 bg-rose-50 px-4 text-xs font-black uppercase tracking-[0.12em] text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-100"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updatePallet(
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
                      if (editingPalletPendingDeliveryLocation) {
                        await savePalletDeliveryLocation(
                          editingPallet.id,
                          editingPalletPendingDeliveryLocation,
                        );
                      }
                      setEditingPallet(null);
                    setEditingPalletPendingDeliveryLocation(null);
                    setShowEditingPalletDetails(false);
                    setShowEditingPalletDeliveryMap(false);
                    setSelectedPallet(null);
                      await appAlert.fire({
                      icon: "success",
                      title: t("saveChanges"),
                      text:
                        language === "bs"
                          ? "Paleta je uspješno ažurirana."
                          : language === "nl"
                            ? "De bok is succesvol bijgewerkt."
                            : "The pallet was updated successfully.",
                      });
                    } catch (error) {
                      console.error("Failed to save pallet", error);
                      await appAlert.fire({
                        icon: "error",
                        title: t("saveChanges"),
                        text: error instanceof Error ? error.message : "Unable to save the pallet.",
                      });
                    }
                  }}
                  className="h-14 rounded-2xl bg-black px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-xl shadow-black/20 transition-transform hover:scale-[1.02]"
                >
                  {t("saveChanges")}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingPallet && showEditingPalletDeliveryMap && (
          <DriverModalShell
            onClose={() => setShowEditingPalletDeliveryMap(false)}
            title={t("otherDeliveryAddress")}
            subtitle={t("searchAddressOnMap")}
            width="lg"
            overlayClassName="z-[160]"
            contentClassName={cn(
              "transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isEditingPalletMapLocationSelected
                ? "md:!max-w-4xl"
                : "md:!max-w-xl",
            )}
            bodyClassName="p-4 md:p-5"
          >
            <DeliveryLocationMap
              palletId={editingPallet.id}
              language={language}
              layout="desktop-split"
              mapClassName="md:!h-[520px] md:!max-h-none"
              onSelectionChange={setIsEditingPalletMapLocationSelected}
              initialLocation={editingPallet.delivery_location}
              initialInput={editingPalletPendingDeliveryLocation || undefined}
              initialLocationIsSaved={Boolean(
                editingPallet.delivery_location &&
                  !editingPalletPendingDeliveryLocation,
              )}
              showSaveSuccessMessage={false}
              onLocationSelected={(data) => {
                const savedAddress =
                  formatPalletLocationAddress(
                    data.street,
                    data.house_number,
                    data.postal_code,
                    data.city,
                  ) ||
                  "";

                setEditingPalletPendingDeliveryLocation(data);
                setEditingPallet((current) =>
                  current
                    ? {
                        ...current,
                        current_location:
                          savedAddress || current.current_location,
                      }
                    : current,
                );
                setShowEditingPalletDeliveryMap(false);
              }}
            />
          </DriverModalShell>
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
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-pallet-modal-title"
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <h3 id="add-pallet-modal-title" className="text-xl font-black uppercase">
                  {t("newPalletEntry")}
                </h3>
                <button
                  type="button"
                  onClick={closeAddPalletModal}
                  className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  aria-label={t("cancel")}
                  title={t("cancel")}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
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
                  <Select
                    className="rounded-2xl bg-[var(--surface-input)] p-4 pr-12 text-sm font-black uppercase tracking-[0.08em]"
                    value={newPalletType}
                    onChange={(event) => setNewPalletType(event.target.value)}
                  >
                    {getPalletTypeOptions().map((palletType) => (
                      <option key={palletType} value={palletType}>
                        {getPalletTypeLabel(palletType, language)}
                      </option>
                    ))}
                  </Select>
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
                      void addClient({
                        name,
                        kvk_number: kvk || undefined,
                        grace_period_days: grace,
                        price_per_day: rate,
                        country,
                        is_active: true,
                        warehouse_addresses: [address1, address2].filter(
                          Boolean,
                        ),
                      })
                        .then(() => setShowAddClient(false))
                        .catch(() =>
                          appAlert.fire({
                            icon: "error",
                            title:
                              language === "bs"
                                ? "Kreiranje klijenta nije uspjelo"
                                : language === "nl"
                                  ? "Klant aanmaken mislukt"
                                  : "Could not create client",
                            text:
                              language === "bs"
                                ? "Korisnički nalog i podaci o klijentu nisu kreirani. Provjerite podatke i pokušajte ponovo."
                                : language === "nl"
                                  ? "Het gebruikersaccount en de klantgegevens zijn niet aangemaakt. Controleer de gegevens en probeer opnieuw."
                                  : "The user account and client details were not created. Check the details and try again.",
                          }),
                        );
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
