import CalendarEventTag from './CalendarEventTag';

const MAX_VISIBLE_TAGS = 3;

const CalendarDayCell = ({ cell, events = [], isSelected, onSelect }) => {
    const visible = events.slice(0, MAX_VISIBLE_TAGS);
    const overflow = events.length - MAX_VISIBLE_TAGS;

    return (
        <button
            type="button"
            className={[
                'cal-day-cell',
                !cell.isCurrentMonth && 'cal-day-cell--muted',
                cell.isToday && 'cal-day-cell--today',
                isSelected && 'cal-day-cell--selected',
                events.length > 0 && 'cal-day-cell--has-events',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(cell.dateKey)}
        >
            <span className="cal-day-cell__number">{cell.day}</span>
            {events.length > 0 && (
                <div className="cal-day-cell__tags">
                    {visible.map((ev, i) => (
                        <CalendarEventTag key={`${ev.id}-${ev.occurrenceDate}-${i}`} event={ev} compact />
                    ))}
                    {overflow > 0 && (
                        <span className="cal-day-cell__more">+{overflow}</span>
                    )}
                </div>
            )}
        </button>
    );
};

export default CalendarDayCell;
