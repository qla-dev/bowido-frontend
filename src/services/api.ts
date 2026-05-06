import { 
  Pallet, 
  User, 
  PalletStatus, 
  AuditLog, 
  ClientDetail, 
  Invoice, 
  InvoiceItem,
  Role,
  Permission
} from '../types';

// Mock API base delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const apiService = {
  // ROLES & PERMISSIONS
  roles: {
    list: async (): Promise<Role[]> => {
      await delay(400);
      return JSON.parse(localStorage.getItem('roles') || '[{"id": 1, "name": "Admin", "description": "Full access", "permissions": [1,2,3]}]');
    },
    create: async (data: Partial<Role>): Promise<Role> => {
      await delay(600);
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      const newRole = { ...data, id: Date.now() } as Role;
      localStorage.setItem('roles', JSON.stringify([...roles, newRole]));
      return newRole;
    },
    update: async (id: number, data: Partial<Role>): Promise<Role> => {
      await delay(600);
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      const updated = roles.map((r: Role) => r.id === id ? { ...r, ...data } : r);
      localStorage.setItem('roles', JSON.stringify(updated));
      return { id, ...data } as Role;
    }
  },
  permissions: {
    list: async (): Promise<Permission[]> => {
      await delay(300);
      return [
        { id: 1, name: 'Read Pallets', code: 'pallets:read', description: 'Can view pallet list' },
        { id: 2, name: 'Write Pallets', code: 'pallets:write', description: 'Can create/edit pallets' },
        { id: 3, name: 'Manage Users', code: 'users:manage', description: 'Full user control' },
      ];
    }
  },

  // PALLETS API
  pallets: {
    list: async (): Promise<Pallet[]> => {
      await delay(500);
      return JSON.parse(localStorage.getItem('pallets') || '[]');
    },
    get: async (id: number): Promise<Pallet> => {
      await delay(300);
      const pallets = JSON.parse(localStorage.getItem('pallets') || '[]');
      return pallets.find((p: Pallet) => p.id === id);
    },
    create: async (data: Partial<Pallet>): Promise<Pallet> => {
      await delay(600);
      return data as Pallet;
    },
    update: async (id: number, data: Partial<Pallet>): Promise<Pallet> => {
      await delay(600);
      return { id, ...data } as Pallet;
    }
  },

  // USERS / LOGIN
  auth: {
    login: async (credentials: any) => {
      await delay(800);
      return { token: 'mock-jwt-token', user: { id: 1, name: 'Admin' } };
    }
  },

  // INVOICES
  invoices: {
    list: async (): Promise<Invoice[]> => {
      await delay(400);
      return [
        {
          id: 1,
          invoice_number: 'INV-2024-001',
          customer_id: 1,
          customer_name: 'AutoNL Eindhoven',
          issue_date: '2024-03-01',
          due_date: '2024-03-15',
          total_amount: 1250.50,
          status: 'sent'
        },
        {
          id: 2,
          invoice_number: 'INV-2024-002',
          customer_id: 1,
          customer_name: 'AutoNL Eindhoven',
          issue_date: '2024-04-01',
          due_date: '2024-04-15',
          total_amount: 840.00,
          status: 'paid'
        }
      ];
    },
    getItems: async (invoiceId: number): Promise<InvoiceItem[]> => {
      await delay(300);
      return [
        { id: 1, invoice_id: invoiceId, pallet_qr: 'PAL-0001', description: 'Storage Fee (14 days)', quantity: 1, unit_price: 28.00, total: 28.00 },
        { id: 2, invoice_id: invoiceId, pallet_qr: 'PAL-0552', description: 'Storage Fee (22 days)', quantity: 1, unit_price: 44.00, total: 44.00 },
      ];
    }
  }
};
