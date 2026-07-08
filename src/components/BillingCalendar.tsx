import React, { useMemo, useState } from 'react';
import { Button, Card, Badge, Input, StatCard, cn } from './ui';
import { useApp } from '../AppContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Plus,
  MessageSquare,
  X,
  FileText,
  Clock3,
  CircleAlert,
  BadgeCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Invoice } from '../types';
import { localeMap } from '../i18n';

interface DateNote {
  note?: string;
  noteKey?: string;
  reminder: string;
}

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

export const BillingCalendar: React.FC = () => {
  const { invoices, t, language } = useApp();
  const locale = localeMap[language];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [reminderDraft, setReminderDraft] = useState('');
  const [dateNotes, setDateNotes] = useState<Record<string, DateNote>>(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    return {
      [toDateKey(year, month, 6)]: {
        noteKey: 'calendarSeedReminderBatch',
        reminder: '09:00',
      },
      [toDateKey(year, month, 18)]: {
        noteKey: 'calendarSeedGraceReview',
        reminder: '14:30',
      },
    };
  });

  const weekDays = useMemo(() => {
    const start = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, index) =>
      new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
      )
    );
  }, [locale]);

  const monthYearStr = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(currentDate);
  const shortMonthStr = new Intl.DateTimeFormat(locale, { month: 'short' }).format(currentDate);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthDays = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

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
  const selectedNote = selectedDateKey ? dateNotes[selectedDateKey] : null;
  const selectedMarkers = selectedDateKey ? monthMarkers[selectedDateKey] || [] : [];
  const resolveNoteText = (entry?: DateNote | null) => {
    if (!entry) return '';
    return entry.noteKey ? t(entry.noteKey) : entry.note || '';
  };
  const selectedNoteText = resolveNoteText(selectedNote);
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
  const markedDayCount = Object.keys(monthMarkers).length;

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

  const openNoteEditor = () => {
    if (!selectedDateKey) return;
    const current = dateNotes[selectedDateKey];
    setNoteDraft(resolveNoteText(current));
    setReminderDraft(current?.reminder || '');
    setShowNoteEditor(true);
  };

  const saveNote = () => {
    if (!selectedDateKey) return;
    const note = noteDraft.trim();
    const reminder = reminderDraft.trim();

    setDateNotes((prev) => {
      if (!note) {
        const next = { ...prev };
        delete next[selectedDateKey];
        return next;
      }

      return {
        ...prev,
        [selectedDateKey]: { note, reminder },
      };
    });

    setShowNoteEditor(false);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
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

              <div className="flex items-center gap-2">
                <Button onClick={prevMonth} variant="outline" size="sm" className="bg-white">
                  <ChevronLeft size={16} />
                </Button>
                <Button onClick={nextMonth} variant="outline" size="sm" className="bg-white">
                  <ChevronRight size={16} />
                </Button>
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
                  const dayNote = dateNotes[dayKey];
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
                          {dayNote && (
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

                        {!dayInvoices.length && !dayMarkers.length && dayNote && (
                          <p
                            className={cn(
                              'text-[9px] font-black uppercase tracking-tight leading-none',
                              selectedDay === day ? 'text-white/75' : 'text-zinc-300'
                            )}
                          >
                            {t('calendarNoteSaved')}
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
                    ? `${selectedDay} ${shortMonthStr}`
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
                  {selectedDayInvoices.length + selectedMarkers.length + (selectedNote ? 1 : 0)}
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
              <Button variant="ghost" size="xs" onClick={openNoteEditor}>
                <Plus size={14} />
              </Button>
            }
          >
            <div className="space-y-3">
              {selectedNote && (
                <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/60">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={14} className="text-blue-600" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">
                      {t('savedNote')}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-zinc-700 leading-relaxed">{selectedNoteText}</p>
                  {selectedNote.reminder && (
                    <Badge className="mt-3 bg-white text-blue-700 border-blue-100">
                      {t('reminderLabel')} {selectedNote.reminder}
                    </Badge>
                  )}
                </div>
              )}

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

              {!selectedNote && !selectedMarkers.length && !selectedDayInvoices.length && (
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
                        {shortMonthStr} {day}
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
        {showNoteEditor && selectedDay && selectedDateKey && (
          <div className="modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-sm"
            >
              <Card noPadding>
                <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/40">
                  <h3 className="text-sm font-black uppercase tracking-tight">
                    {t('dayNoteLabel')}: {selectedDay} {shortMonthStr}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setShowNoteEditor(false)}>
                    <X size={18} />
                  </Button>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1 block">
                      {t('mainNote')}
                    </label>
                    <textarea
                      autoFocus
                      placeholder={t('dailyLogsPlaceholder')}
                      className="w-full p-4 bg-zinc-50 border-2 border-transparent focus:border-black rounded-2xl font-black text-sm h-24 outline-none transition-all resize-none tracking-tight"
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1 block">
                      {t('reminderTime')}
                    </label>
                    <Input
                      placeholder={t('reminderPlaceholder')}
                      value={reminderDraft}
                      onChange={(event) => setReminderDraft(event.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="p-5 bg-zinc-50/40 border-t border-zinc-100 flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowNoteEditor(false)}>
                    {t('cancel')}
                  </Button>
                  <Button className="flex-1" onClick={saveNote}>
                    <BadgeCheck size={14} className="mr-2" />
                    {t('saveNote')}
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
