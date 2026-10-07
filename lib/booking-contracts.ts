export type BookingDetails = {
  fullName: string;
  email: string;
  mobile: string;
  countryCode?: string;
  [key: string]: string | undefined;
};

export type AttendanceStatus = 'NOT_PRESENT' | 'PRESENT';

export type ServerBooking = {
  id: string;
  bookingId: string;
  eventId: string;
  eventName: string;
  venue: string;
  imageUrl: string;
  timeZone: string;
  dayScheduleId: string;
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  details: BookingDetails;
  status: 'ACTIVE' | 'EXPIRED' | 'ATTENDED' | 'CANCELLED';
  qrData: string;
  checkedInBy: string;
  checkInMethod: string;
  attendanceStatus: AttendanceStatus;
  checkedInAt: string | null;
};

export type BookingApiResponse = {
  success?: boolean;
  existing?: boolean;
  error?: string;
  message?: string;
  booking?: ServerBooking;
};

export const ticketStorage = {
  mobile: 'ssi-my-tickets-mobile',
  email: 'ssi-my-tickets-email',
  reference: 'ssi-my-tickets-reference',
  tickets: 'ssi-my-tickets-data',
  events: 'ssi-events-cache',
} as const;

export const bookingStorage = {
  country: (eventId: string) => `ssi-booking-country:${eventId}`,
  details: (eventId: string) => `ssi-booking-details:${eventId}`,
  draft: (eventId: string) => `ssi-booking-draft:${eventId}`,
  intent: (eventId: string) => `ssi-booking-intent:${eventId}`,
  /** localStorage, unlike the keys above: must survive closing the tab until the event ends. */
  pending: (eventId: string) => `ssi-booking-pending:${eventId}`,
};
