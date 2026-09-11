const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const scheduleService = fs.readFileSync(path.join(projectRoot, 'ScheduleService.gs'), 'utf8');

function createContext(seed) {
  const tables = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [name, rows.map(row => ({ ...row }))])
  );
  let nextId = 1;
  const context = {
    console,
    VOICES: { ROLES: { AIDE: 'AIDE' } },
    rows_: name => (tables[name] || []).map(row => ({ ...row })),
    activeRows_: name => (tables[name] || [])
      .filter(row => row.Active !== false)
      .map(row => ({ ...row })),
    normalizeEmail_: value => String(value || '').trim().toLowerCase(),
    formatDate_: value => String(value || '').slice(0, 10),
    uniqueBy_(rows, keyFn) {
      const seen = {};
      return rows.filter(row => {
        const key = keyFn(row);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
      });
    },
    indexBy_(rows, key) {
      return rows.reduce((map, row) => {
        map[String(row[key])] = row;
        return map;
      }, {});
    },
    replaceRows_(name, predicate, replacements) {
      tables[name] = (tables[name] || []).filter(row => !predicate(row))
        .concat(replacements.map(row => ({ ...row })));
    },
    appendRow_(name, row) {
      tables[name] = tables[name] || [];
      tables[name].push({ ...row });
    },
    caseManagerEmails_: () => ['manager@example.org'],
    sendEmail_: () => {},
    uuid_: () => 'NEW-' + nextId++,
    tables
  };
  vm.createContext(context);
  vm.runInContext(scheduleService, context);
  vm.runInContext(`
    ensureDayScheduleMaterialized_ = () => 'DAY-1';
    isAideAvailableForPeriod_ = email => normalizeEmail_(email) !== 'absent@example.org';
    isOneToOneStudent_ = studentId => String(studentId).startsWith('STU-');
  `, context);
  return context;
}

function findAssignment(rows, aideEmail, periodId = 'P1') {
  return rows.find(row => row.AideEmail === aideEmail && row.PeriodId === periodId);
}

function runReconciliation(context) {
  return vm.runInContext(
    `reconcileCallOffDay_('absent@example.org', '2026-09-01')`,
    context
  );
}

const floatContext = createContext({
  Staff: [
    { Email: 'absent@example.org', Role: 'AIDE', Active: true },
    { Email: 'retained@example.org', Role: 'AIDE', Active: true },
    { Email: 'float@example.org', Role: 'AIDE', Active: true },
    { Email: 'classroom@example.org', Role: 'AIDE', Active: true }
  ],
  AideTraining: [
    { AideEmail: 'absent@example.org', StudentId: 'STU-A' },
    { AideEmail: 'float@example.org', StudentId: 'STU-A' },
    { AideEmail: 'classroom@example.org', StudentId: 'STU-A' },
    { AideEmail: 'retained@example.org', StudentId: 'STU-B' }
  ],
  Assignments: [
    {
      Id: 'ABSENT',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'absent@example.org',
      ClassId: 'CLASS-A',
      StudentId: 'STU-A',
      Duty: '1:1 Support',
      Note: '',
      Type: 'ONE_TO_ONE'
    },
    {
      Id: 'RETAINED',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'retained@example.org',
      ClassId: 'CLASS-B',
      StudentId: 'STU-B',
      Duty: '1:1 Support',
      Note: 'Existing pairing',
      Type: 'ONE_TO_ONE'
    },
    {
      Id: 'FLOAT',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'float@example.org',
      ClassId: '',
      StudentId: '',
      Duty: '',
      Note: '',
      Type: 'STANDARD'
    },
    {
      Id: 'CLASSROOM',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'classroom@example.org',
      ClassId: 'CLASS-C',
      StudentId: '',
      Duty: 'Classroom support',
      Note: '',
      Type: 'STANDARD'
    }
  ],
  Notifications: []
});

