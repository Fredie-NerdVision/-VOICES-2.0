const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(projectRoot, 'Index.html'), 'utf8');
const scheduleService = fs.readFileSync(path.join(projectRoot, 'ScheduleService.gs'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
if (!scheduleService.includes('function getScheduleTypeSummaries()') ||
    !html.includes("serverQuiet('getScheduleTypeSummaries')") ||
    !html.includes("serverQuiet('getScheduleBuilderData'") ||
    !/if \(state\.data\.view === 'CASE_MANAGER'\) \{\s*prewarmDefaultSchedule\(\);\s*state\.caseManagerWorkspacePromise/.test(html) ||
    !html.includes("scheduleSelectMarkup_('classId'") ||
    !html.includes("input.addEventListener('focus', () => hydrateScheduleOptions_(input)") ||
    /bindRefreshButtons\(root\);\s*loadScheduleBuilder\(\);/.test(html)) {
  throw new Error('Schedule template loading or non-blocking on-demand schedule loading regressed.');
}
const context = {
  console,
  document: {
    addEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; }
  },
  window: { addEventListener() {} }
};

vm.createContext(context);
vm.runInContext(script, context);

const result = vm.runInContext(`
(() => {
  state.scheduleData = {
    date: '2026-09-01',
    aides: [{ email: 'aide@example.org', weeklyHours: 29 }],
    schedule: {
      periods: [
        { periodId: 'P1', startTime: '08:00', endTime: '12:00' },
        { periodId: 'P2', startTime: '12:00', endTime: '14:00' }
      ],
      assignments: []
    },
    dailyHours: [{
      aideEmail: 'aide@example.org',
      startTime: '08:00',
      endTime: '14:00',
      lunchStartTime: '13:00',
      lunchMinutes: 30
    }],
    week: {
      summary: {
        aides: [{
          email: 'aide@example.org',
          assignedHours: 20,
          byDay: [{ date: '2026-09-01', hours: 4 }]
        }]
      }
    }
  };
  const assignments = [
    { periodId: 'P1', aideEmail: 'aide@example.org', duty: 'Support', type: 'STANDARD' },
    { periodId: 'P2', aideEmail: 'aide@example.org', duty: 'Support', type: 'STANDARD' }
  ];
  const hours = scheduleLiveHoursForAide_('aide@example.org');
  if (hours.dailyHours !== 5.5 || !hours.lunchDeducted) {
    throw new Error('Six-hour day did not deduct a half-hour lunch.');
  }
  if (hours.weeklyHours !== 21.5) {
    throw new Error('Projected weekly hours did not replace the selected day.');
  }
  state.scheduleData.schedule.periods = [{ periodId: 'P1', startTime: '08:00', endTime: '13:00' }];
  state.scheduleData.dailyHours = [{
    aideEmail: 'aide@example.org',
    startTime: '08:00',
    endTime: '13:00',
    lunchStartTime: '',
    lunchMinutes: 0
  }];
  const fiveHours = scheduleLiveHoursForAide_('aide@example.org');
  if (fiveHours.dailyHours !== 5 || fiveHours.lunchDeducted) {
    throw new Error('A five-hour day incorrectly deducted lunch.');
  }
  state.caseManagerDataLoaded = { overview: true };
  state.goalWorkspaceCache = { student: {} };
  state.goalCatalogCache = { setup: {} };
  state.benchmarkEntryCache = { benchmark: {} };
  state.scheduleDataCache = { schedule: {} };
  state.scheduleDataPromises = {};
  state.readModelVersion = 4;
  invalidateClientReadModels('saveBenchmarkEntriesBatch');
  if (state.scheduleDataCache.schedule === undefined ||
      Object.keys(state.goalWorkspaceCache).length ||
      state.readModelVersion !== 4) {
    throw new Error('Observation writes incorrectly invalidated schedule data.');
  }
  state.goalWorkspaceCache = { student: {} };
  invalidateClientReadModels('saveSchedule');
  if (Object.keys(state.scheduleDataCache).length ||
      state.goalWorkspaceCache.student === undefined ||
      state.readModelVersion !== 5) {
    throw new Error('Schedule writes incorrectly invalidated student data.');
  }
  return hours;
})()
`, context);

console.log('Schedule client hours passed:', JSON.stringify(result));
