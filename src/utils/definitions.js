import { formatCurrencyPlain, toDateSafe } from './helpers';
import { getFinancingMetrics } from './financing';

const parseAmount = (value) => parseFloat(value) || 0;
const idOf = (value) => String(value || '').trim();

export const DEFINITION_STATUS = {
    WAITING: 'waiting',
    DUE: 'due',
    PAID: 'paid',
    OVERDUE: 'overdue',
    COMPLETED: 'completed',
};

export const statusLabels = {
    [DEFINITION_STATUS.WAITING]: 'Bekleniyor',
    [DEFINITION_STATUS.DUE]: 'Borç Oluştu',
    [DEFINITION_STATUS.PAID]: 'Ödendi',
    [DEFINITION_STATUS.OVERDUE]: 'Gecikti',
    [DEFINITION_STATUS.COMPLETED]: 'Tamamlandı',
};

export const statusTones = {
    [DEFINITION_STATUS.WAITING]: 'info',
    [DEFINITION_STATUS.DUE]: 'danger',
    [DEFINITION_STATUS.PAID]: 'success',
    [DEFINITION_STATUS.OVERDUE]: 'danger',
    [DEFINITION_STATUS.COMPLETED]: 'success',
};

export const formatDefinitionMoney = (value, hidden = false) => hidden ? '****' : formatCurrencyPlain(value);

export const formatDefinitionDate = (value, options = {}) => {
    const date = toDateSafe(value);
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', {
        day: options.withDay === false ? undefined : '2-digit',
        month: 'long',
        year: options.withYear === false ? undefined : 'numeric',
    });
};

export const monthKeyFromDate = (value) => {
    const date = toDateSafe(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const periodLabel = (periodKey) => {
    const [year, month] = String(periodKey || '').split('-').map(Number);
    if (!year || !month) return 'Dönem yok';
    return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
};

export const getMonthlyDueDate = (definition, year, monthIndex) => {
    const rawDay = definition?.beklenenOdemeGunu || definition?.odemeGunu || definition?.gun || definition?.sonOdemeGunu;
    const day = parseInt(rawDay) || 0;
    if (day < 1 || day > 31) return null;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return new Date(year, monthIndex, Math.min(day, lastDay), 0, 0, 0, 0);
};

export const addMonthsClamped = (value, offset) => {
    const source = toDateSafe(value);
    if (!source) return null;
    const result = new Date(source);
    const originalDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + offset);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    result.setHours(0, 0, 0, 0);
    return result;
};

const startOfToday = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
};

const isExpense = (transaction) => transaction?.islemTipi === 'gider';

const isWithinDays = (dateA, dateB, dayWindow) => {
    if (!dateA || !dateB) return true;
    return Math.abs(dateA.getTime() - dateB.getTime()) <= dayWindow * 24 * 60 * 60 * 1000;
};

