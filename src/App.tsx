/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type FormEvent, useEffect, useState } from 'react';
import { Sidebar, BottomNav, TopNavbar } from './components/Navigation';
import { AdminDashboard } from './components/AdminDashboard';
import { ClientTableView } from './components/ClientTableView';
import { PalletScanner } from './components/PalletScanner';
import { GhostPalletCenter } from './components/GhostPalletCenter';
import { DriverMobileDashboard } from './components/DriverMobileDashboard';
import { RoleMobileShell } from './components/RoleMobileShell';
import { AdminRoleOperationsView } from './components/AdminRoleOperationsView';
import { RoleType, User } from './types';
import { Eye, EyeOff, LogIn, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './AppContext';
import { Button, Card, Input, Select, cn } from './components/ui';
import { apiService } from './services/api';
import logoImage from './assets/logo.png';
import { languageOptions } from './i18n';

const CURRENT_USER_STORAGE_KEY = 'trackpal_current_user';
const LOGIN_PROFILES_STORAGE_KEY = 'trackpal_login_profiles';
const RECENT_LOGIN_LIMIT = 6;

type LoginMode = 'user' | 'customer';

type StoredLoginProfile = {
  id: string;
  mode: LoginMode;
  name: string;
  email?: string;
  kvk?: string;
  saved: boolean;
  lastUsedAt: string;
};

const readStoredCurrentUser = (): User | null => {
  if (typeof window === 'undefined' || !apiService.hasToken()) {
    return null;
  }

  try {
    const storedUser = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) as User : null;
  } catch {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return null;
  }
};

const storeCurrentUser = (user: User | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (user) {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
};

const readLoginProfiles = (): StoredLoginProfile[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedProfiles = window.localStorage.getItem(LOGIN_PROFILES_STORAGE_KEY);
    const profiles = storedProfiles ? JSON.parse(storedProfiles) : [];

    if (!Array.isArray(profiles)) {
      return [];
    }

    return profiles
      .filter((profile): profile is StoredLoginProfile =>
        Boolean(profile) &&
        typeof profile.id === 'string' &&
        (profile.mode === 'user' || profile.mode === 'customer') &&
        typeof profile.name === 'string'
      )
      .sort((left, right) => new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime())
      .slice(0, RECENT_LOGIN_LIMIT);
  } catch {
    window.localStorage.removeItem(LOGIN_PROFILES_STORAGE_KEY);
    return [];
  }
};

const storeLoginProfiles = (profiles: StoredLoginProfile[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOGIN_PROFILES_STORAGE_KEY, JSON.stringify(profiles.slice(0, RECENT_LOGIN_LIMIT)));
};

const loginProfileId = (mode: LoginMode, identifier: string) =>
  `${mode}:${identifier.trim().toLowerCase()}`;

const loginProfileSubtitle = (profile: StoredLoginProfile) =>
  profile.mode === 'customer' ? `KVK ${profile.kvk || ''}`.trim() : profile.email || '';

const rememberedKvkFromUser = (user: User) =>
  user.customer_detail?.kvk_number || user.customer_detail?.kvk || undefined;

const buildLoginProfile = (
  user: User,
  mode: LoginMode,
  identifier: string,
  saved: boolean,
): StoredLoginProfile => {
  const normalizedIdentifier = identifier.trim();
  const kvk = mode === 'customer' ? rememberedKvkFromUser(user) || normalizedIdentifier : undefined;
  const email = mode === 'user' ? user.email || normalizedIdentifier : undefined;
  const customerName = user.customer_detail?.name || user.customer_detail?.company_name;

  return {
    id: loginProfileId(mode, mode === 'customer' ? kvk || normalizedIdentifier : email || normalizedIdentifier),
    mode,
    name: mode === 'customer' ? customerName || user.name : user.name,
    email,
    kvk,
    saved,
    lastUsedAt: new Date().toISOString(),
  };
};

const upsertLoginProfile = (
  profiles: StoredLoginProfile[],
  nextProfile: StoredLoginProfile,
) => {
  const existingProfile = profiles.find((profile) => profile.id === nextProfile.id);
  const mergedProfile = existingProfile
    ? { ...existingProfile, ...nextProfile, saved: existingProfile.saved || nextProfile.saved }
    : nextProfile;

  return [
    mergedProfile,
    ...profiles.filter((profile) => profile.id !== nextProfile.id),
  ]
    .sort((left, right) => {
      if (left.saved !== right.saved) {
        return left.saved ? -1 : 1;
      }

      return new Date(right.lastUsedAt).getTime() - new Date(left.lastUsedAt).getTime();
    })
    .slice(0, RECENT_LOGIN_LIMIT);
};

