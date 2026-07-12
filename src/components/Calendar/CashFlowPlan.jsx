import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENT_TYPE_META, formatDayHeading, formatEventAmount, todayKey } from '../../modules/calendar';
import { toDateSafe } from '../../utils/helpers';

const CASHFLOW_TYPES = new Set([
    'salary',
    'credit_card_payment',
    'loan_payment',
    'subscription',
    'bill',
    'installment',
]);

const typeToTone = {
    salary: 'income',
    credit_card_payment: 'credit-card',
    loan_payment: 'credit',
    subscription: 'subscription',
    bill: 'bill',
    installment: 'installment',
};

const sourceToTone = {
    salary: 'income',
    credit_card: 'credit-card',
    loan: 'credit',
    subscription: 'subscription',
    bill: 'bill',
    bill_definition: 'bill',
};

const parseAmount = (value) => {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
};

const dateKeyFromValue = (value) => {
    const date = toDateSafe(value);
    if (!date) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

const dayFromKey = (dateKey) => Number(String(dateKey || '').split('-')[2] || 0);

const isInMonth = (dateKey, year, month) => {
    if (!dateKey || !Number.isInteger(year) || !Number.isInteger(month)) return true;
    const [eventYear, eventMonth] = dateKey.split('-').map(Number);
    return eventYear === year && eventMonth === month + 1;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

const getEventTone = (event) => {
    const description = String(event.description || '').toLocaleLowerCase('tr-TR');
    if (description.includes('borç ödeme')) return 'debt';
    return typeToTone[event.type] || sourceToTone[event.source] || 'debt';
};

const getEventDirection = (event) => (event.type === 'salary' ? 'income' : 'expense');

const formatSignedAmount = (amount, direction, gizliMod = false) => {
    const sign = direction === 'income' ? '+' : '-';
    if (gizliMod) return `${sign}**** ₺`;
    return `${sign}${formatEventAmount(Math.abs(amount), 'TRY')}`;
};

const formatPlainAmount = (amount, gizliMod = false) => (
    gizliMod ? '**** ₺' : formatEventAmount(Math.abs(amount), 'TRY')
);

const getFinancialTone = (amount) => {
    if (amount > 0) return 'positive';
    if (amount < 0) return 'negative';
    return 'neutral';
};

const getCashStartBalance = (accounts = []) => accounts.reduce((total, account) => {
    if (!account || account.deletedAt || account.silindi) return total;
    if (account.hesapTipi === 'krediKarti' || account.hesapTipi === 'yatirim') return total;
    return total + parseAmount(account.guncelBakiye);
}, 0);

const isCreditCardInstallment = (event, sourceData = {}) => {
    if (event.type !== 'installment') return false;
    const plan = (sourceData.installments || []).find((item) => item.id === event.sourceId);
    if (!plan?.hesapId) return false;
    const account = (sourceData.accounts || []).find((item) => item.id === plan.hesapId);
    return account?.hesapTipi === 'krediKarti';
};

const transactionMatchesEvent = (transaction, event, dateKey) => {
    const transactionDateKey = dateKeyFromValue(transaction?.tarih);
    if (transactionDateKey !== dateKey) return false;

    const title = String(event.title || '').toLocaleLowerCase('tr-TR');
    const description = String(transaction?.aciklama || '').toLocaleLowerCase('tr-TR');
    const category = String(transaction?.kategori || '').toLocaleLowerCase('tr-TR');

    if (event.type === 'salary') {
        return transaction?.islemTipi === 'gelir' && (
            transaction.bagliMaasId === event.sourceId ||
            transaction.recurringIncomeId === event.sourceId ||
            transaction.gelirId === event.sourceId ||
            transaction.sourceId === event.sourceId ||
            (title && description.includes(title))
        );
    }

    if (event.type === 'subscription') {
        return transaction?.islemTipi === 'gider' && title && description.includes(title);
    }

    if (event.type === 'credit_card_payment') {
        return (transaction?.hedefId === event.sourceId || transaction?.hesapId === event.sourceId) &&
            ['transfer', 'gider', 'gelir'].includes(transaction?.islemTipi);
    }

    if (event.type === 'installment') {
        return transaction?.taksitId === event.sourceId ||
            transaction?.installmentId === event.sourceId ||
            transaction?.planId === event.sourceId ||
            transaction?.sourceId === event.sourceId ||
            transaction?.generatedFrom === event.sourceId ||
            (title && description.includes(title));
    }

    if (event.type === 'bill') {
        return transaction?.islemTipi === 'gider' && (
            transaction?.faturaId === event.sourceId ||
            transaction?.tanimId === event.sourceId ||
            (category.includes('fatura') && title && description.includes(title))
        );
    }

    if (event.type === 'loan_payment') {
        return transaction?.borcId === event.sourceId ||
            transaction?.loanId === event.sourceId ||
            transaction?.sourceId === event.sourceId ||
            (title && description.includes(title));
    }

    return false;
};

const isRealized = (event, dateKey, sourceData = {}, today) => {
    if (dateKey < today) return true;
    if (dateKey > today) return false;
    return (sourceData.transactions || []).some((transaction) => transactionMatchesEvent(transaction, event, dateKey));
};

const normalizeEvent = (event, sourceData, gizliMod, year, month, today) => {
    const date = event?.occurrenceDate || event?.date;
    if (!event || !date || !CASHFLOW_TYPES.has(event.type) || !isInMonth(date, year, month)) return null;

    const rawAmount = parseAmount(event.amount);
    if (rawAmount <= 0) return null;

    const direction = getEventDirection(event);
    const signedAmount = direction === 'income' ? rawAmount : -rawAmount;
    const infoOnly = isCreditCardInstallment(event, sourceData);
    const realized = isRealized(event, date, sourceData, today);
    const forecastImpact = realized || infoOnly ? 0 : signedAmount;
    const tone = getEventTone(event);

    return {
        id: `${event.id || event.sourceId || event.title}-${date}-${event.type}`,
        date,
        day: dayFromKey(date),
        title: event.title || EVENT_TYPE_META[event.type]?.label || 'Plan',
        description: infoOnly ? 'Bilgi - kart ekstresine dahil' : (event.description || EVENT_TYPE_META[event.type]?.label || ''),
        amount: rawAmount,
        signedAmount,
        forecastImpact,
        direction,
        tone,
        type: event.type,
        meta: event.meta || {},
        realized,
        infoOnly,
        displayAmount: formatSignedAmount(rawAmount, direction, gizliMod),
    };
};

const buildPlan = ({ events, sourceData, gizliMod, year, month }) => {
    const today = todayKey();
    const daysInMonth = getDaysInMonth(year, month);
    const startBalance = getCashStartBalance(sourceData.accounts || []);
    const items = (events || [])
        .map((event) => normalizeEvent(event, sourceData, gizliMod, year, month, today))
        .filter(Boolean)
        .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'tr-TR'));

    const grouped = new Map();
    items.forEach((item) => {
        if (!grouped.has(item.date)) grouped.set(item.date, []);
        grouped.get(item.date).push(item);
    });

    const dayGroups = [...grouped.entries()].map(([date, groupItems]) => {
        const incomeTotal = groupItems
            .filter((item) => item.direction === 'income')
            .reduce((sum, item) => sum + item.amount, 0);
        const expenseTotal = groupItems
            .filter((item) => item.direction === 'expense')
            .reduce((sum, item) => sum + item.amount, 0);
        const forecastImpact = groupItems.reduce((sum, item) => sum + item.forecastImpact, 0);
        return {
            date,
            day: dayFromKey(date),
            items: groupItems,
            incomeTotal,
            expenseTotal,
            dailyNet: incomeTotal - expenseTotal,
            forecastImpact,
            tone: incomeTotal > 0 && expenseTotal > 0 ? 'mixed' : incomeTotal > 0 ? 'income' : 'expense',
            isPast: date < today,
            isToday: date === today,
        };
    });

    let runningBalance = startBalance;
    const balancesByDate = new Map();
    const chartPoints = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const group = dayGroups.find((item) => item.date === date);
        if (group) runningBalance += group.forecastImpact;
        balancesByDate.set(date, runningBalance);
        chartPoints.push({ day, date, balance: runningBalance });
    }

    const groupsWithBalance = dayGroups.map((group) => ({
        ...group,
        endBalance: balancesByDate.get(group.date) ?? runningBalance,
    }));

    const forecastIncome = items
        .filter((item) => item.forecastImpact > 0)
        .reduce((sum, item) => sum + item.forecastImpact, 0);
    const forecastExpense = items
        .filter((item) => item.forecastImpact < 0)
        .reduce((sum, item) => sum + Math.abs(item.forecastImpact), 0);

    return {
        daysInMonth,
        startBalance,
        groups: groupsWithBalance,
        chartPoints,
        monthEndBalance: runningBalance,
        forecastIncome,
        forecastExpense,
    };
};

