import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Badge, Button, cn } from './ui';
import { InvoiceViewer } from './InvoiceViewer';
import { useApp } from '../AppContext';
import { ClientDetail, Invoice } from '../types';
import { PageLoadingModal } from './PageLoadingModal';
import { apiService } from '../services/api';
import { formatAppDateTime } from '../lib/dateFormat';
import { AdminDataTable, adminTableStyles } from './AdminDataTable';
import { AdminClientManagerView } from './AdminClientManagerView';

interface BillingListProps {
  onBack?: () => void;
  compact?: boolean;
}

type SelectedCustomer = {
  id: number;
  name: string;
};

type InvoiceColumn = 'number' | 'status' | 'created' | 'mailed' | 'amount';

const invoiceColumns: readonly InvoiceColumn[] = ['number', 'status', 'created', 'mailed', 'amount'];
const invoiceWidths: Record<InvoiceColumn, number> = { number: 220, status: 170, created: 215, mailed: 215, amount: 175 };
const invoiceMinWidths: Record<InvoiceColumn, number> = { number: 150, status: 130, created: 170, mailed: 170, amount: 130 };

export const BillingList: React.FC<BillingListProps> = () => {
  const { t, language } = useApp();
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const selectionRequestId = useRef(0);
  const { headerCellClass, headerContentClass, bodyCellClass, bodyCellInnerClass, bodyTextClass } = adminTableStyles;

  const statusLabel = (status: Invoice['status']) => {
    if (status === 'paid') return t('paid');
    if (status === 'overdue') return t('overdue');
    if (status === 'sent') return t('sentLabel');
    if (status === 'issued') return t('issued');
    return status;
  };
  const formatAmount = (amount: number) => `€${amount.toFixed(2)}`;
  const notMailedLabel = t('notMailedYet');
  const payableAmount = customerInvoices
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((total, invoice) => total + invoice.total_amount, 0);

  const openCustomerInvoices = (client: ClientDetail) => {
    const requestId = selectionRequestId.current + 1;
    selectionRequestId.current = requestId;
    setSelectedCustomer({ id: client.user_id, name: client.name });
    setCustomerInvoices([]);
    setIsInvoicesLoading(true);

    void apiService.invoices
      .list({ user_id: client.user_id, sort_by: 'created_at', sort_direction: 'desc' })
      .then((invoices) => {
        if (selectionRequestId.current === requestId) setCustomerInvoices(invoices);
      })
      .catch((error) => {
        console.error('Failed to load customer invoices', error);
        if (selectionRequestId.current === requestId) setCustomerInvoices([]);
      })
      .finally(() => {
        if (selectionRequestId.current === requestId) setIsInvoicesLoading(false);
      });
  };

  const closeCustomerInvoices = () => {
    selectionRequestId.current += 1;
    setSelectedCustomer(null);
    setCustomerInvoices([]);
    setIsInvoicesLoading(false);
  };

  return (
    <div className="space-y-4">
      <AdminClientManagerView
        readOnly
        onClientSelect={openCustomerInvoices}
        title={t('billing')}
        description={t('managePayments')}
      />

      {selectedCustomer && (
        <div className="modal-overlay fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={selectedCustomer.name} onClick={closeCustomerInvoices}>
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="my-auto w-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
            <div className="max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-[2rem] bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.28)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-[3rem]">
              <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/40 p-5 sm:p-7">
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-black">{selectedCustomer.name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{customerInvoices.length} {t('invoicesLabel')}</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="hidden text-right text-sm font-black text-black sm:block">{t('payableAmount')}: {formatAmount(payableAmount)}</p>
                  <Button variant="ghost" size="sm" onClick={closeCustomerInvoices} className="h-10 w-10 rounded-full p-0 text-zinc-400" aria-label={t('close')}><X size={18} /></Button>
                </div>
              </div>
              <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-4 sm:p-6">
                <p className="mb-4 text-sm font-black text-black sm:hidden">{t('payableAmount')}: {formatAmount(payableAmount)}</p>
                <AdminDataTable<InvoiceColumn>
                  columnOrder={invoiceColumns}
                  initialColumnWidths={invoiceWidths}
                  minColumnWidths={invoiceMinWidths}
                  resizeAriaLabel={t('resizeColumn')}
                  isEmpty={!isInvoicesLoading && customerInvoices.length === 0}
                  emptyState={<div className="p-16 text-center text-[10px] font-black uppercase tracking-widest text-zinc-300">{t('noMatchingResults')}</div>}
                  renderTable={({ columnWidths, totalTableWidth, registerHeaderCell, renderResizeHandle }) => (
                    <table className="border-collapse text-left [table-layout:fixed]" style={{ width: `max(100%, ${totalTableWidth}px)` }}>
                      <colgroup>{invoiceColumns.map((key) => <col key={key} style={{ width: columnWidths[key] }} />)}</colgroup>
                      <thead className="border-b border-zinc-200 bg-zinc-50/80"><tr>
                        {invoiceColumns.map((key) => {
                          const label = key === 'number' ? t('invoiceNumber') : key === 'status' ? t('status') : key === 'created' ? t('createdAt') : key === 'mailed' ? t('mailedAt') : t('payableAmount');
                          return <th key={key} ref={registerHeaderCell(key)} className={cn(headerCellClass, 'group')}><div className={headerContentClass}><span className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-800">{label}</span></div>{renderResizeHandle(key)}</th>;
                        })}
                      </tr></thead>
                      <tbody className="divide-y divide-zinc-100">
                        {customerInvoices.map((invoice, index) => (
                          <motion.tr key={invoice.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.01 }} onClick={() => setSelectedInvoice(invoice)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedInvoice(invoice); } }} tabIndex={0} role="button" className="cursor-pointer transition-colors hover:bg-zinc-50/60 focus-visible:bg-zinc-50 focus-visible:outline-none">
                            <td className={bodyCellClass}><div className={bodyCellInnerClass}><span className={cn(bodyTextClass, 'text-zinc-900')}>{invoice.invoice_number}</span></div></td>
                            <td className={bodyCellClass}><div className={bodyCellInnerClass}><Badge variant={invoice.status === 'paid' ? 'success' : 'danger'}>{statusLabel(invoice.status)}</Badge></div></td>
                            <td className={bodyCellClass}><div className={bodyCellInnerClass}><span className={cn(bodyTextClass, 'text-zinc-500')}>{formatAppDateTime(invoice.created_at, language)}</span></div></td>
                            <td className={bodyCellClass}><div className={bodyCellInnerClass}><span className={cn(bodyTextClass, 'text-zinc-500')}>{invoice.mailed_at ? formatAppDateTime(invoice.mailed_at, language) : notMailedLabel}</span></div></td>
                            <td className={bodyCellClass}><div className={bodyCellInnerClass}><span className={cn(bodyTextClass, 'text-zinc-900')}>{formatAmount(invoice.total_amount)}</span></div></td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                />
                <PageLoadingModal isOpen={isInvoicesLoading} language={language} />
              </div>
            </div>
          </motion.div>
        </div>
      )}
      {selectedInvoice && <InvoiceViewer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
    </div>
  );
};
