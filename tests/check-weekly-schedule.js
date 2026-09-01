const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

const tables = {
  Staff: [
    { Id: 'A1', Email: 'aide@example.org', FirstName: 'Aide', LastName: 'One', Role: 'AIDE', Active: true, WeeklyHours: 6 }
  ],
  ScheduleTypes: [{ Id: 'DEFAULT', Name: 'Default Day', IsDefault: true, Active: true }],
  SchedulePeriods: [
    { ScheduleTypeId: 'DEFAULT', PeriodId: 'P1', Label: 'Period 1', StartTime: '08:00', EndTime: '09:00', SortOrder: 1 },
    { ScheduleTypeId: 'DEFAULT', PeriodId: 'P2', Label: 'Period 2', StartTime: '08:30', EndTime: '10:00', SortOrder: 2 },
    { ScheduleTypeId: 'SATURDAY', PeriodId: 'P1', Label: 'Period 1', StartTime: '08:00', EndTime: '09:00', SortOrder: 1 }
  ],
  DaySchedules: [{ Id: 'SATURDAY', Date: '2026-09-05', Name: 'Saturday Event', BaseScheduleTypeId: 'DEFAULT', Status: 'ACTIVE' }],
  Assignments: [
    { Id: 'T1', DayScheduleId: 'DEFAULT', Date: '', PeriodId: 'P1', AideEmail: 'aide@example.org', Duty: 'Class support', Type: 'STANDARD' },
    { Id: 'T2', DayScheduleId: 'DEFAULT', Date: '', PeriodId: 'P2', AideEmail: 'aide@example.org', Duty: 'Overlapping support', Type: 'STANDARD' },
    { Id: 'S1', DayScheduleId: 'SATURDAY', Date: '2026-09-05', PeriodId: 'P1', AideEmail: 'aide@example.org', Duty: 'Saturday event', Type: 'STANDARD' }
  ],
  Students: [],
  Classes: [],
  Availability: [],
  TimeOffRequests: [],
  Settings: [{ Key: 'ScheduleWeekdays', Value: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY' }]
};

const pad = value => String(value).padStart(2, '0');
const formatDate = date =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const context = {
  console,
  Utilities: {
    formatDate(date, _zone, pattern) {
      if (pattern === 'EEEE') {
        return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date);
      }
      return formatDate(date);
    }
  },
  VOICES: { TIME_ZONE: 'UTC', ROLES: { AIDE: 'AIDE', CASE_MANAGER: 'CASE_MANAGER' } },
  VOICES_INDEX_CACHE: {},
  rows_: name => (tables[name] || []).map(row => ({ ...row })),
  activeRows_: name => (tables[name] || []).filter(row => row.Active === undefined || row.Active === true).map(row => ({ ...row })),
  findOne_: (name, predicate) => (tables[name] || []).find(predicate) || null,
  formatDate_(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return formatDate(new Date(value));
  },
  parseDate_(value) {
    const parts = String(value).split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
  },
  toBoolean_: value => value === true || String(value).toLowerCase() === 'true' || String(value) === '1',
  toNumber_(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  },
  normalizeEmail_: value => String(value || '').trim().toLowerCase(),
  normalizeTime_: value => String(value || '').slice(0, 5),
  sanitizeText_: (value, maxLength) => String(value || '').trim().slice(0, maxLength),
  publicStaff_: row => ({
    id: row.Id,
    email: row.Email,
    displayName: `${row.FirstName} ${row.LastName}`.trim(),
    role: row.Role,
    weeklyHours: row.WeeklyHours
  }),
  indexBy_(rows, key) {
    return rows.reduce((map, row) => {
      map[row[key]] = row;
      return map;
    }, {});
  },
  settingsMap_() {
    return tables.Settings.reduce((map, row) => {
      map[row.Key] = row.Value;
      return map;
    }, {});
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'ScheduleService.gs'), 'utf8'), context);

const result = vm.runInContext(`
(() => {
  const indexes = buildWeeklyScheduleIndexes_();
  const weekdays = scheduleWeekdays_();
  const monday = resolveWeeklyScheduleDay_('2026-08-31', indexes, weekdays);
  const saturday = resolveWeeklyScheduleDay_('2026-09-05', indexes, weekdays);
  const sunday = resolveWeeklyScheduleDay_('2026-09-06', indexes, weekdays);
  if (monday.source !== 'TEMPLATE') throw new Error('Weekday did not use template fallback.');
  if (saturday.source !== 'DAY') throw new Error('Explicit weekend schedule was not counted.');
  if (sunday.source !== 'NONE') throw new Error('Template incorrectly inflated an unconfigured weekend.');
  const summary = summarizeWeeklySchedule_(
    [monday, monday, monday, monday, monday, saturday, sunday],
    indexes.aides.map(publicStaff_)
  );
  const aide = summary.aides[0];
  if (aide.assignedHours !== 11) {
    throw new Error('Overlap union or weekend total is incorrect: ' + aide.assignedHours);
  }
  if (aide.status !== 'OVER' || aide.deltaHours !== 5) {
    throw new Error('Capacity status is incorrect.');
  }
  const draft = publicDraftScheduleDay_(
    '2026-08-31',
    [
      { periodId: 'P1', label: 'Period 1', startTime: '08:00', endTime: '09:00', sortOrder: 1 },
      { periodId: 'P2', label: 'Period 2', startTime: '08:30', endTime: '10:00', sortOrder: 2 }
    ],
    [
      { periodId: 'P1', aideEmail: 'aide@example.org', duty: 'Support', type: 'STANDARD' },
      { periodId: 'P2', aideEmail: 'aide@example.org', duty: 'OFF', type: 'OFF' }
    ]
  );
  const draftHours = scheduledHoursForAide_(draft, 'aide@example.org');
  if (draftHours !== 1) throw new Error('OFF rows were included in draft hours.');
  const lunchDay = publicDraftScheduleDay_(
    '2026-08-31',
    [
      { periodId: 'P1', label: 'Morning', startTime: '08:00', endTime: '12:00', sortOrder: 1 },
      { periodId: 'P2', label: 'Afternoon', startTime: '12:00', endTime: '14:00', sortOrder: 2 }
    ],
    [
      { periodId: 'P1', aideEmail: 'aide@example.org', duty: 'Support', type: 'STANDARD' },
      { periodId: 'P2', aideEmail: 'aide@example.org', duty: 'Support', type: 'STANDARD' }
    ]
  );
  const lunchHours = scheduledHoursForAide_(lunchDay, 'aide@example.org');
  if (lunchHours !== 5.5) throw new Error('Six-hour day did not deduct a half-hour lunch.');
  return { monday: monday.source, saturday: saturday.source, sunday: sunday.source, hours: aide.assignedHours };
})()
`, context);

console.log('Weekly schedule behavior passed:', JSON.stringify(result));
