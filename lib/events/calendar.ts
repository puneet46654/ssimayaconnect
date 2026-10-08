import { calendarDate, eventTimeZone } from '@/lib/events/dates';

type CalendarTicket = {
  bookingId: string; eventName: string; venue: string;
  date: string; startTime: string; endTime: string; timeZone?: string;
};

/** Google Calendar "add event" link; times stay in the event's own time zone via ctz. */
export function googleCalendarUrl(ticket: CalendarTicket) {
  const day = calendarDate(ticket.date).replace(/-/g, '');
  const at = (time: string) => `${day}T${time.replace(':', '')}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ticket.eventName,
    dates: `${at(ticket.startTime)}/${at(ticket.endTime)}`,
    ctz: eventTimeZone(ticket.timeZone),
    location: ticket.venue,
    details: `SSI Maya Connect booking reference: ${ticket.bookingId}\nShow your QR ticket from My Tickets at the venue.`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
