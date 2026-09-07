const SHEET_SCHEMAS = Object.freeze({
  Settings: ['Key', 'Value'],
  Staff: ['Id', 'Email', 'FirstName', 'LastName', 'Role', 'IsAdmin', 'Active', 'WeeklyHours'],
  Students: ['Id', 'Name', 'Grade', 'CaseManagerEmail', 'IsOneToOne', 'Active'],
  Subjects: ['Id', 'Name', 'Active'],
  Classes: ['Id', 'Name', 'SubjectId', 'TeacherEmail', 'PeriodId', 'Active'],
  ClassStudents: ['ClassId', 'StudentId'],
  ClassAides: ['ClassId', 'AideEmail'],
  AideTraining: ['AideEmail', 'StudentId'],
  IEPs: ['Id', 'StudentId', 'CaseManagerEmail', 'StartDate', 'EndDate', 'Status', 'FileUrl'],
  Goals: [
    'Id', 'StudentId', 'Goal', 'StartDate', 'DueDate', 'Active',
    'CreatedBy', 'CreatedAt', 'UpdatedAt', 'Domain', 'Status',
    'ImportBatchId', 'ImportGoalKey', 'ImportFingerprint', 'BenchmarkActivationMode'
  ],
  Benchmarks: [
    'Id', 'StudentId', 'SubjectId', 'Category', 'Skill', 'TargetCorrect', 'TargetAttempts',
    'RequiredTrials', 'TotalTrials', 'StartDate', 'DueDate', 'Critical', 'Active', 'Description',
    'GoalId', 'OrderIndex', 'TaskDemandDescription', 'TargetPromptLevel',
    'TargetPromptCount', 'TargetAccuracyPct', 'TargetConsecutiveSessions',
    'GoalArchetype', 'TargetPromptCeiling', 'ConsistencyTrialsPassed',
    'ConsistencyTrialsWindow', 'EvaluationWindowUnit'
  ],
  BenchmarkSubjects: ['BenchmarkId', 'SubjectId'],
  BenchmarkEntries: [
    'Id', 'Timestamp', 'BenchmarkId', 'StudentId', 'StaffEmail', 'ClassId',
    'Correct', 'Attempts', 'Percent', 'Notes', 'ObservationDate', 'ActualPromptLevel',
    'ActualPromptCount', 'SubmissionBatchId', 'SubmissionFingerprint', 'Status', 'CorrectionOfEntryId',
    'CorrectionReason', 'CorrectedBy', 'CorrectedAt'
  ],
  GoalPhaseHistory: [
    'Id', 'GoalId', 'BenchmarkId', 'ActivatedAt', 'EndedAt',
    'ChangedBy', 'ChangeReason', 'Source', 'EndedBy', 'EndReason'
  ],
  ScheduleTypes: ['Id', 'Name', 'IsDefault', 'Active'],
  SchedulePeriods: ['ScheduleTypeId', 'PeriodId', 'Label', 'StartTime', 'EndTime', 'SortOrder'],
  DaySchedules: [
    'Id', 'Date', 'Name', 'BaseScheduleTypeId', 'Temporary', 'Status',
    'CreatedBy', 'Revision', 'UpdatedBy', 'UpdatedAt'
  ],
  Assignments: [
    'Id', 'DayScheduleId', 'Date', 'PeriodId', 'AideEmail', 'ClassId',
    'StudentId', 'Duty', 'Note', 'Type'
  ],
  AideDailyHours: [
    'Id', 'Date', 'AideEmail', 'StartTime', 'EndTime', 'LunchStartTime',
    'LunchMinutes', 'UpdatedBy', 'UpdatedAt'
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

const VOICES_RESPONSE_CACHE_TTL_SECONDS = 1800;
const VOICES_RESPONSE_CACHE_CHUNK_SIZE = 45000;
const VOICES_PERSISTENT_RESPONSE_GROUPS = Object.freeze({
  'goal-manager': 'student',
  'student-goal-workspace': 'student',
  'benchmark-lookup': 'student',
  'schedule-builder': 'schedule'
});

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

function getAppDataVersion_() {
  return PropertiesService.getScriptProperties()
    .getProperty('VOICES_APP_DATA_VERSION') || '1';
}

function invalidateAppDataCache_(scope) {
  const next = String(new Date().getTime()) + '-' + uuid_();
  const properties = PropertiesService.getScriptProperties();
  const updates = { VOICES_APP_DATA_VERSION: next };
  const selectedScope = String(scope || 'all').toLowerCase();
  if (selectedScope === 'all' || selectedScope === 'student') {
    updates.VOICES_STUDENT_READ_MODEL_VERSION = next;
  }
  if (selectedScope === 'all' || selectedScope === 'schedule') {
    updates.VOICES_SCHEDULE_READ_MODEL_VERSION = next;
  }
  properties.setProperties(updates);
  return next;
}

function cachedResponse_(namespace, keyParts, producer, ttlSeconds, forceRefresh) {
  const cache = CacheService.getScriptCache();
  const suffix = (keyParts || [])
    .map(value => String(value == null ? '' : value).replace(/[^a-zA-Z0-9_.@-]/g, '_'))
    .join('-');
  const dataVersion = getAppDataVersion_();
  let cacheKey = [
    'voices',
    VOICES.RELEASE,
    namespace,
    dataVersion,
    suffix
  ].filter(Boolean).join(':');
  if (cacheKey.length > 200) {
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      cacheKey
    ).map(value =>
      ((value + 256) % 256).toString(16).padStart(2, '0')
    ).join('');
    cacheKey = [
      'voices',
      VOICES.RELEASE,
      namespace,
      dataVersion,
      digest
    ].join(':');
  }
  if (!forceRefresh) {
    try {
      const metadataText = cache.get(cacheKey);
      if (metadataText) {
        const metadata = JSON.parse(metadataText);
        const chunks = [];
        for (let index = 0; index < metadata.chunks; index += 1) {
          const chunk = cache.get(cacheKey + ':' + index);
          if (chunk == null) throw new Error('Incomplete response cache.');
          chunks.push(chunk);
        }
        const serialized = chunks.join('');
        writePersistentResponse_(namespace, keyParts, serialized, false);
        return JSON.parse(serialized);
      }
    } catch (error) {
      console.warn('Response cache read failed: ' + error.message);
    }
    const persistent = readPersistentResponse_(namespace, keyParts);
    if (persistent.hit) {
      writeResponseCache_(cache, cacheKey, JSON.stringify(persistent.value), ttlSeconds);
      return persistent.value;
    }
  }

  const result = producer();
  const serialized = JSON.stringify(result);
  writeResponseCache_(cache, cacheKey, serialized, ttlSeconds);
  writePersistentResponse_(namespace, keyParts, serialized, true);
  return result;
}

function writeResponseCache_(cache, cacheKey, serialized, ttlSeconds) {
  try {
    const chunks = [];
    for (let offset = 0; offset < serialized.length; offset += VOICES_RESPONSE_CACHE_CHUNK_SIZE) {
      chunks.push(serialized.slice(offset, offset + VOICES_RESPONSE_CACHE_CHUNK_SIZE));
    }
    const ttl = ttlSeconds || VOICES_RESPONSE_CACHE_TTL_SECONDS;
    chunks.forEach((chunk, index) => cache.put(cacheKey + ':' + index, chunk, ttl));
    cache.put(cacheKey, JSON.stringify({ chunks: chunks.length }), ttl);
  } catch (error) {
    console.warn('Response cache write failed: ' + error.message);
  }
}

function readPersistentResponse_(namespace, keyParts) {
  const descriptor = persistentResponseDescriptor_(namespace, keyParts);
  if (!descriptor) return { hit: false };
  try {
    const properties = PropertiesService.getScriptProperties();
    const metadataText = properties.getProperty(descriptor.property);
    if (!metadataText) return { hit: false };
    const metadata = JSON.parse(metadataText);
    if (metadata.version !== descriptor.version || !metadata.fileId) {
      return { hit: false };
    }
    const stored = JSON.parse(
      DriveApp.getFileById(metadata.fileId).getBlob().getDataAsString()
    );
    if (stored.key !== descriptor.key || stored.version !== descriptor.version) {
      return { hit: false };
    }
    return { hit: true, value: stored.value };
  } catch (error) {
    console.warn('Persistent response cache read failed: ' + error.message);
    return { hit: false };
  }
}

function writePersistentResponse_(namespace, keyParts, serialized, overwrite) {
  const descriptor = persistentResponseDescriptor_(namespace, keyParts);
  if (!descriptor) return;
  const properties = PropertiesService.getScriptProperties();
  if (!overwrite) {
    try {
      const metadata = JSON.parse(
        properties.getProperty(descriptor.property) || '{}'
      );
      if (metadata.fileId && metadata.version === descriptor.version) return;
    } catch (error) {
      console.warn('Persistent response metadata was invalid: ' + error.message);
    }
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const metadataText = properties.getProperty(descriptor.property);
    const payload = JSON.stringify({
      key: descriptor.key,
      version: descriptor.version,
      value: JSON.parse(serialized)
    });
    let file = null;
    if (metadataText) {
      try {
        const metadata = JSON.parse(metadataText);
        if (metadata.fileId) file = DriveApp.getFileById(metadata.fileId);
      } catch (error) {
        file = null;
      }
    }
    if (file) {
      file.setContent(payload);
    } else {
      file = persistentResponseFolder_().createFile(
        'read-model-' + descriptor.digest + '.json',
        payload
      );
    }
    properties.setProperty(descriptor.property, JSON.stringify({
      fileId: file.getId(),
      version: descriptor.version
    }));
  } catch (error) {
    console.warn('Persistent response cache write failed: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

function persistentResponseDescriptor_(namespace, keyParts) {
  const group = VOICES_PERSISTENT_RESPONSE_GROUPS[namespace];
  if (!group) return null;
  const key = [
    VOICES.RELEASE,
    namespace,
    JSON.stringify(keyParts || [])
  ].join('|');
  const digest = sha256Hex_(key);
  const propertyName = group === 'schedule'
    ? 'VOICES_SCHEDULE_READ_MODEL_VERSION'
    : 'VOICES_STUDENT_READ_MODEL_VERSION';
  const properties = PropertiesService.getScriptProperties();
  return {
    key: key,
    digest: digest,
    property: 'VOICES_READ_MODEL_' + digest,
    version: properties.getProperty(propertyName) || '1'
  };
}

function persistentResponseFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty('VOICES_READ_MODEL_FOLDER_ID');
  if (folderId && typeof DriveApp.getFolderById === 'function') {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      console.warn('Stored read-model folder was unavailable: ' + error.message);
    }
  }
  const named = DriveApp.getFoldersByName('V.O.I.C.E.S Read Models');
  const folder = named.hasNext()
    ? named.next()
    : DriveApp.createFolder('V.O.I.C.E.S Read Models');
  properties.setProperty('VOICES_READ_MODEL_FOLDER_ID', folder.getId());
  return folder;
}

function sha256Hex_(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value)
  ).map(byte =>
    ((byte + 256) % 256).toString(16).padStart(2, '0')
  ).join('');
}

function setupVoicesDatabase(options) {
  options = options || {};
  const spreadsheet = options.spreadsheetId
    ? SpreadsheetApp.openById(options.spreadsheetId)
    : SpreadsheetApp.create(options.name || 'V.O.I.C.E.S 2.3 Database');

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
  migrateVoices23Data_();
  formatDatabase_(spreadsheet);
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    ownerEmail: ownerEmail,
    message: 'Database initialized. Add staff to the Staff sheet before deploying the web app.'
  };
}

