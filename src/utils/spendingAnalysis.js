import { isCreditCardPaymentTransaction } from './creditCardPayments';
import { formatCurrencyPlain, toDateSafe } from './helpers';
import { MONTH_NAMES } from './period';

const parseAmount = (value) => parseFloat(value) || 0;
const DAY_MS = 86400000;

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const normalizeText = (value) => String(value || '').trim().toLocaleLowerCase('tr-TR');

export const SPENDING_PRESETS = [
    { value: 'thisMonth', label: 'Bu ay' },
    { value: 'lastMonth', label: 'Geçen ay' },
    { value: 'last3', label: 'Son 3 ay' },
    { value: 'last6', label: 'Son 6 ay' },
    { value: 'last12', label: 'Son 12 ay' },
    { value: 'thisYear', label: 'Bu yıl' },
    { value: 'custom', label: 'Özel aralık' },
];

export const COMPARISON_MODES = [
    { value: 'previousEquivalent', label: 'Önceki eşdeğer dönem' },
    { value: 'lastYearSame', label: 'Geçen yıl aynı dönem' },
    { value: 'custom', label: 'Özel karşılaştırma' },
];

export const formatAnalysisDate = (date) => (
    date ? date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
);

export const formatRangeLabel = (range) => {
    if (!range?.start || !range?.end) return 'Dönem yok';
    return `${formatAnalysisDate(range.start)} - ${formatAnalysisDate(range.end)}`;
};

export const getSpendingRange = (preset, customRange = {}) => {
    const today = startOfDay(new Date());
    if (preset === 'custom') {
        const customStart = toDateSafe(customRange.start);
        const customEnd = toDateSafe(customRange.end);
        return {
            start: customStart ? startOfDay(customStart) : new Date(today.getFullYear(), today.getMonth(), 1),
            end: customEnd ? endOfDay(customEnd) : endOfDay(today),
        };
    }
    if (preset === 'lastMonth') {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return { start, end: endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)) };
    }
    if (preset === 'last3' || preset === 'last6' || preset === 'last12') {
        const monthCount = preset === 'last3' ? 3 : preset === 'last6' ? 6 : 12;
        return {
            start: new Date(today.getFullYear(), today.getMonth() - monthCount + 1, 1),
            end: endOfDay(today),
        };
    }
    if (preset === 'thisYear') {
        return { start: new Date(today.getFullYear(), 0, 1), end: endOfDay(today) };
    }
    return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: endOfDay(today) };
};

export const getComparisonRange = (range, mode, customRange = {}) => {
    if (!range?.start || !range?.end) return null;
    if (mode === 'custom') return getSpendingRange('custom', customRange);
    if (mode === 'lastYearSame') {
        return {
            start: new Date(range.start.getFullYear() - 1, range.start.getMonth(), range.start.getDate()),
            end: endOfDay(new Date(range.end.getFullYear() - 1, range.end.getMonth(), range.end.getDate())),
        };
    }
    const dayCount = Math.max(1, Math.round((startOfDay(range.end) - startOfDay(range.start)) / DAY_MS) + 1);
    const end = endOfDay(addDays(range.start, -1));
    const start = startOfDay(addDays(range.start, -dayCount));
    return { start, end };
};

export const isOngoingRange = (range) => {
    const today = endOfDay(new Date());
    return Boolean(range?.end && range.end >= today);
};

const isInternalTransfer = (transaction) => (
    transaction?.islemTipi === 'transfer' || normalizeText(transaction?.kategori) === 'transfer'
);

const isInvestmentExpense = (transaction) => (
    transaction?.islemTipi === 'yatirim_alis' ||
    ['yatırım', 'yatirim', 'bes'].includes(normalizeText(transaction?.kategori))
);

const isDebtLinked = (transaction) => Boolean(
    transaction?.debtId ||
    transaction?.borcId ||
    transaction?.cariId ||
    transaction?.cariIslemId ||
    transaction?.borcIslemi
);

