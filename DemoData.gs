const VOICES_DEMO = Object.freeze({
  DATABASE_PROPERTY: 'VOICES_DEMO_DATABASE_ID',
  DATABASE_NAME: 'V.O.I.C.E.S 2.2 Training Database',
  STUDENTS_PER_CASE_MANAGER: 15,
  CLASSES_PER_CASE_MANAGER: 5,
  CLASSES_PER_STUDENT: 4,
  SEED: 20260929,
  RESET_CONFIRMATION: 'RESET DEMO'
});

const VOICES_DEMO_CASE_MANAGERS = Object.freeze(['Guillen', 'King', 'Chapple', 'Shore', 'Duarte']);
const VOICES_DEMO_CASE_MANAGER_FIRST_NAMES = Object.freeze([
  'Elena', 'Marcus', 'Rebecca', 'Danielle', 'Luis'
]);

const VOICES_DEMO_AIDES = Object.freeze([
  ['Liane', 30],
  ['Maci', 29],
  ['Marcos', 29],
  ['Nick', 29],
  ['Katie', 29],
  ['Melanie', 29],
  ['Judy', 29],
  ['Kaitlin', 29],
  ['Kimberly', 19],
  ['Angelina', 19],
  ['Casey', 19],
  ['Yvette', 19],
  ['Caroline', 19],
  ['Fredie', 19],
  ['David', 19]
]);

const VOICES_DEMO_COURSES = Object.freeze({
  'Math': ['Functional Math', 'Money and Measurement', 'Applied Algebra Skills'],
  'English Language Arts': ['Adapted Literature', 'Reading Foundations', 'Written Expression'],
  'Science': ['Practical Science', 'Life Science Lab'],
  'Social Studies': ['Community and Government', 'World Cultures'],
  'Life Skills': ['Independent Living', 'Community Based Instruction'],
  'Communication': ['Communication Lab', 'Social Communication'],
  'Behavior': ['Self Regulation Skills'],
  'Transition': ['Career Exploration', 'Work Readiness']
});

const VOICES_DEMO_GOAL_TEMPLATES = Object.freeze({
  'English Language Arts': [
    {
      focus: 'Listening Comprehension',
      behavior: 'hear a spoken page (with at least 4 sentences) from a story and then answer related questions correctly',
      source: 'student work samples and teacher collected data',
      skill: 'answer questions about a spoken page from a story',
      alsoRelevant: 'Communication'
    },
    {
      focus: 'Reading Comprehension',
      behavior: 'read an adapted passage and identify the main idea and two supporting details correctly',
      source: 'reading records and teacher collected data',
      skill: 'identify the main idea and two supporting details of an adapted passage',
      alsoRelevant: ''
    },
    {
      focus: 'Written Expression',
      behavior: 'write a complete sentence about a picture or classroom activity correctly',
      source: 'writing samples and teacher collected data',
      skill: 'write a complete sentence about a picture or classroom activity',
      alsoRelevant: 'Communication'
    }
  ],
  'Math': [
    {
      focus: 'Money Math',
      behavior: 'select the correct combination of bills and coins for a purchase under ten dollars correctly',
      source: 'classroom store records and teacher collected data',
      skill: 'select the correct bills and coins for a purchase under ten dollars',
      alsoRelevant: 'Life Skills'
    },
    {
      focus: 'Number Sense',
      behavior: 'solve two-step addition and subtraction problems using a calculator correctly',
      source: 'student work samples and teacher collected data',
      skill: 'solve two-step addition and subtraction problems using a calculator',
      alsoRelevant: ''
    },
    {
      focus: 'Measurement',
      behavior: 'measure ingredients or classroom materials to a stated amount correctly',
      source: 'task analysis records and teacher collected data',
      skill: 'measure materials to a stated amount',
      alsoRelevant: 'Life Skills'
    }
  ],
  'Life Skills': [
    {
      focus: 'Daily Routines',
      behavior: 'complete a four-step classroom or personal care routine in the correct order',
      source: 'task analysis records and teacher collected data',
      skill: 'complete a four-step routine in the correct order',
      alsoRelevant: 'Transition'
    },
    {
      focus: 'Community Skills',
      behavior: 'follow a shopping list of four items and locate each item in the correct aisle',
      source: 'community based instruction logs and teacher collected data',
      skill: 'locate four listed items during community based instruction',
      alsoRelevant: 'Math'
    }
  ],
  'Communication': [
    {
      focus: 'Requesting',
      behavior: 'request a needed item or assistance using the preferred communication system correctly',
      source: 'communication logs and teacher collected data',
      skill: 'request a needed item or assistance using the preferred communication system',
      alsoRelevant: 'Behavior'
    },
    {
      focus: 'Social Communication',
      behavior: 'answer a peer or staff greeting and respond to one follow-up question appropriately',
      source: 'observation records and teacher collected data',
      skill: 'answer a greeting and respond to one follow-up question',
      alsoRelevant: ''
    }
  ],
  'Science': [
    {
      focus: 'Investigation Skills',
      behavior: 'follow a three-step science procedure and record the observed result correctly',
      source: 'laboratory sheets and teacher collected data',
      skill: 'follow a three-step science procedure and record the result',
      alsoRelevant: ''
    }
  ],
  'Social Studies': [
    {
      focus: 'Community Awareness',
      behavior: 'identify a community helper and the service that helper provides correctly',
      source: 'student work samples and teacher collected data',
      skill: 'identify a community helper and the matching service',
      alsoRelevant: 'Life Skills'
    }
  ],
  'Behavior': [
    {
      focus: 'Self Regulation',
      behavior: 'use a taught calming strategy after a first prompt and return to the activity',
      source: 'behavior tracking sheets and teacher collected data',
      skill: 'use a taught calming strategy and return to the activity',
      alsoRelevant: 'Communication'
    }
  ],
  'Transition': [
    {
      focus: 'Work Readiness',
      behavior: 'complete an assigned job task within the scheduled work period correctly',
      source: 'work site checklists and teacher collected data',
      skill: 'complete an assigned job task within the scheduled work period',
      alsoRelevant: 'Life Skills'
    }
  ]
});

const VOICES_DEMO_BENCHMARK_PHASES = Object.freeze([
  'with a model and up to two verbal prompts',
  'with a visual support and no more than one verbal prompt',
  'independently'
]);