function upgradeVoices22Database() {
  return upgradeVoices23Database();
}

function upgradeVoices21Database() {
  return upgradeVoices22Database();
}

function upgradeVoices23Database() {
  const spreadsheet = getDatabase_();
  Object.keys(SHEET_SCHEMAS).forEach(name => ensureSheet_(spreadsheet, name, SHEET_SCHEMAS[name]));
  migrateVoices22Data_();
  migrateVoices23Data_();
  seedDefaults_();
  formatDatabase_(spreadsheet);
  const validation = validateVoices23Database_();
  const ok = validation.invalidBenchmarks === 0 &&
    validation.invalidGoalStudents === 0 &&
    validation.invalidBenchmarkStudents === 0 &&
    validation.invalidEntries === 0 &&
    validation.invalidEntryStudents === 0 &&
    validation.invalidBenchmarkSubjects === 0 &&
    validation.invalidPhaseHistory === 0 &&
    validation.duplicateGoalIds === 0 &&
    validation.duplicateBenchmarkIds === 0 &&
    validation.duplicateEntryIds === 0 &&
    validation.invalidActivePhaseCounts === 0;
  return {
    ok: ok,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    validation: validation,
    message: ok
      ? 'V.O.I.C.E.S 2.3 database schema is ready.'
      : 'V.O.I.C.E.S 2.3 schema was applied, but validation issues require review.'
  };
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

function migrateVoices23Data_() {
  const goals = rows_('Goals');
  const benchmarks = rows_('Benchmarks');
  const entries = rows_('BenchmarkEntries');
  const histories = rows_('GoalPhaseHistory');
  const historyBenchmarkIds = new Set(histories.map(row => String(row.BenchmarkId)));

  goals.forEach(goal => {
    const status = String(goal.Status || '').toUpperCase() ||
      (toBoolean_(goal.Active) ? 'ACTIVE' : 'INACTIVE');
    const active = status === 'ACTIVE';
    if (String(goal.Status || '') !== status || toBoolean_(goal.Active) !== active) {
      updateRow_('Goals', goal._row, { Status: status, Active: active });
    }
  });

  const benchmarksByGoal = benchmarks.reduce((map, benchmark) => {
    const goalId = String(benchmark.GoalId || '');
    if (!map[goalId]) map[goalId] = [];
    map[goalId].push(benchmark);
    return map;
  }, {});
  const entriesByBenchmark = entries.reduce((map, entry) => {
    const benchmarkId = String(entry.BenchmarkId || '');
    if (!map[benchmarkId]) map[benchmarkId] = [];
    map[benchmarkId].push(entry);
    return map;
  }, {});

  Object.keys(benchmarksByGoal).forEach(goalId => {
    const ordered = benchmarksByGoal[goalId].slice().sort((a, b) => {
      const aMatch = String(a.Category || '').match(/(\d+)/);
      const bMatch = String(b.Category || '').match(/(\d+)/);
      const aOrder = aMatch ? Number(aMatch[1]) : Number.MAX_SAFE_INTEGER;
      const bOrder = bMatch ? Number(bMatch[1]) : Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a._row - b._row;
    });
    const goal = goals.find(item => String(item.Id) === goalId);
    if (goal && !goal.BenchmarkActivationMode) {
      const ranges = new Set(ordered.map(benchmark =>
        formatDate_(benchmark.StartDate) + '|' + formatDate_(benchmark.DueDate)
      ));
      const completeDates = ordered.length && ordered.every(benchmark =>
        formatDate_(benchmark.StartDate) && formatDate_(benchmark.DueDate)
      );
      updateRow_('Goals', goal._row, {
        BenchmarkActivationMode: completeDates && (ordered.length === 1 || ranges.size > 1)
          ? 'DATE'
          : 'LEGACY'
      });
    }
    const phaseHistoryCandidates = ordered.filter(benchmark =>
      toBoolean_(benchmark.Active) ||
      (entriesByBenchmark[String(benchmark.Id)] || []).length
    );
    if (!phaseHistoryCandidates.length && ordered.length && goal && toBoolean_(goal.Active)) {
      phaseHistoryCandidates.push(ordered[0]);
    }
    const activationDates = phaseHistoryCandidates.map(benchmark => {
      const benchmarkEntries = entriesByBenchmark[String(benchmark.Id)] || [];
      const firstEntry = benchmarkEntries
        .map(entry => formatDate_(entry.ObservationDate || entry.Timestamp))
        .filter(Boolean)
        .sort()[0];
      return firstEntry || formatDate_(benchmark.StartDate) ||
        (goal ? formatDate_(goal.StartDate) : '') || formatDate_(new Date());
    });
    activationDates.forEach((date, index) => {
      if (index && date < activationDates[index - 1]) {
        activationDates[index] = activationDates[index - 1];
      }
    });
    ordered.forEach((benchmark, index) => {
      const sourceText = [
        benchmark.Description,
        benchmark.TaskDemandDescription,
        benchmark.Skill,
        benchmark.Category
      ].filter(Boolean).join(' ');
      const targetCorrect = optionalNumber_(benchmark.TargetCorrect);
      const targetAttempts = optionalNumber_(benchmark.TargetAttempts);
      const targetAccuracy = optionalNumber_(benchmark.TargetAccuracyPct);
      const requiredTrials = optionalInteger_(benchmark.RequiredTrials);
      const totalTrials = optionalInteger_(benchmark.TotalTrials);
      const hasExplicitAccuracy = /\b\d+(?:\.\d+)?\s*%\s*(?:accuracy|accurate|correct)?\b/i
        .test(sourceText);
      let consistencyPassed = optionalInteger_(benchmark.ConsistencyTrialsPassed);
      let consistencyWindow = optionalInteger_(benchmark.ConsistencyTrialsWindow);
      if (consistencyPassed === null && consistencyWindow === null &&
          requiredTrials !== null && totalTrials !== null && totalTrials > 0) {
        consistencyPassed = requiredTrials;
        consistencyWindow = totalTrials;
      } else if (consistencyPassed === null && consistencyWindow === null &&
          !hasExplicitAccuracy && targetCorrect !== null && targetAttempts !== null &&
          targetAttempts > 0) {
        consistencyPassed = Math.round(targetCorrect);
        consistencyWindow = Math.round(targetAttempts);
      }
      const archetype = normalizeGoalArchetype_(benchmark.GoalArchetype) ||
        inferBenchmarkArchetype_(sourceText);
      const patch = {};
      if (optionalNumber_(benchmark.OrderIndex) === null) patch.OrderIndex = index + 1;
      if (!String(benchmark.TaskDemandDescription || '').trim()) {
        patch.TaskDemandDescription = benchmark.Description || benchmark.Skill || '';
      }
      if (!benchmark.GoalArchetype) patch.GoalArchetype = archetype;
      if (!benchmark.EvaluationWindowUnit) {
        patch.EvaluationWindowUnit = inferEvaluationWindowUnit_(sourceText, archetype);
      }
      if (optionalInteger_(benchmark.TargetPromptCeiling) === null &&
          optionalInteger_(benchmark.TargetPromptCount) !== null) {
        patch.TargetPromptCeiling = optionalInteger_(benchmark.TargetPromptCount);
      }
      if (optionalInteger_(benchmark.ConsistencyTrialsPassed) === null &&
          consistencyPassed !== null) {
        patch.ConsistencyTrialsPassed = consistencyPassed;
      }
      if (optionalInteger_(benchmark.ConsistencyTrialsWindow) === null &&
          consistencyWindow !== null) {
        patch.ConsistencyTrialsWindow = consistencyWindow;
      }
      if (optionalInteger_(benchmark.TargetConsecutiveSessions) === null &&
          (targetAccuracy !== null || consistencyPassed !== null ||
           optionalInteger_(benchmark.TargetPromptCount) !== null ||
           normalizePromptLevel_(benchmark.TargetPromptLevel))) {
        patch.TargetConsecutiveSessions = 1;
      }
      if (!hasExplicitAccuracy && consistencyPassed !== null &&
          consistencyWindow !== null && targetAccuracy !== null &&
          targetCorrect !== null && targetAttempts !== null &&
          Math.abs(targetAccuracy - targetCorrect / targetAttempts * 100) < 0.01) {
        patch.TargetAccuracyPct = '';
      }
      if (Object.keys(patch).length) updateRow_('Benchmarks', benchmark._row, patch);
    });
    phaseHistoryCandidates.forEach((benchmark, index) => {
      if (!historyBenchmarkIds.has(String(benchmark.Id))) {
        appendRow_('GoalPhaseHistory', {
          Id: uuid_(),
          GoalId: goalId,
          BenchmarkId: benchmark.Id,
          ActivatedAt: activationDates[index],
          EndedAt: index < phaseHistoryCandidates.length - 1 ? activationDates[index + 1] : '',
          ChangedBy: '',
          ChangeReason: 'Migrated from V.O.I.C.E.S 2.2',
          Source: 'MIGRATION'
        });
        historyBenchmarkIds.add(String(benchmark.Id));
      }
    });
    const candidateOrder = phaseHistoryCandidates.reduce((map, benchmark, index) => {
      map[String(benchmark.Id)] = index;
      return map;
    }, {});
    const migratedHistory = rows_('GoalPhaseHistory')
      .filter(row =>
        String(row.GoalId) === String(goalId) &&
        String(row.Source).toUpperCase() === 'MIGRATION' &&
        candidateOrder[String(row.BenchmarkId)] !== undefined
      )
      .sort((a, b) =>
        candidateOrder[String(a.BenchmarkId)] - candidateOrder[String(b.BenchmarkId)]
      );
    migratedHistory.forEach((row, index) => {
      const endedAt = index < migratedHistory.length - 1
        ? migratedHistory[index + 1].ActivatedAt
        : '';
      if (String(row.EndedAt || '') !== String(endedAt || '')) {
        updateRow_('GoalPhaseHistory', row._row, { EndedAt: endedAt });
      }
    });
  });

  entries.forEach(entry => {
    const patch = {};
    if (!entry.ObservationDate) patch.ObservationDate = formatDate_(entry.Timestamp);
    if (!entry.Status) patch.Status = 'ACTIVE';
    if (Object.keys(patch).length) updateRow_('BenchmarkEntries', entry._row, patch);
  });

  rows_('DaySchedules').forEach(schedule => {
    const patch = {};
    if (optionalNumber_(schedule.Revision) === null) patch.Revision = 1;
    if (!schedule.UpdatedBy) patch.UpdatedBy = schedule.CreatedBy || '';
    if (!schedule.UpdatedAt) patch.UpdatedAt = new Date();
    if (Object.keys(patch).length) updateRow_('DaySchedules', schedule._row, patch);
  });

  upsertSetting_('SchemaVersion', '2.3');
}

function validateVoices23Database_() {
  const goals = rows_('Goals');
  const benchmarks = rows_('Benchmarks');
  const entries = rows_('BenchmarkEntries');
  const history = rows_('GoalPhaseHistory');
  const benchmarkSubjects = rows_('BenchmarkSubjects');
  const studentIds = new Set(rows_('Students').map(row => String(row.Id)));
  const subjectIds = new Set(rows_('Subjects').map(row => String(row.Id)));
  const goalIds = new Set(goals.map(row => String(row.Id)));
  const benchmarkIds = new Set(benchmarks.map(row => String(row.Id)));
  const benchmarkIndex = benchmarks.reduce((map, row) => {
    map[String(row.Id)] = row;
    return map;
  }, {});
  const invalidBenchmarks = benchmarks
    .filter(row => !goalIds.has(String(row.GoalId))).length;
  const invalidGoalStudents = goals
    .filter(row => !studentIds.has(String(row.StudentId))).length;
  const invalidBenchmarkStudents = benchmarks
    .filter(row => !studentIds.has(String(row.StudentId))).length;
  const invalidEntries = entries
    .filter(row => !benchmarkIds.has(String(row.BenchmarkId))).length;
  const invalidEntryStudents = entries
    .filter(row => !studentIds.has(String(row.StudentId))).length;
  const invalidBenchmarkSubjects = benchmarkSubjects.filter(row =>
    !benchmarkIds.has(String(row.BenchmarkId)) ||
    !subjectIds.has(String(row.SubjectId))
  ).length;
  const invalidHistory = history
    .filter(row =>
      !goalIds.has(String(row.GoalId)) ||
      !benchmarkIds.has(String(row.BenchmarkId)) ||
      String(benchmarkIndex[String(row.BenchmarkId)].GoalId) !== String(row.GoalId)
    ).length;
  const invalidArchetypes = benchmarks.filter(row =>
    !normalizeGoalArchetype_(row.GoalArchetype)
  ).length;
  const invalidEvaluationWindowUnits = benchmarks.filter(row =>
    !normalizeEvaluationWindowUnit_(row.EvaluationWindowUnit)
  ).length;
  const duplicateCount = rows => rows.length -
    new Set(rows.map(row => String(row.Id))).size;
  const invalidActivePhaseCounts = goals.filter(goal => {
    const status = String(goal.Status || (toBoolean_(goal.Active) ? 'ACTIVE' : 'INACTIVE'))
      .toUpperCase();
    if (status !== 'ACTIVE') return false;
    const goalBenchmarks = benchmarks.filter(row =>
      String(row.GoalId) === String(goal.Id)
    );
    if (!goalBenchmarks.length) return true;
    return goalBenchmarks.filter(row => toBoolean_(row.Active)).length !== 1;
  }).length;
  return {
    goals: goalIds.size,
    benchmarks: benchmarkIds.size,
    entries: entries.length,
    invalidBenchmarks: invalidBenchmarks,
    invalidGoalStudents: invalidGoalStudents,
    invalidBenchmarkStudents: invalidBenchmarkStudents,
    invalidEntries: invalidEntries,
    invalidEntryStudents: invalidEntryStudents,
    invalidBenchmarkSubjects: invalidBenchmarkSubjects,
    invalidPhaseHistory: invalidHistory,
    duplicateGoalIds: duplicateCount(goals),
    duplicateBenchmarkIds: duplicateCount(benchmarks),
    duplicateEntryIds: duplicateCount(entries),
    invalidActivePhaseCounts: invalidActivePhaseCounts,
    invalidArchetypes: invalidArchetypes,
    invalidEvaluationWindowUnits: invalidEvaluationWindowUnits
  };
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
  if (!findOne_('Settings', row => row.Key === 'SchoolQuarterBoundaries')) {
    appendRow_('Settings', {
      Key: 'SchoolQuarterBoundaries',
      Value: '[]'
    });
  }
  upsertSetting_('SchemaVersion', '2.3');

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
  if (values.length < 2) {
    if (VOICES_ROWS_CACHE) VOICES_ROWS_CACHE[name] = [];
    return [];
  }
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

function rowsByColumnValues_(name, columnName, values) {
  const selected = new Set((values || []).map(String).filter(Boolean));
  if (!selected.size) return [];
  if (VOICES_ROWS_CACHE && VOICES_ROWS_CACHE[name]) {
    return VOICES_ROWS_CACHE[name]
      .filter(row => selected.has(String(row[columnName])))
      .map(row => Object.assign({}, row));
  }
  const headers = SHEET_SCHEMAS[name];
  const column = headers ? headers.indexOf(columnName) : -1;
  const target = sheet_(name);
  const lastRow = target.getLastRow();
  if (column < 0) return [];
  if (lastRow < 2) {
    if (VOICES_ROWS_CACHE) VOICES_ROWS_CACHE[name] = [];
    return [];
  }
  const matchingRows = target.getRange(2, column + 1, lastRow - 1, 1)
    .getValues()
    .reduce((rows, value, index) => {
      const cell = value[0] instanceof Date ? formatDate_(value[0]) : String(value[0]);
      if (selected.has(cell)) rows.push(index + 2);
      return rows;
    }, []);
  if (!matchingRows.length) return [];
  const firstRow = matchingRows[0];
  const rowCount = matchingRows[matchingRows.length - 1] - firstRow + 1;
  return target.getRange(firstRow, 1, rowCount, headers.length)
    .getValues()
    .reduce((records, row, index) => {
      if (!row.some(value => value !== '')) return records;
      const keyValue = row[column] instanceof Date
        ? formatDate_(row[column])
        : String(row[column]);
      if (!selected.has(keyValue)) return records;
      const record = { _row: firstRow + index };
      headers.forEach((header, headerIndex) => {
        const value = row[headerIndex];
        record[header] = value instanceof Date ? formatDateTime_(value) : value;
      });
      records.push(record);
      return records;
    }, []);
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

function appendRows_(name, records) {
  if (!records || !records.length) return [];
  const headers = SHEET_SCHEMAS[name];
  if (!headers) throw new Error('Unknown schema: ' + name);
  const target = sheet_(name);
  const values = records.map(record =>
    headers.map(header => record[header] === undefined ? '' : record[header])
  );
  target.getRange(target.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  invalidateRowsCache_(name);
  return records;
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
    replaceRowsUnlocked_(name, predicate, replacementRows);
  } finally {
    lock.releaseLock();
  }
}

function replaceRowsUnlocked_(name, predicate, replacementRows) {
  const keep = rows_(name).filter(row => !predicate(row));
  const all = keep.concat(replacementRows || []);
  const sheet = sheet_(name);
  const headers = SHEET_SCHEMAS[name];
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).clearContent();
  }
  if (all.length) {
    const values = all.map(record =>
      headers.map(header => record[header] === undefined ? '' : record[header])
    );
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }
  invalidateRowsCache_(name);
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

function upsertSetting_(key, value) {
  const existing = findOne_('Settings', row => row.Key === key);
  if (existing) {
    if (String(existing.Value) !== String(value)) {
      updateRow_('Settings', existing._row, { Value: value });
    }
  } else {
    appendRow_('Settings', { Key: key, Value: value });
  }
}

function saveSetting(key, value) {
  requireCaseManager_();
  const existing = findOne_('Settings', row => row.Key === key);
  if (existing) {
    updateRow_('Settings', existing._row, { Value: sanitizeText_(value, 5000) });
  } else {
    appendRow_('Settings', { Key: sanitizeText_(key, 100), Value: sanitizeText_(value, 5000) });
  }
  invalidateAppDataCache_();
  return true;
}
