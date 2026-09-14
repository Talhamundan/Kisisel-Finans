import { formatCurrencyPlain, toDateSafe } from './helpers.js';

export const FINANCING_TYPES = [
    { value: 'personal_loan', label: 'İhtiyaç Kredisi' },
    { value: 'cash_advance_installment', label: 'Taksitli Nakit Avans' },
    { value: 'cash_advance_interest_free', label: 'Faizsiz Nakit Avans' },
    { value: 'other', label: 'Diğer' },
];

export const FINANCING_STATUS = {
    ACTIVE: 'ACTIVE',
    CLOSED: 'CLOSED',
};

export const FINANCING_CLOSURE_TYPES = {
    NORMAL: 'NORMAL',
    EARLY: 'EARLY',
};

const parseAmount = (value) => parseFloat(value) || 0;

const amountToCents = (value) => Math.round(parseAmount(value) * 100);
const centsToAmount = (value) => Math.round(value) / 100;

export const getFinancingTypeLabel = (value) => (
    FINANCING_TYPES.find((type) => type.value === value)?.label || value || 'Diğer'
);

export const formatShortDate = (value) => {
    const date = toDateSafe(value);
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
};

export const formatFullDate = (value) => {
    const date = toDateSafe(value);
    if (!date) return 'Tarih yok';
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const toDateInputValue = (value) => {
    const date = toDateSafe(value);
    if (!date) return '';
    return date.toISOString().slice(0, 10);
};

export const addMonthsClamped = (date, monthOffset) => {
    const source = toDateSafe(date);
    if (!source) return null;
    const result = new Date(source);
    const originalDay = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + monthOffset);
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    return result;
};

export const splitAmountIntoInstallments = (totalAmount, installmentCount) => {
    const count = parseInt(installmentCount) || 0;
    const totalCents = amountToCents(totalAmount);
    if (count <= 0 || totalCents <= 0) return [];
    const base = Math.floor(totalCents / count);
    const remainder = totalCents - (base * count);

    return Array.from({ length: count }, (_, index) => (
        centsToAmount(base + (index === count - 1 ? remainder : 0))
    ));
};

export const buildGeneratedPaymentPlan = ({ totalAmount, installmentCount, firstPaymentDate }) => {
    const amounts = splitAmountIntoInstallments(totalAmount, installmentCount);
    return amounts.map((amount, index) => ({
        id: `auto-${index + 1}`,
        installmentNumber: index + 1,
        dueDate: addMonthsClamped(firstPaymentDate, index),
        plannedAmount: amount,
        linkedTransactionId: '',
        manualPaid: false,
        manualPaidDate: null,
        manualPaidAmount: 0,
        note: '',
    }));
};

export const getLinkedInstallment = (financing, installments = []) => (
    (installments || []).find((installment) => installment.id === financing?.installmentId) || null
);

export const buildPaymentPlanFromInstallment = (installment) => {
    if (!installment) return [];
    const count = parseInt(installment.taksitSayisi) || 0;
    const amount = parseAmount(installment.aylikTutar || (parseAmount(installment.toplamTutar) / count));
    return Array.from({ length: count }, (_, index) => ({
        id: `installment-${index + 1}`,
        installmentNumber: index + 1,
        dueDate: addMonthsClamped(installment.alisTarihi || installment.olusturmaTarihi, index),
        plannedAmount: amount,
        linkedTransactionId: '',
        manualPaid: false,
        manualPaidDate: null,
        manualPaidAmount: 0,
        note: '',
    }));
};

export const normalizePaymentPlan = (financing, installments = []) => {
    const plan = Array.isArray(financing?.paymentPlan) ? financing.paymentPlan : [];
    if (plan.length > 0) {
        return plan
            .map((row, index) => ({
                id: row.id || `plan-${index + 1}`,
                installmentNumber: parseInt(row.installmentNumber) || index + 1,
                dueDate: row.dueDate || null,
                plannedAmount: parseAmount(row.plannedAmount),
                linkedTransactionId: row.linkedTransactionId || '',
                manualPaid: row.manualPaid === true,
                manualPaidDate: row.manualPaidDate || null,
                manualPaidAmount: parseAmount(row.manualPaidAmount),
                note: row.note || '',
            }))
            .sort((a, b) => a.installmentNumber - b.installmentNumber);
    }
    return buildPaymentPlanFromInstallment(getLinkedInstallment(financing, installments));
};

export const findPaymentTransactionForRow = (row, financing, transactions = []) => {
    if (row.linkedTransactionId) {
        return (transactions || []).find((transaction) => transaction.id === row.linkedTransactionId) || null;
    }

    if (!financing?.installmentId) return null;
    return (transactions || []).find((transaction) => {
        const samePlan = transaction.taksitId === financing.installmentId ||
            transaction.installmentId === financing.installmentId ||
            transaction.planId === financing.installmentId;
        if (!samePlan) return false;
        const transactionNumber = parseInt(transaction.installmentNumber || transaction.taksitNo || transaction.taksitSirasi);
        return transactionNumber === row.installmentNumber;
    }) || null;
};