const getCredentialLoginCopy = (language: string) => {
  if (language === 'nl') {
    return {
      title: 'Prijava',
      userMode: 'Ik ben gebruiker',
      customerMode: 'Ik ben klant',
      email: 'E-mail',
      kvk: 'KVK nummer',
      password: 'Wachtwoord',
      savedLogins: 'Opgeslagen logins',
      recentLogins: 'Recente logins',
      noLogins: 'Nog geen recente logins.',
      rememberMe: 'Onthoud mij',
      cancel: 'Annuleren',
      submit: 'Prijava',
      showPassword: 'Wachtwoord tonen',
      hidePassword: 'Wachtwoord verbergen',
      required: 'Vul de gegevens en het wachtwoord in.',
      invalid: 'Gegevens of wachtwoord zijn onjuist.',
    };
  }

  if (language === 'en') {
    return {
      title: 'Prijava',
      userMode: 'I am a user',
      customerMode: 'I am a customer',
      email: 'Email',
      kvk: 'KVK number',
      password: 'Password',
      savedLogins: 'Saved logins',
      recentLogins: 'Recent logins',
      noLogins: 'No recent logins yet.',
      rememberMe: 'Remember me',
      cancel: 'Cancel',
      submit: 'Prijava',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      required: 'Enter login details and password.',
      invalid: 'Login details or password are incorrect.',
    };
  }

  return {
    title: 'Prijava',
    userMode: 'Ja sam korisnik',
    customerMode: 'Ja sam kupac',
    email: 'Email',
    kvk: 'KVK broj',
    password: 'Lozinka',
    savedLogins: 'Sacuvane prijave',
    recentLogins: 'Nedavne prijave',
    noLogins: 'Jos nema nedavnih prijava.',
    rememberMe: 'Zapamti me',
    cancel: 'Odustani',
    submit: 'Prijava',
    showPassword: 'Prikazi lozinku',
    hidePassword: 'Sakrij lozinku',
    required: 'Unesite podatke za prijavu i lozinku.',
    invalid: 'Podaci za prijavu ili lozinka nisu ispravni.',
  };
};

