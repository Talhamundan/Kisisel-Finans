import { dateToKey } from './calendarUtils.js';
import { getCreditCardPaymentPlan } from '../../utils/creditCardPayments.js';
import { buildSubscriptionOccurrences } from '../../utils/recurringPayments.js';

const toDateValue = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object' && typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

const getDayOfMonth = (value) => {
    const date = toDateValue(value);
    if (!date) return null;
    return date.getDate();
};

const isInactive = (item) => (
    item?.deletedAt ||
    item?.silindi ||
    item?.isDeleted ||
    item?.aktif === false ||
    item?.pasif === true
);

const sameMonth = (date, year, month) => (
    date && date.getFullYear() === year && date.getMonth() === month
);

const clampDay = (day, year, month) => {
    const maxDay = new Date(year, month + 1, 0).getDate();
    return Math.min(Math.max(Number(day) || 1, 1), maxDay);
};

const monthlyDateFor = (item, year, month) => {
    const startDate = toDateValue(item?.baslangicTarihi || item?.ilkOdemeTarihi || item?.sonOdemeTarihi || item?.tarih || item?.vadeTarihi || item?.olusturmaTarihi);
    const endDate = toDateValue(item?.bitisTarihi || item?.bitis || item?.sonTarih);
    const targetStart = new Date(year, month, 1);
    const targetEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);

    if (startDate && targetEnd < new Date(startDate.getFullYear(), startDate.getMonth(), 1)) return null;
    if (endDate && targetStart > endDate) return null;

    const day = Number(item?.gun || item?.vadeGunu || item?.sonOdemeGunu || item?.odemeGunu) || getDayOfMonth(startDate);
    if (!Number.isFinite(day) || day <= 0) return null;
    return new Date(year, month, clampDay(day, year, month));
};

const formatAmount = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const firstText = (...values) => {
    const found = values.find((value) => typeof value === 'string' && value.trim());
    return found ? found.trim() : '';
};

const creditCardAmount = (account) => {
    const amount = formatAmount(account?.guncelBakiye);
    return amount === null ? null : Math.abs(amount);
};

const buildInstallmentPaymentCounts = (transactions = []) => {
    const counts = new Map();

    const addPayment = (installmentId, paymentKey) => {
        if (!installmentId) return;
        if (!counts.has(installmentId)) counts.set(installmentId, new Set());
        counts.get(installmentId).add(paymentKey);
    };

    transactions.forEach((transaction) => {
        const linkedIds = [
            transaction.taksitId,
            transaction.installmentId,
            transaction.planId,
            transaction.sourceId,
            transaction.generatedFrom,
            transaction.linkedTransactionId,
        ].filter(Boolean);
        if (linkedIds.length === 0) return;

        const paymentKey = transaction.installmentNumber
            || transaction.taksitNo
            || transaction.taksitSirasi
            || transaction.id
            || `${transaction.tarih || ''}-${transaction.tutar || ''}-${transaction.aciklama || ''}`;

        linkedIds.forEach((installmentId) => addPayment(installmentId, paymentKey));
    });

    return counts;
};

const getInstallmentPaidCount = (installment, paymentCounts) => {
    const totalCount = Number(installment.taksitSayisi || 0);
    const remainingCount = Number(installment.remainingInstallments);
    const directPaid = Math.max(
        Number(installment.odenmisTaksit || 0),
        Number(installment.completedInstallments || 0),
        Number(installment.paidInstallmentCount || 0),
        Number.isFinite(remainingCount) && totalCount > 0 ? Math.max(0, totalCount - remainingCount) : 0,
    );
    const linkedPaid = paymentCounts.get(installment.id)?.size || 0;
    const status = String(installment.status || '').toLowerCase();
    const isCompleted = installment.paid === true
        || installment.isPaid === true
        || Boolean(installment.paidAt)
        || ['paid', 'completed', 'complete', 'odendi', 'tamamlandi'].includes(status);
    const paidCount = isCompleted && totalCount > 0
        ? totalCount
        : Math.max(directPaid, linkedPaid);

    return totalCount > 0 ? Math.min(paidCount, totalCount) : paidCount;
};

const buildEvent = ({ title, date, type, amount, currency = 'TRY', source, sourceId, status = 'upcoming', description = '', meta = {} }) => ({
    id: `${source || 'system'}-${type}-${date}-${title}`,
    title,
    amount,
    currency,
    date,
    type,
    source,
    sourceId,
    status,
    description,
    meta,
});

