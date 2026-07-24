/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { type FormEvent, useEffect, useState } from "react";
import { Sidebar, BottomNav, TopNavbar } from "./components/Navigation";
import { AdminDashboard } from "./components/AdminDashboard";
import { ClientTableView } from "./components/ClientTableView";
import { PalletScanner } from "./components/PalletScanner";
import { GhostPalletCenter } from "./components/GhostPalletCenter";
import { DriverMobileDashboard } from "./components/DriverMobileDashboard";
import { RoleMobileShell } from "./components/RoleMobileShell";
import { AdminRoleOperationsView } from "./components/AdminRoleOperationsView";
import { CustomerDetailsPage } from "./components/CustomerDetailsPage";
import { ImageGallery } from "./components/ImageGallery";
import { AdminAuditLogs } from "./components/AdminAuditLogs";
import { AdminClientManagerView } from "./components/AdminClientManagerView";
import { RoleManager } from "./components/RoleManager";
import { UserManager } from "./components/UserManager";
import { BillingList } from "./components/BillingList";
import { ThemeSettingsToggle } from "./components/ThemeSettingsToggle";
import { LandingShell } from "./components/LandingShell";
import { RoleType, User } from "./types";
import { Eye, EyeOff, LogIn, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "./AppContext";
import { Button, Card, Input, Select, cn } from "./components/ui";
import { ApiError, apiService } from "./services/api";
import logoImage from "./assets/logo.png";
import { languageOptions } from "./i18n";

const CURRENT_USER_STORAGE_KEY = "trackpal_current_user";
const LOGIN_PROFILES_STORAGE_KEY = "trackpal_login_profiles";
const ACTIVE_TAB_STORAGE_KEY = "trackpal_active_tab";
const THEME_STORAGE_KEY = "trackpal_theme";
const RECENT_LOGIN_LIMIT = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readStoredTheme = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark";
};

type LoginMode = "user" | "customer";

type CompanyLoginOption = {
  customer_detail_id: number;
  company_name: string;
};

type StoredLoginProfile = {
  id: string;
  mode: LoginMode;
  name: string;
  email?: string;
  kvk?: string;
  saved: boolean;
  lastUsedAt: string;
};

type StoredActiveTab = {
  userId: number;
  roleName: string;
  tab: string;
};

const adminActiveTabs = new Set([
  "dashboard",
  "pallets",
  "no-qr-pallets",
  "calendar",
  "audit-logs",
  "client-manager",
  "korisnici",
  "roles",
  "invoices",
  "settings",
]);

const customerActiveTabs = new Set([
  "dashboard",
  "settings",
  "client-table",
  "invoices",
]);
const basicActiveTabs = new Set(["dashboard", "settings"]);

const canUseActiveTab = (user: User, tab: string) => {
  if (user.role_name === RoleType.ADMIN) {
    return adminActiveTabs.has(tab);
  }

  if (user.role_name === RoleType.KLIJENT) {
    return customerActiveTabs.has(tab);
  }

  return basicActiveTabs.has(tab);
};

const readStoredActiveTab = (user: User | null) => {
  if (typeof window === "undefined" || !user) {
    return "dashboard";
  }

  try {
    const storedValue = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    const storedTab = storedValue
      ? (JSON.parse(storedValue) as StoredActiveTab)
      : null;

    if (
      storedTab?.userId === user.id &&
      storedTab.roleName === user.role_name &&
      typeof storedTab.tab === "string" &&
      canUseActiveTab(user, storedTab.tab)
    ) {
      return storedTab.tab;
    }
  } catch {
    window.localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
  }

  return "dashboard";
};

const storeActiveTab = (user: User | null, tab: string) => {
  if (typeof window === "undefined" || !user || !canUseActiveTab(user, tab)) {
    return;
  }

  window.localStorage.setItem(
    ACTIVE_TAB_STORAGE_KEY,
    JSON.stringify({
      userId: user.id,
      roleName: user.role_name,
      tab,
    } satisfies StoredActiveTab),
  );
};

const clearStoredActiveTab = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACTIVE_TAB_STORAGE_KEY);
};

const readStoredCurrentUser = (): User | null => {
  if (typeof window === "undefined" || !apiService.hasToken()) {
    return null;
  }

  try {
    const storedUser = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return storedUser ? (JSON.parse(storedUser) as User) : null;
  } catch {
    window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return null;
  }
};

const storeCurrentUser = (user: User | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (user) {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    return;
  }

  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
};

const readLoginProfiles = (): StoredLoginProfile[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedProfiles = window.localStorage.getItem(
      LOGIN_PROFILES_STORAGE_KEY,
    );
    const profiles = storedProfiles ? JSON.parse(storedProfiles) : [];

    if (!Array.isArray(profiles)) {
      return [];
    }

    return profiles
      .filter(
        (profile): profile is StoredLoginProfile =>
          Boolean(profile) &&
          typeof profile.id === "string" &&
          (profile.mode === "user" || profile.mode === "customer") &&
          typeof profile.name === "string",
      )
      .sort(
        (left, right) =>
          new Date(right.lastUsedAt).getTime() -
          new Date(left.lastUsedAt).getTime(),
      )
      .slice(0, RECENT_LOGIN_LIMIT);
  } catch {
    window.localStorage.removeItem(LOGIN_PROFILES_STORAGE_KEY);
    return [];
  }
};

const storeLoginProfiles = (profiles: StoredLoginProfile[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    LOGIN_PROFILES_STORAGE_KEY,
    JSON.stringify(profiles.slice(0, RECENT_LOGIN_LIMIT)),
  );
};

const loginProfileId = (mode: LoginMode, identifier: string) =>
  `${mode}:${identifier.trim().toLowerCase()}`;

const loginProfileSubtitle = (profile: StoredLoginProfile) =>
  profile.mode === "customer"
    ? `KVK ${profile.kvk || ""}`.trim()
    : profile.email || "";

const rememberedKvkFromUser = (user: User) =>
  user.customer_detail?.kvk_number || user.customer_detail?.kvk || undefined;