const normalizeText = (value) => String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/\(.*?otomatik.*?\)/giu, ' ')
    .replace(/\botomatik\b/giu, ' ')
    .replace(/\bödeme\b/giu, ' ')
    .replace(/\bodeme\b/giu, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const getDefinitionStartDate = (definition) => (
    toDateSafe(definition?.baslangicTarihi) ||
    toDateSafe(definition?.startDate) ||
    toDateSafe(definition?.olusturmaTarihi) ||
    toDateSafe(definition?.createdAt) ||
    toDateSafe(definition?.eklenmeTarihi) ||
    toDateSafe(definition?.tarih)
);

const isSameOrAfterPeriod = (periodKeyValue, startDate) => {
    if (!startDate) return true;
    return periodKeyValue >= monthKeyFromDate(startDate);
};

const uniqueTransactions = (transactions = []) => {
    const seen = new Set();
    return transactions.filter((transaction) => {
        const key = transaction?.id || `${transaction?.tarih?.seconds || transaction?.tarih || ''}-${transaction?.tutar || ''}-${transaction?.aciklama || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const transactionAccountMatches = (transaction, definition) => {
    const expected = idOf(definition?.hesapId || definition?.accountId || definition?.odemeHesapId);
    if (!expected) return true;
    return idOf(transaction?.hesapId || transaction?.accountId || transaction?.kartId) === expected;
};

const textMatchesDefinition = (transaction, definition) => {
    const title = normalizeText(definition?.baslik || definition?.ad || definition?.kurum || definition?.name);
    const institution = normalizeText(definition?.kurum);
    const description = normalizeText([
        transaction?.aciklama,
        transaction?.baslik,
        transaction?.title,
        transaction?.billTitle,
        transaction?.recurringTitle,
        transaction?.installmentPlanTitle,
    ].filter(Boolean).join(' '));
    if (!title || !description) return false;
    return description === title ||
        description.includes(title) ||
        (institution && description.includes(institution));
};

const matchesExpectedDueWindow = (transaction, definition, dayWindow = 10) => {
    const transactionDate = toDateSafe(transaction?.tarih);
    if (!transactionDate) return false;
    const dueDate = getMonthlyDueDate(definition, transactionDate.getFullYear(), transactionDate.getMonth());
    return isWithinDays(transactionDate, dueDate, dayWindow);
};

const isBillLikeTransaction = (transaction) => {
    const haystack = normalizeText([
        transaction?.kategori,
        transaction?.tur,
        transaction?.type,
        transaction?.source,
        transaction?.sourceType,
        transaction?.recurringType,
        transaction?.recurringSource,
    ].filter(Boolean).join(' '));
    return haystack.includes('fatura') || haystack.includes('bill');
};

const isSubscriptionLikeTransaction = (transaction) => {
    const haystack = normalizeText([
        transaction?.kategori,
        transaction?.tur,
        transaction?.type,
        transaction?.source,
        transaction?.sourceType,
        transaction?.recurringType,
        transaction?.recurringSource,
    ].filter(Boolean).join(' '));
    return haystack.includes('abonelik') ||
        haystack.includes('sabit') ||
        haystack.includes('subscription') ||
        haystack.includes('recurring') ||
        haystack.includes('fatura');
};

export const getBillPaymentTransactions = (definition, transactions = []) => {
    const explicitIds = new Set((definition?.billLinks || definition?.linkedPayments || [])
        .map((link) => link?.transactionId || link?.id)
        .filter(Boolean));

    return uniqueTransactions((transactions || [])
        .filter((transaction) => {
            if (explicitIds.has(transaction.id)) return true;
            if (!isExpense(transaction)) return false;
            if (
                idOf(transaction.billDefinitionId) === idOf(definition?.id) ||
                idOf(transaction.faturaTanimId) === idOf(definition?.id) ||
                idOf(transaction.tanimId) === idOf(definition?.id) ||
                idOf(transaction.definitionId) === idOf(definition?.id) ||
                idOf(transaction.recurringDefinitionId) === idOf(definition?.id) ||
                idOf(transaction.autoGeneratedFromId) === idOf(definition?.id) ||
                idOf(transaction.sourceId) === idOf(definition?.id) ||
                idOf(transaction.generatedFrom) === idOf(definition?.id)
            ) return true;

            return isBillLikeTransaction(transaction) &&
                transactionAccountMatches(transaction, definition) &&
                textMatchesDefinition(transaction, definition) &&
                matchesExpectedDueWindow(transaction, definition, 12);
        }))
        .sort((a, b) => (toDateSafe(b.tarih)?.getTime() || 0) - (toDateSafe(a.tarih)?.getTime() || 0));
};

export const getSubscriptionPaymentTransactions = (subscription, transactions = []) => (
    uniqueTransactions((transactions || [])
        .filter((transaction) => {
            if (!isExpense(transaction)) return false;
            return (
                idOf(transaction.subscriptionId) === idOf(subscription?.id) ||
                idOf(transaction.bagliAbonelikId) === idOf(subscription?.id) ||
                idOf(transaction.abonelikId) === idOf(subscription?.id) ||
                idOf(transaction.recurringDefinitionId) === idOf(subscription?.id) ||
                idOf(transaction.autoGeneratedFromId) === idOf(subscription?.id) ||
                idOf(transaction.sourceId) === idOf(subscription?.id) ||
                idOf(transaction.generatedFrom) === idOf(subscription?.id) ||
                (
                    isSubscriptionLikeTransaction(transaction) &&
                    transactionAccountMatches(transaction, subscription) &&
                    Math.abs(Math.abs(parseAmount(transaction.tutar)) - Math.abs(parseAmount(subscription?.tutar))) <= 1 &&
                    textMatchesDefinition(transaction, subscription) &&
                    matchesExpectedDueWindow(transaction, subscription, 5)
                )
            );
        }))
        .sort((a, b) => (toDateSafe(b.tarih)?.getTime() || 0) - (toDateSafe(a.tarih)?.getTime() || 0))
);

export const getSubscriptionHistoryRows = (subscription, { transactions = [], monthCount = 12 } = {}) => {
    const payments = getSubscriptionPaymentTransactions(subscription, transactions);
    const startDate = getDefinitionStartDate(subscription);
    const now = new Date();
    const periodKeys = new Set(payments.map((transaction) => monthKeyFromDate(transaction.tarih)).filter(Boolean));

    for (let offset = 0; offset < monthCount; offset += 1) {
        const periodDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const periodKeyValue = monthKeyFromDate(periodDate);
        if (offset === 0 || (startDate && isSameOrAfterPeriod(periodKeyValue, startDate))) {
            periodKeys.add(periodKeyValue);
        }
    }

    return [...periodKeys].sort().reverse().map((periodKeyValue) => {
        const [year, month] = periodKeyValue.split('-').map(Number);
        const payment = payments.find((transaction) => monthKeyFromDate(transaction.tarih) === periodKeyValue) || null;
        const dueDate = getMonthlyDueDate(subscription, year, month - 1);
        const status = payment
            ? DEFINITION_STATUS.PAID
            : dueDate && dueDate < startOfToday()
                ? DEFINITION_STATUS.OVERDUE
                : DEFINITION_STATUS.WAITING;
        return {
            id: `${subscription?.id}-${periodKeyValue}`,
            periodKey: periodKeyValue,
            periodLabel: periodLabel(periodKeyValue),
            dueDate,
            expectedAmount: parseAmount(subscription?.tutar),
            paidAmount: parseAmount(payment?.tutar),
            paidDate: payment?.tarih || null,
            accountId: payment?.hesapId || subscription?.hesapId || '',
            transaction: payment,
            status,
        };
    });
};

export const getPendingBillForDefinition = (definition, pendingBills = [], year, monthIndex) => {
    const periodKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    return (pendingBills || []).find((bill) => {
        if (bill.tanimId !== definition?.id) return false;
        const date = toDateSafe(bill.sonOdemeTarihi || bill.tarih);
        if (!date) return true;
        return monthKeyFromDate(date) === periodKey;
    }) || null;
};

export const getBillPeriodRows = (definition, { pendingBills = [], transactions = [], monthCount = 6 } = {}) => {
    const now = new Date();
    const payments = getBillPaymentTransactions(definition, transactions);
    const startDate = getDefinitionStartDate(definition);
    const periodKeys = new Set([
        ...payments.map((transaction) => monthKeyFromDate(transaction.tarih)).filter(Boolean),
        ...(pendingBills || [])
            .filter((bill) => bill.tanimId === definition?.id)
            .map((bill) => monthKeyFromDate(bill.sonOdemeTarihi || bill.tarih))
            .filter(Boolean),
    ]);

    for (let offset = 0; offset < monthCount; offset += 1) {
        const periodDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        const periodKey = monthKeyFromDate(periodDate);
        if (offset === 0 || (startDate && isSameOrAfterPeriod(periodKey, startDate))) {
            periodKeys.add(periodKey);
        }
    }

    return [...periodKeys].sort().reverse().map((periodKey) => {
        const [year, month] = periodKey.split('-').map(Number);
        const monthIndex = month - 1;
        const pending = getPendingBillForDefinition(definition, pendingBills, year, monthIndex);
        const paidTransaction = payments.find((transaction) => monthKeyFromDate(transaction.tarih) === periodKey);
        const dueDate = toDateSafe(pending?.sonOdemeTarihi) || getMonthlyDueDate(definition, year, monthIndex);
        const amount = parseAmount(pending?.tutar || paidTransaction?.tutar || definition?.tutar || definition?.ortalamaTutar);
        const isOverdue = !paidTransaction && dueDate && dueDate < startOfToday();
        const status = paidTransaction
            ? DEFINITION_STATUS.PAID
            : pending
                ? (isOverdue ? DEFINITION_STATUS.OVERDUE : DEFINITION_STATUS.DUE)
                : (isOverdue ? DEFINITION_STATUS.OVERDUE : DEFINITION_STATUS.WAITING);

        return {
            id: `${definition?.id}-${periodKey}`,
            periodKey,
            periodLabel: periodLabel(periodKey),
            dueDate,
            expectedAmount: amount,
            paidAmount: parseAmount(paidTransaction?.tutar),
            paidDate: paidTransaction?.tarih || null,
            accountId: paidTransaction?.hesapId || pending?.hesapId || definition?.hesapId || '',
            status,
            pendingBill: pending,
            transaction: paidTransaction || null,
        };
    });
};

export const getBillDefinitionStatus = (definition, context = {}) => {
    const current = getBillPeriodRows(definition, { ...context, monthCount: 1 })[0] || null;
    const payments = getBillPaymentTransactions(definition, context.transactions || []);
    return {
        definition,
        current,
        history: getBillPeriodRows(definition, context),
        lastPayment: payments[0] || null,
    };
};

export const getInstallmentPaymentTransactions = (installment, transactions = []) => (
    uniqueTransactions((transactions || [])
        .filter((transaction) => isExpense(transaction) && (
            idOf(transaction.taksitId) === idOf(installment?.id) ||
            idOf(transaction.installmentId) === idOf(installment?.id) ||
            idOf(transaction.planId) === idOf(installment?.id) ||
            idOf(transaction.sourceId) === idOf(installment?.id) ||
            idOf(transaction.generatedFrom) === idOf(installment?.id)
        )))
        .sort((a, b) => {
            const an = parseInt(a.installmentNumber || a.taksitNo || a.taksitSirasi) || 0;
            const bn = parseInt(b.installmentNumber || b.taksitNo || b.taksitSirasi) || 0;
            if (an !== bn) return an - bn;
            return (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0);
        })
);

const getInstallmentGroupId = (transaction) => idOf(
    transaction?.taksitId ||
    transaction?.installmentId ||
    transaction?.planId ||
    transaction?.sourceId ||
    transaction?.generatedFrom
);

const getReconstructedInstallmentGroupId = (transaction) => {
    const directId = getInstallmentGroupId(transaction);
    if (directId) return directId;
    const title = normalizeText(transaction?.installmentPlanTitle || transaction?.baslik || transaction?.title || transaction?.aciklama);
    const count = parseInt(transaction?.installmentCount || transaction?.taksitSayisi) || 0;
    const account = idOf(transaction?.hesapId || transaction?.accountId);
    if (!title || !count || !account) return '';
    return `reconstructed-${account}-${title}-${count}`;
};

const isInstallmentTransaction = (transaction) => (
    isExpense(transaction) &&
    (getInstallmentGroupId(transaction) || transaction?.installmentPlanTitle || transaction?.installmentCount) &&
    (
        transaction?.installmentNumber ||
        transaction?.taksitNo ||
        transaction?.taksitSirasi ||
        normalizeText(transaction?.kategori).includes('taksit')
    )
);

export const buildInstallmentRows = (installment, transactions = []) => {
    const count = parseInt(installment?.taksitSayisi) || 0;
    const total = parseAmount(installment?.toplamTutar);
    const monthly = parseAmount(installment?.aylikTutar || (count > 0 ? total / count : 0));
    const payments = getInstallmentPaymentTransactions(installment, transactions);
    const paymentByNumber = new Map();

    payments.forEach((transaction, index) => {
        const number = parseInt(transaction.installmentNumber || transaction.taksitNo || transaction.taksitSirasi) || index + 1;
        if (!paymentByNumber.has(number)) paymentByNumber.set(number, transaction);
    });

    return Array.from({ length: count }, (_, index) => {
        const number = index + 1;
        const transaction = paymentByNumber.get(number) || null;
        const dueDate = addMonthsClamped(installment?.alisTarihi || installment?.olusturmaTarihi, index);
        const amount = number === count
            ? Math.max(0, total - (monthly * (count - 1))) || monthly
            : monthly;
        const isOverdue = !transaction && dueDate && dueDate < startOfToday();
        return {
            id: `${installment?.id}-${number}`,
            installmentNumber: number,
            dueDate,
            plannedAmount: amount,
            paidAmount: parseAmount(transaction?.tutar),
            paidDate: transaction?.tarih || null,
            accountId: transaction?.hesapId || installment?.hesapId || '',
            transaction,
            status: transaction ? DEFINITION_STATUS.PAID : (isOverdue ? DEFINITION_STATUS.OVERDUE : DEFINITION_STATUS.WAITING),
        };
    });
};

export const getInstallmentStatus = (installment, transactions = []) => {
    const rows = buildInstallmentRows(installment, transactions);
    const count = rows.length || parseInt(installment?.taksitSayisi) || 0;
    const paidRows = rows.filter((row) => row.status === DEFINITION_STATUS.PAID);
    const fallbackPaid = Math.min(count, Math.max(
        parseInt(installment?.odenmisTaksit) || 0,
        parseInt(installment?.completedInstallments) || 0,
        parseInt(installment?.paidInstallmentCount) || 0
    ));
    const paidCount = Math.max(paidRows.length, fallbackPaid);
    const total = parseAmount(installment?.toplamTutar);
    const monthly = parseAmount(installment?.aylikTutar || (count > 0 ? total / count : 0));
    const paidAmount = rows.reduce((sum, row) => sum + (row.status === DEFINITION_STATUS.PAID ? (row.paidAmount || row.plannedAmount) : 0), 0) || (monthly * paidCount);
    const remainingAmount = Math.max(0, total - paidAmount);
    const nextPayment = rows.find((row) => row.status !== DEFINITION_STATUS.PAID) || null;
    const isCompleted = count > 0 && paidCount >= count;

    return {
        installment,
        rows,
        total,
        monthly,
        count,
        paidCount,
        paidAmount,
        remainingAmount,
        remainingCount: Math.max(0, count - paidCount),
        nextPayment,
        progress: count > 0 ? Math.min(100, Math.round((paidCount / count) * 100)) : 0,
        status: isCompleted ? DEFINITION_STATUS.COMPLETED : nextPayment?.status || DEFINITION_STATUS.WAITING,
    };
};

export const reconstructInstallmentsFromTransactions = (transactions = [], existingInstallments = []) => {
    const existingIds = new Set((existingInstallments || []).map((item) => idOf(item.id)).filter(Boolean));
    const groups = new Map();

    (transactions || []).filter(isInstallmentTransaction).forEach((transaction) => {
        const groupId = getReconstructedInstallmentGroupId(transaction);
        if (!groupId || existingIds.has(groupId)) return;
        if (!groups.has(groupId)) groups.set(groupId, []);
        groups.get(groupId).push(transaction);
    });

    return [...groups.entries()].map(([id, group]) => {
        const sorted = group.sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));
        const count = Math.max(...sorted.map((transaction) => parseInt(transaction.installmentCount || transaction.taksitSayisi) || 0), sorted.length);
        const paidAmount = sorted.reduce((sum, transaction) => sum + parseAmount(transaction.tutar), 0);
        const monthly = count > 0 ? paidAmount / Math.min(count, sorted.length || count) : parseAmount(sorted[0]?.tutar);
        return {
            id,
            reconstructed: true,
            baslik: sorted[0]?.installmentPlanTitle || sorted[0]?.baslik || sorted[0]?.title || String(sorted[0]?.aciklama || '').replace(/\(\d+\s*\/\s*\d+\)/, '').trim() || 'Geçmiş taksit',
            kategori: sorted[0]?.kategori || 'Taksit',
            hesapId: sorted[0]?.hesapId || '',
            toplamTutar: Math.max(paidAmount, monthly * count),
            taksitSayisi: count,
            aylikTutar: monthly,
            odenmisTaksit: sorted.length,
            alisTarihi: sorted[0]?.tarih || null,
            olusturmaTarihi: sorted[0]?.tarih || null,
        };
    });
};

export const getAllInstallmentStatuses = (installments = [], transactions = []) => ([
    ...(installments || []),
    ...reconstructInstallmentsFromTransactions(transactions, installments),
]).map((installment) => getInstallmentStatus(installment, transactions));

export const sumMatchedPayments = (historyRows = []) => {
    const seen = new Set();
    return (historyRows || []).reduce((summary, row) => {
        if (row?.status !== DEFINITION_STATUS.PAID || !row?.transaction) return summary;
        const key = row.transaction.id || row.id;
        if (seen.has(key)) return summary;
        seen.add(key);
        summary.count += 1;
        summary.total += parseAmount(row.paidAmount || row.transaction.tutar);
        return summary;
    }, { total: 0, count: 0 });
};

const accountTypeLabel = (account) => {
    if (account?.hesapTipi === 'yatirim') return 'Yatırım Hesabı';
    if (account?.hesapTipi === 'nakit') return 'Nakit';
    if (account?.hesapTipi === 'krediKarti') return 'Kredi Kartı';
    return 'Vadesiz Hesap';
};

export const summarizeDefinitionsOverview = ({
    accounts = [],
    portfolio = [],
    debts = [],
    financings = [],
    installments = [],
    transactions = [],
    besData = null,
} = {}) => {
    const cash = (accounts || [])
        .filter((account) => account.hesapTipi !== 'krediKarti' && account.hesapTipi !== 'yatirim')
        .reduce((sum, account) => sum + Math.max(0, parseAmount(account.guncelBakiye)), 0);
    const investmentAccounts = (accounts || [])
        .filter((account) => account.hesapTipi === 'yatirim')
        .reduce((sum, account) => sum + Math.max(0, parseAmount(account.guncelBakiye)), 0);
    const portfolioValue = (portfolio || []).reduce((sum, item) => (
        sum + (parseAmount(item.guncelFiyat || item.alisFiyati) * parseAmount(item.adet || item.miktar || 1))
    ), 0);
    const besValue = parseAmount(besData?.guncelDeger || besData?.toplamBirikim || besData?.birikim);
    const creditCards = (accounts || [])
        .filter((account) => account.hesapTipi === 'krediKarti')
        .reduce((sum, account) => sum + Math.max(0, -parseAmount(account.guncelBakiye)), 0);
    const financingContext = { transactions, installments };
    const financingDebt = (financings || []).reduce((sum, financing) => (
        sum + getFinancingMetrics(financing, financingContext).remainingPlannedPayment
    ), 0);
    const financingInstallmentIds = new Set((financings || []).map((item) => item.installmentId).filter(Boolean));
    const installmentDebt = (installments || [])
        .filter((installment) => !financingInstallmentIds.has(installment.id))
        .reduce((sum, installment) => sum + getInstallmentStatus(installment, transactions).remainingAmount, 0);
    const manualDebt = (debts || []).reduce((sum, debt) => sum + parseAmount(debt.kalanTutar ?? debt.tutar), 0);
    const assetItems = [
        ...(accounts || [])
            .filter((account) => account.hesapTipi !== 'krediKarti')
            .map((account) => ({
                id: `account-${account.id}`,
                group: 'Hesaplar',
                label: account.hesapAdi || 'İsimsiz hesap',
                meta: accountTypeLabel(account),
                value: Math.max(0, parseAmount(account.guncelBakiye)),
            })),
        ...(portfolioValue > 0 ? [{
            id: 'portfolio-positions',
            group: 'Yatırımlar',
            label: 'Portföy Varlıkları',
            meta: 'Açık pozisyonlar',
            value: portfolioValue,
        }] : []),
        ...(besValue > 0 ? [{
            id: 'bes-value',
            group: 'Diğer Varlıklar',
            label: 'BES Birikimi',
            meta: 'Emeklilik birikimi',
            value: besValue,
        }] : []),
    ];
    const debtItems = [
        ...(accounts || [])
            .filter((account) => account.hesapTipi === 'krediKarti' && parseAmount(account.guncelBakiye) < 0)
            .map((account) => ({
                id: `credit-card-${account.id}`,
                group: 'Kredi Kartları',
                label: account.hesapAdi || 'Kredi kartı',
                meta: 'Kredi Kartı',
                value: Math.max(0, -parseAmount(account.guncelBakiye)),
            })),
        ...(financings || []).map((financing) => {
            const metrics = getFinancingMetrics(financing, financingContext);
            return {
                id: `financing-${financing.id}`,
                group: 'Finansmanlar',
                label: financing.ad || financing.bankName || 'Finansman',
                meta: financing.bankName || 'Finansman',
                value: metrics.remainingPlannedPayment,
            };
        }).filter((item) => item.value > 0),
        ...(debts || []).map((debt) => ({
            id: `manual-debt-${debt.id}`,
            group: 'Manuel Borçlar',
            label: debt.baslik || debt.ad || debt.aciklama || 'Borç',
            meta: debt.kisi || debt.kurum || 'Manuel borç',
            value: parseAmount(debt.kalanTutar ?? debt.tutar),
        })).filter((item) => item.value > 0),
        ...(installments || [])
            .filter((installment) => !financingInstallmentIds.has(installment.id))
            .map((installment) => ({
                id: `installment-debt-${installment.id}`,
                group: 'Manuel Borçlar',
                label: installment.baslik || 'Taksitli alışveriş',
                meta: 'Taksit yükü',
                value: getInstallmentStatus(installment, transactions).remainingAmount,
            }))
            .filter((item) => item.value > 0),
    ];
    const totalAssets = cash + investmentAccounts + portfolioValue + besValue;
    const totalDebts = creditCards + financingDebt + manualDebt + installmentDebt;

    return {
        assets: { cash, investmentAccounts, portfolioValue, besValue, total: totalAssets, items: assetItems },
        debts: { creditCards, financings: financingDebt, manualDebt, installmentDebt, total: totalDebts, items: debtItems },
        netWorth: totalAssets - totalDebts,
    };
};