export const buildCalendarEventsFromData = (data, anchorDate = new Date()) => {
    const events = [];
    const baseYear = anchorDate.getFullYear();
    const baseMonth = anchorDate.getMonth();

    const accounts = Array.isArray(data.accounts) ? data.accounts : [];
    const subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions : [];
    const installments = Array.isArray(data.installments) ? data.installments : [];
    const bills = Array.isArray(data.bills) ? data.bills : [];
    const billDefinitions = Array.isArray(data.billDefinitions) ? data.billDefinitions : [];
    const debts = Array.isArray(data.debts) ? data.debts : [];
    const salaries = Array.isArray(data.salaries) ? data.salaries : [];
    const goals = Array.isArray(data.goals) ? data.goals : [];
    const inventory = Array.isArray(data.inventory) ? data.inventory : [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const installmentPaymentCounts = buildInstallmentPaymentCounts(transactions);

    accounts.forEach((account) => {
        if (account?.hesapTipi !== 'krediKarti') return;
        const kesimGunu = Number(account.kesimGunu || 0);
        if (!Number.isFinite(kesimGunu) || kesimGunu <= 0) return;

        [-1, 0].forEach((offset) => {
            const statementBase = new Date(baseYear, baseMonth + offset, 1);
            const statementDate = new Date(
                statementBase.getFullYear(),
                statementBase.getMonth(),
                clampDay(kesimGunu, statementBase.getFullYear(), statementBase.getMonth())
            );
            const paymentDate = new Date(statementDate);
            paymentDate.setDate(paymentDate.getDate() + 10);
            const amount = creditCardAmount(account);
            const accountName = firstText(account.hesapAdi, account.ad, account.name) || 'Kredi Kartı';

            if (sameMonth(statementDate, baseYear, baseMonth)) {
                events.push(buildEvent({
                    title: `${accountName} Ekstre Kesimi`,
                    date: dateToKey(statementDate),
                    type: 'credit_card_statement',
                    amount,
                    source: 'credit_card',
                    sourceId: account.id,
                    description: 'Kredi kartı kesimi',
                }));
            }

            if (sameMonth(paymentDate, baseYear, baseMonth)) {
                const periodKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
                const paymentPlan = getCreditCardPaymentPlan(account, periodKey);
                events.push(buildEvent({
                    title: `${accountName} Son Ödeme`,
                    date: dateToKey(paymentDate),
                    type: 'credit_card_payment',
                    amount: paymentPlan.plannedPayment,
                    source: 'credit_card',
                    sourceId: account.id,
                    description: 'Planlanan kredi kartı ödemesi',
                    meta: {
                        statementDebt: paymentPlan.statementDebt,
                        minimumPayment: paymentPlan.minimumPayment,
                        plannedPayment: paymentPlan.plannedPayment,
                        carryoverDebt: paymentPlan.carryoverDebt,
                        strategy: paymentPlan.strategy,
                    },
                }));
            }
        });
    });

    buildSubscriptionOccurrences({
        subscriptions,
        transactions,
        year: baseYear,
        month: baseMonth,
        today: anchorDate,
    }).forEach((occurrence) => {
        const subscription = occurrence.subscription;
        events.push(buildEvent({
            title: subscription.ad || 'Sabit gider',
            date: occurrence.dateKey,
            type: 'subscription',
            amount: occurrence.expectedAmount,
            currency: 'TRY',
            source: 'subscription',
            sourceId: subscription.id,
            status: occurrence.status === 'paid' ? 'completed' : occurrence.status,
            description: occurrence.status === 'paid' ? 'Sabit gider ödemesi gerçekleşti' : 'Sabit gider ödeme tarihi',
            meta: {
                subscriptionId: subscription.id,
                periodKey: occurrence.periodKey,
                expectedAmount: occurrence.expectedAmount,
                matchedTransactionId: occurrence.matchedTransactionId,
                occurrenceStatus: occurrence.status,
            },
        }));
    });

    installments.forEach((installment) => {
        const startDate = toDateValue(installment.alisTarihi) || toDateValue(installment.olusturmaTarihi) || anchorDate;
        const total = formatAmount(installment.toplamTutar) || formatAmount(installment.aylikTutar) || 0;
        const paidCount = getInstallmentPaidCount(installment, installmentPaymentCounts);
        const totalCount = Number(installment.taksitSayisi || 0);
        const remaining = Math.max(totalCount - paidCount, 0);
        if (remaining <= 0) return;

        for (let index = 1; index <= remaining; index += 1) {
            const nextDate = new Date(startDate);
            nextDate.setMonth(startDate.getMonth() + (paidCount + index - 1));
            const dateKey = dateToKey(nextDate);

            events.push(buildEvent({
                title: installment.baslik || 'Taksit',
                date: dateKey,
                type: 'installment',
                amount: total / Math.max(totalCount, 1),
                currency: 'TRY',
                source: 'loan',
                sourceId: installment.id,
                description: `Taksit ${index}/${remaining}`,
            }));
        }
    });

    bills.forEach((bill) => {
        const billDate = toDateValue(bill.sonOdemeTarihi || bill.tarih || bill.vadeTarihi);
        if (!billDate) return;
        const dateKey = dateToKey(billDate);
        const definition = billDefinitions.find((item) => item.id && item.id === bill.tanimId);
        const billTitle = firstText(
            bill.title,
            bill.name,
            bill.ad,
            bill.baslik,
            definition?.baslik,
            definition?.ad,
            definition?.kurum,
            bill.aciklama
        ) || 'İsimsiz Fatura';

        events.push(buildEvent({
            title: billTitle,
            date: dateKey,
            type: 'bill',
            amount: formatAmount(bill.tutar),
            currency: 'TRY',
            source: 'bill',
            sourceId: bill.id,
            description: 'Fatura son ödeme tarihi',
        }));
    });

    billDefinitions.forEach((definition) => {
        if (isInactive(definition)) return;
        const alreadyHasBill = bills.some((bill) => {
            if (!bill?.tanimId || bill.tanimId !== definition.id) return false;
            return sameMonth(toDateValue(bill.sonOdemeTarihi || bill.tarih || bill.vadeTarihi), baseYear, baseMonth);
        });
        if (alreadyHasBill) return;

        const dueDate = monthlyDateFor(definition, baseYear, baseMonth);
        if (!dueDate) return;
        const billTitle = firstText(definition.baslik, definition.ad, definition.kurum) || 'Tanımlı Fatura';

        events.push(buildEvent({
            title: billTitle,
            date: dateToKey(dueDate),
            type: 'bill',
            amount: formatAmount(definition.tutar || definition.ortalamaTutar),
            currency: 'TRY',
            source: 'bill_definition',
            sourceId: definition.id,
            status: 'planned',
            description: 'Tanımlı fatura',
        }));
    });

    salaries.forEach((salary) => {
        const day = Number(salary.gun || 0);
        if (!Number.isFinite(day) || day <= 0) return;
        if (isInactive(salary)) return;
        const date = new Date(baseYear, baseMonth, clampDay(day, baseYear, baseMonth));
        events.push(buildEvent({
            title: salary.ad || 'Maaş',
            date: dateToKey(date),
            type: 'salary',
            amount: formatAmount(salary.tutar),
            currency: 'TRY',
            source: 'salary',
            sourceId: salary.id,
            description: 'Düzenli gelir tarihi',
        }));
    });

    goals.forEach((goal) => {
        const date = toDateValue(goal.tarih || goal.tarihDate || goal.hedefTarih);
        if (!date) return;
        events.push(buildEvent({
            title: goal.hedefAdi || goal.ad || 'Hedef',
            date: dateToKey(date),
            type: 'investment',
            amount: formatAmount(goal.hedefTutar || goal.tutar),
            currency: 'TRY',
            source: 'investment',
            sourceId: goal.id,
            description: 'Hedef planı',
        }));
    });

    inventory.forEach((item) => {
        const date = toDateValue(item.tarih || item.alisTarihi || item.planTarihi);
        if (!date) return;
        events.push(buildEvent({
            title: item.urunAdi || item.ad || 'Envanter',
            date: dateToKey(date),
            type: 'investment',
            amount: formatAmount(item.deger || item.tutar),
            currency: 'TRY',
            source: 'investment',
            sourceId: item.id,
            description: 'Satın alma planı',
        }));
    });

    debts.forEach((debt) => {
        if (isInactive(debt)) return;
        const date = toDateValue(debt.sonOdemeTarihi || debt.tarih || debt.vadeTarihi);
        if (!date || !sameMonth(date, baseYear, baseMonth)) return;
        events.push(buildEvent({
            title: debt.ad || debt.baslik || 'Borç',
            date: dateToKey(date),
            type: 'loan_payment',
            amount: formatAmount(debt.kalanTutar ?? debt.tutar ?? debt.toplamTutar),
            currency: 'TRY',
            source: 'loan',
            sourceId: debt.id,
            description: 'Borç ödeme tarihi',
        }));
    });

    return events.sort((a, b) => a.date.localeCompare(b.date));
};

export const buildCalendarEventsForMonth = (data, year, month) => {
    const events = buildCalendarEventsFromData(data, new Date(year, month, 1));
    return events.filter((event) => {
        const [eventYear, eventMonth] = event.date.split('-').map(Number);
        return eventYear === year && eventMonth - 1 === month;
    });
};

export const getUpcomingEventCount = (events, fromDate = new Date()) => {
    const fromKey = dateToKey(fromDate);
    return events.filter((event) => event.date >= fromKey).length;
};
