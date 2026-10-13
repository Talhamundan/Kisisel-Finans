import { toDateSafe } from './helpers.js';

const parseAmount = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const hasAmount = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(parseFloat(value));

const isDateInPeriod = (value, period) => {
    const date = toDateSafe(value);
    if (!date || !period) return false;
    const start = period.month === 'all'
        ? new Date(period.year, 0, 1, 0, 0, 0, 0)
        : new Date(period.year, period.month - 1, 1, 0, 0, 0, 0);
    const end = period.month === 'all'
        ? new Date(period.year, 11, 31, 23, 59, 59, 999)
        : new Date(period.year, period.month, 0, 23, 59, 59, 999);
    return date >= start && date <= end;
};

export const isBesContribution = (transaction) => (
    transaction?.kategori === 'BES' &&
    transaction?.islemTipi === 'gider'
);

export const sumBesContributions = (transactions = [], period = null) => (
    (transactions || [])
        .filter(isBesContribution)
        .filter((transaction) => !period || isDateInPeriod(transaction.tarih, period))
        .reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0)
);

export const sumBesDeductions = (deductions = [], period = null) => (
    (deductions || [])
        .filter((deduction) => !period || isDateInPeriod(deduction.tarih, period))
        .reduce((sum, deduction) => sum + parseAmount(deduction.tutar), 0)
);

export const getBesPaymentAmount = (besData = null) => {
    if (hasAmount(besData?.varsayilanTutar)) {
        const amount = parseAmount(besData.varsayilanTutar);
        return amount > 0 ? amount : null;
    }
    if (hasAmount(besData?.aylikTutar)) {
        const amount = parseAmount(besData.aylikTutar);
        return amount > 0 ? amount : null;
    }
    return null;
};

export const getBesPaymentReminder = ({
    besData,
    transactions = [],
    now = new Date(),
    notificationWindowDays = 3,
} = {}) => {
    if (!besData || besData.durum === 'durduruldu') return null;

    const amount = getBesPaymentAmount(besData);
    if (!amount) return null;

    const today = toDateSafe(now) || new Date();
    const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const paymentDay = parseInt(besData.odemeGunu) || 15;
    const paymentDate = startOfDay(new Date(currentYear, currentMonth, paymentDay));
    const daysLeft = Math.ceil((paymentDate - startOfDay(today)) / (1000 * 60 * 60 * 24));
    const isPaid = (transactions || []).some((transaction) => {
        if (!isBesContribution(transaction)) return false;
        const transactionDate = toDateSafe(transaction.tarih);
        return transactionDate &&
            transactionDate.getMonth() === currentMonth &&
            transactionDate.getFullYear() === currentYear;
    });

    if (isPaid || daysLeft > notificationWindowDays) return null;

    return {
        amount,
        daysLeft,
        paymentDate,
        tone: daysLeft < 0 ? 'red' : 'orange',
    };
};
