import React, { useState } from 'react';
import { 
  Package, Truck, AlertTriangle, Users, ArrowUpRight, Search, 
  Filter, MoreVertical, MapPin, Clock, Settings as SettingsIcon,
  Plus, History, ClipboardList, TrendingUp, Info, QrCode, X
} from 'lucide-react';
import { StatCard, Card, Button, Input, Select, Badge } from './ui';
import { PalletScanner } from './PalletScanner';
import { DamageReportModal } from './DamageReportModal';
import { PalletGridItem } from './PalletGridItem';
import { BillingList } from './BillingList';
import { RoleManager } from './RoleManager';
import { PalletTableView } from './PalletTableView';
import { BillingCalendar } from './BillingCalendar';
import { useApp } from '../AppContext';
import { motion, AnimatePresence } from 'motion/react';
import { RoleType, Pallet, PalletStatus, ClientDetail, User } from '../types';
import { LayoutGrid, List as ListIcon, CreditCard, Shield, Table as TableIcon, Calendar as CalendarIcon } from 'lucide-react';

interface AdminDashboardProps {
  initialView?: 'overview' | 'pallets' | 'clients' | 'settings' | 'logs' | 'billing' | 'roles' | 'calendar';
  user: User;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ initialView = 'overview', user }) => {
  const { 
    pallets, statuses, clients, auditLogs, serviceReports,
    updateStatusSettings, addStatus, deleteStatus, addPallet, updatePallet, deletePallet,
    addClient, updateClient, t 
  } = useApp();
  const [view, setView] = useState<'overview' | 'pallets' | 'clients' | 'settings' | 'logs' | 'billing' | 'roles' | 'calendar'>(initialView);
  const [displayMode, setDisplayMode] = useState<'grid' | 'list' | 'table'>('grid');
  const [editingStatus, setEditingStatus] = useState<PalletStatus | null>(null);
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [newStatusData, setNewStatusData] = useState<Omit<PalletStatus, 'id'>>({
    name: '',
    is_active: true,
    is_billable: false,
    grace_period_days: 14,
    price_per_day: 0
  });
  
  // Modals
  const [showAddPallet, setShowAddPallet] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDetail | null>(null);
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);
  const [editingPallet, setEditingPallet] = useState<Pallet | null>(null);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<number | 'all'>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const handleExportExcel = () => {
    alert('Exporting to Excel... (System creates .xlsx automatically)');
  };

  const handleExportPdf = () => {
    alert('Generating PDF Delivery/Stock Report...');
  };

  // Sync view with prop changes (e.g. from sidebar)
  React.useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const calculateDays = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const calculateDebt = (p: Pallet) => {
    const status = statuses.find(s => s.id === p.current_status_id);
    if (!status || !status.is_billable) return 0;
    
    const client = clients.find(c => c.user_id === p.user_id);
    const graceDays = client?.grace_period_days ?? status.grace_period_days;
    const pricePerDay = client?.price_per_day ?? status.price_per_day;
    
    const days = calculateDays(p.last_status_changed_at);
    if (days <= graceDays) return 0;
    return (days - graceDays) * pricePerDay;
  };

  const renderOverview = () => {
    const overduePallets = pallets.filter(p => calculateDebt(p) > 0);
    const totalDebt = pallets.reduce((acc, p) => acc + calculateDebt(p), 0);
    
    return (
      <div className="space-y-6 pb-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label={t('totalPallets')} value={pallets.length.toString()} trend="+12%" trendUp />
          <StatCard label={t('inTransit')} value={pallets.filter(p => [2, 6].includes(p.current_status_id)).length.toString()} variant="info" />
          <StatCard label={t('overdueUnits')} value={overduePallets.length.toString()} trend={overduePallets.length > 0 ? t('actionRequired') : t('allGood')} trendUp={false} variant="danger" />
          <StatCard label={t('totalAccrued')} value={`€${totalDebt.toFixed(2)}`} trend="Live" trendUp variant="success" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {overduePallets.length > 0 && (
              <Card title={`${t('revenueRecovery')} (${t('overdue')})`} noPadding>
                 <div className="p-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-700">
                      <AlertTriangle size={14} />
                      <span className="text-[9px] font-black uppercase tracking-widest">{t('actionRequired')} ({overduePallets.length})</span>
                    </div>
                 </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50/50 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3">{t('qrCode')}</th>
                          <th className="px-6 py-3">{t('client')}</th>
                          <th className="px-6 py-3 text-right">{t('owed')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] divide-y divide-zinc-50">
                        {overduePallets.slice(0, 5).map(p => {
                           const client = clients.find(c => c.user_id === p.user_id);
                           return (
                            <tr key={p.id} className="hover:bg-rose-50/30 transition-colors">
                              <td className="px-6 py-3 font-mono font-black">{p.qr_code}</td>
                              <td className="px-6 py-3">
                                <p className="font-bold text-zinc-900 leading-none mb-1">{client?.name || 'In Warehouse'}</p>
                                <p className="text-[9px] text-zinc-400 uppercase tracking-tighter leading-none">{p.current_location}</p>
                              </td>
                              <td className="px-6 py-3 text-right text-rose-600 font-mono font-black">
                                 €{calculateDebt(p).toFixed(2)}
                              </td>
                            </tr>
                           );
                        })}
                      </tbody>
                    </table>
                 </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card 
                title={t('activity')} 
                noPadding
                action={<Button variant="ghost" size="xs" onClick={() => setView('logs')}>{t('viewHistory')}</Button>}
              >
                 <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50/50 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                        <tr>
                          <th className="px-6 py-3">{t('qrCode')}</th>
                          <th className="px-6 py-3">{t('status')}</th>
                        </tr>
                      </thead>
                      <tbody className="text-[11px] divide-y divide-zinc-50">
                        {auditLogs.slice(0, 5).map(log => (
                          <tr key={`audit-log-${log.id}`} className="hover:bg-zinc-50/50">
                            <td className="px-6 py-3 font-mono font-black underline underline-offset-2">{log.pallet_qr}</td>
                            <td className="px-6 py-3">
                              <span className="font-black text-zinc-900 block leading-none mb-1">{log.new_status_name}</span>
                              <span className="text-[9px] text-zinc-400 uppercase tracking-tighter block leading-none">{new Date(log.created_at).toLocaleTimeString()}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
              </Card>

              <Card 
                title={t('inventory')} 
                noPadding
                action={<Button variant="ghost" size="xs" onClick={() => setView('pallets')}>{t('manageAll')}</Button>}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50/50 text-[9px] font-black text-zinc-400 uppercase tracking-widest border-b border-zinc-100">
                      <tr>
                        <th className="px-6 py-3">{t('qrCode')}</th>
                        <th className="px-6 py-3">{t('owed')}</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] divide-y divide-zinc-50">
                      {pallets.slice(0, 5).map((pallet) => (
                        <tr key={`pallet-overview-${pallet.id}`} className="hover:bg-zinc-50">
                          <td className="px-6 py-3 font-mono font-black">{pallet.qr_code}</td>
                          <td className="px-6 py-3 font-mono font-black text-emerald-600">€{calculateDebt(pallet).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card title={t('quickAnalysis')}>
               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-500" />
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{t('utilizationRate')}</span>
                     </div>
                     <span className="text-xs font-black">84.2%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                     <div style={{ width: '84.2%' }} className="h-full bg-black rounded-full" />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3">
                       <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                       <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-blue-800 mb-1">{t('logisticsNote')}</p>
                          <p className="text-[11px] font-bold text-blue-700 leading-tight">8 units ready for return pickup. Efficiency optimal.</p>
                       </div>
                    </div>

                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex gap-3">
                       <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                       <div className="min-w-0">
                          <p className="text-[9px] font-black uppercase tracking-widest text-amber-800 mb-1">{t('overdueWarning')}</p>
                          <p className="text-[11px] font-bold text-amber-700 leading-tight">14 days grace exceeded on multiple units.</p>
                       </div>
                    </div>
                  </div>
               </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  const renderPallets = () => {
    const filteredPallets = pallets.filter(p => {
      const matchesSearch = p.qr_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.current_status_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.client_name || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || p.current_status_id === statusFilter;
      const matchesOverdue = !overdueOnly || calculateDebt(p) > 0;

      return matchesSearch && matchesStatus && matchesOverdue;
    });

    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
           <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
             <div className="relative w-full md:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="ID, Status, Client..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-100 border-none rounded-2xl focus:ring-1 focus:ring-black outline-none font-bold text-sm"
                />
             </div>
             <select 
               value={statusFilter} 
               onChange={e => setStatusFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
               className="bg-gray-100 border-none rounded-2xl px-4 py-3 outline-none font-bold text-xs uppercase"
             >
                <option value="all">All Statuses</option>
                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
             </select>
             <button 
               onClick={() => setOverdueOnly(!overdueOnly)}
               className={`px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border transition-all ${overdueOnly ? 'bg-rose-500 text-white border-rose-600' : 'bg-gray-100 text-gray-400 border-transparent'}`}
             >
                Overdue Only
             </button>
           </div>
           <div className="flex gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
              <div className="flex bg-gray-100 p-1 rounded-2xl border border-gray-200">
                <button
                  onClick={() => setDisplayMode('grid')}
                  className={`p-2 rounded-xl transition-all ${displayMode === 'grid' ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutGrid size={18} />
                </button>
                <button
                  onClick={() => setDisplayMode('list')}
                  className={`p-2 rounded-xl transition-all ${displayMode === 'list' ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <ListIcon size={18} />
                </button>
                <button
                  onClick={() => setDisplayMode('table')}
                  className={`p-2 rounded-xl transition-all ${displayMode === 'table' ? 'bg-white shadow-sm text-black' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <TableIcon size={18} />
                </button>
              </div>
               <button 
                onClick={() => setShowDamageModal(true)}
                className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-100"
              >
                 <AlertTriangle size={14} />
                 {t('reportDamage')}
              </button>
               <button 
                onClick={handleExportExcel}
                className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
              >
                 EXCEL
              </button>
               <button 
                onClick={() => setShowScanner(true)}
                className="px-4 py-2 bg-gray-100 text-black border border-gray-200 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gray-200"
              >
                 <QrCode size={14} />
                 Bulk
              </button>
              <button 
                onClick={() => setShowAddPallet(true)}
                className="px-4 py-2 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-black/10 hover:scale-105 transition-transform"
              >
                 <Plus size={14} />
                 New
              </button>
           </div>
        </div>

        {displayMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {filteredPallets.map(p => (
               <PalletGridItem 
                 key={`pallet-grid-${p.id}`} 
                 pallet={p} 
                 statuses={statuses} 
                 clients={clients} 
                 debt={calculateDebt(p)}
                 onClick={() => setSelectedPallet(p)}
               />
             ))}
             {filteredPallets.length === 0 && (
               <div className="col-span-full p-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-100">
                  <Package size={48} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-sm font-black text-gray-300 uppercase tracking-widest">No matching units found</p>
               </div>
             )}
          </div>
        ) : displayMode === 'list' ? (
          <Card title="Full Fleet Management">
             <div className="overflow-auto min-h-[400px]">
                <table className="w-full text-left">
                  <thead className="bg-[#F9FAFB] text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 sticky top-0 bg-white">
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3">{t('qrCode')}</th>
                <th className="px-6 py-3">{t('status')}</th>
                <th className="px-6 py-3">{t('location')}</th>
                <th className="px-6 py-3">{t('client')}</th>
                <th className="px-6 py-3">{t('days')}</th>
                <th className="px-6 py-3">{t('owed')}</th>
              </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-gray-50">
                    {filteredPallets.length === 0 ? (
                      <tr><td colSpan={6} className="p-10 text-center text-gray-300 italic uppercase">No pallets found</td></tr>
                    ) : (
                      filteredPallets.map(p => (
                        <tr key={`list-item-${p.id}`} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-3 font-black">{p.qr_code}</td>
                          <td className="px-6 py-3">
                            <span className={`status-chip ${p.current_status_id === 7 ? 'status-service' : p.current_status_id === 4 ? 'status-client' : 'status-bih'}`}>
                              {p.current_status_name}
                            </span>
                          </td>
                          <td className="px-6 py-3 font-bold text-gray-400">{p.current_location}</td>
                          <td className="px-6 py-3 font-bold text-gray-900">{p.client_name || '-'}</td>
                          <td className="px-6 py-3 text-gray-400 font-bold">{calculateDays(p.last_status_changed_at)}d</td>
                          <td className="px-6 py-3 font-mono font-black">
                             <div className="flex items-center justify-between">
                                <span>€{calculateDebt(p).toFixed(2)}</span>
                             </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
             </div>
          </Card>
        ) : (
          <PalletTableView />
        )}
      </div>
    );
  };

  const renderClients = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-xl font-black uppercase tracking-tighter">{t('clients')}</h2>
         <button 
           onClick={() => setShowAddClient(true)}
           className="px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-black/10 hover:scale-105 transition-transform"
         >
            <Plus size={16} />
            {t('addNew')}
         </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map(client => (
          <div 
            key={`client-card-${client.id}`} 
            onClick={() => setEditingClient(client)}
            className="cursor-pointer group"
          >
            <Card title={client.name} action={
              <SettingsIcon size={14} className="text-gray-300 group-hover:text-black transition-colors" />
            }>
               <div className="p-6 space-y-4">
                  <div className="flex flex-col gap-1">
                   <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inventory</span>
                   <p className="font-black text-lg">{pallets.filter(p => p.user_id === client.user_id).length} units</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                   <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Grace Mode</span>
                      <p className="font-black text-xs">{client.grace_period_days} Days</p>
                   </div>
                   <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase">Daily Rate</span>
                      <p className="font-black text-xs">€{client.price_per_day}</p>
                   </div>
                </div>
                <div className="pt-2">
                   <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded ${client.country === 'Netherlands' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                      {client.country}
                   </span>
                </div>
             </div>
          </Card>
        </div>
      ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-xl font-black uppercase tracking-tighter">{t('configs')}</h2>
         <button 
           onClick={() => setShowAddStatus(true)}
           className="px-6 py-3 bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-black/10 hover:scale-105 transition-transform"
         >
            <Plus size={16} />
            {t('addStatus')}
         </button>
      </div>

      <Card title="Global Status Configurator">
         <div className="p-4 space-y-2">
            {statuses.map(status => (
              <div key={`status-cfg-${status.id}`} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:border-black transition-all group">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest">{status.name}</span>
                  <div className="flex gap-4 mt-1">
                     <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Counter {status.is_active ? 'ON' : 'OFF'}</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${status.is_billable ? 'bg-blue-500' : 'bg-gray-300'}`} />
                        <span className="text-[9px] font-bold text-gray-400 uppercase">Billing {status.is_billable ? 'ON' : 'OFF'}</span>
                     </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (confirm(t('confirmDeleteStatus'))) {
                        deleteStatus(status.id);
                      }
                    }}
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity text-rose-500 hover:bg-rose-50 rounded-lg"
                  >
                     <AlertTriangle size={14} />
                  </button>
                  <button 
                    onClick={() => setEditingStatus(status)}
                    className="p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white rounded-lg"
                  >
                     <SettingsIcon size={14} />
                  </button>
                </div>
              </div>
            ))}
         </div>
      </Card>

      {showAddStatus && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6">
           <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative">
             <h2 className="text-xl font-black mb-6 uppercase">{t('newStatus')}</h2>
             <div className="space-y-4">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('statusName')}</label>
                   <input 
                     type="text" 
                     value={newStatusData.name} 
                     onChange={e => setNewStatusData({...newStatusData, name: e.target.value})} 
                     className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" 
                     placeholder="e.g. Returned"
                   />
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Active Counter</span>
                   <button onClick={() => setNewStatusData({...newStatusData, is_active: !newStatusData.is_active})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_active ? 'bg-black' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_active ? 'left-5' : 'left-1'}`} />
                   </button>
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grace Period (Days)</label>
                   <input type="number" value={newStatusData.grace_period_days} onChange={e => setNewStatusData({...newStatusData, grace_period_days: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price Per Day (€)</label>
                   <input type="number" step="0.1" value={newStatusData.price_per_day} onChange={e => setNewStatusData({...newStatusData, price_per_day: parseFloat(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                </div>
                <div className="flex items-center justify-between pt-2">
                   <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{t('isBillable')}</span>
                   <button onClick={() => setNewStatusData({...newStatusData, is_billable: !newStatusData.is_billable})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_billable ? 'bg-blue-600' : 'bg-gray-200'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_billable ? 'left-5' : 'left-1'}`} />
                   </button>
                </div>
             </div>
             <div className="flex gap-3 mt-8">
                <button onClick={() => setShowAddStatus(false)} className="flex-1 py-3 font-bold text-gray-400 hover:text-black transition-colors uppercase text-xs">{t('cancel')}</button>
                <button 
                  onClick={() => { 
                    addStatus(newStatusData); 
                    setShowAddStatus(false);
                    setNewStatusData({ name: '', is_active: true, is_billable: false, grace_period_days: 14, price_per_day: 0 });
                  }} 
                  className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-xs shadow-xl shadow-black/10"
                >
                  {t('save')}
                </button>
             </div>
           </motion.div>
        </div>
      )}

       {editingStatus && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative">
              <h2 className="text-xl font-black mb-6 uppercase">Configure: {editingStatus.name}</h2>
              <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Active Counter</span>
                    <button onClick={() => setEditingStatus({...editingStatus, is_active: !editingStatus.is_active})} className={`w-10 h-6 rounded-full transition-colors relative ${editingStatus.is_active ? 'bg-black' : 'bg-gray-200'}`}>
                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingStatus.is_active ? 'left-5' : 'left-1'}`} />
                    </button>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grace Period (Days)</label>
                    <input type="number" value={editingStatus.grace_period_days} onChange={e => setEditingStatus({...editingStatus, grace_period_days: parseInt(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price Per Day (€)</label>
                    <input type="number" step="0.1" value={editingStatus.price_per_day} onChange={e => setEditingStatus({...editingStatus, price_per_day: parseFloat(e.target.value)})} className="w-full p-3 bg-gray-50 border-none rounded-xl focus:ring-1 focus:ring-black outline-none font-bold" />
                 </div>
                 <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Billable Status</span>
                    <button onClick={() => setEditingStatus({...editingStatus, is_billable: !editingStatus.is_billable})} className={`w-10 h-6 rounded-full transition-colors relative ${editingStatus.is_billable ? 'bg-blue-600' : 'bg-gray-200'}`}>
                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editingStatus.is_billable ? 'left-5' : 'left-1'}`} />
                    </button>
                 </div>
              </div>
              <div className="flex gap-3 mt-8">
                 <button onClick={() => setEditingStatus(null)} className="flex-1 py-3 font-bold text-gray-400 hover:text-black transition-colors uppercase text-xs">Cancel</button>
                 <button onClick={() => { updateStatusSettings(editingStatus); setEditingStatus(null); }} className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-xs shadow-xl shadow-black/10">Save Rules</button>
              </div>
            </div>
         </div>
       )}
    </div>
  );

  return (
    <div className="pb-24 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {view === 'overview' && renderOverview()}
      {view === 'pallets' && renderPallets()}
      {view === 'clients' && renderClients()}
      {view === 'settings' && renderSettings()}
      {view === 'billing' && <BillingList />}
      {view === 'calendar' && <BillingCalendar />}
      {view === 'roles' && <RoleManager />}

      {/* Modals for CRUD operations */}
      <AnimatePresence>
        {selectedPallet && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[3rem] w-full max-w-xl shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 right-0 h-2 bg-black"></div>
               <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter uppercase mb-1">{selectedPallet.qr_code}</h3>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{selectedPallet.type}</span>
                  </div>
                  <div className="flex gap-2">
                    {user.role_name === RoleType.ADMIN && (
                      <button 
                        onClick={() => setEditingPallet(selectedPallet)}
                        className="px-4 py-2 bg-gray-50 text-black border border-gray-100 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-colors"
                      >
                         Edit Data
                      </button>
                    )}
                    <button onClick={() => setSelectedPallet(null)} className="p-2 hover:bg-gray-50 rounded-xl text-gray-400"><X size={20} /></button>
                  </div>
               </div>

               <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Location</span>
                    <p className="text-xs font-black uppercase">{selectedPallet.current_location}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Status</span>
                    <p className="text-xs font-black uppercase text-blue-600">{selectedPallet.current_status_name}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Days Out</span>
                    <p className="text-xs font-black">{calculateDays(selectedPallet.last_status_changed_at)} Days</p>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">Movement History</h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                    {auditLogs.filter(l => l.pallet_id === selectedPallet.id).map((log, i) => (
                      <div key={`log-detail-${log.id}`} className="flex items-center gap-4 p-3 border border-gray-100 rounded-2xl bg-white">
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center shrink-0">
                          <History size={14} className="text-gray-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-gray-900 uppercase tracking-tight">{log.new_status_name}</p>
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(log.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">#{auditLogs.length - i}</span>
                      </div>
                    ))}
                  </div>
               </div>

               <div className="mt-8 flex gap-3">
                  <button onClick={() => setSelectedPallet(null)} className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-black/10">Close Details</button>
               </div>
            </motion.div>
          </div>
        )}

        {editingPallet && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[3rem] w-full max-w-lg shadow-2xl overflow-y-auto max-h-[95vh] no-scrollbar">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase">Edit Unit: {editingPallet.qr_code}</h3>
                <button onClick={() => setEditingPallet(null)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">QR Code</label>
                      <input 
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-black uppercase" 
                        value={editingPallet.qr_code} 
                        onChange={e => setEditingPallet({...editingPallet, qr_code: e.target.value.toUpperCase()})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pallet Type</label>
                      <select 
                        value={editingPallet.type} 
                        onChange={e => setEditingPallet({...editingPallet, type: e.target.value})}
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      >
                         <option>Euro Pallet</option>
                         <option>H1 Plastic</option>
                         <option>Metal Cage / Kraksna</option>
                         <option>Industrial</option>
                      </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Status</label>
                      <select 
                        value={editingPallet.current_status_id}
                        onChange={e => {
                          const sid = parseInt(e.target.value);
                          const sname = statuses.find(s => s.id === sid)?.name || '';
                          setEditingPallet({...editingPallet, current_status_id: sid, current_status_name: sname});
                        }}
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      >
                         {statuses.map(s => <option key={`filter-status-${s.id}`} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned Client</label>
                      <select 
                        value={editingPallet.user_id || ''}
                        onChange={e => {
                          const uid = e.target.value ? parseInt(e.target.value) : undefined;
                          const cname = clients.find(c => c.user_id === uid)?.name || '';
                          setEditingPallet({...editingPallet, user_id: uid, client_name: cname});
                        }}
                        className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      >
                         <option value="">- No Client -</option>
                         {clients.map(c => <option key={`edit-client-${c.id}`} value={c.user_id}>{c.name}</option>)}
                      </select>
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Physical Location</label>
                    <input 
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                      value={editingPallet.current_location} 
                      onChange={e => setEditingPallet({...editingPallet, current_location: e.target.value})}
                    />
                 </div>

                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Custom Operational Notes</label>
                    <textarea 
                      placeholder="Add operational notes..." 
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold text-sm h-24"
                      value={editingPallet.note || ''}
                      onChange={e => setEditingPallet({...editingPallet, note: e.target.value})}
                    />
                 </div>
              </div>
              <div className="flex gap-4 mt-8 pt-4 border-t border-gray-100">
                 <button 
                   onClick={() => {
                     if (confirm('Are you sure you want to delete this unit? All history will be lost.')) {
                        deletePallet(editingPallet.id);
                        setEditingPallet(null);
                        setSelectedPallet(null);
                     }
                   }}
                   className="p-4 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors"
                 >
                    <AlertTriangle size={20} />
                 </button>
                 <button onClick={() => setEditingPallet(null)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">Cancel</button>
                 <button onClick={() => {
                   updatePallet(editingPallet);
                   setEditingPallet(null);
                   setSelectedPallet(null);
                 }} className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-black/20 hover:scale-[1.02] transition-transform">Save Changes</button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddStatus && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-black uppercase mb-6 text-center">New Operational Status</h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Name</label>
                    <input 
                      autoFocus 
                      placeholder="e.g. In Custom Clearance" 
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold"
                      value={newStatusData.name}
                      onChange={e => setNewStatusData({...newStatusData, name: e.target.value})}
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                       <span className="text-[10px] font-black uppercase text-gray-400">Active</span>
                       <button onClick={() => setNewStatusData({...newStatusData, is_active: !newStatusData.is_active})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_active ? 'bg-black' : 'bg-gray-200'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_active ? 'left-5' : 'left-1'}`} />
                       </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                       <span className="text-[10px] font-black uppercase text-gray-400">Billable</span>
                       <button onClick={() => setNewStatusData({...newStatusData, is_billable: !newStatusData.is_billable})} className={`w-10 h-6 rounded-full transition-colors relative ${newStatusData.is_billable ? 'bg-blue-600' : 'bg-gray-200'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${newStatusData.is_billable ? 'left-5' : 'left-1'}`} />
                       </button>
                    </div>
                 </div>
                 {newStatusData.is_billable && (
                   <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grace Days</label>
                         <input type="number" value={newStatusData.grace_period_days} onChange={e => setNewStatusData({...newStatusData, grace_period_days: parseInt(e.target.value)})} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">€ / Day</label>
                         <input type="number" step="0.1" value={newStatusData.price_per_day} onChange={e => setNewStatusData({...newStatusData, price_per_day: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                      </div>
                   </div>
                 )}
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setShowAddStatus(false)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">Cancel</button>
                 <button 
                  onClick={() => {
                    if (newStatusData.name) {
                      addStatus(newStatusData);
                      setShowAddStatus(false);
                      setNewStatusData({ name: '', is_active: true, is_billable: false, grace_period_days: 14, price_per_day: 0 });
                    }
                  }} 
                  className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-black/20"
                >
                  Create Status
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddPallet && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-black uppercase mb-6">New Pallet Entry</h3>
              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">QR Code Identification</label>
                    <input autoFocus placeholder="e.g. EPAL-10234" className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold uppercase" id="new-pallet-qr" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pallet Type</label>
                    <select className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" id="new-pallet-type">
                       <option>Euro Pallet</option>
                       <option>H1 Plastic</option>
                       <option>Metal Cage / Kraksna</option>
                       <option>Industrial</option>
                    </select>
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setShowAddPallet(false)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">Cancel</button>
                 <button onClick={() => {
                    const qr = (document.getElementById('new-pallet-qr') as HTMLInputElement).value;
                    const type = (document.getElementById('new-pallet-type') as HTMLSelectElement).value;
                    if (qr) {
                       addPallet(qr, type);
                       setShowAddPallet(false);
                    }
                 }} className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs">Create Unit</button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddClient && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
              <h3 className="text-xl font-black uppercase mb-6">Onboard New Client</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Company Name</label>
                    <input id="new-client-name" placeholder="e.g. Fresh Logistics GmbH" className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grace Period (Days)</label>
                    <input id="new-client-grace" type="number" defaultValue={14} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Daily Rate (€)</label>
                    <input id="new-client-rate" type="number" step="0.1" defaultValue={2.5} className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Location / Market</label>
                    <select id="new-client-country" className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold">
                       <option>Netherlands</option>
                       <option>Bosnia & Herzegovina</option>
                       <option>Germany</option>
                    </select>
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setShowAddClient(false)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">Cancel</button>
                 <button onClick={() => {
                    const name = (document.getElementById('new-client-name') as HTMLInputElement).value;
                    const grace = parseInt((document.getElementById('new-client-grace') as HTMLInputElement).value);
                    const rate = parseFloat((document.getElementById('new-client-rate') as HTMLInputElement).value);
                    const country = (document.getElementById('new-client-country') as HTMLSelectElement).value;
                    if (name) {
                       addClient({ name, grace_period_days: grace, price_per_day: rate, country });
                       setShowAddClient(false);
                    }
                 }} className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs">Register Client</button>
              </div>
            </motion.div>
          </div>
        )}

        {editingClient && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black uppercase">Edit Client Rules</h3>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">ID: {editingClient.user_id}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Grace Period (Days)</label>
                    <input 
                      type="number" 
                      value={editingClient.grace_period_days} 
                      onChange={e => setEditingClient({...editingClient, grace_period_days: parseInt(e.target.value)})}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                    />
                 </div>
                 <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Daily Rate Override (€)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={editingClient.price_per_day} 
                      onChange={e => setEditingClient({...editingClient, price_per_day: parseFloat(e.target.value)})}
                      className="w-full p-4 bg-gray-100 border-none rounded-2xl font-bold" 
                    />
                 </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button onClick={() => setEditingClient(null)} className="flex-1 py-4 font-black uppercase text-xs text-gray-400">Discard</button>
                 <button onClick={() => {
                    updateClient(editingClient);
                    setEditingClient(null);
                 }} className="flex-1 py-4 bg-black text-white rounded-2xl font-black uppercase text-xs">Update Settings</button>
              </div>
            </motion.div>
          </div>
        )}

        {showDamageModal && (
          <DamageReportModal 
            currentUser={user}
            onClose={() => setShowDamageModal(false)}
          />
        )}

        {showScanner && (
          <PalletScanner 
            currentUser={user} 
            onClose={() => setShowScanner(false)} 
          />
        )}
      </AnimatePresence>
      {view === 'logs' && (
        <Card title="Audit History" action={<button onClick={handleExportPdf} className="text-[10px] font-black uppercase text-gray-400 flex items-center gap-2 hover:text-black shrink-0">PDF REPORT <ArrowUpRight size={12} /></button>}>
           <div className="overflow-auto max-h-[600px] no-scrollbar">
              <table className="w-full text-left">
                 <thead className="bg-[#F9FAFB] text-[10px] font-black text-gray-400 uppercase tracking-widest sticky top-0 bg-white z-10">
                    <tr>
                      <th className="px-6 py-4">Timestamp</th>
                      <th className="px-6 py-4">Pallet ID</th>
                      <th className="px-6 py-4">Performed By</th>
                      <th className="px-6 py-4">New Status</th>
                      <th className="px-6 py-4">New Location</th>
                      <th className="px-6 py-4">Note</th>
                    </tr>
                 </thead>
                 <tbody className="text-xs divide-y divide-gray-50">
                   {auditLogs.map(log => (
                     <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 text-gray-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-6 py-3 font-black text-black">
                           <button onClick={() => setSelectedPallet(pallets.find(p => p.qr_code === log.pallet_qr) || null)} className="hover:underline underline-offset-4 decoration-black">
                              {log.pallet_qr}
                           </button>
                        </td>
                        <td className="px-6 py-3">
                           <span className="font-bold text-gray-900">{log.made_by_user_name}</span>
                        </td>
                        <td className="px-6 py-3">
                           <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${log.new_status_id === 7 ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                              {log.new_status_name}
                           </span>
                        </td>
                        <td className="px-6 py-3 text-gray-400 font-bold uppercase">{log.new_location}</td>
                        <td className="px-6 py-3 text-gray-400 italic truncate max-w-[150px]">{log.note || '-'}</td>
                     </tr>
                   ))}
                 </tbody>
              </table>
           </div>
        </Card>
      )}
    </div>
  );
};
