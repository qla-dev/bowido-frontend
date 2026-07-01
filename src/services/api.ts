import {
  AuditLog,
  ClientDetail,
  Invoice,
  InvoiceItem,
  ManagedUser,
  Pallet,
  PalletStatus,
  Permission,
  Role,
  RoleType,
  ServiceReport,
  User,
} from '../types';

type ApiEnvelope<T> = {
  message: string;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    count?: number;
  };
  errors?: Record<string, string[]>;
};

type ApiRecord = Record<string, any>;

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'trackpal_api_token';
const DEMO_PASSWORD = 'password123';

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {}
  ) {
    super(message);
  }
}

const hasBrowserStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const getStoredToken = () => (hasBrowserStorage() ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null);

const setStoredToken = (token: string | null) => {
  if (!hasBrowserStorage()) {
    return;
  }

  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<ApiEnvelope<T>> => {
  const token = getStoredToken();
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers);

  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  headers.set('Accept', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    credentials: 'include',
    ...options,
    headers,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    if (response.status === 401) {
      setStoredToken(null);
    }

    throw new ApiError(
      payload?.message || `Request failed with status ${response.status}`,
      response.status,
      payload?.errors || {}
    );
  }

  if (!payload) {
    throw new ApiError('Invalid API response.', response.status);
  }

  return payload;
};

const apiData = async <T>(path: string, options: RequestInit = {}) => (await request<T>(path, options)).data;

const jsonBody = (body: unknown) => JSON.stringify(body);

const buildQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  });

  return query.toString();
};

const listAll = async <T>(path: string, params: Record<string, string | number | boolean | undefined> = {}) => {
  const items: T[] = [];
  const limit = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total) {
    const query = buildQuery({ ...params, limit, offset });
    const envelope = await request<T[]>(`${path}?${query}`);
    const page = envelope.data || [];

    items.push(...page);
    total = envelope.meta?.total ?? items.length;

    if (page.length === 0) {
      break;
    }

    offset += limit;
  }

  return items;
};

const statusUiBySlug: Record<string, { id: number; name: string }> = {
  bowido_warehouse: { id: 1, name: 'Bowido BIH' },
  bowido_nl: { id: 3, name: 'Bowido(NL)' },
  transport: { id: 2, name: 'Transport BiH/NL' },
  transport_bih_nl: { id: 2, name: 'Transport BiH/NL' },
  at_customer: { id: 4, name: 'Bij de klant' },
  pending_return: { id: 5, name: 'Voor retour' },
  transport_nl_bih: { id: 6, name: 'Transport (NL/BiH)' },
  service: { id: 7, name: 'Servis' },
  unknown: { id: 8, name: 'Onbekend' },
};

const statusUiByName: Record<string, { id: number; name: string }> = {
  'Bowido BiH / NL: Warehouse': statusUiBySlug.bowido_warehouse,
  'Bowido BIH': statusUiBySlug.bowido_warehouse,
  'Bowido(NL)': statusUiBySlug.bowido_nl,
  'Transport (BiH-NL / NL-BiH)': statusUiBySlug.transport,
  'Transport BiH/NL': statusUiBySlug.transport,
  'At Customer': statusUiBySlug.at_customer,
  'Bij de klant': statusUiBySlug.at_customer,
  'Pending Return': statusUiBySlug.pending_return,
  'Voor retour': statusUiBySlug.pending_return,
  Service: statusUiBySlug.service,
  Servis: statusUiBySlug.service,
  Unknown: statusUiBySlug.unknown,
  Onbekend: statusUiBySlug.unknown,
};

const backendStatusIdByUiId = new Map<number, number>();
const uiStatusIdByBackendId = new Map<number, number>();

