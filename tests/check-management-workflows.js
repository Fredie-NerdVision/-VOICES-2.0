const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const tables = {
  Staff: [],
  Students: [
    { Id: 'STU-1', Name: 'Student One', CaseManagerEmail: 'manager@example.org', Active: true },
    { Id: 'STU-2', Name: 'Student Two', CaseManagerEmail: 'other@example.org', Active: true },
    { Id: 'STU-OFF', Name: 'Inactive Student', CaseManagerEmail: 'manager@example.org', Active: false }
  ],
  Subjects: [
    { Id: 'SUB-1', Name: 'Math', Active: true },
    { Id: 'SUB-2', Name: 'Communication', Active: true },
    { Id: 'SUB-OFF', Name: 'Inactive', Active: false }
  ],
  Classes: [
    { Id: 'CLASS-1', Name: 'King 13', SubjectId: 'SUB-1', TeacherEmail: 'manager@example.org', PeriodId: 'P1', Active: true },
    { Id: 'CLASS-2', Name: 'Lee 21', SubjectId: 'SUB-2', TeacherEmail: 'other@example.org', PeriodId: 'P2', Active: true }
  ],
  ClassStudents: [
    { ClassId: 'CLASS-1', StudentId: 'STU-1' },
    { ClassId: 'CLASS-2', StudentId: 'STU-2' }
  ],
  Goals: [
    { Id: 'GOAL-1', StudentId: 'STU-1', Active: true, Status: 'ACTIVE' }
  ],
  Benchmarks: [
    { Id: 'BENCH-1', GoalId: 'GOAL-1', StudentId: 'STU-1', SubjectId: 'SUB-1', Active: true },
    { Id: 'BENCH-2', GoalId: 'GOAL-1', StudentId: 'STU-1', SubjectId: 'SUB-1', Active: false }
  ],
  BenchmarkSubjects: [
    { BenchmarkId: 'BENCH-1', SubjectId: 'SUB-1' },
    { BenchmarkId: 'BENCH-2', SubjectId: 'SUB-1' }
  ],
  ObservationDrafts: [],
  BenchmarkEntries: []
};
let currentStaff = {
  Email: 'manager@example.org',
  Role: 'CASE_MANAGER',
  IsAdmin: false,
  Active: true
};
let nextId = 1;
const invalidations = [];
const rows = name => (tables[name] || []).map((row, index) => ({ ...row, _row: index + 2 }));
const context = {
  console,
  VOICES: {
    ROLES: { AIDE: 'AIDE', TEACHER: 'TEACHER', CASE_MANAGER: 'CASE_MANAGER' },
    PROMPT_LEVELS: ['Independent', 'Verbal', 'Gestural/Visual', 'Model', 'Physical'],
    GOAL_ARCHETYPES: ['DISCRETE_TRIAL', 'PROMPT_FADE', 'TASK_EXPANSION', 'FREQUENCY_QUOTA'],
    EVALUATION_WINDOW_UNITS: ['SESSION', 'DATA_DAY', 'TWO_WEEK', 'GRADING_PERIOD']
  },
  VOICES_INDEX_CACHE: null,
  rows_: rows,
  activeRows_: name => rows(name).filter(row =>
    row.Active === undefined || row.Active === '' || row.Active === true
  ),
  findOne_: (name, predicate) => rows(name).find(predicate) || null,
  indexBy_: (items, key) => items.reduce((index, item) => {
    index[item[key]] = item;
    return index;
  }, {}),
  normalizeEmail_: value => String(value || '').trim().toLowerCase(),
  toBoolean_: value => value === true || String(value).toLowerCase() === 'true',
  toNumber_: value => Number(value) || 0,
  sanitizeText_: (value, max) => String(value || '').trim().slice(0, max),
  assertRequired_(payload, fields) {
    fields.forEach(field => {
      if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
        throw new Error(field + ' is required.');
      }
    });
  },
  requireCaseManager_: () => currentStaff,
  requireAuthorizedStaff_: () => currentStaff,
  getCurrentUserEmail_: () => currentStaff.Email,
  withRowsCache_: callback => callback(),
  uuid_: () => 'ID-' + nextId++,
  invalidateRowsCache_: () => {},
  invalidateAppDataCache_: scope => invalidations.push(scope),
  replaceRowsUnlocked_(name, predicate, replacements) {
    tables[name] = tables[name].filter((row, index) =>
      !predicate({ ...row, _row: index + 2 })
    ).concat((replacements || []).map(row => ({ ...row })));
  },
  updateRow_(name, rowNumber, patch) {
    Object.assign(tables[name][rowNumber - 2], patch);
  },
  LockService: {
    getScriptLock() {
      return {
        tryLock: () => true,
        releaseLock() {}
      };
    }
  }
};
vm.createContext(context);
[
  'AdminService.gs',
  'GoalService.gs',
  'BenchmarkService.gs'
].forEach(name => vm.runInContext(read(name), context, { filename: name }));

