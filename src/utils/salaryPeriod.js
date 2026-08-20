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

const isStrictNearAmount = (left, right) => Math.abs(Math.abs(parseAmount(left)) - Math.abs(parseAmount(right))) <= 0.02;

const isCompatibleFlowAmount = (candidateAmount, transferAmount) => {
    const candidate = Math.abs(parseAmount(candidateAmount));
    const transfer = Math.abs(parseAmount(transferAmount));
    if (candidate <= 0 || transfer <= 0) return false;
    if (isStrictNearAmount(candidate, transfer)) return true;

    const difference = Math.abs(candidate - transfer);
    const tolerance = Math.max(250, transfer * 0.03);
    return difference <= tolerance;
};

const getTransactionTime = (transaction) => toDateSafe(transaction?.tarih)?.getTime() || 0;

const findLinkedInstallmentPlan = (transaction, installmentPlans = []) => {
    const ids = [
        transaction?.taksitId,
        transaction?.installmentId,
        transaction?.planId,
        transaction?.sourceId,
    ].filter(Boolean).map(String);
    if (ids.length > 0) {
        const byId = installmentPlans.find((plan) => ids.includes(String(plan?.id)));
        if (byId) return byId;
    }

    const text = normalizeText(`${transaction?.aciklama || ''} ${transaction?.kategori || ''}`);
    const amount = Math.abs(parseAmount(transaction?.tutar));
    return installmentPlans.find((plan) => {
        const title = normalizeText(plan?.baslik || plan?.title || plan?.ad || plan?.name);
        if (!title || !text.includes(title)) return false;
        const monthlyAmount = Math.abs(parseAmount(plan?.aylikTutar || plan?.monthlyAmount));
        return !monthlyAmount || Math.abs(monthlyAmount - amount) <= 0.02;
    }) || null;
};

const isLoanPlan = (plan) => {
    const text = normalizeText(`${plan?.baslik || ''} ${plan?.title || ''} ${plan?.kategori || ''} ${plan?.type || ''} ${plan?.tur || ''}`);
    return Boolean(
        plan?.loanId ||
        plan?.krediId ||
        plan?.loan === true ||
        plan?.isLoan === true ||
        text.includes('kredi') ||
        text.includes('ihtiyaç') ||
        text.includes('ihtiyac') ||
        text.includes('nakit avans')
    );
};

