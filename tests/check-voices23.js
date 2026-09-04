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

[
  'GoalPhaseHistory',
  'AideDailyHours',
  'TargetPromptLevel',
  'ActualPromptLevel',
  'SubmissionBatchId',
  'SubmissionFingerprint',
  'CorrectionOfEntryId',
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
if (!/function getStudentsForClass[\s\S]*?assertClassAccess_\(staff, classRow\)/.test(benchmarkService) ||
    !/function lookupBenchmarks[\s\S]*?assertClassAccess_\(staff, classRow\)/.test(benchmarkService) ||
    !benchmarkService.includes('getBenchmarkLookupContext_(staffMember, currentAssignment)')) {
  throw new Error('Benchmark lookup does not enforce staff class access.');
}
if (!scheduleService.includes("code: 'STALE_SCHEDULE'") ||
    !scheduleService.includes('LunchMinutes') ||
    !scheduleService.includes('shiftOverlapLabel_') ||
    !scheduleService.includes('replaceRowsUnlocked_') ||
    !database.includes('function replaceRowsUnlocked_')) {
  throw new Error('Schedule revision, lunch, or overlap support is missing.');
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
if (!iepService.includes('mastery targets not fully recorded') ||
    !iepService.includes('statement.statement') ||
    !iepService.includes(
      'normalizeEmail_(row.Email) === normalizeEmail_(student.CaseManagerEmail)'
    )) {
  throw new Error('IEP export is not null-safe, progress-aware, or access-scoped.');
}

const tables = {
  GoalPhaseHistory: [
    { Id: 'H1', GoalId: 'G1', BenchmarkId: 'B1', ActivatedAt: '2026-08-01', EndedAt: '2026-09-01' },
    { Id: 'H2', GoalId: 'G1', BenchmarkId: 'B2', ActivatedAt: '2026-09-01', EndedAt: '' }
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
  rows_: name => (tables[name] || []).map(row => ({ ...row }))
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
  return { phases: parsed.length, latestThree: metrics.currentPhaseLastThreeAccuracy };
})()
`, context);

console.log('V.O.I.C.E.S 2.3 behavior passed:', JSON.stringify(result));
