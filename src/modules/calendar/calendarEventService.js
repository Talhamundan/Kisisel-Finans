import { dateToKey } from './calendarUtils.js';

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

const buildEvent = ({ title, date, type, amount, currency = 'TRY', source, sourceId, status = 'upcoming', description = '' }) => ({
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
    const salaries = Array.isArray(data.salaries) ? data.salaries : [];
    const goals = Array.isArray(data.goals) ? data.goals : [];
    const inventory = Array.isArray(data.inventory) ? data.inventory : [];

    accounts.forEach((account) => {
        if (account?.hesapTipi !== 'krediKarti') return;
        const kesimGunu = Number(account.kesimGunu || 0);
        if (!Number.isFinite(kesimGunu) || kesimGunu <= 0) return;

        const statementDate = new Date(baseYear, baseMonth, Math.min(kesimGunu, 28));
        if (statementDate < anchorDate) {
            statementDate.setMonth(statementDate.getMonth() + 1);
        }
        const paymentDate = new Date(statementDate);
        paymentDate.setDate(paymentDate.getDate() + 10);
        const amount = creditCardAmount(account);
        const accountName = firstText(account.hesapAdi, account.ad, account.name) || 'Kredi Kartı';

        events.push(buildEvent({
            title: `${accountName} Ekstre Kesimi`,
            date: dateToKey(statementDate),
            type: 'credit_card_statement',
            amount,
            source: 'credit_card',
            sourceId: account.id,
            description: 'Kredi kartı kesimi',
        }));
        events.push(buildEvent({
            title: `${accountName} Son Ödeme`,
            date: dateToKey(paymentDate),
            type: 'credit_card_payment',
            amount,
            source: 'credit_card',
            sourceId: account.id,
            description: 'Son ödeme tarihi',
        }));
    });

    subscriptions.forEach((subscription) => {
        const day = Number(subscription.gun || 0);
        if (!Number.isFinite(day) || day <= 0) return;
        const date = new Date(baseYear, baseMonth, Math.min(day, 28));
        if (date < anchorDate) {
            date.setMonth(date.getMonth() + 1);
        }
        events.push(buildEvent({
            title: subscription.ad || 'Abonelik',
            date: dateToKey(date),
            type: 'subscription',
            amount: formatAmount(subscription.tutar),
            currency: 'TRY',
            source: 'subscription',
            sourceId: subscription.id,
            description: 'Abonelik yenileme tarihi',
        }));
    });

    installments.forEach((installment) => {
        const startDate = toDateValue(installment.alisTarihi) || toDateValue(installment.olusturmaTarihi) || anchorDate;
        const total = formatAmount(installment.toplamTutar) || formatAmount(installment.aylikTutar) || 0;
        const paidCount = Number(installment.odenmisTaksit || 0);
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
        const billDate = toDateValue(bill.sonOdemeTarihi);
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

    salaries.forEach((salary) => {
        const day = Number(salary.gun || 0);
        if (!Number.isFinite(day) || day <= 0) return;
        const date = new Date(baseYear, baseMonth, Math.min(day, 28));
        if (date < anchorDate) {
            date.setMonth(date.getMonth() + 1);
        }
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