export const resolvePaymentPlanRows = (financing, { transactions = [], installments = [] } = {}) => {
    return normalizePaymentPlan(financing, installments).map((row) => {
        const transaction = findPaymentTransactionForRow(row, financing, transactions);
        const isPaid = Boolean(transaction) || row.manualPaid === true;
        const paidDate = transaction?.tarih || row.manualPaidDate || null;
        const paidAmount = transaction ? parseAmount(transaction.tutar) : parseAmount(row.manualPaidAmount);
        const dueDate = toDateSafe(row.dueDate);
        const isOverdue = !isPaid && dueDate && dueDate < new Date();

        return {
            ...row,
            transaction,
            isPaid,
            isOverdue,
            paidDate,
            paidAmount,
            status: isPaid ? 'paid' : isOverdue ? 'overdue' : 'pending',
        };
    });
};

export const getFinancingLinkedTransactions = (financing, transactions = [], paymentRows = []) => {
    const explicitIds = new Set([
        financing?.disbursementTransactionId,
        financing?.commissionTransactionId,
        financing?.closureTransactionId,
        ...(paymentRows || []).map((row) => row.transaction?.id || row.linkedTransactionId).filter(Boolean),
    ].filter(Boolean));

    return (transactions || [])
        .filter((transaction) => (
            transaction.financingId === financing?.id ||
            transaction.financeFinancingId === financing?.id ||
            explicitIds.has(transaction.id)
        ))
        .sort((a, b) => (toDateSafe(a.tarih)?.getTime() || 0) - (toDateSafe(b.tarih)?.getTime() || 0));
};

export const getFinancingMetrics = (financing, { transactions = [], installments = [] } = {}) => {
    const linkedInstallment = getLinkedInstallment(financing, installments);
    const paymentRows = resolvePaymentPlanRows(financing, { transactions, installments });
    const linkedTransactions = getFinancingLinkedTransactions(financing, transactions, paymentRows);
    const installmentCount = paymentRows.length || parseInt(financing?.installmentCount || linkedInstallment?.taksitSayisi) || 0;
    const paidRows = paymentRows.filter((row) => row.isPaid);
    const paidInstallments = paidRows.length;
    const plannedTotalRepayment = paymentRows.reduce((sum, row) => sum + parseAmount(row.plannedAmount), 0) ||
        parseAmount(financing?.plannedTotalRepayment || linkedInstallment?.toplamTutar);
    const principalAmount = parseAmount(financing?.principalAmount);
    const remainingRows = paymentRows.filter((row) => !row.isPaid);
    const remainingPlannedPayment = remainingRows.reduce((sum, row) => sum + parseAmount(row.plannedAmount), 0);
    const plannedFinanceCost = parseAmount(financing?.plannedFinanceCost || (plannedTotalRepayment - principalAmount));
    const paidOutflows = [
        ...paidRows.map((row) => row.paidAmount || row.plannedAmount),
        ...linkedTransactions
            .filter((transaction) => transaction.id === financing?.commissionTransactionId || transaction.id === financing?.closureTransactionId)
            .map((transaction) => parseAmount(transaction.tutar)),
    ].reduce((sum, value) => sum + parseAmount(value), 0);
    const effectiveStatus = installmentCount > 0 && paidInstallments >= installmentCount
        ? FINANCING_STATUS.CLOSED
        : FINANCING_STATUS.ACTIVE;
    const effectiveClosureType = financing?.closureType ||
        (effectiveStatus === FINANCING_STATUS.CLOSED ? FINANCING_CLOSURE_TYPES.NORMAL : '');
    const realizedCost = effectiveStatus === FINANCING_STATUS.CLOSED
        ? Math.max(0, paidOutflows - principalAmount)
        : 0;
    const earlyPayoffSavings = effectiveClosureType === FINANCING_CLOSURE_TYPES.EARLY
        ? Math.max(0, plannedTotalRepayment - paidOutflows)
        : 0;
    const nextPayment = remainingRows[0]
        ? {
            amount: parseAmount(remainingRows[0].plannedAmount),
            date: remainingRows[0].dueDate,
            number: remainingRows[0].installmentNumber,
        }
        : null;

    return {
        linkedInstallment,
        linkedTransactions,
        paymentRows,
        installmentCount,
        paidInstallments,
        remainingInstallments: Math.max(0, installmentCount - paidInstallments),
        principalAmount,
        plannedTotalRepayment,
        plannedFinanceCost,
        remainingPlannedPayment,
        realizedCost,
        earlyPayoffSavings,
        nextPayment,
        effectiveStatus,
        effectiveClosureType,
        progress: installmentCount > 0 ? Math.min(100, Math.round((paidInstallments / installmentCount) * 100)) : 0,
    };
};

export const summarizeFinancings = (financings = [], context = {}) => {
    return (financings || []).reduce((summary, financing) => {
        const metrics = getFinancingMetrics(financing, context);
        summary.totalPrincipal += metrics.principalAmount;
        summary.realizedCost += metrics.realizedCost;
        summary.earlySavings += metrics.earlyPayoffSavings;
        if (metrics.effectiveStatus !== FINANCING_STATUS.CLOSED) {
            summary.activeCount += 1;
            summary.activeDebt += metrics.remainingPlannedPayment;
            summary.monthlyDue += metrics.nextPayment?.amount || 0;
        }
        return summary;
    }, { totalPrincipal: 0, activeDebt: 0, monthlyDue: 0, realizedCost: 0, earlySavings: 0, activeCount: 0 });
};

export const formatFinancingMoney = (value, hidden = false) => hidden ? '****' : formatCurrencyPlain(value);
