import {
  AuditLog,
  CalendarNote,
  ClientDetail,
  DeliveryLocation,
  DeliveryLocationInput,
  Invoice,
  InvoiceItem,
  ManagedUser,
  Pallet,
  PalletDashboardStats,
  PalletPhoto,
  PalletStatus,
  Permission,
  Role,
  RoleType,
  ReverseGeocodingResult,
  ServiceReport,
  User,
} from '../types';
import { appLanguages, defaultLanguage, LANGUAGE_STORAGE_KEY } from '../i18n';
import type { AppLanguage } from '../i18n';

type ApiEnvelope<T> = {
  message: string;
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    count?: number;
    status_changes?: number;
    qr_version_changes?: number;
  };
  errors?: Record<string, string[]>;
};

export type ListParams = Record<string, string | number | boolean | undefined>;

export type PaginationMeta = {
  total: number;
  limit: number;
  offset: number;
  count: number;
  status_changes?: number;
  qr_version_changes?: number;
};

export type PaginatedResult<T> = {
  items: T[];
  meta: PaginationMeta;
};

type ApiRecord = Record<string, any>;
type LoginCredentials = {
  email?: string;
  kvk?: string;
  customerDetailId?: number;
  password: string;
  loginType?: 'user' | 'customer';
};

const API_BACKENDS = {
  local: '/api',
  production: 'https://api.trackpal.app/api',
} as const;

const normalizeApiBackend = (value: unknown) => String(value || '').trim().toLowerCase();

const requestedApiBackend = normalizeApiBackend(import.meta.env.VITE_API_BACKEND);
const apiBackend = (
  requestedApiBackend === 'production'
    ? 'production'
    : import.meta.env.DEV
      ? 'local'
      : 'production'
) satisfies keyof typeof API_BACKENDS;
const explicitApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const API_BASE_URL = (
  explicitApiBaseUrl ||
  API_BACKENDS[apiBackend]
).replace(/\/+$/, '');
const TOKEN_STORAGE_KEY = 'trackpal_api_token';
const TOKEN_ONLY_HEADER = 'X-Trackpal-Token-Only';
const LOCALE_HEADER = 'X-Locale';
const DEMO_PASSWORD = 'password123';

let apiLocale: AppLanguage | null = null;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {},
    public readonly data: unknown = null,
  ) {
    super(message);
  }
}

const hasBrowserStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

const getStoredToken = () => (hasBrowserStorage() ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null);

const normalizeApiLocale = (locale: unknown): AppLanguage | null => {
  const normalized = String(locale || '').trim().toLowerCase();
  return appLanguages.includes(normalized as AppLanguage) ? normalized as AppLanguage : null;
};

const getStoredLocale = () =>
  hasBrowserStorage() ? normalizeApiLocale(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) : null;

const getRequestLocale = () => apiLocale || getStoredLocale() || defaultLanguage;

export const setApiLocale = (locale: AppLanguage | string | null | undefined) => {
  apiLocale = normalizeApiLocale(locale);
};

const toBoolean = (value: unknown, defaultValue = false) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'off', ''].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
};

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
  headers.set(TOKEN_ONLY_HEADER, 'true');

  if (!headers.has(LOCALE_HEADER)) {
    headers.set(LOCALE_HEADER, getRequestLocale());
  }

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
      payload?.errors || {},
      payload?.data ?? null,
    );
  }

  if (!payload) {
    throw new ApiError('Invalid API response.', response.status);
  }

  return payload;
};

const apiData = async <T>(path: string, options: RequestInit = {}) => (await request<T>(path, options)).data;

const requestBlob = async (path: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers);
  const token = getStoredToken();
  headers.set(TOKEN_ONLY_HEADER, 'true');
  headers.set(LOCALE_HEADER, getRequestLocale());
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const target = /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
  const response = await fetch(target, { credentials: 'include', ...options, headers });
  if (!response.ok) throw new ApiError(`Request failed with status ${response.status}`, response.status);
  return response.blob();
};

