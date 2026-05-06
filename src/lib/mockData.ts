import { RoleType, User, Pallet, PalletStatus, AuditLog, ClientDetail } from '../types';

export const mockStatuses: PalletStatus[] = [
  { id: 1, name: 'Bowido BIH', is_active: false, is_billable: false, grace_period_days: 0, price_per_day: 0 },
  { id: 2, name: 'Transport BiH/NL', is_active: true, is_billable: false, grace_period_days: 3, price_per_day: 0 },
  { id: 3, name: 'Bowido(NL)', is_active: false, is_billable: false, grace_period_days: 0, price_per_day: 0 },
  { id: 4, name: 'Bij de klant', is_active: true, is_billable: true, grace_period_days: 14, price_per_day: 2.5 },
  { id: 5, name: 'Voor retour', is_active: true, is_billable: false, grace_period_days: 0, price_per_day: 0 },
  { id: 6, name: 'Transport (NL/BiH)', is_active: true, is_billable: false, grace_period_days: 3, price_per_day: 0 },
  { id: 7, name: 'Servis', is_active: true, is_billable: false, grace_period_days: 0, price_per_day: 0 },
  { id: 8, name: 'Onbekend', is_active: false, is_billable: false, grace_period_days: 0, price_per_day: 0 },
];

export const mockUsers: User[] = [
  { id: 1, name: 'Admin User', email: 'admin@palletify.com', role_id: 1, role_name: RoleType.ADMIN },
  { id: 2, name: 'Dragan Driver', email: 'driver@palletify.com', role_id: 2, role_name: RoleType.VOZAC },
  { id: 3, name: 'Marko Magaciner', email: 'warehouse@palletify.com', role_id: 3, role_name: RoleType.MAGACINER },
  { id: 4, name: 'AutoNL Eindhoven', email: 'client@autonl.com', role_id: 4, role_name: RoleType.KLIJENT },
  { id: 5, name: 'Sava Serviser', email: 'service@doboj.com', role_id: 5, role_name: RoleType.SERVISER },
];

export const mockClients: ClientDetail[] = [
  { id: 1, user_id: 4, name: 'AutoNL Eindhoven', country: 'NL', grace_period_days: 14, price_per_day: 2.5, is_active: true },
  { id: 2, user_id: 99, name: 'Hanson Logistics', country: 'NL', grace_period_days: 7, price_per_day: 3.0, is_active: true },
  { id: 3, user_id: 100, name: 'Bosna Express', country: 'BiH', grace_period_days: 5, price_per_day: 2.0, is_active: true },
];

export const mockPallets: Pallet[] = [
  {
    id: 1,
    qr_code: 'PAL-0001',
    current_status_id: 4,
    current_status_name: 'Bij de klant',
    user_id: 4,
    client_name: 'AutoNL Eindhoven',
    type: 'Kraksna (Standard)',
    current_location: 'Eindhoven, NL',
    is_ghost: false,
    is_active: true,
    last_status_changed_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 2,
    qr_code: 'PAL-0002',
    current_status_id: 1,
    current_status_name: 'Bowido BIH',
    type: 'G-Stalak za Prozore',
    current_location: 'Sarajevo, BIH',
    is_ghost: false,
    is_active: true,
    last_status_changed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 3,
    qr_code: 'PAL-0003',
    current_status_id: 7,
    current_status_name: 'Servis',
    type: 'Kraksna (A-Frame)',
    current_location: 'Workshop, Doboj',
    is_ghost: false,
    is_active: true,
    last_status_changed_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 4,
    qr_code: 'PAL-0004',
    current_status_id: 2,
    current_status_name: 'Transport BiH/NL',
    type: 'A-Stalak (XL)',
    current_location: 'Truck BIH-442',
    is_ghost: false,
    is_active: true,
    last_status_changed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2026-01-01T08:00:00Z',
  },
  {
    id: 5,
    qr_code: 'PAL-0022',
    current_status_id: 4,
    current_status_name: 'Bij de klant',
    user_id: 99,
    client_name: 'Hanson Logistics',
    type: 'Metal Cage / Kraksna',
    current_location: 'Rotterdam Port',
    is_ghost: false,
    is_active: true,
    last_status_changed_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2026-01-10T08:00:00Z',
  },
];

export const mockAuditLogs: AuditLog[] = [
  {
    id: 1,
    pallet_id: 1,
    pallet_qr: 'PAL-0001',
    made_by_user_id: 1,
    made_by_user_name: 'Admin User',
    new_status_id: 4,
    new_status_name: 'Bij de klant',
    new_location: 'Eindhoven, NL',
    created_at: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 2,
    pallet_id: 2,
    pallet_qr: 'PAL-0002',
    made_by_user_id: 2,
    made_by_user_name: 'Dragan Driver',
    new_status_id: 2,
    new_status_name: 'Transport BiH/NL',
    new_location: 'Bus BIH-Sarajevo',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
  },
  {
    id: 3,
    pallet_id: 3,
    pallet_qr: 'PAL-0003',
    made_by_user_id: 3,
    made_by_user_name: 'Marko Magaciner',
    new_status_id: 1,
    new_status_name: 'Bowido BIH',
    new_location: 'Warehouse A1',
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
  },
  {
    id: 4,
    pallet_id: 4,
    pallet_qr: 'PAL-0004',
    made_by_user_id: 2,
    made_by_user_name: 'Dragan Driver',
    new_status_id: 6,
    new_status_name: 'Transport (NL/BiH)',
    new_location: 'Truck NL-202',
    created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 mins ago
  }
];
