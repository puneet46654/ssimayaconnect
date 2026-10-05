import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePhone, phoneIdentity, isValidPhone, normalizeEmail, isValidEmail } from '../../lib/phone';
import { validateEventSchedules, validateSchedule, type ScheduleInput } from '../../lib/events/schedule-validation';
import { generateSlotTimes, generateSlotPreview, timeToMinutes } from '../../lib/events/slots';

const day: ScheduleInput = {
  date: '2026-10-01', startTime: '08:00', endTime: '18:00',
  lunchEnabled: true, lunchStart: '12:00', lunchEnd: '13:00',
  slotDuration: '30', slotGap: '10', capacity: '5', sameAsDay1: false,
};

test('create and edit previews reject invalid numbers and produce bounded valid times', () => {
  for (const key of ['slotDuration', 'slotGap', 'capacity']) {
    for (const value of ['-1', '0.5', '5e-324', 'Infinity', 'NaN', '1441']) {
      assert.deepEqual(generateSlotPreview({ ...day, [key]: value }), []);
    }
  }
  assert.deepEqual(generateSlotPreview({ ...day, startTime: '00:00', endTime: '01:00', slotGap: '0', lunchEnabled: false }), ['00:00 – 00:30', '00:30 – 01:00']);
});

test('phone identity retains country codes and ignores formatting, never suffixes', () => {
  assert.equal(phoneIdentity('98765 43210', '+91'), '919876543210');
  assert.equal(phoneIdentity('+91 (98765) 43210', '+91'), '919876543210');
  assert.notEqual(phoneIdentity('9876543210', '+1'), phoneIdentity('9876543210', '+91'));
  assert.notEqual(normalizePhone('6543210'), normalizePhone('+91 9876543210'));
  assert.equal(normalizePhone('123abc4567'), '');
  assert.equal(normalizePhone('++91 9876543210'), '');
});

test('registration, server and lookup share the same complete-number limits', () => {
  for (const value of ['1234567', '123456789', '+91 98765 43210', '+123456789012345']) assert.ok(isValidPhone(value), value);
  for (const value of ['', '123456', '+1234567890123456', 'abcdefghi', '0000000']) assert.equal(isValidPhone(value), false, value);
  assert.equal(isValidPhone('12345678901234', '+91'), false);
  assert.equal(isValidPhone('9876543210', 'invalid'), false);
  assert.equal(normalizeEmail(' Person@Example.COM '), 'person@example.com');
  assert.ok(isValidEmail(' Person@Example.COM '));
  assert.equal(isValidEmail('not-an-email'), false);
});

test('valid schedules generate bounded slots outside lunch', () => {
  assert.equal(validateEventSchedules('2026-10-01', '2026-10-02', 2, [day, { ...day, date: '2026-10-02' }]), '');
  const slots = generateSlotTimes('08:00', '18:00', '30', '10', true, '12:00', '13:00');
  assert.equal(slots[0].startTime, '08:00');
  assert.ok(slots.every(s => s.endTime <= '12:00' || s.startTime >= '13:00'));
  assert.ok(slots.every(s => s.endTime <= '18:00'));
  assert.deepEqual(generateSlotTimes('00:00', '01:00', '30', '0', false, '', ''), [
    { startTime: '00:00', endTime: '00:30' }, { startTime: '00:30', endTime: '01:00' },
  ]);
});

test('unsafe numeric inputs cannot enter an unbounded slot loop', () => {
  for (const duration of ['-10', '0', '0.5', '5e-324', 'Infinity', 'NaN', '1441']) {
    assert.notEqual(validateSchedule({ ...day, slotDuration: duration }, 0), '');
    assert.deepEqual(generateSlotTimes('08:00', '18:00', duration, '10', false, '', ''), []);
  }
  for (const gap of ['-1', '0.5', 'Infinity', 'NaN', '1441']) assert.notEqual(validateSchedule({ ...day, slotGap: gap }, 0), '');
  for (const capacity of ['0', '21', '1.5', 'Infinity', 'NaN']) assert.notEqual(validateSchedule({ ...day, capacity }, 0), '');
});

test('reject impossible, duplicate, unordered and out-of-event schedules', () => {
  for (const time of ['25:00', '08:60', '8:00', '', 'abc']) assert.ok(Number.isNaN(timeToMinutes(time)));
  assert.notEqual(validateSchedule({ ...day, date: '2026-02-30' }, 0), '');
  assert.notEqual(validateSchedule({ ...day, lunchStart: 'abc' }, 0), '');
  assert.notEqual(validateSchedule({ ...day, lunchEnd: '19:00' }, 0), '');
  assert.notEqual(validateEventSchedules('2026-10-02', '2026-10-01', 1, [day]), '');
  assert.notEqual(validateEventSchedules('2026-10-01', '2026-10-02', 2, [day, day]), '');
  assert.notEqual(validateEventSchedules('2026-10-01', '2026-10-02', 1, [{ ...day, date: '2026-10-03' }]), '');
  assert.notEqual(validateEventSchedules('2026-10-01', '2026-10-02', 1.5, [day]), '');
  assert.notEqual(validateEventSchedules('2026-10-01', '2026-10-02', 1, [null]), '');
});

test('global schedules reject invalid zones and ambiguous transition times', () => {
  assert.match(validateEventSchedules(day.date, day.date, 1, [day], 'Not/AZone'), /timezone/);
  for (const date of ['2026-03-08', '2026-11-01']) {
    const schedule = { ...day, date, startTime: '01:00', endTime: '04:00', lunchEnabled: false };
    assert.match(validateEventSchedules(date, date, 1, [schedule], 'America/New_York'), /clock change/);
    assert.equal(validateEventSchedules(date, date, 1, [{ ...day, date }], 'America/New_York'), '');
  }
});