const jsonBody = (body: unknown) => JSON.stringify(body);

const buildQuery = (params: ListParams) => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      query.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  });

  return query.toString();
};

const listPage = async <T>(
  path: string,
  params: ListParams = {},
  normalize: (record: ApiRecord) => T
): Promise<PaginatedResult<T>> => {
  const query = buildQuery(params);
  const envelope = await request<ApiRecord[]>(query ? `${path}?${query}` : path);
  const count = envelope.meta?.count ?? envelope.data.length;

  return {
    items: (envelope.data || []).map(normalize),
    meta: {
      total: Number(envelope.meta?.total ?? envelope.data.length),
      limit: Number(envelope.meta?.limit ?? params.limit ?? envelope.data.length),
      offset: Number(envelope.meta?.offset ?? params.offset ?? 0),
      count: Number(count),
      status_changes: envelope.meta?.status_changes === undefined ? undefined : Number(envelope.meta.status_changes),
      qr_version_changes: envelope.meta?.qr_version_changes === undefined ? undefined : Number(envelope.meta.qr_version_changes),
    },
  };
};

const listAll = async <T>(path: string, params: ListParams = {}) => {
  const items: T[] = [];
  const requestedLimit = params.limit !== undefined ? Math.max(Number(params.limit), 0) : undefined;
  const pageSize = requestedLimit !== undefined ? Math.min(requestedLimit, 100) : 100;
  let offset = Number(params.offset ?? 0);
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total && pageSize > 0) {
    const remaining = requestedLimit !== undefined ? requestedLimit - items.length : pageSize;
    const limit = Math.min(pageSize, remaining);
    const query = buildQuery({ ...params, limit, offset });
    const envelope = await request<T[]>(`${path}?${query}`);
    const page = envelope.data || [];

    items.push(...page);
    total = requestedLimit !== undefined
      ? Math.min(envelope.meta?.total ?? items.length, requestedLimit)
      : envelope.meta?.total ?? items.length;

    if (page.length === 0 || (requestedLimit !== undefined && items.length >= requestedLimit)) {
      break;
    }

    offset += page.length;
  }

  return items;
};

const statusUiBySlug: Record<string, { id: number; name: string }> = {
  'bowido-bih': { id: 1, name: 'Bowido BIH' },
  'bowido-nl': { id: 3, name: 'Bowido(NL)' },
  'bih-nl-transport': { id: 2, name: 'Transport BiH/NL' },
  'bij-de-klant': { id: 4, name: 'Bij de klant' },
  'ophalen-klant': { id: 5, name: 'Ophalen klant' },
  'nl-bih-transport': { id: 6, name: 'Transport (NL/BiH)' },
  onbekend: { id: 8, name: 'Onbekend' },
  'bih-drugo': { id: 9, name: 'BiH - drugo' },
  bowido_warehouse: { id: 1, name: 'Bowido BIH' },
  bowido_nl: { id: 3, name: 'Bowido(NL)' },
  transport: { id: 2, name: 'Transport BiH/NL' },
  transport_bih_nl: { id: 2, name: 'Transport BiH/NL' },
  at_customer: { id: 4, name: 'Bij de klant' },
  pending_return: { id: 5, name: 'Voor retour' },
  transport_nl_bih: { id: 6, name: 'Transport (NL/BiH)' },
  service: { id: 7, name: 'Voor reparatie' },
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
  'Voor reparatie': statusUiBySlug.service,
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
    slug: status.slug || '',
  };
};

const toBackendStatusId = (uiStatusId: number) => backendStatusIdByUiId.get(uiStatusId) || uiStatusId;