const isFinancingLinked = (transaction) => Boolean(
    transaction?.financingId ||
    transaction?.financeFinancingId ||
    transaction?.loanId ||
    transaction?.creditLoanId ||
    transaction?.finansmanId
);

export const isSpendingExpenseTransaction = (transaction) => (
    transaction?.islemTipi === 'gider' &&
    !isInternalTransfer(transaction) &&
    !isInvestmentExpense(transaction) &&
    !isDebtLinked(transaction) &&
    !isFinancingLinked(transaction) &&
    transaction?.excludeFromBudgetStats !== true
);

export const isDebtCashOutTransaction = (transaction, accounts = []) => {
    if (isFinancingLinked(transaction) && transaction?.islemTipi === 'gider') return true;
    if (isDebtLinked(transaction) && transaction?.islemTipi === 'gider') return true;
    return (accounts || []).some((account) => (
        account?.hesapTipi === 'krediKarti' && isCreditCardPaymentTransaction(transaction, account.id)
    ));
};

export const getPlanningType = (transaction) => {
    const category = normalizeText(transaction?.kategori);
    const planned = Boolean(
        transaction?.taksitId ||
        transaction?.installmentId ||
        transaction?.subscriptionId ||
        transaction?.abonelikId ||
        transaction?.bagliAbonelikId ||
        transaction?.billId ||
        transaction?.faturaId ||
        transaction?.billDefinitionId ||
        transaction?.faturaTanimId ||
        transaction?.recurringDefinitionId ||
        ['fatura', 'abonelik', 'sabit gider', 'taksit'].includes(category)
    );
    return planned ? 'planned' : 'unplanned';
};

export const isDateInRange = (value, range) => {
    const date = toDateSafe(value);
    return Boolean(date && range?.start && range?.end && date >= range.start && date <= range.end);
};

const groupByCategory = (transactions = []) => {
    const map = new Map();
    transactions.forEach((transaction) => {
        const name = transaction.kategori || 'Kategorisiz';
        const current = map.get(name) || { name, total: 0, count: 0, transactions: [] };
        current.total += parseAmount(transaction.tutar);
        current.count += 1;
        current.transactions.push(transaction);
        map.set(name, current);
    });
    return [...map.values()].sort((a, b) => b.total - a.total);
};

const buildMonthlyTrend = (transactions = [], range) => {
    const buckets = new Map();
    let cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    const last = new Date(range.end.getFullYear(), range.end.getMonth(), 1);
    while (cursor <= last) {
        buckets.set(monthKey(cursor), {
            key: monthKey(cursor),
            label: `${MONTH_NAMES[cursor.getMonth()].slice(0, 3)} ${cursor.getFullYear()}`,
            spending: 0,
            income: 0,
            cashOut: 0,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    transactions.forEach((transaction) => {
        const date = toDateSafe(transaction.tarih);
        const bucket = date ? buckets.get(monthKey(date)) : null;
        if (!bucket) return;
        if (transaction.analysisType === 'spending') bucket.spending += parseAmount(transaction.tutar);
        if (transaction.analysisType === 'income') bucket.income += parseAmount(transaction.tutar);
        if (transaction.analysisType === 'debtCashOut') bucket.cashOut += parseAmount(transaction.tutar);
    });
    return [...buckets.values()];
};

export const buildSpendingSummary = ({ transactions = [], accounts = [], range }) => {
    const scoped = (transactions || [])
        .filter((transaction) => isDateInRange(transaction.tarih, range))
        .map((transaction) => {
            if (isSpendingExpenseTransaction(transaction)) return { ...transaction, analysisType: 'spending' };
            if (isDebtCashOutTransaction(transaction, accounts)) return { ...transaction, analysisType: 'debtCashOut' };
            if (transaction.islemTipi === 'gelir' || transaction.islemTipi === 'cari_iade') return { ...transaction, analysisType: 'income' };
            return { ...transaction, analysisType: 'excluded' };
        });
    const spending = scoped.filter((transaction) => transaction.analysisType === 'spending');
    const debtCashOut = scoped.filter((transaction) => transaction.analysisType === 'debtCashOut');
    const income = scoped.filter((transaction) => transaction.analysisType === 'income');
    const planned = spending.filter((transaction) => getPlanningType(transaction) === 'planned');
    const unplanned = spending.filter((transaction) => getPlanningType(transaction) === 'unplanned');
    const totalSpending = spending.reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0);
    const totalIncome = income.reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0);
    const totalDebtCashOut = debtCashOut.reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0);
    const categoryRows = groupByCategory(spending);

    return {
        range,
        scoped,
        spending,
        debtCashOut,
        income,
        excluded: scoped.filter((transaction) => transaction.analysisType === 'excluded'),
        plannedTotal: planned.reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0),
        unplannedTotal: unplanned.reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0),
        totalSpending,
        totalIncome,
        totalDebtCashOut,
        netCashFlow: totalIncome - totalSpending - totalDebtCashOut,
        categoryRows,
        monthlyTrend: buildMonthlyTrend(scoped, range),
        largestTransactions: [...spending].sort((a, b) => parseAmount(b.tutar) - parseAmount(a.tutar)).slice(0, 8),
        planned,
        unplanned,
    };
};

