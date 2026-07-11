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

const parseAmount = (value) => parseFloat(value) || 0;

const isNearAmount = (left, right) => {
    const a = Math.abs(parseAmount(left));
    const b = Math.abs(parseAmount(right));
    return Math.abs(a - b) <= Math.max(1, Math.max(a, b) * 0.01);
};

const getTransactionTime = (transaction) => toDateSafe(transaction?.tarih)?.getTime() || 0;

const isDebtLike = (transaction, accounts = []) => {
    const category = normalizeText(transaction?.kategori);
    const description = normalizeText(transaction?.aciklama);
    const targetAccount = accounts.find((account) => account.id === transaction?.hedefId);
    return Boolean(
        transaction?.taksitId ||
        transaction?.borcId ||
        targetAccount?.hesapTipi === 'krediKarti' ||
        category.includes('kredi') ||
        category.includes('taksit') ||
        category.includes('nakit avans') ||
        description.includes('kredi kartı') ||
        description.includes('kredi karti') ||
        description.includes('kredi') ||
        description.includes('taksit') ||
        description.includes('borç ödeme') ||
        description.includes('borc odeme')
    );
};

export const getDebtPaymentSubtype = (transaction, accounts = []) => {
    const category = normalizeText(transaction?.kategori);
    const description = normalizeText(transaction?.aciklama);
    const targetAccount = accounts.find((account) => account.id === transaction?.hedefId);
    if (category.includes('nakit avans') || description.includes('nakit avans')) return 'cashAdvance';
    if (targetAccount?.hesapTipi === 'krediKarti' || category.includes('kredi kart') || description.includes('kredi kart')) return 'creditCard';
    if (transaction?.taksitId || category.includes('taksit') || description.includes('taksit') || category.includes('kredi') || description.includes('kredi')) return 'loan';
    return 'other';
};

const findStrongFlowTarget = ({ transfer, transactions, accounts }) => {
    if (transfer?.islemTipi !== 'transfer' || !transfer?.hedefId) return null;
    const transferDate = toDateSafe(transfer.tarih);
    if (!transferDate) return null;
    const maxDate = new Date(transferDate);
    maxDate.setDate(maxDate.getDate() + 3);
    const candidates = (transactions || [])
        .filter((transaction) => {
            if (!transaction || transaction.id === transfer.id) return false;
            const date = toDateSafe(transaction.tarih);
            if (!date || date < transferDate || date > maxDate) return false;
            if (!isNearAmount(transaction.tutar, transfer.tutar)) return false;
            const startsFromTarget = transaction.hesapId === transfer.hedefId || transaction.kaynakId === transfer.hedefId;
            if (!startsFromTarget) return false;
            const targetBucket = classifySalaryMovement(transaction, transfer.hedefId, accounts);
            return ['debtPayment', 'investment', 'realExpense', 'transfer'].includes(targetBucket);
        })
        .sort((a, b) => getTransactionTime(a) - getTransactionTime(b));

    return candidates.length === 1 ? candidates[0] : null;
};

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

    if (isDebtLike(transaction, accounts)) {
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
        debtPaymentBreakdown: {
            creditCard: 0,
            loan: 0,
            cashAdvance: 0,
            other: 0,
            items: [],
        },
        expense: 0,
        transfer: 0,
        investment: 0,
        refund: 0,
        neutral: 0,
        remaining: 0,
        totalOutflow: 0,
        movements: [],
    };
    const flowChildren = new Set();

    transactions.forEach((transaction) => {
        if (flowChildren.has(transaction?.id)) return;
        const amount = parseAmount(transaction?.tutar);
        let bucket = classifySalaryMovement(transaction, account?.id, accounts);
        let finalTransaction = transaction;
        let flowTarget = null;
        if (bucket === 'transfer' && transaction?.islemTipi === 'transfer' && transaction?.kaynakId === account?.id) {
            flowTarget = findStrongFlowTarget({ transfer: transaction, transactions, accounts });
            if (flowTarget) {
                bucket = classifySalaryMovement(flowTarget, transaction.hedefId, accounts);
                finalTransaction = flowTarget;
                if (flowTarget.id) flowChildren.add(flowTarget.id);
            }
        }
        const signedAmount = bucket === 'income' || bucket === 'refund' ? amount : -amount;

        summary.movements.push({ transaction, bucket, signedAmount, amount, finalTransaction, flowTarget, counted: true });
        if (bucket === 'income') summary.income += amount;
        if (bucket === 'realExpense') summary.realExpense += amount;
        if (bucket === 'debtPayment') {
            const subtype = getDebtPaymentSubtype(finalTransaction, accounts);
            summary.debtPayment += amount;
            summary.debtPaymentBreakdown[subtype] = (summary.debtPaymentBreakdown[subtype] || 0) + amount;
            summary.debtPaymentBreakdown.items.push({ transaction, finalTransaction, amount, subtype });
        }
        if (bucket === 'transfer') summary.transfer += amount;
        if (bucket === 'investment') summary.investment += amount;
        if (bucket === 'refund') summary.refund += amount;
        if (bucket === 'neutral') summary.neutral += amount;
    });

    transactions.forEach((transaction) => {
        if (!flowChildren.has(transaction?.id)) return;
        const bucket = classifySalaryMovement(transaction, transaction.hesapId || transaction.kaynakId, accounts);
        summary.movements.push({ transaction, bucket, signedAmount: 0, amount: 0, finalTransaction: transaction, counted: false, flowChild: true });
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
