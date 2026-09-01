const SHEET_SCHEMAS = Object.freeze({
  Settings: ['Key', 'Value'],
  Staff: ['Id', 'Email', 'FirstName', 'LastName', 'Role', 'IsAdmin', 'Active', 'WeeklyHours'],
  Students: ['Id', 'Name', 'CaseManagerEmail', 'IsOneToOne', 'Active'],
  Subjects: ['Id', 'Name', 'Active'],
  Classes: ['Id', 'Name', 'SubjectId', 'TeacherEmail', 'PeriodId', 'Active'],
  ClassStudents: ['ClassId', 'StudentId'],
  ClassAides: ['ClassId', 'AideEmail'],
  AideTraining: ['AideEmail', 'StudentId'],
  IEPs: ['Id', 'StudentId', 'CaseManagerEmail', 'StartDate', 'EndDate', 'Status', 'FileUrl'],
  Goals: [
    'Id', 'StudentId', 'Goal', 'StartDate', 'DueDate', 'Active',
    'CreatedBy', 'CreatedAt', 'UpdatedAt'
  ],
  Benchmarks: [
    'Id', 'StudentId', 'SubjectId', 'Category', 'Skill', 'TargetCorrect', 'TargetAttempts',
    'RequiredTrials', 'TotalTrials', 'StartDate', 'DueDate', 'Critical', 'Active', 'Description',
    'GoalId'
  ],
  BenchmarkSubjects: ['BenchmarkId', 'SubjectId'],
  BenchmarkEntries: [
    'Id', 'Timestamp', 'BenchmarkId', 'StudentId', 'StaffEmail', 'ClassId',
    'Correct', 'Attempts', 'Percent', 'Notes'
  ],
  ScheduleTypes: ['Id', 'Name', 'IsDefault', 'Active'],
  SchedulePeriods: ['ScheduleTypeId', 'PeriodId', 'Label', 'StartTime', 'EndTime', 'SortOrder'],
  DaySchedules: ['Id', 'Date', 'Name', 'BaseScheduleTypeId', 'Temporary', 'Status', 'CreatedBy'],
  Assignments: [
    'Id', 'DayScheduleId', 'Date', 'PeriodId', 'AideEmail', 'ClassId',
    'StudentId', 'Duty', 'Note', 'Type'
  ],
  Messages: ['Id', 'Message', 'StartDate', 'EndDate', 'Active', 'CreatedBy', 'CreatedAt'],
  TimeEntries: ['Id', 'AideEmail', 'ClockIn', 'ClockOut', 'Hours', 'Note', 'Verified'],
  TimeOffRequests: [
    'Id', 'AideEmail', 'StartDate', 'EndDate', 'Type', 'HasHours', 'Reason',
    'Status', 'ReviewedBy', 'ReviewedAt', 'CreatedAt'
  ],
  Availability: [
    'Id', 'AideEmail', 'DayOfWeek', 'Available', 'StartTime', 'EndTime',
    'Status', 'ReviewedBy', 'ReviewedAt', 'SubmittedAt'
  ],
  Notifications: ['Id', 'Type', 'Message', 'Recipients', 'Status', 'CreatedAt']
});

let VOICES_ROWS_CACHE = null;
let VOICES_DATABASE_CACHE = null;
let VOICES_DATABASE_OVERRIDE_ID = null;
let VOICES_INDEX_CACHE = null;

function withRowsCache_(callback) {
  const previousCache = VOICES_ROWS_CACHE;
  const previousDatabase = VOICES_DATABASE_CACHE;
  const previousIndexes = VOICES_INDEX_CACHE;
  VOICES_ROWS_CACHE = {};
  VOICES_DATABASE_CACHE = null;
  VOICES_INDEX_CACHE = {};
  try {
    return callback();
  } finally {
    VOICES_ROWS_CACHE = previousCache;
    VOICES_DATABASE_CACHE = previousDatabase;
    VOICES_INDEX_CACHE = previousIndexes;
  }
}

function setupVoicesDatabase(options) {
  options = options || {};
  const spreadsheet = options.spreadsheetId
    ? SpreadsheetApp.openById(options.spreadsheetId)
    : SpreadsheetApp.create(options.name || 'V.O.I.C.E.S 2.2 Database');

  PropertiesService.getScriptProperties().setProperty(VOICES.DATABASE_PROPERTY, spreadsheet.getId());
  Object.keys(SHEET_SCHEMAS).forEach(name => ensureSheet_(spreadsheet, name, SHEET_SCHEMAS[name]));

  const ownerEmail = normalizeEmail_(options.ownerEmail || Session.getEffectiveUser().getEmail());
  if (ownerEmail && !findOne_('Staff', row => normalizeEmail_(row.Email) === ownerEmail)) {
    appendRow_('Staff', {
      Id: uuid_(),
      Email: ownerEmail,
      FirstName: options.firstName || 'Administrator',
      LastName: options.lastName || '',
      Role: VOICES.ROLES.CASE_MANAGER,
      IsAdmin: true,
      Active: true
    });
  }

  seedDefaults_();
  migrateVoices22Data_();
  formatDatabase_(spreadsheet);
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    ownerEmail: ownerEmail,
    message: 'Database initialized. Add staff to the Staff sheet before deploying the web app.'
  };
}

