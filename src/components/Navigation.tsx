import React, { useState } from 'react';
import { cn } from './ui';
import { 
  Menu, X, LayoutDashboard, QrCode, ClipboardList, Settings, 
  LogOut, Users, Package, HelpCircle, Shield, Calendar as CalendarIcon,
  Bell, Moon, Sun, UserCircle, Ghost, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RoleType, User } from '../types';
import { KnowledgeBase } from './KnowledgeBase';
import { useApp } from '../AppContext';
import { getRoleLabel, languageOptions } from '../i18n';
import logoImage from '../assets/logo.png';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isActive, onClick, collapsed }) => (
  <button
    id={`nav-item-${label.toLowerCase()}`}
    onClick={onClick}
  className={cn(
      "relative flex items-center gap-2 w-full px-3 py-2.5 rounded-xl transition-all duration-200 group overflow-hidden",
      isActive
        ? "text-white"
        : "text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-emerald-200"
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
      "relative z-10 transition-transform duration-200 shrink-0",
      isActive ? "scale-100" : "group-hover:scale-110"
    )}>
      {React.cloneElement(icon as React.ReactElement, { size: 18 })}
    </div>
    {!collapsed && (
      <span className="relative z-10 text-[11px] font-black uppercase tracking-tight">
        {label}
      </span>
    )}
  </button>
);

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: RoleType;
  onLogout: () => void;
}