const backendRoleToUi: Record<string, RoleType> = {
  admin: RoleType.ADMIN,
  admin_service: RoleType.ADMIN_SERVICE,
  service_admin: RoleType.ADMIN_SERVICE,
  'admin service': RoleType.ADMIN_SERVICE,
  admin_servis: RoleType.ADMIN_SERVICE,
  'admin servis': RoleType.ADMIN_SERVICE,
  admin_warehouse: RoleType.ADMIN_WAREHOUSE,
  warehouse_admin: RoleType.ADMIN_WAREHOUSE,
  'admin warehouse': RoleType.ADMIN_WAREHOUSE,
  admin_magacin: RoleType.ADMIN_WAREHOUSE,
  'admin magacin': RoleType.ADMIN_WAREHOUSE,
  finance_administration: RoleType.FINANCE_ADMINISTRATION,
  finance_admin: RoleType.FINANCE_ADMINISTRATION,
  finance_and_administration: RoleType.FINANCE_ADMINISTRATION,
  'finance & administration': RoleType.FINANCE_ADMINISTRATION,
  'finance and administration': RoleType.FINANCE_ADMINISTRATION,
  driver: RoleType.VOZAC,
  warehouse_operator: RoleType.MAGACINER,
  operator: RoleType.MAGACINER,
  customer: RoleType.KLIJENT,
  technician: RoleType.SERVISER,
  user: RoleType.MAGACINER,
};

const uiRoleToBackend: Record<RoleType, string> = {
  [RoleType.ADMIN]: 'admin',
  [RoleType.ADMIN_SERVICE]: 'admin_service',
  [RoleType.ADMIN_WAREHOUSE]: 'admin_warehouse',
  [RoleType.FINANCE_ADMINISTRATION]: 'finance_administration',
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
    role_permissions: Array.isArray(role.role_permissions) ? role.role_permissions.map((permission: ApiRecord) => ({
      module_id: Number(permission.module_id),
      can_list: Boolean(permission.can_list),
      can_view: Boolean(permission.can_view),
      can_create: Boolean(permission.can_create),
      can_update: Boolean(permission.can_update),
      can_delete: Boolean(permission.can_delete),
      scope: permission.scope || undefined,
    })) : [],
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
    backend_role_name: String(role?.name || user.role_name || ''),
    phone_number: user.phone_number || undefined,
    permission_codes: Array.isArray(user.permission_codes) ? user.permission_codes : [],
    customer_detail: user.customer_detail
      ? {
          name: user.customer_detail.name || user.customer_detail.company_name || undefined,
          company_name: user.customer_detail.company_name || user.customer_detail.name || undefined,
          kvk: user.customer_detail.kvk || user.customer_detail.kvk_number || undefined,
          kvk_number: user.customer_detail.kvk_number || user.customer_detail.kvk || undefined,
          fixed_phone: user.customer_detail.fixed_phone || undefined,
          billing_email: user.customer_detail.billing_email || undefined,
          street: user.customer_detail.street || undefined,
          postal_code: user.customer_detail.postal_code || undefined,
          warehouse_scope: user.customer_detail.warehouse_scope || undefined,
        }
      : undefined,
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
    fixed_phone: client.fixed_phone || undefined,
    billing_email: client.billing_email || undefined,
    warehouse_addresses: addresses.filter(Boolean),
    country: client.country || 'NL',
    province: client.province || undefined,
    street: client.street || undefined,
    house_number: client.house_number || undefined,
    postal_code: client.postal_code || undefined,
    city: client.city || undefined,
    warehouse1_street: client.warehouse1_street || undefined,
    warehouse1_house_number: client.warehouse1_house_number || undefined,
    warehouse1_postal_code: client.warehouse1_postal_code || undefined,
    warehouse1_city: client.warehouse1_city || undefined,
    warehouse2_street: client.warehouse2_street || undefined,
    warehouse2_house_number: client.warehouse2_house_number || undefined,
    warehouse2_postal_code: client.warehouse2_postal_code || undefined,
    warehouse2_city: client.warehouse2_city || undefined,
    warehouse_scope: client.warehouse_scope || undefined,
    grace_period_days: Number(client.grace_period_days ?? 0),
    price_per_day: Number(client.price_per_day ?? client.default_price_per_day ?? 0),
    is_active: Boolean(client.is_active),
  };
};

