import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldCheck, Plus, Edit2, X, Check } from 'lucide-react';
import { useApp } from '../AppContext';
import { Button, Card, Input, Badge, cn } from './ui';
import { Role } from '../types';

export const RoleManager: React.FC = () => {
  const { roles, permissions, addRole, updateRole, t } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [currentRole, setCurrentRole] = useState<Partial<Role> | null>(null);

  const handleSave = async () => {
    if (!currentRole?.name) return;

    if (currentRole.id) {
      await updateRole(currentRole as Role);
    } else {
      await addRole({
        name: currentRole.name || '',
        description: currentRole.description || '',
        permissions: currentRole.permissions || []
      });
    }
    setIsEditing(false);
    setCurrentRole(null);
  };

  const togglePermission = (permId: number) => {
    const currentPerms = currentRole?.permissions || [];
    const newPerms = currentPerms.includes(permId)
      ? currentPerms.filter(id => id !== permId)
      : [...currentPerms, permId];
    
    setCurrentRole(prev => ({ ...prev, permissions: newPerms }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tighter text-black">{t('manageRoles')}</h2>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-loose">
            Define system access levels and permissions
          </p>
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
                  <Button 
                    variant="ghost" 
                    size="xs"
                    onClick={() => {
                      setCurrentRole(role);
                      setIsEditing(true);
                    }}
                  >
                    <Edit2 size={14} />
                  </Button>
                </div>

                <h3 className="text-base font-black text-black uppercase tracking-tight mb-1">{role.name}</h3>
                <p className="text-[10px] text-zinc-500 font-bold mb-6 line-clamp-2 uppercase tracking-wide">{role.description}</p>

                <div className="space-y-3">
                  <h4 className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-300">{t('permissions')} ({role.permissions.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissions.slice(0, 3).map(pid => {
                      const p = permissions.find(p => p.id === pid);
                      return p ? (
                        <Badge key={pid} variant="default">
                          {p.name}
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

      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
                        placeholder="e.g. Master Logistics"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">{t('roleDescription')}</label>
                      <textarea 
                        className="w-full bg-zinc-50 border-2 border-transparent focus:border-black rounded-2xl px-6 py-4 text-[11px] font-bold outline-none transition-all resize-none h-24 placeholder:text-zinc-300"
                        value={currentRole?.description || ''}
                        onChange={(e) => setCurrentRole(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe the responsibilities of this role..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-2 block">{t('permissionList')}</label>
                    <div className="grid grid-cols-1 gap-2">
                      {permissions.map((perm) => (
                        <div 
                          key={perm.id}
                          onClick={() => togglePermission(perm.id)}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all",
                            currentRole?.permissions?.includes(perm.id) 
                              ? "bg-black border-black text-white" 
                              : "bg-zinc-50 border-transparent hover:border-zinc-200"
                          )}
                        >
                          <div>
                            <p className="font-black text-xs uppercase tracking-tight">{perm.name}</p>
                            <p className={cn(
                              "text-[10px] font-bold uppercase tracking-wider",
                              currentRole?.permissions?.includes(perm.id) ? "text-zinc-400" : "text-zinc-300"
                            )}>
                              {perm.description}
                            </p>
                          </div>
                          {currentRole?.permissions?.includes(perm.id) && <Check size={16} />}
                        </div>
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
                    className="flex-[2]"
                    onClick={handleSave}
                  >
                    {t('save')}
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
