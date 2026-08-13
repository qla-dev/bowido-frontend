import { useEffect, useMemo, useState } from 'react';
import { Check, LoaderCircle, Mail, Search, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ApiError, apiService } from '../services/api';
import { RoleType, type ManagedUser } from '../types';
import { Button, Input, cn } from './ui';

type CredentialFilter = 'all' | 'customers' | 'other';

export const toggleVisibleCredentialSelection = (
  selectedIds: Set<number>,
  visibleIds: number[],
  allVisibleSelected: boolean,
) => {
  const next = new Set(selectedIds);
  visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id));
  return next;
};

type CredentialDistributionModalProps = {
  language: string;
  onClose: () => void;
};

const labelsFor = (language: string) => language === 'nl' ? {
  title: 'Inloggegevens versturen', subtitle: 'De geselecteerde gebruikers krijgen een nieuw tijdelijk wachtwoord per e-mail.',
  all: 'Alle', customers: 'Klanten', other: 'Andere gebruikers', search: 'Zoek op naam of e-mail',
  selectAll: 'Selecteer alles in dit filter', selected: 'geselecteerd', empty: 'Geen gebruikers gevonden.', cancel: 'Annuleren', send: 'Inloggegevens versturen',
  loading: 'Gebruikers laden...', failedLoad: 'Gebruikers konden niet worden geladen.', failedSend: 'Inloggegevens konden niet worden verstuurd.', sent: 'Inloggegevens verstuurd', partial: 'Niet alle e-mails zijn verstuurd',
} : language === 'bs' ? {
  title: 'Pošalji podatke za prijavu', subtitle: 'Odabrani korisnici će e-mailom dobiti novu privremenu lozinku.',
  all: 'Svi', customers: 'Klijenti', other: 'Ostali korisnici', search: 'Pretraži ime ili e-mail',
  selectAll: 'Odaberi sve u ovom filteru', selected: 'odabrano', empty: 'Nema korisnika.', cancel: 'Otkaži', send: 'Pošalji podatke',
  loading: 'Učitavanje korisnika...', failedLoad: 'Korisnici se nisu mogli učitati.', failedSend: 'Podaci se nisu mogli poslati.', sent: 'Podaci za prijavu su poslani', partial: 'Nisu svi e-mailovi poslani',
} : {
  title: 'Send login details', subtitle: 'Selected users will receive a new temporary password by email.',
  all: 'All', customers: 'Customers', other: 'Other users', search: 'Search by name or email',
  selectAll: 'Select all in this filter', selected: 'selected', empty: 'No users found.', cancel: 'Cancel', send: 'Send login details',
  loading: 'Loading users...', failedLoad: 'Users could not be loaded.', failedSend: 'Login details could not be sent.', sent: 'Login details sent', partial: 'Not all emails were sent',
};