interface TopNavbarProps extends SidebarProps {
  user: User;
  isNightMode: boolean;
  onToggleNightMode: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  activeTab,
  setActiveTab,
  role,
  user,
  onLogout,
  isNightMode,
  onToggleNightMode,
}) => {
  const { t, language, setLanguage, notifications, markNotificationRead, setIsScannerOpen, setIsGhostReportOpen } = useApp();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;
  const hasGhostAccess = [RoleType.ADMIN, RoleType.VOZAC, RoleType.MAGACINER, RoleType.KLIJENT].includes(role);
  const highlightGhostAction = role === RoleType.VOZAC || role === RoleType.KLIJENT;
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
      className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-xl shadow-sm shadow-zinc-200/60 dark:border-white/10 dark:bg-[#172d22]/92 dark:shadow-black/30 md:h-16"
    >
      <div className="flex flex-col gap-2 px-4 py-2 md:h-full md:flex-row md:items-center md:justify-between md:gap-3 md:px-5 md:py-0">
        <div className="flex items-center justify-center md:min-w-0 md:flex-1 md:justify-start">
          <div className="flex min-w-[118px] shrink-0 items-center sm:min-w-[132px]">
            <img src={logoImage} alt="Logo" className="h-6 w-auto max-w-[118px] shrink-0 object-contain object-left sm:h-7 sm:max-w-[132px]" />
          </div>
        </div>

        <div className="flex w-full items-center justify-center gap-2 md:w-auto md:justify-start">
          {hasGhostAccess && (
            <button
              type="button"
              title={t('ghostReport')}
              onClick={() => setIsGhostReportOpen(true)}
              className={cn(
                "h-10 w-10 shrink-0 border-2 rounded-xl flex items-center justify-center transition-all",
                highlightGhostAction
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300"
                  : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:text-emerald-200"
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
              className="h-10 w-10 border-2 border-emerald-100 rounded-xl flex items-center justify-center transition-all text-[10px] font-black uppercase tracking-[0.08em] bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:text-emerald-200"
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
                  : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:text-emerald-200"
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
                  className="absolute left-1/2 top-full mt-3 w-36 -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 dark:border-white/10 dark:bg-[#1f3a2d]"
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

          <button
            type="button"
            title={t('qrScan')}
            onClick={() => setIsScannerOpen(true)}
            className="hidden h-10 w-10 shrink-0 border-2 border-emerald-100 bg-white text-zinc-700 rounded-xl items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all md:flex dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:text-emerald-200"
          >
            <QrCode size={19} className="text-[#00A655]" />
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              title={t('activity')}
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowLanguageMenu(false);
                setShowProfile(false);
              }}
              className="relative h-10 w-10 border-2 border-emerald-100 bg-white text-zinc-700 rounded-xl flex items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:text-emerald-200"
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
                    className="modal-overlay fixed inset-0 z-[59] md:hidden"
                    onClick={() => setShowNotifications(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    className="fixed left-4 right-4 top-24 z-[60] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 md:hidden dark:border-white/10 dark:bg-[#1f3a2d]"
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
                    className="absolute left-1/2 top-full mt-3 hidden w-[21rem] -translate-x-1/2 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 md:block dark:border-white/10 dark:bg-[#1f3a2d]"
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
            title={t('nightMode')}
            onClick={onToggleNightMode}
          className="h-10 w-10 shrink-0 border-2 border-emerald-100 bg-white text-zinc-700 rounded-xl flex items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:text-emerald-200"
          >
            {isNightMode ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          <button
            type="button"
            title={t('settings')}
            onClick={openSettings}
            className={cn(
              "h-10 w-10 shrink-0 border-2 rounded-xl flex items-center justify-center transition-all",
              activeTab === 'settings'
                ? "bg-[#00A655] text-white border-[#00A655]"
                : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#1f3a2d] dark:text-zinc-200 dark:hover:text-emerald-200"
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
              className="h-10 w-10 border-2 border-emerald-100 bg-white rounded-xl flex items-center justify-center transition-all hover:border-emerald-300 dark:border-white/10 dark:bg-[#1f3a2d]"
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
                  className="absolute right-0 top-full z-[70] mt-3 w-64 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 dark:border-white/10 dark:bg-[#1f3a2d]"
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
              className="h-10 pl-1 pr-2 sm:pr-3 border border-emerald-100 bg-white rounded-xl flex items-center gap-2 hover:border-emerald-300 transition-all dark:border-white/10 dark:bg-[#1f3a2d]"
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
                  className="absolute right-0 top-full mt-3 w-64 bg-white border border-emerald-100 rounded-2xl shadow-2xl shadow-emerald-950/10 overflow-hidden dark:border-white/10 dark:bg-[#1f3a2d]"
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

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, role }) => {
  const { t, setIsScannerOpen } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const getNavItems = () => {
    const items: Array<{
      id: string;
      label: string;
      icon: React.ReactNode;
      onClick?: () => void;
      isActive?: boolean;
    }> = [
      { id: 'dashboard', label: t('dashboard'), icon: <LayoutDashboard /> },
    ];

    if (role === RoleType.ADMIN) {
      items.push(
        { id: 'pallets', label: t('pallets'), icon: <Package /> },
        { id: 'calendar', label: t('calendar'), icon: <CalendarIcon /> },
        { id: 'audit-logs', label: t('auditLogs'), icon: <History /> },
        { id: 'users', label: t('clients'), icon: <Users /> },
        { id: 'korisnici', label: t('systemUsers'), icon: <UserCircle /> },
        { id: 'roles', label: t('roles'), icon: <Shield /> },
        { id: 'invoices', label: t('billing'), icon: <ClipboardList /> }
      );
    } else if (role === RoleType.VOZAC || role === RoleType.MAGACINER) {
    } else if (role === RoleType.SERVISER) {
    } else if (role === RoleType.KLIJENT) {
      items.push(
        {
          id: 'invoices',
          label: t('billing'),
          icon: <ClipboardList />,
          onClick: () => setActiveTab(activeTab === 'invoices' ? 'dashboard' : 'invoices'),
          isActive: activeTab === 'invoices',
        }
      );
    }

    return items;
  };

  return (
    <>
      <aside
        id="desktop-sidebar"
        className={`hidden md:flex flex-col border-r border-zinc-200 bg-white h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300 dark:border-white/10 dark:bg-[#172d22] ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {isCollapsed && (
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center">
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full px-3 py-2.5 rounded-xl flex items-center justify-start text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 transition-colors dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-emerald-200"
              >
                <Menu size={18} />
              </button>
            </div>
          </div>
        )}

        <nav className={cn("flex-1 px-3 pb-3 space-y-1", isCollapsed ? "pt-2" : "pt-3")}>
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
            onClick={() => setIsScannerOpen(true)}
            className={cn(
              "h-10 w-full rounded-xl bg-[#00A655] text-white shadow-lg shadow-emerald-900/15 hover:bg-[#008f49] active:scale-95 transition-all flex items-center gap-2",
              isCollapsed ? "justify-center px-0" : "justify-start px-3"
            )}
          >
            <QrCode size={18} className="shrink-0" />
            {!isCollapsed && (
              <span className="text-[11px] font-black uppercase tracking-tight">
                {t('qrScan')}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className={cn(
              "h-10 flex items-center gap-2 w-full px-3 rounded-xl text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-emerald-200",
              isCollapsed && "justify-center"
            )}
          >
            <HelpCircle size={18} />
            {!isCollapsed && <span className="text-[11px] font-black uppercase tracking-tight">{t('needHelp')}</span>}
          </button>

          {!isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="h-10 w-full px-3 rounded-xl flex items-center gap-2 text-zinc-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-emerald-200"
            >
              <X size={18} />
              <span className="text-[11px] font-black uppercase tracking-tight">{t('close')}</span>
            </button>
          )}
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

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-5 left-4 right-4 bg-white/95 backdrop-blur-2xl border border-zinc-200 p-1.5 rounded-2xl flex justify-around items-center shadow-2xl shadow-zinc-200/70 z-50 overflow-hidden dark:border-white/10 dark:bg-[#172d22]/95 dark:shadow-black/40"
    >
      {getNavItems().map((item) => (
        <button
          key={item.id}
          onClick={item.onClick || (() => setActiveTab(item.id))}
          className={cn(
            "relative flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all overflow-hidden",
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
          <span className="relative z-10 text-[9px] mt-1 font-black uppercase tracking-tight">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