const rememberStatusMapping = (uiId: number, backendId: number, slug?: string) => {
  backendStatusIdByUiId.set(uiId, backendId);
  uiStatusIdByBackendId.set(backendId, uiId);

  if (slug === 'transport') {
    backendStatusIdByUiId.set(6, backendId);
  }

  if (slug === 'bowido_warehouse') {
    backendStatusIdByUiId.set(3, backendId);
  }
};

const normalizeStatus = (status: ApiRecord): PalletStatus => {
  const backendId = Number(status.id);
  const uiStatus = statusUiBySlug[status.slug] || statusUiByName[status.name] || {
    id: uiStatusIdByBackendId.get(backendId) || backendId,
    name: status.name || 'Onbekend',
  };

  rememberStatusMapping(uiStatus.id, backendId, status.slug);

  return {
    id: uiStatus.id,
    name: uiStatus.name,
    is_active: Boolean(status.is_active),
    is_billable: Boolean(status.is_billable),
    grace_period_days: Number(status.grace_period_days ?? 0),
    price_per_day: Number(status.price_per_day ?? 0),
  };
};

const toBackendStatusId = (uiStatusId: number) => backendStatusIdByUiId.get(uiStatusId) || uiStatusId;

const backendRoleToUi: Record<string, RoleType> = {
  admin: RoleType.ADMIN,
  driver: RoleType.VOZAC,
  warehouse_operator: RoleType.MAGACINER,
  operator: RoleType.MAGACINER,
  customer: RoleType.KLIJENT,
  technician: RoleType.SERVISER,
  user: RoleType.MAGACINER,
};

const uiRoleToBackend: Record<RoleType, string> = {
  [RoleType.ADMIN]: 'admin',
  [RoleType.VOZAC]: 'driver',
  [RoleType.MAGACINER]: 'warehouse_operator',
  [RoleType.KLIJENT]: 'customer',
  [RoleType.SERVISER]: 'technician',
};

const roleIdByType = new Map<RoleType, number>();
const primaryBackendRoles = new Set(Object.values(uiRoleToBackend));

const roleTypeFromApi = (role: ApiRecord | string | undefined): RoleType => {
  const roleName = typeof role === 'string' ? role : role?.name;
  return backendRoleToUi[String(roleName || '').toLowerCase()] || RoleType.MAGACINER;
};

const normalizeRole = (role: ApiRecord): Role => {
  const roleType = roleTypeFromApi(role);

  if (primaryBackendRoles.has(String(role.name))) {
    roleIdByType.set(roleType, Number(role.id));
  }

  return {
    id: Number(role.id),
    name: role.name || roleType,
    description: role.description || '',
    permissions: (role.permissions || role.module_ids || []).map(Number),
  };
};

const normalizeUser = (user: ApiRecord): ManagedUser => {
  const role = user.role || { id: user.role_id, name: user.role_name };
  const roleType = roleTypeFromApi(role);

  if (user.role_id) {
    const backendRoleName = String(role?.name || user.role_name || '');
    if (primaryBackendRoles.has(backendRoleName)) {
      roleIdByType.set(roleType, Number(user.role_id));
    }
  }

  return {
    id: Number(user.id),
    name: user.name || user.customer_detail?.company_name || user.email,
    email: user.email,
    password: DEMO_PASSWORD,
    role_id: Number(user.role_id || role?.id || 0),
    role_name: roleType,
    phone_number: user.phone_number || undefined,
  };
};

const normalizeClient = (client: ApiRecord): ClientDetail => {
  const addresses = Array.isArray(client.warehouse_addresses)
    ? client.warehouse_addresses
    : [client.delivery_address, client.billing_address].filter(Boolean);

  return {
    id: Number(client.id),
    user_id: Number(client.user_id),
    name: client.name || client.company_name || client.user?.name || 'Client',
    kvk_number: client.kvk_number || client.kvk || client.tax_number || undefined,
    phone_number: client.user?.phone_number || undefined,
    warehouse_addresses: addresses.filter(Boolean),
    country: client.country || 'NL',
    grace_period_days: Number(client.grace_period_days ?? 0),
    price_per_day: Number(client.price_per_day ?? client.default_price_per_day ?? 0),
    is_active: Boolean(client.is_active),
  };
};

