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
  scope?: "all" | "warehouse_nl" | "warehouse_bih";
}

export enum RoleType {
  ADMIN = "Admin",
  ADMIN_SERVICE = "Admin Servis",
  ADMIN_WAREHOUSE = "Admin Magacin",
  FINANCE_ADMINISTRATION = "Finance & Administration",
  VOZAC = "Vozač",
  MAGACINER = "Magaciner",
  KLIJENT = "Klijent/Kupac",
  SERVISER = "Serviser",
}

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: RoleType;
  backend_role_name?: string;
  phone_number?: string;
  first_time_login?: boolean;
  credential_email_sent?: boolean;
  credential_email_warning?: string | null;
  customer_detail?: {
    name?: string;
    company_name?: string;
    kvk?: string;
    kvk_number?: string;
    fixed_phone?: string;
    billing_email?: string;
    street?: string;
    postal_code?: string;
    warehouse_scope?: "warehouse_nl" | "warehouse_bih";
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

export interface ReverseGeocodingResult {
  latitude: number;
  longitude: number;
  formatted_address?: string;
  street?: string;
  house_number?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  country_code?: string;
  provider: string;
}

export interface DeliveryLocation extends ReverseGeocodingResult {
  id: number;
  pallet_id: number;
  accuracy_meters?: number;
  source: "device_gps";
  confirmed_by_user: boolean;
  created_by_user_id?: number;
  captured_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DeliveryLocationInput {
  latitude: number;
  longitude: number;
  accuracy_meters?: number;
  captured_at?: string;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
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
  client_deleted?: boolean;
  type: string;
  asset_type?: string;
  current_location: string;
  has_qr_code: boolean;
  is_ghost: boolean;
  is_for_repair: boolean;
  is_active: boolean;
  last_status_changed_at: string;
  customer_timer_started_at?: string;
  customer_timer_frozen_at?: string;
  days_at_customer?: number;
  grace_days?: number;
  overdue_days?: number;
  debt_eur?: number;
  created_at: string;
  note?: string;
  status_change_photo_url?: string;
  metadata?: Record<string, unknown> | null;
  delivery_location?: DeliveryLocation;
}

export interface PalletDashboardStats {
  total_pallets: number;
  in_transport: number;
  overdue_units: number;
  customer_pickup_units: number;
  top_overdue_clients: Array<{
    user_id: number | null;
    client_name: string;
    overdue_pallets: number;
    debt_eur: number;
  }>;
}

export interface AuditLog {
  id: number;
  pallet_id: number;
  pallet_qr: string;
  made_by_user_id: number;
  made_by_user_name: string;
  type?: "status" | "qr_version" | "repair";
  event_type?: string;
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
  status_change_photo_url?: string;
  context?: Record<string, unknown>;
  created_at: string;
}

export interface ServiceReport {
  id: number;
  pallet_id: number;
  reported_by_user_id: number;
  reported_by_user?: User;
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
  type: "scan" | "status_change" | "damage_report" | "service_report" | "no_qr_report" | "delivery_photo";
  delivery_started_at?: string;
  warehouse_scope?: "warehouse_nl" | "warehouse_bih";
  original_name?: string;
  mime_type: string;
  size_bytes: number;
  width?: number;
  height?: number;
  expires_at: string;
  url?: string;
  created_at: string;
  status?: { id: number; name: string; slug?: string };
  pallet?: {
    id: number;
    qr_code: string;
    name: string;
    customer?: string;
    status?: string;
  };
  uploader?: { id: number; name: string; role?: string };
}

export interface ClientDetail {
  id: number;
  user_id: number;
  name: string;
  contact_person?: string | null;
  kvk_number?: string;
  phone_number?: string;
  fixed_phone?: string;
  billing_email?: string;
  billing_address?: string;
  delivery_address?: string;
  warehouse_addresses?: string[];
  country: string;
  province?: string;
  grace_period_days: number;
  price_per_day: number;
  is_active: boolean;
  street?: string;
  house_number?: string;
  postal_code?: string;
  city?: string;
  warehouse1_street?: string;
  warehouse1_house_number?: string;
  warehouse1_postal_code?: string;
  warehouse1_city?: string;
  warehouse2_street?: string;
  warehouse2_house_number?: string;
  warehouse2_postal_code?: string;
  warehouse2_city?: string;
  warehouse_scope?: "warehouse_nl" | "warehouse_bih";
  invoice_count?: number;
  credential_email_sent?: boolean;
  credential_email_warning?: string | null;
}

export interface GhostPalletReportEntry {
  location: string;
  note?: string;
  delivery_location?: DeliveryLocationInput;
}

export interface GhostPalletReportInput {
  note?: string;
  location?: string;
  entries?: GhostPalletReportEntry[];
  images?: File[];
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
  status: "draft" | "issued" | "paid" | "overdue" | "sent";
  created_at: string;
  mailed_at?: string;
}

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  pallet_name: string;
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
