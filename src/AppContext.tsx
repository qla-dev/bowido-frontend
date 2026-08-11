import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AuditLog,
  ClientDetail,
  DeliveryLocation,
  DeliveryLocationInput,
  GhostPalletReportInput,
  Invoice,
  Pallet,
  PalletDashboardStats,
  PalletStatus,
  Permission,
  Role,
  ServiceReport,
} from "./types";
import { apiService, setApiLocale } from "./services/api";
import {
  AppLanguage,
  defaultLanguage,
  formatServiceReportDescription,
  isAppLanguage,
  LANGUAGE_STORAGE_KEY,
  translate,
} from "./i18n";
import { normalizeQrCodeForStorage } from "./lib/palletQrMatching";
import { statusAllowsCustomer } from "./lib/palletCustomerAssignment";
import { formatAppDate } from "./lib/dateFormat";

interface AppContextType {
  pallets: Pallet[];
  statuses: PalletStatus[];
  auditLogs: AuditLog[];
  clients: ClientDetail[];
  invoices: Invoice[];
  roles: Role[];
  permissions: Permission[];
  language: AppLanguage;
  notifications: AppNotification[];
  serviceReports: ServiceReport[];
  palletDashboardStats: PalletDashboardStats | null;
  isScannerOpen: boolean;
  isGhostReportOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
  setIsGhostReportOpen: (open: boolean) => void;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: string) => string;
  updatePalletStatus: (
    palletId: number,
    statusId: number,
    userId: number,
    userName: string,
    location?: string,
    note?: string,
    clientId?: number,
  ) => void;
  updatePalletRepairStatus: (palletId: number, isForRepair: boolean) => Promise<Pallet>;
  markNotificationRead: (id: number) => void;
  addPallet: (qrCode: string, type: string) => void;
  addPalletBatch: (entries: Array<{ qrCode: string; type: string }>) => void;
  updatePallet: (pallet: Pallet, actor?: { id: number; name: string }) => Promise<Pallet>;
  savePalletDeliveryLocation: (
    palletId: number,
    data: DeliveryLocationInput,
  ) => Promise<DeliveryLocation>;
  scanCustomerPossessionPallet: (qrCode: string) => Promise<Pallet>;
  scanPalletByQr: (qrCode: string, scannedCandidates: string[]) => Promise<Pallet>;
  claimCustomerPossessionPallet: (
    palletId: number,
    statusId: number,
    location: string,
  ) => Promise<Pallet>;
  deletePallet: (id: number) => void;
  addClient: (
    client: Omit<ClientDetail, "id" | "user_id"> & { user_id?: number },
  ) => Promise<ClientDetail>;
  deleteClient: (id: number) => Promise<void>;
  updateClient: (client: ClientDetail) => void;
  updateStatusSettings: (status: PalletStatus) => void;
  addStatus: (status: Omit<PalletStatus, "id">) => void;
  deleteStatus: (id: number) => void;
  reportDamage: (report: {
    pallet_id: number;
    problem_description: string;
    images?: File[];
  }) => Promise<void>;
  resolveService: (reportId: number, userId: number, note: string) => void;
  reportGhostPallets: (
    count: number,
    clientId: number,
    clientName: string,
    details: string | GhostPalletReportInput,
  ) => Promise<void>;
  pairGhostPallet: (ghostId: number, newQrCode: string) => void;
  fetchInvoices: () => Promise<void>;
  fetchAuditLogs: () => Promise<void>;
  fetchRoles: () => Promise<void>;
  addRole: (role: Omit<Role, "id">) => Promise<void>;
  updateRole: (role: Role) => Promise<void>;
  deleteRole: (id: number) => Promise<void>;
  refreshData: () => Promise<void>;
  resetData: () => void;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: "status" | "payment" | "alert";
  read: boolean;
  created_at: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const APP_DATA_CACHE_KEY = "trackpal_app_data_cache";

interface AppDataCache {
  pallets: Pallet[];
  statuses: PalletStatus[];
  auditLogs: AuditLog[];
  clients: ClientDetail[];
  invoices: Invoice[];
  roles: Role[];
  permissions: Permission[];
  serviceReports: ServiceReport[];
  palletDashboardStats: PalletDashboardStats;
}

