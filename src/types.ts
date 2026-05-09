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
}

export enum RoleType {
  ADMIN = 'Admin',
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
  phone_number?: string;
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
}

export interface Pallet {
  id: number;
  qr_code: string;
  current_status_id: number;
  current_status_name: string;
  user_id?: number; // Klijent ID
  client_name?: string;
  type: string;
  current_location: string;
  is_ghost: boolean;
  is_active: boolean;
  last_status_changed_at: string;
  created_at: string;
  note?: string;
}

export interface AuditLog {
  id: number;
  pallet_id: number;
  pallet_qr: string;
  made_by_user_id: number;
  made_by_user_name: string;
  old_status_id?: number;
  new_status_id: number;
  old_status_name?: string;
  new_status_name: string;
  old_location?: string;
  new_location: string;
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
  resolved_at?: string;
  resolution_note?: string;
  created_at: string;
}

export interface ClientDetail {
  id: number;
  user_id: number;
  name: string;
  country: string;
  grace_period_days: number;
  price_per_day: number;
  is_active: boolean;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name: string;
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