const DetailSection = ({ title, items, direction, gizliMod }) => {
    if (!items.length) return null;
    return (
        <div className="cal-cashflow-popover__section">
            <h4>{title}</h4>
            {items.map((item) => (
                <div key={item.id} className="cal-cashflow-detail-block">
                    <div className="cal-cashflow-detail-row">
                        <span>
                            {item.title}
                            {(item.realized || item.infoOnly) && (
                                <em>{item.infoOnly ? 'Bilgi' : direction === 'income' ? 'Gerçekleşti' : 'Ödendi'}</em>
                            )}
                        </span>
                        <strong className={`is-${direction === 'income' ? 'positive' : 'negative'}`}>
                            {item.displayAmount}
                        </strong>
                    </div>
                    {item.type === 'credit_card_payment' && (
                        <div className="cal-cashflow-card-meta">
                            <span>Ekstre borcu <b>{formatPlainAmount(item.meta.statementDebt, gizliMod)}</b></span>
                            <span>Asgari ödeme <b>{formatPlainAmount(item.meta.minimumPayment, gizliMod)}</b></span>
                            <span>Planlanan <b>{formatPlainAmount(item.meta.plannedPayment, gizliMod)}</b></span>
                            <span>Devreden <b>{formatPlainAmount(item.meta.carryoverDebt, gizliMod)}</b></span>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const CashFlowPlan = ({ events = [], sourceData = {}, gizliMod = false, year, month }) => {
    const [selectedDate, setSelectedDate] = useState(null);
    const timelineRef = useRef(null);
    const plan = useMemo(
        () => buildPlan({ events, sourceData, gizliMod, year, month }),
        [events, gizliMod, month, sourceData, year]
    );
    const selectedGroup = plan.groups.find((group) => group.date === selectedDate) || null;

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') setSelectedDate(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleOutsideClick = (event) => {
        if (!selectedDate) return;
        if (timelineRef.current && !timelineRef.current.contains(event.target)) setSelectedDate(null);
    };

    const selectedLeft = selectedGroup
        ? ((selectedGroup.day - 1) / Math.max(plan.daysInMonth - 1, 1)) * 100
        : 50;

    return (
        <section className="cal-cashflow-card" aria-labelledby="cashflow-plan-title" onMouseDown={handleOutsideClick}>
            <div className="cal-cashflow-card__header">
                <div>
                    <h2 id="cashflow-plan-title">Nakit Akış Planı</h2>
                    <p>Beklenen gelir ve ödemelerin aylık bakiye üzerindeki etkisi.</p>
                </div>
                <div className="cal-cashflow-start-balance">
                    <span>Başlangıç nakdi</span>
                    <strong>{formatPlainAmount(plan.startBalance, gizliMod)}</strong>
                </div>
            </div>

            {plan.groups.length === 0 ? (
                <div className="cal-cashflow-empty">
                    Bu ay için planlanan nakit hareketi bulunmuyor.
                </div>
            ) : (
                <div className="cal-cashflow-shell" ref={timelineRef}>
                    <div className="cal-cashflow-track-wrap">
                        <div className="cal-cashflow-track">
                            <div className="cal-cashflow-axis" />
                            {plan.groups.map((group) => {
                                const left = `${((group.day - 1) / Math.max(plan.daysInMonth - 1, 1)) * 100}%`;
                                const isSelected = group.date === selectedDate;
                                return (
                                    <button
                                        key={group.date}
                                        type="button"
                                        className={[
                                            'cal-cashflow-node',
                                            `cal-cashflow-node--${group.tone}`,
                                            group.isPast ? 'is-past' : '',
                                            group.isToday ? 'is-today' : '',
                                            isSelected ? 'is-selected' : '',
                                        ].filter(Boolean).join(' ')}
                                        style={{ left }}
                                        onClick={() => setSelectedDate(group.date)}
                                        title={`${formatDayHeading(group.date)} · ${formatSignedAmount(Math.abs(group.dailyNet), group.dailyNet >= 0 ? 'income' : 'expense', gizliMod)}`}
                                    >
                                        <span className="cal-cashflow-node__date">{group.day}</span>
                                        <span className="cal-cashflow-node__dot" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {selectedGroup && (
                        <div
                            className="cal-cashflow-popover"
                            style={{ '--popover-left': `${selectedLeft}%` }}
                            role="dialog"
                            aria-label={`${formatDayHeading(selectedGroup.date)} nakit akışı`}
                        >
                            <button type="button" className="cal-cashflow-popover__close" onClick={() => setSelectedDate(null)} aria-label="Detay penceresini kapat">
                                <span aria-hidden="true">×</span>
                            </button>
                            <h3>{formatDayHeading(selectedGroup.date)}</h3>
                            <DetailSection title="Gelirler" items={selectedGroup.items.filter((item) => item.direction === 'income')} direction="income" gizliMod={gizliMod} />
                            <DetailSection title="Giderler" items={selectedGroup.items.filter((item) => item.direction === 'expense')} direction="expense" gizliMod={gizliMod} />
                            <div className="cal-cashflow-popover__summary">
                                {selectedGroup.incomeTotal > 0 && (
                                    <div><span>Toplam gelir</span><strong className="is-positive">+{formatPlainAmount(selectedGroup.incomeTotal, gizliMod)}</strong></div>
                                )}
                                {selectedGroup.expenseTotal > 0 && (
                                    <div><span>Toplam gider</span><strong className="is-negative">-{formatPlainAmount(selectedGroup.expenseTotal, gizliMod)}</strong></div>
                                )}
                                <div><span>Günlük net</span><strong className={`is-${getFinancialTone(selectedGroup.dailyNet)}`}>{formatSignedAmount(Math.abs(selectedGroup.dailyNet), selectedGroup.dailyNet >= 0 ? 'income' : 'expense', gizliMod)}</strong></div>
                            </div>
                            <div className="cal-cashflow-popover__balance">
                                <span>Tahmini Gün Sonu Bakiye</span>
                                <strong className={`is-${getFinancialTone(selectedGroup.endBalance)}`}>{selectedGroup.endBalance < 0 ? '-' : ''}{formatPlainAmount(selectedGroup.endBalance, gizliMod)}</strong>
                            </div>
                        </div>
                    )}

                    <div className="cal-cashflow-month-summary">
                        <h3>Tahmini Ay Sonu</h3>
                        <div><span>Toplam beklenen gelir</span><strong className="is-positive">{formatPlainAmount(plan.forecastIncome, gizliMod)}</strong></div>
                        <div><span>Toplam beklenen gider</span><strong className="is-negative">{formatPlainAmount(plan.forecastExpense, gizliMod)}</strong></div>
                        <div><span>Tahmini ay sonu bakiye</span><strong className={`is-${getFinancialTone(plan.monthEndBalance)}`}>{plan.monthEndBalance < 0 ? '-' : ''}{formatPlainAmount(plan.monthEndBalance, gizliMod)}</strong></div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default CashFlowPlan;
