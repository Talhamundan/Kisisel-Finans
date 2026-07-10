import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildMonthGrid, WEEKDAY_LABELS } from '../../modules/calendar';
import CalendarDayCell from './CalendarDayCell';

const CalendarGrid = ({
    year,
    month,
    eventsByDate,
    selectedDateKey,
    onSelectDate,
    onPrevMonth,
    onNextMonth,
    onToday,
    monthLabel,
}) => {
    const cells = buildMonthGrid(year, month);

    return (
        <div className="cal-grid-wrap">
            <div className="cal-grid-header">
                <button type="button" className="cal-nav-btn" onClick={onPrevMonth} aria-label="Önceki ay">
                    <ChevronLeft size={20} />
                </button>
                <div className="cal-grid-header__center">
                    <h2 className="cal-grid-header__title">{monthLabel}</h2>
                    <button type="button" className="cal-today-btn" onClick={onToday}>Bugün</button>
                </div>
                <button type="button" className="cal-nav-btn" onClick={onNextMonth} aria-label="Sonraki ay">
                    <ChevronRight size={20} />
                </button>
            </div>

            <div className="cal-weekdays">
                {WEEKDAY_LABELS.map((label) => (
                    <span key={label} className="cal-weekdays__item">{label}</span>
                ))}
            </div>

            <div className="cal-grid">
                {cells.map((cell) => (
                    <CalendarDayCell
                        key={cell.dateKey}
                        cell={cell}
                        events={eventsByDate[cell.dateKey] || []}
                        isSelected={selectedDateKey === cell.dateKey}
                        onSelect={onSelectDate}
                    />
                ))}
            </div>
        </div>
    );
};

export default CalendarGrid;
