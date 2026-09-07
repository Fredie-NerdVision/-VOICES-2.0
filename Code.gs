const VOICES = Object.freeze({
  APP_NAME: 'V.O.I.C.E.S 2.0',
  RELEASE: '2.3',
  DATABASE_PROPERTY: 'VOICES_DATABASE_ID',
  LOGO_FILE_PROPERTY: 'VOICES_LOGO_FILE_ID',
  TIME_ZONE: Session.getScriptTimeZone(),
  PROMPT_LEVELS: Object.freeze([
    'Independent',
    'Verbal',
    'Gestural/Visual',
    'Model',
    'Physical'
  ]),
  GOAL_ARCHETYPES: Object.freeze([
    'DISCRETE_TRIAL',
    'PROMPT_FADE',
    'TASK_EXPANSION',
    'FREQUENCY_QUOTA'
  ]),
  EVALUATION_WINDOW_UNITS: Object.freeze([
    'SESSION',
    'DATA_DAY',
    'TWO_WEEK',
    'GRADING_PERIOD'
  ]),
  ROLES: Object.freeze({
    AIDE: 'AIDE',
    TEACHER: 'TEACHER',
    CASE_MANAGER: 'CASE_MANAGER'
  })
});

function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.defaultLogo = getDefaultLogoDataUri();
  return template.evaluate()
    .setTitle(VOICES.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getAppBootstrap(force) {
  return withRowsCache_(() => {
    const email = getCurrentUserEmail_();
    const staff = requireAuthorizedStaff_(email);
    const isCaseManager = staff.Role === VOICES.ROLES.CASE_MANAGER || toBoolean_(staff.IsAdmin);
    const now = new Date();
    const today = formatDate_(now);
    const timeBucket = Math.floor(now.getTime() / 300000);
    const producer = () => {
    const response = {
      appName: VOICES.APP_NAME,
      today: today,
      user: publicStaff_(staff),
      view: isCaseManager ? 'CASE_MANAGER' : 'AIDE',
      logo: getBrandingLogo_(false),
      dailyMessages: getDailyMessages_(today),
      criticalBenchmarks: [],
      subjects: [],
      classes: [],
      students: [],
      currentAssignment: null,
      benchmarkLookup: {
        currentClassId: '',
        currentStudentId: '',
        teachers: [],
        classes: []
      }
    };

    if (isCaseManager) {
      const students = managedStudents_(staff).map(publicStudent_);
      response.caseManager = {
        students: students,
        goals: [],
        benchmarks: [],
        toDos: [],
        staff: [],
        caseManagers: [],
        aides: [],
        scheduleTypes: [],
        requests: {
          pending: [],
          timeOffHistory: [],
          currentAvailability: []
        },
        messages: {
          messages: [],
          activeToday: []
        }
      };
    } else {
      const currentAssignment = getCurrentAssignment_(email, now);
      response.criticalBenchmarks = getCriticalBenchmarks_(staff);
      response.subjects = activeRows_('Subjects');
      response.classes = getClassesForStaff_(staff);
      response.students = getStudentsForStaff_(staff);
      response.currentAssignment = currentAssignment;
      response.benchmarkLookup = getBenchmarkLookupContext_(staff, currentAssignment);
      response.aide = {
        schedule: getStaffSchedule_(email, today),
        trainedStudents: getTrainedStudents_(email),
        openTimeEntry: getOpenTimeEntry_(email),
        currentPayPeriod: getPayPeriodSummary_(email, now)
      };
    }
    return response;
    };
    return cachedResponse_(
      'app-bootstrap',
      [email, today, timeBucket],
      producer,
      null,
      Boolean(force)
    );
  });
}

function getCaseManagerOverviewData() {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    return getCaseManagerOverviewData_(staff);
  });
}

function getCaseManagerOverviewData_(staff) {
  return {
    toDos: getCaseManagerTodos_(staff)
  };
}

function getCaseManagerEntryData() {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    return getCaseManagerEntryData_(staff);
  });
}

function getCaseManagerEntryData_(staff) {
  return {
    subjects: activeRows_('Subjects'),
    classes: getClassesForStaff_(staff),
    students: getStudentsForStaff_(staff),
    benchmarkLookup: getBenchmarkLookupContext_(staff, null)
  };
}

function getCaseManagerPeopleData() {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    return getCaseManagerPeopleData_(staff);
  });
}

