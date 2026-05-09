import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  StatCard,
  cn,
} from './ui';
import { apiService } from '../services/api';
import { ManagedUser, RoleType, User } from '../types';
import {
  CheckCircle2,
  ChevronDown,
  Edit2,
  KeyRound,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

interface UserManagerProps {
  currentUser: User;
}

interface UserFormState {
  email: string;
  password: string;
  role_name: RoleType;
}

const defaultFormState: UserFormState = {
  email: '',
  password: '',
  role_name: RoleType.ADMIN,
};

const roleBadgeClasses: Record<RoleType, string> = {
  [RoleType.ADMIN]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [RoleType.VOZAC]: 'bg-sky-50 text-sky-700 border-sky-200',
  [RoleType.MAGACINER]: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  [RoleType.KLIJENT]: 'bg-amber-50 text-amber-700 border-amber-200',
  [RoleType.SERVISER]: 'bg-rose-50 text-rose-700 border-rose-200',
};

const roleOptions = Object.values(RoleType);

const rolePermissions: Record<RoleType, string[]> = {
  [RoleType.ADMIN]: [
    'Pregled svih modula',
    'Kreiranje i uredjivanje korisnika',
    'Upravljanje rolama i pristupima',
    'Kontrola faktura i logistike',
  ],
  [RoleType.VOZAC]: [
    'Pregled aktivnih voznji',
    'Skeniranje i potvrda preuzimanja',
    'Azuriranje statusa transporta',
  ],
  [RoleType.MAGACINER]: [
    'Pregled skladista i stanja paleta',
    'Evidencija prijema i izdavanja',
    'Azuriranje lokacije robe',
  ],
  [RoleType.KLIJENT]: [
    'Pregled vlastitih jedinica',
    'Uvid u fakture i dugovanja',
    'Pracenje statusa isporuke',
  ],
  [RoleType.SERVISER]: [
    'Pregled servisnih zadataka',
    'Prijava i zatvaranje kvarova',
    'Unos servisnih biljeski',
  ],
};

interface RoleSelectProps {
  value: RoleType;
  onChange: (role: RoleType) => void;
}

const RoleSelect: React.FC<RoleSelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredRole, setHoveredRole] = useState<RoleType>(value);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHoveredRole(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const previewRole = hoveredRole || value;
  const previewPermissions = rolePermissions[previewRole];

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((previousState) => !previousState)}
        className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:border-[#00A655] hover:bg-white transition-all flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge className={cn('border shrink-0', roleBadgeClasses[value])}>{value}</Badge>
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900 truncate">
              {rolePermissions[value].length} permisije
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 truncate">
              Hover za pregled pristupa
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-zinc-400 transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="absolute left-0 right-0 top-full mt-2 z-30"
          >
            <div className="relative rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-emerald-950/10 overflow-visible">
              <div className="p-2 space-y-1">
                {roleOptions.map((role) => {
                  const isSelected = value === role;

                  return (
                    <div key={role} className="relative">
                      <button
                        type="button"
                        onMouseEnter={() => setHoveredRole(role)}
                        onFocus={() => setHoveredRole(role)}
                        onClick={() => {
                          onChange(role);
                          setHoveredRole(role);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'w-full px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3',
                          isSelected
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-transparent bg-white hover:border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-tight truncate">{role}</p>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 truncate">
                            {rolePermissions[role].length} dostupne permisije
                          </p>
                        </div>
                        {isSelected && (
                          <Badge variant="success" className="shrink-0">
                            Aktivna
                          </Badge>
                        )}
                      </button>

                      {hoveredRole === role && (
                        <div className="hidden xl:block pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 w-60 rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl shadow-emerald-950/10">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">
                            {role}
                          </p>
                          <p className="text-[11px] font-bold text-zinc-700 mt-2 mb-3">
                            Dummy pregled dozvoljenih akcija za ovu rolu.
                          </p>
                          <div className="space-y-2">
                            {rolePermissions[role].map((permission) => (
                              <div key={permission} className="flex items-start gap-2">
                                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-[10px] font-black uppercase tracking-[0.08em] text-zinc-600">
                                  {permission}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="xl:hidden border-t border-zinc-100 bg-zinc-50/70 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">
                  {previewRole}
                </p>
                <p className="text-[11px] font-bold text-zinc-700 mt-2 mb-3">
                  Dummy permisije koje se prikazuju na hover za odabranu rolu.
                </p>
                <div className="space-y-2">
                  {previewPermissions.map((permission) => (
                    <div key={permission} className="flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-[0.08em] text-zinc-600">
                        {permission}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const UserManager: React.FC<UserManagerProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [roleFilter, setRoleFilter] = useState<'all' | RoleType>('all');
  const [formState, setFormState] = useState<UserFormState>(defaultFormState);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const loadedUsers = await apiService.users.list();
      setUsers(loadedUsers);
    } catch {
      setErrorMessage('Korisnici se trenutno ne mogu ucitati.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingUserId(null);
    setErrorMessage(null);
  };

  const handleEdit = (user: ManagedUser) => {
    if (user.id === currentUser.id) {
      setErrorMessage('Aktivna sesija se ne moze uredjivati iz ovog pregleda.');
      return;
    }

    setEditingUserId(user.id);
    setFormState({
      email: user.email,
      password: '',
      role_name: user.role_name,
    });
    setErrorMessage(null);
  };

  const handleDelete = async (user: ManagedUser) => {
    if (user.id === currentUser.id) {
      setErrorMessage('Aktivna sesija se ne moze obrisati.');
      return;
    }

    if (users.length === 1) {
      setErrorMessage('Posljednji demo korisnik mora ostati dostupan.');
      return;
    }

    const shouldDelete = window.confirm(`Obrisati korisnika ${user.email}?`);

    if (!shouldDelete) {
      return;
    }

    await apiService.users.delete(user.id);
    setUsers((previousUsers) => previousUsers.filter((item) => item.id !== user.id));

    if (editingUserId === user.id) {
      resetForm();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = formState.email.trim();
    const trimmedPassword = formState.password.trim();

    if (!trimmedEmail) {
      setErrorMessage('Email je obavezan.');
      return;
    }

    if (!editingUserId && !trimmedPassword) {
      setErrorMessage('Lozinka je obavezna za novog korisnika.');
      return;
    }

    setIsSaving(true);

    try {
      if (editingUserId) {
        const updatedUser = await apiService.users.update(editingUserId, {
          email: trimmedEmail,
          role_name: formState.role_name,
          ...(trimmedPassword ? { password: trimmedPassword } : {}),
        });

        setUsers((previousUsers) =>
          previousUsers.map((user) => (user.id === editingUserId ? updatedUser : user))
        );
      } else {
        const createdUser = await apiService.users.create({
          email: trimmedEmail,
          password: trimmedPassword,
          role_name: formState.role_name,
        });

        setUsers((previousUsers) => [createdUser, ...previousUsers]);
      }

      resetForm();
    } catch {
      setErrorMessage('Promjene nisu sacuvane. Pokusaj ponovo.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      user.email.toLowerCase().includes(normalizedSearch) ||
      user.name.toLowerCase().includes(normalizedSearch) ||
      user.role_name.toLowerCase().includes(normalizedSearch);
    const matchesRole = roleFilter === 'all' || user.role_name === roleFilter;

    return matchesSearch && matchesRole;
  });

  const adminCount = users.filter((user) => user.role_name === RoleType.ADMIN).length;
  const activeRoles = new Set(users.map((user) => user.role_name)).size;

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Ukupno korisnika" value={users.length} />
        <StatCard label="Admin pristup" value={adminCount} variant="success" />
        <StatCard label="Aktivne role" value={activeRoles} variant="info" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_380px] gap-6 items-start">
        <Card
          title="Korisnici"
          noPadding
          action={
            <Button variant="ghost" size="xs" onClick={() => void loadUsers()}>
              <RefreshCw size={12} className="mr-2" />
              Osvjezi
            </Button>
          }
        >
          <div className="p-5 border-b border-zinc-100 bg-zinc-50/60 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Frontend only</p>
              <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-950 font-display">
                Demo imenik svih naloga
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pretrazi email, ime ili rolu"
                  className="pl-11 bg-white"
                />
              </div>

              <div className="w-full sm:w-52">
                <Select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as 'all' | RoleType)}
                  className="bg-white"
                >
                  <option value="all">Sve role</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-white text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em] border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-4">Korisnik</th>
                  <th className="px-6 py-4">Rola</th>
                  <th className="px-6 py-4">Pristup</th>
                  <th className="px-6 py-4 text-right">Akcije</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-[12px]">
                {filteredUsers.map((user) => {
                  const isCurrentSession = user.id === currentUser.id;

                  return (
                    <tr key={user.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                            <Mail size={16} className="text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-emerald-950 uppercase tracking-tight truncate">{user.email}</p>
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 truncate">
                              {user.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={cn('border', roleBadgeClasses[user.role_name])}>
                          {user.role_name}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {isCurrentSession ? (
                          <Badge variant="success">Aktivna sesija</Badge>
                        ) : (
                          <Badge variant="default">Demo nalog</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => handleEdit(user)}
                            disabled={isCurrentSession}
                            className="text-zinc-600 hover:text-emerald-700"
                          >
                            <Edit2 size={14} className="mr-1.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => void handleDelete(user)}
                            disabled={isCurrentSession}
                            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 size={14} className="mr-1.5" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden p-4 space-y-3">
            {filteredUsers.map((user) => {
              const isCurrentSession = user.id === currentUser.id;

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-sm uppercase tracking-tight text-emerald-950 break-all">
                        {user.email}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 mt-1">
                        {user.name}
                      </p>
                    </div>
                    <Badge className={cn('border shrink-0', roleBadgeClasses[user.role_name])}>
                      {user.role_name}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-zinc-100">
                    {isCurrentSession ? (
                      <Badge variant="success">Aktivna sesija</Badge>
                    ) : (
                      <Badge variant="default">Demo nalog</Badge>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleEdit(user)}
                        disabled={isCurrentSession}
                      >
                        <Edit2 size={14} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => void handleDelete(user)}
                        disabled={isCurrentSession}
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {!isLoading && filteredUsers.length === 0 && (
            <div className="p-10 text-center border-t border-zinc-100">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mb-4">
                <Users size={22} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">Nema rezultata</h3>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400 mt-2">
                Promijeni pretragu ili filter i probaj ponovo.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="p-10 text-center border-t border-zinc-100">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
                Ucitavanje korisnika...
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card title={editingUserId ? 'Uredi korisnika' : 'Kreiraj korisnika'}>
            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/70">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00A655] text-white flex items-center justify-center shrink-0">
                    {editingUserId ? <ShieldCheck size={18} /> : <UserPlus size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      {editingUserId ? 'Azuriranje naloga' : 'Novi demo nalog'}
                    </p>
                    <p className="text-[12px] font-bold text-emerald-900 leading-relaxed mt-1">
                      {editingUserId
                        ? 'Promijeni email, rolu i po potrebi lozinku korisnika.'
                        : 'Dodaj korisnika sa email adresom, lozinkom i odabranom rolom.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                  Email
                </label>
                <Input
                  type="email"
                  value={formState.email}
                  onChange={(event) =>
                    setFormState((previousState) => ({ ...previousState, email: event.target.value }))
                  }
                  placeholder="korisnik@trackpal.app"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                  Lozinka
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                  <Input
                    type="password"
                    value={formState.password}
                    onChange={(event) =>
                      setFormState((previousState) => ({ ...previousState, password: event.target.value }))
                    }
                    placeholder={editingUserId ? 'Ostavi prazno za zadrzavanje lozinke' : 'Unesi privremenu lozinku'}
                    className="pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                  Rola
                </label>
                <RoleSelect
                  value={formState.role_name}
                  onChange={(role) =>
                    setFormState((previousState) => ({
                      ...previousState,
                      role_name: role,
                    }))
                  }
                />
              </div>

              {errorMessage && (
                <div className="px-4 py-3 rounded-2xl border border-rose-100 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-[0.14em]">
                  {errorMessage}
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={resetForm}>
                  Reset
                </Button>
                <Button type="submit" className="flex-[1.35]" disabled={isSaving}>
                  {editingUserId ? 'Sacuvaj izmjene' : 'Dodaj korisnika'}
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Napomena">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    Vizualni demo
                  </p>
                  <p className="text-[12px] font-bold text-zinc-700 leading-relaxed mt-1">
                    Ovaj ekran radi samo na frontendu i koristi dummy podatke sacuvane u browser
                    `localStorage`.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Aktivna sesija</p>
                <p className="text-sm font-black uppercase tracking-tight text-zinc-900 mt-1">
                  {currentUser.email}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 mt-2">
                  Aktivni admin nalog nije moguce urediti ili obrisati iz ovog prikaza.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