const VOICES_DEMO_ENTRY_NOTES = Object.freeze([
  'Worked in a small group at the back table.',
  'Needed a reminder to slow down before answering.',
  'Used the visual support without being asked.',
  'Ran the trials after a schedule change; slower to start.',
  'Stronger session; only one redirection needed.',
  'Accuracy dropped with unfamiliar materials.',
  'Completed the trials during the community based lesson.',
  'Refused the first trial, then finished the rest.',
  'Best session so far; no prompting needed.',
  'Ran trials with a substitute in the room.',
  'Held steady from last week.',
  'Needed the task broken into two parts.'
]);

const VOICES_DEMO_FIRST_NAMES = Object.freeze([
  'Aaliyah', 'Adrian', 'Alejandro', 'Amara', 'Andres', 'Angel', 'Ariana', 'Bianca', 'Brandon', 'Camila',
  'Carlos', 'Daniela', 'Darius', 'Diego', 'Elena', 'Elijah', 'Emiliano', 'Esteban', 'Gabriela', 'Hector',
  'Isabel', 'Ivan', 'Jasmine', 'Javier', 'Jocelyn', 'Jonah', 'Kayla', 'Leo', 'Lucia', 'Malik',
  'Mariana', 'Micah', 'Nadia', 'Nathan', 'Nora', 'Omar', 'Paloma', 'Quinn', 'Rafael', 'Rosa',
  'Samuel', 'Selena', 'Sofia', 'Tomas', 'Trinity', 'Valeria', 'Victor', 'Wesley', 'Ximena', 'Zaid'
]);

const VOICES_DEMO_LAST_NAMES = Object.freeze([
  'Alvarez', 'Barnes', 'Bautista', 'Bennett', 'Cardenas', 'Castillo', 'Cervantes', 'Chavez', 'Contreras', 'Delgado',
  'Escobar', 'Fletcher', 'Fuentes', 'Gallegos', 'Hayes', 'Herrera', 'Ibarra', 'Jimenez', 'Kramer', 'Lozano',
  'Maldonado', 'Mercado', 'Nguyen', 'Okafor', 'Orozco', 'Palmer', 'Quintero', 'Ramos', 'Reyes', 'Rosales',
  'Salazar', 'Santana', 'Serrano', 'Solis', 'Tapia', 'Trujillo', 'Ulloa', 'Vargas', 'Velasquez', 'Whitfield'
]);

function setupVoicesDemoDatabase(options) {
  const spreadsheet = demoDatabaseSpreadsheet_(options);
  Object.keys(SHEET_SCHEMAS).forEach(name => ensureSheet_(spreadsheet, name, SHEET_SCHEMAS[name]));
  const summary = withDatabaseId_(spreadsheet.getId(), () => {
    seedDefaults_();
    return buildDemoDatabase_(spreadsheet);
  });
  formatDatabase_(spreadsheet);
  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    summary: summary,
    message: 'Training database ready. Point a test copy of the project at this spreadsheet id to use it.'
  };
}

function refreshVoicesDemoDatabase() {
  return setupVoicesDemoDatabase();
}

function resetVoicesDemoDatabase(options) {
  options = options || {};
  if (options.confirm !== VOICES_DEMO.RESET_CONFIRMATION) {
    throw new Error('Pass { confirm: "' + VOICES_DEMO.RESET_CONFIRMATION +
      '" } to erase and rebuild the training database.');
  }
  const spreadsheet = demoDatabaseSpreadsheet_(options);
  Object.keys(SHEET_SCHEMAS).forEach(name => {
    ensureSheet_(spreadsheet, name, SHEET_SCHEMAS[name]);
    clearSheetRows_(spreadsheet, name);
  });
  const result = setupVoicesDemoDatabase({ spreadsheetId: spreadsheet.getId() });
  result.message = 'Training database erased and rebuilt.';
  return result;
}

function getVoicesDemoDatabaseInfo() {
  const properties = PropertiesService.getScriptProperties();
  const id = properties.getProperty(VOICES_DEMO.DATABASE_PROPERTY);
  return {
    configured: Boolean(id),
    spreadsheetId: id || '',
    spreadsheetUrl: id ? SpreadsheetApp.openById(id).getUrl() : '',
    liveSpreadsheetId: properties.getProperty(VOICES.DATABASE_PROPERTY) || ''
  };
}

function validateVoicesDemoDatabase() {
  const id = PropertiesService.getScriptProperties().getProperty(VOICES_DEMO.DATABASE_PROPERTY);
  if (!id) throw new Error('Run setupVoicesDemoDatabase() before validating.');
  return withDatabaseId_(id, () => validateDemoContent_());
}

function demoDatabaseSpreadsheet_(options) {
  options = options || {};
  const properties = PropertiesService.getScriptProperties();
  const liveId = properties.getProperty(VOICES.DATABASE_PROPERTY);
  const requestedId = options.spreadsheetId || properties.getProperty(VOICES_DEMO.DATABASE_PROPERTY);
  if (requestedId && liveId && requestedId === liveId) {
    throw new Error('The training database cannot be the live database. Clear the ' +
      VOICES_DEMO.DATABASE_PROPERTY + ' script property and run setup again.');
  }
  const spreadsheet = requestedId
    ? SpreadsheetApp.openById(requestedId)
    : SpreadsheetApp.create(VOICES_DEMO.DATABASE_NAME);
  if (liveId && spreadsheet.getId() === liveId) {
    throw new Error('Refusing to write training data into the live database.');
  }
  properties.setProperty(VOICES_DEMO.DATABASE_PROPERTY, spreadsheet.getId());
  return spreadsheet;
}

function clearSheetRows_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, SHEET_SCHEMAS[name].length).clearContent();
  }
  invalidateRowsCache_(name);
}

function replaceSheetRows_(spreadsheet, name, records) {
  const headers = SHEET_SCHEMAS[name];
  if (!headers) throw new Error('Unknown schema: ' + name);
  clearSheetRows_(spreadsheet, name);
  if (!records.length) return 0;
  const sheet = spreadsheet.getSheetByName(name);
  const needed = records.length + 1;
  if (sheet.getMaxRows() < needed) {
    sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows());
  }
  const values = records.map(record =>
    headers.map(header => (record[header] === undefined ? '' : record[header]))
  );
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  invalidateRowsCache_(name);
  return values.length;
}

