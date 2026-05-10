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
import { useApp } from '../AppContext';
import { getRoleLabel, getRolePermissions } from '../i18n';
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

interface RoleSelectProps {
  value: RoleType;
  onChange: (role: RoleType) => void;
}

const RoleSelect: React.FC<RoleSelectProps> = ({ value, onChange }) => {
  const { t, language } = useApp();
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
  const previewPermissions = getRolePermissions(previewRole, language);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((previousState) => !previousState)}
        className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:border-[#00A655] hover:bg-white transition-all flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge className={cn('border shrink-0', roleBadgeClasses[value])}>
            {getRoleLabel(value, language)}
          </Badge>
          <div className="min-w-0 text-left">
            <p className="text-[11px] font-black uppercase tracking-tight text-zinc-900 truncate">
              {getRolePermissions(value, language).length} {t('permissionsAvailable')}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 truncate">
              {t('hoverForAccessPreview')}
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
                          <p className="text-[11px] font-black uppercase tracking-tight truncate">
                            {getRoleLabel(role, language)}
                          </p>
                          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400 truncate">
                            {getRolePermissions(role, language).length} {t('permissionsAvailable')}
                          </p>
                        </div>
                        {isSelected && (
                          <Badge variant="success" className="shrink-0">
                            {t('activeLabel')}
                          </Badge>
                        )}
                      </button>

                      {hoveredRole === role && (
                        <div className="hidden xl:block pointer-events-none absolute right-full mr-3 top-1/2 -translate-y-1/2 w-60 rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl shadow-emerald-950/10">
                          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-600">
                            {getRoleLabel(role, language)}
                          </p>
                          <p className="text-[11px] font-bold text-zinc-700 mt-2 mb-3">
                            {t('dummyRoleActions')}
                          </p>
                          <div className="space-y-2">
                            {getRolePermissions(role, language).map((permission) => (
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
                  {getRoleLabel(previewRole, language)}
                </p>
                <p className="text-[11px] font-bold text-zinc-700 mt-2 mb-3">
                  {t('dummyHoverPermissions')}
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
  const { t, language } = useApp();
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
      setErrorMessage(t('usersCannotLoad'));
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
      setErrorMessage(t('activeSessionCannotEdit'));
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
      setErrorMessage(t('activeSessionCannotDelete'));
      return;
    }

    if (users.length === 1) {
      setErrorMessage(t('lastDemoUserMustRemain'));
      return;
    }

    const shouldDelete = window.confirm(`${t('deleteUserConfirm')} ${user.email}?`);

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
      setErrorMessage(t('emailRequired'));
      return;
    }

    if (!editingUserId && !trimmedPassword) {
      setErrorMessage(t('passwordRequiredNew'));
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
      setErrorMessage(t('changesNotSaved'));
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
        <StatCard label={t('totalUsers')} value={users.length} />
        <StatCard label={t('adminAccess')} value={adminCount} variant="success" />
        <StatCard label={t('activeRolesLabel')} value={activeRoles} variant="info" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.6fr)_380px] gap-6 items-start">
        <Card
          title={t('systemUsers')}
          noPadding
          action={
            <Button variant="ghost" size="xs" onClick={() => void loadUsers()}>
              <RefreshCw size={12} className="mr-2" />
              {t('refresh')}
            </Button>
          }
        >
          <div className="p-5 border-b border-zinc-100 bg-zinc-50/60 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">{t('frontendOnly')}</p>
              <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-950 font-display">
                {t('demoAccountsDirectory')}
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={t('searchEmailNameRole')}
                  className="pl-11 bg-white"
                />
              </div>

              <div className="w-full sm:w-52">
                <Select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value as 'all' | RoleType)}
                  className="bg-white"
                >
                  <option value="all">{t('allRoles')}</option>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {getRoleLabel(role, language)}
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
                  <th className="px-6 py-4">{t('user')}</th>
                  <th className="px-6 py-4">{t('role')}</th>
                  <th className="px-6 py-4">{t('access')}</th>
                  <th className="px-6 py-4 text-right">{t('actions')}</th>
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
                          {getRoleLabel(user.role_name, language)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {isCurrentSession ? (
                          <Badge variant="success">{t('activeSessionBadge')}</Badge>
                        ) : (
                          <Badge variant="default">{t('demoAccount')}</Badge>
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
                            {t('editUser')}
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
                            {t('remove')}
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
                      {getRoleLabel(user.role_name, language)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-4 mt-4 border-t border-zinc-100">
                    {isCurrentSession ? (
                      <Badge variant="success">{t('activeSessionBadge')}</Badge>
                    ) : (
                      <Badge variant="default">{t('demoAccount')}</Badge>
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
              <h3 className="text-lg font-black uppercase tracking-tight text-zinc-900">{t('noResults')}</h3>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-400 mt-2">
                {t('changeSearchTryAgain')}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="p-10 text-center border-t border-zinc-100">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">
                {t('loadingUsers')}
              </p>
            </div>
          )}
        </Card>

        <div className="space-y-6 xl:sticky xl:top-24">
          <Card title={editingUserId ? t('editUser') : t('createUser')}>
            <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/70">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00A655] text-white flex items-center justify-center shrink-0">
                    {editingUserId ? <ShieldCheck size={18} /> : <UserPlus size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      {editingUserId ? t('accountUpdate') : t('newDemoAccount')}
                    </p>
                    <p className="text-[12px] font-bold text-emerald-900 leading-relaxed mt-1">
                      {editingUserId
                        ? t('updateUserDescription')
                        : t('createUserDescription')}
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
                  {t('password')}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" size={16} />
                  <Input
                    type="password"
                    value={formState.password}
                    onChange={(event) =>
                      setFormState((previousState) => ({ ...previousState, password: event.target.value }))
                    }
                    placeholder={editingUserId ? t('keepPasswordHint') : t('newPasswordHint')}
                    className="pl-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
                  {t('role')}
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
                  {t('reset')}
                </Button>
                <Button type="submit" className="flex-[1.35]" disabled={isSaving}>
                  {editingUserId ? t('saveChanges') : t('addUser')}
                </Button>
              </div>
            </form>
          </Card>

          <Card title={t('note')}>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    {t('visualDemo')}
                  </p>
                  <p className="text-[12px] font-bold text-zinc-700 leading-relaxed mt-1">
                    {t('frontendOnlyStorage')}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{t('activeSession')}</p>
                <p className="text-sm font-black uppercase tracking-tight text-zinc-900 mt-1">
                  {currentUser.email}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-400 mt-2">
                  {t('currentSessionReadOnly')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
