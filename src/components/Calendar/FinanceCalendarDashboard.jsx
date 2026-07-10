import { useState, useMemo, useEffect } from 'react';
import { useCalendarEvents, groupEventsByDate, formatMonthYear, todayKey, dateToKey } from '../../modules/calendar';
import CalendarGrid from './CalendarGrid';
import CalendarDayPanel from './CalendarDayPanel';
import './calendar.css';

const readInitialCalendarMonth = () => {
    if (typeof window === 'undefined') return new Date();
    const params = new URLSearchParams(window.location.search);
    const year = Number(params.get('calendarYear'));
    const month = Number(params.get('calendarMonth'));
    if (Number.isInteger(year) && year >= 1900 && year <= 9999 && Number.isInteger(month) && month >= 1 && month <= 12) {
        return new Date(year, month - 1, 1);
    }
    return new Date();
};

const FinanceCalendarDashboard = ({ user, alanKodu, gizliMod, sourceData = {} }) => {
    const [viewDate, setViewDate] = useState(readInitialCalendarMonth);
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth();
    const [selectedDateKey, setSelectedDateKey] = useState(todayKey());

    const { events, loading } = useCalendarEvents(user, alanKodu, sourceData, viewYear, viewMonth);

    const eventsByDate = useMemo(
        () => groupEventsByDate(events, viewYear, viewMonth),
        [events, viewYear, viewMonth]
    );

    const selectedEvents = eventsByDate[selectedDateKey] || [];

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.searchParams.set('calendarYear', String(viewYear));
        url.searchParams.set('calendarMonth', String(viewMonth + 1));
        window.history.replaceState({}, '', url);
    }, [viewYear, viewMonth]);

    useEffect(() => {
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
        setSelectedDateKey(isCurrentMonth ? todayKey() : dateToKey(new Date(viewYear, viewMonth, 1)));
    }, [viewYear, viewMonth]);

    const shiftMonth = (delta) => {
        const next = new Date(viewYear, viewMonth + delta, 1);
        setViewDate(next);
    };

    const goToday = () => {
        const today = new Date();
        setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setSelectedDateKey(todayKey());
    };

    return (
        <div className="cal-page">
            {loading ? (
                <div className="cal-loading">Takvim yükleniyor...</div>
            ) : (
                <div className={`cal-layout ${selectedDateKey ? 'cal-layout--with-panel' : ''}`}>
                    <CalendarGrid
                        year={viewYear}
                        month={viewMonth}
                        eventsByDate={eventsByDate}
                        selectedDateKey={selectedDateKey}
                        onSelectDate={setSelectedDateKey}
                        onPrevMonth={() => shiftMonth(-1)}
                        onNextMonth={() => shiftMonth(1)}
                        onToday={goToday}
                        monthLabel={formatMonthYear(viewMonth, viewYear)}
                    />

                    {selectedDateKey && (
                        <CalendarDayPanel
                            dateKey={selectedDateKey}
                            events={selectedEvents}
                            gizliMod={gizliMod}
                            onClose={() => setSelectedDateKey(null)}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default FinanceCalendarDashboard;