function getCaseManagerPeopleData_(staff) {
  const staffRows = activeRows_('Staff');
  const isAdmin = toBoolean_(staff.IsAdmin);
  return {
    students: managedStudents_(staff).map(publicStudent_),
    staff: staffRows.map(publicStaff_)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    caseManagers: staffRows
      .filter(row => row.Role === VOICES.ROLES.CASE_MANAGER || toBoolean_(row.IsAdmin))
      .filter(row => isAdmin ||
        normalizeEmail_(row.Email) === normalizeEmail_(staff.Email))
      .map(publicStaff_)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    aides: staffRows
      .filter(row => row.Role === VOICES.ROLES.AIDE)
      .map(publicStaff_)
  };
}

function getCaseManagerWorkspaceData(force) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    const producer = () => ({
      generatedAt: new Date().toISOString(),
      overview: getCaseManagerOverviewData_(staff),
      entry: getCaseManagerEntryData_(staff),
      people: getCaseManagerPeopleData_(staff),
      requests: getStaffRequestData_(),
      messages: getMessageManagementData_(staff),
      ieps: getIepsForCurrentCaseManager_(staff),
      goals: getGoalManagerData_(staff, ''),
      scheduleTypes: getScheduleTypeSummaries_()
    });
    return cachedResponse_(
      'case-manager-workspace',
      [normalizeEmail_(staff.Email)],
      producer,
      null,
      Boolean(force)
    );
  });
}

function healthCheck() {
  return {
    ok: true,
    app: VOICES.APP_NAME,
    databaseConfigured: Boolean(PropertiesService.getScriptProperties().getProperty(VOICES.DATABASE_PROPERTY)),
    timestamp: new Date().toISOString()
  };
}

function getDefaultLogoDataUri() {
  return DEFAULT_LOGO_DATA_URI;
}

function publicStaff_(staff) {
  return {
    id: staff.Id,
    email: staff.Email,
    firstName: staff.FirstName,
    lastName: staff.LastName,
    displayName: [staff.FirstName, staff.LastName].filter(Boolean).join(' ') || staff.Email,
    role: staff.Role,
    isAdmin: toBoolean_(staff.IsAdmin),
    weeklyHours: staff.WeeklyHours === '' || staff.WeeklyHours === undefined
      ? null
      : toNumber_(staff.WeeklyHours)
  };
}

function getCurrentUserEmail_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Google Workspace identity was not available. Deploy the web app for your Workspace domain and require sign-in.');
  }
  return email;
}

function requireAuthorizedStaff_(email) {
  const staff = findOne_('Staff', row =>
    normalizeEmail_(row.Email) === normalizeEmail_(email) && toBoolean_(row.Active)
  );
  if (!staff) {
    throw new Error('Access denied. Your Google Workspace account is not on the active V.O.I.C.E.S staff whitelist.');
  }
  return staff;
}

function requireCaseManager_() {
  const staff = requireAuthorizedStaff_(getCurrentUserEmail_());
  if (staff.Role !== VOICES.ROLES.CASE_MANAGER && !toBoolean_(staff.IsAdmin)) {
    throw new Error('Case manager access is required.');
  }
  return staff;
}

function requireAdmin_() {
  const staff = requireAuthorizedStaff_(getCurrentUserEmail_());
  if (!toBoolean_(staff.IsAdmin)) {
    throw new Error('Administrator access is required.');
  }
  return staff;
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
}

function toNumber_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : (fallback || 0);
}

function optionalNumber_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uuid_() {
  return Utilities.getUuid();
}

function formatDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, VOICES.TIME_ZONE, 'yyyy-MM-dd');
}

function formatDateTime_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Utilities.formatDate(date, VOICES.TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function parseDate_(dateText) {
  const parts = String(dateText).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
}

function dateInRange_(dateText, start, end) {
  const date = parseDate_(dateText).getTime();
  const startTime = start ? parseDate_(formatDate_(start)).getTime() : -Infinity;
  const endTime = end ? parseDate_(formatDate_(end)).getTime() : Infinity;
  return date >= startTime && date <= endTime;
}

function sanitizeText_(value, maxLength) {
  const clean = String(value == null ? '' : value).trim();
  return clean.slice(0, maxLength || 2000);
}

function assertRequired_(payload, fields) {
  fields.forEach(field => {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      throw new Error(field + ' is required.');
    }
  });
}
