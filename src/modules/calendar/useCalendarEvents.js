import { useMemo } from 'react';
import { buildCalendarEventsFromData } from './calendarEventService';

/**
 * Normalize financial data into calendar events.
 * The calendar now treats the live budget data as its single source of truth.
 */
export const useCalendarEvents = (user, alanKodu, sourceData = {}, viewYear, viewMonth) => {
    const events = useMemo(() => {
        if (!user || !alanKodu) return [];
        const anchorDate = viewYear != null && viewMonth != null
            ? new Date(viewYear, viewMonth, 1)
            : new Date();
        return buildCalendarEventsFromData(sourceData, anchorDate);
    }, [user, alanKodu, sourceData, viewYear, viewMonth]);

    return { events, loading: false };
};