function upsertSheetRows_(spreadsheet, name, records, keyFields) {
  if (!records.length) return 0;
  const keyFor = record => keyFields.map(field => String(record[field] || '')).join('\u001f');
  const generated = records.reduce((map, record) => {
    map[keyFor(record)] = record;
    return map;
  }, {});
  const used = {};
  const merged = rows_(name).reduce((result, row) => {
    const key = keyFor(row);
    const replacement = generated[key];
    if (!replacement) {
      result.push(row);
    } else if (!used[key]) {
      result.push(replacement);
      used[key] = true;
      delete generated[key];
    }
    return result;
  }, []);
  Object.keys(generated).forEach(key => merged.push(generated[key]));
  replaceSheetRows_(spreadsheet, name, merged);
  return records.length;
}

function demoRandom_(seed) {
  let state = (seed || 1) >>> 0;
  return function () {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function demoPick_(random, list) {
  return list[Math.floor(random() * list.length)];
}

function demoInt_(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function demoId_(prefix, index) {
  return prefix + '-' + String(1000 + index).slice(1);
}

function demoLongDate_(date) {
  return Utilities.formatDate(date, VOICES.TIME_ZONE, 'MMMM d, yyyy');
}

function buildDemoDatabase_(spreadsheet) {
  const random = demoRandom_(VOICES_DEMO.SEED);
  const ownerEmail = normalizeEmail_(Session.getEffectiveUser().getEmail());
  if (!ownerEmail) throw new Error('A Google account is required to build the training database.');
  const domain = ownerEmail.split('@')[1];
  const today = new Date();
  const shiftDays = days => new Date(today.getTime() + days * 86400000);
  const dateText = days => formatDate_(shiftDays(days));

  const staff = buildDemoStaff_(ownerEmail, domain);
  const caseManagers = staff.filter(row => row.Role === VOICES.ROLES.CASE_MANAGER && row.Email !== ownerEmail);
  const aides = staff.filter(row => row.Role === VOICES.ROLES.AIDE);

  const subjectIds = activeRows_('Subjects').reduce((map, row) => {
    map[row.Name] = row.Id;
    return map;
  }, {});
  const scheduleType = activeRows_('ScheduleTypes').find(row => toBoolean_(row.IsDefault)) ||
    activeRows_('ScheduleTypes')[0];
  if (!scheduleType) throw new Error('A default schedule type is required before building training data.');
  const periods = rows_('SchedulePeriods')
    .filter(row => String(row.ScheduleTypeId) === String(scheduleType.Id))
    .sort((a, b) => toNumber_(a.SortOrder) - toNumber_(b.SortOrder));
  const instructionalPeriods = periods.filter(row => String(row.PeriodId) !== 'LUNCH');
  const lunchPeriod = periods.find(row => String(row.PeriodId) === 'LUNCH');

  const classes = buildDemoClasses_(caseManagers, subjectIds, instructionalPeriods);
  const classesByCaseManager = caseManagers.reduce((map, manager) => {
    map[manager.Email] = classes.filter(row => row.TeacherEmail === manager.Email);
    return map;
  }, {});

  const students = buildDemoStudents_(random, caseManagers);
  const classStudents = [];
  const studentClasses = {};
  students.forEach((student, index) => {
    const managerClasses = classesByCaseManager[student.CaseManagerEmail];
    const enrolled = [];
    for (let slot = 0; slot < VOICES_DEMO.CLASSES_PER_STUDENT; slot += 1) {
      enrolled.push(managerClasses[(index + slot) % managerClasses.length]);
    }
    studentClasses[student.Id] = enrolled;
    enrolled.forEach(classRow => classStudents.push({
      ClassId: classRow.Id,
      StudentId: student.Id
    }));
  });

  const classAides = [];
  const aidesByClass = {};
  classes.forEach((classRow, index) => {
    const assigned = [
      aides[(index * 2) % aides.length],
      aides[(index * 2 + 1) % aides.length],
      aides[(index * 2 + 7) % aides.length]
    ];
    aidesByClass[classRow.Id] = assigned;
    assigned.forEach(aide => classAides.push({
      ClassId: classRow.Id,
      AideEmail: aide.Email
    }));
  });

  const oneToOneStudents = students.filter(student => toBoolean_(student.IsOneToOne));
  const aideTraining = [];
  const trainedAides = {};
  oneToOneStudents.forEach((student, index) => {
    const trained = [
      aides[index % aides.length],
      aides[(index + 4) % aides.length],
      aides[(index + 9) % aides.length]
    ];
    trainedAides[student.Id] = trained;
    trained.forEach(aide => aideTraining.push({
      AideEmail: aide.Email,
      StudentId: student.Id
    }));
  });

  const ieps = students.map((student, index) => ({
    Id: demoId_('IEP', index + 1),
    StudentId: student.Id,
    CaseManagerEmail: student.CaseManagerEmail,
    StartDate: dateText(-330 + (index % 60)),
    EndDate: dateText(35 + (index % 60)),
    Status: 'ACTIVE',
    FileUrl: ''
  }));
  const iepByStudent = ieps.reduce((map, iep) => {
    map[iep.StudentId] = iep;
    return map;
  }, {});

  const goalData = buildDemoGoals_(random, students, studentClasses, classes, subjectIds, iepByStudent, today);
  const entries = buildDemoEntries_(random, goalData.benchmarks, studentClasses, aidesByClass, students, today);

  const schedule = buildDemoSchedule_(
    random,
    aides,
    classes,
    instructionalPeriods,
    lunchPeriod,
    scheduleType,
    students,
    studentClasses,
    trainedAides,
    today
  );

  const availability = buildDemoAvailability_(aides, today);
  const timeOff = buildDemoTimeOff_(aides, caseManagers, dateText, today);
  const timeEntries = buildDemoTimeEntries_(random, aides, today);
  const messages = buildDemoMessages_(caseManagers, dateText, today);

  upsertSheetRows_(spreadsheet, 'Staff', staff, ['Id']);
  upsertSheetRows_(spreadsheet, 'Students', students, ['Id']);
  upsertSheetRows_(spreadsheet, 'Classes', classes, ['Id']);
  upsertSheetRows_(spreadsheet, 'ClassStudents', classStudents, ['ClassId', 'StudentId']);
  upsertSheetRows_(spreadsheet, 'ClassAides', classAides, ['ClassId', 'AideEmail']);
  upsertSheetRows_(spreadsheet, 'AideTraining', aideTraining, ['AideEmail', 'StudentId']);
  upsertSheetRows_(spreadsheet, 'IEPs', ieps, ['Id']);
  upsertSheetRows_(spreadsheet, 'Goals', goalData.goals, ['Id']);
  upsertSheetRows_(spreadsheet, 'Benchmarks', goalData.benchmarks, ['Id']);
  upsertSheetRows_(spreadsheet, 'BenchmarkSubjects', goalData.benchmarkSubjects, ['BenchmarkId', 'SubjectId']);
  upsertSheetRows_(spreadsheet, 'BenchmarkEntries', entries, ['Id']);
  upsertSheetRows_(spreadsheet, 'DaySchedules', schedule.daySchedules, ['Id']);
  upsertSheetRows_(spreadsheet, 'SchedulePeriods', schedule.schedulePeriods, ['ScheduleTypeId', 'PeriodId']);
  upsertSheetRows_(spreadsheet, 'Assignments', schedule.assignments, ['Id']);
  upsertSheetRows_(spreadsheet, 'Availability', availability, ['Id']);
  upsertSheetRows_(spreadsheet, 'TimeOffRequests', timeOff, ['Id']);
  upsertSheetRows_(spreadsheet, 'TimeEntries', timeEntries, ['Id']);
  upsertSheetRows_(spreadsheet, 'Messages', messages, ['Id']);

  const alertSetting = findOne_('Settings', row => row.Key === 'CaseManagerAlertEmails');
  if (alertSetting) {
    updateRow_('Settings', alertSetting._row, { Value: ownerEmail });
  }

  return {
    ownerEmail: ownerEmail,
    staff: staff.length,
    caseManagers: caseManagers.length,
    aides: aides.length,
    students: students.length,
    classes: classes.length,
    goals: goalData.goals.length,
    benchmarks: goalData.benchmarks.length,
    benchmarkEntries: entries.length,
    daySchedules: schedule.daySchedules.length,
    assignments: schedule.assignments.length
  };
}

function buildDemoStaff_(ownerEmail, domain) {
  const staff = [{
    Id: 'STAFF-OWNER',
    Email: ownerEmail,
    FirstName: 'Program',
    LastName: 'Administrator',
    Role: VOICES.ROLES.CASE_MANAGER,
    IsAdmin: true,
    Active: true,
    WeeklyHours: ''
  }];
  const used = { [ownerEmail]: true };
  const uniqueEmail = (base, suffix) => {
    let email = base + '@' + domain;
    if (used[email]) email = base + '.' + suffix + '@' + domain;
    used[email] = true;
    return email;
  };
  VOICES_DEMO_CASE_MANAGERS.forEach((surname, index) => staff.push({
    Id: demoId_('STAFF-CM', index + 1),
    Email: uniqueEmail(surname.toLowerCase(), 'teacher'),
    FirstName: VOICES_DEMO_CASE_MANAGER_FIRST_NAMES[index],
    LastName: surname,
    Role: VOICES.ROLES.CASE_MANAGER,
    IsAdmin: false,
    Active: true,
    WeeklyHours: ''
  }));
  VOICES_DEMO_AIDES.forEach((entry, index) => staff.push({
    Id: demoId_('STAFF-AIDE', index + 1),
    Email: uniqueEmail(entry[0].toLowerCase(), 'aide'),
    FirstName: entry[0],
    LastName: '',
    Role: VOICES.ROLES.AIDE,
    IsAdmin: false,
    Active: true,
    WeeklyHours: entry[1]
  }));
  return staff;
}

function buildDemoClasses_(caseManagers, subjectIds, instructionalPeriods) {
  const subjectNames = Object.keys(VOICES_DEMO_COURSES).filter(name => subjectIds[name]);
  const classes = [];
  caseManagers.forEach((manager, managerIndex) => {
    for (let slot = 0; slot < VOICES_DEMO.CLASSES_PER_CASE_MANAGER; slot += 1) {
      const period = instructionalPeriods[(managerIndex + slot) % instructionalPeriods.length];
      const subjectName = subjectNames[(managerIndex * VOICES_DEMO.CLASSES_PER_CASE_MANAGER + slot) % subjectNames.length];
      const courses = VOICES_DEMO_COURSES[subjectName];
      classes.push({
        Id: demoId_('CLASS', classes.length + 1),
        Name: courses[(managerIndex + slot) % courses.length] + ' - ' + manager.FirstName,
        SubjectId: subjectIds[subjectName],
        TeacherEmail: manager.Email,
        PeriodId: period.PeriodId,
        Active: true,
        subjectName: subjectName
      });
    }
  });
  return classes;
}

function buildDemoStudents_(random, caseManagers) {
  const students = [];
  const used = {};
  caseManagers.forEach((manager, managerIndex) => {
    for (let index = 0; index < VOICES_DEMO.STUDENTS_PER_CASE_MANAGER; index += 1) {
      let name = '';
      do {
        name = demoPick_(random, VOICES_DEMO_FIRST_NAMES) + ' ' + demoPick_(random, VOICES_DEMO_LAST_NAMES);
      } while (used[name]);
      used[name] = true;
      students.push({
        Id: demoId_('STU', students.length + 1),
        Name: name,
        CaseManagerEmail: manager.Email,
        IsOneToOne: (managerIndex + index) % 5 === 0,
        Active: true
      });
    }
  });
  return students;
}

function buildDemoGoals_(random, students, studentClasses, classes, subjectIds, iepByStudent, today) {
  const classById = classes.reduce((map, row) => {
    map[row.Id] = row;
    return map;
  }, {});
  const goals = [];
  const benchmarks = [];
  const benchmarkSubjects = [];
  students.forEach(student => {
    const firstName = String(student.Name).split(' ')[0];
    const iep = iepByStudent[student.Id];
    const iepEnd = parseDate_(iep.EndDate);
    const goalCount = demoInt_(random, 3, 5);
    const enrolled = studentClasses[student.Id];
    const subjectNames = [];
    enrolled.forEach(classRow => {
      const name = classById[classRow.Id].subjectName;
      if (VOICES_DEMO_GOAL_TEMPLATES[name] && subjectNames.indexOf(name) === -1) subjectNames.push(name);
    });
    if (!subjectNames.length) subjectNames.push('Life Skills');
    const usedTemplates = {};
    for (let index = 0; index < goalCount; index += 1) {
      const subjectName = subjectNames[index % subjectNames.length];
      const templates = VOICES_DEMO_GOAL_TEMPLATES[subjectName];
      let template = null;
      for (let attempt = 0; attempt < templates.length; attempt += 1) {
        const candidate = templates[(index + attempt) % templates.length];
        const key = subjectName + '|' + candidate.focus;
        if (!usedTemplates[key]) {
          usedTemplates[key] = true;
          template = candidate;
          break;
        }
      }
      if (!template) template = templates[index % templates.length];
      const goalId = demoId_('GOAL', goals.length + 1);
      const startOffset = -300 + index * 12;
      const startDate = formatDate_(new Date(today.getTime() + startOffset * 86400000));
      goals.push({
        Id: goalId,
        StudentId: student.Id,
        Goal: 'By ' + demoLongDate_(iepEnd) + ', ' + firstName + ' will ' + template.behavior +
          ' on 3 of 4 trials as measured by ' + template.source + '.',
        StartDate: startDate,
        DueDate: iep.EndDate,
        Active: true,
        CreatedBy: student.CaseManagerEmail,
        CreatedAt: formatDateTime_(new Date(today.getTime() + startOffset * 86400000)),
        UpdatedAt: formatDateTime_(new Date(today.getTime() + (startOffset + 5) * 86400000))
      });
      const tags = [subjectIds[subjectName]];
      if (template.alsoRelevant && subjectIds[template.alsoRelevant]) {
        tags.push(subjectIds[template.alsoRelevant]);
      }
      const span = Math.max(60, Math.round((parseDate_(iep.EndDate).getTime() - parseDate_(startDate).getTime()) / 86400000));
      const elapsed = Math.max(0, Math.round((today.getTime() - parseDate_(startDate).getTime()) / 86400000));
      const activePhase = Math.min(2, Math.floor(elapsed / (span / 3)));
      VOICES_DEMO_BENCHMARK_PHASES.forEach((phase, phaseIndex) => {
        const benchmarkId = demoId_('BM', benchmarks.length + 1);
        const benchmarkStart = formatDate_(new Date(parseDate_(startDate).getTime() + Math.round(span * phaseIndex / 3) * 86400000));
        const benchmarkDue = formatDate_(new Date(parseDate_(startDate).getTime() + Math.round(span * (phaseIndex + 1) / 3) * 86400000));
        benchmarks.push({
          Id: benchmarkId,
          StudentId: student.Id,
          SubjectId: tags[0],
          Category: subjectName + ' - ' + template.focus,
          Skill: firstName + ' will ' + template.skill + ' ' + phase,
          TargetCorrect: 3,
          TargetAttempts: 4,
          RequiredTrials: 3,
          TotalTrials: 4,
          StartDate: benchmarkStart,
          DueDate: benchmarkDue,
          Critical: false,
          Active: phaseIndex === activePhase,
          Description: 'Short-Term Objective ' + (phaseIndex + 1) + ': ' + firstName + ' will ' +
            template.skill + ' ' + phase + ' on 3 out of 4 recorded trials.',
          GoalId: goalId
        });
        tags.forEach(subjectId => benchmarkSubjects.push({
          BenchmarkId: benchmarkId,
          SubjectId: subjectId
        }));
      });
    }
  });
  return { goals: goals, benchmarks: benchmarks, benchmarkSubjects: benchmarkSubjects };
}

function buildDemoEntries_(random, benchmarks, studentClasses, aidesByClass, students, today) {
  const studentById = students.reduce((map, row) => {
    map[row.Id] = row;
    return map;
  }, {});
  const entries = [];
  benchmarks.filter(row => toBoolean_(row.Active)).forEach(benchmark => {
    const student = studentById[benchmark.StudentId];
    const enrolled = studentClasses[benchmark.StudentId];
    const sessions = demoInt_(random, 6, 10);
    let level = demoInt_(random, 0, 2);
    for (let index = 0; index < sessions; index += 1) {
      const drift = random();
      if (drift < 0.2) level = Math.max(0, level - 1);
      else if (drift < 0.55) level = level;
      else level = Math.min(4, level + 1);
      const correct = level;
      const attempts = 4;
      const dayOffset = -7 * (sessions - index) - demoInt_(random, 0, 2);
      const timestamp = new Date(today.getTime() + dayOffset * 86400000);
      timestamp.setHours(9 + (index % 5), (index * 7) % 60, 0, 0);
      const classRow = enrolled[index % enrolled.length];
      const classAides = aidesByClass[classRow.Id];
      const recorder = index % 3 === 0
        ? student.CaseManagerEmail
        : classAides[index % classAides.length].Email;
      entries.push({
        Id: demoId_('ENTRY', entries.length + 1),
        Timestamp: formatDateTime_(timestamp),
        BenchmarkId: benchmark.Id,
        StudentId: benchmark.StudentId,
        StaffEmail: recorder,
        ClassId: classRow.Id,
        Correct: correct,
        Attempts: attempts,
        Percent: Math.round((correct / attempts) * 1000) / 10,
        Notes: demoPick_(random, VOICES_DEMO_ENTRY_NOTES)
      });
    }
  });
  return entries;
}

function buildDemoSchedule_(random, aides, classes, instructionalPeriods, lunchPeriod, scheduleType, students, studentClasses, trainedAides, today) {
  const periods = instructionalPeriods
    .concat(lunchPeriod ? [lunchPeriod] : [])
    .sort((a, b) => toNumber_(a.SortOrder) - toNumber_(b.SortOrder));
  const classesByPeriod = instructionalPeriods.reduce((map, period) => {
    map[period.PeriodId] = classes.filter(row => String(row.PeriodId) === String(period.PeriodId));
    return map;
  }, {});
  const extendedDuty = { Marcos: true, Casey: true };
  const coverage = {};
  aides.forEach(aide => {
    const periodIds = toNumber_(aide.WeeklyHours) >= 29
      ? instructionalPeriods.map(period => period.PeriodId)
      : instructionalPeriods.slice(0, 4).map(period => period.PeriodId);
    if (lunchPeriod && extendedDuty[aide.FirstName]) periodIds.push(lunchPeriod.PeriodId);
    coverage[aide.Email] = periodIds;
  });

  const plan = {};
  aides.forEach(aide => {
    plan[aide.Email] = {};
  });
  const oneToOne = students.filter(student => toBoolean_(student.IsOneToOne));
  oneToOne.forEach(student => {
    const trained = trainedAides[student.Id] || [];
    studentClasses[student.Id].forEach(classRow => {
      const periodId = String(classRow.PeriodId);
      const aide = trained.find(candidate =>
        coverage[candidate.Email].indexOf(periodId) !== -1 && !plan[candidate.Email][periodId]
      );
      if (!aide) return;
      plan[aide.Email][periodId] = {
        classId: classRow.Id,
        studentId: student.Id,
        duty: 'One-to-one support for ' + String(student.Name).split(' ')[0] + '.',
        type: 'ONE_TO_ONE'
      };
    });
  });
  aides.forEach((aide, aideIndex) => {
    coverage[aide.Email].forEach((periodId, slot) => {
      if (plan[aide.Email][periodId]) return;
      const options = classesByPeriod[periodId] || [];
      if (lunchPeriod && periodId === lunchPeriod.PeriodId) {
        plan[aide.Email][periodId] = {
          classId: '',
          studentId: '',
          duty: 'Cafeteria supervision.',
          type: 'STANDARD'
        };
        return;
      }
      if (!options.length) return;
      const classRow = options[(aideIndex + slot) % options.length];
      plan[aide.Email][periodId] = {
        classId: classRow.Id,
        studentId: '',
        duty: 'Instructional support in ' + classRow.Name + '.',
        type: 'STANDARD'
      };
    });
  });

  const assignments = [];
  const schedulePeriods = periods.map(period => ({
    ScheduleTypeId: period.ScheduleTypeId,
    PeriodId: period.PeriodId,
    Label: period.Label,
    StartTime: period.StartTime,
    EndTime: period.EndTime,
    SortOrder: period.SortOrder
  }));
  const pushAssignments = (dayScheduleId, date) => {
    aides.forEach(aide => {
      Object.keys(plan[aide.Email]).forEach(periodId => {
        const slot = plan[aide.Email][periodId];
        assignments.push({
          Id: demoId_('ASSIGN', assignments.length + 1),
          DayScheduleId: dayScheduleId,
          Date: date,
          PeriodId: periodId,
          AideEmail: aide.Email,
          ClassId: slot.classId,
          StudentId: slot.studentId,
          Duty: slot.duty,
          Note: '',
          Type: slot.type
        });
      });
    });
  };

  pushAssignments(scheduleType.Id, '');

  const daySchedules = [];
  const dates = weekDates_(weekStart_(formatDate_(today)));
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  dayNames.forEach((dayName, index) => {
    const date = dates[index];
    const dayScheduleId = demoId_('DAY', index + 1);
    daySchedules.push({
      Id: dayScheduleId,
      Date: date,
      Name: dayName + ' coverage',
      BaseScheduleTypeId: scheduleType.Id,
      Temporary: true,
      Status: 'ACTIVE',
      CreatedBy: ''
    });
    periods.forEach(period => schedulePeriods.push({
      ScheduleTypeId: dayScheduleId,
      PeriodId: period.PeriodId,
      Label: period.Label,
      StartTime: period.StartTime,
      EndTime: period.EndTime,
      SortOrder: period.SortOrder
    }));
    pushAssignments(dayScheduleId, date);
  });

  return {
    assignments: assignments,
    daySchedules: daySchedules,
    schedulePeriods: schedulePeriods
  };
}

function buildDemoAvailability_(aides, today) {
  const submitted = formatDateTime_(new Date(today.getTime() - 30 * 86400000));
  const availability = [];
  aides.forEach((aide, index) => {
    const fullTime = toNumber_(aide.WeeklyHours) >= 29;
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
      availability.push({
        Id: demoId_('AVAIL', availability.length + 1),
        AideEmail: aide.Email,
        DayOfWeek: day,
        Available: true,
        StartTime: fullTime ? '07:45' : '07:45',
        EndTime: fullTime ? '15:15' : '11:45',
        Status: 'APPROVED',
        ReviewedBy: '',
        ReviewedAt: submitted,
        SubmittedAt: submitted
      });
    });
    if (index === 3) {
      availability.push({
        Id: demoId_('AVAIL', availability.length + 1),
        AideEmail: aide.Email,
        DayOfWeek: 'Friday',
        Available: false,
        StartTime: '',
        EndTime: '',
        Status: 'PENDING',
        ReviewedBy: '',
        ReviewedAt: '',
        SubmittedAt: formatDateTime_(new Date(today.getTime() - 2 * 86400000))
      });
    }
  });
  return availability;
}

function buildDemoTimeOff_(aides, caseManagers, dateText, today) {
  const reviewer = caseManagers.length ? caseManagers[0].Email : '';
  const plans = [
    [0, -40, -40, 'Personal', true, 'Family appointment.', 'APPROVED'],
    [1, -20, -19, 'Sick', true, 'Out with the flu.', 'APPROVED'],
    [2, -12, -12, 'Personal', false, 'Requested the day for a move.', 'DENIED'],
    [3, 6, 6, 'Personal', true, 'Medical appointment in the afternoon.', 'PENDING'],
    [8, 11, 12, 'Vacation', true, 'Out of town for a wedding.', 'PENDING']
  ];
  return plans.map((plan, index) => ({
    Id: demoId_('TOFF', index + 1),
    AideEmail: aides[plan[0] % aides.length].Email,
    StartDate: dateText(plan[1]),
    EndDate: dateText(plan[2]),
    Type: plan[3],
    HasHours: plan[4],
    Reason: plan[5],
    Status: plan[6],
    ReviewedBy: plan[6] === 'PENDING' ? '' : reviewer,
    ReviewedAt: plan[6] === 'PENDING' ? '' : formatDateTime_(new Date(today.getTime() + (plan[1] - 3) * 86400000)),
    CreatedAt: formatDateTime_(new Date(today.getTime() + (plan[1] - 10) * 86400000))
  }));
}

function buildDemoTimeEntries_(random, aides, today) {
  const entries = [];
  aides.slice(0, 6).forEach(aide => {
    const fullTime = toNumber_(aide.WeeklyHours) >= 29;
    for (let back = 12; back >= 1; back -= 1) {
      const day = new Date(today.getTime() - back * 86400000);
      const weekday = day.getDay();
      if (weekday === 0 || weekday === 6) continue;
      const clockIn = new Date(day.getTime());
      clockIn.setHours(7, demoInt_(random, 38, 52), 0, 0);
      const clockOut = new Date(clockIn.getTime() + Math.round((fullTime ? 7.5 : 4.25) * 3600000));
      const hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / 3600000) * 100) / 100;
      entries.push({
        Id: demoId_('TIME', entries.length + 1),
        AideEmail: aide.Email,
        ClockIn: formatDateTime_(clockIn),
        ClockOut: formatDateTime_(clockOut),
        Hours: hours,
        Note: '',
        Verified: back > 5
      });
    }
  });
  return entries;
}

