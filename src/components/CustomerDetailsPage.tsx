import { useEffect, useState, type FormEvent } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import { Button, Card, Input } from './ui';

type FormState = {
  company_name: string; kvk: string; fixed_phone: string; billing_email: string;
  billing_address: string; billing_street: string; billing_postal_code: string; street: string; postal_code: string;
};

const emptyForm: FormState = { company_name: '', kvk: '', fixed_phone: '', billing_email: '', billing_address: '', billing_street: '', billing_postal_code: '', street: '', postal_code: '' };

export function CustomerDetailsPage() {
  const { t, language } = useApp();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => { void apiService.clients.me().then((detail) => {
    if (detail) {
      const billingParts = (detail.billing_address || '').split(',');
      setForm({ company_name: detail.name, kvk: detail.kvk_number || '', fixed_phone: detail.fixed_phone || detail.phone_number || '', billing_email: detail.billing_email || '', billing_address: detail.billing_address || '', street: detail.street || detail.delivery_address || '', postal_code: detail.postal_code || '', billing_street: billingParts[0]?.trim() || '', billing_postal_code: billingParts.slice(1).join(',').trim() || '' });
    }
  }).catch(() => setError(t('customerDetailsLoadError'))).finally(() => setLoading(false)); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setSuccess(false);
    try { await apiService.clients.updateMe({ ...form, billing_address: `${form.billing_street}, ${form.billing_postal_code}` }); setSuccess(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('customerDetailsSaveError')); }
    finally { setSaving(false); }
  };

  return <Card title={t('completeDetails')} className="w-full max-w-none dark:bg-[#101715]">
    {loading ? <p className="py-12 text-center text-sm text-zinc-400">{t('loading')}</p> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <label className="space-y-2 sm:col-span-2 xl:col-span-3"><span className="text-xs font-bold dark:text-zinc-200">{t('companyName')}</span><Input required value={form.company_name} onChange={e => setForm({...form, company_name: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">KvK</span><Input required value={form.kvk} onChange={e => setForm({...form, kvk: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{t('phone')}</span><Input required value={form.fixed_phone} onChange={e => setForm({...form, fixed_phone: e.target.value})} /></label>
      <label className="space-y-2 sm:col-span-2 xl:col-span-3"><span className="text-xs font-bold dark:text-zinc-200">Email</span><Input required type="email" value={form.billing_email} onChange={e => setForm({...form, billing_email: e.target.value})} /></label>
      <p className="sm:col-span-2 xl:col-span-3 text-xs font-bold text-zinc-700 dark:text-zinc-200">{language === 'bs' ? 'Adresa za fakturisanje' : language === 'nl' ? 'Factuuradres' : 'Billing address'}</p>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{language === 'bs' ? 'Ulica i broj' : language === 'nl' ? 'Straat en nummer' : 'Street and number'}</span><Input required value={form.billing_street} onChange={e => setForm({...form, billing_street: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{t('postalCode')}</span><Input required value={form.billing_postal_code} onChange={e => setForm({...form, billing_postal_code: e.target.value})} /></label>
      <p className="sm:col-span-2 xl:col-span-3 text-xs font-bold text-zinc-700 dark:text-zinc-200">{language === 'bs' ? 'Adresa magacina' : language === 'nl' ? 'Magazijnadres' : 'Warehouse address'}</p>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{language === 'bs' ? 'Ulica i broj' : language === 'nl' ? 'Straat en nummer' : 'Street and number'}</span><Input required value={form.street} onChange={e => setForm({...form, street: e.target.value})} /></label>
      <label className="space-y-2"><span className="text-xs font-bold dark:text-zinc-200">{t('postalCode')}</span><Input required value={form.postal_code} onChange={e => setForm({...form, postal_code: e.target.value})} /></label>
      {error && <p className="sm:col-span-2 xl:col-span-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {success && <p className="sm:col-span-2 xl:col-span-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700"><CheckCircle2 size={16}/>{t('customerDetailsSaved')}</p>}
      <Button type="submit" disabled={saving} className="sm:col-span-2 xl:col-span-3"><Building2 size={16}/>{saving ? t('saving') : t('save')}</Button>
    </form>}
  </Card>;
}
