import React, { createContext, useContext, useState, useEffect } from 'react';
import { Pallet, PalletStatus, User, AuditLog, ClientDetail, RoleType, Invoice, Role, Permission, ServiceReport } from './types';
import { mockPallets, mockStatuses, mockAuditLogs, mockClients } from './lib/mockData';
import { apiService } from './services/api';

interface AppContextType {
  pallets: Pallet[];
  statuses: PalletStatus[];
  auditLogs: AuditLog[];
  clients: ClientDetail[];
  invoices: Invoice[];
  roles: Role[];
  permissions: Permission[];
  language: 'en' | 'bs';
  notifications: AppNotification[];
  serviceReports: ServiceReport[];
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
  setLanguage: (lang: 'en' | 'bs') => void;
  t: (key: string) => string;
  updatePalletStatus: (palletId: number, statusId: number, userId: number, userName: string, location?: string, note?: string, clientId?: number) => void;
  markNotificationRead: (id: number) => void;
  addPallet: (qrCode: string, type: string) => void;
  updatePallet: (pallet: Pallet) => void;
  deletePallet: (id: number) => void;
  addClient: (client: Omit<ClientDetail, 'id'>) => void;
  updateClient: (client: ClientDetail) => void;
  updateStatusSettings: (status: PalletStatus) => void;
  addStatus: (status: Omit<PalletStatus, 'id'>) => void;
  deleteStatus: (id: number) => void;
  reportDamage: (report: Omit<ServiceReport, 'id' | 'created_at'>) => void;
  resolveService: (reportId: number, userId: number, note: string) => void;
  reportGhostPallets: (count: number, clientId: number, clientName: string, note: string) => void;
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

const translations = {
  en: {
    dashboard: 'Dashboard',
    pallets: 'Pallet Tracking',
    clients: 'Client Manager',
    settings: 'Settings',
    activity: 'Activity',
    bulkScan: 'Bulk Scan',
    startBulkScan: 'Start Bulk Scan',
    damagedPallet: 'Damaged Pallet?',
    report: 'Report',
    logout: 'Logout',
    needHelp: 'Need Help?',
    home: 'Home',
    overview: 'Overview',
    inventory: 'Inventory',
    totalPallets: 'Total Pallets',
    inTransit: 'In Transit',
    atClients: 'At Clients',
    needService: 'Need Service',
    overdueUnits: 'Overdue Units',
    totalAccrued: 'Total Accrued',
    revenueRecovery: 'Revenue Recovery',
    actionRequired: 'Action Required',
    allGood: 'All Good',
    stayTime: 'Stay Time',
    accruedCharge: 'Accrued Charge',
    fleet: 'Fleet',
    partners: 'Partners',
    audits: 'Audits',
    configs: 'Configs',
    quickAnalysis: 'Quick Analysis',
    utilizationRate: 'Utilization Rate',
    logisticsNote: 'Logistics Note',
    overdueWarning: 'Overdue Warning',
    activeRoute: 'Active Route',
    pickupsWaiting: 'Pickups Waiting',
    onBoard: 'On Board',
    palletsLoaded: 'Pallets Loaded',
    recentScanHistory: 'Recent Scan History',
    viewHistory: 'View History',
    manageAll: 'Manage All',
    bulkUpdate: 'Bulk Update',
    addNew: 'Add New',
    overdue: 'Overdue',
    todayScanned: 'Today Scanned',
    nextStop: 'Next Stop',
    stock: 'Stock',
    tagForService: 'Tag for Service',
    driver: 'Driver',
    warehouse: 'Warehouse',
    loggedAs: 'Logged as',
    operationsLog: 'Operations Log',
    billing: 'Billing',
    serviceLog: 'Service Log',
    menu: 'Menu',
    account: 'Account',
    activeSession: 'Active Session',
    company: 'Company',
    activePallets: 'Active Pallets',
    forPickup: 'For Pickup',
    chargeAlert: 'Charge Alert',
    liveInventory: 'Live Inventory',
    exportPdf: 'Export PDF',
    ghostReport: 'Ghost Report',
    reportNow: 'Report Now',
    knowledgeBase: 'Knowledge Base',
    documentation: 'Documentation',
    contextualHelp: 'Contextual help for',
    watchGuide: 'Watch quick guide',
    videoTutorial: 'Video Tutorial',
    ghost: 'Ghost',
    technician: 'Technician',
    pendingRepair: 'Pending Repair',
    repairedToday: 'Repaired Today',
    partsStock: 'Parts Stock',
    activeJobs: 'Active Jobs',
    printLabels: 'Print Labels',
    markAsFixed: 'Mark as Fixed',
    operationCenter: 'Operation Center',
    selectClient: 'Select Client',
    currentLocation: 'Current Location',
    queue: 'Queue',
    clear: 'Clear',
    readyToScan: 'Ready to Scan',
    roleRestricted: 'Role Restricted',
    invoiceNumber: 'Invoice #',
    issueDate: 'Issue Date',
    dueDate: 'Due Date',
    payableAmount: 'Payable Amount',
    paid: 'Paid',
    unpaid: 'Unpaid',
    viewInvoice: 'View Invoice',
    download: 'Download',
    qrCode: 'QR Code',
    status: 'Status',
    location: 'Location',
    client: 'Client',
    days: 'Days',
    owed: 'Owed',
    search: 'Search...',
    cancel: 'Cancel',
    save: 'Save',
    confirm: 'Confirm',
    language: 'Language',
    roles: 'Roles',
    permissions: 'Permissions',
    manageRoles: 'Manage Roles',
    addRole: 'Add Role',
    editRole: 'Edit Role',
    roleName: 'Role Name',
    roleDescription: 'Description',
    permissionList: 'Permissions List',
    noPermissions: 'No permissions found',
    roleCreated: 'Role created successfully',
    roleUpdated: 'Role updated successfully',
    inventoryTable: 'Inventory Table',
    calendar: 'Billings Calendar',
    filterByClient: 'Filter by Client',
    filterByStatus: 'Status',
    filterByType: 'Type',
    searchQr: 'Search QR...',
    allClients: 'All Clients',
    allStatuses: 'All Statuses',
    allTypes: 'All Types',
    lastUpdate: 'Last Update',
    actions: 'Actions',
    addStatus: 'Add Status',
    statusName: 'Status Name',
    chargePerDay: 'Charge per Day',
    isBillable: 'Is Billable',
    color: 'Color',
    newStatus: 'New Status',
  },
  bs: {
    dashboard: 'Kontrolna tabla',
    pallets: 'Praćenje paleta',
    clients: 'Upravljanje klijentima',
    settings: 'Postavke',
    activity: 'Aktivnosti',
    bulkScan: 'Grupno skeniranje',
    startBulkScan: 'Započni skeniranje',
    damagedPallet: 'Oštećena paleta?',
    report: 'Prijavi',
    logout: 'Odjavi se',
    needHelp: 'Trebate pomoć?',
    home: 'Početna',
    overview: 'Pregled',
    inventory: 'Inventar',
    totalPallets: 'Ukupno paleta',
    inTransit: 'U transportu',
    atClients: 'Kod klijenata',
    needService: 'Potreban servis',
    overdueUnits: 'Jedinice u kašnjenju',
    totalAccrued: 'Ukupna naplata',
    revenueRecovery: 'Naplata prihoda',
    actionRequired: 'Akcija potrebna',
    allGood: 'Sve u redu',
    stayTime: 'Vrijeme boravka',
    accruedCharge: 'Akumulirana naknada',
    fleet: 'Vozni park',
    partners: 'Partneri',
    audits: 'Revizija',
    configs: 'Konfiguracija',
    quickAnalysis: 'Brza analiza',
    utilizationRate: 'Stopa isporuke',
    logisticsNote: 'Logistička bilješka',
    overdueWarning: 'Upozorenje o kašnjenju',
    activeRoute: 'Aktivna ruta',
    pickupsWaiting: 'Preuzimanja čekaju',
    onBoard: 'Na teretu',
    palletsLoaded: 'Palete utovarene',
    recentScanHistory: 'Historija skeniranja',
    viewHistory: 'Vidi historiju',
    manageAll: 'Upravljaj svime',
    bulkUpdate: 'Grupno ažuriranje',
    addNew: 'Dodaj novi',
    overdue: 'Kasni',
    todayScanned: 'Danas skenirano',
    nextStop: 'Sljedeća stanica',
    stock: 'Zalihe',
    tagForService: 'Označi za servis',
    driver: 'Vozač',
    warehouse: 'Skladište',
    loggedAs: 'Prijavljeni ste kao',
    operationsLog: 'Log operacija',
    billing: 'Naplata',
    serviceLog: 'Log servisa',
    menu: 'Meni',
    account: 'Račun',
    activeSession: 'Aktivna sesija',
    company: 'Kompanija',
    activePallets: 'Aktivne palete',
    forPickup: 'Za preuzimanje',
    chargeAlert: 'Upozorenje o naplati',
    liveInventory: 'Inventar uživo',
    exportPdf: 'Izvezi PDF',
    ghostReport: 'Prijavi ghost paletu',
    reportNow: 'Prijavi odmah',
    knowledgeBase: 'Baza znanja',
    documentation: 'Dokumentacija',
    contextualHelp: 'Pomoć za',
    watchGuide: 'Pogledajte brzi vodič',
    videoTutorial: 'Video tutorijal',
    ghost: 'Ghost',
    technician: 'Tehničar',
    pendingRepair: 'Na čekanju za popravku',
    repairedToday: 'Popravljeno danas',
    partsStock: 'Zalihe dijelova',
    activeJobs: 'Aktivni poslovi',
    printLabels: 'Štampaj etikete',
    markAsFixed: 'Označi kao popravljeno',
    operationCenter: 'Operativni centar',
    selectClient: 'Odaberi klijenta',
    currentLocation: 'Trenutna lokacija',
    queue: 'Red čekanja',
    clear: 'Očisti',
    readyToScan: 'Spremno za skeniranje',
    roleRestricted: 'Ograničeno ulogom',
    invoiceNumber: 'Faktura br.',
    issueDate: 'Datum izdavanja',
    dueDate: 'Datum dospijeća',
    payableAmount: 'Iznos za plaćanje',
    paid: 'Plaćeno',
    unpaid: 'Neplaćeno',
    viewInvoice: 'Prikaži fakturu',
    download: 'Preuzmi',
    qrCode: 'QR Kod',
    status: 'Status',
    location: 'Lokacija',
    client: 'Klijent',
    days: 'Dana',
    owed: 'Dugovanje',
    search: 'Pretraži...',
    cancel: 'Odustani',
    save: 'Sačuvaj',
    confirm: 'Potvrdi',
    language: 'Jezik',
    roles: 'Uloge',
    permissions: 'Permisije',
    manageRoles: 'Upravljaj ulogama',
    addRole: 'Dodaj ulogu',
    editRole: 'Uredi ulogu',
    roleName: 'Naziv uloge',
    roleDescription: 'Opis',
    permissionList: 'Lista permisija',
    noPermissions: 'Nema pronađenih permisija',
    roleCreated: 'Uloga uspješno kreirana',
    roleUpdated: 'Uloga uspješno ažurirana',
    inventoryTable: 'Tabela inventara',
    calendar: 'Kalendar naplate',
    filterByClient: 'Filtriraj klijenta',
    filterByStatus: 'Status',
    filterByType: 'Tip',
    searchQr: 'Pretraži QR...',
    allClients: 'Svi klijenti',
    allStatuses: 'Svi statusi',
    allTypes: 'Svi tipovi',
    lastUpdate: 'Zadnje ažuriranje',
    actions: 'Akcije',
    addStatus: 'Dodaj status',
    statusName: 'Naziv statusa',
    chargePerDay: 'Naplata po danu',
    isBillable: 'Naplaćuje se',
    color: 'Boja',
    newStatus: 'Novi status',
    reportDamage: 'Prijavi oštećenje',
    damageDescription: 'Opis kvara',
    evidencePhoto: 'Fotografija oštećenja',
    submitReport: 'Pošalji izvještaj',
    selectUnit: 'Odaberi jedinicu',
    selectOperation: 'Odaberi tip operacije',
    chooseProcessingMode: 'Odaberi način obrade paleta',
    regularScan: 'Obično skeniranje',
    singleUpdate: 'Ažuriranje jedne jedinice',
    multiProcess: 'Više jedinica odjednom',
    changeProcessType: 'Promijeni način obrade',
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pallets, setPallets] = useState<Pallet[]>(mockPallets);
  const [statuses, setStatuses] = useState<PalletStatus[]>(mockStatuses);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [clients, setClients] = useState<ClientDetail[]>(mockClients);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [language, setLanguage] = useState<'en' | 'bs'>('bs');
  const [notifications, setNotifications] = useState<AppNotification[]>([
    { id: 1, title: 'Payment Due', message: 'Invoice #INV-2026-001 is overdue for AutoNL.', type: 'payment', read: false, created_at: new Date().toISOString() },
    { id: 2, title: 'Pallet Movement', message: 'PAL-0022 was delivered to Rotterdam Port.', type: 'status', read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 3, title: 'Service Required', message: 'PAL-0003 reported with damaged frame.', type: 'alert', read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
  ]);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>([
    { id: 1, pallet_id: 3, reported_by_user_id: 2, problem_description: 'Damaged left corner board. Needs replacement.', created_at: new Date(Date.now() - 86400000).toISOString(), image_path: 'https://images.unsplash.com/photo-1589939705384-5185138a04b9?auto=format&fit=crop&q=80&w=400' }
  ]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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
        apiService.permissions.list()
      ]);
      setRoles(rolesData);
      setPermissions(permsData);
    } catch (error) {
      console.error('Failed to fetch roles', error);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchRoles();
  }, []);

  const addRole = async (role: Omit<Role, 'id'>) => {
    const newRole = await apiService.roles.create(role);
    setRoles(prev => [...prev, newRole]);
  };

  const updateRole = async (role: Role) => {
    await apiService.roles.update(role.id, role);
    setRoles(prev => prev.map(r => r.id === role.id ? role : r));
  };

  const t = (key: string) => {
    return (translations[language] as any)[key] || key;
  };

  const markNotificationRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
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
    const pallet = pallets.find(p => p.id === palletId);
    const status = statuses.find(s => s.id === statusId);
    
    if (!pallet || !status) return;

    const oldStatusId = pallet.current_status_id;
    const oldStatusName = pallet.current_status_name;
    const oldLocation = pallet.current_location;

    // Update pallet
    setPallets(prev => prev.map(p => {
      if (p.id === palletId) {
        return {
          ...p,
          current_status_id: statusId,
          current_status_name: status.name,
          current_location: location || p.current_location,
          last_status_changed_at: new Date().toISOString(),
          user_id: clientId || p.user_id,
          client_name: clientId ? clients.find(c => c.user_id === clientId)?.name : p.client_name,
          note: note || p.note
        };
      }
      return p;
    }));

    // Add audit log
    setAuditLogs(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(l => l.id)) + 1 : 1;
      const newLog: AuditLog = {
        id: nextId,
        pallet_id: palletId,
        pallet_qr: pallet.qr_code,
        made_by_user_id: userId,
        made_by_user_name: userName,
        old_status_id: oldStatusId,
        old_status_name: oldStatusName,
        new_status_id: statusId,
        new_status_name: status.name,
        old_location: oldLocation,
        new_location: location || pallet.current_location,
        note: note,
        created_at: new Date().toISOString()
      };
      return [newLog, ...prev];
    });

    // Add notification
    setNotifications(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(n => n.id)) + 1 : 1;
      const newNotification: AppNotification = {
        id: nextId,
        title: 'Status Update',
        message: `${pallet.qr_code} moved to ${status.name}`,
        type: 'status',
        read: false,
        created_at: new Date().toISOString()
      };
      return [newNotification, ...prev];
    });
  };

  const addPallet = (qrCode: string, type: string) => {
    setPallets(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(p => p.id)) + 1 : 1;
      const newPallet: Pallet = {
        id: nextId,
        qr_code: qrCode,
        type: type,
        current_status_id: 1, // Default Bowido BiH
        current_status_name: statuses.find(s => s.id === 1)?.name || 'U Bowido BiH',
        current_location: 'Central Warehouse BiH',
        last_status_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        is_ghost: false,
        is_active: true
      };
      return [...prev, newPallet];
    });
  };

  const updatePallet = (p: Pallet) => {
    setPallets(prev => prev.map(pallet => pallet.id === p.id ? p : pallet));
  };

  const deletePallet = (id: number) => {
    setPallets(prev => prev.filter(p => p.id !== id));
  };

  const reportDamage = (report: Omit<ServiceReport, 'id' | 'created_at'>) => {
    setServiceReports(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(r => r.id)) + 1 : 1;
      const newReport: ServiceReport = {
        ...report,
        id: nextId,
        created_at: new Date().toISOString()
      };
      
      // Auto update pallet status if it was reported as damaged
      const pallet = pallets.find(p => p.id === report.pallet_id);
      if (pallet && pallet.current_status_id !== 7) { // 7 is Service
        updatePalletStatus(pallet.id, 7, report.reported_by_user_id, 'Technician', pallet.current_location, `Damage reported: ${report.problem_description.slice(0, 50)}...`);
      }
      
      return [newReport, ...prev];
    });
  };

  const resolveService = (reportId: number, userId: number, note: string) => {
    const report = serviceReports.find(r => r.id === reportId);
    if (!report) return;

    setServiceReports(prev => prev.map(r => r.id === reportId ? { 
      ...r, 
      resolved_by_user_id: userId, 
      resolved_at: new Date().toISOString(),
      resolution_note: note 
    } : r));

    // Update pallet back to stock
    updatePalletStatus(report.pallet_id, 1, userId, 'Technician', 'Service Doboj', `Repaired: ${note}`);
  };

  const reportGhostPallets = (count: number, clientId: number, clientName: string, note: string) => {
    setPallets(prev => {
      const maxId = prev.length > 0 ? Math.max(...prev.map(p => p.id)) : 0;
      const newPallets: Pallet[] = Array.from({ length: count }).map((_, i) => ({
        id: maxId + i + 1,
        qr_code: `GHOST-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        type: 'Euro Pallet (Unlabeled)',
        current_status_id: 4, // Bij klijent
        current_status_name: statuses.find(s => s.id === 4)?.name || 'Bij klijent',
        user_id: clientId,
        client_name: clientName,
        current_location: 'Client Location',
        is_ghost: true,
        is_active: true,
        last_status_changed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        note: note
      }));
      return [...prev, ...newPallets];
    });
  };

  const pairGhostPallet = (ghostId: number, newQrCode: string) => {
    setPallets(prev => prev.map(p => {
      if (p.id === ghostId) {
        return {
          ...p,
          qr_code: newQrCode,
          is_ghost: false,
          note: `${p.note || ''} (Paired from ghost on ${new Date().toLocaleDateString()})`
        };
      }
      return p;
    }));
  };

  const addClient = (c: Omit<ClientDetail, 'id'>) => {
    setClients(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(cl => cl.id)) + 1 : 1;
      const newClient: ClientDetail = {
        ...c,
        id: nextId,
        user_id: 100 + nextId // Mock user id
      };
      return [...prev, newClient];
    });
  };

  const updateClient = (c: ClientDetail) => {
    setClients(prev => prev.map(client => client.id === c.id ? c : client));
  };

  const updateStatusSettings = (s: PalletStatus) => {
    setStatuses(prev => prev.map(status => status.id === s.id ? s : status));
  };

  const addStatus = (s: Omit<PalletStatus, 'id'>) => {
    setStatuses(prev => {
      const nextId = prev.length > 0 ? Math.max(...prev.map(st => st.id)) + 1 : 1;
      return [...prev, { ...s, id: nextId }];
    });
  };

  const deleteStatus = (id: number) => {
    setStatuses(prev => prev.filter(s => s.id !== id));
  };

  return (
    <AppContext.Provider value={{ 
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
      setIsScannerOpen,
      setLanguage,
      t,
      updatePalletStatus, 
      markNotificationRead,
      addPallet,
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
      updateRole
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
