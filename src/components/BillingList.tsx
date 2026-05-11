import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Filter, FileText, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button, Card, Badge } from './ui';
import { InvoiceViewer } from './InvoiceViewer';
import { useApp } from '../AppContext';
import { Invoice } from '../types';

interface BillingListProps {
  onBack?: () => void;
  compact?: boolean;
}

export const BillingList: React.FC<BillingListProps> = ({ onBack, compact = false }) => {
  const { invoices, t } = useApp();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const getInvoiceStatusLabel = (status: Invoice['status']) => {
    if (status === 'paid') return t('paid');
    if (status === 'overdue') return t('overdue');
    if (status === 'sent') return t('sentLabel');
    return status;
  };

  return (
    <div className="space-y-6">
      <div className={`flex ${compact ? 'items-center justify-between gap-3' : 'items-center justify-between'} px-1 sm:px-2`}>
        <div className="flex flex-wrap items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="h-10 rounded-xl px-3 text-zinc-500">
              <ArrowLeft size={14} className="mr-2" />
              {t('dashboard')}
            </Button>
          )}
          {!compact && (
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-black">{t('billing')}</h2>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t('managePayments')}</p>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" className={`${compact ? 'h-10 self-start sm:self-auto' : ''}`}>
          <Filter size={14} className="mr-2" /> {t('filter')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {invoices.map((invoice) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2 }}
            onClick={() => setSelectedInvoice(invoice)}
            className="cursor-pointer"
          >
            <Card noPadding className="group hover:border-black transition-all">
              <div className="p-4 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-5 w-full sm:w-auto">
                  <div className="w-12 h-12 bg-zinc-50 group-hover:bg-black rounded-xl flex items-center justify-center transition-all shrink-0">
                    <FileText className="text-zinc-300 group-hover:text-white" size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-base text-black truncate uppercase tracking-tight">{invoice.invoice_number}</h3>
                      <Badge variant={invoice.status === 'paid' ? 'success' : 'danger'}>
                        {getInvoiceStatusLabel(invoice.status)}
                      </Badge>
                    </div>
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest truncate">{invoice.customer_name}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-10 w-full sm:w-auto border-t sm:border-t-0 pt-4 sm:pt-0 border-zinc-50">
                  <div className="text-left sm:text-right">
                    <p className="text-[9px] font-black text-zinc-300 uppercase tracking-[0.2em] mb-1">{t('payableAmount')}</p>
                    <p className="text-2xl font-black text-black tracking-tighter">{`\u20AC${invoice.total_amount.toFixed(2)}`}</p>
                  </div>
                  <div className="w-10 h-10 border-2 border-zinc-50 group-hover:border-black rounded-full flex items-center justify-center transition-all shrink-0">
                    <ChevronRight className="text-zinc-200 group-hover:text-black" size={16} />
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {selectedInvoice && <InvoiceViewer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
    </div>
  );
};
