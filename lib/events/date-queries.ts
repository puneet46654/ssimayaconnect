import { DEFAULT_TIME_ZONE } from '@/lib/events/dates';
import { DaySchedule } from '@/models/DaySchedule';
import type { Types } from 'mongoose';

/** Mongo comparisons use the event's local day, including legacy India events. */
export function liveEventFilter(now = new Date()) {
  const today = { $dateToString: { date: now, format: '%Y-%m-%d', timezone: { $ifNull: ['$timeZone', DEFAULT_TIME_ZONE] } } };
  return { status: { $ne: 'CANCELLED' as const }, $expr: { $and: [
    { $lte: [{ $dateToString: { date: '$startDate', format: '%Y-%m-%d', timezone: 'UTC' } }, today] },
    { $gte: [{ $dateToString: { date: '$endDate', format: '%Y-%m-%d', timezone: 'UTC' } }, today] },
  ] } };
}

export async function schedulesByLocalDate(mode: 'today' | 'upcoming' | 'past', now = new Date()): Promise<Array<{ _id: Types.ObjectId }>> {
  const operator = mode === 'today' ? '$eq' : mode === 'upcoming' ? '$gte' : '$lt';
  return DaySchedule.aggregate([
    { $lookup: { from: 'events', localField: 'eventId', foreignField: '_id', as: 'event' } },
    { $unwind: '$event' },
    { $match: { $expr: { [operator]: [
      { $dateToString: { date: '$date', format: '%Y-%m-%d', timezone: 'UTC' } },
      { $dateToString: { date: now, format: '%Y-%m-%d', timezone: { $ifNull: ['$event.timeZone', DEFAULT_TIME_ZONE] } } },
    ] } } },
    { $project: { _id: 1 } },
  ]);
}