const readAppDataCache = (): Partial<AppDataCache> => {
  if (typeof window === "undefined" || !apiService.hasToken()) {
    return {};
  }

  try {
    const cachedData = window.localStorage.getItem(APP_DATA_CACHE_KEY);
    return cachedData ? (JSON.parse(cachedData) as Partial<AppDataCache>) : {};
  } catch {
    window.localStorage.removeItem(APP_DATA_CACHE_KEY);
    return {};
  }
};

const writeAppDataCache = (data: Partial<AppDataCache>) => {
  if (typeof window === "undefined" || !apiService.hasToken()) {
    return;
  }

  const currentData = readAppDataCache();
  window.localStorage.setItem(
    APP_DATA_CACHE_KEY,
    JSON.stringify({ ...currentData, ...data }),
  );
};

const clearAppDataCache = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(APP_DATA_CACHE_KEY);
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pallets, setPallets] = useState<Pallet[]>(
    () => readAppDataCache().pallets || [],
  );
  const [statuses, setStatuses] = useState<PalletStatus[]>(
    () => readAppDataCache().statuses || [],
  );
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(
    () => readAppDataCache().auditLogs || [],
  );
  const [clients, setClients] = useState<ClientDetail[]>(
    () => readAppDataCache().clients || [],
  );
  const [invoices, setInvoices] = useState<Invoice[]>(
    () => readAppDataCache().invoices || [],
  );
  const [roles, setRoles] = useState<Role[]>(
    () => readAppDataCache().roles || [],
  );
  const [permissions, setPermissions] = useState<Permission[]>(
    () => readAppDataCache().permissions || [],
  );
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") {
      return defaultLanguage;
    }

    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(storedLanguage) ? storedLanguage : defaultLanguage;
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>(
    () => readAppDataCache().serviceReports || [],
  );
  const [palletDashboardStats, setPalletDashboardStats] = useState<PalletDashboardStats | null>(
    () => readAppDataCache().palletDashboardStats || null,
  );
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGhostReportOpen, setIsGhostReportOpen] = useState(false);
  const palletLoadGenerationRef = useRef(0);

  useEffect(() => {
    setApiLocale(language);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  }, [language]);

  const buildNotifications = (
    nextAuditLogs: AuditLog[],
    nextServiceReports: ServiceReport[],
    nextInvoices: Invoice[],
    nextLanguage: AppLanguage = language,
  ): AppNotification[] => {
    const invoiceNotifications = nextInvoices
      .filter((invoice) => invoice.status === "overdue")
      .slice(0, 3)
      .map((invoice, index) => ({
        id: 1000 + index,
        title: "Payment Due",
        message: `${invoice.invoice_number} is overdue for ${invoice.customer_name}.`,
        type: "payment" as const,
        read: false,
        created_at: invoice.due_date || new Date().toISOString(),
      }));

    const auditNotifications = nextAuditLogs.slice(0, 4).map((log, index) => ({
      id: 2000 + index,
      title:
        log.type === "qr_version" ? "QR Version Update" : "Pallet Movement",
      message: `${log.pallet_qr || "Pallet"} moved to ${log.new_status_name || "new status"}.`,
      type: "status" as const,
      read: index > 1,
      created_at: log.created_at,
    }));

    const serviceNotifications = nextServiceReports
      .filter((report) => !report.resolved_at)
      .slice(0, 3)
      .map((report, index) => ({
        id: 3000 + index,
        title: "Service Required",
        message: formatServiceReportDescription(
          report.problem_description,
          nextLanguage,
        ),
        type: "alert" as const,
        read: false,
        created_at: report.created_at,
      }));

    return [
      ...invoiceNotifications,
      ...serviceNotifications,
      ...auditNotifications,
    ]
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() -
          new Date(left.created_at).getTime(),
      )
      .slice(0, 10);
  };

  const setLanguage = (lang: AppLanguage) => {
    setApiLocale(lang);
    setLanguageState(lang);
    setNotifications(buildNotifications(auditLogs, serviceReports, invoices, lang));
  };

  const resetData = () => {
    palletLoadGenerationRef.current += 1;
    clearAppDataCache();
    setPallets([]);
    setStatuses([]);
    setAuditLogs([]);
    setClients([]);
    setInvoices([]);
    setRoles([]);
    setPermissions([]);
    setServiceReports([]);
    setPalletDashboardStats(null);
    setNotifications([]);
  };

  const refreshData = async () => {
    if (!apiService.hasToken()) {
      resetData();
      return;
    }

    const palletLoadGeneration = ++palletLoadGenerationRef.current;

    const safeLoad = async <T,>(
      loader: () => Promise<T>,
      fallback: T,
    ): Promise<T> => {
      try {
        return await loader();
      } catch (error) {
        const status = (error as { status?: number }).status;
        if (!status || status >= 500) {
          console.error("Failed to load API data", error);
        }
        return fallback;
      }
    };

    const storedUser =
      typeof window === "undefined"
        ? null
        : (() => {
            try {
              return JSON.parse(
                window.localStorage.getItem("trackpal_current_user") || "null",
              ) as { permission_codes?: string[]; role_name?: string } | null;
            } catch {
              return null;
            }
          })();
    const accessCodes = storedUser?.permission_codes || [];
    const canLoadAccessSettings =
      accessCodes.includes("*") ||
      (accessCodes.includes("roles") && accessCodes.includes("modules"));
    const canLoadInvoices =
      storedUser?.role_name === "Admin" || storedUser?.role_name === "Klijent";
    const emptyRolesPage = {
      items: [],
      meta: { total: 0, limit: 100, offset: 0, count: 0 },
    };
    const emptyPalletPage = {
      items: [],
      meta: { total: 0, limit: 50, offset: 0, count: 0 },
    };
    const [
      statusesData,
      palletsPage,
      clientsData,
      auditLogsData,
      serviceReportsData,
      invoicesData,
      rolesPage,
      permissionsData,
      dashboardStatsData,
    ] = await Promise.all([
      safeLoad(() => apiService.statuses.list(), []),
      safeLoad(() => apiService.pallets.page({ limit: 50 }), emptyPalletPage),
      safeLoad(() => apiService.clients.list(), []),
      safeLoad(() => apiService.auditLogs.list({ limit: 50 }), []),
      safeLoad(() => apiService.serviceReports.list({ limit: 100 }), []),
      canLoadInvoices
        ? safeLoad(() => apiService.invoices.list(), [])
        : Promise.resolve([]),
      canLoadAccessSettings
        ? safeLoad(() => apiService.roles.page({ limit: 100 }), emptyRolesPage)
        : Promise.resolve(emptyRolesPage),
      canLoadAccessSettings
        ? safeLoad(() => apiService.permissions.list(), [])
        : Promise.resolve([]),
      safeLoad(() => apiService.pallets.stats(), null),
    ]);
    const rolesData = rolesPage.items;
    const palletsData = palletsPage.items;

    setStatuses(statusesData);
    setPallets(palletsData);
    setClients(clientsData);
    setAuditLogs(auditLogsData);
    setServiceReports(serviceReportsData);
    setInvoices(invoicesData);
    setRoles(rolesData);
    setPermissions(permissionsData);
    setPalletDashboardStats(dashboardStatsData);
    setNotifications(
      buildNotifications(auditLogsData, serviceReportsData, invoicesData),
    );
    writeAppDataCache({
      statuses: statusesData,
      pallets: palletsData,
      clients: clientsData,
      auditLogs: auditLogsData,
      serviceReports: serviceReportsData,
      invoices: invoicesData,
      roles: rolesData,
      permissions: permissionsData,
      palletDashboardStats: dashboardStatsData,
    });

    // Keep the initial dashboard responsive, then complete the shared pallet
    // cache in the background. Some views operate on this cache, so stopping
    // at the first page makes older pallets appear to be missing.
    if (palletsPage.meta.total > palletsData.length) {
      void safeLoad(() => apiService.pallets.list(), []).then((allPallets) => {
        if (
          palletLoadGeneration !== palletLoadGenerationRef.current ||
          allPallets.length <= palletsData.length
        ) {
          return;
        }

        setPallets(allPallets);
        writeAppDataCache({ pallets: allPallets });
      });
    }
  };

  const fetchInvoices = async () => {
    try {
      const data = await apiService.invoices.list({ limit: 100 });
      setInvoices(data);
      writeAppDataCache({ invoices: data });
    } catch (error) {
      console.error("Failed to fetch invoices", error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiService.auditLogs.list({ limit: 50 });
      setAuditLogs(data);
      writeAppDataCache({ auditLogs: data });
    } catch (error) {
      console.error("Failed to fetch audit logs", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const [rolesPage, permsData] = await Promise.all([
        apiService.roles.page({ limit: 100 }),
        apiService.permissions.list(),
      ]);
      const rolesData = rolesPage.items;
      setRoles(rolesData);
      setPermissions(permsData);
      writeAppDataCache({ roles: rolesData, permissions: permsData });
    } catch (error) {
      console.error("Failed to fetch roles", error);
    }
  };

  const addRole = async (role: Omit<Role, "id">) => {
    const newRole = await apiService.roles.create(role);
    setRoles((prev) => {
      const nextRoles = [...prev, newRole];
      writeAppDataCache({ roles: nextRoles });
      return nextRoles;
    });
  };

  const updateRole = async (role: Role) => {
    const updatedRole = await apiService.roles.update(role.id, role);
    setRoles((prev) => {
      const nextRoles = prev.map((existingRole) =>
        existingRole.id === updatedRole.id ? updatedRole : existingRole,
      );
      writeAppDataCache({ roles: nextRoles });
      return nextRoles;
    });
  };

  const deleteRole = async (id: number) => {
    await apiService.roles.delete(id);
    setRoles((prev) => {
      const nextRoles = prev.filter((role) => role.id !== id);
      writeAppDataCache({ roles: nextRoles });
      return nextRoles;
    });
  };

  const t = (key: string) => translate(language, key);

  const markNotificationRead = (id: number) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
  };

  const pushNotification = (
    title: string,
    message: string,
    type: AppNotification["type"] = "alert",
  ) => {
    setNotifications((prev) => {
      const nextId =
        prev.length > 0
          ? Math.max(...prev.map((notification) => notification.id)) + 1
          : 1;
      const newNotification: AppNotification = {
        id: nextId,
        title,
        message,
        type,
        read: false,
        created_at: new Date().toISOString(),
      };

      return [newNotification, ...prev];
    });
  };

  const updatePalletStatus = (
    palletId: number,
    statusId: number,
    userId: number,
    userName: string,
    location?: string,
    note?: string,
    clientId?: number,
  ) => {
    const pallet = pallets.find((item) => item.id === palletId);
    const status = statuses.find((item) => item.id === statusId);
    const preserveClientAssignment = statusAllowsCustomer(status);

    if (!pallet || !status) {
      return;
    }

    const nextClientId = preserveClientAssignment
      ? (clientId ?? pallet.user_id)
      : undefined;
    const nextLocation = ["bih-nl-transport", "nl-bih-transport"].includes(
      status.slug,
    )
      ? "Na putu"
      : location || pallet.current_location;
    const nextClientName = preserveClientAssignment
      ? nextClientId
        ? clients.find((client) => client.user_id === nextClientId)?.name ||
          pallet.client_name
        : pallet.client_name
      : undefined;

    setPallets((prev) =>
      prev.map((item) => {
        if (item.id !== palletId) {
          return item;
        }

        return {
          ...item,
          current_status_id: statusId,
          current_status_name: status.name,
          current_location: nextLocation,
          last_status_changed_at: new Date().toISOString(),
          user_id: nextClientId,
          client_name: nextClientName,
          note: note || item.note,
        };
      }),
    );

    setNotifications((prev) => {
      const nextId =
        prev.length > 0
          ? Math.max(...prev.map((notification) => notification.id)) + 1
          : 1;
      const newNotification: AppNotification = {
        id: nextId,
        title: "Status Update",
        message: `${pallet.qr_code} moved to ${status.name}`,
        type: "status",
        read: false,
        created_at: new Date().toISOString(),
      };

      return [newNotification, ...prev];
    });

    void apiService.pallets
      .update(palletId, {
        ...pallet,
        current_status_id: statusId,
        current_status_name: status.name,
        current_location: nextLocation,
        user_id: nextClientId ?? pallet.user_id,
        client_name: nextClientName ?? pallet.client_name,
        note: note || pallet.note,
      })
      .then((updatedPallet) => {
        setPallets((prev) =>
          prev.map((item) =>
            item.id === updatedPallet.id ? updatedPallet : item,
          ),
        );
        void fetchAuditLogs();
      })
      .catch((error) => console.error("Failed to update pallet status", error));
  };

  const buildNewPallet = (id: number, qrCode: string, type: string): Pallet => {
    const defaultStatus =
      statuses.find((status) => status.id === 8) || statuses[0];
    const timestamp = new Date().toISOString();
    const normalizedQrCode = normalizeQrCodeForStorage(qrCode);

    return {
      id,
      qr_code: normalizedQrCode,
      pallet_name: normalizedQrCode,
      type,
      current_status_id: defaultStatus?.id || 8,
      current_status_name: defaultStatus?.name || "Onbekend",
      current_location: "",
      last_status_changed_at: timestamp,
      created_at: timestamp,
      is_ghost: false,
      is_for_repair: false,
      is_active: true,
    };
  };

  const addPallet = (qrCode: string, type: string) => {
    const nextId =
      pallets.length > 0
        ? Math.max(...pallets.map((pallet) => pallet.id)) + 1
        : 1;
    const optimisticPallet = buildNewPallet(nextId, qrCode, type);
    const fallbackClient = clients[0];

    setPallets((prev) => [...prev, optimisticPallet]);

    if (!fallbackClient) {
      return;
    }

    void apiService.pallets
      .create({
        ...optimisticPallet,
        user_id: fallbackClient.user_id,
        client_name: fallbackClient.name,
      })
      .then((createdPallet) => {
        setPallets((prev) =>
          prev.map((pallet) =>
            pallet.id === optimisticPallet.id ? createdPallet : pallet,
          ),
        );
      })
      .catch((error) => console.error("Failed to create pallet", error));
  };

  const addPalletBatch = (entries: Array<{ qrCode: string; type: string }>) => {
    if (entries.length === 0) {
      return;
    }

    const nextId =
      pallets.length > 0
        ? Math.max(...pallets.map((pallet) => pallet.id)) + 1
        : 1;
    const nextPallets = entries.map((entry, index) =>
      buildNewPallet(nextId + index, entry.qrCode, entry.type),
    );
    const fallbackClient = clients[0];

    setPallets((prev) => [...prev, ...nextPallets]);

    if (!fallbackClient) {
      return;
    }

    void Promise.all(
      nextPallets.map((pallet) =>
        apiService.pallets.create({
          ...pallet,
          user_id: fallbackClient.user_id,
          client_name: fallbackClient.name,
        }),
      ),
    )
      .then((createdPallets) => {
        const createdByQr = new Map(
          createdPallets.map((pallet) => [pallet.qr_code, pallet]),
        );
        setPallets((prev) =>
          prev.map((pallet) => createdByQr.get(pallet.qr_code) || pallet),
        );
      })
      .catch((error) => console.error("Failed to create pallet batch", error));
  };

  const updatePallet = async (
    pallet: Pallet,
    actor?: { id: number; name: string },
  ): Promise<Pallet> => {
    const normalizedQrCode = normalizeQrCodeForStorage(pallet.qr_code);
    const previousPallet = pallets.find((item) => item.id === pallet.id);
    const normalizedPallet: Pallet = {
      ...pallet,
      qr_code: normalizedQrCode,
      pallet_name:
        pallet.pallet_name?.trim() ||
        previousPallet?.pallet_name?.trim() ||
        normalizedQrCode,
      reference_code: pallet.reference_code
        ? normalizeQrCodeForStorage(pallet.reference_code)
        : undefined,
    };
    const hasStatusChange = Boolean(
      previousPallet &&
        previousPallet.current_status_id !== normalizedPallet.current_status_id,
    );
    const hasQrCodeChange = Boolean(
      previousPallet && previousPallet.qr_code !== normalizedPallet.qr_code,
    );
    const timestamp = new Date().toISOString();
    const palletWithLegacyReference =
      previousPallet && hasQrCodeChange && !normalizedPallet.reference_code
        ? {
            ...normalizedPallet,
            reference_code: previousPallet.qr_code,
          }
        : normalizedPallet;
    const nextPallet =
      previousPallet && hasStatusChange
        ? {
            ...palletWithLegacyReference,
            last_status_changed_at: timestamp,
          }
        : palletWithLegacyReference;

    setPallets((prev) =>
      prev.map((item) => (item.id === pallet.id ? nextPallet : item)),
    );

    if (previousPallet && hasStatusChange) {
      pushNotification(
        "Status Update",
        `${nextPallet.qr_code} moved to ${nextPallet.current_status_name}${actor?.name ? ` by ${actor.name}` : ""}.`,
        "status",
      );
    }

    if (previousPallet && hasQrCodeChange) {
      pushNotification(
        "QR Version Update",
        `${previousPallet.qr_code} updated to ${nextPallet.qr_code}.`,
        "status",
      );
    }

    try {
      const updatedPallet = await apiService.pallets.update(nextPallet.id, nextPallet);
      setPallets((prev) => {
        const exists = prev.some((item) => item.id === updatedPallet.id);

        return exists
          ? prev.map((item) => item.id === updatedPallet.id ? updatedPallet : item)
          : [updatedPallet, ...prev];
      });
      void fetchAuditLogs();
      void apiService.pallets.stats().then(setPalletDashboardStats).catch(() => undefined);

      return updatedPallet;
    } catch (error) {
      if (previousPallet) {
        setPallets((prev) =>
          prev.map((item) => item.id === previousPallet.id ? previousPallet : item),
        );
      }
      throw error;
    }
  };

  const deletePallet = (id: number) => {
    setPallets((prev) => prev.filter((pallet) => pallet.id !== id));
    void apiService.pallets.delete(id).catch((error) => {
      console.error("Failed to delete pallet", error);
      void refreshData();
    });
  };

  const savePalletDeliveryLocation = async (
    palletId: number,
    data: DeliveryLocationInput,
  ): Promise<DeliveryLocation> => {
    const deliveryLocation = await apiService.pallets.saveDeliveryLocation(
      palletId,
      data,
    );
    const streetLine = [deliveryLocation.street, deliveryLocation.house_number]
      .filter(Boolean)
      .join(" ")
      .trim();
    const localityLine = [deliveryLocation.postal_code, deliveryLocation.city]
      .filter(Boolean)
      .join(" ")
      .trim();
    const deliveryAddress =
      [streetLine, localityLine].filter(Boolean).join(", ") ||
      deliveryLocation.formatted_address ||
      "";

    setPallets((previous) =>
      previous.map((pallet) =>
        pallet.id === palletId
          ? {
              ...pallet,
              delivery_location: deliveryLocation,
              current_location: deliveryAddress || pallet.current_location,
            }
          : pallet,
      ),
    );

    return deliveryLocation;
  };

  const upsertPalletInState = (nextPallet: Pallet) => {
    setPallets((previous) => {
      const exists = previous.some((pallet) => pallet.id === nextPallet.id);
      return exists
        ? previous.map((pallet) => pallet.id === nextPallet.id ? nextPallet : pallet)
        : [nextPallet, ...previous];
    });
  };

  const scanCustomerPossessionPallet = async (qrCode: string): Promise<Pallet> => {
    const pallet = await apiService.pallets.scanCustomerPossession(qrCode);
    upsertPalletInState(pallet);
    return pallet;
  };

  const updatePalletRepairStatus = async (palletId: number, isForRepair: boolean): Promise<Pallet> => {
    const pallet = pallets.find((item) => item.id === palletId);

    if (pallet) {
      setPallets((previous) => previous.map((item) =>
        item.id === palletId ? { ...item, is_for_repair: isForRepair } : item
      ));
    }

    try {
      const updatedPallet = await apiService.pallets.updateRepairStatus(palletId, isForRepair);
      upsertPalletInState(updatedPallet);
      // Refresh the activity log in the background so the button result is not delayed by a second request.
      void fetchAuditLogs();
      console.info('Pallet service status updated', {
        palletId: updatedPallet.id,
        qrCode: updatedPallet.qr_code,
        admittedToService: isForRepair,
      });
      return updatedPallet;
    } catch (error) {
      console.error('Failed to update pallet repair status', error);
      if (pallet) {
        setPallets((previous) => previous.map((item) =>
          item.id === palletId ? pallet : item
        ));
      }
      throw error;
    }
  };

  const scanPalletByQr = async (qrCode: string, scannedCandidates: string[]): Promise<Pallet> => {
    const pallet = await apiService.pallets.scanLookup(qrCode, scannedCandidates);
    upsertPalletInState(pallet);
    return pallet;
  };

  const claimCustomerPossessionPallet = async (
    palletId: number,
    statusId: number,
    location: string,
  ): Promise<Pallet> => {
    const pallet = await apiService.pallets.claimCustomerPossession(
      palletId,
      statusId,
      location,
    );
    upsertPalletInState(pallet);
    return pallet;
  };

  const reportDamage = (report: {
    pallet_id: number;
    problem_description: string;
    images?: File[];
  }) => {
    return apiService.serviceReports.create(report).then((createdReport) => {
      setServiceReports((prev) => [
        createdReport,
        ...prev.filter((item) => item.id !== createdReport.id),
      ]);
    });
  };

  const resolveService = (reportId: number, userId: number, note: string) => {
    const report = serviceReports.find((item) => item.id === reportId);
    if (!report) {
      return;
    }

    setServiceReports((prev) =>
      prev.map((item) =>
        item.id === reportId
          ? {
              ...item,
              resolved_by_user_id: userId,
              resolved_at: new Date().toISOString(),
              resolution_note: note,
            }
          : item,
      ),
    );

    updatePalletStatus(
      report.pallet_id,
      1,
      userId,
      "Technician",
      "Service Doboj",
      `Repaired: ${note}`,
    );

    void apiService.serviceReports
      .resolve(reportId, note)
      .then((updatedReport) => {
        setServiceReports((prev) =>
          prev.map((item) =>
            item.id === updatedReport.id ? updatedReport : item,
          ),
        );
      })
      .catch((error) =>
        console.error("Failed to resolve service report", error),
      );
  };

  const reportGhostPallets = async (
    count: number,
    clientId: number,
    clientName: string,
    details: string | GhostPalletReportInput,
  ) => {
    const normalizedDetails =
      typeof details === "string" ? { note: details } : details;
    const baseLocation =
      normalizedDetails.location?.trim() || "Client Location";
    const baseNote = normalizedDetails.note?.trim() || "";
    const entryDetails = normalizedDetails.entries || [];

    try {
      const createdPallets = await apiService.ghostReports.create({
        user_id: clientId,
        quantity: count,
        location: baseLocation,
        description: "No-QR pallet return reported from frontend.",
        notes: baseNote || undefined,
        metadata: {
          entries: entryDetails,
        },
        image: normalizedDetails.image,
      });

      setPallets((previous) => [
        ...createdPallets,
        ...previous.filter((pallet) => !createdPallets.some((created) => created.id === pallet.id)),
      ]);
    } catch (error) {
      console.error("Failed to create pallets without QR codes", error);
      throw error;
    }

    const notificationDetails = [
      baseLocation !== "Client Location" ? `Location: ${baseLocation}` : "",
      baseNote,
    ]
      .filter(Boolean)
      .join(" | ");

    pushNotification(
      t("ghostReport"),
      language === "nl"
        ? `${count} bok${count > 1 ? "ken" : ""} zonder QR-code gemeld voor ${clientName}.${notificationDetails ? ` ${notificationDetails}` : ""}`
        : language === "bs"
          ? `${count} paleta${count > 1 ? " bez QR koda" : " bez QR koda"} prijavljeno za ${clientName}.${notificationDetails ? ` ${notificationDetails}` : ""}`
          : `${count} pallet${count > 1 ? "s" : ""} without a QR code reported for ${clientName}.${notificationDetails ? ` ${notificationDetails}` : ""}`,
      "alert",
    );
  };

  const pairGhostPallet = (ghostId: number, newQrCode: string) => {
    const normalizedQrCode = normalizeQrCodeForStorage(newQrCode);
    const ghost = pallets.find((pallet) => pallet.id === ghostId);

    setPallets((prev) =>
      prev.map((item) => {
        if (item.id !== ghostId) {
          return item;
        }

        return {
          ...item,
          qr_code: normalizedQrCode,
          pallet_name: normalizedQrCode,
          is_ghost: false,
          note: `${item.note || ""} (Paired from a pallet without a QR code on ${formatAppDate(new Date(), language)})`,
        };
      }),
    );

    if (ghost) {
      pushNotification(
        t("reviewAndPair"),
        language === "nl"
          ? `${ghost.client_name || "Klant"} bok zonder QR-code is gekoppeld aan QR ${normalizedQrCode}.`
          : language === "bs"
            ? `${ghost.client_name || "Klijent"} paleta bez QR koda je uparena s QR kodom ${normalizedQrCode}.`
            : `${ghost.client_name || "Client"} pallet without a QR code is now paired with QR ${normalizedQrCode}.`,
        "status",
      );

      void apiService.pallets
        .update(ghost.id, {
          ...ghost,
          qr_code: normalizedQrCode,
          pallet_name: normalizedQrCode,
          is_ghost: false,
          note: `${ghost.note || ""} (Paired from a pallet without a QR code on ${formatAppDate(new Date(), language)})`,
        })
        .then((updatedPallet) => {
          setPallets((prev) =>
            prev.map((item) =>
              item.id === updatedPallet.id ? updatedPallet : item,
            ),
          );
          void fetchAuditLogs();
        })
        .catch((error) => console.error("Failed to pair pallet without a QR code", error));
    }
  };

  const addClient = async (
    client: Omit<ClientDetail, "id" | "user_id"> & { user_id?: number },
  ) => {
    const createdClient = await apiService.clients.create(client);
    setClients((current) => [
      ...current.filter(
        (existingClient) => existingClient.id !== createdClient.id,
      ),
      createdClient,
    ]);

    return createdClient;
  };

  const updateClient = (client: ClientDetail) => {
    setClients((prev) =>
      prev.map((item) => (item.id === client.id ? client : item)),
    );
    void apiService.clients
      .update(client)
      .then((updatedClient) => {
        setClients((prev) =>
          prev.map((item) =>
            item.id === updatedClient.id ? updatedClient : item,
          ),
        );
      })
      .catch((error) => console.error("Failed to update client", error));
  };

  const deleteClient = async (id: number) => {
    const deletedClient = clients.find((client) => client.id === id);
    await apiService.clients.delete(id);
    if (deletedClient) {
      setPallets((current) =>
        current.map((pallet) =>
          pallet.user_id === deletedClient.user_id
            ? {
                ...pallet,
                user_id: undefined,
                client_name: deletedClient.name,
                client_deleted: true,
              }
            : pallet,
        ),
      );
    }
    setClients((current) => current.filter((client) => client.id !== id));
  };

  const updateStatusSettings = (status: PalletStatus) => {
    setStatuses((prev) =>
      prev.map((item) => (item.id === status.id ? status : item)),
    );
    void apiService.statuses
      .update(status)
      .then((updatedStatus) => {
        setStatuses((prev) =>
          prev.map((item) =>
            item.id === updatedStatus.id ? updatedStatus : item,
          ),
        );
      })
      .catch((error) => console.error("Failed to update status", error));
  };

  const addStatus = (status: Omit<PalletStatus, "id">) => {
    const nextId =
      statuses.length > 0
        ? Math.max(...statuses.map((item) => item.id)) + 1
        : 1;
    const optimisticStatus = { ...status, id: nextId };

    setStatuses((prev) => [...prev, optimisticStatus]);

    void apiService.statuses
      .create(status)
      .then((createdStatus) => {
        setStatuses((prev) =>
          prev.map((item) =>
            item.id === optimisticStatus.id ? createdStatus : item,
          ),
        );
      })
      .catch((error) => console.error("Failed to create status", error));
  };

  const deleteStatus = (id: number) => {
    setStatuses((prev) => prev.filter((status) => status.id !== id));
    void apiService.statuses.delete(id).catch((error) => {
      console.error("Failed to delete status", error);
      void refreshData();
    });
  };

  return (
    <AppContext.Provider
      value={{
        pallets,
        statuses,
        auditLogs,
        clients,
        invoices,
        roles,
        permissions,
        language,
        notifications,
        serviceReports,
        palletDashboardStats,
        isScannerOpen,
        isGhostReportOpen,
        setIsScannerOpen,
        setIsGhostReportOpen,
        setLanguage,
        t,
        updatePalletStatus,
        updatePalletRepairStatus,
        markNotificationRead,
        addPallet,
        addPalletBatch,
        updatePallet,
        savePalletDeliveryLocation,
        scanCustomerPossessionPallet,
        scanPalletByQr,
        claimCustomerPossessionPallet,
        deletePallet,
        addClient,
        deleteClient,
        updateClient,
        updateStatusSettings,
        addStatus,
        deleteStatus,
        reportDamage,
        resolveService,
        reportGhostPallets,
        pairGhostPallet,
        fetchInvoices,
        fetchAuditLogs,
        fetchRoles,
        addRole,
        updateRole,
        deleteRole,
        refreshData,
        resetData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
};