const normalizePallet = (pallet: ApiRecord): Pallet => {
  const status = pallet.current_status ? normalizeStatus(pallet.current_status) : undefined;
  const currentStatusId = status?.id || uiStatusIdByBackendId.get(Number(pallet.current_status_id)) || Number(pallet.current_status_id);
  const currentStatusName = status?.name || pallet.current_status_name || statusUiByName[pallet.current_status_name]?.name || 'Onbekend';
  const palletDisplayName = pallet.pallet_name || pallet.reference_code || pallet.qr_code || '';
  const clientName =
    pallet.client_name ||
    pallet.user?.customer_detail?.company_name ||
    pallet.user?.name ||
    undefined;

  return {
    id: Number(pallet.id),
    qr_code: pallet.qr_code,
    reference_code: pallet.reference_code || undefined,
    pallet_name: palletDisplayName || undefined,
    current_status_id: currentStatusId,
    current_status_name: currentStatusName,
    current_status_slug: pallet.current_status_slug || pallet.current_status?.slug || status?.slug,
    user_id: pallet.user_id ? Number(pallet.user_id) : undefined,
    client_name: clientName,
    client_deleted: toBoolean(pallet.client_deleted),
    type: pallet.type || pallet.asset_type || 'pallet',
    current_location: pallet.current_location || '',
    is_ghost: toBoolean(pallet.is_ghost),
    is_active: toBoolean(pallet.is_active),
    last_status_changed_at: pallet.last_status_changed_at || pallet.updated_at || new Date().toISOString(),
    created_at: pallet.created_at || pallet.last_status_changed_at || new Date().toISOString(),
    note: pallet.note || pallet.notes || undefined,
    metadata: pallet.metadata && typeof pallet.metadata === 'object' ? pallet.metadata : undefined,
    delivery_location: pallet.delivery_location
      ? normalizeDeliveryLocation(pallet.delivery_location)
      : undefined,
  };
};

const normalizeReverseGeocodingResult = (location: ApiRecord): ReverseGeocodingResult => ({
  latitude: Number(location.latitude),
  longitude: Number(location.longitude),
  formatted_address: location.formatted_address || undefined,
  street: location.street || undefined,
  house_number: location.house_number || undefined,
  city: location.city || undefined,
  postal_code: location.postal_code || undefined,
  country: location.country || undefined,
  country_code: location.country_code || undefined,
  provider: location.provider || 'unknown',
});

const normalizeDeliveryLocation = (location: ApiRecord): DeliveryLocation => ({
  ...normalizeReverseGeocodingResult(location),
  id: Number(location.id),
  pallet_id: Number(location.pallet_id),
  accuracy_meters: location.accuracy_meters === null || location.accuracy_meters === undefined
    ? undefined
    : Number(location.accuracy_meters),
  source: 'device_gps',
  confirmed_by_user: toBoolean(location.confirmed_by_user, true),
  created_by_user_id: location.created_by_user_id ? Number(location.created_by_user_id) : undefined,
  captured_at: location.captured_at || undefined,
  created_at: location.created_at || new Date().toISOString(),
  updated_at: location.updated_at || location.created_at || new Date().toISOString(),
});

const normalizePalletDashboardStats = (stats: ApiRecord): PalletDashboardStats => ({
  total_pallets: Number(stats.total_pallets ?? 0),
  in_transport: Number(stats.in_transport ?? 0),
  overdue_units: Number(stats.overdue_units ?? 0),
});