function buildDemoMessages_(caseManagers, dateText, today) {
  const authors = caseManagers.length ? caseManagers : [{ Email: '' }];
  return [
    {
      Id: demoId_('MSG', 1),
      Message: 'Progress data for the current reporting window is due Friday. Please enter all trials before you leave for the day.',
      StartDate: dateText(-2),
      EndDate: dateText(9),
      Active: true,
      CreatedBy: authors[0].Email,
      CreatedAt: formatDateTime_(new Date(today.getTime() - 2 * 86400000))
    },
    {
      Id: demoId_('MSG', 2),
      Message: 'Fire drill is scheduled for Wednesday during third period. Follow your class to the assigned area and stay with your assigned student.',
      StartDate: dateText(-1),
      EndDate: dateText(4),
      Active: true,
      CreatedBy: authors[1 % authors.length].Email,
      CreatedAt: formatDateTime_(new Date(today.getTime() - 86400000))
    },
    {
      Id: demoId_('MSG', 3),
      Message: 'Reminder: last month timecards were due on the tenth.',
      StartDate: dateText(-45),
      EndDate: dateText(-30),
      Active: false,
      CreatedBy: authors[2 % authors.length].Email,
      CreatedAt: formatDateTime_(new Date(today.getTime() - 45 * 86400000))
    }
  ];
}

