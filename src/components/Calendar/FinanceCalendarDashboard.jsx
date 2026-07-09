import { useState, useMemo, useEffect } from 'react';
import { useCalendarEvents, groupEventsByDate, formatMonthYear, todayKey, dateToKey } from '../../modules/calendar';
import CalendarGrid from './CalendarGrid';
import CalendarDayPanel from './CalendarDayPanel';
import './calendar.css';

const FinanceCalendarDashboard = ({ user, alanKodu, gizliMod, sourceData = {}, selectedYear, selectedMonth, setSelectedPeriod, availablePeriods }) => {
    const viewYear = selectedYear;
    const viewMonth = selectedMonth === 'all'
        ? ((availablePeriods?.monthsByYear?.[selectedYear]?.[0] || 1) - 1)
        : selectedMonth - 1;
    const [selectedDateKey, setSelectedDateKey] = useState(todayKey());

    const { events, loading } = useCalendarEvents(user, alanKodu, sourceData, viewYear, viewMonth);

    const eventsByDate = useMemo(
        () => groupEventsByDate(events, viewYear, viewMonth),
        [events, viewYear, viewMonth]
    );

    const selectedEvents = eventsByDate[selectedDateKey] || [];

    useEffect(() => {
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === viewYear && today.getMonth() === viewMonth;
        setSelectedDateKey(isCurrentMonth ? todayKey() : dateToKey(new Date(viewYear, viewMonth, 1)));
    }, [viewYear, viewMonth]);

    const shiftMonth = (delta) => {
        const next = new Date(viewYear, viewMonth + delta, 1);
        setSelectedPeriod({
            year: next.getFullYear(),
            month: next.getMonth() + 1,
        });
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