const floatResult = runReconciliation(floatContext);
const floatAssignments = floatContext.tables.Assignments;
const absentAfter = findAssignment(floatAssignments, 'absent@example.org');
const retainedAfter = findAssignment(floatAssignments, 'retained@example.org');
const replacementAfter = findAssignment(floatAssignments, 'float@example.org');
const classroomAfter = findAssignment(floatAssignments, 'classroom@example.org');

if (floatResult.status !== 'RECONCILED') throw new Error('Float replacement should reconcile.');
if (absentAfter.Type !== 'OFF' || absentAfter.ClassId || absentAfter.StudentId) {
  throw new Error('Absent aide was not fully marked OFF.');
}
if (replacementAfter.StudentId !== 'STU-A' || replacementAfter.ClassId !== 'CLASS-A') {
  throw new Error('Replacement did not retain the absent student class.');
}
if (retainedAfter.StudentId !== 'STU-B' ||
    retainedAfter.ClassId !== 'CLASS-B' ||
    retainedAfter.Note !== 'Existing pairing') {
  throw new Error('Valid existing 1:1 pairing was changed.');
}
if (classroomAfter.Duty !== 'Classroom support' || floatResult.displacedAssignments.length) {
  throw new Error('A classroom aide was displaced despite an available float aide.');
}

const chainContext = createContext({
  Staff: [
    { Email: 'absent@example.org', Role: 'AIDE', Active: true },
    { Email: 'aide-b@example.org', Role: 'AIDE', Active: true },
    { Email: 'aide-c@example.org', Role: 'AIDE', Active: true },
    { Email: 'classroom@example.org', Role: 'AIDE', Active: true },
    { Email: 'retained@example.org', Role: 'AIDE', Active: true }
  ],
  AideTraining: [
    { AideEmail: 'absent@example.org', StudentId: 'STU-A' },
    { AideEmail: 'aide-b@example.org', StudentId: 'STU-A' },
    { AideEmail: 'aide-b@example.org', StudentId: 'STU-B' },
    { AideEmail: 'aide-c@example.org', StudentId: 'STU-B' },
    { AideEmail: 'aide-c@example.org', StudentId: 'STU-C' },
    { AideEmail: 'classroom@example.org', StudentId: 'STU-C' },
    { AideEmail: 'retained@example.org', StudentId: 'STU-D' }
  ],
  Assignments: [
    {
      Id: 'ABSENT',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'absent@example.org',
      ClassId: 'CLASS-A',
      StudentId: 'STU-A',
      Duty: '1:1 Support',
      Note: '',
      Type: 'ONE_TO_ONE'
    },
    {
      Id: 'B',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'aide-b@example.org',
      ClassId: 'CLASS-B',
      StudentId: 'STU-B',
      Duty: '1:1 Support',
      Note: '',
      Type: 'ONE_TO_ONE'
    },
    {
      Id: 'C',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'aide-c@example.org',
      ClassId: 'CLASS-C',
      StudentId: 'STU-C',
      Duty: '1:1 Support',
      Note: '',
      Type: 'ONE_TO_ONE'
    },
    {
      Id: 'CLASSROOM',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'classroom@example.org',
      ClassId: 'CLASS-X',
      StudentId: '',
      Duty: 'Classroom support',
      Note: '',
      Type: 'STANDARD'
    },
    {
      Id: 'RETAINED',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'retained@example.org',
      ClassId: 'CLASS-D',
      StudentId: 'STU-D',
      Duty: '1:1 Support',
      Note: 'Do not move',
      Type: 'ONE_TO_ONE'
    }
  ],
  Notifications: []
});