const buildLoginProfile = (
  user: User,
  mode: LoginMode,
  identifier: string,
  saved: boolean,
): StoredLoginProfile => {
  const normalizedIdentifier = identifier.trim();
  const kvk =
    mode === "customer"
      ? rememberedKvkFromUser(user) || normalizedIdentifier
      : undefined;
  const email =
    mode === "user" ? user.email || normalizedIdentifier : undefined;
  const customerName =
    user.customer_detail?.name || user.customer_detail?.company_name;

  return {
    id: loginProfileId(
      mode,
      mode === "customer"
        ? kvk || normalizedIdentifier
        : email || normalizedIdentifier,
    ),
    mode,
    name: mode === "customer" ? customerName || user.name : user.name,
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
  const existingProfile = profiles.find(
    (profile) => profile.id === nextProfile.id,
  );
  const mergedProfile = existingProfile
    ? {
        ...existingProfile,
        ...nextProfile,
        saved: existingProfile.saved || nextProfile.saved,
      }
    : nextProfile;

  return [
    mergedProfile,
    ...profiles.filter((profile) => profile.id !== nextProfile.id),
  ]
    .sort((left, right) => {
      if (left.saved !== right.saved) {
        return left.saved ? -1 : 1;
      }

      return (
        new Date(right.lastUsedAt).getTime() -
        new Date(left.lastUsedAt).getTime()
      );
    })
    .slice(0, RECENT_LOGIN_LIMIT);
};

const getCredentialLoginCopy = (language: string) => {
  if (language === "nl") {
    return {
      title: "Inloggen",
      userMode: "BoWiDo werknemer",
      customerMode: "Ik ben klant",
      email: "E-mail",
      kvk: "KVK nummer",
      password: "Wachtwoord",
      savedLogins: "Opgeslagen logins",
      recentLogins: "Recente logins",
      noLogins: "Nog geen recente logins.",
      rememberMe: "Onthoud mij",
      cancel: "Annuleren",
      submit: "Inloggen",
      showPassword: "Wachtwoord tonen",
      hidePassword: "Wachtwoord verbergen",
      required: "Vul de gegevens en het wachtwoord in.",
      invalid: "Gegevens of wachtwoord zijn onjuist.",
      invalidCustomer: "KVK-nummer of wachtwoord is onjuist.",
      chooseCompanyTitle: "Kies je bedrijf",
      chooseCompanySubtitle: "Dit KVK-nummer hoort bij meerdere bedrijven.",
    };
  }

  if (language === "en") {
    return {
      title: "Sign in",
      userMode: "BoWiDo employee",
      customerMode: "I am a customer",
      email: "Email",
      kvk: "KVK number",
      password: "Password",
      savedLogins: "Saved logins",
      recentLogins: "Recent logins",
      noLogins: "No recent logins yet.",
      rememberMe: "Remember me",
      cancel: "Cancel",
      submit: "Log in",
      showPassword: "Show password",
      hidePassword: "Hide password",
      required: "Enter login details and password.",
      invalid: "Login details or password are incorrect.",
      invalidCustomer: "KVK number or password is incorrect.",
      chooseCompanyTitle: "Choose your company",
      chooseCompanySubtitle: "This KVK number belongs to multiple companies.",
    };
  }

  return {
    title: "Prijava",
    userMode: "BoWiDo zaposlenik",
    customerMode: "Ja sam kupac",
    email: "Email",
    kvk: "KVK broj",
    password: "Lozinka",
    savedLogins: "Sacuvane prijave",
    recentLogins: "Nedavne prijave",
    noLogins: "Jos nema nedavnih prijava.",
    rememberMe: "Zapamti me",
    cancel: "Odustani",
    submit: "Prijava",
    showPassword: "Prikazi lozinku",
    hidePassword: "Sakrij lozinku",
    required: "Unesite podatke za prijavu i lozinku.",
    invalid: "Podaci za prijavu ili lozinka nisu ispravni.",
    invalidCustomer: "KVK broj ili lozinka nisu ispravni.",
    chooseCompanyTitle: "Odaberite kompaniju",
    chooseCompanySubtitle: "Ovaj KVK broj pripada vise kompanija.",
  };
};

const getKvkRegistrationCopy = (language: string) => {
  if (language === "nl") {
    return {
      title: "KVK-registratie",
      subtitle:
        "Voer je KVK-nummer in om de geregistreerde klantgegevens te laden.",
      find: "KVK zoeken",
    };
  }

  if (language === "bs") {
    return {
      title: "KVK registracija",
      subtitle: "Unesite KVK broj da učitate registrovane podatke kupca.",
      find: "Pronađi KVK",
    };
  }

  return {
    title: "KVK registration",
    subtitle: "Enter your KVK number to load the registered customer details.",
    find: "Find KVK",
  };
};

const getCredentialLoginErrorMessage = (error: unknown, fallback: string) => {
  const errors =
    error && typeof error === "object"
      ? (error as { errors?: Record<string, string[]> }).errors
      : undefined;
  const firstFieldError =
    errors && typeof errors === "object"
      ? Object.values(errors).find(
          (fieldErrors) => Array.isArray(fieldErrors) && fieldErrors.length > 0,
        )?.[0]
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
        "w-full shrink-0 bg-white/95 backdrop-blur-xl dark:bg-[#0c1110]/94",
        className,
      )}
    >
      <div className="flex min-h-16 w-full flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 md:px-6">
        <div className="flex min-w-[118px] shrink-0 items-center gap-3">
          <img
            src={logoImage}
            alt="Trackpal logo"
            className="h-6 w-auto max-w-[118px] shrink-0 object-contain object-left opacity-50 sm:h-7 sm:max-w-[132px]"
          />
        </div>

        <div className="w-full text-left sm:ml-auto sm:w-auto sm:text-right">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-300">
            {t("footerTagline")}
          </p>
          <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500">
            © {currentYear} Bowido · {t("footerRights")} · {t("footerRegion")}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default function App() {
  const {
    t,
    language,
    setLanguage,
    isScannerOpen,
    setIsScannerOpen,
    isGhostReportOpen,
    setIsGhostReportOpen,
    refreshData,
    resetData,
  } = useApp();
  const kvkRegistrationCopy = getKvkRegistrationCopy(language);
  const kvkFormLabels =
    language === "bs"
      ? {
          kvk: "KVK broj",
          company: "Naziv firme",
          email: "E-mail",
          phone: "Broj telefona",
          fixed: "Fiksni telefon",
          address: "Adresa",
          warehouse1: "Magacin 1",
          warehouse2: "Magacin 2",
          street: "Ulica",
          house: "Kućni broj",
          postal: "Poštanski broj",
          city: "Grad",
          password: "Lozinka",
          confirmPassword: "Potvrdite lozinku",
          cancel: "Odustani",
          register: "Registruj se",
          invalidEmail: "Unesite ispravnu e-mail adresu.",
          registrationFailed: "Registracija nije mogla biti završena.",
        }
      : language === "nl"
        ? {
            kvk: "KVK-nummer",
            company: "Bedrijfsnaam",
            email: "E-mail",
            phone: "Telefoonnummer",
            fixed: "Vaste telefoon",
            address: "Adres",
            warehouse1: "Magazijn 1",
            warehouse2: "Magazijn 2",
            street: "Straat",
            house: "Huisnummer",
            postal: "Postcode",
            city: "Plaats",
            password: "Wachtwoord",
            confirmPassword: "Bevestig wachtwoord",
            cancel: "Annuleren",
            register: "Registreren",
            invalidEmail: "Vul een geldig e-mailadres in.",
            registrationFailed: "Registratie kon niet worden voltooid.",
          }
        : {
            kvk: "KVK number",
            company: "Company name",
            email: "Email",
            phone: "Phone number",
            fixed: "Fixed phone",
            address: "Address",
            warehouse1: "Warehouse 1",
            warehouse2: "Warehouse 2",
            street: "Street",
            house: "House number",
            postal: "Postal code",
            city: "City",
            password: "Password",
            confirmPassword: "Confirm password",
            cancel: "Cancel",
            register: "Register",
            invalidEmail: "Enter a valid email address.",
            registrationFailed: "Registration could not be completed.",
          };
  const [currentUser, setCurrentUser] = useState<User | null>(() =>
    readStoredCurrentUser(),
  );
  const [isRestoringSession, setIsRestoringSession] = useState(
    () => apiService.hasToken() && !readStoredCurrentUser(),
  );
  const [loginProfiles, setLoginProfiles] = useState<StoredLoginProfile[]>(() =>
    readLoginProfiles(),
  );
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isCredentialLoginOpen, setIsCredentialLoginOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const [isLandingLoginOpen, setIsLandingLoginOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches,
  );
  const [credentialLoginMode, setCredentialLoginMode] =
    useState<LoginMode>("user");
  const [credentialLoginForm, setCredentialLoginForm] = useState({
    email: "",
    kvk: "",
    password: "",
  });
  const [credentialLoginError, setCredentialLoginError] = useState<
    string | null
  >(null);
  const [isCredentialLoginSubmitting, setIsCredentialLoginSubmitting] =
    useState(false);
  const [companyLoginOptions, setCompanyLoginOptions] = useState<
    CompanyLoginOption[]
  >([]);
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);
  const [rememberLogin, setRememberLogin] = useState(false);
  const [isKvkRegistrationOpen, setIsKvkRegistrationOpen] = useState(false);
  const [kvkRegistration, setKvkRegistration] = useState({
    kvk: "",
    name: "",
    email: "",
    phone_number: "",
    fixed_phone: "",
    street: "",
    house_number: "",
    postal_code: "",
    city: "",
    warehouse1_street: "",
    warehouse1_house_number: "",
    warehouse1_postal_code: "",
    warehouse1_city: "",
    warehouse2_street: "",
    warehouse2_house_number: "",
    warehouse2_postal_code: "",
    warehouse2_city: "",
    password: "",
    password_confirmation: "",
  });
  const [kvkRegistrationError, setKvkRegistrationError] = useState<
    string | null
  >(null);
  const [isKvkRegistrationSubmitting, setIsKvkRegistrationSubmitting] =
    useState(false);
  const [activeTab, setActiveTab] = useState(() =>
    readStoredActiveTab(currentUser),
  );
  const [isNightMode, setIsNightMode] = useState(readStoredTheme);
  const [pendingPalletDetailId, setPendingPalletDetailId] = useState<
    number | null
  >(null);
  const [driverSelectedPalletId, setDriverSelectedPalletId] = useState<
    number | null
  >(null);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(max-width: 767px)").matches;
  });
  const [showLoginLanguageMenu, setShowLoginLanguageMenu] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      isNightMode ? "dark" : "light",
    );
  }, [isNightMode]);

  useEffect(() => {
    if (!currentUser) {
      setDriverSelectedPalletId(null);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!apiService.hasToken()) {
      storeCurrentUser(null);
      setIsRestoringSession(false);
      return;
    }

    let isMounted = true;
    const restoreSession = async () => {
      try {
        const restoredUser = await apiService.auth.me();

        if (!isMounted) {
          return;
        }

        setCurrentUser(restoredUser);
        storeCurrentUser(restoredUser);

        void refreshData();
      } catch (error) {
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
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncMobileViewport = () => setIsMobileViewport(mediaQuery.matches);

    syncMobileViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncMobileViewport);
      return () => mediaQuery.removeEventListener("change", syncMobileViewport);
    }

    mediaQuery.addListener(syncMobileViewport);
    return () => mediaQuery.removeListener(syncMobileViewport);
  }, []);

  const isDriverShell = currentUser?.role_name === RoleType.VOZAC;
  const usesRoleMobileShell =
    Boolean(currentUser) && (isDriverShell || isMobileViewport);
  const usesFixedMobileShell = false;
  const usesInternalScrollShell =
    Boolean(currentUser) && (usesRoleMobileShell || usesFixedMobileShell);
  const chromeTintColor = isNightMode
    ? "#070b0a"
    : usesRoleMobileShell
      ? "#00A655"
      : "#ffffff";
  const credentialLoginCopy = getCredentialLoginCopy(language);
  const landingMarketingCopy =
    language === "bs"
      ? {
          eyebrow: "Pametno praćenje paleta",
          title: "Svaka paleta. Jasan tok.",
          description:
            "Od QR skeniranja i transporta do povrata, servisa i obračuna — sve na jednom mjestu, u stvarnom vremenu.",
          illustrationLabels: [
            "Efikasno upravljanje",
            "Ažuriranja u stvarnom vremenu",
            "Detaljna evidencija",
            "Timska saradnja",
          ],
        }
      : language === "nl"
        ? {
            eyebrow: "Slim palletbeheer",
            title: "Elke pallet. Eén duidelijk proces.",
            description:
              "Van QR-scans en transport tot retouren, service en facturatie — de hele operatie werkt vanuit één betrouwbare status.",
            illustrationLabels: [
              "Efficiënt beheer",
              "Realtime updates",
              "Gedetailleerde audit",
              "Teamsamenwerking",
            ],
          }
        : {
            eyebrow: "Smart pallet tracking",
            title: "Every pallet. One clear flow.",
            description:
              "From QR scans and transport to returns, service and billing — the whole operation works from one reliable status.",
            illustrationLabels: [
              "Efficient management",
              "Real-time updates",
              "Detailed auditing",
              "Team collaboration",
            ],
          };
  const savedLoginProfiles = loginProfiles.filter((profile) => profile.saved);
  const recentLoginProfiles = loginProfiles.filter((profile) => !profile.saved);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setActiveTab((currentTab) => {
      if (
        canUseActiveTab(currentUser, currentTab) &&
        currentTab !== "dashboard"
      ) {
        return currentTab;
      }

      const storedTab = readStoredActiveTab(currentUser);

      if (storedTab !== currentTab) {
        return storedTab;
      }

      return canUseActiveTab(currentUser, currentTab)
        ? currentTab
        : "dashboard";
    });
  }, [currentUser?.id, currentUser?.role_name]);

  useEffect(() => {
    storeActiveTab(currentUser, activeTab);
  }, [activeTab, currentUser?.id, currentUser?.role_name]);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const root = document.documentElement;
    root.classList.add("bowido-mobile-shell-active");

    return () => {
      root.classList.remove("bowido-mobile-shell-active");
    };
  }, [usesInternalScrollShell]);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const root = document.documentElement;
    root.classList.add("bowido-ios-tint-refresh");

    const rafId = window.requestAnimationFrame(() => {
      root.classList.remove("bowido-ios-tint-refresh");
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      root.classList.remove("bowido-ios-tint-refresh");
    };
  }, [activeTab, chromeTintColor, currentUser?.id, usesInternalScrollShell]);

  useEffect(() => {
    if (!usesInternalScrollShell) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [usesInternalScrollShell]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    const rootElement = document.getElementById("root");
    const previousThemeColor = themeColorMeta?.getAttribute("content") ?? null;
    const previousHtmlBackground =
      document.documentElement.style.backgroundColor;
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousRootBackground = rootElement?.style.backgroundColor ?? "";

    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", chromeTintColor);
    }

    document.documentElement.style.backgroundColor = chromeTintColor;
    document.body.style.backgroundColor = chromeTintColor;

    if (rootElement) {
      rootElement.style.backgroundColor = chromeTintColor;
    }

    return () => {
      if (themeColorMeta) {
        if (previousThemeColor === null) {
          themeColorMeta.removeAttribute("content");
        } else {
          themeColorMeta.setAttribute("content", previousThemeColor);
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
    setCredentialLoginMode(profile?.mode || "user");
    setCredentialLoginForm({
      email: profile?.mode === "user" ? profile.email || "" : "",
      kvk: profile?.mode === "customer" ? profile.kvk || "" : "",
      password: "",
    });
    setRememberLogin(Boolean(profile?.saved));
    setCompanyLoginOptions([]);
    setShowCredentialPassword(false);
    setIsCredentialLoginOpen(true);
  };

  const closeCredentialLogin = () => {
    if (isCredentialLoginSubmitting) {
      return;
    }

    setIsCredentialLoginOpen(false);
    setCredentialLoginError(null);
    setCompanyLoginOptions([]);
    setShowCredentialPassword(false);
  };

  const selectCredentialLoginMode = (mode: LoginMode) => {
    setCredentialLoginMode(mode);
    setCredentialLoginError(null);
    setCompanyLoginOptions([]);
  };

  const performCredentialLogin = async (customerDetailId?: number) => {
    const loginIdentifier =
      credentialLoginMode === "customer"
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
        email: credentialLoginMode === "user" ? loginIdentifier : undefined,
        kvk: credentialLoginMode === "customer" ? loginIdentifier : undefined,
        customerDetailId,
        password,
      });
      const updatedProfiles = upsertLoginProfile(
        loginProfiles,
        buildLoginProfile(
          result.user,
          credentialLoginMode,
          loginIdentifier,
          rememberLogin,
        ),
      );

      setLoginProfiles(updatedProfiles);
      storeLoginProfiles(updatedProfiles);
      setCurrentUser(result.user);
      storeCurrentUser(result.user);
      setCredentialLoginForm({ email: "", kvk: "", password: "" });
      setCompanyLoginOptions([]);
      setIsCredentialLoginOpen(false);
      setShowCredentialPassword(false);
      setRememberLogin(false);
      void refreshData();
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.data &&
        typeof error.data === "object" &&
        (error.data as { code?: string }).code ===
          "company_selection_required"
      ) {
        const companies = (error.data as { companies?: unknown }).companies;
        if (Array.isArray(companies)) {
          setCompanyLoginOptions(
            companies.filter(
              (company): company is CompanyLoginOption =>
                company !== null &&
                typeof company === "object" &&
                Number.isInteger(
                  (company as CompanyLoginOption).customer_detail_id,
                ) &&
                typeof (company as CompanyLoginOption).company_name ===
                  "string",
            ),
          );
          return;
        }
      }

      setCredentialLoginError(
        credentialLoginMode === "customer" &&
          error instanceof ApiError &&
          error.status === 401
          ? credentialLoginCopy.invalidCustomer
          : getCredentialLoginErrorMessage(error, credentialLoginCopy.invalid),
      );
    } finally {
      setIsCredentialLoginSubmitting(false);
    }
  };

  const handleCredentialLoginSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    void performCredentialLogin();
  };

  const handleLogout = () => {
    void apiService.auth.logout();
    setCurrentUser(null);
    storeCurrentUser(null);
    clearStoredActiveTab();
    setActiveTab("dashboard");
    setIsGhostReportOpen(false);
    setDriverSelectedPalletId(null);
    resetData();
    setLoginProfiles(readLoginProfiles());
  };

  const lookupKvkRegistration = async () => {
    if (!kvkRegistration.kvk.trim()) return;
    setIsKvkRegistrationSubmitting(true);
    setKvkRegistrationError(null);
    try {
      const customer = await apiService.auth.kvkLookup(kvkRegistration.kvk);
      setKvkRegistration((form) => ({
        ...form,
        kvk: customer.kvk,
        name: customer.company_name || form.name,
        email: customer.email || form.email,
        phone_number: customer.phone_number || form.phone_number,
        fixed_phone: customer.fixed_phone || form.fixed_phone,
        street: customer.street || form.street,
        house_number: customer.house_number || form.house_number,
        postal_code: customer.postal_code || form.postal_code,
        city: customer.city || form.city,
        warehouse1_street: customer.warehouse1_street || form.warehouse1_street,
        warehouse1_house_number:
          customer.warehouse1_house_number || form.warehouse1_house_number,
        warehouse1_postal_code:
          customer.warehouse1_postal_code || form.warehouse1_postal_code,
        warehouse1_city: customer.warehouse1_city || form.warehouse1_city,
        warehouse2_street: customer.warehouse2_street || form.warehouse2_street,
        warehouse2_house_number:
          customer.warehouse2_house_number || form.warehouse2_house_number,
        warehouse2_postal_code:
          customer.warehouse2_postal_code || form.warehouse2_postal_code,
        warehouse2_city: customer.warehouse2_city || form.warehouse2_city,
      }));
    } catch (error) {
      setKvkRegistrationError(
        error instanceof Error ? error.message : "KVK was not found.",
      );
    } finally {
      setIsKvkRegistrationSubmitting(false);
    }
  };

  const submitKvkRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(kvkRegistration.email.trim())) {
      setKvkRegistrationError(kvkFormLabels.invalidEmail);
      return;
    }
    setIsKvkRegistrationSubmitting(true);
    setKvkRegistrationError(null);
    try {
      await apiService.auth.kvkRegister(kvkRegistration);
      setIsKvkRegistrationOpen(false);
      setCredentialLoginMode("customer");
      setCredentialLoginForm({
        email: "",
        kvk: kvkRegistration.kvk,
        password: "",
      });
      setIsCredentialLoginOpen(true);
    } catch (error) {
      setKvkRegistrationError(
        error instanceof Error
          ? error.message
          : kvkFormLabels.registrationFailed,
      );
    } finally {
      setIsKvkRegistrationSubmitting(false);
    }
  };

  if (isRestoringSession && !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-emerald-900">
        <div className="text-center">
          <img
            src={logoImage}
            alt="Trackpal logo"
            className="mx-auto h-12 w-auto"
          />
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
            {language === "bs"
              ? "Učitavanje sesije"
              : language === "nl"
                ? "Sessie laden"
                : "Loading session"}
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    const currentLanguageOption =
      languageOptions.find((option) => option.code === language) ||
      languageOptions[0];

    return (
      <>
        <LandingShell
          isLoginOpen={isLandingLoginOpen || isMobileViewport}
          logoSrc={logoImage}
          loginLabel={t("loginButton")}
          onOpenLogin={() => setIsLandingLoginOpen(true)}
          marketingCopy={landingMarketingCopy}
        >
          <div className="space-y-4">
            <motion.div
              layout
              className="flex max-h-[calc(100dvh-20rem)] min-h-0 flex-col rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-[0_30px_70px_rgba(15,23,42,0.10)] sm:p-7"
            >
              <div className="mb-5 flex shrink-0 items-center justify-between border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full bg-[#00ae60]" />
                  <h1 className="text-[14px] font-black uppercase tracking-[0.22em] text-slate-900 sm:text-[16px]">
                    {credentialLoginCopy.title}
                  </h1>
                </div>

                <div className="flex items-center gap-3">
                  <div className="relative">
                    <button
                      type="button"
                      title={t("language")}
                      onClick={() =>
                        setShowLoginLanguageMenu(!showLoginLanguageMenu)
                      }
                      className="flex h-10 min-w-12 items-center justify-center rounded-xl border border-slate-100 px-3 text-[11px] font-black uppercase text-slate-400 transition-colors hover:border-emerald-200 hover:text-emerald-700"
                    >
                      {currentLanguageOption.shortLabel}
                    </button>
                    <AnimatePresence>
                      {showLoginLanguageMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 6, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
                          className="absolute right-0 top-full z-30 mt-2 w-40 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2 shadow-2xl"
                        >
                          {languageOptions.map((option) => (
                            <button
                              key={option.code}
                              type="button"
                              onClick={() => {
                                setLanguage(option.code);
                                setShowLoginLanguageMenu(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors",
                                option.code === language
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "text-slate-500 hover:bg-slate-50",
                              )}
                            >
                              <span className="text-[10px] font-black uppercase">
                                {option.shortLabel}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400">
                                {option.nativeLabel}
                              </span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLandingLoginOpen(false);
                      setShowLoginLanguageMenu(false);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    aria-label={
                      language === "bs"
                        ? "Zatvori"
                        : language === "nl"
                          ? "Sluiten"
                          : "Close"
                    }
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>

              <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1">
                <p className="text-[9px] font-black uppercase tracking-[0.21em] text-slate-400">
                  {credentialLoginCopy.recentLogins}
                </p>

                {[...savedLoginProfiles, ...recentLoginProfiles].map(
                  (profile, index) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => openCredentialLogin(profile)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-[20px] border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg",
                        index === 0
                          ? "border-[#00ae60]/25 bg-[#00ae60]/[0.055]"
                          : "border-slate-200 bg-slate-50/70",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-black uppercase text-[#00a95a]">
                          {profile.name}
                        </p>
                        <p className="truncate text-[11px] font-semibold text-slate-400">
                          {loginProfileSubtitle(profile)}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#00ae60] text-white shadow-[0_10px_20px_rgba(0,174,96,0.22)] transition-transform group-hover:scale-105">
                        <LogIn size={18} />
                      </span>
                    </button>
                  ),
                )}

                {savedLoginProfiles.length === 0 &&
                  recentLoginProfiles.length === 0 && (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 px-5 py-6 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                      {credentialLoginCopy.noLogins}
                    </div>
                  )}

                {loginError && (
                  <p className="text-[10px] font-black uppercase text-rose-500">
                    {loginError}
                  </p>
                )}
              </div>
            </motion.div>

            <div className="rounded-[26px] border border-slate-200/80 bg-white p-4 shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => openCredentialLogin()}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#00ae60] py-4 text-[13px] font-black uppercase tracking-[0.08em] text-white shadow-[0_10px_22px_rgba(0,174,96,0.18)] transition-all hover:bg-[#009d56] active:scale-[0.99]"
                >
                  <LogIn size={19} />
                  {t("loginButton")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setKvkRegistrationError(null);
                    setIsKvkRegistrationOpen(true);
                  }}
                  className="w-full rounded-2xl bg-slate-50 py-4 text-[12px] font-black uppercase tracking-[0.11em] text-slate-500 transition-colors hover:bg-slate-100"
                >
                  {kvkRegistrationCopy.title}
                </button>
              </div>
            </div>
          </div>
        </LandingShell>

        <AnimatePresence>
          {(isCredentialLoginOpen || isMobileViewport) && (
            <motion.div
              className="fixed inset-y-0 left-0 z-[200] flex w-full items-center justify-center overflow-y-auto bg-[#fbfcfd] p-5 sm:p-10 lg:w-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCredentialLogin}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="credential-login-title"
                className="w-full max-w-md overflow-hidden rounded-[34px] border border-slate-200/80 bg-white shadow-[0_30px_70px_rgba(15,23,42,0.12)]"
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-100 px-7 py-6 sm:px-9">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-[#00ae60]" />
                    <h2
                      id="credential-login-title"
                      className="text-[14px] font-black uppercase tracking-[0.2em] text-slate-950"
                    >
                      {credentialLoginCopy.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={closeCredentialLogin}
                    disabled={isCredentialLoginSubmitting}
                    className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50 md:flex"
                    aria-label={
                      language === "bs"
                        ? "Zatvori"
                        : language === "nl"
                          ? "Sluiten"
                          : "Close"
                    }
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-6 sm:px-9">
                  {(["user", "customer"] as LoginMode[]).map((mode) => {
                    const isActive = credentialLoginMode === mode;

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => selectCredentialLoginMode(mode)}
                        disabled={isCredentialLoginSubmitting}
                        className={cn(
                          "rounded-2xl border px-3 py-4 text-[10px] font-black uppercase tracking-[0.12em] transition-all disabled:opacity-50",
                          isActive
                            ? "border-[#00ae60] bg-[#00ae60] text-white shadow-[0_10px_20px_rgba(0,174,96,0.18)]"
                            : "border-slate-100 bg-slate-50 text-slate-400 hover:border-emerald-200 hover:text-emerald-700",
                        )}
                      >
                        {mode === "user"
                          ? credentialLoginCopy.userMode
                          : credentialLoginCopy.customerMode}
                      </button>
                    );
                  })}
                </div>

                <form
                  className="space-y-6 p-7 sm:p-9"
                  onSubmit={(event) => void handleCredentialLoginSubmit(event)}
                >
                  <div className="space-y-2">
                    <label
                      htmlFor={
                        credentialLoginMode === "customer"
                          ? "credential-login-kvk"
                          : "credential-login-email"
                      }
                      className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400"
                    >
                      {credentialLoginMode === "customer"
                        ? credentialLoginCopy.kvk
                        : credentialLoginCopy.email}
                    </label>
                    <Input
                      id={
                        credentialLoginMode === "customer"
                          ? "credential-login-kvk"
                          : "credential-login-email"
                      }
                      type={
                        credentialLoginMode === "customer" ? "text" : "email"
                      }
                      autoComplete="username"
                      inputMode={
                        credentialLoginMode === "customer" ? "numeric" : "email"
                      }
                      value={
                        credentialLoginMode === "customer"
                          ? credentialLoginForm.kvk
                          : credentialLoginForm.email
                      }
                      onChange={(event) => {
                        setCredentialLoginForm((previousState) => ({
                          ...previousState,
                          [credentialLoginMode === "customer"
                            ? "kvk"
                            : "email"]: event.target.value,
                        }));
                        setCredentialLoginError(null);
                      }}
                      className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-5 normal-case tracking-normal focus:bg-white"
                      placeholder={
                        credentialLoginMode === "customer"
                          ? "12345678"
                          : "korisnik@trackpal.app"
                      }
                      disabled={isCredentialLoginSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="credential-login-password"
                      className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400"
                    >
                      {credentialLoginCopy.password}
                    </label>
                    <div className="relative">
                      <Input
                        id="credential-login-password"
                        type={showCredentialPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={credentialLoginForm.password}
                        onChange={(event) => {
                          setCredentialLoginForm((previousState) => ({
                            ...previousState,
                            password: event.target.value,
                          }));
                          setCredentialLoginError(null);
                        }}
                        className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-5 pr-12 normal-case tracking-normal focus:bg-white"
                        disabled={isCredentialLoginSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowCredentialPassword((isShown) => !isShown)
                        }
                        className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-emerald-700 disabled:opacity-50"
                        aria-label={
                          showCredentialPassword
                            ? credentialLoginCopy.hidePassword
                            : credentialLoginCopy.showPassword
                        }
                        title={
                          showCredentialPassword
                            ? credentialLoginCopy.hidePassword
                            : credentialLoginCopy.showPassword
                        }
                        disabled={isCredentialLoginSubmitting}
                      >
                        {showCredentialPassword ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setRememberLogin((isRemembered) => !isRemembered)
                    }
                    disabled={isCredentialLoginSubmitting}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all disabled:opacity-50",
                      rememberLogin
                        ? "border-[#00ae60]/30 bg-emerald-50 text-emerald-900"
                        : "border-slate-100 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:text-emerald-700",
                    )}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.16em]">
                      {credentialLoginCopy.rememberMe}
                    </span>
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all",
                        rememberLogin
                          ? "border-[#00A655] bg-[#00A655]"
                          : "border-zinc-300 bg-white dark:border-white/20 dark:bg-transparent",
                      )}
                      aria-hidden="true"
                    >
                      {rememberLogin && (
                        <span className="h-2 w-2 rounded-sm bg-white" />
                      )}
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

                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={closeCredentialLogin}
                        disabled={isCredentialLoginSubmitting}
                        className="hidden flex-1 md:inline-flex"
                      >
                        {credentialLoginCopy.cancel}
                      </Button>
                      <Button
                        type="submit"
                        disabled={isCredentialLoginSubmitting}
                        className="flex-1 gap-2 md:flex-[1.25]"
                      >
                        <LogIn
                          size={15}
                          className={
                            isCredentialLoginSubmitting ? "animate-pulse" : ""
                          }
                        />
                        {credentialLoginCopy.submit}
                      </Button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setKvkRegistrationError(null);
                        setIsKvkRegistrationOpen(true);
                      }}
                      disabled={isCredentialLoginSubmitting}
                      className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 md:hidden"
                    >
                      {kvkRegistrationCopy.title}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
          {companyLoginOptions.length > 0 && (
            <motion.div
              className="modal-overlay fixed inset-0 z-[230] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                !isCredentialLoginSubmitting && setCompanyLoginOptions([])
              }
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="company-login-selection-title"
                className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.98 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-6">
                  <h2
                    id="company-login-selection-title"
                    className="text-sm font-black uppercase tracking-[0.16em] text-slate-950"
                  >
                    {credentialLoginCopy.chooseCompanyTitle}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {credentialLoginCopy.chooseCompanySubtitle}
                  </p>
                </div>

                <div className="space-y-3">
                  {companyLoginOptions.map((company) => (
                    <button
                      key={company.customer_detail_id}
                      type="button"
                      disabled={isCredentialLoginSubmitting}
                      onClick={() => {
                        setCompanyLoginOptions([]);
                        void performCredentialLogin(
                          company.customer_detail_id,
                        );
                      }}
                      className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left text-sm font-bold text-slate-800 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
                    >
                      <span>{company.company_name}</span>
                      <span aria-hidden="true" className="text-emerald-600">
                        →
                      </span>
                    </button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={isCredentialLoginSubmitting}
                  onClick={() => setCompanyLoginOptions([])}
                  className="mt-5 w-full"
                >
                  {credentialLoginCopy.cancel}
                </Button>
              </motion.div>
            </motion.div>
          )}
          {isKvkRegistrationOpen && (
            <motion.div
              className="modal-overlay fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto p-0 sm:items-center sm:p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() =>
                !isKvkRegistrationSubmitting && setIsKvkRegistrationOpen(false)
              }
            >
              <motion.form
                onSubmit={(event) => void submitKvkRegistration(event)}
                onClick={(event) => event.stopPropagation()}
                className="min-h-[100dvh] w-full max-w-lg space-y-4 bg-white p-5 shadow-2xl dark:bg-[#101715] sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:overflow-y-auto sm:rounded-2xl sm:border sm:border-zinc-200 sm:p-6 sm:dark:border-white/10"
              >
                <div>
                  <h2 className="font-display text-sm font-black uppercase tracking-[0.12em] dark:text-white">
                    {kvkRegistrationCopy.title}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {kvkRegistrationCopy.subtitle}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    required
                    inputMode="numeric"
                    placeholder={kvkFormLabels.kvk}
                    value={kvkRegistration.kvk}
                    onChange={(event) =>
                      setKvkRegistration({
                        ...kvkRegistration,
                        kvk: event.target.value,
                      })
                    }
                  />
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => void lookupKvkRegistration()}
                    disabled={isKvkRegistrationSubmitting}
                  >
                    {kvkRegistrationCopy.find}
                  </Button>
                </div>
                <label className="block text-xs font-bold dark:text-zinc-200">
                  {kvkFormLabels.company}
                  <Input
                    required
                    className="mt-1"
                    value={kvkRegistration.name}
                    onChange={(event) =>
                      setKvkRegistration({
                        ...kvkRegistration,
                        name: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="block text-xs font-bold dark:text-zinc-200">
                  {kvkFormLabels.email}
                  <Input
                    required
                    type="email"
                    className={cn(
                      "mt-1",
                      kvkRegistration.email &&
                        !EMAIL_PATTERN.test(kvkRegistration.email) &&
                        "border-rose-500 focus:border-rose-500",
                    )}
                    value={kvkRegistration.email}
                    onChange={(event) =>
                      setKvkRegistration({
                        ...kvkRegistration,
                        email: event.target.value,
                      })
                    }
                  />
                  {kvkRegistration.email &&
                    !EMAIL_PATTERN.test(kvkRegistration.email) && (
                      <p className="mt-1 text-xs font-semibold text-rose-600">
                        {kvkFormLabels.invalidEmail}
                      </p>
                    )}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold dark:text-zinc-200">
                    {kvkFormLabels.phone}
                    <Input
                      className="mt-1"
                      value={kvkRegistration.phone_number}
                      onChange={(event) =>
                        setKvkRegistration({
                          ...kvkRegistration,
                          phone_number: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-bold dark:text-zinc-200">
                    {kvkFormLabels.fixed}
                    <Input
                      className="mt-1"
                      value={kvkRegistration.fixed_phone}
                      onChange={(event) =>
                        setKvkRegistration({
                          ...kvkRegistration,
                          fixed_phone: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <details className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-widest dark:text-white">
                    {kvkFormLabels.address}
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.street}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.street}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            street: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.house}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.house_number}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            house_number: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.postal}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.postal_code}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            postal_code: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.city}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.city}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            city: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </details>
                <details className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-widest dark:text-white">
                    {kvkFormLabels.warehouse1}
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.street}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse1_street}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse1_street: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.house}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse1_house_number}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse1_house_number: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.postal}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse1_postal_code}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse1_postal_code: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.city}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse1_city}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse1_city: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </details>
                <details className="rounded-xl border border-zinc-200 p-3 dark:border-white/10">
                  <summary className="cursor-pointer text-xs font-black uppercase tracking-widest dark:text-white">
                    {kvkFormLabels.warehouse2}
                  </summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.street}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse2_street}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse2_street: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.house}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse2_house_number}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse2_house_number: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.postal}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse2_postal_code}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse2_postal_code: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="text-xs font-bold dark:text-zinc-200">
                      {kvkFormLabels.city}
                      <Input
                        className="mt-1"
                        value={kvkRegistration.warehouse2_city}
                        onChange={(event) =>
                          setKvkRegistration({
                            ...kvkRegistration,
                            warehouse2_city: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                </details>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold dark:text-zinc-200">
                    {kvkFormLabels.password}
                    <Input
                      required
                      minLength={8}
                      type="password"
                      className="mt-1"
                      value={kvkRegistration.password}
                      onChange={(event) =>
                        setKvkRegistration({
                          ...kvkRegistration,
                          password: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-bold dark:text-zinc-200">
                    {kvkFormLabels.confirmPassword}
                    <Input
                      required
                      minLength={8}
                      type="password"
                      className="mt-1"
                      value={kvkRegistration.password_confirmation}
                      onChange={(event) =>
                        setKvkRegistration({
                          ...kvkRegistration,
                          password_confirmation: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                {kvkRegistrationError && (
                  <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                    {kvkRegistrationError}
                  </p>
                )}
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsKvkRegistrationOpen(false)}
                    disabled={isKvkRegistrationSubmitting}
                  >
                    {kvkFormLabels.cancel}
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isKvkRegistrationSubmitting}
                  >
                    {kvkFormLabels.register}
                  </Button>
                </div>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  const renderDashboard = () => {
    if (activeTab === "gallery") return <ImageGallery />;
    if (activeTab === "client-manager") return <AdminClientManagerView />;
    if (activeTab === "roles") return <RoleManager />;
    if (activeTab === "korisnici")
      return <UserManager currentUser={currentUser} />;
    if (activeTab === "invoices") return <BillingList />;
    if (activeTab === "admin-service")
      return <AdminRoleOperationsView mode="service" />;
    if (
      activeTab === "customer-details" &&
      currentUser.role_name === RoleType.KLIJENT
    ) {
      return <CustomerDetailsPage />;
    }
    if (
      activeTab === "settings" &&
      (currentUser.role_name !== RoleType.ADMIN || usesRoleMobileShell)
    ) {
      return (
        <Card title={t("settings")} className="w-full">
          <ThemeSettingsToggle
            isNightMode={isNightMode}
            onToggle={() => setIsNightMode((current) => !current)}
            label={t("nightMode")}
            onLabel={t("on")}
            offLabel={t("off")}
          />
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-left dark:border-emerald-500/20 dark:bg-emerald-900/20">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
              {t("language")}
            </span>
            <div className="mt-3">
              <Select
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as typeof language)
                }
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.nativeLabel}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleLogout}
            className="mt-5 w-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-500/30 dark:text-rose-200"
          >
            {t("logout")}
          </Button>
        </Card>
      );
    }

    if (
      currentUser.role_name === RoleType.KLIJENT &&
      (activeTab === "client-table" ||
        (!usesRoleMobileShell && activeTab === "dashboard"))
    ) {
      return <ClientTableView clientIdFilter={currentUser.id} />;
    }

    if (usesRoleMobileShell) {
      return (
        <DriverMobileDashboard
          user={currentUser}
          selectedPalletId={driverSelectedPalletId}
          onSelectedPalletIdChange={setDriverSelectedPalletId}
        />
      );
    }

    switch (currentUser.role_name) {
      case RoleType.ADMIN: {
        const adminTabsMap: Record<
          string,
          | "overview"
          | "pallets"
          | "clients"
          | "users"
          | "settings"
          | "logs"
          | "billing"
          | "roles"
          | "calendar"
          | "noQrPallets"
          | "clientManager"
          | "adminService"
          | "adminWarehouse"
          | "adminFinance"
        > = {
          dashboard: "overview",
          pallets: "pallets",
          "no-qr-pallets": "noQrPallets",
          calendar: "calendar",
          "audit-logs": "logs",
          users: "clients",
          "client-manager": "clientManager",
          "admin-service": "adminService",
          "admin-warehouse": "adminWarehouse",
          "admin-finance": "adminFinance",
          korisnici: "users",
          roles: "roles",
          invoices: "billing",
          settings: "settings",
        };
        const view = adminTabsMap[activeTab] || "overview";
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
        return (
          <DriverMobileDashboard
            user={currentUser}
            selectedPalletId={driverSelectedPalletId}
            onSelectedPalletIdChange={setDriverSelectedPalletId}
          />
        );
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
          settingsTitle={t("settings")}
          logoutTitle={t("logout")}
          settingsActive={activeTab === "settings"}
          palletActive={activeTab === "client-table"}
          onToggleSettings={() =>
            setActiveTab(activeTab === "settings" ? "dashboard" : "settings")
          }
          onLogout={handleLogout}
          logoSrc={logoImage}
          bodyClassName={
            activeTab === "settings" || activeTab === "client-table"
              ? "px-4"
              : "px-0"
          }
          showPalletIcon={currentUser.role_name === RoleType.KLIJENT}
          onPalletIconClick={() =>
            setActiveTab(
              activeTab === "client-table" ? "dashboard" : "client-table",
            )
          }
          showDetailsIcon={currentUser.role_name === RoleType.KLIJENT}
          detailsActive={activeTab === "customer-details"}
          onDetailsIconClick={() => setActiveTab("customer-details")}
          showClientMenu={currentUser.role_name === RoleType.KLIJENT}
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
                      setActiveTab("pallets");
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
        "bg-white text-emerald-900 font-sans selection:bg-[#00A655] selection:text-white transition-colors dark:bg-[#070b0a] dark:text-zinc-50",
        isNightMode && "dark",
        usesFixedMobileShell
          ? "fixed inset-0 flex flex-col overflow-hidden"
          : "min-h-screen",
      )}
    >
      <div
        className="safari-tint-sentinel safari-tint-sentinel--app"
        aria-hidden="true"
      />
      <TopNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={currentUser.role_name}
        user={currentUser}
        onLogout={handleLogout}
      />

      <div
        className={cn(
          "flex flex-col md:flex-row bg-white dark:bg-transparent",
          usesFixedMobileShell
            ? "min-h-0 flex-1 pt-28 md:pt-0"
            : "min-h-screen pt-28 md:pt-0",
        )}
      >
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          role={currentUser.role_name}
          permissionCodes={currentUser.permission_codes}
          backendRoleName={currentUser.backend_role_name}
          onLogout={handleLogout}
        />

        <main
          className={cn(
            "relative flex flex-1 flex-col bg-white dark:bg-transparent",
            usesFixedMobileShell
              ? "min-h-0 overflow-y-auto overscroll-y-contain pb-[calc(env(safe-area-inset-bottom)+5.5rem)] scroll-smooth no-scrollbar"
              : "h-[calc(100vh-7rem)] overflow-y-auto pb-24 scroll-smooth no-scrollbar md:h-screen md:pt-16 md:pb-0",
          )}
          style={
            usesFixedMobileShell
              ? { WebkitOverflowScrolling: "touch" }
              : undefined
          }
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
                    setActiveTab("pallets");
                    setPendingPalletDetailId(pallet.id);
                  }
                : undefined
            }
          />
        )}

        {isGhostReportOpen &&
          currentUser &&
          currentUser.role_name !== RoleType.SERVISER && (
            <GhostPalletCenter
              currentUser={currentUser}
              onClose={() => setIsGhostReportOpen(false)}
            />
          )}
      </AnimatePresence>
    </div>
  );
}
