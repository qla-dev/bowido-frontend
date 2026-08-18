import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { ApiError, apiService } from '../services/api';
import { RoleType, type User } from '../types';
import { Button, Input } from './ui';

type FirstTimeLoginModalProps = {
  user: User;
  language: string;
  onCompleted: (user: User, reviewCustomerDetails: boolean) => void;
};

const copyFor = (language: string) => {
  if (language === 'bs') {
    return {
      title: 'Dobro došli u Trackpal',
      intro: 'Ovo je vaša prva prijava. Ispod možete postaviti novu lozinku ili zadržati dodijeljenu lozinku.',
      newPassword: 'Nova lozinka', confirmPassword: 'Potvrdite lozinku', save: 'Sačuvaj lozinku', keep: 'Zadrži trenutnu lozinku',
      mismatch: 'Lozinke se ne podudaraju.', required: 'Unesite novu lozinku od najmanje 8 znakova.', failed: 'Lozinka nije mogla biti sačuvana.',
      savedTitle: 'Lozinka je sačuvana', savedText: 'Vaša lozinka je sačuvana. Sada provjerite podatke o firmi i kontaktu.', review: 'Provjeri podatke', showPassword: 'Prikaži lozinku', hidePassword: 'Sakrij lozinku',
    };
  }
  if (language === 'en') {
    return {
      title: 'Welcome to Trackpal',
      intro: 'This is your first login. You can set a new password below or keep the assigned password.',
      newPassword: 'New password', confirmPassword: 'Confirm password', save: 'Save password', keep: 'Keep current password',
      mismatch: 'The passwords do not match.', required: 'Enter a new password of at least 8 characters.', failed: 'The password could not be saved.',
      savedTitle: 'Password saved', savedText: 'Your password has been saved. Now check your company and contact details.', review: 'Check details', showPassword: 'Show password', hidePassword: 'Hide password',
    };
  }

  return {
    title: 'Welkom bij Trackpal',
    intro: 'Dit is de eerste keer dat u inlogt. U kunt hieronder een nieuw wachtwoord instellen of ervoor kiezen om het toegewezen wachtwoord te behouden.',
    newPassword: 'Nieuw wachtwoord', confirmPassword: 'Bevestig wachtwoord', save: 'Wachtwoord opslaan', keep: 'Huidig wachtwoord behouden',
    mismatch: 'De wachtwoorden komen niet overeen.', required: 'Vul een nieuw wachtwoord van minimaal 8 tekens in.', failed: 'Het wachtwoord kon niet worden opgeslagen.',
    savedTitle: 'Wachtwoord opgeslagen', savedText: 'Uw wachtwoord is opgeslagen. Controleer nu uw bedrijfs- en contactgegevens om er zeker van te zijn dat alles correct is.', review: 'Gegevens controleren', showPassword: 'Wachtwoord tonen', hidePassword: 'Wachtwoord verbergen',
  };
};

export const FirstTimeLoginModal = ({ user, language, onCompleted }: FirstTimeLoginModalProps) => {
  const copy = copyFor(language);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedCustomer, setCompletedCustomer] = useState<User | null>(null);

  const finish = (updatedUser: User) => {
    if (updatedUser.role_name === RoleType.KLIJENT) {
      setCompletedCustomer(updatedUser);
      return;
    }

    onCompleted(updatedUser, false);
  };

  const submitPassword = async () => {
    if (password.length < 8) {
      setError(copy.required);
      return;
    }
    if (password !== confirmation) {
      setError(copy.mismatch);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      finish(await apiService.auth.completeFirstLogin({ password, password_confirmation: confirmation }));
    } catch (requestError) {
      const validationMessage = requestError instanceof ApiError
        ? Object.values(requestError.errors).flat()[0]
        : null;
      setError(validationMessage || (requestError instanceof Error ? requestError.message : copy.failed));
    } finally {
      setIsSubmitting(false);
    }
  };

  const keepPassword = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      finish(await apiService.auth.keepFirstLoginPassword());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.failed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[300] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="first-login-title">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-[#0f1513]">
        <div className="h-2 bg-[#00A655]" />
        {completedCustomer ? (
          <div className="p-8 text-center sm:p-10">
            <CheckCircle2 className="mx-auto h-14 w-14 text-[#00A655]" />
            <h2 id="first-login-title" className="mt-5 text-2xl font-black uppercase tracking-tight text-emerald-950 dark:text-white">{copy.savedTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{copy.savedText}</p>
            <Button className="mt-7 w-full" onClick={() => onCompleted(completedCustomer, true)}>{copy.review}</Button>
          </div>
        ) : (
          <div className="p-7 sm:p-9">
            <div className="flex items-start gap-4">
              <span className="rounded-2xl bg-emerald-50 p-3 text-[#00A655] dark:bg-emerald-500/10"><KeyRound size={24} /></span>
              <div>
                <h2 id="first-login-title" className="text-2xl font-black uppercase tracking-tight text-emerald-950 dark:text-white">{copy.title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{copy.intro}</p>
              </div>
            </div>

            <div className="mt-7 space-y-4">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
                {copy.newPassword}
                <div className="relative mt-1">
                  <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} className="pr-12" />
                  <button type="button" aria-label={showPassword ? copy.hidePassword : copy.showPassword} onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-200">
                {copy.confirmPassword}
                <Input type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={isSubmitting} className="mt-1" />
              </label>
            </div>

            {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => void keepPassword()} disabled={isSubmitting}>{copy.keep}</Button>
              <Button type="button" onClick={() => void submitPassword()} disabled={isSubmitting}>{isSubmitting ? '...' : copy.save}</Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
