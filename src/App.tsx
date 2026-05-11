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
import { Card, Select, cn } from './components/ui';
import { apiService } from './services/api';
import logoImage from './assets/logo.png';
import { getRoleLabel, languageOptions } from './i18n';

const AppFooter = ({ className }: { className?: string }) => {
  const { t } = useApp();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'w-full shrink-0 bg-white/95 backdrop-blur-xl dark:bg-[#17291f]/94',
        className
      )}
    >
      <div className="flex min-h-16 w-full flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
        <div className="flex min-w-[118px] shrink-0 items-center gap-3">
          <img src={logoImage} alt="Trackpal logo" className="h-6 w-auto max-w-[118px] shrink-0 object-contain object-left opacity-50 sm:h-7 sm:max-w-[132px]" />
        </div>

        <div className="w-full text-left sm:ml-auto sm:w-auto sm:text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-300">
            {t('footerTagline')}
          </p>
          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
            © {currentYear} Bowido · {t('footerRights')} · {t('footerRegion')}
          </p>
        </div>
      </div>
    </footer>
  );
};

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
    <div
      id="login-screen"
      className="min-h-screen bg-white flex flex-col text-emerald-900 font-sans"
    >
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md space-y-12"
        >
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="flex items-center justify-center">
                <img src={logoImage} alt="Logo" className="h-12 w-auto" />
              </div>
            </div>
          </div>

          <Card title={t('welcome') || 'System Login'} noPadding>
            <div className="p-8 space-y-6 text-center">
              <div className="space-y-1 text-center">
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                  {t('loggedAs') === 'Logged as'
                    ? 'Select a role to preview'
                    : 'Odaberite ulogu'}
                </p>
              </div>

              <div className="space-y-3">
                {loginUsers.map((user) => (
                  <button
                    id={`login-${user.role_name.toLowerCase()}`}
                    key={user.id}
                    onClick={() => setCurrentUser(user)}
                    className="w-full group flex items-center justify-between p-5 bg-zinc-50 rounded-2xl border border-zinc-200 hover:border-[#00A655] transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/5 active:scale-95 dark:bg-[#1a3327] dark:border-white/10 dark:hover:border-[#00A655]"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-black text-xs uppercase tracking-tight text-emerald-900 font-display dark:text-white">
                        {getRoleLabel(user.role_name, language)}
                      </span>
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest">
                        {user.email}
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl group-hover:bg-[#00A655] group-hover:text-white group-hover:border-[#00A655] transition-all shadow-sm dark:bg-[#234437] dark:border-white/10">
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
      <AppFooter />
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
                className="p-4 rounded-2xl border border-emerald-100 bg-white text-left hover:border-emerald-300 transition-colors dark:bg-[#1a3327] dark:border-white/10"
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
          'audit-logs': 'logs',
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
        return <ClientDashboard user={currentUser} activeTab={activeTab} onNavigateHome={() => setActiveTab('dashboard')} />;
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

      <div className="flex flex-col md:flex-row min-h-screen pt-28 md:pt-16 bg-white dark:bg-transparent">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        role={currentUser.role_name} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 h-[calc(100vh-7rem)] md:h-[calc(100vh-4rem)] bg-white overflow-y-auto pb-28 md:pb-0 relative scroll-smooth no-scrollbar md:no-scrollbar dark:bg-transparent flex flex-col">
        <div className="w-full flex-1 bg-white p-4 sm:p-5 md:p-6 lg:p-8 dark:bg-transparent">
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
        <AppFooter className="mt-auto" />
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
