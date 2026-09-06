const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');

const context = {
  console,
  Utilities: {
    formatDate(date, _zone, pattern) {
      const pad = value => String(value).padStart(2, '0');
      if (pattern === 'MMMM d, yyyy') {
        return new Intl.DateTimeFormat('en-US', {
          month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
        }).format(date);
      }
      const base = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
      return pattern === 'yyyy-MM-dd' ? base :
        `${base}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
    }
  },
  VOICES: {
    TIME_ZONE: 'UTC',
    DATABASE_PROPERTY: 'VOICES_DATABASE_ID',
    ROLES: { AIDE: 'AIDE', TEACHER: 'TEACHER', CASE_MANAGER: 'CASE_MANAGER' }
  },
  formatDate_(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return context.Utilities.formatDate(date, 'UTC', 'yyyy-MM-dd');
  },
  formatDateTime_(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return context.Utilities.formatDate(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ss");
  },
  parseDate_(value) {
    const parts = String(value).split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
  },
  toBoolean_(value) {
    return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
  },
  toNumber_(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : (fallback || 0);
  },
  weekStart_(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : context.parseDate_(value);
    const day = date.getUTCDay();
    date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
    return context.formatDate_(date);
  },
  weekDates_(value) {
    const start = context.parseDate_(value);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start.getTime());
      date.setUTCDate(start.getUTCDate() + index);
      return context.formatDate_(date);
    });
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(projectRoot, 'DemoData.gs'), 'utf8'), context);

const code = `
(() => {
  const random = demoRandom_(VOICES_DEMO.SEED);
  const staff = buildDemoStaff_('owner@example.org', 'example.org');
  const managers = staff.filter(row => row.Role === VOICES.ROLES.CASE_MANAGER && row.Email !== 'owner@example.org');
  const aides = staff.filter(row => row.Role === VOICES.ROLES.AIDE);
  const subjects = {
    Math: 'SUB-MATH',
    'English Language Arts': 'SUB-ELA',
    Science: 'SUB-SCIENCE',
    'Social Studies': 'SUB-SOCIAL',
    'Life Skills': 'SUB-LIFE',
    Communication: 'SUB-COMM',
    Behavior: 'SUB-BEHAVIOR',
    Transition: 'SUB-TRANSITION'
  };
  const periods = [
    ['P1', '08:00', '08:50'], ['P2', '08:55', '09:45'], ['P3', '09:50', '10:40'],
    ['P4', '10:45', '11:35'], ['LUNCH', '11:35', '12:05'], ['P5', '12:10', '13:00'],
    ['P6', '13:05', '13:55'], ['P7', '14:00', '14:50']
  ].map((row, index) => ({
    ScheduleTypeId: 'DEFAULT', PeriodId: row[0], Label: row[0],
    StartTime: row[1], EndTime: row[2], SortOrder: index + 1
  }));
  const instructional = periods.filter(row => row.PeriodId !== 'LUNCH');
  const classes = buildDemoClasses_(managers, subjects, instructional);
  const classesByManager = managers.reduce((map, manager) => {
    map[manager.Email] = classes.filter(row => row.TeacherEmail === manager.Email);
    return map;
  }, {});
  const students = buildDemoStudents_(random, managers);
  const studentClasses = {};
  students.forEach((student, index) => {
    const options = classesByManager[student.CaseManagerEmail];
    studentClasses[student.Id] = [0, 1, 2, 3].map(offset => options[(index + offset) % options.length]);
  });
  const ieps = {};
  students.forEach((student, index) => {
    ieps[student.Id] = {
      StudentId: student.Id,
      StartDate: formatDate_(new Date(Date.UTC(2025, 10, 1 + (index % 20)))),
      EndDate: formatDate_(new Date(Date.UTC(2026, 10, 1 + (index % 20))))
    };
  });
  const today = new Date(Date.UTC(2026, 7, 30, 12));
  const goals = buildDemoGoals_(random, students, studentClasses, classes, subjects, ieps, today);
  const trainedAides = students.reduce((map, student) => {
    map[student.Id] = aides.slice(0, 3);
    return map;
  }, {});
  const schedule = buildDemoSchedule_(
    random,
    aides,
    classes,
    instructional,
    periods.find(row => row.PeriodId === 'LUNCH'),
    { Id: 'DEFAULT' },
    students,
    studentClasses,
    trainedAides,
    today
  );
  if (schedule.daySchedules.length !== 5 ||
      schedule.schedulePeriods.length !== periods.length * 6) {
    throw new Error('Generated daily schedules are missing period definitions.');
  }
  const goalsByStudent = {};
  goals.goals.forEach(goal => {
    goalsByStudent[goal.StudentId] = (goalsByStudent[goal.StudentId] || 0) + 1;
  });
  const benchmarksByGoal = {};
  const activeByGoal = {};
  const benchmarkRowsByGoal = {};
  goals.benchmarks.forEach(benchmark => {
    benchmarksByGoal[benchmark.GoalId] = (benchmarksByGoal[benchmark.GoalId] || 0) + 1;
    benchmarkRowsByGoal[benchmark.GoalId] = benchmarkRowsByGoal[benchmark.GoalId] || [];
    benchmarkRowsByGoal[benchmark.GoalId].push(benchmark);
    if (benchmark.Active) activeByGoal[benchmark.GoalId] = (activeByGoal[benchmark.GoalId] || 0) + 1;
    if (!/3 out of 4/i.test(benchmark.Description)) throw new Error('Benchmark ratio is not parser compatible.');
    if (benchmark.TargetAccuracyPct !== undefined && benchmark.TargetAccuracyPct !== '') {
      throw new Error('Consistency ratio was incorrectly stored as an accuracy target.');
    }
    if (benchmark.ConsistencyTrialsPassed !== 3 || benchmark.ConsistencyTrialsWindow !== 4) {
      throw new Error('Benchmark consistency metadata is incomplete.');
    }
  });
  students.forEach(student => {
    const count = goalsByStudent[student.Id];
    if (count < 3 || count > 5) throw new Error('Student goal count is outside 3-5.');
  });
  goals.goals.forEach(goal => {
    if (benchmarksByGoal[goal.Id] !== 3) throw new Error('Goal does not have exactly three benchmarks.');
    if (activeByGoal[goal.Id] !== 1) throw new Error('Goal does not have exactly one active benchmark.');
    if (goal.BenchmarkActivationMode !== 'DATE') {
      throw new Error('Demo goal does not use date-driven benchmark activation.');
    }
    const ordered = benchmarkRowsByGoal[goal.Id]
      .slice()
      .sort((a, b) => a.OrderIndex - b.OrderIndex);
    if (ordered.map(row => row.OrderIndex).join(',') !== '1,2,3') {
      throw new Error('Demo benchmark order is not 1,2,3.');
    }
    if (ordered.slice(1).some((row, index) =>
      row.StartDate <= ordered[index].DueDate
    )) {
      throw new Error('Demo benchmark date ranges overlap.');
    }
    if (ordered[0].GoalArchetype !== 'PROMPT_FADE' ||
        ordered[1].GoalArchetype !== 'PROMPT_FADE' ||
        ordered[2].GoalArchetype !== 'DISCRETE_TRIAL') {
      throw new Error('Demo benchmark phase archetypes are incomplete.');
    }
  });
  const aidesByClass = Object.fromEntries(classes.map(classRow => [
    classRow.Id,
    aides.slice(0, 3)
  ]));
  const entries = buildDemoEntries_(
    random,
    goals.benchmarks,
    studentClasses,
    aidesByClass,
    students,
    today
  );
  const benchmarkById = Object.fromEntries(goals.benchmarks.map(row => [row.Id, row]));
  entries.forEach(entry => {
    const benchmark = benchmarkById[entry.BenchmarkId];
    if (entry.ObservationDate < benchmark.StartDate ||
        entry.ObservationDate > benchmark.DueDate ||
        entry.ObservationDate > formatDate_(today)) {
      throw new Error('Demo entry is outside its benchmark date range.');
    }
    if (!entry.ActualPromptLevel || entry.ActualPromptCount === undefined) {
      throw new Error('Demo entry is missing prompt data.');
    }
  });
  if (!entries.some(entry => !benchmarkById[entry.BenchmarkId].Active)) {
    throw new Error('Demo entries do not include a recent historical benchmark phase.');
  }
  const propertyValues = {
    VOICES_DATABASE_ID: 'DEMO-ID',
    VOICES_DEMO_DATABASE_ID: 'DEMO-ID'
  };
  PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => propertyValues[key] || '',
      setProperty: (key, value) => { propertyValues[key] = value; }
    })
  };
  let spreadsheetName = VOICES_DEMO.DATABASE_NAME;
  SpreadsheetApp = {
    openById: id => ({
      getId: () => id,
      getName: () => spreadsheetName
    }),
    create: () => { throw new Error('Existing demo spreadsheet should be reused.'); }
  };
  if (demoDatabaseSpreadsheet_().getId() !== 'DEMO-ID') {
    throw new Error('Configured personal training database could not be refreshed.');
  }
  spreadsheetName = 'Production Database';
  let refusedProduction = false;
  try {
    demoDatabaseSpreadsheet_();
  } catch (error) {
    refusedProduction = /Refusing to write training data/.test(error.message);
  }
  if (!refusedProduction) {
    throw new Error('Demo refresh did not protect a non-training live database.');
  }
  const capacities = Object.fromEntries(aides.map(aide => [aide.FirstName, aide.WeeklyHours]));
  const expected = {
    Liane: 30, Maci: 29, Marcos: 29, Nick: 29, Katie: 29, Melanie: 29, Judy: 29,
    Kaitlin: 29, Kimberly: 19, Angelina: 19, Casey: 19, Yvette: 19, Caroline: 19,
    Fredie: 19, David: 19
  };
  Object.keys(expected).forEach(name => {
    if (capacities[name] !== expected[name]) throw new Error('Capacity mismatch for ' + name);
  });
  if (staff.filter(row => row.Email === 'owner@example.org').length !== 1 ||
      staff.filter(row => row.FirstName === 'Fredie' && row.Role === VOICES.ROLES.AIDE).length !== 1) {
    throw new Error('Owner and Fredie aide records are not separate.');
  }
  return {
    staff: staff.length,
    managers: managers.length,
    aides: aides.length,
    students: students.length,
    classes: classes.length,
    goals: goals.goals.length,
    benchmarks: goals.benchmarks.length,
    entries: entries.length
  };
})()
`;

const result = vm.runInContext(code, context);
console.log('Demo generator behavior passed:', JSON.stringify(result));