const normalizePallet = (pallet: ApiRecord): Pallet => {
  const status = pallet.current_status ? normalizeStatus(pallet.current_status) : undefined;
  const currentStatusId = status?.id || uiStatusIdByBackendId.get(Number(pallet.current_status_id)) || Number(pallet.current_status_id);
  const currentStatusName = status?.name || pallet.current_status_name || statusUiByName[pallet.current_status_name]?.name || 'Onbekend';
  const clientName =
    pallet.client_name ||
    pallet.user?.customer_detail?.company_name ||
    pallet.user?.name ||
    undefined;

  return {
    id: Number(pallet.id),
    qr_code: pallet.qr_code,
    current_status_id: currentStatusId,
    current_status_name: currentStatusName,
    user_id: pallet.user_id ? Number(pallet.user_id) : undefined,
    client_name: clientName,
    type: pallet.type || pallet.asset_type || 'pallet',
    current_location: pallet.current_location || '',
    is_ghost: Boolean(pallet.is_ghost),
    is_active: Boolean(pallet.is_active),
    last_status_changed_at: pallet.last_status_changed_at || pallet.updated_at || new Date().toISOString(),
    created_at: pallet.created_at || pallet.last_status_changed_at || new Date().toISOString(),
    note: pallet.note || pallet.notes || undefined,
  };
};

const normalizeAuditLog = (log: ApiRecord): AuditLog => {
  const oldStatus = log.old_status ? normalizeStatus(log.old_status) : undefined;
  const newStatus = log.new_status ? normalizeStatus(log.new_status) : undefined;
  const eventType = String(log.event_type || log.type || '');

  return {
    id: Number(log.id),
    pallet_id: Number(log.pallet_id),
    pallet_qr: log.pallet_qr || log.pallet?.qr_code || '',
    made_by_user_id: Number(log.made_by_user_id || 0),
    made_by_user_name: log.made_by_user_name || log.made_by_user?.name || '',
    type: eventType.includes('qr_code') ? 'qr_version' : 'status',
    old_status_id: oldStatus?.id || (log.old_status_id ? Number(log.old_status_id) : undefined),
    new_status_id: newStatus?.id || Number(log.new_status_id || 0),
    old_status_name: oldStatus?.name || log.old_status_name || undefined,
    new_status_name: newStatus?.name || log.new_status_name || '',
    old_client_id: log.old_client_id ? Number(log.old_client_id) : undefined,
    new_client_id: log.new_client_id ? Number(log.new_client_id) : undefined,
    old_location: log.old_location || undefined,
    new_location: log.new_location || '',
    qr_version: log.qr_version || undefined,
    old_qr_code: log.old_qr_code || undefined,
    new_qr_code: log.new_qr_code || undefined,
    note: log.note || undefined,
    created_at: log.created_at || new Date().toISOString(),
  };
};

const normalizeInvoiceStatus = (invoice: ApiRecord): Invoice['status'] => {
  if (invoice.status === 'paid') {
    return 'paid';
  }

  if (invoice.status === 'draft') {
    return 'draft';
  }

  if (invoice.due_date || invoice.due_at) {
    const dueDate = new Date(invoice.due_date || invoice.due_at);
    if (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now() && !invoice.paid_at) {
      return 'overdue';
    }
  }

  return 'sent';
};

const normalizeInvoice = (invoice: ApiRecord): Invoice => ({
  id: Number(invoice.id),
  invoice_number: invoice.invoice_number,
  customer_id: Number(invoice.customer_id || invoice.user_id),
  customer_name: invoice.customer_name || invoice.user?.customer_detail?.company_name || invoice.user?.name || 'Client',
  issue_date: invoice.issue_date || invoice.issued_at?.slice?.(0, 10) || invoice.period_end || '',
  due_date: invoice.due_date || invoice.due_at || '',
  total_amount: Number(invoice.total_amount ?? 0),
  status: normalizeInvoiceStatus(invoice),
});

