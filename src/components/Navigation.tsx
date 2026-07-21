import React, { useEffect, useState } from 'react';
import { cn } from './ui';
import { 
  Menu, X, LayoutDashboard, QrCode, ClipboardList, Settings, 
  LogOut, Package, HelpCircle, Shield, Calendar as CalendarIcon,
  Bell, UserCircle, Ghost, History, Boxes, Building2, Wrench, Images,
  Moon, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RoleType, User } from '../types';
import { KnowledgeBase } from './KnowledgeBase';
import { useApp } from '../AppContext';
import { getRoleLabel, languageOptions } from '../i18n';
import logoImage from '../assets/logo.png';
import logoNightImage from '../assets/logo-night.png';

const SIDEBAR_PINNED_STORAGE_KEY = 'trackpal.sidebarPinnedState';
const SIDEBAR_RECENT_TOGGLE_STORAGE_KEY = 'trackpal.sidebarHoverEnabled';
const SIDEBAR_LEGACY_PINNED_STORAGE_KEY = 'trackpal.sidebarPinned';

const readStoredSidebarPinned = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const storedPinned = window.localStorage.getItem(SIDEBAR_PINNED_STORAGE_KEY);

    if (storedPinned !== null) {
      return storedPinned === 'true';
    }

    return window.localStorage.getItem(SIDEBAR_RECENT_TOGGLE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const storeSidebarPinned = (isPinned: boolean) => {
  try {
    window.localStorage.setItem(SIDEBAR_PINNED_STORAGE_KEY, String(isPinned));
    window.localStorage.removeItem(SIDEBAR_RECENT_TOGGLE_STORAGE_KEY);
    window.localStorage.removeItem(SIDEBAR_LEGACY_PINNED_STORAGE_KEY);
  } catch {
    // Ignore storage failures; the sidebar should still work for this session.
  }
};

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

const SIDEBAR_ICON_SLOT_CLASS = "relative z-10 flex h-10 w-[3.125rem] min-w-[3.125rem] shrink-0 items-center justify-center";

const sidebarLabelRevealClass = (isVisible: boolean) => cn(
  "relative z-10 block min-w-0 overflow-hidden whitespace-nowrap text-[11px] font-black uppercase tracking-tight transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]",
  isVisible
    ? "max-w-[10.5rem] translate-x-0 opacity-100"
    : "pointer-events-none max-w-0 -translate-x-1 opacity-0"
);

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, collapsed }) => (
  <button
    id={`nav-item-${label.toLowerCase()}`}
    onClick={onClick}
    title={collapsed ? label : undefined}
    aria-label={collapsed ? label : undefined}
    className={cn(
      "relative flex h-10 w-full items-center overflow-hidden rounded-xl text-left transition-all duration-200 group",
      isActive
        ? "text-white"
        : "text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100"
    )}
  >
    {isActive && (
      <motion.div
        layoutId="active-nav"
        className="absolute inset-0 bg-[#00A655] shadow-lg shadow-emerald-900/10"
        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
      />
    )}
    <div className={cn(
      SIDEBAR_ICON_SLOT_CLASS,
      "transition-transform duration-200",
      isActive ? "scale-100" : "group-hover:scale-110"
    )}>
      {React.cloneElement(icon as React.ReactElement, { size: 18 })}
    </div>
    <span className={sidebarLabelRevealClass(!collapsed)} aria-hidden={collapsed}>
      <span className="block truncate">{label}</span>
    </span>
  </button>
);

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: RoleType;
  onLogout: () => void;
  permissionCodes?: string[];
  backendRoleName?: string;
}