function upgradeVoices22Database() {
  const spreadsheet = getDatabase_();
  Object.keys(SHEET_SCHEMAS).forEach(name => ensureSheet_(spreadsheet, name, SHEET_SCHEMAS[name]));
  migrateVoices22Data_();
  seedDefaults_();
  formatDatabase_(spreadsheet);
  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    message: 'V.O.I.C.E.S 2.2 database schema is ready.'
  };
}

function upgradeVoices21Database() {
  return upgradeVoices22Database();
}

function withDatabaseId_(spreadsheetId, callback) {
  if (!spreadsheetId) throw new Error('A spreadsheet id is required.');
  const previousOverride = VOICES_DATABASE_OVERRIDE_ID;
  VOICES_DATABASE_OVERRIDE_ID = spreadsheetId;
  try {
    return withRowsCache_(callback);
  } finally {
    VOICES_DATABASE_OVERRIDE_ID = previousOverride;
  }
}

function getDatabase_() {
  if (VOICES_DATABASE_CACHE) return VOICES_DATABASE_CACHE;
  const id = VOICES_DATABASE_OVERRIDE_ID ||
    PropertiesService.getScriptProperties().getProperty(VOICES.DATABASE_PROPERTY);
  if (!id) {
    throw new Error('V.O.I.C.E.S database is not configured. Run setupVoicesDatabase() from the Apps Script editor.');
  }
  const database = SpreadsheetApp.openById(id);
  if (VOICES_ROWS_CACHE) VOICES_DATABASE_CACHE = database;
  return database;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const existing = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    : [];
  const matches = headers.length === existing.length &&
    headers.every((header, index) => existing[index] === header);
  if (!matches) {
    const values = lastRow > 1 && lastColumn > 0
      ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
      : [];
    const indexes = existing.reduce((map, header, index) => {
      if (header) map[String(header)] = index;
      return map;
    }, {});
    const migrated = values.map(row => headers.map(header =>
      indexes[header] === undefined ? '' : row[indexes[header]]
    ));
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    if (migrated.length) {
      sheet.getRange(2, 1, migrated.length, headers.length).setValues(migrated);
    }
  }
  sheet.setFrozenRows(1);
  return sheet;
}

function migrateVoices22Data_() {
  const goals = rows_('Goals');
  const goalIds = new Set(goals.map(row => String(row.Id)));
  rows_('Benchmarks').forEach(benchmark => {
    let goalId = String(benchmark.GoalId || '');
    if (!goalId) goalId = 'MIGRATED_GOAL_' + String(benchmark.Id);
    if (!goalIds.has(goalId)) {
      appendRow_('Goals', {
        Id: goalId,
        StudentId: benchmark.StudentId,
        Goal: benchmark.Description ||
          [benchmark.Category, benchmark.Skill].filter(Boolean).join(' — '),
        StartDate: benchmark.StartDate,
        DueDate: benchmark.DueDate,
        Active: toBoolean_(benchmark.Active),
        CreatedBy: '',
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      });
      goalIds.add(goalId);
    }
    if (String(benchmark.GoalId || '') !== goalId) {
      updateRow_('Benchmarks', benchmark._row, { GoalId: goalId });
    }
    if (benchmark.SubjectId && !findOne_('BenchmarkSubjects', row =>
      String(row.BenchmarkId) === String(benchmark.Id) &&
      String(row.SubjectId) === String(benchmark.SubjectId)
    )) {
      appendRow_('BenchmarkSubjects', {
        BenchmarkId: benchmark.Id,
        SubjectId: benchmark.SubjectId
      });
    }
  });
}

function formatDatabase_(spreadsheet) {
  Object.keys(SHEET_SCHEMAS).forEach(name => {
    const sheet = spreadsheet.getSheetByName(name);
    if (!sheet) return;
    const width = SHEET_SCHEMAS[name].length;
    sheet.getRange(1, 1, 1, width)
      .setBackground('#b91c1c')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.autoResizeColumns(1, width);
    sheet.setFrozenRows(1);
  });
}

