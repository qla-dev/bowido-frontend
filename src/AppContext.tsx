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
import { mockAuditLogs, mockClients, mockPallets, mockStatuses } from './lib/mockData';
import { apiService } from './services/api';
import {
  AppLanguage,
  defaultLanguage,
  isAppLanguage,
  LANGUAGE_STORAGE_KEY,
  translate,
} from './i18n';

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
  addClient: (client: Omit<ClientDetail, 'id'>) => void;
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
  fetchRoles: () => Promise<void>;
  addRole: (role: Omit<Role, 'id'>) => Promise<void>;
  updateRole: (role: Role) => Promise<void>;
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pallets, setPallets] = useState<Pallet[]>(mockPallets);
  const [statuses, setStatuses] = useState<PalletStatus[]>(mockStatuses);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [clients, setClients] = useState<ClientDetail[]>(mockClients);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    if (typeof window === 'undefined') {
      return defaultLanguage;
    }

    const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isAppLanguage(storedLanguage) ? storedLanguage : defaultLanguage;
  });
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 1,
      title: 'Payment Due',
      message: 'Invoice #INV-2026-001 is overdue for AutoNL.',
      type: 'payment',
      read: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: 'Pallet Movement',
      message: 'BOWNL-0005 was delivered to Waalhaven Zuidzijde 19, Rotterdam.',
      type: 'status',
      read: false,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 3,
      title: 'Service Required',
      message: 'BOWNL-0003 reported with damaged frame.',
      type: 'alert',
      read: true,
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ]);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>([
    {
      id: 1,
      pallet_id: 3,
      reported_by_user_id: 2,
      problem_description: 'Damaged left corner board. Needs replacement.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      image_path:
        'https://images.unsplash.com/photo-1589939705384-5185138a04b9?auto=format&fit=crop&q=80&w=400',
    },
  ]);
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

  const fetchInvoices = async () => {
    try {
      const data = await apiService.invoices.list();
      setInvoices(data);
    } catch (error) {
      console.error('Failed to fetch invoices', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const [rolesData, permsData] = await Promise.all([
        apiService.roles.list(),
        apiService.permissions.list(),
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (error) {
      console.error('Failed to fetch roles', error);
    }
  };

  useEffect(() => {
    void fetchInvoices();
    void fetchRoles();
  }, []);

  const addRole = async (role: Omit<Role, 'id'>) => {
    const newRole = await apiService.roles.create(role);
    setRoles((prev) => [...prev, newRole]);
  };

  const updateRole = async (role: Role) => {
    await apiService.roles.update(role.id, role);
    setRoles((prev) => prev.map((existingRole) => (existingRole.id === role.id ? role : existingRole)));
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
  };

  const buildNewPallet = (id: number, qrCode: string, type: string): Pallet => {
    const defaultStatus = statuses.find((status) => status.id === 8) || statuses[0];
    const timestamp = new Date().toISOString();

    return {
      id,
      qr_code: qrCode.trim().toUpperCase(),
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
    setPallets((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((pallet) => pallet.id)) + 1 : 1;
      return [...prev, buildNewPallet(nextId, qrCode, type)];
    });
  };

  const addPalletBatch = (entries: Array<{ qrCode: string; type: string }>) => {
    if (entries.length === 0) {
      return;
    }

    setPallets((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((pallet) => pallet.id)) + 1 : 1;
      const nextPallets = entries.map((entry, index) =>
        buildNewPallet(nextId + index, entry.qrCode, entry.type)
      );

      return [...prev, ...nextPallets];
    });
  };

  const updatePallet = (pallet: Pallet, actor?: { id: number; name: string }) => {
    const previousPallet = pallets.find((item) => item.id === pallet.id);
    setPallets((prev) => prev.map((item) => (item.id === pallet.id ? pallet : item)));

    if (previousPallet && previousPallet.qr_code !== pallet.qr_code) {
      const nextId = auditLogs.length > 0 ? Math.max(...auditLogs.map((log) => log.id)) + 1 : 1;
      const qrVersion = getNextQrVersion(pallet.id);

      setAuditLogs((prev) => [
        {
          id: nextId,
          pallet_id: pallet.id,
          pallet_qr: pallet.qr_code,
          made_by_user_id: actor?.id ?? 1,
          made_by_user_name: actor?.name ?? 'Admin User',
          type: 'qr_version',
          old_status_id: previousPallet.current_status_id,
          new_status_id: pallet.current_status_id,
          old_status_name: previousPallet.current_status_name,
          new_status_name: pallet.current_status_name,
          old_client_id: previousPallet.user_id,
          new_client_id: pallet.user_id,
          old_location: previousPallet.current_location,
          new_location: pallet.current_location,
          qr_version: qrVersion,
          old_qr_code: previousPallet.qr_code,
          new_qr_code: pallet.qr_code,
          note: pallet.note || 'QR code version updated from admin panel.',
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      pushNotification(
        'QR Version Update',
        `${previousPallet.qr_code} updated to ${pallet.qr_code} (${qrVersion}).`,
        'status'
      );
    }
  };

  const deletePallet = (id: number) => {
    setPallets((prev) => prev.filter((pallet) => pallet.id !== id));
  };

  const reportDamage = (
    report: Omit<ServiceReport, 'id' | 'created_at'> & { reported_by_user_name?: string }
  ) => {
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

    setPallets((prev) => {
      const maxId = prev.length > 0 ? Math.max(...prev.map((pallet) => pallet.id)) : 0;
      const newPallets: Pallet[] = Array.from({ length: count }).map((_, index) => {
        const entry = entryDetails[index];
        const currentLocation = entry?.location?.trim() || baseLocation;
        const entryNote = entry?.note?.trim() || '';
        const note = [baseNote, entryNote].filter(Boolean).join(' | ');

        return {
          id: maxId + index + 1,
          qr_code: `GHOST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
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

      return [...prev, ...newPallets];
    });

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
    const ghost = pallets.find((pallet) => pallet.id === ghostId);

    setPallets((prev) =>
      prev.map((item) => {
        if (item.id !== ghostId) {
          return item;
        }

        return {
          ...item,
          qr_code: newQrCode,
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
          pallet_qr: newQrCode,
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
          new_qr_code: newQrCode,
          note: `Ghost pallet paired with a new QR code (${qrVersion}).`,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);

      pushNotification(
        'Ghost Pallet Paired',
        `${ghost.client_name || 'Client'} ghost pallet is now paired with QR ${newQrCode}.`,
        'status'
      );
    }
  };

  const addClient = (client: Omit<ClientDetail, 'id'>) => {
    setClients((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((item) => item.id)) + 1 : 1;
      const newClient: ClientDetail = {
        ...client,
        id: nextId,
        user_id: 100 + nextId,
      };

      return [...prev, newClient];
    });
  };

  const updateClient = (client: ClientDetail) => {
    setClients((prev) => prev.map((item) => (item.id === client.id ? client : item)));
  };

  const updateStatusSettings = (status: PalletStatus) => {
    setStatuses((prev) => prev.map((item) => (item.id === status.id ? status : item)));
  };

  const addStatus = (status: Omit<PalletStatus, 'id'>) => {
    setStatuses((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((item) => item.id)) + 1 : 1;
      return [...prev, { ...status, id: nextId }];
    });
  };

  const deleteStatus = (id: number) => {
    setStatuses((prev) => prev.filter((status) => status.id !== id));
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
        fetchRoles,
        addRole,
        updateRole,
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
