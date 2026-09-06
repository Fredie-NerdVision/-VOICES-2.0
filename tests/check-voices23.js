const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const database = read('Database.gs');
const benchmarkService = read('BenchmarkService.gs');
const goalService = read('GoalService.gs');
const scheduleService = read('ScheduleService.gs');
const html = read('Index.html');
const iepService = read('IEPService.gs');
const adminService = read('AdminService.gs');
const code = read('Code.gs');

[
  'GoalPhaseHistory',
  'AideDailyHours',
  'TargetPromptLevel',
  'ActualPromptLevel',
  'SubmissionBatchId',
  'SubmissionFingerprint',
  'CorrectionOfEntryId',
  'ImportBatchId',
  'ImportFingerprint',
  'EndedBy',
  'Revision'
].forEach(value => {
  if (!database.includes(value)) throw new Error('Missing 2.3 schema field: ' + value);
});
if (!database.includes('function upgradeVoices23Database()')) {
  throw new Error('The 2.3 migration entry point is missing.');
}
if (!benchmarkService.includes('tryLock(25000)') ||
    !benchmarkService.includes("code: 'WRITE_BUSY'") ||
    !benchmarkService.includes('getCompletedObservationBatch_') ||
    !benchmarkService.includes('observationBatchFingerprint_')) {
  throw new Error('Observation batching is missing locking or idempotency safeguards.');
}
if (!benchmarkService.includes("String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE'") ||
    !benchmarkService.includes('The historical benchmark does not belong to this student and goal.') ||
    !benchmarkService.includes("if (!correctionReason) throw new Error('A correction reason is required.')")) {
  throw new Error('Observation summaries, historical phases, or correction audits are not hardened.');
}
if (!/function getStudentsForClass[\s\S]*?assertObservationClassAccess_\(staff, classRow\)/.test(benchmarkService) ||
    !/function lookupBenchmarks[\s\S]*?assertObservationClassAccess_\(staff, classRow\)/.test(benchmarkService) ||
    !benchmarkService.includes('canUseAnyObservationClass_(staffMember)') ||
    !benchmarkService.includes("? activeRows_('Classes')")) {
  throw new Error('Benchmark lookup does not allow authorized cross-class observation entry.');
}
if (!scheduleService.includes("code: 'STALE_SCHEDULE'") ||
    !scheduleService.includes('LunchMinutes') ||
    !scheduleService.includes('shiftOverlapLabel_') ||
    !scheduleService.includes('replaceRowsUnlocked_') ||
    !database.includes('function replaceRowsUnlocked_')) {
  throw new Error('Schedule revision, lunch, or overlap support is missing.');
}
if (!/function isAideAvailableForPeriod_[\s\S]*?getEffectiveDailyHours_[\s\S]*?shiftOverlapLabel_/.test(scheduleService)) {
  throw new Error('Call-off replacements do not honor effective date-specific shift overlap.');
}
if (!code.includes('function requireAdmin_()') ||
    !adminService.includes('function previewAdminCatalogBatch(payload)') ||
    !adminService.includes('function saveAdminCatalogBatch(payload)') ||
    !adminService.includes('tryLock(25000)') ||
    !adminService.includes("teacherEmail + '|' + periodId") ||
    !adminService.includes('Subject must match an existing or batched subject name.') ||
    !html.includes('id="adminCatalogDialog"') ||
    !html.includes("server('previewAdminCatalogBatch'") ||
    !html.includes("server('saveAdminCatalogBatch'")) {
  throw new Error('Admin subject/class batching is missing authorization, review, or retry safeguards.');
}
if (/\bconfirm\s*\(/.test(html) || /\bprompt\s*\(/.test(html)) {
  throw new Error('Native browser confirmation or prompt dialogs remain.');
}
[
  'aria-modal',
  'dialog._dialogTrap',
  'element.inert = true',
  'Choose school Google account',
  'data-goal-visibility',
  'previewBulkObservations_',
  'previewBulkGoals_',
  'downloadObservationQueue_',
  'window.print()'
].forEach(value => {
  if (!html.includes(value)) throw new Error('Missing 2.3 client behavior: ' + value);
});
if (!html.includes('Goal saving is busy. Your form is still intact') ||
    !html.includes('queuedItem.phaseDateResolution') ||
    !html.includes('importBatchId: clientUuid()') ||
    !html.includes('const form = event.currentTarget') ||
    !html.includes('form.reset()')) {
  throw new Error('Client retry state is not preserved for goals or observations.');
}
if (/await server\('callOff'[\s\S]{0,300}event\.currentTarget/.test(html) ||
    /await server\('submitTimeOffRequest'[\s\S]{0,300}event\.currentTarget/.test(html)) {
  throw new Error('A submit handler reads event.currentTarget after an async server call.');
}
if (!html.includes('[hidden] { display: none !important; }') ||
    !html.includes('benchmarks.find(benchmark => benchmark.active)') ||
    !html.includes('Manage other benchmarks') ||
    !goalService.includes("Category: 'Benchmark ' + (index + 1)")) {
  throw new Error('Benchmark wording, active-only display, or dialog controls regressed.');
}
if (!goalService.includes('goalImportFingerprint_') ||
    !goalService.includes("code: 'IMPORT_MISMATCH'") ||
    !goalService.includes('.filter(isActiveGoal_)') ||
    !goalService.includes("EndReason: 'Goal deactivated'")) {
  throw new Error('Goal import idempotency or lifecycle safeguards are missing.');
}
if (!iepService.includes('mastery targets not fully recorded') ||
    !iepService.includes('statement.statement') ||
    !iepService.includes('.filter(isActiveGoal_)') ||
    !iepService.includes(
      'normalizeEmail_(row.Email) === normalizeEmail_(student.CaseManagerEmail)'
    )) {
  throw new Error('IEP export is not null-safe, progress-aware, or access-scoped.');
}
if (!database.includes("'BenchmarkActivationMode'") ||
    !database.includes("Key: 'SchoolQuarterBoundaries'") ||
    !goalService.includes('function selectDateDrivenBenchmark_') ||
    !goalService.includes('function nextSchoolQuarterBoundary_') ||
    !goalService.includes("Source: 'MANUAL_OVERRIDE'") ||
    !goalService.includes('function checkMissingBenchmarkObservations()') ||
    !adminService.includes('function installMissingBenchmarkObservationTrigger()') ||
    !html.includes('id="quarterBoundaryForm"') ||
    !html.includes('data-phase-start') ||
    !html.includes('data-phase-due')) {
  throw new Error('Date-driven benchmark activation, quarter overrides, or monitoring is incomplete.');
}
if (!html.includes('activeEntryAverage') ||
    !html.includes('entryBadgeClass') ||
    !benchmarkService.includes('Benchmark observation overdue') ||
    !benchmarkService.includes('function applicationBenchmarkText_') ||
    !benchmarkService.includes("'Benchmark ' + orderIndex + ': '") ||
    !html.includes('Benchmark ${escapeHtml(String(history.orderIndex') ||
    html.includes('STO ${escapeHtml(String(history.orderIndex') ||
    html.includes("slice(0, 34)")) {
  throw new Error('Entry-count badges or benchmark chart cleanup is incomplete.');
}

const tables = {
  GoalPhaseHistory: [
    { Id: 'H1', GoalId: 'G1', BenchmarkId: 'B1', ActivatedAt: '2026-08-01', EndedAt: '2026-09-01' },
    { Id: 'H2', GoalId: 'G1', BenchmarkId: 'B2', ActivatedAt: '2026-09-01', EndedAt: '' },
    { Id: 'H3', GoalId: 'G2', BenchmarkId: 'B3', ActivatedAt: '2026-08-01', EndedAt: '2026-09-10', EndReason: 'Goal deactivated' }
  ]
};
const context = {
  console,
  VOICES: {
    PROMPT_LEVELS: ['Independent', 'Verbal', 'Gestural/Visual', 'Model', 'Physical']
  },
  sanitizeText_: (value, max) => String(value || '').trim().slice(0, max),
  optionalNumber_(value) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  },
  toNumber_: value => Number(value) || 0,
  toBoolean_: value => value === true || String(value).toLowerCase() === 'true',
  formatDate_: value => String(value || '').slice(0, 10),
  rows_: name => (tables[name] || []).map(row => ({ ...row })),
  findOne_: (name, predicate) =>
    (tables[name] || []).map(row => ({ ...row })).find(predicate) || null
};
vm.createContext(context);
vm.runInContext(goalService, context);

const result = vm.runInContext(`
(() => {
  const parsed = parseGoalObjectives_(
    'Phase 1: State address 4 out of 5 times with 2 verbal prompts for 3 sessions.\\n' +
    'Benchmark 2: State address and phone independently at 80% accuracy.'
  );
  if (parsed.length !== 2) throw new Error('Variable phase parsing failed.');
  if (parsed[0].targetAccuracyPct !== 80 || parsed[0].targetPromptLevel !== 'Verbal' ||
      parsed[0].targetPromptCount !== 2 || parsed[0].targetConsecutiveSessions !== 3) {
    throw new Error('Ratio, prompt, or consecutive-session parsing failed.');
  }
  if (parsed[1].targetAccuracyPct !== 80 || parsed[1].targetPromptLevel !== 'Independent' ||
      parsed[1].targetPromptCount !== 0) {
    throw new Error('Percentage or independent prompt parsing failed.');
  }
  const noPhases = parseGoalObjectives_('');
  if (noPhases.length !== 0) throw new Error('Zero-phase goals are not supported.');

  const benchmark = {
    Id: 'B2',
    Active: true,
    TaskDemandDescription: 'State address',
    TargetAccuracyPct: 80,
    TargetPromptLevel: 'Verbal',
    TargetPromptCount: 1,
    TargetConsecutiveSessions: 3
  };
  const entries = [
    { Id: 'E1', BenchmarkId: 'B2', ObservationDate: '2026-09-01', Correct: 4, Attempts: 5, Percent: 80, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' },
    { Id: 'E2', BenchmarkId: 'B2', ObservationDate: '2026-09-02', Correct: 9, Attempts: 10, Percent: 90, ActualPromptLevel: 'Independent', ActualPromptCount: 0, Status: 'ACTIVE' },
    { Id: 'E3', BenchmarkId: 'B2', ObservationDate: '2026-09-03', Correct: 3, Attempts: 4, Percent: 75, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' }
  ];
  const mastery = summarizeBenchmarkMastery_(benchmark, entries);
  if (!mastery.available || mastery.consecutiveSessionsMet !== 0 || mastery.mastered) {
    throw new Error('Consecutive mastery reset failed.');
  }
  const mastered = summarizeBenchmarkMastery_(benchmark, entries.concat([
    { Id: 'E4', BenchmarkId: 'B2', ObservationDate: '2026-09-04', Percent: 80, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' },
    { Id: 'E5', BenchmarkId: 'B2', ObservationDate: '2026-09-05', Percent: 85, ActualPromptLevel: 'Independent', ActualPromptCount: 0, Status: 'ACTIVE' },
    { Id: 'E6', BenchmarkId: 'B2', ObservationDate: '2026-09-06', Percent: 90, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' }
  ]));
  if (!mastered.mastered || mastered.consecutiveSessionsMet !== 3) {
    throw new Error('Accuracy and prompt-based mastery failed.');
  }
  const unavailable = summarizeBenchmarkMastery_({ ...benchmark, TargetPromptCount: '' }, entries);
  if (unavailable.available) throw new Error('Incomplete targets should make mastery unavailable.');
  const sameDate = summarizeBenchmarkMastery_(
    { ...benchmark, TargetConsecutiveSessions: 3 },
    [
      { ObservationDate: '2026-09-10', Percent: 80, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' },
      { ObservationDate: '2026-09-10', Percent: 90, ActualPromptLevel: 'Independent', ActualPromptCount: 0, Status: 'ACTIVE' },
      { ObservationDate: '2026-09-10', Percent: 85, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' }
    ]
  );
  if (sameDate.mastered || sameDate.consecutiveSessionsMet !== 1) {
    throw new Error('Multiple observations on one date counted as separate mastery sessions.');
  }
  if (isActiveGoal_({ Active: false, Status: 'DRAFT' }) ||
      isActiveGoal_({ Active: false, Status: 'COMPLETED' }) ||
      !isActiveGoal_({ Active: true, Status: 'ACTIVE' })) {
    throw new Error('Goal lifecycle filtering failed.');
  }

  const metrics = summarizeGoalEntries_(entries, [benchmark]);
  if (metrics.currentPhaseLastThreeAccuracy !== 84.2) {
    throw new Error('Latest-three combined trial accuracy failed: ' + metrics.currentPhaseLastThreeAccuracy);
  }
  if (!metrics.highestIndependence || metrics.highestIndependence.promptLevel !== 'Independent') {
    throw new Error('Highest qualifying independence failed.');
  }
  if (getPhaseForObservationDate_('G1', '2026-08-15').BenchmarkId !== 'B1' ||
      getPhaseForObservationDate_('G1', '2026-09-15').BenchmarkId !== 'B2') {
    throw new Error('Observation-date phase chronology failed.');
  }
  if (getPhaseForObservationDate_('G2', '2026-09-10').BenchmarkId !== 'B3' ||
      getPhaseForObservationDate_('G2', '2026-09-11') !== null) {
    throw new Error('Goal deactivation boundary handling failed.');
  }
  return { phases: parsed.length, latestThree: metrics.currentPhaseLastThreeAccuracy };
})()
`, context);

console.log('V.O.I.C.E.S 2.3 behavior passed:', JSON.stringify(result));