const isDebtLike = (transaction, accounts = [], installmentPlans = []) => {
    const category = normalizeText(transaction?.kategori);
    const description = normalizeText(transaction?.aciklama);
    const targetAccount = accounts.find((account) => account.id === transaction?.hedefId);
    const linkedPlan = findLinkedInstallmentPlan(transaction, installmentPlans);
    return Boolean(
        linkedPlan ||
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

export const classifyDebtPayment = (transaction, accounts = [], installmentPlans = []) => {
    const category = normalizeText(transaction?.kategori);
    const description = normalizeText(transaction?.aciklama);
    const targetAccount = accounts.find((account) => account.id === transaction?.hedefId);
    const linkedPlan = findLinkedInstallmentPlan(transaction, installmentPlans);
    if (linkedPlan) {
        return {
            type: isLoanPlan(linkedPlan) ? 'LOAN_PAYMENT' : 'INSTALLMENT_PURCHASE',
            subtype: isLoanPlan(linkedPlan) ? 'loan' : 'installmentPurchase',
            amount: Math.abs(parseAmount(transaction?.tutar)),
            title: transaction?.aciklama || linkedPlan.baslik || linkedPlan.title || 'Taksit',
            linkedPlanId: linkedPlan.id,
            linkedTransactionIds: [transaction?.id].filter(Boolean),
        };
    }
    if (targetAccount?.hesapTipi === 'krediKarti' || category.includes('kredi kart') || description.includes('kredi kart')) {
        return {
            type: 'CREDIT_CARD_PAYMENT',
            subtype: 'creditCard',
            amount: Math.abs(parseAmount(transaction?.tutar)),
            title: transaction?.aciklama || 'Kredi kartı ödemesi',
            linkedPlanId: null,
            linkedTransactionIds: [transaction?.id].filter(Boolean),
        };
    }
    if (category.includes('taksit') || description.includes('taksit')) {
        return {
            type: 'INSTALLMENT_PURCHASE',
            subtype: 'installmentPurchase',
            amount: Math.abs(parseAmount(transaction?.tutar)),
            title: transaction?.aciklama || 'Taksitli alışveriş',
            linkedPlanId: null,
            linkedTransactionIds: [transaction?.id].filter(Boolean),
        };
    }
    if (category.includes('kredi') || description.includes('kredi') || category.includes('nakit avans') || description.includes('nakit avans')) {
        return {
            type: 'LOAN_PAYMENT',
            subtype: 'loan',
            amount: Math.abs(parseAmount(transaction?.tutar)),
            title: transaction?.aciklama || 'Kredi taksiti',
            linkedPlanId: null,
            linkedTransactionIds: [transaction?.id].filter(Boolean),
        };
    }
    return {
        type: 'OTHER_DEBT_PAYMENT',
        subtype: 'other',
        amount: Math.abs(parseAmount(transaction?.tutar)),
        title: transaction?.aciklama || 'Borç ödemesi',
        linkedPlanId: null,
        linkedTransactionIds: [transaction?.id].filter(Boolean),
    };
};

export const getDebtPaymentSubtype = (transaction, accounts = [], installmentPlans = []) => {
    const result = classifyDebtPayment(transaction, accounts, installmentPlans);
    if (typeof result === 'string') return result;
    return result.subtype || 'other';
};

const getResolvedPurpose = (bucket, transaction, accounts = [], installmentPlans = []) => {
    if (bucket === 'investment') return 'INVESTMENT';
    if (bucket !== 'debtPayment') return 'ACCOUNT_TRANSFER';

    const subtype = getDebtPaymentSubtype(transaction, accounts, installmentPlans);
    if (subtype === 'creditCard') return 'CREDIT_CARD_PAYMENT';
    if (subtype === 'installmentPurchase') return 'INSTALLMENT_PURCHASE';
    return 'LOAN_PAYMENT';
};

const getFlowConfidence = (transferDate, candidateDate) => {
    const diffMs = candidateDate.getTime() - transferDate.getTime();
    if (diffMs < 0) return null;
    if (diffMs <= 30 * 60 * 1000) return 'HIGH';
    if (transferDate.toDateString() === candidateDate.toDateString()) return 'MEDIUM';
    if (diffMs <= 5 * 24 * 60 * 60 * 1000) return 'LOW';
    return null;
};

export const resolveTransactionFlow = ({ transfer, transactions = [], accounts = [], sourceAccountId, installmentPlans = [] }) => {
    if (transfer?.islemTipi !== 'transfer' || !transfer?.hedefId) return null;
    if (sourceAccountId && transfer?.kaynakId !== sourceAccountId) return null;
    const transferDate = toDateSafe(transfer.tarih);
    if (!transferDate) return null;

    const candidates = transactions
        .map((transaction) => {
            if (!transaction || transaction.id === transfer.id) return false;
            const date = toDateSafe(transaction.tarih);
            if (!date) return false;
            const confidence = getFlowConfidence(transferDate, date);
            if (!confidence) return false;
            if (!isCompatibleFlowAmount(transaction.tutar, transfer.tutar)) return false;
            const startsFromTarget = transaction.hesapId === transfer.hedefId || transaction.kaynakId === transfer.hedefId;
            if (!startsFromTarget) return false;
            const targetBucket = classifySalaryMovement(transaction, transfer.hedefId, accounts, installmentPlans);
            if (!['debtPayment', 'investment'].includes(targetBucket)) return false;
            const debtClass = targetBucket === 'debtPayment' ? classifyDebtPayment(transaction, accounts, installmentPlans) : null;
            const planBackedLoan = debtClass?.subtype === 'loan' && debtClass?.linkedPlanId;
            const effectiveConfidence = confidence === 'LOW' && planBackedLoan ? 'MEDIUM' : confidence;
            const resolvedPurpose = getResolvedPurpose(targetBucket, transaction, accounts, installmentPlans);
            const score = effectiveConfidence === 'HIGH' ? 0 : effectiveConfidence === 'MEDIUM' ? 1 : 2;
            return { transaction, confidence: effectiveConfidence, bucket: targetBucket, resolvedPurpose, score, diff: date.getTime() - transferDate.getTime() };
        })
        .filter(Boolean)
        .sort((a, b) => getTransactionTime(a) - getTransactionTime(b));

    if (candidates.length === 0) return null;

    const best = candidates.sort((a, b) => a.score - b.score || a.diff - b.diff)[0];
    const competingSameConfidence = candidates.filter((candidate) => (
        candidate.transaction.id !== best.transaction.id &&
        candidate.score === best.score &&
        Math.abs(candidate.diff - best.diff) <= 30 * 60 * 1000
    ));
    if (competingSameConfidence.length > 0) return null;

    return {
        sourceAccountId: transfer.kaynakId,
        bridgeAccountId: transfer.hedefId,
        transferOutTransactionId: transfer.id,
        transferInTransactionId: transfer.linkedTransactionId || transfer.transferInTransactionId || null,
        finalPaymentTransactionId: best.transaction.id,
        finalPaymentTransaction: best.transaction,
        resolvedPurpose: best.resolvedPurpose,
        bucket: best.bucket,
        confidence: best.confidence,
        amount: Math.abs(parseAmount(transfer.tutar)),
        startedAt: transferDate,
        completedAt: toDateSafe(best.transaction.tarih),
        resolutionSource: best.confidence === 'LOW' ? 'auto_low_confidence' : 'auto',
    };
};

export const classifySalaryMovement = (transaction, accountId, accounts = [], installmentPlans = []) => {
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

    if (isDebtLike(transaction, accounts, installmentPlans)) {
        return 'debtPayment';
    }

    if (type === 'gider') return 'realExpense';
    return 'neutral';
};

export const summarizeSalaryPeriod = ({ transactions = [], account, accounts = [], installmentPlans = [] }) => {
    const summary = {
        income: 0,
        realExpense: 0,
        debtPayment: 0,
        debtPaymentBreakdown: {
            creditCard: 0,
            loan: 0,
            installmentPurchase: 0,
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
        let bucket = classifySalaryMovement(transaction, account?.id, accounts, installmentPlans);
        let finalTransaction = transaction;
        let flowTarget = null;
        let resolvedFlow = null;
        if (bucket === 'transfer' && transaction?.islemTipi === 'transfer' && transaction?.kaynakId === account?.id) {
            resolvedFlow = resolveTransactionFlow({ transfer: transaction, transactions, accounts, sourceAccountId: account?.id, installmentPlans });
            if (resolvedFlow?.finalPaymentTransaction) {
                flowTarget = resolvedFlow.finalPaymentTransaction;
                bucket = classifySalaryMovement(flowTarget, transaction.hedefId, accounts, installmentPlans);
                finalTransaction = flowTarget;
                if (flowTarget.id) flowChildren.add(flowTarget.id);
            }
        }
        const signedAmount = bucket === 'income' || bucket === 'refund' ? amount : -amount;

        summary.movements.push({ transaction, bucket, signedAmount, amount, finalTransaction, flowTarget, resolvedFlow, counted: true });
        if (bucket === 'income') summary.income += amount;
        if (bucket === 'realExpense') summary.realExpense += amount;
        if (bucket === 'debtPayment') {
            const debtClass = classifyDebtPayment(finalTransaction, accounts, installmentPlans);
            const subtype = debtClass.subtype || 'other';
            summary.debtPayment += amount;
            summary.debtPaymentBreakdown[subtype] = (summary.debtPaymentBreakdown[subtype] || 0) + amount;
            summary.debtPaymentBreakdown.items.push({ transaction, finalTransaction, amount, subtype, resolvedFlow, debtClass });
        }
        if (bucket === 'transfer') summary.transfer += amount;
        if (bucket === 'investment') summary.investment += amount;
        if (bucket === 'refund') summary.refund += amount;
        if (bucket === 'neutral') summary.neutral += amount;
    });

    transactions.forEach((transaction) => {
        if (!flowChildren.has(transaction?.id)) return;
        const bucket = classifySalaryMovement(transaction, transaction.hesapId || transaction.kaynakId, accounts, installmentPlans);
        summary.movements.push({ transaction, bucket, signedAmount: 0, amount: 0, finalTransaction: transaction, counted: false, flowChild: true });
    });

    summary.expense = summary.realExpense + summary.debtPayment;
    summary.totalOutflow = summary.realExpense + summary.debtPayment + summary.transfer + summary.investment;
    summary.remaining = summary.income + summary.refund - summary.totalOutflow;
    return summary;
};

export const summarizeDebtPayments = (summary) => {
    const breakdown = summary?.debtPaymentBreakdown || {};
    return {
        creditCard: breakdown.creditCard || 0,
        loan: breakdown.loan || 0,
        installmentPurchase: breakdown.installmentPurchase || 0,
        total: (breakdown.creditCard || 0) + (breakdown.loan || 0) + (breakdown.installmentPurchase || 0),
        items: breakdown.items || [],
    };
};

export const isDateInSalaryPeriod = (value, period) => {
    const date = toDateSafe(value);
    return Boolean(date && period?.start && period?.end && date >= period.start && date < period.end);
};
