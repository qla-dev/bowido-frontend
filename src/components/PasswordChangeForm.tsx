import { useState, type FormEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button, Input } from './ui';
import { ApiError, apiService } from '../services/api';
import { useApp } from '../AppContext';

export const PasswordChangeForm = () => {
  const { language } = useApp();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const labels = language === 'bs'
    ? {
        title: 'Promjena lozinke', current: 'Trenutna lozinka', next: 'Nova lozinka', confirm: 'Ponovite novu lozinku', save: 'Promijeni lozinku', mismatch: 'Nova lozinka i potvrda se ne podudaraju.', success: 'Lozinka je uspješno promijenjena.', failed: 'Lozinku nije moguće promijeniti.', hint: 'Nova lozinka mora imati najmanje 8 znakova.',
      }
    : language === 'nl'
      ? {
          title: 'Wachtwoord wijzigen', current: 'Huidig wachtwoord', next: 'Nieuw wachtwoord', confirm: 'Herhaal nieuw wachtwoord', save: 'Wachtwoord wijzigen', mismatch: 'Het nieuwe wachtwoord en de bevestiging komen niet overeen.', success: 'Wachtwoord is gewijzigd.', failed: 'Het wachtwoord kon niet worden gewijzigd.', hint: 'Het nieuwe wachtwoord moet minimaal 8 tekens bevatten.',
        }
      : {
          title: 'Change password', current: 'Current password', next: 'New password', confirm: 'Repeat new password', save: 'Change password', mismatch: 'The new password and confirmation do not match.', success: 'Password changed successfully.', failed: 'Unable to change password.', hint: 'Your new password must contain at least 8 characters.',
        };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');

    if (password !== passwordConfirmation) {
      setMessage(labels.mismatch);
      return;
    }

    setIsSaving(true);
    try {
      await apiService.auth.changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      });
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
      setMessage(labels.success);
    } catch (error) {
      const apiError = error instanceof ApiError ? error : null;
      setMessage(apiError?.errors.current_password?.[0] || apiError?.errors.password?.[0] || apiError?.message || labels.failed);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <details className="group mt-4 overflow-hidden rounded-2xl border border-emerald-100 bg-white dark:border-emerald-500/20 dark:bg-[#101715]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-xs font-black uppercase tracking-[0.12em] text-emerald-800 dark:text-emerald-100">{labels.title}</span>
          <span className="mt-1 block text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{labels.hint}</span>
        </span>
        <ChevronDown size={18} className="shrink-0 text-emerald-700 transition-transform group-open:rotate-180 dark:text-emerald-200" />
      </summary>
      <form onSubmit={submit} className="border-t border-emerald-100 bg-emerald-50/50 p-4 dark:border-white/10 dark:bg-emerald-900/20">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {labels.current}
            <Input required autoComplete="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label className="space-y-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {labels.next}
            <Input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <label className="space-y-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {labels.confirm}
            <Input required minLength={8} autoComplete="new-password" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} />
          </label>
        </div>
        {message && <p className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-200" role="status">{message}</p>}
        <Button type="submit" className="mt-4" disabled={isSaving}>{labels.save}</Button>
      </form>
    </details>
  );
};
