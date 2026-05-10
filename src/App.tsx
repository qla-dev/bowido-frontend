/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Sidebar, BottomNav, TopNavbar } from './components/Navigation';
import { AdminDashboard } from './components/AdminDashboard';
import { WorkerDashboard } from './components/WorkerDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { ServiceDashboard } from './components/ServiceDashboard';
import { PalletScanner } from './components/PalletScanner';
import { GhostPalletCenter } from './components/GhostPalletCenter';
import { ManagedUser, RoleType, User } from './types';
import { mockUsers } from './lib/mockData';
import { ChevronDown, Languages, LogIn, Moon, Package, Smartphone, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './AppContext';
import { Card, Select } from './components/ui';
import { apiService } from './services/api';
import { getRoleLabel, languageOptions } from './i18n';

export default function App() {
  const { t, language, setLanguage, isScannerOpen, setIsScannerOpen, isGhostReportOpen, setIsGhostReportOpen } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginUsers, setLoginUsers] = useState<User[]>(mockUsers);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNightMode, setIsNightMode] = useState(false);

  const loadLoginUsers = async () => {
    try {
      const storedUsers = await apiService.users.list();
      setLoginUsers(storedUsers.map(({ password, ...user }: ManagedUser) => user));
    } catch (error) {
      console.error('Failed to load demo users', error);
      setLoginUsers(mockUsers);
    }
  };

  useEffect(() => {
    void loadLoginUsers();
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
    setIsGhostReportOpen(false);
    void loadLoginUsers();
  };

  if (!currentUser) {
    return (
      <div className={isNightMode ? 'dark' : ''}>
        <div
          id="login-screen"
          className={`min-h-screen flex flex-col items-center justify-center p-6 font-sans transition-colors ${
            isNightMode ? 'bg-[#05110c] text-emerald-50' : 'bg-white text-emerald-900'
          }`}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-12"
          >
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 bg-[#00A655] rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-900/20">
                  <Package className="text-white" size={40} />
                </div>
                <div className="absolute -top-3 -right-3 flex items-center gap-2">
                  <div className="relative">
                    <Languages
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                    />
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none"
                    />
                    <select
                      value={language}
                      onChange={(event) => setLanguage(event.target.value as typeof language)}
                      className="h-10 pl-9 pr-8 rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-lg text-[10px] font-black uppercase tracking-[0.14em] appearance-none outline-none transition-all hover:border-emerald-300 focus:border-[#00A655] dark:bg-[#0f1f17] dark:border-white/10 dark:text-white"
                      aria-label={t('language')}
                    >
                      {languageOptions.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.nativeLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNightMode((previousState) => !previousState)}
                    className="h-10 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-lg flex items-center justify-center transition-all hover:border-emerald-300 hover:text-emerald-700 dark:bg-[#0f1f17] dark:border-white/10 dark:text-zinc-200 dark:hover:text-emerald-200"
                    title={t('nightMode')}
                  >
                    {isNightMode ? <Sun size={17} /> : <Moon size={17} />}
                  </button>
                </div>
              </div>
              <div className="text-center space-y-2">
                <h1 className="text-5xl font-black tracking-tighter uppercase font-display">trackpal</h1>
                <p className="text-zinc-500 dark:text-zinc-400 font-black uppercase tracking-[0.3em] text-[10px]">
                  {t('loginSubtitle')}
                </p>
              </div>
            </div>

            <Card title={t('welcome')} noPadding>
              <div className="p-8 space-y-6">
                <div className="space-y-1 text-center">
                  <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                    {t('selectRolePreview')}
                  </p>
                </div>

                <div className="space-y-3">
                  {loginUsers.map((user) => (
                    <button
                      id={`login-${user.role_name.toLowerCase()}`}
                      key={user.id}
                      onClick={() => setCurrentUser(user)}
                      className="w-full group flex items-center justify-between p-5 bg-zinc-50 rounded-2xl border border-zinc-200 hover:border-[#00A655] transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/5 active:scale-95 dark:bg-[#11231b] dark:border-white/10 dark:hover:border-[#00A655]"
                    >
                      <div className="flex flex-col items-start">
                        <span className="font-black text-xs uppercase tracking-tight text-emerald-900 font-display dark:text-white">
                          {getRoleLabel(user.role_name, language)}
                        </span>
                        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">
                          {user.email}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white border border-zinc-200 rounded-xl group-hover:bg-[#00A655] group-hover:text-white group-hover:border-[#00A655] transition-all shadow-sm dark:bg-[#0c1a13] dark:border-white/10">
                        <LogIn size={18} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <div className="flex flex-col items-center gap-4 pt-8 border-t border-zinc-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {t('mobileResponsiveReady')}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const renderDashboard = () => {
    if (activeTab === 'settings' && currentUser.role_name !== RoleType.ADMIN) {
      return (
        <Card title={t('settings')} className="w-full">
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-900 font-display dark:text-white">{currentUser.name}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{currentUser.email}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 text-left dark:bg-emerald-900/20 dark:border-emerald-500/20">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                  {t('language')}
                </span>
                <div className="mt-3">
                  <Select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
                    {languageOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.nativeLabel}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNightMode(!isNightMode)}
                className="p-4 rounded-2xl border border-emerald-100 bg-white text-left hover:border-emerald-300 transition-colors dark:bg-[#0f1f17] dark:border-white/10"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                  {t('nightMode')}
                </span>
                <p className="text-lg font-black uppercase text-emerald-900 font-display dark:text-white">
                  {isNightMode ? t('on') : t('off')}
                </p>
              </button>
            </div>
          </div>
        </Card>
      );
    }

    switch (currentUser.role_name) {
      case RoleType.ADMIN: {
        const adminTabsMap: Record<string, 'overview' | 'pallets' | 'clients' | 'users' | 'settings' | 'logs' | 'billing' | 'roles' | 'calendar'> = {
          dashboard: 'overview',
          pallets: 'pallets',
          calendar: 'calendar',
          users: 'clients',
          korisnici: 'users',
          roles: 'roles',
          invoices: 'billing',
          settings: 'settings',
        };
        const view = adminTabsMap[activeTab] || 'overview';
        return <AdminDashboard initialView={view} user={currentUser} />;
      }
      case RoleType.VOZAC:
      case RoleType.MAGACINER:
        return <WorkerDashboard role={currentUser.role_name} user={currentUser} />;
      case RoleType.KLIJENT:
        return <ClientDashboard user={currentUser} activeTab={activeTab} />;
      case RoleType.SERVISER:
        return <ServiceDashboard user={currentUser} />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <div
      id="app-container"
      className={`min-h-screen bg-white text-emerald-900 font-sans selection:bg-[#00A655] selection:text-white transition-colors ${isNightMode ? 'dark' : ''}`}
    >
      <TopNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={currentUser.role_name}
        user={currentUser}
        onLogout={handleLogout}
        isNightMode={isNightMode}
        onToggleNightMode={() => setIsNightMode(!isNightMode)}
      />

      <div className="flex flex-col md:flex-row min-h-screen pt-16 bg-white dark:bg-transparent">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        role={currentUser.role_name} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 h-[calc(100vh-4rem)] bg-white overflow-y-auto pb-28 md:pb-0 relative scroll-smooth no-scrollbar md:no-scrollbar dark:bg-transparent">
        <div className="w-full bg-white p-4 sm:p-5 md:p-6 lg:p-8 dark:bg-transparent">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentUser.id}-${activeTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {renderDashboard()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <BottomNav 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        role={currentUser.role_name} 
        onLogout={handleLogout} 
      />
      </div>

      <AnimatePresence>
        {isScannerOpen && currentUser && (
          <PalletScanner 
            currentUser={currentUser} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}

        {isGhostReportOpen && currentUser && currentUser.role_name !== RoleType.SERVISER && (
          <GhostPalletCenter
            currentUser={currentUser}
            onClose={() => setIsGhostReportOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
