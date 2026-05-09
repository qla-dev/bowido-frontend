import { 
  Pallet, 
  User, 
  ManagedUser,
  RoleType,
  PalletStatus, 
  AuditLog, 
  ClientDetail, 
  Invoice, 
  InvoiceItem,
  Role,
  Permission
} from '../types';
import { mockManagedUsers } from '../lib/mockData';

// Mock API base delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
const USERS_STORAGE_KEY = 'managedUsers';

const getRoleId = (roleName: ManagedUser['role_name']) => {
  const roleIds: Record<RoleType, number> = {
    [RoleType.ADMIN]: 1,
    [RoleType.VOZAC]: 2,
    [RoleType.MAGACINER]: 3,
    [RoleType.KLIJENT]: 4,
    [RoleType.SERVISER]: 5,
  };

  return roleIds[roleName] ?? 1;
};

const formatUserName = (email: string) => {
  const prefix = email.split('@')[0] || 'novi korisnik';

  return prefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getStoredUsers = (): ManagedUser[] => {
  const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);

  if (!storedUsers) {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mockManagedUsers));
    return mockManagedUsers;
  }

  try {
    const parsedUsers = JSON.parse(storedUsers) as ManagedUser[];
    return parsedUsers.length > 0 ? parsedUsers : mockManagedUsers;
  } catch {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(mockManagedUsers));
    return mockManagedUsers;
  }
};

const saveStoredUsers = (users: ManagedUser[]) => {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

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
  users: {
    list: async (): Promise<ManagedUser[]> => {
      await delay(250);
      return getStoredUsers();
    },
    create: async (data: Pick<ManagedUser, 'email' | 'password' | 'role_name'>): Promise<ManagedUser> => {
      await delay(500);
      const users = getStoredUsers();
      const newUser: ManagedUser = {
        id: Date.now(),
        email: data.email.trim(),
        password: data.password,
        role_name: data.role_name,
        role_id: getRoleId(data.role_name),
        name: formatUserName(data.email),
      };

      saveStoredUsers([newUser, ...users]);
      return newUser;
    },
    update: async (
      id: number,
      data: Partial<Pick<ManagedUser, 'email' | 'password' | 'role_name'>>
    ): Promise<ManagedUser> => {
      await delay(500);
      const users = getStoredUsers();
      let updatedUser: ManagedUser | undefined;

      const updatedUsers = users.map((user) => {
        if (user.id !== id) {
          return user;
        }

        updatedUser = {
          ...user,
          ...(data.email ? { email: data.email.trim(), name: formatUserName(data.email) } : {}),
          ...(data.password ? { password: data.password } : {}),
          ...(data.role_name ? { role_name: data.role_name, role_id: getRoleId(data.role_name) } : {}),
        };

        return updatedUser;
      });

      saveStoredUsers(updatedUsers);

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return updatedUser;
    },
    delete: async (id: number): Promise<void> => {
      await delay(400);
      const users = getStoredUsers();
      saveStoredUsers(users.filter((user) => user.id !== id));
    },
  },
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
