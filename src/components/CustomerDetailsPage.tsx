import { useEffect, useState, type FormEvent } from 'react';
import { Hash, MapPin, Save } from 'lucide-react';
import { appAlert } from './AppAlert';
import { useApp } from '../AppContext';
import { apiService } from '../services/api';
import { Button, Card, Input } from './ui';

type FormState = {
  company_name: string; kvk: string; phone_number: string; fixed_phone: string; billing_email: string;
  billing_address: string; billing_street: string; billing_postal_code: string; street: string; house_number: string; postal_code: string; city: string;
  warehouse1_street: string; warehouse1_house_number: string; warehouse1_postal_code: string; warehouse1_city: string;
  warehouse2_street: string; warehouse2_house_number: string; warehouse2_postal_code: string; warehouse2_city: string;
};

const emptyForm: FormState = {
  company_name: '', kvk: '', phone_number: '', fixed_phone: '', billing_email: '', billing_address: '', billing_street: '', billing_postal_code: '', street: '', house_number: '', postal_code: '', city: '',
  warehouse1_street: '', warehouse1_house_number: '', warehouse1_postal_code: '', warehouse1_city: '',
  warehouse2_street: '', warehouse2_house_number: '', warehouse2_postal_code: '', warehouse2_city: '',
};

type AddressCardProps = {
  title: string;
  preview: string;
  fields: Array<[keyof FormState, string, boolean?]>;
  form: FormState;
  onFieldChange: (field: keyof FormState, value: string) => void;
};

const AddressCard = ({ title, preview, fields, form, onFieldChange }: AddressCardProps) => (
  <section className="rounded-[1.25rem] border border-zinc-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#101715]">
    <div className="mb-3 min-w-0">
      <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-100">
        <MapPin size={13} className="shrink-0" />
        {title}
      </div>
      <p className="mt-2 min-h-8 rounded-lg bg-emerald-50/70 px-2.5 py-1.5 text-[9px] font-bold leading-4 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-100">
        {preview}
      </p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map(([field, label, required]) => (
        <label key={field} className="text-[8px] font-black uppercase tracking-wider text-zinc-500">
          {label}
          <Input required={required} value={form[field]} onChange={(event) => onFieldChange(field, event.target.value)} className="mt-1 h-10 bg-zinc-50 px-3 text-[11px] normal-case tracking-normal dark:bg-[#151d1a]" />
        </label>
      ))}
    </div>
  </section>
);

