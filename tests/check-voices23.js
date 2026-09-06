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
    !benchmarkService.includes("replace(") ||
    !html.includes('Benchmark ${escapeHtml(String(history.orderIndex') ||
    html.includes('STO ${escapeHtml(String(history.orderIndex') ||
    html.includes("slice(0, 34)")) {
  throw new Error('Entry-count badges or benchmark chart cleanup is incomplete.');
}
[
  "'GoalArchetype'",
  "'TargetPromptCeiling'",
  "'ConsistencyTrialsPassed'",
  "'ConsistencyTrialsWindow'",
  "'EvaluationWindowUnit'"
].forEach(field => {
  if (!database.includes(field)) throw new Error('Missing benchmark schema field ' + field);
});
if (!goalService.includes('function benchmarkMasteryConfig_') ||
    !goalService.includes('function evaluateMasteryWindows_') ||
    !html.includes("label: 'Prompt count (lower is better)'") ||
    !html.includes("label: 'Recorded occurrences / quota progress'") ||
    /chart\.js|recharts|plotly/i.test(html)) {
  throw new Error('Archetype mastery or pure SVG metric panels are incomplete.');
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
    PROMPT_LEVELS: ['Independent', 'Verbal', 'Gestural/Visual', 'Model', 'Physical'],
    GOAL_ARCHETYPES: ['DISCRETE_TRIAL', 'PROMPT_FADE', 'TASK_EXPANSION', 'FREQUENCY_QUOTA'],
    EVALUATION_WINDOW_UNITS: ['SESSION', 'DATA_DAY', 'TWO_WEEK', 'GRADING_PERIOD']
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
  parseDate_: value => new Date(String(value).slice(0, 10) + 'T12:00:00'),
  settingsMap_: () => ({ SchoolQuarterBoundaries: '[]' }),
  rows_: name => (tables[name] || []).map(row => ({ ...row })),
  findOne_: (name, predicate) =>
    (tables[name] || []).map(row => ({ ...row })).find(predicate) || null
};
vm.createContext(context);
vm.runInContext(goalService, context);

