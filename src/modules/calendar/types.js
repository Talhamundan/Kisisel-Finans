/**
 * @typedef {'salary' | 'credit_card_statement' | 'credit_card_payment' | 'loan_payment' | 'subscription' | 'bill' | 'investment' | 'reminder' | 'custom'} CalendarEventType
 */

/**
 * @typedef {'manual' | 'credit_card' | 'loan' | 'subscription' | 'salary' | 'bill' | 'investment' | 'system'} CalendarEventSource
 */

/**
 * @typedef {'once' | 'weekly' | 'monthly' | 'yearly'} RecurrenceType
 */

/**
 * @typedef {'upcoming' | 'completed' | 'overdue' | 'cancelled'} CalendarEventStatus
 */

/**
 * @typedef {Object} FinancialCalendarEvent
 * @property {string} [id]
 * @property {string} title
 * @property {string} [description]
 * @property {number} [amount]
 * @property {string} [currency]
 * @property {string} date - YYYY-MM-DD
 * @property {CalendarEventType} type
 * @property {CalendarEventStatus} [status]
 * @property {boolean} [isRecurring]
 * @property {RecurrenceType} [recurrenceType]
 * @property {CalendarEventSource} [source]
 * @property {string} [sourceId]
 * @property {string} [alanKodu]
 * @property {string} [uid]
 */

/**
 * @typedef {FinancialCalendarEvent & { occurrenceDate: string, isVirtual?: boolean }} CalendarOccurrence
 */

export {};
