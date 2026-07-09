const WEEKDAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTH_LABELS = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/** @param {number} year @param {number} month 0-indexed */
export const toDateKey = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
};

/** @param {string} dateKey */
export const parseDateKey = (dateKey) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return { year: y, month: m - 1, day: d };
};

/** @param {Date} date */
export const dateToKey = (date) => toDateKey(date.getFullYear(), date.getMonth(), date.getDate());

export const todayKey = () => dateToKey(new Date());

/** @param {number} year @param {number} month 0-indexed */
export const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/** Monday-first offset for first day of month */
/** @param {number} year @param {number} month 0-indexed */
export const getMonthStartOffset = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
};

/**
 * @param {number} year
 * @param {number} month 0-indexed
 * @returns {{ year: number, month: number, day: number, dateKey: string, isCurrentMonth: boolean, isToday: boolean }[]}
 */
export const buildMonthGrid = (year, month) => {
    const daysInMonth = getDaysInMonth(year, month);
    const offset = getMonthStartOffset(year, month);
    const targetCellCount = 35;
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrev = getDaysInMonth(prevYear, prevMonth);
    const cells = [];
    const today = todayKey();

    for (let i = offset - 1; i >= 0; i--) {
        const day = daysInPrev - i;
        const dateKey = toDateKey(prevYear, prevMonth, day);
        cells.push({ year: prevYear, month: prevMonth, day, dateKey, isCurrentMonth: false, isToday: dateKey === today });
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = toDateKey(year, month, day);
        cells.push({ year, month, day, dateKey, isCurrentMonth: true, isToday: dateKey === today });
    }

    if (cells.length >= targetCellCount) {
        return cells.slice(0, targetCellCount);
    }

    const remaining = targetCellCount - cells.length;
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    for (let day = 1; day <= remaining; day++) {
        const dateKey = toDateKey(nextYear, nextMonth, day);
        cells.push({ year: nextYear, month: nextMonth, day, dateKey, isCurrentMonth: false, isToday: dateKey === today });
    }

    return cells;
};

/** @param {number} anchorDay @param {number} year @param {number} month 0-indexed */
const clampDayInMonth = (anchorDay, year, month) => {
    const max = getDaysInMonth(year, month);
    return Math.min(anchorDay, max);
};

/**
 * Expand a single event into occurrences visible in the given month.
 * @param {import('./types').FinancialCalendarEvent} event
 * @param {number} year
 * @param {number} month 0-indexed
 * @returns {import('./types').CalendarOccurrence[]}
 */
export const expandEventForMonth = (event, year, month) => {
    if (!event?.date) return [];

    const anchor = parseDateKey(event.date);
    const recurrence = event.isRecurring ? (event.recurrenceType || 'monthly') : 'once';
    const occurrences = [];

    const pushOccurrence = (dateKey) => {
        occurrences.push({
            ...event,
            occurrenceDate: dateKey,
            isVirtual: recurrence !== 'once',
        });
    };

    if (recurrence === 'once') {
        const occ = parseDateKey(event.date);
        if (occ.year === year && occ.month === month) {
            pushOccurrence(event.date);
        }
        return occurrences;
    }

    if (recurrence === 'weekly') {
        const anchorDate = new Date(anchor.year, anchor.month, anchor.day);
        const anchorWeekday = anchorDate.getDay();
        const daysInMonth = getDaysInMonth(year, month);
        for (let day = 1; day <= daysInMonth; day++) {
            const d = new Date(year, month, day);
            if (d.getDay() === anchorWeekday && dateToKey(d) >= event.date) {
                pushOccurrence(toDateKey(year, month, day));
            }
        }
        return occurrences;
    }

    if (recurrence === 'monthly') {
        const day = clampDayInMonth(anchor.day, year, month);
        const dateKey = toDateKey(year, month, day);
        const anchorKey = event.date;
        if (dateKey >= anchorKey) pushOccurrence(dateKey);
        return occurrences;
    }

    if (recurrence === 'yearly') {
        if (anchor.month === month) {
            const day = clampDayInMonth(anchor.day, year, month);
            const dateKey = toDateKey(year, month, day);
            if (dateKey >= event.date) pushOccurrence(dateKey);
        }
        return occurrences;
    }

    return occurrences;
};

/**
 * @param {import('./types').FinancialCalendarEvent[]} events
 * @param {number} year
 * @param {number} month 0-indexed
 * @returns {Record<string, import('./types').CalendarOccurrence[]>}
 */
export const groupEventsByDate = (events, year, month) => {
    /** @type {Record<string, import('./types').CalendarOccurrence[]>} */
    const grouped = {};

    events.forEach((event) => {
        expandEventForMonth(event, year, month).forEach((occ) => {
            if (!grouped[occ.occurrenceDate]) grouped[occ.occurrenceDate] = [];
            grouped[occ.occurrenceDate].push(occ);
        });
    });

    Object.keys(grouped).forEach((key) => {
        grouped[key].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'tr-TR'));
    });

    return grouped;
};

/** @param {string} dateKey */
export const formatDayHeading = (dateKey) => {
    const { year, month, day } = parseDateKey(dateKey);
    return `${day} ${MONTH_LABELS[month]} ${year}`;
};

/** @param {number} month @param {number} year */
export const formatMonthYear = (month, year) => `${MONTH_LABELS[month]} ${year}`;

export { WEEKDAY_LABELS, MONTH_LABELS };

/**
 * @param {number} [amount]
 * @param {string} [currency]
 */
export const formatEventAmount = (amount, currency = 'TRY') => {
    if (amount === undefined || amount === null || amount === '') return '';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!Number.isFinite(num)) return '';
    try {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: currency || 'TRY',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(num);
    } catch {
        return `${num.toLocaleString('tr-TR')} ${currency || 'TRY'}`;
    }
};

/**
 * Build a new event payload — other modules will use this in V2.
 * @param {Partial<import('./types').FinancialCalendarEvent>} data
 * @returns {Omit<import('./types').FinancialCalendarEvent, 'id'>}
 */
export const buildCalendarEventPayload = (data) => ({
    title: data.title || '',
    description: data.description || '',
    amount: data.amount != null && data.amount !== '' ? parseFloat(String(data.amount)) : null,
    currency: data.currency || 'TRY',
    date: data.date || todayKey(),
    type: data.type || 'reminder',
    status: data.status || 'upcoming',
    isRecurring: Boolean(data.isRecurring),
    recurrenceType: data.isRecurring ? (data.recurrenceType || 'monthly') : 'once',
    source: data.source || 'manual',
    sourceId: data.sourceId || null,
});