const normalizeAuditLog = (log: ApiRecord): AuditLog => {
  const oldStatus = log.old_status ? normalizeStatus(log.old_status) : undefined;
  const newStatus = log.new_status ? normalizeStatus(log.new_status) : undefined;
  const eventType = String(log.event_type || log.type || '');

  return {
    id: Number(log.id),
    pallet_id: Number(log.pallet_id),
    pallet_qr: log.pallet?.pallet_name || log.pallet?.reference_code || log.pallet_qr || log.pallet?.qr_code || '',
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
    status_change_photo_url: log.status_change_photo_url || undefined,
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
  customer_email: invoice.user?.customer_detail?.billing_email || invoice.user?.email || undefined,
  customer_kvk: invoice.user?.customer_detail?.kvk_number || invoice.user?.customer_detail?.kvk || undefined,
  customer_vat: invoice.user?.customer_detail?.vat_number || invoice.user?.customer_detail?.tax_number || undefined,
  billing_address: invoice.user?.customer_detail?.billing_address || undefined,
  delivery_address: invoice.user?.customer_detail?.delivery_address || undefined,
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
  photos: Array.isArray(report.photos) ? report.photos.map(normalizePalletPhoto) : undefined,
  resolved_at: report.resolved_at || undefined,
  resolution_note: report.resolution_note || undefined,
  created_at: report.created_at || new Date().toISOString(),
});

const normalizePalletPhoto = (photo: ApiRecord): PalletPhoto => ({
  id: Number(photo.id),
  pallet_id: Number(photo.pallet_id),
  old_status_id: photo.old_status_id ? Number(photo.old_status_id) : undefined,
  new_status_id: photo.new_status_id ? Number(photo.new_status_id) : undefined,
  client_id: photo.client_id ? Number(photo.client_id) : undefined,
  service_report_id: photo.service_report_id ? Number(photo.service_report_id) : undefined,
  type: photo.type,
  warehouse_scope: photo.warehouse_scope || undefined,
  original_name: photo.original_name || undefined,
  mime_type: photo.mime_type || 'application/octet-stream',
  size_bytes: Number(photo.size_bytes ?? 0),
  expires_at: photo.expires_at,
  url: photo.url || undefined,
  created_at: photo.created_at,
  pallet: photo.pallet || undefined,
  uploader: photo.uploader || undefined,
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
    province: client.province || null,
    kvk: client.kvk_number || null,
    billing_email: client.billing_email || null,
    fixed_phone: client.fixed_phone || null,
    street: client.street || null,
    house_number: client.house_number || null,
    postal_code: client.postal_code || null,
    city: client.city || null,
    warehouse_scope: client.warehouse_scope || null,
    warehouse1_street: client.warehouse1_street || addresses[0] || null,
    warehouse1_house_number: client.warehouse1_house_number || null,
    warehouse1_postal_code: client.warehouse1_postal_code || null,
    warehouse1_city: client.warehouse1_city || null,
    warehouse2_street: client.warehouse2_street || addresses[1] || null,
    warehouse2_house_number: client.warehouse2_house_number || null,
    warehouse2_postal_code: client.warehouse2_postal_code || null,
    warehouse2_city: client.warehouse2_city || null,
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
  pallet_name: pallet.pallet_name || pallet.reference_code || pallet.qr_code,
  reference_code: pallet.reference_code,
  current_location: pallet.current_location || '',
  notes: pallet.note || undefined,
  is_active: pallet.is_active ?? true,
  is_ghost: pallet.is_ghost ?? false,
  metadata: pallet.metadata,
});

const normalizeCalendarNote = (note: ApiRecord): CalendarNote => ({
  id: Number(note.id),
  note_date: note.note_date || '',
  note_time: note.note_time || undefined,
  title: note.title || undefined,
  note: note.note || '',
  created_by_user_id: Number(note.created_by_user_id || 0),
  created_by_user_name: note.created_by_user_name || note.creator?.name || undefined,
  notified_user_ids: (note.notified_user_ids || []).map(Number),
  notified_users: (note.notified_users || []).map(normalizeUser),
  created_at: note.created_at || new Date().toISOString(),
  updated_at: note.updated_at || note.created_at || new Date().toISOString(),
});

