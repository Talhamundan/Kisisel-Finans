import { toDateSafe } from './helpers';

export const MONTH_NAMES = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export const getDefaultPeriod = () => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
};

export const normalizePeriod = (year, month) => {
    const fallback = getDefaultPeriod();
    const y = Number(year);
    const isAll = month === 'all' || month === 'Tümü' || month === null || month === undefined || month === '';
    const m = Number(month);
    return {
        year: Number.isInteger(y) && y >= 1900 && y <= 9999 ? y : fallback.year,
        month: isAll ? 'all' : (Number.isInteger(m) && m >= 1 && m <= 12 ? m : fallback.month),
    };
};

export const periodLabel = ({ year, month }) => month === 'all' ? String(year) : `${MONTH_NAMES[month - 1]} ${year}`;

export const parsePeriodLabel = (label) => {
    if (!label || label === 'Tümü') return null;
    const [monthName, yearText] = String(label).split(' ');
    const monthIndex = MONTH_NAMES.indexOf(monthName);
    const year = Number(yearText);
    if (monthIndex === -1 || !Number.isInteger(year)) return null;
    return { year, month: monthIndex + 1 };
};

export const getPeriodRange = ({ year, month }) => {
    if (month === 'all') {
        return {
            start: new Date(year, 0, 1, 0, 0, 0, 0),
            end: new Date(year, 11, 31, 23, 59, 59, 999),
        };
    }
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
};

export const isDateInPeriod = (value, period) => {
    const date = toDateSafe(value);
    if (!date) return false;
    const { start, end } = getPeriodRange(period);
    return date >= start && date <= end;
};

export const readInitialPeriod = () => {
    if (typeof window === 'undefined') return getDefaultPeriod();
    const params = new URLSearchParams(window.location.search);
    if (params.get('year') || params.get('month')) {
        return normalizePeriod(params.get('year'), params.has('month') ? params.get('month') : 'all');
    }

    try {
        const stored = JSON.parse(localStorage.getItem('tm_finance_period') || 'null');
        if (stored) return normalizePeriod(stored.year, stored.month);
    } catch {
        // Ignore invalid storage.
    }

    return getDefaultPeriod();
};

export const buildAvailablePeriods = (dates = []) => {
    const periodMap = new Map();

    dates.forEach((value) => {
        const date = toDateSafe(value);
        if (!date) return;
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        if (!periodMap.has(year)) periodMap.set(year, new Set());
        periodMap.get(year).add(month);
    });

    const years = Array.from(periodMap.keys()).sort((a, b) => b - a);
    const monthsByYear = {};
    years.forEach((year) => {
        monthsByYear[year] = Array.from(periodMap.get(year)).sort((a, b) => b - a);
    });

    return { years, monthsByYear };
};

export const getLatestAvailablePeriod = ({ years, monthsByYear }) => {
    if (!years.length) return getDefaultPeriod();
    const year = years[0];
    const month = monthsByYear[year]?.[0] || 1;
    return { year, month };
};

export const isPeriodAvailable = (period, availablePeriods) => {
    if (!availablePeriods?.years?.includes(period.year)) return false;
    if (period.month === 'all') return true;
    return availablePeriods.monthsByYear?.[period.year]?.includes(Number(period.month));
};
