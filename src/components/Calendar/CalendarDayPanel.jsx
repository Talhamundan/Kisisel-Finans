import { X } from 'lucide-react';
import { EVENT_TYPE_META } from '../../modules/calendar/constants';
import { formatDayHeading, formatEventAmount } from '../../modules/calendar/calendarUtils';
import FinanceEventCard from '../Shared/FinanceEventCard';

const getCashFlowValue = (event) => {
    const amount = Number(event?.amount);
    if (!Number.isFinite(amount) || amount === 0) return 0;

    if (event.type === 'salary') return Math.abs(amount);
    if (['bill', 'subscription', 'installment', 'loan_payment', 'credit_card_statement', 'credit_card_payment', 'investment'].includes(event.type)) {
        return -Math.abs(amount);
    }

    return amount;
};

const getTone = (value) => {
    if (value > 0) return 'income';
    if (value < 0) return 'expense';
    return 'neutral';
};

const formatSignedAmount = (value, currency, hidden) => {
    if (hidden && value !== 0) return '••••••';
    const tone = getTone(value);
    const formatted = formatEventAmount(Math.abs(value), currency);
    if (!formatted) return '';
    if (tone === 'income') return `+${formatted}`;
    if (tone === 'expense') return `-${formatted}`;
    return formatted;
};

const CalendarDayPanel = ({
    dateKey,
    events = [],
    gizliMod = false,
    onClose,
}) => {
    if (!dateKey) return null;

    const netCashFlow = events.reduce((sum, event) => sum + getCashFlowValue(event), 0);
    const netTone = getTone(netCashFlow);
    const netAmount = formatSignedAmount(netCashFlow, 'TRY', gizliMod);

    return (
        <aside className="cal-day-panel">
            <div className="cal-day-panel__header">
                <div>
                    <p className="cal-day-panel__eyebrow">Gün Detayı</p>
                    <h3 className="cal-day-panel__title">{formatDayHeading(dateKey)}</h3>
                </div>
                <button type="button" className="cal-icon-btn" onClick={onClose} aria-label="Kapat">
                    <X size={18} />
                </button>
            </div>

            <div className="cal-day-panel__body">
                {events.length === 0 ? (
                    <div className="cal-day-panel__empty">
                        <p>Bu gün için finansal kayıt yok.</p>
                    </div>
                ) : (
                    <ul className="cal-event-list">
                        {events.map((ev, i) => {
                            const meta = EVENT_TYPE_META[ev.type] || EVENT_TYPE_META.reminder;
                            const cashFlowValue = getCashFlowValue(ev);
                            const amountTone = getTone(cashFlowValue);
                            const hasAmount = ev.amount !== null && ev.amount !== undefined && ev.amount !== '';
                            const amountStr = hasAmount ? formatSignedAmount(cashFlowValue, ev.currency, gizliMod) : '';

                            return (
                                <li key={`${ev.id}-${ev.occurrenceDate}-${i}`} className="cal-event-list__item">
                                    <FinanceEventCard
                                        title={ev.title}
                                        amount={amountStr}
                                        amountTone={amountTone}
                                        accentColor={meta.color}
                                    />
                                </li>
                            );
                        })}
                    </ul>
                )}

                <div className={`cal-day-panel__summary cal-day-panel__summary--${netTone}`}>
                    <span className="cal-day-panel__summary-label">Net Tutar</span>
                    <strong className="cal-day-panel__summary-value">{netAmount}</strong>
                </div>
            </div>
        </aside>
    );
};

export default CalendarDayPanel;
