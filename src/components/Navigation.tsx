import React, { useState } from 'react';
import { cn } from './ui';
import { 
  Menu, X, LayoutDashboard, QrCode, ClipboardList, Settings, 
  LogOut, Users, Package, HelpCircle, Shield, Calendar as CalendarIcon,
  Bell, Moon, Sun, UserCircle, Ghost, Languages, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { RoleType, User } from '../types';
import { KnowledgeBase } from './KnowledgeBase';
import { useApp } from '../AppContext';
import { getRoleLabel, languageOptions } from '../i18n';

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
  const unreadCount = notifications.filter(n => !n.read).length;
  const hasGhostAccess = [RoleType.ADMIN, RoleType.VOZAC, RoleType.MAGACINER, RoleType.KLIJENT].includes(role);
  const highlightGhostAction = role === RoleType.VOZAC || role === RoleType.KLIJENT;

  const openSettings = () => {
    setActiveTab('settings');
  };

  return (
    <header
      id="app-top-navbar"
      className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-zinc-200 bg-white/95 backdrop-blur-xl shadow-sm shadow-zinc-200/60 dark:border-white/10 dark:bg-[#102219]/92 dark:shadow-black/30"
    >
      <div className="h-full px-4 md:px-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 bg-[#00A655] rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/15 shrink-0">
            <Package className="text-white" size={20} />
          </div>
          <div className="min-w-0">
            <span className="block font-black text-lg tracking-tight text-emerald-900 dark:text-white uppercase font-display leading-none">trackpal</span>
            <span className="hidden sm:block text-[8px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-200 truncate">
              {getRoleLabel(role, language)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {hasGhostAccess && (
            <button
              type="button"
              title={t('ghostReport')}
              onClick={() => setIsGhostReportOpen(true)}
              className={cn(
                "h-10 w-10 border rounded-xl flex items-center justify-center transition-all",
                highlightGhostAction
                  ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300"
                  : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#163126] dark:text-zinc-200 dark:hover:text-emerald-200"
              )}
            >
              <Ghost size={18} />
            </button>
          )}

          <div className="relative h-10">
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
              className="h-10 w-[88px] rounded-xl border border-emerald-100 bg-white pl-9 pr-8 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-700 appearance-none outline-none transition-all hover:border-emerald-300 hover:text-emerald-700 focus:border-[#00A655] dark:border-white/10 dark:bg-[#163126] dark:text-zinc-100 dark:hover:text-emerald-200"
              aria-label={t('language')}
              title={t('language')}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.shortLabel}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            title={t('qrScan')}
            onClick={() => setIsScannerOpen(true)}
            className="h-10 w-10 border border-emerald-100 bg-white text-zinc-700 rounded-xl flex items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all dark:border-white/10 dark:bg-[#163126] dark:text-zinc-200 dark:hover:text-emerald-200"
          >
            <QrCode size={18} className="text-[#00A655]" />
          </button>

          <div className="relative">
            <button
              type="button"
              title={t('activity')}
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative h-10 w-10 border border-emerald-100 bg-white text-zinc-700 rounded-xl flex items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all dark:border-white/10 dark:bg-[#163126] dark:text-zinc-200 dark:hover:text-emerald-200"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-[#00A655] text-white text-[8px] font-black rounded-full border-2 border-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  className="absolute right-0 top-full mt-3 w-[min(21rem,calc(100vw-2rem))] bg-white border border-emerald-100 rounded-2xl shadow-2xl shadow-emerald-950/10 overflow-hidden dark:border-white/10 dark:bg-[#163126]"
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
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            title={t('nightMode')}
            onClick={onToggleNightMode}
          className="h-10 w-10 border border-emerald-100 bg-white text-zinc-700 rounded-xl flex items-center justify-center hover:border-emerald-300 hover:text-emerald-700 transition-all dark:border-white/10 dark:bg-[#163126] dark:text-zinc-200 dark:hover:text-emerald-200"
          >
            {isNightMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            type="button"
            title={t('settings')}
            onClick={openSettings}
            className={cn(
              "h-10 w-10 border rounded-xl flex items-center justify-center transition-all",
              activeTab === 'settings'
                ? "bg-[#00A655] text-white border-[#00A655]"
                : "border-emerald-100 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#163126] dark:text-zinc-200 dark:hover:text-emerald-200"
            )}
          >
            <Settings size={18} />
          </button>

          <div className="relative">
            <button
              type="button"
              title={t('account')}
              onClick={() => setShowProfile(!showProfile)}
              className="h-10 pl-1 pr-2 sm:pr-3 border border-emerald-100 bg-white rounded-xl flex items-center gap-2 hover:border-emerald-300 transition-all dark:border-white/10 dark:bg-[#163126]"
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
                  className="absolute right-0 top-full mt-3 w-64 bg-white border border-emerald-100 rounded-2xl shadow-2xl shadow-emerald-950/10 overflow-hidden dark:border-white/10 dark:bg-[#163126]"
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
    const items = [
      { id: 'dashboard', label: t('dashboard'), icon: <LayoutDashboard /> },
    ];

    if (role === RoleType.ADMIN) {
      items.push(
        { id: 'pallets', label: t('pallets'), icon: <Package /> },
        { id: 'calendar', label: t('calendar'), icon: <CalendarIcon /> },
        { id: 'users', label: t('clients'), icon: <Users /> },
        { id: 'korisnici', label: t('systemUsers'), icon: <UserCircle /> },
        { id: 'roles', label: t('roles'), icon: <Shield /> },
        { id: 'invoices', label: t('billing'), icon: <ClipboardList /> }
      );
    } else if (role === RoleType.VOZAC || role === RoleType.MAGACINER) {
    } else if (role === RoleType.SERVISER) {
    } else if (role === RoleType.KLIJENT) {
      items.push(
        { id: 'invoices', label: t('billing'), icon: <ClipboardList /> }
      );
    }

    return items;
  };

  return (
    <>
      <aside
        id="desktop-sidebar"
        className={`hidden md:flex flex-col border-r border-zinc-200 bg-white h-[calc(100vh-4rem)] sticky top-16 transition-all duration-300 dark:border-white/10 dark:bg-[#102219] ${
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
              isActive={activeTab === item.id}
              onClick={() => setActiveTab(item.id)}
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
  const { t } = useApp();
  const getNavItems = () => {
    const items = [
      { id: 'dashboard', label: t('home'), icon: <LayoutDashboard size={18} /> },
    ];

    if (role === RoleType.ADMIN) {
      items.push(
        { id: 'pallets', label: t('pallets'), icon: <Package size={18} /> },
        { id: 'korisnici', label: t('systemUsers'), icon: <UserCircle size={18} /> }
      );
    } else if (role === RoleType.KLIJENT) {
      items.push(
        { id: 'invoices', label: t('billing'), icon: <ClipboardList size={18} /> }
      );
    }

    return items;
  };

  return (
    <nav
      id="mobile-bottom-nav"
      className="md:hidden fixed bottom-5 left-4 right-4 bg-white/95 backdrop-blur-2xl border border-zinc-200 p-1.5 rounded-2xl flex justify-around items-center shadow-2xl shadow-zinc-200/70 z-50 overflow-hidden dark:border-white/10 dark:bg-[#102219]/95 dark:shadow-black/40"
    >
      {getNavItems().map((item) => (
        <button
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          className={cn(
            "relative flex-1 flex flex-col items-center justify-center py-3 rounded-xl transition-all overflow-hidden",
            activeTab === item.id ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'
          )}
        >
          {activeTab === item.id && (
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
