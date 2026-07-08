import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Badge, Input, Select, StatCard, cn } from './ui';
import { useApp } from '../AppContext';
import {
  Bell,
  Calendar as CalendarIcon,
  DollarSign,
  Plus,
  MessageSquare,
  X,
  FileText,
  Clock3,
  CircleAlert,
  BadgeCheck,
  Pencil,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarNote, Invoice, ManagedUser } from '../types';
import { localeMap } from '../i18n';
import { apiService } from '../services/api';

type MarkerKind = 'review' | 'collection' | 'followup' | 'ops';

interface CalendarMarker {
  kind: MarkerKind;
  titleKey: string;
  detailKey: string;
  time: string;
}

const markerTheme: Record<
  MarkerKind,
  { dot: string; badge: string; soft: string; labelKey: string }
> = {
  review: {
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-100',
    soft: 'bg-amber-50/70 border-amber-100',
    labelKey: 'calendarMarkerReview',
  },
  collection: {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    soft: 'bg-emerald-50/70 border-emerald-100',
    labelKey: 'calendarMarkerCollection',
  },
  followup: {
    dot: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-100',
    soft: 'bg-blue-50/70 border-blue-100',
    labelKey: 'calendarMarkerFollowup',
  },
  ops: {
    dot: 'bg-zinc-400',
    badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    soft: 'bg-zinc-50 border-zinc-100',
    labelKey: 'calendarMarkerOps',
  },
};

const formatCurrency = (amount: number) => `EUR ${amount.toFixed(0)}`;

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

const toDateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const toDateInputValue = (date: Date) => toDateKey(date.getFullYear(), date.getMonth(), date.getDate());

const calendarMonthNames: Record<string, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  nl: ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
  bs: ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'],
};

const parseDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return { year, month: month - 1, day };
};

const getMonthDateRange = (year: number, month: number) => ({
  date_from: toDateKey(year, month, 1),
  date_to: toDateKey(year, month, daysInMonth(year, month)),
});

const normalizeTimeInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const hourOnly = trimmed.match(/^([01]?\d|2[0-3])$/);
  if (hourOnly) {
    return `${hourOnly[1].padStart(2, '0')}:00`;
  }

  const colonTime = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (colonTime) {
    return `${colonTime[1].padStart(2, '0')}:${colonTime[2]}`;
  }

  const compactTime = trimmed.match(/^([01]?\d|2[0-3])([0-5]\d)$/);
  if (compactTime) {
    return `${compactTime[1].padStart(2, '0')}:${compactTime[2]}`;
  }

  return null;
};

const calendarHourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const calendarMinuteOptions = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, '0'));
const DEFAULT_NOTE_TIME_PARTS = { hour: '09', minute: '00' };

const getTimeParts = (value: string) => {
  const normalized = normalizeTimeInput(value);

  if (!normalized) {
    return DEFAULT_NOTE_TIME_PARTS;
  }

  const [hour, minute] = normalized.split(':');
  return {
    hour: hour || DEFAULT_NOTE_TIME_PARTS.hour,
    minute: minute || DEFAULT_NOTE_TIME_PARTS.minute,
  };
};

