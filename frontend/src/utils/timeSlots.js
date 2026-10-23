// Start-time options shared by the booking form.
//
// Mirrors the website booking form (H:/Festive_Cook/frontend/src/components/
// BookingForm.jsx): the service day runs 08:00–20:00, customers pick a whole
// hour, and the end time is derived from the chosen duration. Times that
// would end after 20:00 — or that already passed today — are not offered.

export const SERVICE_START_MIN = 8 * 60;
export const SERVICE_END_MIN = 20 * 60;
export const SERVICE_STEP_MINUTES = 60;
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 4;

export const hmToMinutes = (time) => {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

export const minutesToHM = (totalMinutes) => {
  const mins = Number(totalMinutes);
  if (!Number.isFinite(mins) || mins < 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const localDayStr = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const isValidDuration = (durationHours) => {
  const hours = Number(durationHours);
  return (
    Number.isInteger(hours) &&
    hours >= MIN_DURATION_HOURS &&
    hours <= MAX_DURATION_HOURS
  );
};

// "11:00" + 2 -> "13:00"; returns "" when the duration is invalid or the
// session would run past the 8 pm service close.
export const deriveEndTime = (startTime, durationHours) => {
  const start = hmToMinutes(startTime);
  if (start == null || !isValidDuration(durationHours)) return '';
  const end = start + Number(durationHours) * 60;
  if (end > SERVICE_END_MIN) return '';
  return minutesToHM(end);
};

// Whole-hour start options for the selected date + duration.
// `now` is injectable so the rule can be tested without freezing time.
export const buildStartOptions = ({ date, durationHours, now = new Date() } = {}) => {
  if (!isValidDuration(durationHours)) return [];
  const durationMin = Number(durationHours) * 60;
  const day = String(date || '');
  const today = localDayStr(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const options = [];
  for (let start = SERVICE_START_MIN; start <= SERVICE_END_MIN; start += SERVICE_STEP_MINUTES) {
    if (start + durationMin > SERVICE_END_MIN) continue;
    if (day && day === today && start < nowMin) continue;
    options.push(minutesToHM(start));
  }
  return options;
};

export const TIME_GROUPS = [
  { key: 'morning', label: 'Morning', hint: '8 am – 12 pm', from: 0, to: 12 },
  { key: 'afternoon', label: 'Afternoon', hint: '12 – 4 pm', from: 12, to: 16 },
  { key: 'evening', label: 'Evening', hint: '4 – 8 pm', from: 16, to: 24 },
];

// Buckets start times exactly like the website: morning < 12, afternoon
// 12–4 pm, evening 4–8 pm. Empty groups are dropped.
export const groupStartOptions = (times = []) =>
  TIME_GROUPS.map((group) => ({
    ...group,
    times: times.filter((time) => {
      const mins = hmToMinutes(time);
      if (mins == null) return false;
      const hour = Math.floor(mins / 60);
      return hour >= group.from && hour < group.to;
    }),
  })).filter((group) => group.times.length > 0);