function validateDemoContent_() {
  const issues = [];
  const staff = rows_('Staff');
  const staffByEmail = staff.reduce((map, row) => {
    map[normalizeEmail_(row.Email)] = row;
    return map;
  }, {});
  const students = rows_('Students');
  const studentIds = {};
  students.forEach(row => {
    studentIds[String(row.Id)] = row;
  });
  const classes = rows_('Classes');
  const classIds = {};
  classes.forEach(row => {
    classIds[String(row.Id)] = row;
  });
  const goals = rows_('Goals');
  const benchmarks = rows_('Benchmarks');
  const entries = rows_('BenchmarkEntries');
  const assignments = rows_('Assignments');
  const training = rows_('AideTraining');
  const subjectIds = rows_('Subjects').reduce((map, row) => {
    map[String(row.Id)] = row;
    return map;
  }, {});

  staff.forEach(row => {
    const role = String(row.Role);
    if ([VOICES.ROLES.AIDE, VOICES.ROLES.TEACHER, VOICES.ROLES.CASE_MANAGER].indexOf(role) === -1) {
      issues.push('Unknown staff role for ' + row.Email + ': ' + role);
    }
    if (role === VOICES.ROLES.AIDE && !toNumber_(row.WeeklyHours)) {
      issues.push('Missing weekly hours for aide ' + row.Email);
    }
  });

  students.forEach(student => {
    if (!staffByEmail[normalizeEmail_(student.CaseManagerEmail)]) {
      issues.push('Student ' + student.Name + ' references an unknown case manager.');
    }
  });

  classes.forEach(classRow => {
    if (!staffByEmail[normalizeEmail_(classRow.TeacherEmail)]) {
      issues.push('Class ' + classRow.Name + ' references an unknown teacher.');
    }
    if (!subjectIds[String(classRow.SubjectId)]) {
      issues.push('Class ' + classRow.Name + ' references an unknown subject.');
    }
  });

  rows_('ClassStudents').forEach(row => {
    if (!classIds[String(row.ClassId)] || !studentIds[String(row.StudentId)]) {
      issues.push('Class enrollment references a missing class or student.');
    }
  });
  rows_('ClassAides').forEach(row => {
    if (!classIds[String(row.ClassId)] || !staffByEmail[normalizeEmail_(row.AideEmail)]) {
      issues.push('Class aide row references a missing class or aide.');
    }
  });

  const trainedByAide = {};
  training.forEach(row => {
    if (!studentIds[String(row.StudentId)] || !staffByEmail[normalizeEmail_(row.AideEmail)]) {
      issues.push('Training row references a missing student or aide.');
    }
    trainedByAide[normalizeEmail_(row.AideEmail) + '|' + String(row.StudentId)] = true;
  });

  const goalsByStudent = {};
  const goalIds = {};
  goals.forEach(goal => {
    goalIds[String(goal.Id)] = goal;
    if (!studentIds[String(goal.StudentId)]) {
      issues.push('Goal ' + goal.Id + ' references a missing student.');
    }
    const start = parseDate_(formatDate_(goal.StartDate)).getTime();
    const due = parseDate_(formatDate_(goal.DueDate)).getTime();
    if (!start || !due || start >= due) {
      issues.push('Goal ' + goal.Id + ' has an invalid date range.');
    }
    goalsByStudent[String(goal.StudentId)] = (goalsByStudent[String(goal.StudentId)] || 0) + 1;
  });
  students.filter(student => toBoolean_(student.Active)).forEach(student => {
    const count = goalsByStudent[String(student.Id)] || 0;
    if (count < 3 || count > 5) {
      issues.push(student.Name + ' has ' + count + ' goals; expected between 3 and 5.');
    }
  });

  const benchmarkIds = {};
  const benchmarksByGoal = {};
  const activeByGoal = {};
  benchmarks.forEach(benchmark => {
    benchmarkIds[String(benchmark.Id)] = benchmark;
    const goalId = String(benchmark.GoalId);
    if (!goalIds[goalId]) issues.push('Benchmark ' + benchmark.Id + ' references a missing goal.');
    if (!studentIds[String(benchmark.StudentId)]) {
      issues.push('Benchmark ' + benchmark.Id + ' references a missing student.');
    }
    benchmarksByGoal[goalId] = (benchmarksByGoal[goalId] || 0) + 1;
    if (toBoolean_(benchmark.Active)) activeByGoal[goalId] = (activeByGoal[goalId] || 0) + 1;
    if (toNumber_(benchmark.TargetCorrect) > toNumber_(benchmark.TargetAttempts)) {
      issues.push('Benchmark ' + benchmark.Id + ' targets more correct trials than attempts.');
    }
    const ratio = String(benchmark.Description).match(/(\d+)\s*(?:\/|out of)\s*(\d+)/i);
    if (!ratio) {
      issues.push('Benchmark ' + benchmark.Id + ' has no readable ratio in its objective text.');
    } else if (toNumber_(ratio[1]) !== toNumber_(benchmark.TargetCorrect) ||
        toNumber_(ratio[2]) !== toNumber_(benchmark.TargetAttempts)) {
      issues.push('Benchmark ' + benchmark.Id + ' ratio does not match its target fields.');
    }
    const start = parseDate_(formatDate_(benchmark.StartDate)).getTime();
    const due = parseDate_(formatDate_(benchmark.DueDate)).getTime();
    if (!start || !due || start >= due) {
      issues.push('Benchmark ' + benchmark.Id + ' has an invalid date range.');
    }
  });
  Object.keys(benchmarksByGoal).forEach(goalId => {
    if (benchmarksByGoal[goalId] !== 3) {
      issues.push('Goal ' + goalId + ' has ' + benchmarksByGoal[goalId] + ' benchmarks; expected 3.');
    }
  });
  goals.filter(goal => toBoolean_(goal.Active)).forEach(goal => {
    const count = activeByGoal[String(goal.Id)] || 0;
    if (count !== 1) {
      issues.push('Goal ' + goal.Id + ' has ' + count + ' active benchmarks; expected exactly 1.');
    }
  });

  rows_('BenchmarkSubjects').forEach(row => {
    if (!benchmarkIds[String(row.BenchmarkId)] || !subjectIds[String(row.SubjectId)]) {
      issues.push('Benchmark subject row references a missing benchmark or subject.');
    }
  });

  const now = new Date().getTime();
  entries.forEach(entry => {
    if (!benchmarkIds[String(entry.BenchmarkId)]) {
      issues.push('Entry ' + entry.Id + ' references a missing benchmark.');
    }
    if (!studentIds[String(entry.StudentId)]) {
      issues.push('Entry ' + entry.Id + ' references a missing student.');
    }
    if (entry.ClassId && !classIds[String(entry.ClassId)]) {
      issues.push('Entry ' + entry.Id + ' references a missing class.');
    }
    if (!staffByEmail[normalizeEmail_(entry.StaffEmail)]) {
      issues.push('Entry ' + entry.Id + ' references a missing staff member.');
    }
    const correct = toNumber_(entry.Correct);
    const attempts = toNumber_(entry.Attempts);
    if (!attempts || correct > attempts) {
      issues.push('Entry ' + entry.Id + ' has invalid trial counts.');
    }
    const expected = attempts ? Math.round((correct / attempts) * 1000) / 10 : 0;
    if (Math.abs(toNumber_(entry.Percent) - expected) > 0.11) {
      issues.push('Entry ' + entry.Id + ' has a percentage that does not match its trials.');
    }
    const stamp = new Date(entry.Timestamp).getTime();
    if (!stamp) issues.push('Entry ' + entry.Id + ' has an unreadable date.');
    else if (stamp > now) issues.push('Entry ' + entry.Id + ' is dated in the future.');
  });

  assignments.forEach(assignment => {
    if (!staffByEmail[normalizeEmail_(assignment.AideEmail)]) {
      issues.push('Assignment ' + assignment.Id + ' references a missing aide.');
    }
    if (assignment.ClassId && !classIds[String(assignment.ClassId)]) {
      issues.push('Assignment ' + assignment.Id + ' references a missing class.');
    }
    if (assignment.StudentId) {
      if (!studentIds[String(assignment.StudentId)]) {
        issues.push('Assignment ' + assignment.Id + ' references a missing student.');
      } else if (!trainedByAide[normalizeEmail_(assignment.AideEmail) + '|' + String(assignment.StudentId)]) {
        issues.push('Assignment ' + assignment.Id + ' pairs an untrained aide with a one-to-one student.');
      }
    }
  });

  rows_('IEPs').forEach(iep => {
    if (!studentIds[String(iep.StudentId)]) issues.push('IEP ' + iep.Id + ' references a missing student.');
    if (!staffByEmail[normalizeEmail_(iep.CaseManagerEmail)]) {
      issues.push('IEP ' + iep.Id + ' references a missing case manager.');
    }
    if (parseDate_(formatDate_(iep.StartDate)).getTime() >= parseDate_(formatDate_(iep.EndDate)).getTime()) {
      issues.push('IEP ' + iep.Id + ' has an end date on or before its start date.');
    }
  });

  const prohibited = /\b(demo|sample|test\s+student|placeholder|lorem|ai[- ]generated|chatgpt|openai|as an ai)\b/i;
  const scan = (label, values) => values.forEach(value => {
    if (value && prohibited.test(String(value))) issues.push('Prohibited wording in ' + label + ': ' + value);
  });
  scan('student names', students.map(row => row.Name));
  scan('class names', classes.map(row => row.Name));
  scan('goals', goals.map(row => row.Goal));
  scan('benchmarks', benchmarks.map(row => row.Skill + ' ' + row.Description));
  scan('entry notes', entries.map(row => row.Notes));
  scan('assignments', assignments.map(row => row.Duty + ' ' + row.Note));
  scan('messages', rows_('Messages').map(row => row.Message));

  const weekly = getWeeklyScheduleData_(new Date());
  return {
    ok: issues.length === 0,
    issues: issues,
    counts: {
      staff: staff.length,
      students: students.length,
      classes: classes.length,
      goals: goals.length,
      benchmarks: benchmarks.length,
      benchmarkEntries: entries.length,
      assignments: assignments.length
    },
    weeklyHours: weekly.summary
  };
}