const result = vm.runInContext(`
(() => {
  const parsed = parseGoalObjectives_(
    'Phase 1: State address in 4 out of 5 opportunities with 2 verbal prompts for 3 sessions.\\n' +
    'Benchmark 2: State street address and phone number independently at 80% accuracy.'
  );
  if (parsed.length !== 2) throw new Error('Variable phase parsing failed.');
  if (parsed[0].targetAccuracyPct !== null ||
      parsed[0].consistencyTrialsPassed !== 4 ||
      parsed[0].consistencyTrialsWindow !== 5 ||
      parsed[0].targetPromptLevel !== 'Verbal' ||
      parsed[0].targetPromptCeiling !== 2 ||
      parsed[0].targetConsecutiveSessions !== 3 ||
      parsed[0].goalArchetype !== 'PROMPT_FADE') {
    throw new Error('Consistency, prompt, archetype, or consecutive parsing failed.');
  }
  if (parsed[1].targetAccuracyPct !== 80 || parsed[1].targetPromptLevel !== 'Independent' ||
      parsed[1].targetPromptCeiling !== 0 ||
      parsed[1].goalArchetype !== 'TASK_EXPANSION') {
    throw new Error('Percentage or independent prompt parsing failed.');
  }
  const frequency = parseObjectiveRecord_(
    'Complete the checklist on 4 of 5 school days per grading period.',
    0
  );
  if (frequency.goalArchetype !== 'FREQUENCY_QUOTA' ||
      frequency.targetAccuracyPct !== null ||
      frequency.consistencyTrialsPassed !== 4 ||
      frequency.consistencyTrialsWindow !== 5 ||
      frequency.evaluationWindowUnit !== 'GRADING_PERIOD') {
    throw new Error('Frequency-quota parsing failed.');
  }
  const rangedPrompt = parseObjectiveRecord_(
    'Initiate the task given 1-2 visual prompts over 3 consecutive data days.',
    0
  );
  if (rangedPrompt.targetPromptCeiling !== 2 ||
      rangedPrompt.evaluationWindowUnit !== 'DATA_DAY' ||
      rangedPrompt.targetConsecutiveSessions !== 3) {
    throw new Error('Prompt range or data-day parsing failed.');
  }
  const noPhases = parseGoalObjectives_('');
  if (noPhases.length !== 0) throw new Error('Zero-phase goals are not supported.');

  const benchmark = {
    Id: 'B2',
    Active: true,
    TaskDemandDescription: 'State address',
    GoalArchetype: 'DISCRETE_TRIAL',
    TargetAccuracyPct: 80,
    TargetPromptLevel: 'Verbal',
    TargetPromptCeiling: 1,
    ConsistencyTrialsPassed: 4,
    ConsistencyTrialsWindow: 5,
    EvaluationWindowUnit: 'SESSION',
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
    { Id: 'E4', BenchmarkId: 'B2', ObservationDate: '2026-09-04', Correct: 4, Attempts: 5, Percent: 80, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' },
    { Id: 'E5', BenchmarkId: 'B2', ObservationDate: '2026-09-05', Correct: 9, Attempts: 10, Percent: 90, ActualPromptLevel: 'Independent', ActualPromptCount: 0, Status: 'ACTIVE' },
    { Id: 'E6', BenchmarkId: 'B2', ObservationDate: '2026-09-06', Correct: 5, Attempts: 5, Percent: 100, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' }
  ]));
  if (!mastered.mastered || mastered.consecutiveSessionsMet !== 3) {
    throw new Error('Accuracy and prompt-based mastery failed.');
  }
  const unavailable = summarizeBenchmarkMastery_({
    GoalArchetype: 'DISCRETE_TRIAL',
    TargetConsecutiveSessions: 1,
    EvaluationWindowUnit: 'SESSION'
  }, entries);
  if (unavailable.available) throw new Error('Incomplete targets should make mastery unavailable.');
  const sameDate = summarizeBenchmarkMastery_(
    { ...benchmark, TargetConsecutiveSessions: 3 },
    [
      { ObservationDate: '2026-09-10', Correct: 4, Attempts: 5, Percent: 80, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' },
      { ObservationDate: '2026-09-10', Correct: 9, Attempts: 10, Percent: 90, ActualPromptLevel: 'Independent', ActualPromptCount: 0, Status: 'ACTIVE' },
      { ObservationDate: '2026-09-10', Correct: 5, Attempts: 5, Percent: 100, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' }
    ]
  );
  if (sameDate.mastered || sameDate.consecutiveSessionsMet !== 1) {
    throw new Error('Multiple observations on one date counted as separate mastery sessions.');
  }
  const promptFade = summarizeBenchmarkMastery_({
    GoalArchetype: 'PROMPT_FADE',
    TargetPromptLevel: 'Verbal',
    TargetPromptCeiling: 1,
    TargetConsecutiveSessions: 2,
    EvaluationWindowUnit: 'SESSION'
  }, [
    { ObservationDate: '2026-09-01', Correct: 1, Attempts: 1, ActualPromptLevel: 'Verbal', ActualPromptCount: 2, Status: 'ACTIVE' },
    { ObservationDate: '2026-09-02', Correct: 1, Attempts: 1, ActualPromptLevel: 'Verbal', ActualPromptCount: 1, Status: 'ACTIVE' },
    { ObservationDate: '2026-09-03', Correct: 1, Attempts: 1, ActualPromptLevel: 'Independent', ActualPromptCount: 0, Status: 'ACTIVE' }
  ]);
  if (!promptFade.mastered || promptFade.consecutiveSessionsMet !== 2) {
    throw new Error('Prompt-fade mastery failed.');
  }
  const frequencyMastery = summarizeBenchmarkMastery_({
    GoalArchetype: 'FREQUENCY_QUOTA',
    ConsistencyTrialsPassed: 4,
    ConsistencyTrialsWindow: 5,
    TargetConsecutiveSessions: 1,
    EvaluationWindowUnit: 'DATA_DAY'
  }, [1, 1, 0, 1, 1].map((correct, index) => ({
    ObservationDate: '2026-09-0' + (index + 1),
    Correct: correct,
    Attempts: 1,
    Status: 'ACTIVE'
  })));
  if (!frequencyMastery.mastered || frequencyMastery.recordedSessions !== 1) {
    throw new Error('Frequency-quota rolling-window mastery failed.');
  }
  const duplicateDayQuota = summarizeBenchmarkMastery_({
    GoalArchetype: 'FREQUENCY_QUOTA',
    StartDate: '2026-09-01',
    ConsistencyTrialsPassed: 4,
    ConsistencyTrialsWindow: 5,
    TargetConsecutiveSessions: 1,
    EvaluationWindowUnit: 'TWO_WEEK'
  }, [
    ['2026-09-01', 1],
    ['2026-09-01', 1],
    ['2026-09-02', 1],
    ['2026-09-03', 0],
    ['2026-09-04', 1],
    ['2026-09-05', 0]
  ].map((item, index) => ({
    Id: 'Q' + index,
    ObservationDate: item[0],
    Correct: item[1],
    Attempts: 1,
    Status: 'ACTIVE'
  })));
  if (duplicateDayQuota.mastered) {
    throw new Error('Duplicate binary entries inflated qualifying-day mastery.');
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
