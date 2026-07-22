import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldCheck, Plus, Edit2, X, Check, Trash2, Search } from 'lucide-react';
import { useApp } from '../AppContext';
import { Button, Card, Input, Badge, cn } from './ui';
import { Permission, Role } from '../types';
import { getPermissionDescription, getPermissionLabel, getRoleDescription } from '../i18n';
import { InfiniteScrollFooter } from './InfiniteScrollFooter';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService } from '../services/api';
import { useInfinitePagination } from '../hooks/useInfinitePagination';

const ROLE_PAGE_SIZE = 10;

export const RoleManager: React.FC = () => {
  const { permissions: cachedPermissions, addRole, updateRole, deleteRole, t, language } = useApp();
  const [permissions, setPermissions] = useState<Permission[]>(cachedPermissions);
  const [isEditing, setIsEditing] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<Role> | null>(null);
  const [pendingDeleteRole, setPendingDeleteRole] = useState<Role | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  useEffect(() => {
    if (cachedPermissions.length > 0) {
      setPermissions(cachedPermissions);
      return;
    }
    void apiService.permissions.list().then(setPermissions).catch(() => setError(t('rolesLoadError')));
  }, [cachedPermissions, t]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchPage = useCallback((offset: number) => apiService.roles.page({
    limit: ROLE_PAGE_SIZE,
    offset,
    search: debouncedSearchQuery || undefined,
  }), [debouncedSearchQuery]);
  const { items: roles, hasMore, isInitialLoading, isLoadingMore, error: paginationError, loadMore, retry } = useInfinitePagination({
    queryKey: `${debouncedSearchQuery}|${reloadKey}`,
    pageSize: ROLE_PAGE_SIZE,
    fetchPage,
  });

  const handleSave = async () => {
    if (!currentRole?.name) return;

    setIsSaving(true);
    setError(null);

    try {
      if (currentRole.id) {
        await updateRole(currentRole as Role);
      } else {
        await addRole({
          name: currentRole.name || '',
          description: currentRole.description || '',
          permissions: currentRole.permissions || [],
          role_permissions: currentRole.role_permissions || [],
        });
      }

      setReloadKey((current) => current + 1);
      setIsEditing(false);
      setCurrentRole(null);
    } catch {
      setError(t('roleSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteRole) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteRole(pendingDeleteRole.id);
      setReloadKey((current) => current + 1);
      setPendingDeleteRole(null);
    } catch {
      setError(t('roleDeleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePermission = (permId: number) => {
    const currentPerms = currentRole?.permissions || [];
    const newPerms = currentPerms.includes(permId)
      ? currentPerms.filter(id => id !== permId)
      : [...currentPerms, permId];
    
    setCurrentRole(prev => ({
      ...prev,
      permissions: newPerms,
      role_permissions: newPerms.includes(permId)
        ? [
            ...(prev?.role_permissions || []).filter(grant => grant.module_id !== permId),
            prev?.role_permissions?.find(grant => grant.module_id === permId) || {
              module_id: permId, can_list: true, can_view: true, can_create: true, can_update: true, can_delete: true,
              scope: permissions.find(permission => permission.id === permId)?.code === 'image_gallery' ? 'all' : undefined,
            },
          ]
        : (prev?.role_permissions || []).filter(grant => grant.module_id !== permId),
    }));
  };

  const setGalleryScope = (moduleId: number, scope: 'all' | 'warehouse_nl' | 'warehouse_bih') => {
    setCurrentRole(previous => ({
      ...previous,
      role_permissions: (previous?.role_permissions || []).map(grant => grant.module_id === moduleId ? {...grant, scope} : grant),
    }));
  };

  const toggleAbility = (moduleId: number, ability: 'can_list' | 'can_view' | 'can_create' | 'can_update' | 'can_delete') => {
    setCurrentRole(previous => ({
      ...previous,
      role_permissions: (previous?.role_permissions || []).map(grant => grant.module_id === moduleId ? {...grant, [ability]: !grant[ability]} : grant),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 px-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-black">{t('manageRoles')}</h2>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-loose">
            {t('defineAccessLevels')}
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchRoles')}
              className="h-10 bg-white pl-10 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal"
            />
          </div>
          <Button
            onClick={() => {
              setCurrentRole({ name: '', description: '', permissions: [] });
              setIsEditing(true);
            }}
          >
            <Plus size={14} className="mr-2" /> {t('addRole')}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">
          {error}
        </div>
      )}

      <PageLoadingModal isOpen={isInitialLoading} language={language} />

      {!isInitialLoading && roles.length === 0 && (
        <Card>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
            {t('noRolesFound')}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roles.map((role) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
          >
            <Card noPadding className="group hover:border-black transition-all">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center group-hover:bg-black transition-all">
                    <Shield className="text-zinc-300 group-hover:text-white" size={20} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setCurrentRole(role);
                        setIsEditing(true);
                      }}
                      title={t('editRole')}
                      aria-label={t('editRole')}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setPendingDeleteRole(role)}
                      className="text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:bg-rose-600 dark:text-white dark:hover:bg-rose-700 dark:hover:text-white"
                      title={t('deleteRole')}
                      aria-label={t('deleteRole')}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>

                <h3 className="text-base font-black text-black uppercase tracking-tight mb-1">{role.name}</h3>
                <p className="text-[10px] text-zinc-500 font-bold mb-6 line-clamp-2 uppercase tracking-wide">{getRoleDescription(role.description, language)}</p>

                <div className="space-y-3">
                  <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-300">{t('permissions')} ({role.permissions.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.slice(0, 3).map(pid => {
                      const p = permissions.find(p => p.id === pid);
                      return p ? (
                        <Badge key={pid} variant="default">
                          {getPermissionLabel(p, language)}
                        </Badge>
                      ) : null;
                    })}
                    {role.permissions.length > 3 && (
                      <Badge variant="default">
                        +{role.permissions.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <InfiniteScrollFooter hasMore={hasMore} isLoading={isLoadingMore} error={paginationError} onLoadMore={loadMore} onRetry={retry} language={language} />

      <AnimatePresence>
        {pendingDeleteRole && (
          <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-md"
            >
              <Card noPadding className="shadow-2xl">
                <div className="p-6 border-b-2 border-zinc-50 flex justify-between items-center bg-zinc-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-rose-600 rounded-xl flex items-center justify-center text-white">
                      <Trash2 size={18} />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-black">
                      {t('deleteRole')}
                    </h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPendingDeleteRole(null)}>
                    <X size={20} />
                  </Button>
                </div>

                <div className="p-6 space-y-3">
                  <p className="text-sm font-black uppercase tracking-tight text-zinc-900">
                    {pendingDeleteRole.name}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    {t('confirmDeleteRole')}
                  </p>
                </div>

                <div className="p-6 bg-zinc-50/30 border-t-2 border-zinc-50 flex gap-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setPendingDeleteRole(null)}
                    disabled={isDeleting}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? t('deleting') : t('remove')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {isEditing && (
          <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-2xl"
            >
              <Card noPadding className="shadow-2xl">
                <div className="p-6 border-b-2 border-zinc-50 flex justify-between items-center bg-zinc-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center text-white">
                      <ShieldCheck size={18} />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-black">
                      {currentRole?.id ? t('editRole') : t('addRole')}
                    </h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                    <X size={20} />
                  </Button>
                </div>

                <div className="p-6 space-y-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">{t('roleName')}</label>
                      <Input 
                        value={currentRole?.name || ''}
                        onChange={(e) => setCurrentRole(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t('roleNamePlaceholder')}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">{t('roleDescription')}</label>
                      <textarea 
                        className="w-full bg-zinc-50 border-2 border-transparent focus:border-black rounded-2xl px-6 py-4 text-[11px] font-bold outline-none transition-all resize-none h-24 placeholder:text-zinc-300"
                        value={currentRole?.description || ''}
                        onChange={(e) => setCurrentRole(prev => ({ ...prev, description: e.target.value }))}
                        placeholder={t('roleDescriptionPlaceholder')}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">{t('permissionList')}</label>
                    <div className="grid grid-cols-1 gap-2">
                      {permissions.map((perm) => (
                        <React.Fragment key={perm.id}>
                        <div 
                          onClick={() => togglePermission(perm.id)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all",
                            currentRole?.permissions?.includes(perm.id) 
                              ? "bg-black border-black text-white" 
                              : "bg-zinc-50 border-transparent hover:border-zinc-200"
                          )}
                        >
                          <div>
                            <p className="font-black text-xs uppercase tracking-tight">{getPermissionLabel(perm, language)}</p>
                            <p className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              currentRole?.permissions?.includes(perm.id) ? "text-zinc-400" : "text-zinc-300"
                            )}>
                              {getPermissionDescription(perm, language)}
                            </p>
                          </div>
                          {currentRole?.permissions?.includes(perm.id) && <Check size={16} />}
                        </div>
                        {currentRole?.permissions?.includes(perm.id) && (
                          <div className="mx-2 grid grid-cols-5 gap-1">
                            {(['can_list','can_view','can_create','can_update','can_delete'] as const).map(ability => {
                              const enabled = currentRole.role_permissions?.find(grant => grant.module_id === perm.id)?.[ability] ?? true;
                              return <button key={ability} type="button" onClick={() => toggleAbility(perm.id, ability)} className={cn('rounded-lg px-1 py-2 text-[8px] font-black uppercase', enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-400')}>{ability.replace('can_','')}</button>;
                            })}
                          </div>
                        )}
                        {perm.code === 'image_gallery' && currentRole?.permissions?.includes(perm.id) && (
                          <select value={currentRole.role_permissions?.find(grant => grant.module_id === perm.id)?.scope || 'all'} onChange={event => setGalleryScope(perm.id, event.target.value as 'all' | 'warehouse_nl' | 'warehouse_bih')} className="mx-2 mb-2 h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold">
                            <option value="all">{t('allImages')}</option>
                            <option value="warehouse_nl">Bowido NL</option><option value="warehouse_bih">Bowido BiH</option>
                          </select>
                        )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-zinc-50/30 border-t-2 border-zinc-50 flex gap-4">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsEditing(false)}
                  >
                    {t('cancel')}
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? t('roleSaving') : t('save')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
