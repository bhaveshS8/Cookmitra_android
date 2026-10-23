import {
  hmToMinutes,
  minutesToHM,
  deriveEndTime,
  buildStartOptions,
  groupStartOptions,
  SERVICE_START_MIN,
  SERVICE_END_MIN,
} from '../src/utils/timeSlots';

describe('booking time slots (website parity)', () => {
  const now = new Date(2026, 9, 23, 10, 15); // Fri 23 Oct 2026, 10:15 local

  test('service day is 8 am to 8 pm', () => {
    expect(SERVICE_START_MIN).toBe(8 * 60);
    expect(SERVICE_END_MIN).toBe(20 * 60);
    expect(hmToMinutes('08:00')).toBe(480);
    expect(hmToMinutes('20:00')).toBe(1200);
    expect(hmToMinutes('bogus')).toBe(null);
    expect(minutesToHM(13 * 60)).toBe('13:00');
  });

  test('end time is derived from start + duration', () => {
    expect(deriveEndTime('11:00', 2)).toBe('13:00');
    expect(deriveEndTime('08:00', 1)).toBe('09:00');
    expect(deriveEndTime('19:00', 2)).toBe(''); // ends after 8 pm
    expect(deriveEndTime('11:00', 9)).toBe(''); // invalid duration
    expect(deriveEndTime('', 2)).toBe('');
  });

  test('future date offers whole hours 8 am to 8 pm', () => {
    const options = buildStartOptions({ date: '2026-10-24', durationHours: 1, now });
    expect(options).toHaveLength(12);
    expect(options[0]).toBe('08:00');
    expect(options[options.length - 1]).toBe('19:00');
    expect(options.every((t) => t.endsWith(':00'))).toBe(true);
  });

  test('longer durations drop starts that would end after 8 pm', () => {
    const options = buildStartOptions({ date: '2026-10-24', durationHours: 4, now });
    expect(options[0]).toBe('08:00');
    expect(options[options.length - 1]).toBe('16:00');
    expect(options).toHaveLength(9);
  });

  test('today hides start times that already passed', () => {
    const options = buildStartOptions({ date: '2026-10-23', durationHours: 2, now });
    expect(options).not.toContain('08:00');
    expect(options).not.toContain('10:00');
    expect(options[0]).toBe('11:00');
  });

  test('starts are grouped like the website form', () => {
    const groups = groupStartOptions(['08:00', '11:00', '12:00', '15:00', '16:00', '20:00']);
    expect(groups.map((g) => g.key)).toEqual(['morning', 'afternoon', 'evening']);
    expect(groups[0].times).toEqual(['08:00', '11:00']);
    expect(groups[1].times).toEqual(['12:00', '15:00']);
    expect(groups[2].times).toEqual(['16:00', '20:00']);
    expect(groupStartOptions([])).toEqual([]);
  });
});