function seedDefaults_() {
  if (rows_('Settings').length === 0) {
    [
      ['SchoolName', 'Westminster High School'],
      ['AppName', VOICES.APP_NAME],
      ['PayPeriodStartDay', '10'],
      ['TimeClockNotice', 'This is not an official time clock. It is merely a tool to track your own records. Time cards must still be completed and submitted as normal. Admin will verify all time clocks as needed.'],
      ['HoursInstructions', 'Review your records and complete your official timecard as normal.'],
      ['CaseManagerAlertEmails', ''],
      ['ScheduleWeekdays', 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY']
    ].forEach(values => appendValues_('Settings', values));
  }
  if (!findOne_('Settings', row => row.Key === 'ScheduleWeekdays')) {
    appendRow_('Settings', {
      Key: 'ScheduleWeekdays',
      Value: 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY'
    });
  }

  if (activeRows_('Subjects').length === 0) {
    ['Math', 'English Language Arts', 'Science', 'Social Studies', 'Life Skills', 'Communication', 'Behavior', 'Transition']
      .forEach(name => appendRow_('Subjects', { Id: uuid_(), Name: name, Active: true }));
  }

  if (activeRows_('ScheduleTypes').length === 0) {
    const scheduleTypeId = uuid_();
    appendRow_('ScheduleTypes', { Id: scheduleTypeId, Name: 'Default Day', IsDefault: true, Active: true });
    [
      ['P1', 'Period 1', '08:00', '08:50', 1],
      ['P2', 'Period 2', '08:55', '09:45', 2],
      ['P3', 'Period 3', '09:50', '10:40', 3],
      ['P4', 'Period 4', '10:45', '11:35', 4],
      ['LUNCH', 'Lunch', '11:35', '12:05', 5],
      ['P5', 'Period 5', '12:10', '13:00', 6],
      ['P6', 'Period 6', '13:05', '13:55', 7],
      ['P7', 'Period 7', '14:00', '14:50', 8]
    ].forEach(period => appendRow_('SchedulePeriods', {
      ScheduleTypeId: scheduleTypeId,
      PeriodId: period[0],
      Label: period[1],
      StartTime: period[2],
      EndTime: period[3],
      SortOrder: period[4]
    }));
  }
}

function sheet_(name) {
  const sheet = getDatabase_().getSheetByName(name);
  if (!sheet) throw new Error('Missing database sheet: ' + name);
  return sheet;
}

function rows_(name) {
  if (VOICES_ROWS_CACHE && VOICES_ROWS_CACHE[name]) {
    return VOICES_ROWS_CACHE[name].map(row => Object.assign({}, row));
  }
  const sheet = sheet_(name);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  const records = values.slice(1)
    .filter(row => row.some(value => value !== ''))
    .map((row, index) => {
      const record = { _row: index + 2 };
      headers.forEach((header, column) => {
        const value = row[column];
        record[header] = value instanceof Date ? formatDateTime_(value) : value;
      });
      return record;
    });
  if (VOICES_ROWS_CACHE) {
    VOICES_ROWS_CACHE[name] = records;
    return records.map(row => Object.assign({}, row));
  }
  return records;
}

function activeRows_(name) {
  return rows_(name).filter(row => row.Active === undefined || row.Active === '' || toBoolean_(row.Active));
}

function findOne_(name, predicate) {
  return rows_(name).find(predicate) || null;
}

function appendValues_(name, values) {
  sheet_(name).appendRow(values);
}

function appendRow_(name, record) {
  const headers = SHEET_SCHEMAS[name];
  if (!headers) throw new Error('Unknown schema: ' + name);
  const values = headers.map(header => record[header] === undefined ? '' : record[header]);
  sheet_(name).appendRow(values);
  invalidateRowsCache_(name);
  return record;
}

function updateRow_(name, rowNumber, patch) {
  const headers = SHEET_SCHEMAS[name];
  const sheet = sheet_(name);
  const current = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  headers.forEach((header, index) => {
    if (patch[header] !== undefined) current[index] = patch[header];
  });
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([current]);
  invalidateRowsCache_(name);
}

function deleteRow_(name, rowNumber) {
  sheet_(name).deleteRow(rowNumber);
  invalidateRowsCache_(name);
}

function replaceRows_(name, predicate, replacementRows) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const keep = rows_(name).filter(row => !predicate(row));
    const all = keep.concat(replacementRows || []);
    const sheet = sheet_(name);
    const headers = SHEET_SCHEMAS[name];
    if (sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
    }
    if (all.length) {
      const values = all.map(record => headers.map(header => record[header] === undefined ? '' : record[header]));
      sheet.getRange(2, 1, values.length, headers.length).setValues(values);
    }
    invalidateRowsCache_(name);
  } finally {
    lock.releaseLock();
  }
}

function invalidateRowsCache_(name) {
  if (VOICES_ROWS_CACHE) delete VOICES_ROWS_CACHE[name];
  if (VOICES_INDEX_CACHE && name === 'BenchmarkSubjects') {
    delete VOICES_INDEX_CACHE.benchmarkSubjects;
  }
  if (VOICES_INDEX_CACHE && name === 'Subjects') {
    delete VOICES_INDEX_CACHE.subjects;
  }
}

function settingsMap_() {
  return rows_('Settings').reduce((map, row) => {
    map[row.Key] = row.Value;
    return map;
  }, {});
}

function saveSetting(key, value) {
  requireCaseManager_();
  const existing = findOne_('Settings', row => row.Key === key);
  if (existing) {
    updateRow_('Settings', existing._row, { Value: sanitizeText_(value, 5000) });
  } else {
    appendRow_('Settings', { Key: sanitizeText_(key, 100), Value: sanitizeText_(value, 5000) });
  }
  return true;
}