const getCredentialLoginErrorMessage = (error: unknown, fallback: string) => {
  const errors = error && typeof error === 'object'
    ? (error as { errors?: Record<string, string[]> }).errors
    : undefined;
  const firstFieldError = errors && typeof errors === 'object'
    ? Object.values(errors).find((fieldErrors) => Array.isArray(fieldErrors) && fieldErrors.length > 0)?.[0]
    : undefined;

  if (firstFieldError) {
    return firstFieldError;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
};

const AppFooter = ({ className }: { className?: string }) => {
  const { t } = useApp();
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={cn(
        'w-full shrink-0 bg-white/95 backdrop-blur-xl dark:bg-[#0c1110]/94',
        className
      )}
    >
      <div className="flex min-h-16 w-full flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
        <div className="flex min-w-[118px] shrink-0 items-center gap-3">
          <img src={logoImage} alt="Trackpal logo" className="h-6 w-auto max-w-[118px] shrink-0 object-contain object-left opacity-50 sm:h-7 sm:max-w-[132px]" />
        </div>

        <div className="w-full text-left sm:ml-auto sm:w-auto sm:text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-300">
            {t('footerTagline')}
          </p>
          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
            © {currentYear} Bowido · {t('footerRights')} · {t('footerRegion')}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  const { t, language, setLanguage, isScannerOpen, setIsScannerOpen, isGhostReportOpen, setIsGhostReportOpen, refreshData, resetData } = useApp();
  const [currentUser, setCurrentUser] = useState<User | null>(() => readStoredCurrentUser());
  const [isRestoringSession, setIsRestoringSession] = useState(() => apiService.hasToken() && !readStoredCurrentUser());
  const [loginProfiles, setLoginProfiles] = useState<StoredLoginProfile[]>(() => readLoginProfiles());
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCredentialLoginOpen, setIsCredentialLoginOpen] = useState(false);
  const [credentialLoginMode, setCredentialLoginMode] = useState<LoginMode>('user');
  const [credentialLoginForm, setCredentialLoginForm] = useState({ email: '', kvk: '', password: '' });
  const [credentialLoginError, setCredentialLoginError] = useState<string | null>(null);
  const [isCredentialLoginSubmitting, setIsCredentialLoginSubmitting] = useState(false);
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isNightMode, setIsNightMode] = useState(false);
  const [pendingPalletDetailId, setPendingPalletDetailId] = useState<number | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [showLoginLanguageMenu, setShowLoginLanguageMenu] = useState(false);

  useEffect(() => {
    if (!apiService.hasToken()) {
      storeCurrentUser(null);
      setIsRestoringSession(false);
      return;
    }

    let isMounted = true;
    const hadStoredUser = Boolean(currentUser);

    if (hadStoredUser) {
      void refreshData();
    }

    const restoreSession = async () => {
      try {
        const restoredUser = await apiService.auth.me();

        if (!isMounted) {
          return;
        }

        setCurrentUser(restoredUser);
        storeCurrentUser(restoredUser);

        if (!hadStoredUser) {
          void refreshData();
        }
      } catch (error) {
        console.error('Failed to restore session', error);

        if (!isMounted) {
          return;
        }

        apiService.clearToken();
        storeCurrentUser(null);
        setCurrentUser(null);
        resetData();
      } finally {
        if (isMounted) {
          setIsRestoringSession(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const syncMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncMobileViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncMobileViewport);
      return () => mediaQuery.removeEventListener('change', syncMobileViewport);
    }

    mediaQuery.addListener(syncMobileViewport);
    return () => mediaQuery.removeListener(syncMobileViewport);
  }, []);

  const isDriverShell = currentUser?.role_name === RoleType.VOZAC;
  const usesRoleMobileShell =
    Boolean(currentUser) &&
    (isDriverShell || isMobileViewport);
  const usesFixedMobileShell = false;
  const usesInternalScrollShell = Boolean(currentUser) && (usesRoleMobileShell || usesFixedMobileShell);
  const chromeTintColor = isNightMode ? '#070b0a' : usesRoleMobileShell ? '#00A655' : '#ffffff';
  const credentialLoginCopy = getCredentialLoginCopy(language);
  const savedLoginProfiles = loginProfiles.filter((profile) => profile.saved);
  const recentLoginProfiles = loginProfiles.filter((profile) => !profile.saved);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('bowido-mobile-shell-active');

    return () => {
      root.classList.remove('bowido-mobile-shell-active');
    };
  }, [usesInternalScrollShell]);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const root = document.documentElement;
    root.classList.add('bowido-ios-tint-refresh');

    const rafId = window.requestAnimationFrame(() => {
      root.classList.remove('bowido-ios-tint-refresh');
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      root.classList.remove('bowido-ios-tint-refresh');
    };
  }, [activeTab, chromeTintColor, currentUser?.id, usesInternalScrollShell]);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [usesInternalScrollShell]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const rootElement = document.getElementById('root');
    const previousThemeColor = themeColorMeta?.getAttribute('content') ?? null;
    const previousHtmlBackground = document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousRootBackground = rootElement?.style.backgroundColor ?? '';

    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', chromeTintColor);
    }

    document.documentElement.style.backgroundColor = chromeTintColor;
    document.body.style.backgroundColor = chromeTintColor;

    if (rootElement) {
      rootElement.style.backgroundColor = chromeTintColor;
    }

    return () => {
      if (themeColorMeta) {
        if (previousThemeColor === null) {
          themeColorMeta.removeAttribute('content');
        } else {
          themeColorMeta.setAttribute('content', previousThemeColor);
        }
      }

      document.documentElement.style.backgroundColor = previousHtmlBackground;
      document.body.style.backgroundColor = previousBodyBackground;

      if (rootElement) {
        rootElement.style.backgroundColor = previousRootBackground;
      }
    };
  }, [chromeTintColor]);

  const openCredentialLogin = (profile?: StoredLoginProfile) => {
    setLoginError(null);
    setCredentialLoginError(null);
    setCredentialLoginMode(profile?.mode || 'user');
    setCredentialLoginForm({
      email: profile?.mode === 'user' ? profile.email || '' : '',
      kvk: profile?.mode === 'customer' ? profile.kvk || '' : '',
      password: '',
    });
    setRememberLogin(Boolean(profile?.saved));
    setShowCredentialPassword(false);
    setIsCredentialLoginOpen(true);
  };

  const closeCredentialLogin = () => {
    if (isCredentialLoginSubmitting) {
      return;
    }

    setIsCredentialLoginOpen(false);
    setCredentialLoginError(null);
    setShowCredentialPassword(false);
  };

  const selectCredentialLoginMode = (mode: LoginMode) => {
    setCredentialLoginMode(mode);
    setCredentialLoginError(null);
  };

  const handleCredentialLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const loginIdentifier = credentialLoginMode === 'customer'
      ? credentialLoginForm.kvk.trim()
      : credentialLoginForm.email.trim();
    const password = credentialLoginForm.password;

    if (!loginIdentifier || !password) {
      setCredentialLoginError(credentialLoginCopy.required);
      return;
    }

    setCredentialLoginError(null);
    setIsCredentialLoginSubmitting(true);

    try {
      const result = await apiService.auth.login({
        loginType: credentialLoginMode,
        email: credentialLoginMode === 'user' ? loginIdentifier : undefined,
        kvk: credentialLoginMode === 'customer' ? loginIdentifier : undefined,
        password,
      });
      const updatedProfiles = upsertLoginProfile(
        loginProfiles,
        buildLoginProfile(result.user, credentialLoginMode, loginIdentifier, rememberLogin),
      );

      setLoginProfiles(updatedProfiles);
      storeLoginProfiles(updatedProfiles);
      setCurrentUser(result.user);
      storeCurrentUser(result.user);
      setCredentialLoginForm({ email: '', kvk: '', password: '' });
      setIsCredentialLoginOpen(false);
      setShowCredentialPassword(false);
      setRememberLogin(false);
      void refreshData();
    } catch (error) {
      console.error('Failed to login with credentials', error);
      setCredentialLoginError(getCredentialLoginErrorMessage(error, credentialLoginCopy.invalid));
    } finally {
      setIsCredentialLoginSubmitting(false);
    }
  };

  const handleLogout = () => {
    void apiService.auth.logout();
    setCurrentUser(null);
    storeCurrentUser(null);
    setActiveTab('dashboard');
    setIsGhostReportOpen(false);
    resetData();
    setLoginProfiles(readLoginProfiles());
  };

 if (isRestoringSession && !currentUser) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-emerald-900">
      <div className="text-center">
        <img src={logoImage} alt="Trackpal logo" className="mx-auto h-12 w-auto" />
        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
          {language === 'bs' ? 'Učitavanje sesije' : language === 'nl' ? 'Sessie laden' : 'Loading session'}
        </p>
      </div>
    </div>
  );
}

  if (!currentUser) {
   const currentLanguageOption = languageOptions.find((option) => option.code === language) || languageOptions[0];

   return (
     <div
       id="login-screen"
       className="min-h-screen bg-white flex flex-col text-emerald-900 font-sans"
     >
       <div className="flex-1 flex items-center justify-center p-6">
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="w-full max-w-md space-y-12"
         >
           <div className="flex flex-col items-center gap-6">
             <div className="relative">
               <div className="flex items-center justify-center">
                 <img src={logoImage} alt="Logo" className="h-12 w-auto" />
               </div>
             </div>
           </div>

           <Card title={t('welcome') || 'System Login'} noPadding action={
             <div className="relative">
               <button
                 type="button"
                 title={t('language')}
                 onClick={() => setShowLoginLanguageMenu(!showLoginLanguageMenu)}
                 className="h-10 w-10 border-2 border-emerald-100 rounded-xl flex items-center justify-center transition-all text-[10px] font-black uppercase tracking-[0.08em] bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:bg-[#101715] dark:text-zinc-200 dark:hover:border-white/20 dark:hover:bg-white/[0.07] dark:hover:text-emerald-100"
               >
                 {currentLanguageOption.shortLabel}
               </button>

               <AnimatePresence>
                 {showLoginLanguageMenu && (
                   <motion.div
                     initial={{ opacity: 0, y: 6, scale: 0.98 }}
                     animate={{ opacity: 1, y: 0, scale: 1 }}
                     exit={{ opacity: 0, y: 6, scale: 0.98 }}
                     className="absolute right-0 top-full mt-3 w-36 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/10 dark:border-white/10 dark:bg-[#101715]"
                   >
                     <div className="border-b border-emerald-50 bg-emerald-50/60 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                       <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                         {t('language')}
                       </span>
                     </div>
                     <div className="p-2">
                       {languageOptions.map((option) => (
                         <button
                           key={option.code}
                           type="button"
                           onClick={() => {
                             setLanguage(option.code);
                             setShowLoginLanguageMenu(false);
                           }}
                           className={cn(
                             "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all",
                             option.code === language
                               ? "bg-emerald-50 text-emerald-700 dark:bg-white/5 dark:text-emerald-200"
                               : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-zinc-300 dark:hover:bg-white/5 dark:hover:text-emerald-200"
                           )}
                         >
                           <span className="text-[10px] font-black uppercase tracking-[0.14em]">{option.shortLabel}</span>
                           <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">{option.nativeLabel}</span>
                         </button>
                       ))}
                     </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
           }>
            <div className="p-8 space-y-6 text-center">
              {savedLoginProfiles.length > 0 && (
                <div className="space-y-3 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    {credentialLoginCopy.savedLogins}
                  </p>
                  {savedLoginProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => openCredentialLogin(profile)}
                      className="w-full group flex items-center justify-between rounded-2xl border border-[#00A655] bg-emerald-50 p-5 text-left transition-all duration-300 hover:bg-white hover:shadow-2xl hover:shadow-emerald-900/5 active:scale-95 dark:border-white/10 dark:bg-[#101715] dark:hover:border-[#00A655]"
                    >
                      <div className="flex min-w-0 flex-col items-start">
                        <span className="font-display max-w-full truncate text-xs font-black uppercase tracking-tight text-emerald-900 dark:text-white">
                          {profile.name}
                        </span>
                        <span className="max-w-full truncate text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          {loginProfileSubtitle(profile)}
                        </span>
                      </div>

                      <div className="rounded-xl border border-[#00A655] bg-white p-2.5 text-[#00A655] shadow-sm transition-all group-hover:bg-[#00A655] group-hover:text-white dark:border-white/10 dark:bg-[#151d1a]">
                        <LogIn size={18} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {recentLoginProfiles.length > 0 && (
                <div className="space-y-3 text-left">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                    {credentialLoginCopy.recentLogins}
                  </p>
                  {recentLoginProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => openCredentialLogin(profile)}
                      className="w-full group flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-left transition-all duration-300 hover:border-[#00A655] hover:shadow-2xl hover:shadow-emerald-900/5 active:scale-95 dark:border-white/10 dark:bg-[#101715] dark:hover:border-[#00A655]"
                    >
                      <div className="flex min-w-0 flex-col items-start">
                        <span className="font-display max-w-full truncate text-xs font-black uppercase tracking-tight text-emerald-900 dark:text-white">
                          {profile.name}
                        </span>
                        <span className="max-w-full truncate text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                          {loginProfileSubtitle(profile)}
                        </span>
                      </div>

                      <div className="rounded-xl border border-zinc-200 bg-white p-2.5 shadow-sm transition-all group-hover:border-[#00A655] group-hover:bg-[#00A655] group-hover:text-white dark:border-white/10 dark:bg-[#151d1a]">
                        <LogIn size={18} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {savedLoginProfiles.length === 0 && recentLoginProfiles.length === 0 && (
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">
                  {credentialLoginCopy.noLogins}
                </p>
              )}

              {loginError && (
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">
                  {loginError}
                </p>
              )}
            </div>
          </Card>

        </motion.div>
      </div>

      <div className="flex justify-center px-6 pb-5">
        <Button
          type="button"
          title={t('loginButton')}
          aria-label={t('loginButton')}
          onClick={() => openCredentialLogin()}
          className="w-full max-w-sm gap-2 shadow-2xl shadow-emerald-900/20"
          size="lg"
        >
          <LogIn size={16} />
          {t('loginButton')}
        </Button>
      </div>

      <AppFooter />

      <AnimatePresence>
        {isCredentialLoginOpen && (
          <motion.div
            className="modal-overlay fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCredentialLogin}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="credential-login-title"
              className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-emerald-950/10 dark:border-white/10 dark:bg-[#101715]"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-sm bg-[#00A655]" />
                  <h2
                    id="credential-login-title"
                    className="font-display text-[12px] font-black uppercase tracking-[0.15em] text-zinc-950 dark:text-white"
                  >
                    {credentialLoginCopy.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeCredentialLogin}
                  disabled={isCredentialLoginSubmitting}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={language === 'bs' ? 'Zatvori' : language === 'nl' ? 'Sluiten' : 'Close'}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-zinc-100 p-4 dark:border-white/10">
                {(['user', 'customer'] as LoginMode[]).map((mode) => {
                  const isActive = credentialLoginMode === mode;

                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => selectCredentialLoginMode(mode)}
                      disabled={isCredentialLoginSubmitting}
                      className={cn(
                        'rounded-xl border px-3 py-3 text-[10px] font-black uppercase tracking-[0.12em] transition-all disabled:opacity-50',
                        isActive
                          ? 'border-[#00A655] bg-[#00A655] text-white shadow-md shadow-emerald-900/10'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300'
                      )}
                    >
                      {mode === 'user' ? credentialLoginCopy.userMode : credentialLoginCopy.customerMode}
                    </button>
                  );
                })}
              </div>

              <form className="space-y-5 p-6" onSubmit={(event) => void handleCredentialLoginSubmit(event)}>
                <div className="space-y-2">
                  <label
                    htmlFor={credentialLoginMode === 'customer' ? 'credential-login-kvk' : 'credential-login-email'}
                    className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400"
                  >
                    {credentialLoginMode === 'customer' ? credentialLoginCopy.kvk : credentialLoginCopy.email}
                  </label>
                  <Input
                    id={credentialLoginMode === 'customer' ? 'credential-login-kvk' : 'credential-login-email'}
                    type={credentialLoginMode === 'customer' ? 'text' : 'email'}
                    autoComplete="username"
                    inputMode={credentialLoginMode === 'customer' ? 'numeric' : 'email'}
                    value={credentialLoginMode === 'customer' ? credentialLoginForm.kvk : credentialLoginForm.email}
                    onChange={(event) => {
                      setCredentialLoginForm((previousState) => ({
                        ...previousState,
                        [credentialLoginMode === 'customer' ? 'kvk' : 'email']: event.target.value,
                      }));
                      setCredentialLoginError(null);
                    }}
                    className="normal-case tracking-normal"
                    placeholder={credentialLoginMode === 'customer' ? '12345678' : 'korisnik@trackpal.app'}
                    disabled={isCredentialLoginSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="credential-login-password"
                    className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400"
                  >
                    {credentialLoginCopy.password}
                  </label>
                  <div className="relative">
                    <Input
                      id="credential-login-password"
                      type={showCredentialPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={credentialLoginForm.password}
                      onChange={(event) => {
                        setCredentialLoginForm((previousState) => ({
                          ...previousState,
                          password: event.target.value,
                        }));
                        setCredentialLoginError(null);
                      }}
                      className="pr-12 normal-case tracking-normal"
                      disabled={isCredentialLoginSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCredentialPassword((isShown) => !isShown)}
                      className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-emerald-700 disabled:opacity-50 dark:hover:bg-white/10 dark:hover:text-white"
                      aria-label={showCredentialPassword ? credentialLoginCopy.hidePassword : credentialLoginCopy.showPassword}
                      title={showCredentialPassword ? credentialLoginCopy.hidePassword : credentialLoginCopy.showPassword}
                      disabled={isCredentialLoginSubmitting}
                    >
                      {showCredentialPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRememberLogin((isRemembered) => !isRemembered)}
                  disabled={isCredentialLoginSubmitting}
                  className={cn(
                    'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all disabled:opacity-50',
                    rememberLogin
                      ? 'border-[#00A655] bg-emerald-50 text-emerald-900 dark:border-white/10 dark:bg-white/[0.08] dark:text-white'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-emerald-200 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300'
                  )}
                >
                  <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                    {credentialLoginCopy.rememberMe}
                  </span>
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all',
                      rememberLogin ? 'border-[#00A655] bg-[#00A655]' : 'border-zinc-300 bg-white dark:border-white/20 dark:bg-transparent'
                    )}
                    aria-hidden="true"
                  >
                    {rememberLogin && <span className="h-2 w-2 rounded-sm bg-white" />}
                  </span>
                </button>

                {credentialLoginError && (
                  <p
                    role="alert"
                    className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-rose-600"
                  >
                    {credentialLoginError}
                  </p>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCredentialLogin}
                    disabled={isCredentialLoginSubmitting}
                    className="flex-1"
                  >
                    {credentialLoginCopy.cancel}
                  </Button>
                  <Button type="submit" disabled={isCredentialLoginSubmitting} className="flex-[1.25] gap-2">
                    <LogIn size={15} className={isCredentialLoginSubmitting ? 'animate-pulse' : ''} />
                    {credentialLoginCopy.submit}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

  const renderDashboard = () => {
    if (activeTab === 'settings' && (currentUser.role_name !== RoleType.ADMIN || usesRoleMobileShell)) {
      return (
        <Card title={t('settings')} className="w-full">
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-emerald-900 font-display dark:text-white">{currentUser.name}</h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{currentUser.email}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 text-left dark:bg-emerald-900/20 dark:border-emerald-500/20">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                  {t('language')}
                </span>
                <div className="mt-3">
                  <Select value={language} onChange={(event) => setLanguage(event.target.value as typeof language)}>
                    {languageOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.nativeLabel}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNightMode(!isNightMode)}
                className="p-4 rounded-2xl border border-emerald-100 bg-white text-left hover:border-emerald-300 transition-colors dark:bg-[#101715] dark:border-white/10"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
                  {t('nightMode')}
                </span>
                <p className="text-lg font-black uppercase text-emerald-900 font-display dark:text-white">
                  {isNightMode ? t('on') : t('off')}
                </p>
              </button>
            </div>
          </div>
        </Card>
      );
    }

    if (
      currentUser.role_name === RoleType.KLIJENT &&
      (activeTab === 'client-table' || (!usesRoleMobileShell && activeTab === 'dashboard'))
    ) {
      return <ClientTableView clientIdFilter={currentUser.id} />;
    }

    if (usesRoleMobileShell) {
      return <DriverMobileDashboard user={currentUser} />;
    }

    switch (currentUser.role_name) {
      case RoleType.ADMIN: {
        const adminTabsMap: Record<string, 'overview' | 'pallets' | 'clients' | 'users' | 'settings' | 'logs' | 'billing' | 'roles' | 'calendar' | 'noQrPallets' | 'clientManager' | 'adminService' | 'adminWarehouse' | 'adminFinance'> = {
          dashboard: 'overview',
          pallets: 'pallets',
          'no-qr-pallets': 'noQrPallets',
          calendar: 'calendar',
          'audit-logs': 'logs',
          users: 'clients',
          'client-manager': 'clientManager',
          'admin-service': 'adminService',
          'admin-warehouse': 'adminWarehouse',
          'admin-finance': 'adminFinance',
          korisnici: 'users',
          roles: 'roles',
          invoices: 'billing',
          settings: 'settings',
        };
        const view = adminTabsMap[activeTab] || 'overview';
        return (
          <AdminDashboard
            initialView={view}
            user={currentUser}
            isNightMode={isNightMode}
            onToggleNightMode={() => setIsNightMode(!isNightMode)}
            openPalletId={pendingPalletDetailId}
            onPalletDetailOpened={() => setPendingPalletDetailId(null)}
          />
        );
      }
      case RoleType.VOZAC:
        return <DriverMobileDashboard user={currentUser} />;
      case RoleType.MAGACINER:
        return <AdminRoleOperationsView mode="warehouse" />;
      case RoleType.KLIJENT:
        return <ClientTableView clientIdFilter={currentUser.id} />;
      case RoleType.SERVISER:
        return <AdminRoleOperationsView mode="service" />;
      case RoleType.ADMIN_SERVICE:
        return <AdminRoleOperationsView mode="service" />;
      case RoleType.ADMIN_WAREHOUSE:
        return <AdminRoleOperationsView mode="warehouse" />;
      case RoleType.FINANCE_ADMINISTRATION:
        return <AdminRoleOperationsView mode="finance" />;
      default:
        return (
          <AdminDashboard
            user={currentUser}
            isNightMode={isNightMode}
            onToggleNightMode={() => setIsNightMode(!isNightMode)}
            openPalletId={pendingPalletDetailId}
            onPalletDetailOpened={() => setPendingPalletDetailId(null)}
          />
        );
    }
  };

  if (usesRoleMobileShell && currentUser) {
    return (
      <>
        <RoleMobileShell
          containerId="driver-app-container"
          sentinelVariant="driver"
          isNightMode={isNightMode}
          settingsTitle={t('settings')}
          logoutTitle={t('logout')}
          settingsActive={activeTab === 'settings'}
          palletActive={activeTab === 'client-table'}
          onToggleSettings={() => setActiveTab(activeTab === 'settings' ? 'dashboard' : 'settings')}
          onLogout={handleLogout}
          logoSrc={logoImage}
          bodyClassName={(activeTab === 'settings' || activeTab === 'client-table') ? 'px-4' : 'px-0'}
          showPalletIcon={currentUser.role_name === RoleType.KLIJENT}
          onPalletIconClick={() => setActiveTab(activeTab === 'client-table' ? 'dashboard' : 'client-table')}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentUser.id}-mobile-role-${activeTab}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex-1"
            >
              {renderDashboard()}
            </motion.div>
          </AnimatePresence>
        </RoleMobileShell>

        <AnimatePresence>
          {isScannerOpen && (
            <PalletScanner
              currentUser={currentUser}
              onClose={() => setIsScannerOpen(false)}
              onPalletDetected={
                currentUser.role_name === RoleType.ADMIN
                  ? (pallet) => {
                    setIsScannerOpen(false);
                  setActiveTab('pallets');
                  setPendingPalletDetailId(pallet.id);
                  }
                  : undefined
              }
            />
          )}

          {isGhostReportOpen && currentUser.role_name !== RoleType.SERVISER && (
            <GhostPalletCenter
              currentUser={currentUser}
              onClose={() => setIsGhostReportOpen(false)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div
      id="app-container"
      className={cn(
        'bg-white text-emerald-900 font-sans selection:bg-[#00A655] selection:text-white transition-colors dark:bg-[#070b0a] dark:text-zinc-50',
        isNightMode && 'dark',
        usesFixedMobileShell ? 'fixed inset-0 flex flex-col overflow-hidden' : 'min-h-screen'
      )}
    >
      <div className="safari-tint-sentinel safari-tint-sentinel--app" aria-hidden="true" />
      <TopNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={currentUser.role_name}
        user={currentUser}
        onLogout={handleLogout}
        isNightMode={isNightMode}
        onToggleNightMode={() => setIsNightMode(!isNightMode)}
      />

      <div
        className={cn(
          'flex flex-col md:flex-row bg-white dark:bg-transparent',
          usesFixedMobileShell ? 'min-h-0 flex-1 pt-28 md:pt-0' : 'min-h-screen pt-28 md:pt-0'
        )}
      >
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={currentUser.role_name} 
          onLogout={handleLogout} 
        />
      
        <main
          className={cn(
            'relative flex flex-1 flex-col bg-white dark:bg-transparent',
            usesFixedMobileShell
              ? 'min-h-0 overflow-y-auto overscroll-y-contain pb-[calc(env(safe-area-inset-bottom)+5.5rem)] scroll-smooth no-scrollbar'
              : 'h-[calc(100vh-7rem)] overflow-y-auto pb-24 scroll-smooth no-scrollbar md:h-screen md:pt-16 md:pb-0'
          )}
          style={usesFixedMobileShell ? { WebkitOverflowScrolling: 'touch' } : undefined}
        >
          <div className="w-full flex-1 bg-white p-4 sm:p-5 md:p-6 lg:p-8 dark:bg-transparent">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentUser.id}-${activeTab}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {renderDashboard()}
              </motion.div>
            </AnimatePresence>
          </div>
          <AppFooter className="mt-auto" />
        </main>

        <BottomNav 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          role={currentUser.role_name} 
          onLogout={handleLogout} 
        />
      </div>

      <AnimatePresence>
        {isScannerOpen && currentUser && (
          <PalletScanner 
            currentUser={currentUser} 
            onClose={() => setIsScannerOpen(false)} 
            onPalletDetected={
              currentUser.role_name === RoleType.ADMIN
                ? (pallet) => {
                  setIsScannerOpen(false);
                setActiveTab('pallets');
                setPendingPalletDetailId(pallet.id);
                }
                : undefined
            }
          />
        )}

        {isGhostReportOpen && currentUser && currentUser.role_name !== RoleType.SERVISER && (
          <GhostPalletCenter
            currentUser={currentUser}
            onClose={() => setIsGhostReportOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
