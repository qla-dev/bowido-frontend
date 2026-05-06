import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Download, X, Printer, CheckCircle2, AlertCircle } from 'lucide-react';
import { Invoice, InvoiceItem } from '../types';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import { Button, Card, Badge } from './ui';

interface InvoiceViewerProps {
  invoice: Invoice;
  onClose: () => void;
}

export const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ invoice, onClose }) => {
  const { t } = useApp();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadItems = async () => {
      const data = await apiService.invoices.getItems(invoice.id);
      setItems(data);
      setLoading(false);
    };
    loadItems();
  }, [invoice.id]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl"
      >
        <Card noPadding className="shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[90vh] rounded-[3rem]">
          {/* Header */}
          <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/20">
            <div className="space-y-0.5">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
                  <FileText className="text-white" size={20} />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-black">{t('viewInvoice')}</h2>
              </div>
              <p className="text-[10px] font-black text-zinc-400 tracking-[0.25em] uppercase mt-1">{invoice.invoice_number}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-black">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 md:p-8 overflow-y-auto no-scrollbar space-y-8">
            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">Billed To</h4>
                  <p className="text-lg font-black text-black leading-none uppercase tracking-tight">{invoice.customer_name}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">VAT: NL823456789B01</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight leading-relaxed max-w-xs mt-2">Industrieweg 12, 5621AA Eindhoven, NL</p>
                </div>
                <div className="flex gap-12">
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-1">{t('issueDate')}</h4>
                    <p className="text-xs font-black text-black uppercase">{invoice.issue_date}</p>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-1">{t('dueDate')}</h4>
                    <p className="text-xs font-black text-rose-600 uppercase">{invoice.due_date}</p>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-50 border border-zinc-100 p-8 rounded-[2rem] relative">
                 <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-6">{t('status')}</h4>
                 <div className="flex items-center gap-5">
                    {invoice.status === 'paid' ? (
                      <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center border border-emerald-100/50">
                        <CheckCircle2 className="text-emerald-500" size={28} />
                      </div>
                    ) : (
                      <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center border border-rose-100/50">
                        <AlertCircle className="text-rose-500" size={28} />
                      </div>
                    )}
                    <div>
                      <p className="text-2xl font-black text-black uppercase tracking-tighter leading-none">
                         {invoice.status === 'paid' ? t('paid') : t('unpaid')}
                      </p>
                      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.15em] mt-2">Via SEPA Direct</p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-4">
               <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400">Invoice Items</h4>
               <div className="border border-zinc-100 rounded-[1.5rem] overflow-hidden shadow-[0_10px_30px_-5px_rgba(0,0,0,0.02)] overflow-x-auto no-scrollbar font-black text-[11px] uppercase tracking-tight">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                         <th className="px-6 py-5">Pallet QR</th>
                         <th className="px-6 py-5">Description</th>
                         <th className="px-6 py-5 text-center">Qty</th>
                         <th className="px-6 py-5 text-right">Unit Price</th>
                         <th className="px-6 py-5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {items.map(item => (
                        <tr key={item.id} className="group hover:bg-zinc-50/20 transition-colors">
                          <td className="px-6 py-5 font-mono text-zinc-950">{item.pallet_qr}</td>
                          <td className="px-6 py-5 text-zinc-500 truncate max-w-[200px]">{item.description}</td>
                          <td className="px-6 py-5 text-center text-zinc-950">{item.quantity}</td>
                          <td className="px-6 py-5 text-right text-zinc-400 whitespace-nowrap">€{item.unit_price.toFixed(2)}</td>
                          <td className="px-6 py-5 text-right text-black whitespace-nowrap">€{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-zinc-950 text-white font-black uppercase">
                        <td colSpan={4} className="px-6 py-6 text-right text-[10px] tracking-[0.25em]">Total Payable</td>
                        <td className="px-6 py-6 text-right text-2xl tracking-tighter whitespace-nowrap leading-none">€{invoice.total_amount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
               </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-8 bg-zinc-50/20 border-t border-zinc-100 flex gap-4">
             <Button variant="outline" className="flex-1 rounded-full">
                <Printer size={16} className="mr-2" /> Print PDF
             </Button>
             <Button className="flex-1 shadow-lg shadow-black/10 rounded-full">
                <Download size={16} className="mr-2" /> {t('download')}
             </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
