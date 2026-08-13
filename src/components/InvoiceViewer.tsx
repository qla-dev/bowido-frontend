import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { FileText, Download, X, Printer, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { Invoice, InvoiceItem } from '../types';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import { Button, Card, Badge } from './ui';
import { formatAppDate } from '../lib/dateFormat';
import { formatInvoiceItemDescription } from '../i18n';

interface InvoiceViewerProps {
  invoice: Invoice;
  onClose: () => void;
  allowSending?: boolean;
}

export const InvoiceViewer: React.FC<InvoiceViewerProps> = ({ invoice, onClose, allowSending = true }) => {
  const { t, language } = useApp();
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'preview' | 'download' | 'send' | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const customerTaxLabel = invoice.customer_vat || invoice.customer_kvk || '-';
  const customerAddress = invoice.billing_address || invoice.delivery_address || '-';
  const customerEmail = invoice.customer_email || '';
  const getStatusLabel = (status: Invoice['status']) => {
    if (status === 'paid') return t('paid');
    if (status === 'overdue') return t('overdue');
    if (status === 'sent') return t('sentLabel');
    if (status === 'issued') return t('issued');
    return status;
  };

  useEffect(() => {
    const loadItems = async () => {
      try {
        const data = await apiService.invoices.getItems(invoice.id);
        setItems(data);
      } catch (error) {
        console.error('Failed to load invoice items', error);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    loadItems();
  }, [invoice.id]);

  const openPreview = async () => {
    setActionLoading('preview'); setActionMessage('');
    try { const blob = await apiService.invoices.preview(invoice.id); const url = URL.createObjectURL(blob); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch { setActionMessage(t('invoicePreviewFailed')); } finally { setActionLoading(null); }
  };
  const downloadPdf = async () => {
    setActionLoading('download'); setActionMessage('');
    try { const blob = await apiService.invoices.download(invoice.id); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `Bowido-${invoice.invoice_number}-NL.pdf`; anchor.click(); URL.revokeObjectURL(url); }
    catch { setActionMessage(t('invoiceDownloadFailed')); } finally { setActionLoading(null); }
  };
  const sendInvoice = async () => {
    setActionLoading('send'); setActionMessage('');
    try { const result = await apiService.invoices.send(invoice.id); setActionMessage(t('invoiceSentTo').replace(':recipient', result.recipient)); }
    catch { setActionMessage(t('invoiceEmailFailed')); } finally { setActionLoading(null); }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="my-auto w-full max-w-4xl"
      >
        <Card
          noPadding
          className="flex h-[calc(100dvh-1.5rem)] max-h-[90vh] flex-col overflow-hidden rounded-[2rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.2)] sm:h-[calc(100dvh-2rem)] sm:rounded-[3rem]"
          contentClassName="flex min-h-0 flex-1 flex-col"
        >
          {/* Header */}
          <div className="shrink-0 border-b border-zinc-100 bg-zinc-50/20 p-5 sm:p-8 flex justify-between items-center">
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

          <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-6 md:p-8">
            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-2">{t('billedTo')}</h4>
                  <p className="text-lg font-black text-black leading-none uppercase tracking-tight">{invoice.customer_name}</p>
                  {customerEmail && (
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1 break-all">{customerEmail}</p>
                  )}
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">{t('taxId')}: {customerTaxLabel}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight leading-relaxed max-w-xs mt-2">{customerAddress}</p>
                </div>
                <div className="flex gap-12">
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-1">{t('issueDate')}</h4>
                    <p className="text-xs font-black text-black uppercase">{formatAppDate(invoice.issue_date, language)}</p>
                  </div>
                  <div>
                    <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 mb-1">{t('dueDate')}</h4>
                    <p className="text-xs font-black text-rose-600 uppercase">{formatAppDate(invoice.due_date, language)}</p>
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
                         {getStatusLabel(invoice.status)}
                      </p>
                    </div>
                 </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-4">
               <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400">{t('invoiceItems')}</h4>
               <div className="border border-zinc-100 rounded-[1.5rem] overflow-hidden shadow-[0_10px_30px_-5px_rgba(0,0,0,0.02)] overflow-x-auto no-scrollbar font-black text-[11px] uppercase tracking-tight">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 text-[9px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                         <th className="px-6 py-5">{t('palletLabel')}</th>
                         <th className="px-6 py-5">{t('descriptionLabel')}</th>
                         <th className="px-6 py-5 text-center">{t('quantity')}</th>
                         <th className="px-6 py-5 text-right">{t('unitPrice')}</th>
                         <th className="px-6 py-5 text-right">{t('totalPayable')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {!loading && items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-zinc-300">
                            {t('noInvoiceItems')}
                          </td>
                        </tr>
                      )}
                      {items.map(item => (
                        <tr key={item.id} className="group hover:bg-zinc-50/20 transition-colors">
                          <td className="px-6 py-5 text-zinc-950">{item.pallet_name || '-'}</td>
                          <td className="px-6 py-5 text-zinc-500 truncate max-w-[200px]">{formatInvoiceItemDescription(item.description, language)}</td>
                          <td className="px-6 py-5 text-center text-zinc-950">{item.quantity}</td>
                          <td className="px-6 py-5 text-right text-zinc-400 whitespace-nowrap">€{item.unit_price.toFixed(2)}</td>
                          <td className="px-6 py-5 text-right text-black whitespace-nowrap">€{item.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-zinc-950 text-white font-black uppercase">
                        <td colSpan={4} className="px-6 py-6 text-right text-[10px] tracking-[0.25em]">{t('totalPayable')}</td>
                        <td className="px-6 py-6 text-right text-2xl tracking-tighter whitespace-nowrap leading-none">€{invoice.total_amount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
               </div>
            </div>
          </div>

          {/* Footer Actions */}
          {actionMessage && <p className="px-8 pt-4 text-sm font-bold text-emerald-700">{actionMessage}</p>}
          <div className="shrink-0 border-t border-zinc-100 bg-zinc-50/20 p-5 sm:p-8 flex flex-wrap gap-4">
             <Button variant="outline" className="flex-1 rounded-full" onClick={openPreview} disabled={Boolean(actionLoading)}>
                <Printer size={16} className="mr-2" /> {t('previewInvoice')}
             </Button>
             {allowSending && (
               <Button variant="outline" className="flex-1 rounded-full" onClick={sendInvoice} disabled={Boolean(actionLoading)}>
                  <Send size={16} className="mr-2" /> {t('sendInvoice')}
               </Button>
             )}
             <Button className="flex-1 shadow-lg shadow-black/10 rounded-full" onClick={downloadPdf} disabled={Boolean(actionLoading)}>
                <Download size={16} className="mr-2" /> {t('exportInvoice')}
             </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
