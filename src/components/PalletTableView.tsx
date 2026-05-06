import React, { useState, useMemo } from 'react';
import { Input, Select, Badge, Card, Button } from './ui';
import { Search, Hash, Package, User as UserIcon, MapPin, Edit } from 'lucide-react';
import { useApp } from '../AppContext';
import { motion } from 'motion/react';

export const PalletTableView: React.FC = () => {
  const { pallets, statuses, clients, t } = useApp();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredPallets = useMemo(() => {
    return pallets.filter(p => {
      const matchesSearch = p.qr_code.toLowerCase().includes(search.toLowerCase());
      const matchesClient = clientFilter === 'all' || p.user_id?.toString() === clientFilter;
      const matchesStatus = statusFilter === 'all' || p.current_status_id.toString() === statusFilter;
      const matchesType = typeFilter === 'all' || p.type === typeFilter;
      return matchesSearch && matchesClient && matchesStatus && matchesType;
    });
  }, [pallets, search, clientFilter, statusFilter, typeFilter]);

  const uniqueTypes = Array.from(new Set(pallets.map(p => p.type)));

  return (
    <div className="space-y-6">
      <Card noPadding>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-zinc-50/50">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
            <Input 
              placeholder={t('searchQr')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-white"
            />
          </div>

          <Select 
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="h-10 bg-white"
          >
            <option value="all">{t('allClients')}</option>
            {clients.map(c => <option key={`table-filter-client-${c.id}`} value={c.user_id?.toString()}>{c.name}</option>)}
          </Select>

          <Select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 bg-white"
          >
            <option value="all">{t('allStatuses')}</option>
            {statuses.map(s => <option key={`table-filter-status-${s.id}`} value={s.id.toString()}>{s.name}</option>)}
          </Select>

          <Select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-10 bg-white"
          >
            <option value="all">{t('allTypes')}</option>
            {uniqueTypes.map(t_type => <option key={t_type} value={t_type}>{t_type}</option>)}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-zinc-50/50 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100">
                <th className="px-6 py-4">ID / QR</th>
                <th className="px-6 py-4">{t('type')}</th>
                <th className="px-6 py-4">{t('client')}</th>
                <th className="px-6 py-4">{t('status')}</th>
                <th className="px-6 py-4">{t('location')}</th>
                <th className="px-6 py-4">{t('lastUpdate')}</th>
                <th className="px-6 py-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredPallets.map((p, idx) => {
                const client = clients.find(c => c.user_id === p.user_id);
                return (
                  <motion.tr 
                    key={`table-row-${p.id}`}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.01 }}
                    className="hover:bg-zinc-50/50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-black text-white rounded flex items-center justify-center">
                          <Hash size={12} />
                        </div>
                        <span className="font-mono font-black text-xs tracking-tight">{p.qr_code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Package size={12} className="text-zinc-300" />
                        <span className="text-[10px] font-black uppercase text-zinc-600">{p.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <UserIcon size={12} className="text-zinc-300" />
                        <span className="text-[10px] font-black text-black uppercase tracking-tight">{client?.name || 'In Stock'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                       <Badge variant={p.current_status_id === 7 ? 'danger' : p.current_status_id === 4 ? 'success' : 'info'}>
                        {p.current_status_name}
                       </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-zinc-300" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">{p.current_location || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="text-[9px] font-black text-zinc-300 uppercase tracking-tight">
                        {new Date(p.last_status_changed_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Button variant="ghost" size="xs">
                        <Edit size={14} />
                      </Button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {filteredPallets.length === 0 && (
            <div className="p-20 text-center">
               <div className="w-12 h-12 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-zinc-100">
                  <Search size={20} className="text-zinc-200" />
               </div>
               <p className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">No matching results</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