interface TopNavbarProps extends SidebarProps {
  user: User;
  isNightMode?: boolean;
  onToggleNightMode?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  setActiveTab,
  role,
  user,
  onLogout,
  isNightMode = false,
  onToggleNightMode,
}) => {
  const { t, language, setLanguage, notifications, markNotificationRead, setIsScannerOpen, setIsGhostReportOpen } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const hasGhostAccess = [RoleType.VOZAC, RoleType.MAGACINER, RoleType.KLIJENT].includes(role);
  const highlightGhostAction = role === RoleType.VOZAC || role === RoleType.KLIJENT;
  const showTopbarQrAction = role !== RoleType.ADMIN;
  const showAdminNightModeToggle = Boolean(onToggleNightMode);
  const currentLanguageOption = languageOptions.find((option) => option.code === language) || languageOptions[0];

  const openSettings = () => {
    setActiveTab('settings');
  };

  const cycleLanguage = () => {
    const currentIndex = languageOptions.findIndex((option) => option.code === language);
    const nextOption = languageOptions[(currentIndex + 1) % languageOptions.length] || languageOptions[0];
    setLanguage(nextOption.code);
    setShowLanguageMenu(false);
    setShowNotifications(false);
    setShowProfile(false);
  };

  return (
    <header
      id="app-top-navbar"
      className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-xl shadow-sm shadow-zinc-200/60 dark:border-white/10 dark:bg-[#0c1110]/94 dark:shadow-black/30 md:h-16"
    >
      <div className="flex flex-col gap-2 px-4 py-2 md:h-full md:flex-row md:items-center md:justify-end md:gap-3 md:px-5 md:py-0">
        <div className="flex items-center justify-center md:hidden">
          <div className="flex min-w-[118px] shrink-0 items-center sm:min-w-[132px]">
            <img src={logoImage} alt="Logo" className="h-6 w-auto max-w-[118px] shrink-0 object-contain object-left dark:hidden sm:h-7 sm:max-w-[132px]" />
            <img src={logoNightImage} alt="Logo" className="hidden h-6 w-auto max-w-[118px] shrink-0 object-contain object-left dark:block sm:h-7 sm:max-w-[132px]" />
          </div>
        </div>

        <div className="flex w-full items-center justify-center gap-2 md:w-auto md:justify-start">
          {role === RoleType.KLIJENT && (
            <button
              type="button"
              title={language === 'bs' ? 'Profil' : 'Profile'}
              onClick={() => setActiveTab(activeTab === 'client-table' ? 'dashboard' : 'client-table')}
              className={cn(
                "h-10 w-10 shrink-0 border-2 rounded-xl flex items-center justify-center transition-all",
                activeTab === 'client-table'
                  ? "bg-[#00A655] text-white border-[#00A655]"
                  : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
              )}
            >
              <Boxes size={19} />
            </button>
          )}
          {hasGhostAccess && (
            <button
              type="button"
              title={t('ghostReport')}
              onClick={() => setIsGhostReportOpen(true)}
              className={cn(
                "h-10 w-10 shrink-0 border-2 rounded-xl flex items-center justify-center transition-all",
                highlightGhostAction
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300"
                  : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
              )}
            >
              <Ghost size={19} />
            </button>
          )}

          <div className="h-10 w-10 shrink-0 md:hidden">
            <button
              type="button"
              title={t('language')}
              onClick={cycleLanguage}
              className="h-10 w-10 border-2 border-emerald-100 rounded-xl flex items-center justify-center transition-all text-[10px] font-black uppercase tracking-[0.08em] bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
            >
              {currentLanguageOption.shortLabel}
            </button>
          </div>

          <div className="relative hidden h-10 w-10 shrink-0 md:block">
            <button
              type="button"
              title={t('language')}
              onClick={() => {
                setShowLanguageMenu(!showLanguageMenu);
                setShowNotifications(false);
                setShowProfile(false);
              }}
              className={cn(
                "h-10 w-10 border-2 rounded-xl flex items-center justify-center transition-all text-[10px] font-black uppercase tracking-[0.08em]",
                showLanguageMenu
                  ? "bg-[#00A655] text-white border-[#00A655]"
                  : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
              )}
            >
              {currentLanguageOption.shortLabel}
            </button>

            <AnimatePresence>
              {showLanguageMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  className="absolute left-1/2 top-full mt-3 w-36 -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 dark:border-white/10 dark:bg-[#101715]"
                >
                  <div className="border-b border-emerald-50 bg-emerald-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                      {t('language')}
                    </span>
                  </div>
                  <div className="p-2">
                    {languageOptions.map((option) => (
                      <button
                        key={option.code}
                        type="button"
                        onClick={() => {
                          setLanguage(option.code);
                          setShowLanguageMenu(false);
                        }}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all",
                          option.code === language
                            ? "bg-emerald-50 text-emerald-700 dark:bg-white/5 dark:text-emerald-200"
                            : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-emerald-200"
                        )}
                      >
                        <span className="text-[10px] font-black uppercase tracking-[0.14em]">{option.shortLabel}</span>
                        <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">{option.nativeLabel}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {showTopbarQrAction && (
            <button
              type="button"
              title={t('qrScan')}
              onClick={() => setIsScannerOpen(true)}
              className="hidden h-10 w-10 shrink-0 border-2 border-emerald-100 bg-white text-zinc-700 rounded-xl items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all md:flex dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
            >
              <QrCode size={19} className="text-[#00A655]" />
            </button>
          )}

          {showAdminNightModeToggle && (
            <button
              type="button"
              title={t('nightMode')}
              aria-label={t('nightMode')}
              aria-pressed={isNightMode}
              onClick={() => {
                onToggleNightMode?.();
                setShowLanguageMenu(false);
                setShowNotifications(false);
                setShowProfile(false);
              }}
              className={cn(
                "hidden h-10 w-10 shrink-0 border-2 rounded-xl items-center justify-center transition-all md:flex",
                isNightMode
                  ? "border-[#00A655] bg-[#00A655] text-white shadow-md shadow-emerald-900/15"
                  : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
              )}
            >
              {isNightMode ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          )}

          <div className="relative shrink-0">
            <button
              type="button"
              title={t('activity')}
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowLanguageMenu(false);
                setShowProfile(false);
              }}
              className="relative h-10 w-10 border-2 border-emerald-100 bg-white text-zinc-700 rounded-xl flex items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#00A655] text-white text-[8px] font-black rounded-full border-2 border-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-[59] md:hidden"
                    onClick={() => setShowNotifications(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    className="fixed left-4 right-4 top-24 z-[60] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 md:hidden dark:border-white/10 dark:bg-[#101715]"
                  >
                    <div className="flex items-center justify-between border-b border-emerald-50 bg-emerald-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">{t('activity')}</span>
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/70 hover:text-zinc-700 transition-colors dark:hover:bg-white/5 dark:hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="max-h-[min(22rem,calc(100vh-7rem))] overflow-y-auto no-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-zinc-300">
                          <p className="text-[9px] font-black uppercase">{t('cleanInbox')}</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <button
                            type="button"
                            key={n.id}
                            onClick={() => {
                              markNotificationRead(n.id);
                              setShowNotifications(false);
                            }}
                            className={cn(
                              "w-full text-left p-3 border-b border-emerald-50 last:border-0 hover:bg-emerald-50/60 transition-colors dark:border-white/10 dark:hover:bg-white/5",
                              !n.read && "bg-emerald-50/70 dark:bg-white/5"
                            )}
                          >
                            <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase leading-tight mb-0.5">{n.title}</p>
                            <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight mb-1">{n.message}</p>
                            <span className="text-[8px] font-black text-zinc-300 uppercase tracking-tighter">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    className="absolute left-1/2 top-full mt-3 hidden w-[21rem] -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 md:block dark:border-white/10 dark:bg-[#101715]"
                  >
                    <div className="px-4 py-3 border-b border-emerald-50 bg-emerald-50/60 dark:border-white/10 dark:bg-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">{t('activity')}</span>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto no-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-zinc-300">
                          <p className="text-[9px] font-black uppercase">{t('cleanInbox')}</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <button
                            type="button"
                            key={n.id}
                            onClick={() => {
                              markNotificationRead(n.id);
                              setShowNotifications(false);
                            }}
                            className={cn(
                              "w-full text-left p-3 border-b border-emerald-50 last:border-0 hover:bg-emerald-50/60 transition-colors dark:border-white/10 dark:hover:bg-white/5",
                              !n.read && "bg-emerald-50/70 dark:bg-white/5"
                            )}
                          >
                            <p className="text-[10px] font-black text-zinc-900 dark:text-white uppercase leading-tight mb-0.5">{n.title}</p>
                            <p className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 leading-tight mb-1">{n.message}</p>
                            <span className="text-[8px] font-black text-zinc-300 uppercase tracking-tighter">
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            title={t('settings')}
            onClick={openSettings}
            className={cn(
              "h-10 w-10 shrink-0 border-2 rounded-xl flex items-center justify-center transition-all",
              activeTab === 'settings'
                ? "bg-[#00A655] text-white border-[#00A655]"
                : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
            )}
          >
            <Settings size={19} />
          </button>

          <div className="relative md:hidden">
            <button
              type="button"
              title={t('account')}
              onClick={() => {
                setShowProfile(!showProfile);
                setShowLanguageMenu(false);
                setShowNotifications(false);
              }}
              className="h-10 w-10 border-2 border-emerald-100 bg-white rounded-xl flex items-center justify-center transition-all hover:border-emerald-300 dark:border-white/10 dark:bg-[#101715] dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
            >
              <div className="w-7 h-7 bg-[#00A655] text-white rounded-lg flex items-center justify-center font-black text-[10px]">
                {user.name[0]?.toUpperCase() || role[0].toUpperCase()}
              </div>
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  className="absolute right-0 top-full z-[70] mt-3 w-64 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 dark:border-white/10 dark:bg-[#101715]"
                >
                  <div className="flex items-center gap-3 border-b border-emerald-50 p-4 dark:border-white/10">
                    <UserCircle size={34} className="text-emerald-600" />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-black uppercase text-zinc-950 dark:text-white">{user.name}</p>
                      <p className="truncate text-[9px] font-bold uppercase text-zinc-400">{user.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="flex w-full items-center gap-2 px-4 py-3 text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <LogOut size={16} />
                    <span className="text-[10px] font-black uppercase tracking-tight">{t('logout')}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative hidden md:block">
            <button
              type="button"
              title={t('account')}
              onClick={() => {
                setShowProfile(!showProfile);
                setShowLanguageMenu(false);
                setShowNotifications(false);
              }}
              className="h-10 pl-1 pr-2 sm:pr-3 border border-emerald-100 bg-white rounded-xl flex items-center gap-2 hover:border-emerald-300 transition-all dark:border-white/10 dark:bg-[#101715] dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
            >
              <div className="w-8 h-8 bg-[#00A655] text-white rounded-lg flex items-center justify-center font-black text-xs">
                {user.name[0]?.toUpperCase() || role[0].toUpperCase()}
              </div>
              <span className="hidden md:block max-w-32 truncate text-[10px] font-black uppercase text-zinc-900 dark:text-white">{user.name}</span>
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  className="absolute right-0 top-full mt-3 w-64 bg-white border border-emerald-100 rounded-2xl shadow-2xl shadow-emerald-950/10 overflow-hidden dark:border-white/10 dark:bg-[#101715]"
                >
                  <div className="p-4 flex items-center gap-3 border-b border-emerald-50 dark:border-white/10">
                    <UserCircle size={34} className="text-emerald-600" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase text-zinc-950 dark:text-white truncate">{user.name}</p>
                      <p className="text-[9px] font-bold uppercase text-zinc-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full px-4 py-3 flex items-center gap-2 text-rose-500 hover:bg-rose-50 transition-colors dark:hover:bg-rose-500/10"
                  >
                    <LogOut size={16} />
                    <span className="text-[10px] font-black uppercase tracking-tight">{t('logout')}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role, permissionCodes = [], backendRoleName = '' }) => {
  const { t, language, setIsScannerOpen } = useApp();
  const [isSidebarPinned, setIsSidebarPinned] = useState(readStoredSidebarPinned);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isSidebarScrollReady, setIsSidebarScrollReady] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const isSidebarExpanded = isSidebarPinned || isSidebarHovered;
  const isCollapsed = !isSidebarExpanded;
  const isHoverExpanded = !isSidebarPinned && isSidebarHovered;
  const sidebarToggleLabel = isSidebarPinned ? t('sidebarPinned') : t('sidebarAutoHide');
  const sidebarTransition = "transition-[width,box-shadow,transform] duration-[400ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]";
  const sidebarRailWidth = isSidebarPinned ? "w-64" : "w-[4.625rem]";
  const sidebarPanelWidth = isSidebarExpanded ? "w-64" : "w-[4.625rem]";
  const singleRoleOverviewLabel =
    language === 'bs' ? 'Pregled paleta' : language === 'nl' ? 'Bokkenoverzicht' : 'Pallet overview';
  const usesSingleOverviewTab = [
    RoleType.MAGACINER,
    RoleType.SERVISER,
    RoleType.KLIJENT,
    RoleType.ADMIN_SERVICE,
    RoleType.ADMIN_WAREHOUSE,
    RoleType.FINANCE_ADMINISTRATION,
  ].includes(role);

  useEffect(() => {
    if (!isSidebarExpanded) {
      setIsSidebarScrollReady(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsSidebarScrollReady(true);
    }, 420);

    return () => window.clearTimeout(timeoutId);
  }, [isSidebarExpanded]);

  const getNavItems = () => {
    const items: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      onClick?: () => void;
      isActive?: boolean;
    }> = [
      { id: 'dashboard', label: usesSingleOverviewTab ? singleRoleOverviewLabel : t('dashboard'), icon: <LayoutDashboard /> },
    ];

    if (role === RoleType.ADMIN) {
      items.push(
        { id: 'pallets', label: t('pallets'), icon: <Package /> },
        { id: 'no-qr-pallets', label: t('noQrPallets'), icon: <Ghost /> },
        { id: 'calendar', label: t('calendar'), icon: <CalendarIcon /> },
        { id: 'audit-logs', label: t('auditLogs'), icon: <History /> },
        { id: 'client-manager', label: t('clientManager'), icon: <Building2 /> },
        { id: 'korisnici', label: t('systemUsers'), icon: <UserCircle /> },
        { id: 'roles', label: t('roles'), icon: <Shield /> },
        { id: 'invoices', label: t('billing'), icon: <ClipboardList /> }
        ,{ id: 'gallery', label: t('imageGallery'), icon: <Images /> }
      );
    } else if (role === RoleType.VOZAC || role === RoleType.MAGACINER) {
    } else if (role === RoleType.SERVISER) {
    } else if (role === RoleType.KLIJENT) {
      items.push({ id: 'customer-details', label: t('completeDetails'), icon: <Building2 /> });
    }

    const knownBackendRoles = ['admin','warehouse_operator','customer','driver','technician','user','operator','admin_service','admin_warehouse','finance_administration'];
    if (!knownBackendRoles.includes(backendRoleName.toLowerCase())) {
      if (permissionCodes.includes('customers')) items.push({ id: 'client-manager', label: t('clientManager'), icon: <Building2 /> });
      if (permissionCodes.includes('audit_logs')) items.push({ id: 'audit-logs', label: t('auditLogs'), icon: <History /> });
      if (permissionCodes.includes('services')) items.push({ id: 'admin-service', label: t('adminService'), icon: <Wrench /> });
      if (permissionCodes.includes('users')) items.push({ id: 'korisnici', label: t('systemUsers'), icon: <UserCircle /> });
      if (permissionCodes.includes('roles')) items.push({ id: 'roles', label: t('roles'), icon: <Shield /> });
      if (permissionCodes.includes('invoices')) items.push({ id: 'invoices', label: t('billing'), icon: <ClipboardList /> });
    }

    if (role !== RoleType.ADMIN && permissionCodes.includes('image_gallery')) {
      items.push({ id: 'gallery', label: t('imageGallery'), icon: <Images /> });
    }

    return items;
  };

  return (
    <>
      <svg className="absolute h-0 w-0 overflow-hidden" aria-hidden="true" focusable="false">
        <defs>
          <filter id="trackpal-sidebar-dark-logo" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0 -1.538 0 0 1 0 -0.538 0 0 1 0 -1.031 0 0 1 0 0 0 1 0"
            />
          </filter>
        </defs>
      </svg>
      <aside
        id="desktop-sidebar"
        onMouseEnter={() => {
          if (!isSidebarPinned) {
            setIsSidebarHovered(true);
          }
        }}
        onMouseLeave={() => {
          if (!isSidebarPinned) {
            setIsSidebarHovered(false);
          }
        }}
        onFocusCapture={() => {
          if (!isSidebarPinned) {
            setIsSidebarHovered(true);
          }
        }}
        onBlurCapture={(event) => {
          const nextTarget = event.relatedTarget;
          if (!isSidebarPinned && !(nextTarget instanceof Node && event.currentTarget.contains(nextTarget))) {
            setIsSidebarHovered(false);
          }
        }}
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 overflow-visible md:block",
          "transition-[width] duration-[400ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]",
          isSidebarExpanded ? "z-[1000]" : "z-[70]",
          sidebarRailWidth
        )}
      >
        <div
          className={cn(
            "flex h-full flex-col overflow-hidden border-r border-zinc-200 bg-white dark:border-white/10 dark:bg-[#0c1110]",
            "will-change-[width,transform]",
            sidebarTransition,
            sidebarPanelWidth,
            isHoverExpanded
              ? "absolute left-0 top-0 z-[1000] shadow-[18px_0_46px_-28px_rgba(15,23,42,0.45)] dark:shadow-black/40"
              : "relative z-10",
            isSidebarPinned && "shadow-[18px_0_46px_-28px_rgba(15,23,42,0.22)] dark:shadow-black/30"
          )}
          style={{ transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
        >
          <div className="flex h-16 shrink-0 items-center overflow-hidden border-b border-zinc-100 px-3 dark:border-white/10">
            <div
              className="relative h-10 w-full min-w-0 overflow-hidden rounded-xl"
              title={isCollapsed ? 'Trackpal app' : undefined}
              aria-label="Trackpal app"
            >
              <span
                className={cn(
                  "absolute left-[0.9375rem] top-1/2 block h-7 -translate-y-1/2 overflow-hidden transition-[width] duration-[400ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]",
                  isCollapsed ? "w-5" : "w-[12.5rem]"
                )}
              >
                <img
                  src={logoImage}
                  alt="Trackpal app"
                  className="h-7 w-auto max-w-none shrink-0 object-contain object-left dark:hidden"
                />
                <img
                  src={logoNightImage}
                  alt="Trackpal app"
                  className="hidden h-7 w-auto max-w-none shrink-0 object-contain object-left dark:block"
                />
              </span>
            </div>
          </div>

          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center">
              <button
                type="button"
                aria-label={sidebarToggleLabel}
                aria-pressed={isSidebarPinned}
                onClick={() => {
                  setIsSidebarPinned((current) => {
                    const next = !current;
                    storeSidebarPinned(next);
                    setIsSidebarHovered(!next);
                    return next;
                  });
                }}
                className={cn(
                  "flex h-10 w-full items-center overflow-hidden rounded-xl border transition-colors",
                  isSidebarPinned
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/25 dark:bg-emerald-400/[0.13] dark:text-emerald-100"
                    : "border-transparent text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:border-emerald-300/20 dark:hover:bg-emerald-400/[0.10] dark:hover:text-emerald-100"
                )}
              >
                <span className={SIDEBAR_ICON_SLOT_CLASS}>
                  <Menu size={18} className="shrink-0" />
                </span>
                <span className={sidebarLabelRevealClass(!isCollapsed)} aria-hidden={isCollapsed}>
                  <span className="block truncate">{t('menu')}</span>
                </span>
                <span
                  className={cn(
                    "relative z-10 ml-auto mr-3 flex h-5 w-9 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-[max-width,margin,opacity,background-color] duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]",
                    isCollapsed ? "pointer-events-none max-w-0 opacity-0 mr-0" : "max-w-9 opacity-100",
                    isSidebarPinned ? "bg-[#00A655]" : "bg-zinc-200 dark:bg-emerald-100/25"
                  )}
                  aria-hidden="true"
                >
                  <span
                    className={cn(
                      "sidebar-pin-thumb h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      isSidebarPinned && "translate-x-4"
                    )}
                  />
                </span>
              </button>
            </div>
          </div>

          <nav
            className={cn(
              "min-h-0 flex-1 space-y-1 overscroll-contain px-3 pb-3 pt-2",
              isSidebarScrollReady ? "sidebar-scroll overflow-y-auto" : "overflow-hidden"
            )}
          >
            {getNavItems().map((item) => (
              <NavItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                isActive={item.isActive ?? activeTab === item.id}
                onClick={item.onClick || (() => setActiveTab(item.id))}
                collapsed={isCollapsed}
              />
            ))}
          </nav>

          <div className="px-3 py-4 mt-auto border-t border-emerald-100 dark:border-white/10 space-y-1">
            <button
              type="button"
              title={isCollapsed ? t('qrScan') : undefined}
              aria-label={isCollapsed ? t('qrScan') : undefined}
              onClick={() => setIsScannerOpen(true)}
              className={cn(
                "flex h-10 w-full items-center overflow-hidden rounded-xl bg-[#00A655] text-white shadow-lg shadow-emerald-900/15 transition-all hover:bg-[#008f49] active:scale-95"
              )}
            >
              <span className={SIDEBAR_ICON_SLOT_CLASS}>
                <QrCode size={18} className="shrink-0" />
              </span>
              <span className={sidebarLabelRevealClass(!isCollapsed)} aria-hidden={isCollapsed}>
                <span className="block truncate">{t('qrScan')}</span>
              </span>
            </button>

            <button
              title={isCollapsed ? t('needHelp') : undefined}
              aria-label={isCollapsed ? t('needHelp') : undefined}
              onClick={() => setShowHelp(true)}
              className={cn(
                "flex h-10 w-full items-center overflow-hidden rounded-xl text-zinc-500 transition-all hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-400 dark:hover:bg-white/[0.07] dark:hover:text-zinc-100"
              )}
            >
              <span className={SIDEBAR_ICON_SLOT_CLASS}>
                <HelpCircle size={18} />
              </span>
              <span className={sidebarLabelRevealClass(!isCollapsed)} aria-hidden={isCollapsed}>
                <span className="block truncate">{t('needHelp')}</span>
              </span>
            </button>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {showHelp && (
          <KnowledgeBase role={role} onClose={() => setShowHelp(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export const BottomNav: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role }) => {
  const { t, setIsScannerOpen } = useApp();
  const getNavItems = () => {
    const items: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      onClick?: () => void;
      isActive?: boolean;
    }> = [];

    if (role === RoleType.ADMIN) {
      items.push({ id: 'dashboard', label: t('home'), icon: <LayoutDashboard size={18} />, isActive: activeTab === 'dashboard' });
      items.push(
        { id: 'pallets', label: t('pallets'), icon: <Package size={18} />, isActive: activeTab === 'pallets' },
        { id: 'korisnici', label: t('systemUsers'), icon: <UserCircle size={18} />, isActive: activeTab === 'korisnici' }
      );
    } else if ([RoleType.VOZAC, RoleType.MAGACINER, RoleType.KLIJENT, RoleType.SERVISER].includes(role)) {
      items.push({
        id: 'qr-scan',
        label: t('qrScan'),
        icon: <QrCode size={18} className="text-[#00A655]" />,
        onClick: () => setIsScannerOpen(true),
      });
    }

    if (role === RoleType.KLIJENT) {
      items.push({
        id: 'invoices',
        label: t('billing'),
        icon: <ClipboardList size={18} />,
        onClick: () => setActiveTab(activeTab === 'invoices' ? 'dashboard' : 'invoices'),
        isActive: activeTab === 'invoices',
      });
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <nav
      id="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-[60] flex min-h-16 items-start justify-around gap-1 overflow-hidden border-t border-zinc-200 bg-white/95 px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] shadow-[0_-10px_30px_rgba(113,113,122,0.18)] backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-[#0c1110]/95 dark:shadow-black/60"
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={item.onClick || (() => setActiveTab(item.id))}
          className={cn(
            "relative flex min-h-[3.5rem] flex-1 flex-col items-center justify-center overflow-hidden rounded-xl px-1 py-2.5 transition-all",
            item.isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'
          )}
        >
          {item.isActive && (
            <motion.div
              layoutId="active-bottom-nav"
              className="absolute inset-0 bg-[#00A655] shadow-xl shadow-emerald-900/10"
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />
          )}
          <div className="relative z-10 shrink-0">
            {item.icon}
          </div>
          <span className="relative z-10 mt-1 w-full truncate px-1 text-center text-[9px] font-black uppercase tracking-tight">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
};
