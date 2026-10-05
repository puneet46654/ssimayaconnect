import { Booking } from '@/models/Booking';
import '@/models/Event';
import '@/models/Slot';
import '@/models/DaySchedule';
import { eventTimeZone } from '@/lib/events/dates';
import { hasSlotEnded } from '@/lib/events/status';
import type { BookingDetails, ServerBooking } from '@/lib/booking-contracts';

type PopulatedBooking = {
  _id: unknown; bookingId: string; details: BookingDetails;
  attendanceStatus: 'PRESENT' | 'NOT_PRESENT'; checkedInAt?: Date; checkedInBy?: string; checkInMethod?: string;
  eventId: { _id: unknown; eventName: string; venue: string; timeZone?: string; status?: string; imageUrl?: string; updatedAt?: Date } | null;
  slotId: { _id: unknown; startTime: string; endTime: string } | null;
  dayScheduleId: { _id: unknown; date: Date } | null;
};

export async function loadPublicBooking(bookingId: string): Promise<ServerBooking | null> {
  const booking = await Booking.findOne({ bookingId })
    .select('-requestKeyHash -requestFingerprint')
    .populate('eventId', 'eventName venue timeZone imageUrl updatedAt status')
    .populate('slotId', 'startTime endTime')
    .populate('dayScheduleId', 'date')
    .lean() as unknown as PopulatedBooking | null;
  if (!booking) return null;
  const event = booking.eventId;
  const slot = booking.slotId;
  const day = booking.dayScheduleId;
  const timeZone = eventTimeZone(event?.timeZone);
  const eventId = event ? String(event._id) : '';
  const id = String(booking._id);
  return {
    id, bookingId, eventId, eventName: event?.eventName || 'Event unavailable',
    venue: event?.venue || '', timeZone,
    imageUrl: event?.imageUrl ? `/api/events/${eventId}/image?v=${new Date(event.updatedAt || 0).getTime()}` : '',
    details: { ...booking.details, eventId, eventName: event?.eventName || 'Event unavailable' },
    slotId: slot ? String(slot._id) : '', dayScheduleId: day ? String(day._id) : '',
    date: day?.date ? new Date(day.date).toISOString() : '',
    startTime: slot?.startTime || '', endTime: slot?.endTime || '',
    attendanceStatus: booking.attendanceStatus || 'NOT_PRESENT',
    checkedInAt: booking.checkedInAt ? new Date(booking.checkedInAt).toISOString() : null,
    checkedInBy: booking.checkedInBy || '', checkInMethod: booking.checkInMethod || '',
    status: event?.status === 'CANCELLED' ? 'CANCELLED' : booking.attendanceStatus === 'PRESENT' ? 'ATTENDED'
      : !event || !slot || !day || hasSlotEnded(day.date, slot.endTime, new Date(), timeZone) ? 'EXPIRED' : 'ACTIVE',
    qrData: event?.status === 'CANCELLED' ? '' : JSON.stringify({ type: 'SSI_MAYA_CONNECT_ATTENDANCE', doctorId: id, bookingId, eventId }),
  };
}
