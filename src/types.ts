export interface Permission {
  id: number;
  name: string;
  code: string;
  description: string;
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions: number[]; // IDs of permissions
  role_permissions?: RolePermissionGrant[];
}

export interface RolePermissionGrant {
  module_id: number;
  can_list: boolean;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  scope?: 'all' | 'warehouse_nl' | 'warehouse_bih';
}

export enum RoleType {
  ADMIN = 'Admin',
  ADMIN_SERVICE = 'Admin Servis',
  ADMIN_WAREHOUSE = 'Admin Magacin',
  FINANCE_ADMINISTRATION = 'Finance & Administration',
  VOZAC = 'Vozač',
  MAGACINER = 'Magaciner',
  KLIJENT = 'Klijent/Kupac',
  SERVISER = 'Serviser',
}

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: RoleType;
  backend_role_name?: string;
  phone_number?: string;
  customer_detail?: {
    name?: string;
    company_name?: string;
    kvk?: string;
    kvk_number?: string;
    fixed_phone?: string;
    billing_email?: string;
    street?: string;
    postal_code?: string;
    warehouse_scope?: 'warehouse_nl' | 'warehouse_bih';
  };
  permission_codes?: string[];
}

export interface ManagedUser extends User {
  password: string;
}

export interface PalletStatus {
  id: number;
  name: string;
  is_active: boolean; // Brojač aktivan
  is_billable: boolean; // Naplaćuje se
  grace_period_days: number;
  price_per_day: number;
  slug: string;
}

export interface Pallet {
  id: number;
  qr_code: string;
  reference_code?: string;
  pallet_name?: string;
  current_status_id: number;
  current_status_name: string;
  current_status_slug?: string;
  user_id?: number; // Klijent ID
  client_name?: string;
  type: string;
  current_location: string;
  is_ghost: boolean;
  is_active: boolean;
  last_status_changed_at: string;
  created_at: string;
  note?: string;
  metadata?: Record<string, unknown> | null;
}

export interface PalletDashboardStats {
  total_pallets: number;
  in_transport: number;
  overdue_units: number;
}

export interface AuditLog {
  id: number;
  pallet_id: number;
  pallet_qr: string;
  made_by_user_id: number;
  made_by_user_name: string;
  type?: 'status' | 'qr_version';
  old_status_id?: number;
  new_status_id: number;
  old_status_name?: string;
  new_status_name: string;
  old_client_id?: number;
  new_client_id?: number;
  old_location?: string;
  new_location: string;
  qr_version?: string;
  old_qr_code?: string;
  new_qr_code?: string;
  note?: string;
  created_at: string;
}

export interface ServiceReport {
  id: number;
  pallet_id: number;
  reported_by_user_id: number;
  resolved_by_user_id?: number;
  problem_description: string;
  image_path?: string;
  photos?: PalletPhoto[];
  resolved_at?: string;
  resolution_note?: string;
  created_at: string;
}

export interface PalletPhoto {
  id: number;
  pallet_id: number;
  old_status_id?: number;
  new_status_id?: number;
  client_id?: number;
  service_report_id?: number;
  type: 'scan' | 'status_change' | 'damage_report' | 'service_report';
  warehouse_scope?: 'warehouse_nl' | 'warehouse_bih';
  original_name?: string;
  mime_type: string;
  size_bytes: number;
  expires_at: string;
  url?: string;
  created_at: string;
  pallet?: { id: number; qr_code: string; name: string; customer?: string; status?: string };
  uploader?: { id: number; name: string; role?: string };
}

export interface ClientDetail {
  id: number;
  user_id: number;
  name: string;
  kvk_number?: string;
  phone_number?: string;
  fixed_phone?: string;
  billing_email?: string;
  warehouse_addresses?: string[];
  country: string;
  province?: string;
  grace_period_days: number;
  price_per_day: number;
  is_active: boolean;
  street?: string;
  postal_code?: string;
  warehouse_scope?: 'warehouse_nl' | 'warehouse_bih';
}

export interface GhostPalletReportEntry {
  location: string;
  note?: string;
}

export interface GhostPalletReportInput {
  note?: string;
  location?: string;
  entries?: GhostPalletReportEntry[];
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
  customer_email?: string;
  customer_kvk?: string;
  customer_vat?: string;
  billing_address?: string;
  delivery_address?: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  status: 'draft' | 'paid' | 'overdue' | 'sent';
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  pallet_qr: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CalendarNote {
  id: number;
  note_date: string;
  note_time?: string;
  title?: string;
  note: string;
  created_by_user_id: number;
  created_by_user_name?: string;
  notified_user_ids: number[];
  notified_users: ManagedUser[];
  created_at: string;
  updated_at: string;
}
