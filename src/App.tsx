/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Sidebar, BottomNav, TopNavbar } from './components/Navigation';
import { AdminDashboard } from './components/AdminDashboard';
import { WorkerDashboard } from './components/WorkerDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { ClientTableView } from './components/ClientTableView';
import { ServiceDashboard } from './components/ServiceDashboard';
import { PalletScanner } from './components/PalletScanner';
import { GhostPalletCenter } from './components/GhostPalletCenter';
import { DriverMobileDashboard } from './components/DriverMobileDashboard';
import { RoleMobileShell } from './components/RoleMobileShell';
import { ManagedUser, RoleType, User } from './types';
import { LogIn, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './AppContext';
import { Card, Select, cn } from './components/ui';
import { apiService } from './services/api';
import logoImage from './assets/logo.png';
import { getRoleLabel, languageOptions } from './i18n';

const CURRENT_USER_STORAGE_KEY = 'trackpal_current_user';

const readStoredCurrentUser = (): User | null => {
  if (typeof window === 'undefined' || !apiService.hasToken()) {
    return null;
  }

  try {
    const storedUser = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) as User : null;
  } catch {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return null;
  }
};

const storeCurrentUser = (user: User | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (user) {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
};

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
  const { t, language, setLanguage, isScannerOpen, setIsScannerOpen, isGhostReportOpen, setIsGhostReportOpen, refreshData, resetData } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(() => readStoredCurrentUser());
  const [isRestoringSession, setIsRestoringSession] = useState(() => apiService.hasToken() && !readStoredCurrentUser());
  const [loginUsers, setLoginUsers] = useState<User[]>([]);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingInUserId, setLoggingInUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNightMode, setIsNightMode] = useState(false);
  const [pendingPalletDetailId, setPendingPalletDetailId] = useState<number | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(max-width: 767px)').matches;
  });

  const loadLoginUsers = async () => {
    try {
      const storedUsers = await apiService.users.loginOptions();
      setLoginUsers(storedUsers.map(({ password, ...user }: ManagedUser) => user));
    } catch (error) {
      console.error('Failed to load login users', error);
      setLoginUsers([]);
    }
  };

  useEffect(() => {
    if (!currentUser) {
      void loadLoginUsers();
    }
  }, []);

  useEffect(() => {
    if (!apiService.hasToken()) {
      storeCurrentUser(null);
      setIsRestoringSession(false);
      return;
    }

    let isMounted = true;
    const hadStoredUser = Boolean(currentUser);

    if (hadStoredUser) {
      void refreshData();
    }

    const restoreSession = async () => {
      try {
        const restoredUser = await apiService.auth.me();

        if (!isMounted) {
          return;
        }

        setCurrentUser(restoredUser);
        storeCurrentUser(restoredUser);

        if (!hadStoredUser) {
          void refreshData();
        }
      } catch (error) {
        console.error('Failed to restore session', error);

        if (!isMounted) {
          return;
        }

        apiService.clearToken();
        storeCurrentUser(null);
        setCurrentUser(null);
        resetData();
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncMobileViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMobileViewport);
      return () => mediaQuery.removeEventListener('change', syncMobileViewport);
    }

    mediaQuery.addListener(syncMobileViewport);
    return () => mediaQuery.removeListener(syncMobileViewport);
  }, []);

  const isDriverShell = currentUser?.role_name === RoleType.VOZAC;
  const usesRoleMobileShell =
    Boolean(currentUser) &&
    (isDriverShell || isMobileViewport);
  const usesFixedMobileShell = false;
  const usesInternalScrollShell = Boolean(currentUser) && (usesRoleMobileShell || usesFixedMobileShell);
  const chromeTintColor = usesRoleMobileShell ? '#00A655' : isNightMode ? '#17291f' : '#ffffff';

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('bowido-mobile-shell-active');

    return () => {
      root.classList.remove('bowido-mobile-shell-active');
    };
  }, [usesInternalScrollShell]);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('bowido-ios-tint-refresh');

    const rafId = window.requestAnimationFrame(() => {
      root.classList.remove('bowido-ios-tint-refresh');
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      root.classList.remove('bowido-ios-tint-refresh');
    };
  }, [activeTab, chromeTintColor, currentUser?.id, usesInternalScrollShell]);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [usesInternalScrollShell]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const rootElement = document.getElementById('root');
    const previousThemeColor = themeColorMeta?.getAttribute('content') ?? null;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousRootBackground = rootElement?.style.backgroundColor ?? '';

    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', chromeTintColor);
    }

    document.documentElement.style.backgroundColor = chromeTintColor;
    document.body.style.backgroundColor = chromeTintColor;

    if (rootElement) {
      rootElement.style.backgroundColor = chromeTintColor;
    }

    return () => {
      if (themeColorMeta) {
        if (previousThemeColor === null) {
          themeColorMeta.removeAttribute('content');
        } else {
          themeColorMeta.setAttribute('content', previousThemeColor);
        }
      }

      document.documentElement.style.backgroundColor = previousHtmlBackground;
      document.body.style.backgroundColor = previousBodyBackground;

      if (rootElement) {
        rootElement.style.backgroundColor = previousRootBackground;
      }
    };
  }, [chromeTintColor]);

  const handleLogin = async (user: User) => {
    setLoginError(null);
    setLoggingInUserId(user.id);

    try {
      const result = await apiService.auth.loginDemoUser(user);
      setCurrentUser(result.user);
      storeCurrentUser(result.user);
      void refreshData();
    } catch (error) {
      console.error('Failed to login', error);
      setLoginError(
        language === 'bs'
          ? 'Prijava nije uspjela. Provjeri backend i seed podatke.'
          : language === 'nl'
            ? 'Inloggen is mislukt. Controleer de backend en seeddata.'
            : 'Login failed. Check the backend and seed data.'
      );
    } finally {
      setLoggingInUserId(null);
    }
  };

  const handleLogout = () => {
    void apiService.auth.logout();
    setCurrentUser(null);
    storeCurrentUser(null);
    setActiveTab('dashboard');
    setIsGhostReportOpen(false);
    resetData();
    void loadLoginUsers();
  };

 if (isRestoringSession && !currentUser) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-emerald-900">
      <div className="text-center">
        <img src={logoImage} alt="Trackpal logo" className="mx-auto h-12 w-auto" />
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
          {language === 'bs' ? 'Učitavanje sesije' : language === 'nl' ? 'Sessie laden' : 'Loading session'}
        </p>
      </div>
    </div>
  );
}

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
                    onClick={() => void handleLogin(user)}
                    disabled={loggingInUserId !== null}
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
                      <LogIn size={18} className={loggingInUserId === user.id ? 'animate-pulse' : ''} />
                    </div>
                  </button>
                ))}
              </div>

              {loginUsers.length === 0 && (
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">
                  {language === 'bs'
                    ? 'Nema korisnika za prijavu iz baze.'
                    : language === 'nl'
                      ? 'Geen login-gebruikers gevonden in de database.'
                      : 'No database login users found.'}
                </p>
              )}

              {loginError && (
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">
                  {loginError}
                </p>
              )}
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
    if (activeTab === 'settings' && (currentUser.role_name !== RoleType.ADMIN || usesRoleMobileShell)) {
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

    if (activeTab === 'client-table' && currentUser.role_name === RoleType.KLIJENT) {
      return (
        <Card title={language === 'bs' ? 'Pregled podataka o klijentu' : language === 'nl' ? 'Klantgegevens overzicht' : 'Client Data Overview'} className="w-full">
          <ClientTableView clientIdFilter={currentUser.id} />
        </Card>
      );
    }

    if (usesRoleMobileShell) {
      return <DriverMobileDashboard user={currentUser} />;
    }

    switch (currentUser.role_name) {
      case RoleType.ADMIN: {
        const adminTabsMap: Record<string, 'overview' | 'pallets' | 'clients' | 'users' | 'settings' | 'logs' | 'billing' | 'roles' | 'calendar' | 'noQrPallets' | 'clientManager' | 'adminService' | 'adminWarehouse' | 'adminFinance'> = {
          dashboard: 'overview',
          pallets: 'pallets',
          'no-qr-pallets': 'noQrPallets',
          calendar: 'calendar',
          'audit-logs': 'logs',
          users: 'clients',
          'client-manager': 'clientManager',
          'admin-service': 'adminService',
          'admin-warehouse': 'adminWarehouse',
          'admin-finance': 'adminFinance',
          korisnici: 'users',
          roles: 'roles',
          invoices: 'billing',
          settings: 'settings',
        };
        const view = adminTabsMap[activeTab] || 'overview';
        return (
          <AdminDashboard
            initialView={view}
            user={currentUser}
            isNightMode={isNightMode}
            onToggleNightMode={() => setIsNightMode(!isNightMode)}
            openPalletId={pendingPalletDetailId}
            onPalletDetailOpened={() => setPendingPalletDetailId(null)}
          />
        );
      }
      case RoleType.VOZAC:
        return <DriverMobileDashboard user={currentUser} />;
      case RoleType.MAGACINER:
        return <WorkerDashboard role={currentUser.role_name} user={currentUser} />;
      case RoleType.KLIJENT:
        return <ClientDashboard user={currentUser} activeTab={activeTab} onNavigateHome={() => setActiveTab('dashboard')} />;
      case RoleType.SERVISER:
        return <ServiceDashboard user={currentUser} />;
      default:
        return (
          <AdminDashboard
            user={currentUser}
            isNightMode={isNightMode}
            onToggleNightMode={() => setIsNightMode(!isNightMode)}
            openPalletId={pendingPalletDetailId}
            onPalletDetailOpened={() => setPendingPalletDetailId(null)}
          />
        );
    }
  };

  if (usesRoleMobileShell && currentUser) {
    return (
      <>
        <RoleMobileShell
          containerId="driver-app-container"
          sentinelVariant="driver"
          isNightMode={isNightMode}
          settingsTitle={t('settings')}
          logoutTitle={t('logout')}
          settingsActive={activeTab === 'settings'}
          palletActive={activeTab === 'client-table'}
          onToggleSettings={() => setActiveTab(activeTab === 'settings' ? 'dashboard' : 'settings')}
          onLogout={handleLogout}
          logoSrc={logoImage}
          bodyClassName={(activeTab === 'settings' || activeTab === 'client-table') ? 'px-4' : 'px-0'}
          showPalletIcon={currentUser.role_name === RoleType.KLIJENT}
          onPalletIconClick={() => setActiveTab(activeTab === 'client-table' ? 'dashboard' : 'client-table')}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentUser.id}-mobile-role-${activeTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex-1"
            >
              {renderDashboard()}
            </motion.div>
          </AnimatePresence>
        </RoleMobileShell>

        <AnimatePresence>
          {isScannerOpen && (
            <PalletScanner
              currentUser={currentUser}
              onClose={() => setIsScannerOpen(false)}
              onPalletDetected={
                currentUser.role_name === RoleType.ADMIN
                  ? (pallet) => {
                    setIsScannerOpen(false);
                  setActiveTab('pallets');
                  setPendingPalletDetailId(pallet.id);
                  }
                  : undefined
              }
            />
          )}

          {isGhostReportOpen && currentUser.role_name !== RoleType.SERVISER && (
            <GhostPalletCenter
              currentUser={currentUser}
              onClose={() => setIsGhostReportOpen(false)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div
      id="app-container"
      className={cn(
        'bg-white text-emerald-900 font-sans selection:bg-[#00A655] selection:text-white transition-colors',
        isNightMode && 'dark',
        usesFixedMobileShell ? 'fixed inset-0 flex flex-col overflow-hidden' : 'min-h-screen'
      )}
    >
      <div className="safari-tint-sentinel safari-tint-sentinel--app" aria-hidden="true" />
      <TopNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={currentUser.role_name}
        user={currentUser}
        onLogout={handleLogout}
      />

      <div
        className={cn(
          'flex flex-col md:flex-row bg-white dark:bg-transparent',
          usesFixedMobileShell ? 'min-h-0 flex-1 pt-28 md:pt-0' : 'min-h-screen pt-28 md:pt-0'
        )}
      >
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={currentUser.role_name} 
          onLogout={handleLogout} 
        />
      
        <main
          className={cn(
            'relative flex flex-1 flex-col bg-white dark:bg-transparent',
            usesFixedMobileShell
              ? 'min-h-0 overflow-y-auto overscroll-y-contain pb-[calc(env(safe-area-inset-bottom)+5.5rem)] scroll-smooth no-scrollbar'
              : 'h-[calc(100vh-7rem)] overflow-y-auto pb-24 scroll-smooth no-scrollbar md:h-screen md:pt-16 md:pb-0'
          )}
          style={usesFixedMobileShell ? { WebkitOverflowScrolling: 'touch' } : undefined}
        >
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
            onPalletDetected={
              currentUser.role_name === RoleType.ADMIN
                ? (pallet) => {
                  setIsScannerOpen(false);
                setActiveTab('pallets');
                setPendingPalletDetailId(pallet.id);
                }
                : undefined
            }
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
