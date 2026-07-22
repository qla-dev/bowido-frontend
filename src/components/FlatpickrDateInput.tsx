import React, { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import type { Instance } from "flatpickr/dist/types/instance";
import type { CustomLocale } from "flatpickr/dist/types/locale";
import { english } from "flatpickr/dist/l10n/default.js";
import { Dutch } from "flatpickr/dist/l10n/nl.js";
import "flatpickr/dist/flatpickr.min.css";
import "../styles/flatpickr-theme.css";
import type { AppLanguage } from "../i18n";
import {
  MONTH_NAMES,
  WEEKDAY_LABELS_SUNDAY_FIRST,
  WEEKDAY_NAMES_SUNDAY_FIRST,
} from "../lib/dateFormat";
import { cn } from "./ui";
import { CalendarDays } from "lucide-react";

type SevenStrings = [string, string, string, string, string, string, string];
type TwelveStrings = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

const bosnianLocale: CustomLocale = {
  firstDayOfWeek: 1,
  weekdays: {
    shorthand: [...WEEKDAY_LABELS_SUNDAY_FIRST.bs] as SevenStrings,
    longhand: [...WEEKDAY_NAMES_SUNDAY_FIRST.bs] as SevenStrings,
  },
  months: {
    shorthand: [
      "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
      "Jul", "Avg", "Sep", "Okt", "Nov", "Dec",
    ],
    longhand: [...MONTH_NAMES.bs] as TwelveStrings,
  },
  rangeSeparator: " do ",
  weekAbbreviation: "Sed",
  scrollTitle: "Skrolujte za promjenu",
  toggleTitle: "Kliknite za promjenu",
  yearAriaLabel: "Godina",
  monthAriaLabel: "Mjesec",
  hourAriaLabel: "Sat",
  minuteAriaLabel: "Minuta",
  time_24hr: true,
};

const localeByLanguage = (language: AppLanguage) => {
  if (language === "bs") {
    return bosnianLocale;
  }

  if (language === "nl") {
    return Dutch;
  }

  return english;
};

const displayFormatByLanguage: Record<AppLanguage, string> = {
  en: "m/d/Y",
  nl: "d-m-Y",
  bs: "d.m.Y.",
};

const placeholderByLanguage: Record<AppLanguage, string> = {
  en: "mm/dd/yyyy",
  nl: "dd-mm-yyyy",
  bs: "dd.mm.yyyy.",
};

interface FlatpickrDateInputProps {
  value: string;
  onChange: (value: string) => void;
  language: AppLanguage;
  className?: string;
  containerClassName?: string;
  prefix?: React.ReactNode;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  enableTime?: boolean;
  compact?: boolean;
  popupPosition?: "below left" | "below right";
}

export const FlatpickrDateInput: React.FC<FlatpickrDateInputProps> = ({
  value,
  onChange,
  language,
  className,
  containerClassName,
  prefix,
  placeholder,
  ariaLabel,
  disabled = false,
  minDate,
  maxDate,
  enableTime = false,
  compact = false,
  popupPosition = "below left",
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const instanceRef = useRef<Instance | null>(null);
  const onChangeRef = useRef(onChange);
  const valueFormat = enableTime ? "Y-m-d H:i" : "Y-m-d";
  const calendarButtonLabel = language === "bs"
    ? `Otvori kalendar: ${ariaLabel || placeholderByLanguage[language]}`
    : language === "nl"
      ? `Kalender openen: ${ariaLabel || placeholderByLanguage[language]}`
      : `Open calendar: ${ariaLabel || placeholderByLanguage[language]}`;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!inputRef.current) {
      return undefined;
    }

    const instance = flatpickr(inputRef.current, {
      altInput: true,
      altInputClass: cn(
        "flatpickr-date-input w-full rounded-xl border border-[color:var(--border-subtle)] bg-[var(--surface-input)] px-4 py-3 pr-10 text-[14px] font-semibold tracking-normal text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-muted)] placeholder:opacity-50 focus:border-[color:var(--action-primary)] focus:bg-[var(--surface-panel)]",
        className,
      ),
      altFormat: enableTime
        ? `${displayFormatByLanguage[language]} H:i`
        : displayFormatByLanguage[language],
      allowInput: true,
      dateFormat: valueFormat,
      defaultDate: value || undefined,
      disableMobile: true,
      enableTime,
      time_24hr: language !== "en",
      locale: localeByLanguage(language),
      minDate: minDate || undefined,
      maxDate: maxDate || undefined,
      monthSelectorType: "static",
      nextArrow: "&#8250;",
      position: popupPosition as "below left" | "below right",
      positionElement: inputRef.current.parentElement || inputRef.current,
      prevArrow: "&#8249;",
      onChange: (_dates, dateString) => onChangeRef.current(dateString),
      onReady: (_dates, _dateString, readyInstance) => {
        readyInstance.calendarContainer.classList.add("trackpal-flatpickr");
        if (readyInstance.altInput) {
          readyInstance.altInput.placeholder =
            placeholder ?? placeholderByLanguage[language];
          readyInstance.altInput.disabled = disabled;
          if (ariaLabel) {
            readyInstance.altInput.setAttribute("aria-label", ariaLabel);
          }
        }
      },
    });

    instanceRef.current = instance;

    return () => {
      instance.destroy();
      instanceRef.current = null;
    };
  }, [ariaLabel, className, disabled, enableTime, language, placeholder, popupPosition, valueFormat]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) {
      return;
    }

    instance.set("minDate", minDate || undefined);
    instance.set("maxDate", maxDate || undefined);
  }, [maxDate, minDate]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) {
      return;
    }

    if (!value) {
      instance.clear(false);
      return;
    }

    if (instance.input.value !== value) {
      instance.setDate(value, false, valueFormat);
    }
  }, [value, valueFormat]);

  return (
    <div
      className={cn("relative min-w-0", containerClassName)}
      onClick={() => {
        if (!disabled) {
          instanceRef.current?.open();
        }
      }}
    >
      {prefix}
      <input
        ref={inputRef}
        type="text"
        data-flatpickr-source=""
        style={{ display: "none" }}
        defaultValue={value}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        placeholder={placeholder ?? placeholderByLanguage[language]}
      />
      <button
        type="button"
        aria-label={calendarButtonLabel}
        disabled={disabled}
        onClick={() => instanceRef.current?.open()}
        className={cn(
          "absolute top-1/2 z-10 flex -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-emerald-400",
          compact ? "right-1 h-6 w-6" : "right-2.5 h-8 w-8",
        )}
      >
        <CalendarDays size={compact ? 13 : 16} aria-hidden="true" />
      </button>
    </div>
  );
};