export const compareSummaries = (current, comparison) => {
    const names = new Set([
        ...(current?.categoryRows || []).map((row) => row.name),
        ...(comparison?.categoryRows || []).map((row) => row.name),
    ]);
    const previousByName = new Map((comparison?.categoryRows || []).map((row) => [row.name, row]));
    const currentByName = new Map((current?.categoryRows || []).map((row) => [row.name, row]));
    return [...names].map((name) => {
        const currentRow = currentByName.get(name) || { name, total: 0, count: 0, transactions: [] };
        const previousRow = previousByName.get(name) || { name, total: 0, count: 0, transactions: [] };
        const diff = currentRow.total - previousRow.total;
        const percent = previousRow.total > 0 ? (diff / previousRow.total) * 100 : null;
        return {
            name,
            current: currentRow.total,
            previous: previousRow.total,
            diff,
            percent,
            count: currentRow.count,
            previousCount: previousRow.count,
            transactions: currentRow.transactions,
            previousTransactions: previousRow.transactions,
            impactShare: current?.totalSpending > 0 ? Math.abs(diff) / current.totalSpending : 0,
        };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
};

const formatPercent = (value) => value === null || !Number.isFinite(value)
    ? null
    : `%${Math.abs(value).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

const insightAmount = (value) => formatCurrencyPlain(Math.abs(value));

export const buildSpendingInsights = ({ current, comparison, comparisonRows }) => {
    const insights = [];
    const minDiff = Math.max(250, (current?.totalSpending || 0) * 0.04);
    comparisonRows
        .filter((row) => Math.abs(row.diff) >= minDiff && row.impactShare >= 0.03)
        .slice(0, 5)
        .forEach((row) => {
            if (row.previous <= 0 && row.current > 0) {
                insights.push({
                    id: `new-${row.name}`,
                    tone: 'warning',
                    title: `${row.name} bu dönemde yeni harcama`,
                    detail: `${row.name} kategorisinde bu dönemde ${formatCurrencyPlain(row.current)} harcama var; karşılaştırma döneminde harcama yoktu.`,
                    rows: row.transactions,
                });
                return;
            }
            const direction = row.diff > 0 ? 'arttı' : 'azaldı';
            const pct = formatPercent(row.percent);
            insights.push({
                id: `change-${row.name}`,
                tone: row.diff > 0 ? 'danger' : 'success',
                title: `${row.name} ${insightAmount(row.diff)} ${direction}`,
                detail: pct
                    ? `${row.name} harcamaları karşılaştırma dönemine göre ${insightAmount(row.diff)} (${pct}) ${direction}.`
                    : `${row.name} harcamaları karşılaştırma dönemine göre ${insightAmount(row.diff)} ${direction}.`,
                rows: row.transactions,
            });
        });

    const trendCandidates = (current?.categoryRows || []).map((category) => {
        const monthly = (current?.monthlyTrend || []).map((month) => (
            category.transactions
                .filter((transaction) => monthKey(toDateSafe(transaction.tarih)) === month.key)
                .reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0)
        ));
        const rising = monthly.length >= 3 && monthly.slice(-3).every((value, index, arr) => index === 0 || value > arr[index - 1]);
        return { category, monthly, rising };
    }).find((item) => item.rising && item.category.total >= minDiff);
    if (trendCandidates) {
        insights.push({
            id: `trend-${trendCandidates.category.name}`,
            tone: 'warning',
            title: `${trendCandidates.category.name} son üç ayda düzenli yükseldi`,
            detail: `${trendCandidates.category.name} kategorisindeki son üç aylık tutarlar arka arkaya artıyor.`,
            rows: trendCandidates.category.transactions,
        });
    }

    const largeUnplanned = (current?.unplanned || [])
        .filter((transaction) => parseAmount(transaction.tutar) >= Math.max(500, (current?.totalSpending || 0) * 0.08))
        .sort((a, b) => parseAmount(b.tutar) - parseAmount(a.tutar))
        .slice(0, 2);
    if (largeUnplanned.length > 0) {
        const total = largeUnplanned.reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0);
        insights.push({
            id: 'large-unplanned',
            tone: 'danger',
            title: `Plansız büyük giderler ${formatCurrencyPlain(total)}`,
            detail: `Bu dönemde toplam etkiyi büyüten ${largeUnplanned.length} plansız yüksek gider var.`,
            rows: largeUnplanned,
        });
    }

    if ((comparison?.spending?.length || 0) < 3 || (current?.spending?.length || 0) < 3) {
        insights.unshift({
            id: 'limited-data',
            tone: 'neutral',
            title: 'Karşılaştırma sınırlı veriyle yapıldı',
            detail: 'Dönemlerden birinde az sayıda hareket olduğu için küçük farklar yorumlanmadı.',
            rows: [],
        });
    }

    return insights.slice(0, 8);
};

export const buildMonthlyReports = ({ transactions = [], accounts = [], range }) => {
    const reports = buildMonthlyTrend((transactions || []).map((transaction) => {
        if (isSpendingExpenseTransaction(transaction)) return { ...transaction, analysisType: 'spending' };
        if (isDebtCashOutTransaction(transaction, accounts)) return { ...transaction, analysisType: 'debtCashOut' };
        if (transaction.islemTipi === 'gelir' || transaction.islemTipi === 'cari_iade') return { ...transaction, analysisType: 'income' };
        return { ...transaction, analysisType: 'excluded' };
    }).filter((transaction) => isDateInRange(transaction.tarih, range)), range);

    return reports.map((month) => {
        const monthStart = new Date(Number(month.key.slice(0, 4)), Number(month.key.slice(5, 7)) - 1, 1);
        const summary = buildSpendingSummary({
            transactions,
            accounts,
            range: { start: monthStart, end: endOfDay(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)) },
        });
        const top = summary.categoryRows.slice(0, 3);
        return {
            ...month,
            summary,
            text: top.length
                ? `${month.label}: en yüksek harcama ${top.map((row) => `${row.name} ${formatCurrencyPlain(row.total)}`).join(', ')}. Borç/kart nakit çıkışı ${formatCurrencyPlain(summary.totalDebtCashOut)}.`
                : `${month.label}: harcama kaydı yok. Borç/kart nakit çıkışı ${formatCurrencyPlain(summary.totalDebtCashOut)}.`,
        };
    }).reverse();
};
