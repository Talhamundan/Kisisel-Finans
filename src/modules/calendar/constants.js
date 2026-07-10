/** @type {import('./types').CalendarEventType[]} */
export const CALENDAR_EVENT_TYPES = [
    'salary',
    'credit_card_statement',
    'credit_card_payment',
    'loan_payment',
    'subscription',
    'bill',
    'investment',
    'reminder',
    'custom',
];

/** @type {import('./types').CalendarEventSource[]} */
export const CALENDAR_EVENT_SOURCES = [
    'manual',
    'credit_card',
    'loan',
    'subscription',
    'salary',
    'bill',
    'bill_definition',
    'investment',
    'system',
];

/** @type {import('./types').RecurrenceType[]} */
export const RECURRENCE_TYPES = ['once', 'weekly', 'monthly', 'yearly'];

export const EVENT_TYPE_META = {
    salary: { label: 'Maaş', color: '#22c55e', dot: '🟢' },
    credit_card_statement: { label: 'Kredi Kartı Kesimi', color: '#3b82f6', dot: '🔵' },
    credit_card_payment: { label: 'Son Ödeme Tarihi', color: '#ef4444', dot: '🔴' },
    loan_payment: { label: 'Kredi Taksidi', color: '#f97316', dot: '🟠' },
    subscription: { label: 'Abonelik', color: '#a855f7', dot: '🟣' },
    bill: { label: 'Fatura', color: '#eab308', dot: '🟡' },
    investment: { label: 'Hedef / Plan', color: '#06b6d4', dot: '🔷' },
    reminder: { label: 'Hatırlatma', color: '#94a3b8', dot: '⚪' },
    custom: { label: 'Özel', color: '#64748b', dot: '⚫' },
};

export const RECURRENCE_LABELS = {
    once: 'Tek seferlik',
    weekly: 'Haftalık',
    monthly: 'Aylık',
    yearly: 'Yıllık',
};

export const CURRENCY_OPTIONS = ['TRY', 'USD', 'EUR', 'GBP'];

export const COLLECTION_NAME = 'financial_calendar_events';
