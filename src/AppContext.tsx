import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AuditLog,
  ClientDetail,
  GhostPalletReportInput,
  Invoice,
  Pallet,
  PalletStatus,
  Permission,
  Role,
  ServiceReport,
} from './types';
import { apiService } from './services/api';
import {
  AppLanguage,
  defaultLanguage,
  isAppLanguage,
  LANGUAGE_STORAGE_KEY,
  translate,
} from './i18n';
import { normalizeQrCodeForStorage } from './lib/palletQrMatching';

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
    clientId?: number
  ) => void;
  markNotificationRead: (id: number) => void;
  addPallet: (qrCode: string, type: string) => void;
  addPalletBatch: (entries: Array<{ qrCode: string; type: string }>) => void;
  updatePallet: (pallet: Pallet, actor?: { id: number; name: string }) => void;
  deletePallet: (id: number) => void;
  addClient: (client: Omit<ClientDetail, 'id' | 'user_id'> & { user_id?: number }) => void;
  updateClient: (client: ClientDetail) => void;
  updateStatusSettings: (status: PalletStatus) => void;
  addStatus: (status: Omit<PalletStatus, 'id'>) => void;
  deleteStatus: (id: number) => void;
  reportDamage: (
    report: Omit<ServiceReport, 'id' | 'created_at'> & { reported_by_user_name?: string }
  ) => void;
  resolveService: (reportId: number, userId: number, note: string) => void;
  reportGhostPallets: (
    count: number,
    clientId: number,
    clientName: string,
    details: string | GhostPalletReportInput
  ) => void;
  pairGhostPallet: (ghostId: number, newQrCode: string) => void;
  fetchInvoices: () => Promise<void>;
  fetchAuditLogs: () => Promise<void>;
  fetchRoles: () => Promise<void>;
  addRole: (role: Omit<Role, 'id'>) => Promise<void>;
  updateRole: (role: Role) => Promise<void>;
  deleteRole: (id: number) => Promise<void>;
  refreshData: () => Promise<void>;
  resetData: () => void;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  type: 'status' | 'payment' | 'alert';
  read: boolean;
  created_at: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const APP_DATA_CACHE_KEY = 'trackpal_app_data_cache';

interface AppDataCache {
  pallets: Pallet[];
  statuses: PalletStatus[];
  auditLogs: AuditLog[];
  clients: ClientDetail[];
  invoices: Invoice[];
  roles: Role[];
  permissions: Permission[];
  serviceReports: ServiceReport[];
}

const readAppDataCache = (): Partial<AppDataCache> => {
  if (typeof window === 'undefined' || !apiService.hasToken()) {
    return {};
  }

  try {
    const cachedData = window.localStorage.getItem(APP_DATA_CACHE_KEY);
    return cachedData ? JSON.parse(cachedData) as Partial<AppDataCache> : {};
  } catch {
    window.localStorage.removeItem(APP_DATA_CACHE_KEY);
    return {};
  }
};

const writeAppDataCache = (data: Partial<AppDataCache>) => {
  if (typeof window === 'undefined' || !apiService.hasToken()) {
    return;
  }

  const currentData = readAppDataCache();
  window.localStorage.setItem(APP_DATA_CACHE_KEY, JSON.stringify({ ...currentData, ...data }));
};