const TimeSelect = ({
  label,
  options,
  selectedValue,
  disabled,
  onSelect,
}: {
  label: string;
  options: string[];
  selectedValue: string | null;
  disabled: boolean;
  onSelect: (value: string) => void;
}) => (
  <div className="min-w-0 flex-1">
    <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
      {label}
    </label>
    <select
      value={selectedValue || ''}
      onChange={(event) => onSelect(event.target.value)}
      disabled={disabled}
      className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 py-2.5 font-mono text-sm font-black text-zinc-950 outline-none transition-all hover:border-zinc-300 focus:border-[#00A655] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="">--</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>
);

export const BillingCalendar: React.FC = () => {
  const { invoices, t, language } = useApp();
  const locale = localeMap[language];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [editingNote, setEditingNote] = useState<CalendarNote | null>(null);
  const [noteDateDraft, setNoteDateDraft] = useState('');
  const [noteTitleDraft, setNoteTitleDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [noteTimeDraft, setNoteTimeDraft] = useState('');
  const [notifiedUserIds, setNotifiedUserIds] = useState<number[]>([]);
  const [notifiedUsersDraft, setNotifiedUsersDraft] = useState<ManagedUser[]>([]);
  const [calendarNotes, setCalendarNotes] = useState<CalendarNote[]>([]);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [notifyCandidates, setNotifyCandidates] = useState<ManagedUser[]>([]);
  const [isUserSearchLoading, setIsUserSearchLoading] = useState(false);
  const dateInputRef = useRef<HTMLInputElement | null>(null);

  const weekDays = useMemo(() => {
    const start = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
      )
    );
  }, [locale]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = calendarMonthNames[language] || calendarMonthNames.en;
  const monthYearStr = `${monthNames[month]} ${year}`;
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, optionMonth) => ({
        value: optionMonth,
        label: monthNames[optionMonth],
      })),
    [monthNames]
  );
  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    const currentYear = new Date().getFullYear();

    for (let optionYear = currentYear - 5; optionYear <= currentYear + 5; optionYear += 1) {
      years.add(optionYear);
    }

    years.add(year);
    invoices.forEach((invoice) => {
      const invoiceYear = new Date(invoice.due_date).getFullYear();
      if (!Number.isNaN(invoiceYear)) {
        years.add(invoiceYear);
      }
    });

    return Array.from(years).sort((left, right) => left - right);
  }, [invoices, year]);
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthDays = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  useEffect(() => {
    let isCurrent = true;

    if (!apiService.hasToken()) {
      setCalendarNotes([]);
      return undefined;
    }

    setIsNotesLoading(true);
    void apiService.calendarNotes
      .list({
        ...getMonthDateRange(year, month),
        limit: 100,
        sort_by: 'note_date',
        sort_direction: 'asc',
      })
      .then((notes) => {
        if (isCurrent) {
          setCalendarNotes(notes);
        }
      })
      .catch((error) => {
        console.error('Failed to load calendar notes', error);
        if (isCurrent) {
          setCalendarNotes([]);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsNotesLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [month, year]);

  useEffect(() => {
    if (!showNotifyModal || !apiService.hasToken()) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsUserSearchLoading(true);
      void apiService.calendarNotes
        .notifyCandidates({
          search: userSearch.trim() || undefined,
          limit: 20,
        })
        .then(setNotifyCandidates)
        .catch((error) => {
          console.error('Failed to search users for calendar notification', error);
          setNotifyCandidates([]);
        })
        .finally(() => setIsUserSearchLoading(false));
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [showNotifyModal, userSearch]);

  const invoicesByDay = useMemo(() => {
    const map: Record<number, Invoice[]> = {};
    invoices.forEach((invoice) => {
      const invoiceDate = new Date(invoice.due_date);
      if (invoiceDate.getMonth() === month && invoiceDate.getFullYear() === year) {
        const day = invoiceDate.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(invoice);
      }
    });
    return map;
  }, [invoices, month, year]);

  const monthMarkers = useMemo(() => {
    const schedule: Array<CalendarMarker & { day: number }> = [
      {
        day: 4,
        kind: 'review',
        titleKey: 'calendarTitleWeeklyReconciliation',
        detailKey: 'calendarDetailWeeklyReconciliation',
        time: '08:30',
      },
      {
        day: 8,
        kind: 'collection',
        titleKey: 'calendarTitleExpectedInboundPayment',
        detailKey: 'calendarDetailExpectedInboundPayment',
        time: '11:00',
      },
      {
        day: 13,
        kind: 'followup',
        titleKey: 'calendarTitleClientFollowupRound',
        detailKey: 'calendarDetailClientFollowupRound',
        time: '13:30',
      },
      {
        day: 19,
        kind: 'ops',
        titleKey: 'calendarTitleBillingHandoff',
        detailKey: 'calendarDetailBillingHandoff',
        time: '10:15',
      },
      {
        day: 25,
        kind: 'review',
        titleKey: 'calendarTitleMonthEndReview',
        detailKey: 'calendarDetailMonthEndReview',
        time: '16:00',
      },
    ];

    return schedule.reduce<Record<string, CalendarMarker[]>>((acc, marker) => {
      if (marker.day <= monthDays.length) {
        const key = toDateKey(year, month, marker.day);
        if (!acc[key]) acc[key] = [];
        acc[key].push({
          kind: marker.kind,
          titleKey: marker.titleKey,
          detailKey: marker.detailKey,
          time: marker.time,
        });
      }
      return acc;
    }, {});
  }, [month, monthDays.length, year]);

  const selectedDateKey = selectedDay ? toDateKey(year, month, selectedDay) : null;
  const selectedDayInvoices = selectedDay ? invoicesByDay[selectedDay] || [] : [];
  const calendarNotesByDay = useMemo(() => {
    return calendarNotes.reduce<Record<string, CalendarNote[]>>((acc, note) => {
      if (!note.note_date) {
        return acc;
      }

      if (!acc[note.note_date]) {
        acc[note.note_date] = [];
      }

      acc[note.note_date].push(note);
      return acc;
    }, {});
  }, [calendarNotes]);
  const selectedNotes = selectedDateKey ? calendarNotesByDay[selectedDateKey] || [] : [];
  const selectedMarkers = selectedDateKey ? monthMarkers[selectedDateKey] || [] : [];
  const monthlyInvoices: Invoice[] = (Object.values(invoicesByDay) as Invoice[][]).reduce<Invoice[]>(
    (allInvoices, dayInvoices) => allInvoices.concat(dayInvoices),
    []
  );

  const totalOwedSelected = selectedDayInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const paidSelected = selectedDayInvoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const unpaidSelected = selectedDayInvoices
    .filter((invoice) => invoice.status !== 'paid')
    .reduce((sum, invoice) => sum + invoice.total_amount, 0);

  const monthlyDue = monthlyInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0);
  const monthlyInvoiceCount = monthlyInvoices.length;
  const monthlyUnpaidCount = monthlyInvoices.filter((invoice) => invoice.status !== 'paid').length;
  const visibleNoteDayKeys = Object.keys(calendarNotesByDay).filter((dateKey) => {
    const parsedDate = parseDateKey(dateKey);
    return parsedDate?.year === year && parsedDate.month === month;
  });
  const markedDayCount = new Set([...Object.keys(monthMarkers), ...visibleNoteDayKeys]).size;
  const normalizedNoteTimeDraft = normalizeTimeInput(noteTimeDraft);
  const hasNoteTimeDraft = Boolean(normalizedNoteTimeDraft);
  const noteTimeParts = getTimeParts(noteTimeDraft);
  const setNoteTimePart = (part: 'hour' | 'minute', value: string) => {
    const currentParts = getTimeParts(noteTimeDraft);
    const nextHour = part === 'hour' ? value : currentParts.hour;
    const nextMinute = part === 'minute' ? value : currentParts.minute;

    setNoteTimeDraft(`${nextHour}:${nextMinute}`);
  };

  const upcomingAgenda = useMemo(() => {
    return Object.entries(monthMarkers)
      .map(([key, markers]) => ({
        key,
        day: Number(key.slice(-2)),
        markers,
      }))
      .sort((a, b) => a.day - b.day)
      .slice(0, 4);
  }, [monthMarkers]);

  const openNoteEditor = (note?: CalendarNote) => {
    const draftDate = note?.note_date || selectedDateKey || toDateInputValue(new Date());

    setEditingNote(note || null);
    setNoteDateDraft(draftDate);
    setNoteTitleDraft(note?.title || '');
    setNoteDraft(note?.note || '');
    setNoteTimeDraft(note?.note_time || '');
    setNotifiedUserIds(note?.notified_user_ids || []);
    setNotifiedUsersDraft(note?.notified_users || []);
    setNoteError(null);
    setShowNoteEditor(true);
  };

  const saveNote = async () => {
    const note = noteDraft.trim();
    const title = noteTitleDraft.trim();
    const normalizedTime = normalizeTimeInput(noteTimeDraft);

    if (!noteDateDraft || !note) {
      setNoteError(t('calendarNoteRequired'));
      return;
    }

    if (normalizedTime === null) {
      setNoteError(t('calendarInvalidTime'));
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      const payload = {
        note_date: noteDateDraft,
        note_time: normalizedTime || undefined,
        title: title || undefined,
        note,
        notified_user_ids: notifiedUserIds,
      };
      const savedNote = editingNote
        ? await apiService.calendarNotes.update(editingNote.id, payload)
        : await apiService.calendarNotes.create(payload);
      const parsedDate = parseDateKey(savedNote.note_date);

      setCalendarNotes((prev) => {
        const nextNotes = editingNote
          ? prev.map((existingNote) => (existingNote.id === savedNote.id ? savedNote : existingNote))
          : [...prev, savedNote];

        return nextNotes.sort((left, right) =>
          `${left.note_date} ${left.note_time || ''} ${left.id}`.localeCompare(
            `${right.note_date} ${right.note_time || ''} ${right.id}`
          )
        );
      });

      if (parsedDate) {
        setCurrentDate(new Date(parsedDate.year, parsedDate.month, 1));
        setSelectedDay(parsedDate.day);
      }

      setShowNoteEditor(false);
    } catch (error) {
      console.error('Failed to save calendar note', error);
      setNoteError(t('calendarNoteSaveFailed'));
    } finally {
      setIsSavingNote(false);
    }
  };

  const deleteNote = async () => {
    if (!editingNote) {
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      await apiService.calendarNotes.delete(editingNote.id);
      setCalendarNotes((prev) => prev.filter((note) => note.id !== editingNote.id));
      setShowNoteEditor(false);
    } catch (error) {
      console.error('Failed to delete calendar note', error);
      setNoteError(t('calendarNoteDeleteFailed'));
    } finally {
      setIsSavingNote(false);
    }
  };

  const toggleNotifyUser = (user: ManagedUser) => {
    setNotifiedUserIds((prev) => {
      if (prev.includes(user.id)) {
        return prev.filter((id) => id !== user.id);
      }

      return [...prev, user.id];
    });

    setNotifiedUsersDraft((prev) => {
      if (prev.some((item) => item.id === user.id)) {
        return prev.filter((item) => item.id !== user.id);
      }

      return [...prev, user];
    });
  };

  const formatDayMonthLabel = (day: number, monthIndex = month) =>
    language === 'en' ? `${monthNames[monthIndex]} ${day}` : `${day}. ${monthNames[monthIndex]}`;

  const formatCalendarDayLabel = (day: number) => formatDayMonthLabel(day);

  const formatDateKeyLabel = (dateKey: string) => {
    const parsedDate = parseDateKey(dateKey);

    if (!parsedDate) {
      return dateKey;
    }

    const label = formatDayMonthLabel(parsedDate.day, parsedDate.month);
    return language === 'en' ? `${label}, ${parsedDate.year}` : `${label} ${parsedDate.year}`;
  };

  const formatNoteDateDayMonth = (dateKey: string) => {
    const parsedDate = parseDateKey(dateKey);
    if (!parsedDate) return '--';
    return formatDayMonthLabel(parsedDate.day, parsedDate.month);
  };

  const formatNoteDateYear = (dateKey: string) => {
    const parsedDate = parseDateKey(dateKey);
    if (!parsedDate) return '----';
    return String(parsedDate.year);
  };

  const handleMonthChange = (nextMonth: number) => {
    setCurrentDate(new Date(year, nextMonth, 1));
    setSelectedDay(null);
  };

  const handleYearChange = (nextYear: number) => {
    setCurrentDate(new Date(nextYear, month, 1));
    setSelectedDay(null);
  };

  const getInvoiceStatusLabel = (status: Invoice['status']) => {
    if (status === 'paid') return t('paid');
    if (status === 'sent') return t('sentLabel');
    return t('unpaid');
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={t('monthDue')} value={formatCurrency(monthlyDue)} variant="success" />
        <StatCard label={t('invoicesLabel')} value={monthlyInvoiceCount} variant="info" />
        <StatCard label={t('unpaid')} value={monthlyUnpaidCount} variant="danger" />
        <StatCard label={t('markedDays')} value={markedDayCount} variant="warning" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8">
          <Card noPadding className="overflow-hidden">
            <div className="px-6 py-5 border-b border-zinc-100 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">
                  {t('calendar')}
                </p>
                <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3 text-zinc-950">
                  <CalendarIcon size={20} className="text-emerald-600" />
                  {monthYearStr}
                </h3>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[minmax(11rem,13rem)_7.5rem]">
                <Select
                  value={String(month)}
                  onChange={(event) => handleMonthChange(Number(event.target.value))}
                  className="h-11 bg-white py-0 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-700"
                  aria-label={t('calendar')}
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  value={String(year)}
                  onChange={(event) => handleYearChange(Number(event.target.value))}
                  className="h-11 bg-white py-0 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-700"
                  aria-label={String(year)}
                >
                  {yearOptions.map((optionYear) => (
                    <option key={optionYear} value={optionYear}>
                      {optionYear}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/40 flex flex-wrap gap-2">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">{t('calendarInvoiceDue')}</Badge>
              <Badge className="bg-rose-50 text-rose-600 border-rose-100">{t('unpaid')}</Badge>
              <Badge className="bg-blue-50 text-blue-700 border-blue-100">{t('note')}</Badge>
              <Badge className="bg-amber-50 text-amber-700 border-amber-100">{t('calendarReviewTask')}</Badge>
            </div>

            <div className="p-4 md:p-6">
              <div className="grid grid-cols-7 gap-2 mb-3">
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-[10px] font-black uppercase text-zinc-300 tracking-[0.2em] py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {emptyDays.map((i) => (
                  <div key={`empty-${i}`} className="aspect-square rounded-2xl bg-zinc-50/40" />
                ))}

                {monthDays.map((day) => {
                  const dayInvoices = invoicesByDay[day] || [];
                  const hasUnpaid = dayInvoices.some((invoice) => invoice.status !== 'paid');
                  const dayKey = toDateKey(year, month, day);
                  const dayNotes = calendarNotesByDay[dayKey] || [];
                  const dayMarkers = monthMarkers[dayKey] || [];
                  const isToday =
                    day === new Date().getDate() &&
                    month === new Date().getMonth() &&
                    year === new Date().getFullYear();

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'aspect-square rounded-2xl border p-2 transition-all relative text-left flex flex-col justify-between overflow-hidden',
                        selectedDay === day
                          ? 'bg-emerald-600 border-emerald-600 shadow-lg shadow-emerald-900/15'
                          : 'bg-white border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/40',
                        isToday && selectedDay !== day && 'border-emerald-200 bg-emerald-50/60'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'text-base font-black leading-none',
                            selectedDay === day ? 'text-white' : 'text-zinc-950'
                          )}
                        >
                          {day}
                        </span>

                        <div className="flex items-center gap-1">
                          {dayInvoices.length > 0 && (
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full',
                                hasUnpaid ? 'bg-rose-500' : 'bg-emerald-500',
                                selectedDay === day && 'ring-2 ring-white/20'
                              )}
                            />
                          )}
                          {dayNotes.length > 0 && (
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full bg-blue-500',
                                selectedDay === day && 'ring-2 ring-white/20'
                              )}
                            />
                          )}
                          {dayMarkers.slice(0, 2).map((marker, index) => (
                            <span
                              key={`${dayKey}-${marker.kind}-${index}`}
                              className={cn(
                                'w-2 h-2 rounded-full',
                                markerTheme[marker.kind].dot,
                                selectedDay === day && 'ring-2 ring-white/20'
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        {dayInvoices.length > 0 && (
                          <p
                            className={cn(
                              'text-[10px] font-black uppercase tracking-tight leading-none',
                              selectedDay === day ? 'text-emerald-100' : 'text-zinc-400'
                            )}
                          >
                            {formatCurrency(dayInvoices.reduce((sum, invoice) => sum + invoice.total_amount, 0))}
                          </p>
                        )}

                        {dayMarkers.length > 0 && (
                          <p
                            className={cn(
                              'text-[9px] font-black uppercase tracking-tight leading-none',
                              selectedDay === day ? 'text-white/75' : 'text-zinc-300'
                            )}
                          >
                            {dayMarkers.length} {dayMarkers.length > 1 ? t('markerPlural') : t('markerSingular')}
                          </p>
                        )}

                        {!dayInvoices.length && !dayMarkers.length && dayNotes.length > 0 && (
                          <p
                            className={cn(
                              'truncate text-[9px] font-black uppercase tracking-tight leading-none',
                              selectedDay === day ? 'text-white/75' : 'text-zinc-300'
                            )}
                          >
                            {dayNotes.length === 1 ? dayNotes[0].title || t('calendarNoteSaved') : `${dayNotes.length} ${t('note')}`}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">
                  {t('overview')}
                </p>
                <h4 className="text-2xl font-black uppercase tracking-tighter text-zinc-950">
                  {selectedDay
                    ? formatCalendarDayLabel(selectedDay)
                    : t('selectDate')}
                </h4>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <DollarSign size={18} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/60">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">
                  {t('dueLabel')}
                </p>
                <p className="text-xl font-black tracking-tight">{formatCurrency(totalOwedSelected)}</p>
              </div>
              <div className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/60">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 mb-2">
                  {t('itemsLabel')}
                </p>
                <p className="text-xl font-black tracking-tight">
                  {selectedDayInvoices.length + selectedMarkers.length + selectedNotes.length}
                </p>
              </div>
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/60">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 mb-2">
                  {t('paid')}
                </p>
                <p className="text-xl font-black tracking-tight text-emerald-700">{formatCurrency(paidSelected)}</p>
              </div>
              <div className="p-4 rounded-2xl border border-rose-100 bg-rose-50/60">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-500 mb-2">
                  {t('unpaid')}
                </p>
                <p className="text-xl font-black tracking-tight text-rose-600">{formatCurrency(unpaidSelected)}</p>
              </div>
            </div>
          </Card>

          <Card
            title={t('dayActivity')}
            action={
              <Button
                variant="primary"
                size="xs"
                onClick={() => openNoteEditor()}
                className="h-8 w-8 rounded-xl p-0"
                aria-label={t('addCalendarNote')}
                title={t('addCalendarNote')}
              >
                <Plus size={14} />
              </Button>
            }
          >
            <div className="space-y-3">
              {isNotesLoading && (
                <div className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                    {t('loadingNotes')}
                  </p>
                </div>
              )}

              {selectedNotes.map((note) => (
                <div key={note.id} className="p-4 rounded-2xl border border-blue-100 bg-blue-50/60">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <MessageSquare size={14} className="text-blue-600 shrink-0" />
                      <p className="truncate text-[10px] font-black uppercase tracking-widest text-blue-700">
                        {note.title || t('savedNote')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => openNoteEditor(note)}
                      className="h-7 w-7 rounded-lg p-0 text-blue-700"
                      aria-label={t('editCalendarNote')}
                      title={t('editCalendarNote')}
                    >
                      <Pencil size={13} />
                    </Button>
                  </div>
                  <p className="text-sm font-bold text-zinc-700 leading-relaxed">{note.note}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {note.note_time && (
                      <Badge className="bg-white text-blue-700 border-blue-100">
                        {t('reminderLabel')} {note.note_time}
                      </Badge>
                    )}
                    {note.notified_user_ids.length > 0 && (
                      <Badge className="bg-white text-blue-700 border-blue-100">
                        {note.notified_user_ids.length} {t('membersNotified')}
                      </Badge>
                    )}
                    {note.created_by_user_name && (
                      <Badge className="bg-white text-zinc-500 border-blue-100">
                        {note.created_by_user_name}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {selectedMarkers.map((marker, index) => (
                <div
                  key={`${selectedDateKey}-${marker.kind}-${index}`}
                  className={cn(
                    'p-4 rounded-2xl border space-y-2',
                    markerTheme[marker.kind].soft
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-full', markerTheme[marker.kind].dot)} />
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700">
                        {t(marker.titleKey)}
                      </p>
                    </div>
                    <Badge className={markerTheme[marker.kind].badge}>{t(markerTheme[marker.kind].labelKey)}</Badge>
                  </div>
                  <p className="text-sm font-bold text-zinc-600 leading-relaxed">{t(marker.detailKey)}</p>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock3 size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">{marker.time}</span>
                  </div>
                </div>
              ))}

              {selectedDayInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 rounded-2xl border border-zinc-100 bg-white flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={14} className="text-zinc-300" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-700 truncate">
                        {invoice.customer_name}
                      </p>
                    </div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {invoice.invoice_number}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black tracking-tight text-zinc-950">
                      {formatCurrency(invoice.total_amount)}
                    </p>
                    <Badge variant={invoice.status === 'paid' ? 'success' : 'danger'} className="mt-2">
                      {getInvoiceStatusLabel(invoice.status)}
                    </Badge>
                  </div>
                </div>
              ))}

              {!selectedNotes.length && !selectedMarkers.length && !selectedDayInvoices.length && (
                <div className="p-8 rounded-2xl border-2 border-dashed border-zinc-100 bg-zinc-50/50 text-center">
                  <CircleAlert size={18} className="mx-auto mb-3 text-zinc-300" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                    {t('noActivityPlanned')}
                  </p>
                </div>
              )}
            </div>
          </Card>

          <Card title={t('monthMarkersTitle')}>
            <div className="space-y-3">
              {upcomingAgenda.map(({ key, day, markers }) => (
                <div key={key} className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
                        {formatCalendarDayLabel(day)}
                      </p>
                    </div>
                    <Badge className="bg-white text-zinc-700 border-zinc-200">
                      {markers.length} {markers.length > 1 ? t('itemPlural') : t('itemSingular')}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {markers.map((marker, index) => (
                      <div key={`${key}-marker-${index}`} className="flex items-start gap-3">
                        <span className={cn('w-2 h-2 rounded-full mt-1.5', markerTheme[marker.kind].dot)} />
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-tight text-zinc-700">
                            {t(marker.titleKey)}
                          </p>
                          <p className="text-sm font-bold text-zinc-500 leading-relaxed">{marker.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {showNoteEditor && (
          <div className="modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md"
            >
              <Card noPadding>
                <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/40">
                  <h3 className="text-sm font-black uppercase tracking-tight">
                    {editingNote ? t('editCalendarNote') : t('addCalendarNote')}: {noteDateDraft ? formatDateKeyLabel(noteDateDraft) : t('selectDate')}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowNoteEditor(false)} disabled={isSavingNote}>
                    <X size={18} />
                  </Button>
                </div>

                 <div className="p-5 space-y-4">
                   <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_15rem]">
                     <div className="space-y-1">
                       <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1 block text-center">
                         {t('noteDate')}
                       </label>
                       <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                         <div className="flex items-center gap-2">
                           <div className="flex-1 min-w-0">
                             <div className="flex flex-col py-2">
                               <span className="text-[11px] font-black uppercase tracking-tight text-zinc-900">
                                 {noteDateDraft ? formatNoteDateDayMonth(noteDateDraft) : '--'}
                               </span>
                               <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                                 {noteDateDraft ? formatNoteDateYear(noteDateDraft) : '----'}
                               </span>
                             </div>
                           </div>
                           <button
                             type="button"
                             onClick={() => dateInputRef.current?.click()}
                             className="h-9 w-9 shrink-0 rounded-xl border border-zinc-200 bg-white flex items-center justify-center text-zinc-400 transition-colors hover:border-emerald-300 hover:text-emerald-700"
                           >
                             <CalendarIcon size={18} />
                           </button>
                           <input
                             ref={dateInputRef}
                             type="date"
                             value={noteDateDraft}
                             onChange={(event) => setNoteDateDraft(event.target.value)}
                             className="sr-only"
                             disabled={isSavingNote}
                           />
                         </div>
                       </div>
                     </div>

                     <div className="space-y-1">
                       <div className="mb-1 flex items-center justify-center gap-3">
                         <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                           {t('reminderTime')}
                         </label>
                         <button
                           type="button"
                           onClick={() => setNoteTimeDraft('')}
                           disabled={isSavingNote || !noteTimeDraft}
                           className="text-[8px] font-black uppercase tracking-[0.16em] text-zinc-300 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                         >
                           {t('clear')}
                         </button>
                       </div>
                       <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                         <div className="flex gap-2">
                           <TimeSelect
                             label={t('noteHour')}
                             options={calendarHourOptions}
                             selectedValue={hasNoteTimeDraft ? noteTimeParts.hour : null}
                             disabled={isSavingNote}
                             onSelect={(value) => setNoteTimePart('hour', value)}
                           />
                           <TimeSelect
                             label={t('noteMinute')}
                             options={calendarMinuteOptions}
                             selectedValue={hasNoteTimeDraft ? noteTimeParts.minute : null}
                             disabled={isSavingNote}
                             onSelect={(value) => setNoteTimePart('minute', value)}
                           />
                         </div>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1 block">
                      {t('noteTitle')}
                    </label>
                    <Input
                      autoFocus
                      placeholder={t('noteTitlePlaceholder')}
                      value={noteTitleDraft}
                      onChange={(event) => setNoteTitleDraft(event.target.value)}
                      className="h-11 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal"
                      disabled={isSavingNote}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1 block">
                      {t('mainNote')}
                    </label>
                    <textarea
                      placeholder={t('dailyLogsPlaceholder')}
                      className="w-full p-4 bg-zinc-50 border-2 border-transparent focus:border-black rounded-2xl font-black text-sm h-24 outline-none transition-all resize-none tracking-tight"
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      disabled={isSavingNote}
                    />
                  </div>

                  <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full justify-between"
                      onClick={() => setShowNotifyModal(true)}
                      disabled={isSavingNote}
                    >
                      <span className="flex items-center gap-2">
                        <Bell size={14} />
                        {t('notifyMembers')}
                      </span>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">
                        {notifiedUserIds.length}
                      </Badge>
                    </Button>

                    {notifiedUsersDraft.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {notifiedUsersDraft.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleNotifyUser(user)}
                            className="inline-flex h-8 max-w-full items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 text-[10px] font-black uppercase tracking-tight text-blue-700"
                            disabled={isSavingNote}
                          >
                            <span className="truncate">{user.name}</span>
                            <X size={12} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {noteError && (
                    <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-600">
                      {noteError}
                    </p>
                  )}
                </div>

                <div className="p-5 bg-zinc-50/40 border-t border-zinc-100 flex flex-wrap gap-3">
                  {editingNote && (
                    <Button variant="danger" onClick={deleteNote} disabled={isSavingNote} className="sm:w-auto">
                      <Trash2 size={14} className="mr-2" />
                      {t('remove')}
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => setShowNoteEditor(false)} disabled={isSavingNote}>
                    {t('cancel')}
                  </Button>
                  <Button className="flex-1" onClick={() => void saveNote()} disabled={isSavingNote}>
                    <BadgeCheck size={14} className="mr-2" />
                    {t('saveNote')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}

        {showNotifyModal && (
          <div className="modal-overlay fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm"
            >
              <Card noPadding>
                <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/40">
                  <h3 className="text-sm font-black uppercase tracking-tight">{t('notifyMembers')}</h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowNotifyModal(false)}>
                    <X size={18} />
                  </Button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="relative">
                    <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                    <Input
                      placeholder={t('searchMembers')}
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      className="h-11 pl-10 normal-case tracking-normal placeholder:normal-case placeholder:tracking-normal"
                    />
                  </div>

                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {isUserSearchLoading && (
                      <p className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-widest text-zinc-300">
                        {t('loadingUsers')}
                      </p>
                    )}

                    {!isUserSearchLoading && notifyCandidates.map((user) => {
                      const selected = notifiedUserIds.includes(user.id);

                      return (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => toggleNotifyUser(user)}
                          className={cn(
                            'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                            selected
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                              : 'border-zinc-100 bg-white text-zinc-700 hover:border-emerald-200'
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-black uppercase tracking-tight">
                              {user.name}
                            </span>
                            <span className="block truncate text-[10px] font-bold text-zinc-400">
                              {user.email}
                            </span>
                          </span>
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2',
                              selected ? 'border-emerald-600 bg-emerald-600' : 'border-zinc-200 bg-white'
                            )}
                          >
                            {selected && <span className="h-2 w-2 rounded-sm bg-white" />}
                          </span>
                        </button>
                      );
                    })}

                    {!isUserSearchLoading && notifyCandidates.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-zinc-100 bg-zinc-50/50 p-6 text-center">
                        <Users size={18} className="mx-auto mb-3 text-zinc-300" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
                          {t('noMembersFound')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 bg-zinc-50/40 border-t border-zinc-100">
                  <Button className="w-full" onClick={() => setShowNotifyModal(false)}>
                    {t('done')}
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
