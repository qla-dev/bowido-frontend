import type { AppLanguage } from "../i18n";

export const MONTH_NAMES: Record<AppLanguage, readonly string[]> = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  nl: [
    "januari", "februari", "maart", "april", "mei", "juni",
    "juli", "augustus", "september", "oktober", "november", "december",
  ],
  bs: [
    "januar", "februar", "mart", "april", "maj", "juni",
    "juli", "august", "septembar", "oktobar", "novembar", "decembar",
  ],
};

export const WEEKDAY_LABELS_SUNDAY_FIRST: Record<
  AppLanguage,
  readonly string[]
> = {
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  nl: ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"],
  bs: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"],
};

export const WEEKDAY_LABELS_MONDAY_FIRST: Record<
  AppLanguage,
  readonly string[]
> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  nl: ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"],
  bs: ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"],
};

export const WEEKDAY_NAMES_SUNDAY_FIRST: Record<
  AppLanguage,
  readonly string[]
> = {
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  nl: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"],
  bs: ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"],
};

type DateValue = string | number | Date;

const toValidDate = (value: DateValue): Date | null => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const twoDigits = (value: number) => String(value).padStart(2, "0");

export const formatAppDate = (
  value: DateValue,
  language: AppLanguage,
  fallback = "-",
): string => {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  const day = twoDigits(date.getDate());
  const month = twoDigits(date.getMonth() + 1);
  const year = date.getFullYear();

  if (language === "bs") {
    return `${day}.${month}.${year}.`;
  }

  if (language === "nl") {
    return `${day}-${month}-${year}`;
  }

  return `${month}/${day}/${year}`;
};

export const formatAppTime = (
  value: DateValue,
  fallback = "-",
): string => {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
};

export const formatAppDateTime = (
  value: DateValue,
  language: AppLanguage,
  fallback = "-",
): string => {
  const date = toValidDate(value);

  if (!date) {
    return fallback;
  }

  return `${formatAppDate(date, language, fallback)} ${formatAppTime(date, fallback)}`;
};

export const formatAppMonthYear = (
  year: number,
  month: number,
  language: AppLanguage,
): string => `${MONTH_NAMES[language][month] || ""} ${year}`.trim();
