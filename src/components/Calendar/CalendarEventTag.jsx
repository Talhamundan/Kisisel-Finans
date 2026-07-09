import './calendar.css';
import { EVENT_TYPE_META } from '../../modules/calendar/constants';

const CalendarEventTag = ({ event, compact = false }) => {
    const meta = EVENT_TYPE_META[event.type] || EVENT_TYPE_META.reminder;

    return (
        <span
            className={`cal-event-tag ${compact ? 'cal-event-tag--compact' : ''}`}
            style={{ '--tag-color': meta.color }}
            title={event.title}
        >
            <span className="cal-event-tag__dot" />
            <span className="cal-event-tag__label">{event.title}</span>
        </span>
    );
};

export default CalendarEventTag;