const ownedRoster = context.getClassRosterData_(currentStaff);
if (ownedRoster.classes.length !== 1 || ownedRoster.classes[0].id !== 'CLASS-1') {
  throw new Error('A case manager can see a roster outside their assigned teaching classes.');
}
context.saveClassRoster({ classId: 'CLASS-1', studentIds: ['STU-1', 'STU-2', 'STU-2'] });
const classOneStudents = tables.ClassStudents
  .filter(row => row.ClassId === 'CLASS-1')
  .map(row => row.StudentId);
if (classOneStudents.join(',') !== 'STU-1,STU-2') {
  throw new Error('Roster replacement did not deduplicate or preserve selected students.');
}
let rosterDenied = false;
try {
  context.saveClassRoster({ classId: 'CLASS-2', studentIds: ['STU-1'] });
} catch (error) {
  rosterDenied = /only edit rosters/.test(error.message);
}
if (!rosterDenied) throw new Error('Unauthorized roster editing was not denied.');
let inactiveDenied = false;
try {
  context.saveClassRoster({ classId: 'CLASS-1', studentIds: ['STU-OFF'] });
} catch (error) {
  inactiveDenied = /inactive or unknown student/.test(error.message);
}
if (!inactiveDenied) throw new Error('Inactive students were accepted into a roster.');
currentStaff = {
  Email: 'admin@example.org',
  Role: 'CASE_MANAGER',
  IsAdmin: true,
  Active: true
};
if (context.getClassRosterData_(currentStaff).classes.length !== 2) {
  throw new Error('An administrator cannot see every active class roster.');
}
context.saveClassRoster({ classId: 'CLASS-2', studentIds: ['STU-2'] });

currentStaff = {
  Email: 'manager@example.org',
  Role: 'CASE_MANAGER',
  IsAdmin: false,
  Active: true
};
context.updateGoalSubjects({ goalId: 'GOAL-1', subjectIds: ['SUB-2', 'SUB-1', 'SUB-2'] });
if (tables.Benchmarks.some(row => row.SubjectId !== 'SUB-2')) {
  throw new Error('Goal relevance did not update every benchmark primary subject.');
}
const relationships = tables.BenchmarkSubjects
  .map(row => row.BenchmarkId + ':' + row.SubjectId)
  .sort();
if (relationships.join(',') !==
    'BENCH-1:SUB-1,BENCH-1:SUB-2,BENCH-2:SUB-1,BENCH-2:SUB-2') {
  throw new Error('Goal relevance did not replace every benchmark subject relationship.');
}
let inactiveSubjectDenied = false;
try {
  context.updateGoalSubjects({ goalId: 'GOAL-1', subjectIds: ['SUB-1', 'SUB-OFF'] });
} catch (error) {
  inactiveSubjectDenied = /inactive or unknown/.test(error.message);
}
if (!inactiveSubjectDenied) throw new Error('Inactive goal relevance subjects were accepted.');
let emptySubjectsDenied = false;
try {
  context.updateGoalSubjects({ goalId: 'GOAL-1', subjectIds: [] });
} catch (error) {
  emptySubjectsDenied = /at least one relevant/.test(error.message);
}
if (!emptySubjectsDenied) throw new Error('An empty goal relevance selection was accepted.');
currentStaff = {
  Email: 'other@example.org',
  Role: 'CASE_MANAGER',
  IsAdmin: false,
  Active: true
};
let goalDenied = false;
try {
  context.updateGoalSubjects({ goalId: 'GOAL-1', subjectIds: ['SUB-1'] });
} catch (error) {
  goalDenied = /assigned students/.test(error.message);
}
if (!goalDenied) throw new Error('Unauthorized goal relevance editing was not denied.');

currentStaff = {
  Email: 'aide@example.org',
  Role: 'AIDE',
  IsAdmin: false,
  Active: true
};
const draftEntry = {
  benchmarkId: 'BENCH-1',
  classId: 'CLASS-1',
  observationDate: '2026-09-04',
  correct: 1,
  attempts: 1,
  actualPromptLevel: 'Independent',
  actualPromptCount: 0
};
context.saveObservationDraft({
  submissionBatchId: 'DRAFT-1',
  entries: [draftEntry]
});
const recovered = context.getObservationDraft();
if (recovered.submissionBatchId !== 'DRAFT-1' || recovered.entries.length !== 1) {
  throw new Error('A valid observation draft was not recovered.');
}
tables.ObservationDrafts[0].PayloadJson = '{bad json';
const malformed = context.getObservationDraft();
if (malformed.entries.length || malformed.submissionBatchId) {
  throw new Error('A malformed observation draft was restored.');
}
context.saveObservationDraft({
  submissionBatchId: 'DRAFT-2',
  entries: [draftEntry]
});
context.clearObservationDraft('DRAFT-2');
if (context.getObservationDraft().entries.length) {
  throw new Error('Observation draft cleanup failed.');
}
if (!invalidations.includes('all') || !invalidations.includes('student')) {
  throw new Error('Roster or relevance cache invalidation is missing.');
}

console.log('Management and draft workflows passed:', JSON.stringify({
  rosterStudents: classOneStudents.length,
  goalRelationships: relationships.length,
  malformedDraftEntries: malformed.entries.length
}));