export const CredentialDistributionModal = ({ language, onClose }: CredentialDistributionModalProps) => {
  const labels = labelsFor(language);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [filter, setFilter] = useState<CredentialFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    apiService.users.list({ is_active: true })
      .then((result) => mounted && setUsers(result))
      .catch(() => mounted && setFeedback({ kind: 'error', text: labels.failedLoad }))
      .finally(() => mounted && setIsLoading(false));
    return () => { mounted = false; };
  }, []);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return users.filter((user) => {
      const matchesFilter = filter === 'all'
        || (filter === 'customers' ? user.role_name === RoleType.KLIJENT : user.role_name !== RoleType.KLIJENT);
      return matchesFilter && (!query || `${user.name} ${user.email}`.toLocaleLowerCase().includes(query));
    });
  }, [filter, search, users]);

  const allVisibleSelected = visibleUsers.length > 0 && visibleUsers.every((user) => selectedIds.has(user.id));

  const toggleAllVisible = () => setSelectedIds((current) => toggleVisibleCredentialSelection(
    current,
    visibleUsers.map((user) => user.id),
    allVisibleSelected,
  ));

  const send = async () => {
    if (selectedIds.size === 0) return;
    setIsSending(true);
    setFeedback(null);
    try {
      const result = await apiService.users.sendLoginDetails([...selectedIds]);
      if (result.failed.length > 0) {
        setFeedback({ kind: 'error', text: `${labels.partial}: ${result.sent.length} / ${selectedIds.size}.` });
        setSelectedIds(new Set(result.failed.map((item) => item.id)));
      } else {
        setFeedback({ kind: 'success', text: `${labels.sent}: ${result.sent.length}.` });
        setSelectedIds(new Set());
      }
    } catch (error) {
      setFeedback({ kind: 'error', text: error instanceof ApiError ? error.message : labels.failedSend });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-overlay fixed inset-0 z-[180] flex items-center justify-center p-4" onClick={() => !isSending && onClose()} role="dialog" aria-modal="true" aria-labelledby="credentials-title">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-[#0f1513]" onClick={(event) => event.stopPropagation()}>
        <div className="h-2 shrink-0 bg-[#00A655]" />
        <div className="flex items-start justify-between gap-4 px-7 pt-7">
          <div><h2 id="credentials-title" className="text-2xl font-black uppercase tracking-tight text-emerald-950 dark:text-white">{labels.title}</h2><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-300">{labels.subtitle}</p></div>
          <button type="button" onClick={onClose} disabled={isSending} className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"><X size={20} /></button>
        </div>

        <div className="mt-6 flex min-h-0 flex-1 flex-col px-7">
          <div className="flex flex-wrap gap-2">
            {(['all', 'customers', 'other'] as CredentialFilter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={cn('rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-wide', filter === item ? 'border-[#00A655] bg-[#00A655] text-white' : 'border-zinc-200 text-zinc-500 dark:border-white/10 dark:text-zinc-300')}>{labels[item]}</button>)}
          </div>
          <div className="relative mt-4"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.search} className="pl-11" /></div>
          <button type="button" onClick={toggleAllVisible} disabled={visibleUsers.length === 0} className="mt-4 flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-left text-xs font-bold text-zinc-700 dark:border-white/10 dark:text-zinc-200">
            <span>{labels.selectAll}</span><span className={cn('flex h-5 w-5 items-center justify-center rounded border', allVisibleSelected && 'border-[#00A655] bg-[#00A655] text-white')}>{allVisibleSelected && <Check size={14} />}</span>
          </button>

          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-4">
            {isLoading ? <p className="py-8 text-center text-sm text-zinc-500">{labels.loading}</p> : visibleUsers.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">{labels.empty}</p> : visibleUsers.map((user) => {
              const selected = selectedIds.has(user.id);
              return <button key={user.id} type="button" onClick={() => setSelectedIds((current) => { const next = new Set(current); selected ? next.delete(user.id) : next.add(user.id); return next; })} className="flex w-full items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3 text-left hover:bg-zinc-50 dark:border-white/5 dark:hover:bg-white/5">
                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border', selected && 'border-[#00A655] bg-[#00A655] text-white')}>{selected && <Check size={14} />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-zinc-900 dark:text-white">{user.name}</span><span className="block truncate text-xs text-zinc-500">{user.email}</span></span>
              </button>;
            })}
          </div>
        </div>

        {feedback && <p className={cn('mx-7 mb-4 rounded-xl px-4 py-3 text-xs font-bold', feedback.kind === 'success' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200' : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200')}>{feedback.text}</p>}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-100 px-7 py-5 dark:border-white/10">
          <span className="text-xs font-black text-zinc-500">{selectedIds.size} {labels.selected}</span>
          <div className="flex gap-3"><Button variant="ghost" onClick={onClose} disabled={isSending}>{labels.cancel}</Button><Button onClick={() => void send()} disabled={isSending || selectedIds.size === 0}>{isSending ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}<span className="ml-2">{labels.send}</span></Button></div>
        </div>
      </motion.div>
    </div>
  );
};
