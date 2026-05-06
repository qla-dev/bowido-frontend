/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Sidebar, BottomNav, TopNavbar } from './components/Navigation';
import { AdminDashboard } from './components/AdminDashboard';
import { WorkerDashboard } from './components/WorkerDashboard';
import { ClientDashboard } from './components/ClientDashboard';
import { ServiceDashboard } from './components/ServiceDashboard';
import { PalletScanner } from './components/PalletScanner';
import { RoleType, User } from './types';
import { mockUsers } from './lib/mockData';
import { Package, Smartphone, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './AppContext';
import { Card } from './components/ui';

export default function App() {
  const { t, language, setLanguage, isScannerOpen, setIsScannerOpen } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNightMode, setIsNightMode] = useState(false);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  if (!currentUser) {
    return (
      <div id="login-screen" className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-emerald-900 font-sans">
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
              <button 
                onClick={() => setLanguage(language === 'en' ? 'bs' : 'en')}
                className="absolute -top-2 -right-2 w-10 h-10 bg-white border border-zinc-200 rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95"
              >
                <span className="text-[10px] font-black">{language.toUpperCase()}</span>
              </button>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-5xl font-black tracking-tighter uppercase font-display">trackpal</h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px]">Logistics Ecosystem</p>
            </div>
          </div>

          <Card title={t('welcome') || 'System Login'} noPadding>
            <div className="p-8 space-y-6">
              <div className="space-y-1 text-center">
                <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                  {t('loggedAs') === 'Logged as' ? 'Select a role to preview' : 'Odaberite ulogu'}
                </p>
              </div>

              <div className="space-y-3">
                {mockUsers.map((user) => (
                  <button
                    id={`login-${user.role_name.toLowerCase()}`}
                    key={user.id}
                    onClick={() => setCurrentUser(user)}
                    className="w-full group flex items-center justify-between p-5 bg-zinc-50 rounded-2xl border border-zinc-200 hover:border-[#00A655] transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/5 active:scale-95"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-black text-xs uppercase tracking-tight text-emerald-900 font-display">{user.role_name}</span>
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{user.email}</span>
                    </div>
                    <div className="p-2.5 bg-white border border-zinc-200 rounded-xl group-hover:bg-[#00A655] group-hover:text-white group-hover:border-[#00A655] transition-all shadow-sm">
                      <LogIn size={18} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="flex flex-col items-center gap-4 pt-8 border-t border-zinc-50 opacity-100">
             <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-zinc-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Mobile Responsive Ready</span>
             </div>
          </div>
        </motion.div>
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
              <button
                type="button"
                onClick={() => setLanguage(language === 'en' ? 'bs' : 'en')}
                className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 text-left hover:border-emerald-300 transition-colors"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">{t('language')}</span>
                <p className="text-lg font-black uppercase text-emerald-900 font-display">{language}</p>
              </button>
              <button
                type="button"
                onClick={() => setIsNightMode(!isNightMode)}
                className="p-4 rounded-2xl border border-emerald-100 bg-white text-left hover:border-emerald-300 transition-colors dark:bg-emerald-800 dark:border-emerald-700/60"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Nightmode</span>
                <p className="text-lg font-black uppercase text-emerald-900 font-display dark:text-white">{isNightMode ? 'On' : 'Off'}</p>
              </button>
            </div>
          </div>
        </Card>
      );
    }

    switch (currentUser.role_name) {
      case RoleType.ADMIN: {
        const adminTabsMap: Record<string, 'overview' | 'pallets' | 'clients' | 'settings' | 'logs' | 'billing' | 'roles' | 'calendar'> = {
          dashboard: 'overview',
          pallets: 'pallets',
          calendar: 'calendar',
          users: 'clients',
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
      className={`min-h-screen bg-white text-emerald-900 font-sans selection:bg-[#00A655] selection:text-white ${isNightMode ? 'dark' : ''}`}
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

      <div className="flex flex-col md:flex-row min-h-screen pt-16 bg-white dark:bg-emerald-950">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        role={currentUser.role_name} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 h-[calc(100vh-4rem)] bg-white overflow-y-auto pb-28 md:pb-0 relative scroll-smooth no-scrollbar md:no-scrollbar">
        <div className="w-full bg-white p-4 sm:p-5 md:p-6 lg:p-8">
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
      </AnimatePresence>
    </div>
  );
}
