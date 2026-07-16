import { useEffect, useState, type FormEvent } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import { Button, Card, Input, Select } from './ui';

type FormState = {
  company_name: string; kvk: string; fixed_phone: string; billing_email: string;
  street: string; postal_code: string; warehouse_scope: 'warehouse_nl' | 'warehouse_bih';
};

const emptyForm: FormState = { company_name: '', kvk: '', fixed_phone: '', billing_email: '', street: '', postal_code: '', warehouse_scope: 'warehouse_nl' };

export function CustomerDetailsPage() {
  const { t } = useApp();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { void apiService.clients.me().then((detail) => {
    if (detail) setForm({ company_name: detail.name, kvk: detail.kvk_number || '', fixed_phone: detail.fixed_phone || detail.phone_number || '', billing_email: detail.billing_email || '', street: detail.street || detail.warehouse_addresses?.[0] || '', postal_code: detail.postal_code || '', warehouse_scope: detail.warehouse_scope || 'warehouse_nl' });
  }).catch(() => setError(t('customerDetailsLoadError'))).finally(() => setLoading(false)); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess(false);
    try { await apiService.clients.updateMe(form); setSuccess(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('customerDetailsSaveError')); }
    finally { setSaving(false); }
  };

  return <Card title={t('completeDetails')} className="w-full max-w-none dark:bg-[#101715]">
    {loading ? <p className="py-12 text-center text-sm text-zinc-400">{t('loading')}</p> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 sm:col-span-2 xl:col-span-3"><span className="text-xs font-bold dark:text-zinc-200">{t('companyName')}</span><Input required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">KvK</span><Input required value={form.kvk} onChange={e => setForm({...form, kvk: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{t('phone')}</span><Input required value={form.fixed_phone} onChange={e => setForm({...form, fixed_phone: e.target.value})} /></label>
      <label className="space-y-2 sm:col-span-2 xl:col-span-3"><span className="text-xs font-bold dark:text-zinc-200">Email</span><Input required type="email" value={form.billing_email} onChange={e => setForm({...form, billing_email: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{t('street')}</span><Input required value={form.street} onChange={e => setForm({...form, street: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{t('postalCode')}</span><Input required value={form.postal_code} onChange={e => setForm({...form, postal_code: e.target.value})} /></label>
      <label className="space-y-2 sm:col-span-2 xl:col-span-3"><span className="text-xs font-bold dark:text-zinc-200">{t('warehouse')}</span><Select value={form.warehouse_scope} onChange={e => setForm({...form, warehouse_scope: e.target.value as FormState['warehouse_scope']})}><option value="warehouse_nl">Bowido NL</option><option value="warehouse_bih">Bowido BiH</option></Select></label>
      {error && <p className="sm:col-span-2 xl:col-span-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p className="sm:col-span-2 xl:col-span-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={16}/>{t('customerDetailsSaved')}</p>}
      <Button type="submit" disabled={saving} className="sm:col-span-2 xl:col-span-3"><Building2 size={16}/>{saving ? t('saving') : t('save')}</Button>
    </form>}
  </Card>;
}