const clearAppDataCache = () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(APP_DATA_CACHE_KEY);
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pallets, setPallets] = useState<Pallet[]>(() => readAppDataCache().pallets || []);
  const [statuses, setStatuses] = useState<PalletStatus[]>(() => readAppDataCache().statuses || []);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => readAppDataCache().auditLogs || []);
  const [clients, setClients] = useState<ClientDetail[]>(() => readAppDataCache().clients || []);
  const [invoices, setInvoices] = useState<Invoice[]>(() => readAppDataCache().invoices || []);
  const [roles, setRoles] = useState<Role[]>(() => readAppDataCache().roles || []);
  const [permissions, setPermissions] = useState<Permission[]>(() => readAppDataCache().permissions || []);
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === 'undefined') {
      return defaultLanguage;
    }

    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(storedLanguage) ? storedLanguage : defaultLanguage;
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>(() => readAppDataCache().serviceReports || []);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGhostReportOpen, setIsGhostReportOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
  }, [language]);

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
  };

  const buildNotifications = (
    nextAuditLogs: AuditLog[],
    nextServiceReports: ServiceReport[],
    nextInvoices: Invoice[]
  ): AppNotification[] => {
    const invoiceNotifications = nextInvoices
      .filter((invoice) => invoice.status === 'overdue')
      .slice(0, 3)
      .map((invoice, index) => ({
        id: 1000 + index,
        title: 'Payment Due',
        message: `${invoice.invoice_number} is overdue for ${invoice.customer_name}.`,
        type: 'payment' as const,
        read: false,
        created_at: invoice.due_date || new Date().toISOString(),
      }));

    const auditNotifications = nextAuditLogs.slice(0, 4).map((log, index) => ({
      id: 2000 + index,
      title: log.type === 'qr_version' ? 'QR Version Update' : 'Pallet Movement',
      message: `${log.pallet_qr || 'Pallet'} moved to ${log.new_status_name || 'new status'}.`,
      type: 'status' as const,
      read: index > 1,
      created_at: log.created_at,
    }));

    const serviceNotifications = nextServiceReports
      .filter((report) => !report.resolved_at)
      .slice(0, 3)
      .map((report, index) => ({
        id: 3000 + index,
        title: 'Service Required',
        message: report.problem_description,
        type: 'alert' as const,
        read: false,
        created_at: report.created_at,
      }));

    return [...invoiceNotifications, ...serviceNotifications, ...auditNotifications]
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 10);
  };

  const resetData = () => {
    clearAppDataCache();
    setPallets([]);
    setStatuses([]);
    setAuditLogs([]);
    setClients([]);
    setInvoices([]);
    setRoles([]);
    setPermissions([]);
    setServiceReports([]);
    setNotifications([]);
  };

  const refreshData = async () => {
    if (!apiService.hasToken()) {
      resetData();
      return;
    }

    const safeLoad = async <T,>(loader: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await loader();
      } catch (error) {
        console.error('Failed to load API data', error);
        return fallback;
      }
    };

    const [statusesData, palletsData, clientsData, auditLogsData, serviceReportsData, invoicesData, rolesPage, permissionsData] = await Promise.all([
      safeLoad(() => apiService.statuses.list(), []),
      safeLoad(() => apiService.pallets.list(), []),
      safeLoad(() => apiService.clients.list(), []),
      safeLoad(() => apiService.auditLogs.list({ limit: 50 }), []),
      safeLoad(() => apiService.serviceReports.list({ limit: 100 }), []),
      safeLoad(() => apiService.invoices.list(), []),
      safeLoad(() => apiService.roles.page({ limit: 100 }), {
        items: [],
        meta: { total: 0, limit: 100, offset: 0, count: 0 },
      }),
      safeLoad(() => apiService.permissions.list(), []),
    ]);
    const rolesData = rolesPage.items;

    setStatuses(statusesData);
    setPallets(palletsData);
    setClients(clientsData);
    setAuditLogs(auditLogsData);
    setServiceReports(serviceReportsData);
    setInvoices(invoicesData);
    setRoles(rolesData);
    setPermissions(permissionsData);
    setNotifications(buildNotifications(auditLogsData, serviceReportsData, invoicesData));
    writeAppDataCache({
      statuses: statusesData,
      pallets: palletsData,
      clients: clientsData,
      auditLogs: auditLogsData,
      serviceReports: serviceReportsData,
      invoices: invoicesData,
      roles: rolesData,
      permissions: permissionsData,
    });
  };

  const fetchInvoices = async () => {
    try {
      const data = await apiService.invoices.list({ limit: 100 });
      setInvoices(data);
      writeAppDataCache({ invoices: data });
    } catch (error) {
      console.error('Failed to fetch invoices', error);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const data = await apiService.auditLogs.list({ limit: 50 });
      setAuditLogs(data);
      writeAppDataCache({ auditLogs: data });
    } catch (error) {
      console.error('Failed to fetch audit logs', error);
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
      console.error('Failed to fetch roles', error);
    }
  };

  const addRole = async (role: Omit<Role, 'id'>) => {
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
      const nextRoles = prev.map((existingRole) => (existingRole.id === updatedRole.id ? updatedRole : existingRole));
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
    setNotifications((prev) => prev.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)));
  };

  const getNextQrVersion = (palletId: number) => {
    const existingVersionLogs = auditLogs.filter(
      (log) => log.type === 'qr_version' && log.pallet_id === palletId
    ).length;

    return `1.${String(existingVersionLogs + 12).padStart(2, '0')}`;
  };

  const pushNotification = (
    title: string,
    message: string,
    type: AppNotification['type'] = 'alert'
  ) => {
    setNotifications((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((notification) => notification.id)) + 1 : 1;
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
    clientId?: number
  ) => {
    const pallet = pallets.find((item) => item.id === palletId);
    const status = statuses.find((item) => item.id === statusId);
    const preserveClientAssignment = [4, 5].includes(statusId);

    if (!pallet || !status) {
      return;
    }

    const oldStatusId = pallet.current_status_id;
    const oldStatusName = pallet.current_status_name;
    const oldLocation = pallet.current_location;
    const nextClientId = preserveClientAssignment ? clientId ?? pallet.user_id : undefined;
    const nextClientName = preserveClientAssignment
      ? (nextClientId
          ? clients.find((client) => client.user_id === nextClientId)?.name || pallet.client_name
          : pallet.client_name)
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
          current_location: location || item.current_location,
          last_status_changed_at: new Date().toISOString(),
          user_id: nextClientId,
          client_name: nextClientName,
          note: note || item.note,
        };
      })
    );

    setAuditLogs((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((log) => log.id)) + 1 : 1;
      const newLog: AuditLog = {
        id: nextId,
        pallet_id: palletId,
        pallet_qr: pallet.qr_code,
        made_by_user_id: userId,
        made_by_user_name: userName,
        type: 'status',
        old_status_id: oldStatusId,
        old_status_name: oldStatusName,
        new_status_id: statusId,
        new_status_name: status.name,
        old_client_id: pallet.user_id,
        new_client_id: nextClientId,
        old_location: oldLocation,
        new_location: location || pallet.current_location,
        note,
        created_at: new Date().toISOString(),
      };

      return [newLog, ...prev];
    });

    setNotifications((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((notification) => notification.id)) + 1 : 1;
      const newNotification: AppNotification = {
        id: nextId,
        title: 'Status Update',
        message: `${pallet.qr_code} moved to ${status.name}`,
        type: 'status',
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
        current_location: location || pallet.current_location,
        user_id: nextClientId ?? pallet.user_id,
        client_name: nextClientName ?? pallet.client_name,
        note: note || pallet.note,
      })
      .then((updatedPallet) => {
        setPallets((prev) => prev.map((item) => (item.id === updatedPallet.id ? updatedPallet : item)));
      })
      .catch((error) => console.error('Failed to update pallet status', error));
  };

  const buildNewPallet = (id: number, qrCode: string, type: string): Pallet => {
    const defaultStatus = statuses.find((status) => status.id === 8) || statuses[0];
    const timestamp = new Date().toISOString();
    const normalizedQrCode = normalizeQrCodeForStorage(qrCode);

    return {
      id,
      qr_code: normalizedQrCode,
      pallet_name: normalizedQrCode,
      type,
      current_status_id: defaultStatus?.id || 8,
      current_status_name: defaultStatus?.name || 'Onbekend',
      current_location: '',
      last_status_changed_at: timestamp,
      created_at: timestamp,
      is_ghost: false,
      is_active: true,
    };
  };

  const addPallet = (qrCode: string, type: string) => {
    const nextId = pallets.length > 0 ? Math.max(...pallets.map((pallet) => pallet.id)) + 1 : 1;
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
        setPallets((prev) => prev.map((pallet) => (pallet.id === optimisticPallet.id ? createdPallet : pallet)));
      })
      .catch((error) => console.error('Failed to create pallet', error));
  };

  const addPalletBatch = (entries: Array<{ qrCode: string; type: string }>) => {
    if (entries.length === 0) {
      return;
    }

    const nextId = pallets.length > 0 ? Math.max(...pallets.map((pallet) => pallet.id)) + 1 : 1;
    const nextPallets = entries.map((entry, index) =>
      buildNewPallet(nextId + index, entry.qrCode, entry.type)
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
        })
      )
    )
      .then((createdPallets) => {
        const createdByQr = new Map(createdPallets.map((pallet) => [pallet.qr_code, pallet]));
        setPallets((prev) => prev.map((pallet) => createdByQr.get(pallet.qr_code) || pallet));
      })
      .catch((error) => console.error('Failed to create pallet batch', error));
  };

  const updatePallet = (pallet: Pallet, actor?: { id: number; name: string }) => {
    const normalizedQrCode = normalizeQrCodeForStorage(pallet.qr_code);
    const previousPallet = pallets.find((item) => item.id === pallet.id);
    const normalizedPallet: Pallet = {
      ...pallet,
      qr_code: normalizedQrCode,
      pallet_name: normalizedQrCode,
      reference_code: pallet.reference_code ? normalizeQrCodeForStorage(pallet.reference_code) : undefined,
    };
    const hasOperationalChange = Boolean(
      previousPallet &&
      (
        previousPallet.current_status_id !== normalizedPallet.current_status_id ||
        previousPallet.current_status_name !== normalizedPallet.current_status_name ||
        previousPallet.current_location !== normalizedPallet.current_location ||
        previousPallet.user_id !== normalizedPallet.user_id ||
        previousPallet.client_name !== normalizedPallet.client_name
      )
    );
    const hasQrCodeChange = Boolean(previousPallet && previousPallet.qr_code !== normalizedPallet.qr_code);
    const timestamp = new Date().toISOString();
    const palletWithLegacyReference =
      previousPallet && hasQrCodeChange && !normalizedPallet.reference_code
        ? {
            ...normalizedPallet,
            reference_code: previousPallet.qr_code,
          }
        : normalizedPallet;
    const nextPallet =
      previousPallet && hasOperationalChange
        ? {
            ...palletWithLegacyReference,
            last_status_changed_at: timestamp,
          }
        : palletWithLegacyReference;

    setPallets((prev) => prev.map((item) => (item.id === pallet.id ? nextPallet : item)));

    if (!previousPallet) {
      return;
    }

    if (hasOperationalChange || hasQrCodeChange) {
      const qrVersion = hasQrCodeChange ? getNextQrVersion(pallet.id) : null;

      setAuditLogs((prev) => {
        let nextId = prev.length > 0 ? Math.max(...prev.map((log) => log.id)) + 1 : 1;
        const nextLogs: AuditLog[] = [];

        if (hasOperationalChange) {
          nextLogs.push({
            id: nextId++,
            pallet_id: nextPallet.id,
            pallet_qr: nextPallet.qr_code,
            made_by_user_id: actor?.id ?? 1,
            made_by_user_name: actor?.name ?? 'Admin User',
            type: 'status',
            old_status_id: previousPallet.current_status_id,
            new_status_id: nextPallet.current_status_id,
            old_status_name: previousPallet.current_status_name,
            new_status_name: nextPallet.current_status_name,
            old_client_id: previousPallet.user_id,
            new_client_id: nextPallet.user_id,
            old_location: previousPallet.current_location,
            new_location: nextPallet.current_location,
            note: nextPallet.note || 'Status updated from admin panel.',
            created_at: timestamp,
          });
        }

        if (hasQrCodeChange && qrVersion) {
          nextLogs.push({
            id: nextId,
            pallet_id: nextPallet.id,
            pallet_qr: nextPallet.qr_code,
            made_by_user_id: actor?.id ?? 1,
            made_by_user_name: actor?.name ?? 'Admin User',
            type: 'qr_version',
            old_status_id: previousPallet.current_status_id,
            new_status_id: nextPallet.current_status_id,
            old_status_name: previousPallet.current_status_name,
            new_status_name: nextPallet.current_status_name,
            old_client_id: previousPallet.user_id,
            new_client_id: nextPallet.user_id,
            old_location: previousPallet.current_location,
            new_location: nextPallet.current_location,
            qr_version: qrVersion,
            old_qr_code: previousPallet.qr_code,
            new_qr_code: nextPallet.qr_code,
            note: nextPallet.note || 'QR code version updated from admin panel.',
            created_at: timestamp,
          });
        }

        return [...nextLogs, ...prev];
      });
    }

    if (hasOperationalChange) {
      pushNotification(
        'Status Update',
        `${nextPallet.qr_code} moved to ${nextPallet.current_status_name} by ${actor?.name ?? 'Admin User'}.`,
        'status'
      );
    }

    if (hasQrCodeChange) {
      const qrVersion = getNextQrVersion(pallet.id);
      pushNotification(
        'QR Version Update',
        `${previousPallet.qr_code} updated to ${nextPallet.qr_code} (${qrVersion}).`,
        'status'
      );
    }

    void apiService.pallets
      .update(nextPallet.id, nextPallet)
      .then((updatedPallet) => {
        setPallets((prev) => prev.map((item) => (item.id === updatedPallet.id ? updatedPallet : item)));
      })
      .catch((error) => console.error('Failed to update pallet', error));
  };

  const deletePallet = (id: number) => {
    setPallets((prev) => prev.filter((pallet) => pallet.id !== id));
    void apiService.pallets.delete(id).catch((error) => {
      console.error('Failed to delete pallet', error);
      void refreshData();
    });
  };

  const reportDamage = (
    report: Omit<ServiceReport, 'id' | 'created_at'> & { reported_by_user_name?: string }
  ) => {
    void apiService.serviceReports
      .create(report)
      .then((createdReport) => {
        setServiceReports((prev) => [createdReport, ...prev.filter((item) => item.id !== createdReport.id)]);
      })
      .catch((error) => console.error('Failed to create service report', error));

    setServiceReports((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((item) => item.id)) + 1 : 1;
      const newReport: ServiceReport = {
        ...report,
        id: nextId,
        created_at: new Date().toISOString(),
      };

      const pallet = pallets.find((item) => item.id === report.pallet_id);
      if (pallet && pallet.current_status_id !== 7) {
        updatePalletStatus(
          pallet.id,
          7,
          report.reported_by_user_id,
          report.reported_by_user_name || 'Technician',
          pallet.current_location,
          `Damage reported: ${report.problem_description.slice(0, 50)}...`
        );
      }

      return [newReport, ...prev];
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
          : item
      )
    );

    updatePalletStatus(report.pallet_id, 1, userId, 'Technician', 'Service Doboj', `Repaired: ${note}`);

    void apiService.serviceReports
      .resolve(reportId, note)
      .then((updatedReport) => {
        setServiceReports((prev) => prev.map((item) => (item.id === updatedReport.id ? updatedReport : item)));
      })
      .catch((error) => console.error('Failed to resolve service report', error));
  };

  const reportGhostPallets = (
    count: number,
    clientId: number,
    clientName: string,
    details: string | GhostPalletReportInput
  ) => {
    const normalizedDetails =
      typeof details === 'string'
        ? { note: details }
        : details;
    const baseLocation = normalizedDetails.location?.trim() || 'Client Location';
    const baseNote = normalizedDetails.note?.trim() || '';
    const entryDetails = normalizedDetails.entries || [];

    const maxId = pallets.length > 0 ? Math.max(...pallets.map((pallet) => pallet.id)) : 0;
    const newPallets: Pallet[] = Array.from({ length: count }).map((_, index) => {
      const entry = entryDetails[index];
      const currentLocation = entry?.location?.trim() || baseLocation;
      const entryNote = entry?.note?.trim() || '';
      const note = [baseNote, entryNote].filter(Boolean).join(' | ');
      const qrCode = `GHOST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      return {
        id: maxId + index + 1,
        qr_code: qrCode,
        pallet_name: qrCode,
        type: 'Euro Pallet (Unlabeled)',
        current_status_id: 5,
        current_status_name: statuses.find((status) => status.id === 5)?.name || 'Voor retour',
        user_id: clientId,
        client_name: clientName,
        current_location: currentLocation,
        is_ghost: true,
        is_active: true,
        last_status_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        note: note || undefined,
      };
    });

    setPallets((prev) => [...prev, ...newPallets]);

    void apiService.ghostReports
      .create({
        user_id: clientId,
        quantity: count,
        location: baseLocation,
        description: 'No-QR pallet return reported from frontend.',
        notes: baseNote || undefined,
        metadata: {
          entries: entryDetails,
          ghost_qr_codes: newPallets.map((pallet) => pallet.qr_code),
        },
      })
      .catch((error) => console.error('Failed to create ghost pallet report', error));

    void Promise.all(newPallets.map((pallet) => apiService.pallets.create(pallet)))
      .then((createdPallets) => {
        const createdByQr = new Map(createdPallets.map((pallet) => [pallet.qr_code, pallet]));
        setPallets((prev) => prev.map((pallet) => createdByQr.get(pallet.qr_code) || pallet));
      })
      .catch((error) => console.error('Failed to create ghost pallets', error));

    const notificationDetails = [baseLocation !== 'Client Location' ? `Location: ${baseLocation}` : '', baseNote]
      .filter(Boolean)
      .join(' | ');

    pushNotification(
      'Ghost Pallet Report',
      `${count} unlabeled unit${count > 1 ? 's' : ''} reported for ${clientName}.${notificationDetails ? ` ${notificationDetails}` : ''}`,
      'alert'
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
          note: `${item.note || ''} (Paired from ghost on ${new Date().toLocaleDateString()})`,
        };
      })
    );

    if (ghost) {
      const nextId = auditLogs.length > 0 ? Math.max(...auditLogs.map((log) => log.id)) + 1 : 1;
      const qrVersion = getNextQrVersion(ghost.id);

      setAuditLogs((prev) => [
        {
          id: nextId,
          pallet_id: ghost.id,
          pallet_qr: normalizedQrCode,
          made_by_user_id: 1,
          made_by_user_name: 'Operations',
          type: 'qr_version',
          old_status_id: ghost.current_status_id,
          new_status_id: ghost.current_status_id,
          old_status_name: ghost.current_status_name,
          new_status_name: ghost.current_status_name,
          old_client_id: ghost.user_id,
          new_client_id: ghost.user_id,
          old_location: ghost.current_location,
          new_location: ghost.current_location,
          qr_version: qrVersion,
          old_qr_code: ghost.qr_code,
          new_qr_code: normalizedQrCode,
          note: `Ghost pallet paired with a new QR code (${qrVersion}).`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      pushNotification(
        'Ghost Pallet Paired',
        `${ghost.client_name || 'Client'} ghost pallet is now paired with QR ${normalizedQrCode}.`,
        'status'
      );

      void apiService.pallets
        .update(ghost.id, {
          ...ghost,
          qr_code: normalizedQrCode,
          pallet_name: normalizedQrCode,
          is_ghost: false,
          note: `${ghost.note || ''} (Paired from ghost on ${new Date().toLocaleDateString()})`,
        })
        .then((updatedPallet) => {
          setPallets((prev) => prev.map((item) => (item.id === updatedPallet.id ? updatedPallet : item)));
        })
        .catch((error) => console.error('Failed to pair ghost pallet', error));
    }
  };

  const addClient = (client: Omit<ClientDetail, 'id' | 'user_id'> & { user_id?: number }) => {
    const nextId = clients.length > 0 ? Math.max(...clients.map((item) => item.id)) + 1 : 1;
    const newClient: ClientDetail = {
      ...client,
      id: nextId,
      user_id: client.user_id ?? 100 + nextId,
      is_active: client.is_active ?? true,
    };

    setClients((prev) => [...prev, newClient]);

    void apiService.clients
      .create(client)
      .then((createdClient) => {
        setClients((prev) => prev.map((item) => (item.id === newClient.id ? createdClient : item)));
      })
      .catch((error) => console.error('Failed to create client', error));
  };

  const updateClient = (client: ClientDetail) => {
    setClients((prev) => prev.map((item) => (item.id === client.id ? client : item)));
    void apiService.clients
      .update(client)
      .then((updatedClient) => {
        setClients((prev) => prev.map((item) => (item.id === updatedClient.id ? updatedClient : item)));
      })
      .catch((error) => console.error('Failed to update client', error));
  };

  const updateStatusSettings = (status: PalletStatus) => {
    setStatuses((prev) => prev.map((item) => (item.id === status.id ? status : item)));
    void apiService.statuses
      .update(status)
      .then((updatedStatus) => {
        setStatuses((prev) => prev.map((item) => (item.id === updatedStatus.id ? updatedStatus : item)));
      })
      .catch((error) => console.error('Failed to update status', error));
  };

  const addStatus = (status: Omit<PalletStatus, 'id'>) => {
    const nextId = statuses.length > 0 ? Math.max(...statuses.map((item) => item.id)) + 1 : 1;
    const optimisticStatus = { ...status, id: nextId };

    setStatuses((prev) => [...prev, optimisticStatus]);

    void apiService.statuses
      .create(status)
      .then((createdStatus) => {
        setStatuses((prev) => prev.map((item) => (item.id === optimisticStatus.id ? createdStatus : item)));
      })
      .catch((error) => console.error('Failed to create status', error));
  };

  const deleteStatus = (id: number) => {
    setStatuses((prev) => prev.filter((status) => status.id !== id));
    void apiService.statuses.delete(id).catch((error) => {
      console.error('Failed to delete status', error);
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
        isScannerOpen,
        isGhostReportOpen,
        setIsScannerOpen,
        setIsGhostReportOpen,
        setLanguage,
        t,
        updatePalletStatus,
        markNotificationRead,
        addPallet,
        addPalletBatch,
        updatePallet,
        deletePallet,
        addClient,
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
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
};