export function CustomerDetailsPage() {
  const { t, language } = useApp();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const labels = {
    registration: language === 'bs' ? 'Registracijski podaci' : language === 'nl' ? 'Registratiegegevens' : 'Registration details',
    companyAddress: language === 'bs' ? 'Adresa firme' : language === 'nl' ? 'Bedrijfsadres' : 'Company address',
    warehouse1: language === 'bs' ? 'Magacin 1' : language === 'nl' ? 'Magazijn 1' : 'Warehouse 1',
    warehouse2: language === 'bs' ? 'Magacin 2' : language === 'nl' ? 'Magazijn 2' : 'Warehouse 2',
    mobile: language === 'bs' ? 'Broj telefona' : language === 'nl' ? 'Telefoonnummer' : 'Phone number',
    houseNumber: language === 'bs' ? 'Kućni broj' : language === 'nl' ? 'Huisnummer' : 'House number',
    city: language === 'bs' ? 'Grad' : language === 'nl' ? 'Plaats' : 'City',
  };

  useEffect(() => {
    void apiService.clients.me().then((detail) => {
      if (!detail) return;
      const billingParts = (detail.billing_address || '').split(',');
      setForm({
        company_name: detail.name, kvk: detail.kvk_number || '', phone_number: detail.phone_number || '', fixed_phone: detail.fixed_phone || '', billing_email: detail.billing_email || '', billing_address: detail.billing_address || '',
        street: detail.street || detail.delivery_address || '', house_number: detail.house_number || '', postal_code: detail.postal_code || '', city: detail.city || '',
        billing_street: billingParts[0]?.trim() || '', billing_postal_code: billingParts.slice(1).join(',').trim() || '',
        warehouse1_street: detail.warehouse1_street || '', warehouse1_house_number: detail.warehouse1_house_number || '', warehouse1_postal_code: detail.warehouse1_postal_code || '', warehouse1_city: detail.warehouse1_city || '',
        warehouse2_street: detail.warehouse2_street || '', warehouse2_house_number: detail.warehouse2_house_number || '', warehouse2_postal_code: detail.warehouse2_postal_code || '', warehouse2_city: detail.warehouse2_city || '',
      });
    }).catch(() => setError(t('customerDetailsLoadError'))).finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await apiService.clients.updateMe({ ...form, billing_address: `${form.billing_street}, ${form.billing_postal_code}` });
      await appAlert.fire({
        icon: 'success',
        title: t('customerDetailsSaved'),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('customerDetailsSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((current) => ({ ...current, [field]: value }));
  const addressPreview = (street: string, houseNumber: string, postalCode: string, city: string) =>
    [[street, houseNumber].filter(Boolean).join(' '), [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—';

  return (
    <Card title={t('completeDetails')} className="w-full max-w-none dark:bg-[#101715]">
      {loading ? <p className="py-12 text-center text-sm text-zinc-400">{t('loading')}</p> : (
        <form onSubmit={submit} className="space-y-3">
          <section className="rounded-[1.25rem] border border-zinc-200 bg-white p-3.5 dark:border-white/10 dark:bg-[#101715]">
            <div className="mb-3 flex items-center gap-2">
              <Hash size={14} className="text-emerald-700 dark:text-emerald-200" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-100">{labels.registration}</h2>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-6 xl:grid-cols-12">
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:col-span-2 xl:col-span-3">KVK
                <Input required value={form.kvk} onChange={(event) => setField('kvk', event.target.value)} className="mt-1 h-10 bg-zinc-50 normal-case tracking-normal dark:bg-[#151d1a]" />
              </label>
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:col-span-4 xl:col-span-9">{t('companyName')}
                <Input required value={form.company_name} onChange={(event) => setField('company_name', event.target.value)} className="mt-1 h-10 bg-zinc-50 normal-case tracking-normal dark:bg-[#151d1a]" />
              </label>
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:col-span-3 xl:col-span-6">Email
                <Input required type="email" value={form.billing_email} onChange={(event) => setField('billing_email', event.target.value)} className="mt-1 h-10 bg-zinc-50 normal-case tracking-normal dark:bg-[#151d1a]" />
              </label>
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:col-span-3 xl:col-span-3">{labels.mobile}
                <Input value={form.phone_number} onChange={(event) => setField('phone_number', event.target.value)} className="mt-1 h-10 bg-zinc-50 normal-case tracking-normal dark:bg-[#151d1a]" />
              </label>
              <label className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:col-span-3 xl:col-span-3">{t('phone')}
                <Input required value={form.fixed_phone} onChange={(event) => setField('fixed_phone', event.target.value)} className="mt-1 h-10 bg-zinc-50 normal-case tracking-normal dark:bg-[#151d1a]" />
              </label>
            </div>
          </section>

          <div className="space-y-3">
            <AddressCard title={labels.companyAddress} preview={addressPreview(form.street, form.house_number, form.postal_code, form.city)} form={form} onFieldChange={setField} fields={[
              ['street', t('street'), true], ['house_number', labels.houseNumber], ['postal_code', t('postalCode'), true], ['city', labels.city],
            ]} />
            <AddressCard title={labels.warehouse1} preview={addressPreview(form.warehouse1_street, form.warehouse1_house_number, form.warehouse1_postal_code, form.warehouse1_city)} form={form} onFieldChange={setField} fields={[
              ['warehouse1_street', t('street')], ['warehouse1_house_number', labels.houseNumber], ['warehouse1_postal_code', t('postalCode')], ['warehouse1_city', labels.city],
            ]} />
            <AddressCard title={labels.warehouse2} preview={addressPreview(form.warehouse2_street, form.warehouse2_house_number, form.warehouse2_postal_code, form.warehouse2_city)} form={form} onFieldChange={setField} fields={[
              ['warehouse2_street', t('street')], ['warehouse2_house_number', labels.houseNumber], ['warehouse2_postal_code', t('postalCode')], ['warehouse2_city', labels.city],
            ]} />
          </div>

          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          <Button type="submit" disabled={saving} className="h-12 w-full justify-center gap-2"><Save size={15} />{saving ? t('saving') : t('save')}</Button>
        </form>
      )}
    </Card>
  );
}