const chainResult = runReconciliation(chainContext);
const chainAssignments = chainContext.tables.Assignments;
if (chainResult.status !== 'RECONCILED') throw new Error('Shortest replacement chain should reconcile.');
if (findAssignment(chainAssignments, 'aide-b@example.org').StudentId !== 'STU-A' ||
    findAssignment(chainAssignments, 'aide-b@example.org').ClassId !== 'CLASS-A' ||
    findAssignment(chainAssignments, 'aide-c@example.org').StudentId !== 'STU-B' ||
    findAssignment(chainAssignments, 'aide-c@example.org').ClassId !== 'CLASS-B' ||
    findAssignment(chainAssignments, 'classroom@example.org').StudentId !== 'STU-C' ||
    findAssignment(chainAssignments, 'classroom@example.org').ClassId !== 'CLASS-C') {
  throw new Error('Replacement chain did not preserve student class context.');
}
if (findAssignment(chainAssignments, 'retained@example.org').StudentId !== 'STU-D' ||
    findAssignment(chainAssignments, 'retained@example.org').Note !== 'Do not move') {
  throw new Error('Unrelated valid 1:1 pairing was changed by the replacement chain.');
}
if (chainResult.displacedAssignments.length !== 1 ||
    chainResult.displacedAssignments[0].aideEmail !== 'classroom@example.org' ||
    !chainResult.message.includes('CLASS-X') ||
    !chainResult.message.includes('CLASS-C')) {
  throw new Error('Displaced classroom coverage was not reported.');
}

const unresolvedContext = createContext({
  Staff: [
    { Email: 'absent@example.org', Role: 'AIDE', Active: true },
    { Email: 'retained@example.org', Role: 'AIDE', Active: true }
  ],
  AideTraining: [
    { AideEmail: 'absent@example.org', StudentId: 'STU-A' },
    { AideEmail: 'retained@example.org', StudentId: 'STU-B' }
  ],
  Assignments: [
    {
      Id: 'ABSENT',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'absent@example.org',
      ClassId: 'CLASS-A',
      StudentId: 'STU-A',
      Duty: '1:1 Support',
      Note: '',
      Type: 'ONE_TO_ONE'
    },
    {
      Id: 'RETAINED',
      DayScheduleId: 'DAY-1',
      Date: '2026-09-01',
      PeriodId: 'P1',
      AideEmail: 'retained@example.org',
      ClassId: 'CLASS-B',
      StudentId: 'STU-B',
      Duty: '1:1 Support',
      Note: 'Keep this assignment',
      Type: 'ONE_TO_ONE'
    }
  ],
  Notifications: []
});

const unresolvedResult = runReconciliation(unresolvedContext);
const unresolvedAssignments = unresolvedContext.tables.Assignments;
if (unresolvedResult.status !== 'UNRESOLVED') throw new Error('Missing replacement should be unresolved.');
if (findAssignment(unresolvedAssignments, 'absent@example.org').Type !== 'OFF') {
  throw new Error('Unresolved call-off did not persist OFF state.');
}
if (findAssignment(unresolvedAssignments, 'retained@example.org').StudentId !== 'STU-B' ||
    findAssignment(unresolvedAssignments, 'retained@example.org').Note !== 'Keep this assignment') {
  throw new Error('Unresolved call-off disturbed an unaffected pairing.');
}
if (unresolvedContext.tables.Notifications.length !== 1 ||
    !unresolvedContext.tables.Notifications[0].Message.includes('P1: STU-A')) {
  throw new Error('Unresolved notification did not identify the absent student.');
}

const invalidValidation = vm.runInContext(`
  validateOneToOnePeriodPlan_(
    [{ studentId: 'STU-A', classId: 'CLASS-A' }],
    [{
      AideEmail: 'float@example.org',
      ClassId: 'WRONG-CLASS',
      StudentId: 'STU-A',
      Duty: '1:1 Support',
      Type: 'ONE_TO_ONE'
    }],
    'absent@example.org',
    ['float@example.org']
  )
`, floatContext);
if (invalidValidation.ok ||
    !invalidValidation.errors.some(error => error.includes('wrong class'))) {
  throw new Error('Post-reconciliation validation did not reject a wrong-class assignment.');
}

console.log('Call-off reconciliation behavior passed:', JSON.stringify({
  floatReplacement: replacementAfter.AideEmail,
  retainedPairing: retainedAfter.AideEmail,
  chainLength: 3,
  displacedAssignments: chainResult.displacedAssignments.length,
  unresolvedStudent: 'STU-A'
}));
