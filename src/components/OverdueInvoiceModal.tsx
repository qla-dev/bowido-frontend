import React from 'react';
import { motion } from 'motion/react';
import { Badge, Button, Card } from './ui';
import { CheckCircle2, Clock3, FileText, Mail, Package, Send, X } from 'lucide-react';

export interface OverdueInvoicePreview {
  id: number;
  invoice_number: string;
  pallet_id: number;
  pallet_qr: string;
  customer_name: string;
  recipient_email: string;
  user_id: number;
  billing_period_start: string;
  billing_period_end: string;
  total_amount: number;
  status: 'active' | 'sent';
  issued_at: string;
  created_at: string;
  updated_at: string;
  overdue_days: number;
  rate_per_day: number;
  location: string;
}

interface OverdueInvoiceModalProps {
  invoice: OverdueInvoicePreview;
  onClose: () => void;
  onSend: () => void;
}

export const OverdueInvoiceModal: React.FC<OverdueInvoiceModalProps> = ({
  invoice,
  onClose,
  onSend,
}) => {
  return (
    <div className="modal-overlay fixed inset-0 z-[150] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        <Card noPadding className="overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.18)] rounded-[2rem]">
          <div className="px-6 md:px-8 py-5 border-b border-zinc-100 bg-zinc-50/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#00A655] text-white flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-emerald-950 font-display">
                  Pregled fakture
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 truncate">
                  {invoice.invoice_number} / {invoice.pallet_qr}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-10 w-10 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:border-emerald-300 hover:text-emerald-700 transition-all flex items-center justify-center shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 md:p-8">
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-zinc-200 bg-white">
                  <div className="flex items-center gap-2 mb-3 text-zinc-400">
                    <Mail size={15} />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">Primaoc</span>
                  </div>
                  <p className="text-lg font-black uppercase tracking-tight text-emerald-950">
                    {invoice.customer_name}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 mt-2 break-all">
                    {invoice.recipient_email}
                  </p>
                </div>

                <div className="p-5 rounded-2xl border border-zinc-200 bg-white">
                  <div className="flex items-center gap-2 mb-3 text-zinc-400">
                    <Package size={15} />
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">Paleta</span>
                  </div>
                  <p className="text-lg font-black uppercase tracking-tight text-emerald-950">
                    {invoice.pallet_qr}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400 mt-2">
                    {invoice.location}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-[1.75rem] border border-rose-100 bg-rose-50/60">
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-rose-500">
                      Overdue obracun
                    </p>
                    <p className="text-3xl font-black tracking-tight text-rose-600 mt-2">
                      EUR {invoice.total_amount.toFixed(2)}
                    </p>
                  </div>
                  <Badge variant={invoice.status === 'sent' ? 'success' : 'warning'}>
                    {invoice.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                      Dana kasnjenja
                    </p>
                    <p className="text-lg font-black uppercase tracking-tight text-zinc-900 mt-2">
                      {invoice.overdue_days}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                      Cijena po danu
                    </p>
                    <p className="text-lg font-black uppercase tracking-tight text-zinc-900 mt-2">
                      EUR {invoice.rate_per_day.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-[1.75rem] border border-zinc-200 bg-zinc-50/70">
                <div className="flex items-center gap-2 mb-4 text-zinc-400">
                  {invoice.status === 'sent' ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                  <span className="text-[9px] font-black uppercase tracking-[0.16em]">
                    Status slanja
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                      Izdato
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                      {invoice.issued_at}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
                      Zadnji update
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                      {invoice.updated_at}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 md:px-8 py-5 border-t border-zinc-100 bg-zinc-50/50 flex flex-col sm:flex-row gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Zatvori
            </Button>
            <Button
              className="flex-1"
              onClick={onSend}
              disabled={invoice.status === 'sent'}
            >
              <Send size={15} className="mr-2" />
              {invoice.status === 'sent' ? 'Faktura poslana' : 'Posalji fakturu'}
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