export const apiService = {
  hasToken: () => Boolean(getStoredToken()),
  clearToken: () => setStoredToken(null),

  auth: {
    kvkLookup: (kvk: string) => apiData<{ company_name: string; kvk: string; email?: string; phone_number?: string; fixed_phone?: string; street?: string; house_number?: string; postal_code?: string; city?: string; warehouse1_street?: string; warehouse1_house_number?: string; warehouse1_postal_code?: string; warehouse1_city?: string; warehouse2_street?: string; warehouse2_house_number?: string; warehouse2_postal_code?: string; warehouse2_city?: string }>('/auth/kvk-lookup', { method: 'POST', body: jsonBody({ kvk }) }),
    kvkRegister: (data: { kvk: string; name: string; email: string; phone_number?: string; fixed_phone?: string; street?: string; house_number?: string; postal_code?: string; city?: string; warehouse1_street?: string; warehouse1_house_number?: string; warehouse1_postal_code?: string; warehouse1_city?: string; warehouse2_street?: string; warehouse2_house_number?: string; warehouse2_postal_code?: string; warehouse2_city?: string; password: string; password_confirmation: string }) => apiData<ApiRecord>('/auth/kvk-register', { method: 'POST', body: jsonBody(data) }),
    login: async (credentials: LoginCredentials) => {
      const loginType = credentials.loginType || (credentials.kvk ? 'customer' : 'user');
      const result = await apiData<ApiRecord>('/auth/login', {
        method: 'POST',
        body: jsonBody({
          login_type: loginType,
          email: loginType === 'user' ? credentials.email : undefined,
          kvk: loginType === 'customer' ? credentials.kvk : undefined,
          customer_detail_id: loginType === 'customer' ? credentials.customerDetailId : undefined,
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
    page: (params: ListParams = {}) => listPage<Role>('/roles', params, normalizeRole),
    list: listRoles,
    create: async (data: Partial<Role>): Promise<Role> =>
      normalizeRole(
        await apiData<ApiRecord>('/roles', {
          method: 'POST',
          body: jsonBody({
            name: data.name,
            description: data.description,
            is_active: true,
            role_permissions: (data.permissions || []).map(moduleId => data.role_permissions?.find(grant => grant.module_id === moduleId) || {
              module_id: moduleId, can_list: true, can_view: true, can_create: true, can_update: true, can_delete: true,
            }),
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
            role_permissions: (data.permissions || []).map(moduleId => data.role_permissions?.find(grant => grant.module_id === moduleId) || {
              module_id: moduleId, can_list: true, can_view: true, can_create: true, can_update: true, can_delete: true,
            }),
          }),
        })
      ),
    delete: async (id: number): Promise<void> => {
      await apiData<null>(`/roles/${id}`, { method: 'DELETE' });
    },
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
    page: (params: ListParams = {}) => listPage<PalletStatus>('/statuses', params, normalizeStatus),
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
    stats: async (): Promise<PalletDashboardStats> =>
      normalizePalletDashboardStats(await apiData<ApiRecord>('/pallets/dashboard-stats')),
    page: (params: ListParams = {}) => listPage<Pallet>('/pallets', params, normalizePallet),
    list: async (params: ListParams = {}): Promise<Pallet[]> => (await listAll<ApiRecord>('/pallets', params)).map(normalizePallet),
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
    saveDeliveryLocation: async (id: number, data: DeliveryLocationInput): Promise<DeliveryLocation> =>
      normalizeDeliveryLocation(
        await apiData<ApiRecord>(`/pallets/${id}/delivery-location`, {
          method: 'PUT',
          body: jsonBody(data),
        })
      ),
    sendOverdueInvoice: async (id: number): Promise<{ invoice_id: number; recipient: string }> =>
      apiData<{ invoice_id: number; recipient: string }>(`/pallets/${id}/overdue-invoice/send`, { method: 'POST' }),
    delete: async (id: number): Promise<void> => {
      await apiData<null>(`/pallets/${id}`, { method: 'DELETE' });
    },
  },

  locations: {
    reverseGeocode: async (latitude: number, longitude: number): Promise<ReverseGeocodingResult> =>
      normalizeReverseGeocodingResult(
        await apiData<ApiRecord>('/location/reverse-geocode', {
          method: 'POST',
          body: jsonBody({ latitude, longitude }),
        })
      ),
  },

  palletPhotos: {
    uploadScan: async (
      palletId: number,
      image: File,
      context: { old_status_id?: number; new_status_id?: number; client_id?: number } = {}
    ): Promise<PalletPhoto> => {
      const formData = new FormData();
      formData.append('image', image);

      if (context.old_status_id) {
        formData.append('old_status_id', String(toBackendStatusId(context.old_status_id)));
      }

      if (context.new_status_id) {
        formData.append('new_status_id', String(toBackendStatusId(context.new_status_id)));
      }

      if (context.client_id) {
        formData.append('client_id', String(context.client_id));
      }

      return normalizePalletPhoto(
        await apiData<ApiRecord>(`/pallets/${palletId}/photos`, {
          method: 'POST',
          body: formData,
        })
      );
    },
  },

  clients: {
    me: async (): Promise<ClientDetail | null> => {
      const detail = await apiData<ApiRecord | null>('/customer-details/me');
      return detail ? normalizeClient(detail) : null;
    },
    updateMe: async (data: {
      company_name: string;
      kvk: string;
      phone_number: string;
      fixed_phone: string;
      billing_email: string;
      billing_address: string;
      street: string;
      house_number: string;
      postal_code: string;
      city: string;
      warehouse1_street: string;
      warehouse1_house_number: string;
      warehouse1_postal_code: string;
      warehouse1_city: string;
      warehouse2_street: string;
      warehouse2_house_number: string;
      warehouse2_postal_code: string;
      warehouse2_city: string;
      warehouse_scope?: 'warehouse_nl' | 'warehouse_bih';
    }): Promise<ClientDetail> => normalizeClient(await apiData<ApiRecord>('/customer-details/me', {
      method: 'PUT',
      body: jsonBody(data),
    })),
    page: (params: ListParams = {}) => listPage<ClientDetail>('/customer_details', params, normalizeClient),
    list: async (params: ListParams = {}): Promise<ClientDetail[]> =>
      (await listAll<ApiRecord>('/customer_details', params)).map(normalizeClient),
    palletPhotos: async (customerDetailId: number): Promise<PalletPhoto[]> =>
      (await listAll<ApiRecord>(`/customer_details/${customerDetailId}/pallet-photos`)).map(normalizePalletPhoto),
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
          email: data.billing_email || `${slugify(name)}.${Date.now()}@trackpal.test`,
          phone_number: data.phone_number || undefined,
          password: DEMO_PASSWORD,
          is_active: true,
          customer_details: toCustomerPayload(data),
        }),
      });

      if (user.customer_detail) {
        return normalizeClient(user.customer_detail);
      }

      const clients = await apiService.clients.list({ limit: 100 });
      return clients.find((client) => client.user_id === Number(user.id)) || clients[0];
    },
    update: async (data: ClientDetail): Promise<ClientDetail> =>
      normalizeClient(
        await apiData<ApiRecord>(`/customer_details/${data.id}`, {
          method: 'PUT',
          body: jsonBody(toCustomerPayload(data)),
        })
      ),
    delete: async (id: number): Promise<void> => {
      await apiData<null>(`/customer_details/${id}`, { method: 'DELETE' });
    },
  },

  users: {
    loginOptions: async (): Promise<ManagedUser[]> =>
      (await apiData<ApiRecord[]>('/auth/login-options')).map(normalizeUser),
    page: (params: ListParams = {}) => listPage<ManagedUser>('/users', params, normalizeUser),
    list: async (params: ListParams = {}): Promise<ManagedUser[]> =>
      (await listAll<ApiRecord>('/users', params)).map(normalizeUser),
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
      data: Partial<Pick<ManagedUser, 'email' | 'password' | 'role_name' | 'phone_number'>>
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

      if (data.phone_number !== undefined) {
        payload.phone_number = data.phone_number.trim() || null;
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
    page: (params: ListParams = {}) => listPage<AuditLog>('/audit_logs', params, normalizeAuditLog),
    list: async (params: ListParams = {}): Promise<AuditLog[]> =>
      (await listAll<ApiRecord>('/audit_logs', params)).map(normalizeAuditLog),
  },

  serviceReports: {
    page: (params: ListParams = {}) => listPage<ServiceReport>('/service_reports', params, normalizeServiceReport),
    list: async (params: ListParams = {}): Promise<ServiceReport[]> =>
      (await listAll<ApiRecord>('/service_reports', params)).map(normalizeServiceReport),
    create: async (
      data: { pallet_id: number; problem_description: string; image?: File }
    ): Promise<ServiceReport> => {
      const formData = new FormData();
      formData.append('pallet_id', String(data.pallet_id));
      formData.append('severity', 'medium');
      formData.append('issue_type', 'damage');
      formData.append('description', data.problem_description);

      if (data.image) {
        formData.append('image', data.image);
      }

      return normalizeServiceReport(
        await apiData<ApiRecord>('/service_reports', {
          method: 'POST',
          body: formData,
        })
      );
    },
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
    page: (params: ListParams = {}) => listPage<Invoice>('/invoices', params, normalizeInvoice),
    list: async (params: ListParams = {}): Promise<Invoice[]> =>
      (await listAll<ApiRecord>('/invoices', params)).map(normalizeInvoice),
    getItems: async (invoiceId: number): Promise<InvoiceItem[]> =>
      (await listAll<ApiRecord>('/invoice_items', { invoice_id: invoiceId })).map(normalizeInvoiceItem),
    create: async (data: { user_id: number; period_start: string; period_end: string; due_at?: string }): Promise<Invoice> =>
      normalizeInvoice(await apiData<ApiRecord>('/invoices', { method: 'POST', body: jsonBody(data) })),
    preview: async (invoiceId: number) => requestBlob(`/invoices/${invoiceId}/preview`),
    download: async (invoiceId: number) => requestBlob(`/invoices/${invoiceId}/download`),
    send: async (invoiceId: number) => apiData<{ recipient: string }>(`/invoices/${invoiceId}/send`, { method: 'POST' }),
  },

  gallery: {
    page: (params: ListParams = {}) => listPage<PalletPhoto>('/gallery', params, normalizePalletPhoto),
    image: (url: string) => requestBlob(url),
  },

  calendarNotes: {
    page: (params: ListParams = {}) => listPage<CalendarNote>('/calendar_notes', params, normalizeCalendarNote),
    list: async (params: ListParams = {}): Promise<CalendarNote[]> =>
      (await listAll<ApiRecord>('/calendar_notes', params)).map(normalizeCalendarNote),
    create: async (data: {
      note_date: string;
      note_time?: string;
      title?: string;
      note: string;
      notified_user_ids?: number[];
    }): Promise<CalendarNote> =>
      normalizeCalendarNote(
        await apiData<ApiRecord>('/calendar_notes', {
          method: 'POST',
          body: jsonBody(data),
        })
      ),
    update: async (
      id: number,
      data: {
        note_date: string;
        note_time?: string;
        title?: string;
        note: string;
        notified_user_ids?: number[];
      }
    ): Promise<CalendarNote> =>
      normalizeCalendarNote(
        await apiData<ApiRecord>(`/calendar_notes/${id}`, {
          method: 'PUT',
          body: jsonBody(data),
        })
      ),
    delete: async (id: number): Promise<void> => {
      await apiData<null>(`/calendar_notes/${id}`, { method: 'DELETE' });
    },
    notifyCandidates: async (params: ListParams = {}): Promise<ManagedUser[]> =>
      (await listAll<ApiRecord>('/calendar_notes/notify-candidates', params)).map(normalizeUser),
  },
};
