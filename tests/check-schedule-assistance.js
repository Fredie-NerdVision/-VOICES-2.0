const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

const tables = {
  Staff: [
    { Email: 'approved@example.org', FirstName: 'Approved', LastName: 'Off', Role: 'AIDE', Active: true },
    { Email: 'pending@example.org', FirstName: 'Pending', LastName: 'Off', Role: 'AIDE', Active: true },
    { Email: 'partial@example.org', FirstName: 'Partial', LastName: 'Hours', Role: 'AIDE', Active: true },
    { Email: 'availability@example.org', FirstName: 'Pending', LastName: 'Availability', Role: 'AIDE', Active: true }
  ],
  TimeOffRequests: [
    { AideEmail: 'approved@example.org', StartDate: '2026-09-01', EndDate: '2026-09-01', Type: 'Sick', Status: 'APPROVED' },
    { AideEmail: 'pending@example.org', StartDate: '2026-09-01', EndDate: '2026-09-01', Type: 'Personal', Status: 'PENDING' }
  ],
  Availability: [
    { AideEmail: 'partial@example.org', DayOfWeek: 'TUESDAY', Available: true, StartTime: '08:30', EndTime: '12:00', Status: 'APPROVED' },
    { AideEmail: 'availability@example.org', DayOfWeek: 'TUESDAY', Available: false, Status: 'PENDING' }
  ]
};

const context = {
  console,
  Utilities: {
    formatDate(date, _zone, pattern) {
      if (pattern === 'EEEE') {
        return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(date);
      }
      return date.toISOString().slice(0, 10);
    }
  },
  VOICES: { TIME_ZONE: 'UTC', ROLES: { AIDE: 'AIDE' } },
  rows_: name => (tables[name] || []).map(row => ({ ...row })),
  activeRows_: name => (tables[name] || []).filter(row => row.Active !== false).map(row => ({ ...row })),
  normalizeEmail_: value => String(value || '').trim().toLowerCase(),
  normalizeTime_: value => String(value || '').slice(0, 5),
  toBoolean_: value => value === true || String(value).toLowerCase() === 'true',
  formatDate_: value => typeof value === 'string' ? value.slice(0, 10) : value.toISOString().slice(0, 10),
  parseDate_(value) {
    const parts = String(value).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
  },
  dateInRange_(date, start, end) {
    return String(date) >= String(start).slice(0, 10) && String(date) <= String(end).slice(0, 10);
  }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'ScheduleService.gs'), 'utf8'), context);

const result = vm.runInContext(`
(() => {
  const date = '2026-09-01';
  const statuses = getScheduleStaffingStatus_(date);
  const byEmail = statuses.reduce((map, item) => {
    map[item.email] = item;
    return map;
  }, {});
  if (!byEmail['approved@example.org'].approvedTimeOff) throw new Error('Approved time off was not exposed.');
  if (!byEmail['pending@example.org'].pendingTimeOff) throw new Error('Pending time off was not exposed.');
  if (!byEmail['partial@example.org'].approvedAvailability) throw new Error('Approved availability was not exposed.');
  if (!byEmail['availability@example.org'].pendingAvailability) throw new Error('Pending availability was not exposed.');

  const unavailable = getUnavailableAidesForDate_(date);
  if (unavailable.length !== 1 || unavailable[0].email !== 'approved@example.org') {
    throw new Error('Pending requests incorrectly blocked scheduling.');
  }

  const period = { StartTime: '08:00', EndTime: '09:00' };
  const approved = getAideConflict_('approved@example.org', date, period);
  const pending = getAideConflict_('pending@example.org', date, period);
  const partial = getAideConflict_('partial@example.org', date, period);
  const pendingAvailability = getAideConflict_('availability@example.org', date, period);
  if (!approved.startsWith('Approved time off')) throw new Error('Approved request conflict is incorrect.');
  if (!pending.startsWith('Pending time off request')) throw new Error('Pending request warning is incorrect.');
  if (partial !== 'Outside approved hours') throw new Error('Partial availability conflict is incorrect.');
  if (pendingAvailability !== 'Pending availability request') throw new Error('Pending availability warning is incorrect.');
  return { unavailable: unavailable.length, approved, pending, partial, pendingAvailability };
})()
`, context);

console.log('Schedule assistance behavior passed:', JSON.stringify(result));