const normalizeInvoiceItem = (item: ApiRecord): InvoiceItem => ({
  id: Number(item.id),
  invoice_id: Number(item.invoice_id),
  pallet_qr: item.pallet_qr || item.pallet?.qr_code || '',
  description: item.description,
  quantity: Number(item.quantity ?? item.billed_days ?? 1),
  unit_price: Number(item.unit_price ?? item.price_per_day ?? 0),
  total: Number(item.total ?? item.amount ?? 0),
});

const normalizeServiceReport = (report: ApiRecord): ServiceReport => ({
  id: Number(report.id),
  pallet_id: Number(report.pallet_id),
  reported_by_user_id: Number(report.reported_by_user_id),
  resolved_by_user_id: report.resolved_by_user_id ? Number(report.resolved_by_user_id) : undefined,
  problem_description: report.problem_description || report.description || '',
  image_path: report.image_path || undefined,
  resolved_at: report.resolved_at || undefined,
  resolution_note: report.resolution_note || undefined,
  created_at: report.created_at || new Date().toISOString(),
});

const formatUserName = (email: string) => {
  const prefix = email.split('@')[0] || 'novi korisnik';

  return prefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || `client.${Date.now()}`;

const listRoles = async (): Promise<Role[]> => {
  const roles = await listAll<ApiRecord>('/roles');
  return roles.map(normalizeRole);
};

const resolveRoleId = async (role: RoleType) => {
  const cachedRoleId = roleIdByType.get(role);

  if (cachedRoleId) {
    return cachedRoleId;
  }

  await listRoles();

  const resolvedRoleId = roleIdByType.get(role);
  if (!resolvedRoleId) {
    throw new Error(`Role ${role} was not found in the API.`);
  }

  return resolvedRoleId;
};

const toCustomerPayload = (client: Partial<ClientDetail>) => {
  const addresses = client.warehouse_addresses || [];

  return {
    user_id: client.user_id,
    company_name: client.name || 'New Client',
    country: client.country || 'NL',
    kvk: client.kvk_number || null,
    billing_email: `billing@${slugify(client.name || 'client')}.test`,
    billing_address: addresses[1] || addresses[0] || null,
    delivery_address: addresses[0] || null,
    tax_number: client.kvk_number || null,
    vat_number: null,
    default_price_per_day: Number(client.price_per_day ?? 0),
    grace_period_days: Number(client.grace_period_days ?? 0),
    notes: null,
    is_active: client.is_active ?? true,
  };
};

const toPalletPayload = (pallet: Partial<Pallet>) => ({
  user_id: pallet.user_id,
  current_status_id: toBackendStatusId(Number(pallet.current_status_id ?? 8)),
  type: pallet.type || 'pallet',
  asset_type: 'pallet',
  qr_code: pallet.qr_code,
  reference_code: undefined,
  current_location: pallet.current_location || '',
  notes: pallet.note || undefined,
  is_active: pallet.is_active ?? true,
  is_ghost: pallet.is_ghost ?? false,
  metadata: undefined,
});

export const apiService = {
  hasToken: () => Boolean(getStoredToken()),
  clearToken: () => setStoredToken(null),

  auth: {
    login: async (credentials: { email: string; password: string }) => {
      const result = await apiData<ApiRecord>('/auth/login', {
        method: 'POST',
        body: jsonBody({
          email: credentials.email,
          password: credentials.password,
          token_name: 'trackpal-frontend',
        }),
      });

      setStoredToken(result.token);

      return {
        token: result.token,
        user: normalizeUser(result.user),
      };
    },
    loginDemoUser: async (user: User) => apiService.auth.login({ email: user.email, password: DEMO_PASSWORD }),
    me: async () => normalizeUser(await apiData<ApiRecord>('/auth/me')),
    logout: async () => {
      try {
        await apiData<null>('/auth/logout', { method: 'POST' });
      } finally {
        setStoredToken(null);
      }
    },
  },

  roles: {
    list: listRoles,
    create: async (data: Partial<Role>): Promise<Role> =>
      normalizeRole(
        await apiData<ApiRecord>('/roles', {
          method: 'POST',
          body: jsonBody({
            name: data.name,
            description: data.description,
            is_active: true,
            module_ids: data.permissions || [],
          }),
        })
      ),
    update: async (id: number, data: Partial<Role>): Promise<Role> =>
      normalizeRole(
        await apiData<ApiRecord>(`/roles/${id}`, {
          method: 'PUT',
          body: jsonBody({
            name: data.name,
            description: data.description,
            is_active: true,
            module_ids: data.permissions || [],
          }),
        })
      ),
  },

  permissions: {
    list: async (): Promise<Permission[]> => {
      const modules = await listAll<ApiRecord>('/modules');
      return modules.map((module) => ({
        id: Number(module.id),
        name: module.name,
        code: module.slug,
        description: module.description || '',
      }));
    },
  },

  statuses: {
    list: async (): Promise<PalletStatus[]> => (await listAll<ApiRecord>('/statuses')).map(normalizeStatus),
    create: async (data: Omit<PalletStatus, 'id'>): Promise<PalletStatus> =>
      normalizeStatus(
        await apiData<ApiRecord>('/statuses', {
          method: 'POST',
          body: jsonBody(data),
        })
      ),
    update: async (status: PalletStatus): Promise<PalletStatus> =>
      normalizeStatus(
        await apiData<ApiRecord>(`/statuses/${toBackendStatusId(status.id)}`, {
          method: 'PUT',
          body: jsonBody(status),
        })
      ),
    delete: async (id: number): Promise<void> => {
      await apiData<null>(`/statuses/${toBackendStatusId(id)}`, { method: 'DELETE' });
    },
  },

  pallets: {
    list: async (): Promise<Pallet[]> => (await listAll<ApiRecord>('/pallets')).map(normalizePallet),
    get: async (id: number): Promise<Pallet> => normalizePallet(await apiData<ApiRecord>(`/pallets/${id}`)),
    create: async (data: Partial<Pallet>): Promise<Pallet> =>
      normalizePallet(
        await apiData<ApiRecord>('/pallets', {
          method: 'POST',
          body: jsonBody(toPalletPayload(data)),
        })
      ),
    update: async (id: number, data: Partial<Pallet>): Promise<Pallet> =>
      normalizePallet(
        await apiData<ApiRecord>(`/pallets/${id}`, {
          method: 'PUT',
          body: jsonBody(toPalletPayload(data)),
        })
      ),
    delete: async (id: number): Promise<void> => {
      await apiData<null>(`/pallets/${id}`, { method: 'DELETE' });
    },
  },

  clients: {
    list: async (): Promise<ClientDetail[]> => (await listAll<ApiRecord>('/customer_details')).map(normalizeClient),
    create: async (data: Omit<ClientDetail, 'id' | 'user_id'> & { user_id?: number }): Promise<ClientDetail> => {
      if (data.user_id) {
        return normalizeClient(
          await apiData<ApiRecord>('/customer_details', {
            method: 'POST',
            body: jsonBody(toCustomerPayload(data)),
          })
        );
      }

      const roleId = await resolveRoleId(RoleType.KLIJENT);
      const name = data.name || 'New Client';
      const user = await apiData<ApiRecord>('/users', {
        method: 'POST',
        body: jsonBody({
          role_id: roleId,
          name,
          email: `${slugify(name)}.${Date.now()}@trackpal.test`,
          password: DEMO_PASSWORD,
          is_active: true,
          customer_details: toCustomerPayload(data),
        }),
      });

      if (user.customer_detail) {
        return normalizeClient(user.customer_detail);
      }

      const clients = await apiService.clients.list();
      return clients.find((client) => client.user_id === Number(user.id)) || clients[0];
    },
    update: async (data: ClientDetail): Promise<ClientDetail> =>
      normalizeClient(
        await apiData<ApiRecord>(`/customer_details/${data.id}`, {
          method: 'PUT',
          body: jsonBody(toCustomerPayload(data)),
        })
      ),
  },

  users: {
    loginOptions: async (): Promise<ManagedUser[]> =>
      (await apiData<ApiRecord[]>('/auth/login-options')).map(normalizeUser),
    list: async (): Promise<ManagedUser[]> => (await listAll<ApiRecord>('/users')).map(normalizeUser),
    create: async (data: Pick<ManagedUser, 'email' | 'password' | 'role_name'>): Promise<ManagedUser> => {
      const roleId = await resolveRoleId(data.role_name);
      return normalizeUser(
        await apiData<ApiRecord>('/users', {
          method: 'POST',
          body: jsonBody({
            role_id: roleId,
            name: formatUserName(data.email),
            email: data.email.trim(),
            password: data.password,
            is_active: true,
          }),
        })
      );
    },
    update: async (
      id: number,
      data: Partial<Pick<ManagedUser, 'email' | 'password' | 'role_name'>>
    ): Promise<ManagedUser> => {
      const payload: ApiRecord = {};

      if (data.email) {
        payload.email = data.email.trim();
        payload.name = formatUserName(data.email);
      }

      if (data.password) {
        payload.password = data.password;
      }

      if (data.role_name) {
        payload.role_id = await resolveRoleId(data.role_name);
      }

      return normalizeUser(
        await apiData<ApiRecord>(`/users/${id}`, {
          method: 'PUT',
          body: jsonBody(payload),
        })
      );
    },
    delete: async (id: number): Promise<void> => {
      await apiData<null>(`/users/${id}`, { method: 'DELETE' });
    },
  },

  auditLogs: {
    list: async (): Promise<AuditLog[]> => (await listAll<ApiRecord>('/audit_logs')).map(normalizeAuditLog),
  },

  serviceReports: {
    list: async (): Promise<ServiceReport[]> => (await listAll<ApiRecord>('/service_reports')).map(normalizeServiceReport),
    create: async (
      data: Omit<ServiceReport, 'id' | 'created_at'> & { reported_by_user_name?: string }
    ): Promise<ServiceReport> =>
      normalizeServiceReport(
        await apiData<ApiRecord>('/service_reports', {
          method: 'POST',
          body: jsonBody({
            pallet_id: data.pallet_id,
            severity: 'medium',
            issue_type: 'damage',
            description: data.problem_description,
            image_path: data.image_path,
          }),
        })
      ),
    resolve: async (reportId: number, note: string): Promise<ServiceReport> =>
      normalizeServiceReport(
        await apiData<ApiRecord>(`/service_reports/${reportId}`, {
          method: 'PUT',
          body: jsonBody({
            status: 'resolved',
            resolution_note: note,
          }),
        })
      ),
  },

  ghostReports: {
    create: async (data: {
      user_id: number;
      quantity: number;
      location?: string;
      description?: string;
      notes?: string;
      metadata?: Record<string, unknown>;
    }) =>
      apiData<ApiRecord>('/ghost_pallet_reports', {
        method: 'POST',
        body: jsonBody(data),
      }),
  },

  invoices: {
    list: async (): Promise<Invoice[]> => (await listAll<ApiRecord>('/invoices')).map(normalizeInvoice),
    getItems: async (invoiceId: number): Promise<InvoiceItem[]> =>
      (await listAll<ApiRecord>('/invoice_items', { invoice_id: invoiceId })).map(normalizeInvoiceItem),
  },
};
