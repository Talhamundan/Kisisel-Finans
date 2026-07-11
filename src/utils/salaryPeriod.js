import { toDateSafe } from './helpers';
import { MONTH_NAMES } from './period';

export const getValidSalaryDate = (year, month, salaryDay) => {
    const day = parseInt(salaryDay);
    if (!Number.isFinite(day) || day < 1 || day > 31) return null;
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(day, lastDay), 0, 0, 0, 0);
};

export const isSalaryAccount = (account) => Boolean(
    account?.maasHesabi ||
    account?.isSalaryAccount ||
    account?.salaryAccount
);

export const getSalaryDay = (account) => {
    const day = parseInt(account?.maasGunu || account?.salaryDay || account?.maasGun);
    return Number.isFinite(day) && day >= 1 && day <= 31 ? day : null;
};

export const getSalaryPeriod = (account, selectedPeriod) => {
    const salaryDay = getSalaryDay(account);
    if (!salaryDay) return null;

    const today = new Date();
    const periodYear = selectedPeriod?.year || today.getFullYear();
    const periodMonth = selectedPeriod?.month === 'all'
        ? today.getMonth()
        : (parseInt(selectedPeriod?.month) || today.getMonth() + 1) - 1;
    const start = getValidSalaryDate(periodYear, periodMonth, salaryDay);
    const endBase = new Date(periodYear, periodMonth + 1, 1);
    const end = getValidSalaryDate(endBase.getFullYear(), endBase.getMonth(), salaryDay);

    return start && end
        ? { start, end, periodYear, periodMonth, salaryDay, label: `${MONTH_NAMES[periodMonth]} Maaş Dönemi` }
        : null;
};

export const formatSalaryPeriodRange = (period) => {
    if (!period?.start || !period?.end) return '';
    const inclusiveEnd = new Date(period.end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    const startText = period.start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
    const endText = inclusiveEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${startText} - ${endText}`;
};

const normalizeText = (value) => String(value || '').toLocaleLowerCase('tr-TR');

export const classifySalaryMovement = (transaction, accountId, accounts = []) => {
    const type = transaction?.islemTipi;
    const category = normalizeText(transaction?.kategori);
    const description = normalizeText(transaction?.aciklama);
    const targetAccount = accounts.find((account) => account.id === transaction?.hedefId);
    const targetType = targetAccount?.hesapTipi;

    if (['gelir', 'yatirim_satis', 'cari_iade'].includes(type)) {
        if (category.includes('iade') || description.includes('iade') || description.includes('cashback')) return 'refund';
        return 'income';
    }

    if (type === 'transfer') {
        if (transaction?.kaynakId !== accountId) return 'neutral';
        if (targetType === 'krediKarti' || category.includes('kredi') || description.includes('kredi') || description.includes('kart')) return 'debtPayment';
        if (targetType === 'yatirim' || category.includes('yatırım') || description.includes('yatırım')) return 'investment';
        return 'transfer';
    }

    if (type === 'yatirim_alis' || category.includes('yatırım') || category.includes('bes') || description.includes('midas') || description.includes('altın') || description.includes('döviz')) {
        return 'investment';
    }

    if (
        transaction?.taksitId ||
        category.includes('taksit') ||
        category.includes('kredi') ||
        category.includes('nakit avans') ||
        description.includes('taksit') ||
        description.includes('kredi kartı') ||
        description.includes('kredi karti')
    ) {
        return 'debtPayment';
    }

    if (type === 'gider') return 'realExpense';
    return 'neutral';
};

export const summarizeSalaryPeriod = ({ transactions = [], account, accounts = [] }) => {
    const summary = {
        income: 0,
        realExpense: 0,
        debtPayment: 0,
        expense: 0,
        transfer: 0,
        investment: 0,
        refund: 0,
        neutral: 0,
        remaining: 0,
        totalOutflow: 0,
        movements: [],
    };

    transactions.forEach((transaction) => {
        const amount = parseFloat(transaction?.tutar) || 0;
        const bucket = classifySalaryMovement(transaction, account?.id, accounts);
        const signedAmount = bucket === 'income' || bucket === 'refund' ? amount : -amount;

        summary.movements.push({ transaction, bucket, signedAmount });
        if (bucket === 'income') summary.income += amount;
        if (bucket === 'realExpense') summary.realExpense += amount;
        if (bucket === 'debtPayment') summary.debtPayment += amount;
        if (bucket === 'transfer') summary.transfer += amount;
        if (bucket === 'investment') summary.investment += amount;
        if (bucket === 'refund') summary.refund += amount;
        if (bucket === 'neutral') summary.neutral += amount;
    });

    summary.expense = summary.realExpense + summary.debtPayment;
    summary.totalOutflow = summary.realExpense + summary.debtPayment + summary.transfer + summary.investment;
    summary.remaining = summary.income + summary.refund - summary.totalOutflow;
    return summary;
};

export const isDateInSalaryPeriod = (value, period) => {
    const date = toDateSafe(value);
    return Boolean(date && period?.start && period?.end && date >= period.start && date < period.end);
};
