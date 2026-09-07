function saveDailyMessage(payload) {
  const staff = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['message', 'startDate', 'endDate']);
  if (parseDate_(payload.endDate) < parseDate_(payload.startDate)) {
    throw new Error('Message end date must be on or after its start date.');
  }
  const record = {
    Message: sanitizeText_(payload.message, 1500),
    StartDate: payload.startDate,
    EndDate: payload.endDate,
    Active: payload.active === undefined ? true : Boolean(payload.active)
  };
  if (payload.id) {
    const existing = findOne_('Messages', row => String(row.Id) === String(payload.id));
    if (!existing) throw new Error('Message was not found.');
    updateRow_('Messages', existing._row, record);
    invalidateAppDataCache_();
    return { ok: true, id: existing.Id };
  }
  record.Id = uuid_();
  record.CreatedBy = staff.Email;
  record.CreatedAt = new Date();
  appendRow_('Messages', record);
  invalidateAppDataCache_();
  return { ok: true, id: record.Id };
}

function getDailyMessages_(dateText) {
  const staffIndex = staffByEmail_();
  return rows_('Messages')
    .filter(row => toBoolean_(row.Active) && dateInRange_(dateText, row.StartDate, row.EndDate))
    .sort((a, b) => String(b.CreatedAt).localeCompare(String(a.CreatedAt)))
    .map(row => publicMessage_(row, staffIndex));
}

function getMessageManagementData() {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    return getMessageManagementData_(staff);
  });
}

function getMessageManagementData_(staff) {
  const today = formatDate_(new Date());
  const staffIndex = staffByEmail_();
  const messages = rows_('Messages')
    .sort((a, b) => String(b.CreatedAt).localeCompare(String(a.CreatedAt)))
    .map(row => publicMessage_(row, staffIndex));
  const result = {
    messages: messages,
    activeToday: messages.filter(row =>
      row.active && dateInRange_(today, row.startDate, row.endDate)
    )
  };
  if (staff && toBoolean_(staff.IsAdmin)) {
    result.catalog = getAdminCatalogData_();
  }
  return result;
}

function getAdminCatalogData_() {
  const staff = activeRows_('Staff')
    .filter(row =>
      row.Role === VOICES.ROLES.TEACHER ||
      row.Role === VOICES.ROLES.CASE_MANAGER ||
      toBoolean_(row.IsAdmin)
    )
    .map(publicStaff_)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const subjects = activeRows_('Subjects')
    .map(row => ({ id: row.Id, name: row.Name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const subjectIndex = indexBy_(activeRows_('Subjects'), 'Id');
  const classes = activeRows_('Classes')
    .map(row => ({
      id: row.Id,
      name: row.Name,
      subjectId: row.SubjectId,
      subjectName: subjectIndex[row.SubjectId] ? subjectIndex[row.SubjectId].Name : '',
      teacherEmail: normalizeEmail_(row.TeacherEmail),
      periodId: row.PeriodId
    }))
    .sort((a, b) =>
      a.teacherEmail.localeCompare(b.teacherEmail) ||
      String(a.periodId).localeCompare(String(b.periodId), undefined, { numeric: true })
    );
  const periods = Array.from(new Set(
    rows_('SchedulePeriods').map(row => String(row.PeriodId || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    staff: staff,
    subjects: subjects,
    classes: classes,
    periods: periods,
    quarterBoundaries: getSchoolQuarterBoundaries_()
  };
}

function saveSchoolQuarterBoundaries(payload) {
  requireAdmin_();
  const boundaries = Array.isArray(payload && payload.boundaries)
    ? payload.boundaries.map(formatDate_).filter(Boolean)
    : [];
  if (boundaries.length !== 5) {
    throw new Error('Configure Q1, Q2, Q3, Q4, and the next school-year start date.');
  }
  if (new Set(boundaries).size !== boundaries.length ||
      boundaries.some((date, index) => index && date <= boundaries[index - 1])) {
    throw new Error('Quarter boundaries must be five unique dates in chronological order.');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return {
      ok: false,
      code: 'WRITE_BUSY',
      retryable: true,
      message: 'Quarter settings are busy. Retry shortly.'
    };
  }
  try {
    invalidateRowsCache_('Settings');
    upsertSetting_('SchoolQuarterBoundaries', JSON.stringify(boundaries));
    invalidateRowsCache_('Settings');
    invalidateAppDataCache_();
    return { ok: true, boundaries: boundaries };
  } finally {
    lock.releaseLock();
  }
}

function installMissingBenchmarkObservationTrigger() {
  requireAdmin_();
  ScriptApp.getProjectTriggers()
    .filter(trigger =>
      trigger.getHandlerFunction() === 'checkMissingBenchmarkObservations'
    )
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('checkMissingBenchmarkObservations')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();
  return { ok: true, handler: 'checkMissingBenchmarkObservations' };
}

function previewAdminCatalogBatch(payload) {
  requireAdmin_();
  return validateAdminCatalogBatch_(payload);
}

function saveAdminCatalogBatch(payload) {
  requireAdmin_();
  const validation = validateAdminCatalogBatch_(payload);
  if (!validation.ok) return validation;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return {
      ok: false,
      code: 'WRITE_BUSY',
      retryable: true,
      message: 'Catalog saving is busy. The validated batch is still available; retry shortly.'
    };
  }
  try {
    ['Subjects', 'Classes'].forEach(invalidateRowsCache_);
    const subjects = activeRows_('Subjects');
    const subjectByName = subjects.reduce((map, row) => {
      map[normalizeCatalogName_(row.Name)] = row;
      return map;
    }, {});
    let subjectsCreated = 0;
    validation.subjects.forEach(item => {
      const key = normalizeCatalogName_(item.name);
      if (subjectByName[key]) return;
      const record = { Id: uuid_(), Name: item.name, Active: true };
      appendRow_('Subjects', record);
      subjectByName[key] = record;
      subjectsCreated += 1;
    });

    invalidateRowsCache_('Subjects');
    invalidateRowsCache_('Classes');
    const existingByTeacherPeriod = activeRows_('Classes').reduce((map, row) => {
      map[normalizeEmail_(row.TeacherEmail) + '|' + String(row.PeriodId)] = row;
      return map;
    }, {});
    let classesCreated = 0;
    validation.classes.forEach(item => {
      const key = item.teacherEmail + '|' + item.periodId;
      const existing = existingByTeacherPeriod[key];
      const subject = subjectByName[normalizeCatalogName_(item.subjectName)];
      if (existing) return;
      const record = {
        Id: uuid_(),
        Name: item.name,
        SubjectId: subject.Id,
        TeacherEmail: item.teacherEmail,
        PeriodId: item.periodId,
        Active: true
      };
      appendRow_('Classes', record);
      existingByTeacherPeriod[key] = record;
      classesCreated += 1;
    });
    invalidateRowsCache_('Subjects');
    invalidateRowsCache_('Classes');
    invalidateScheduleCache_();
    return {
      ok: true,
      subjectsCreated: subjectsCreated,
      classesCreated: classesCreated,
      subjectsTotal: validation.subjects.length,
      classesTotal: validation.classes.length
    };
  } finally {
    lock.releaseLock();
  }
}

function validateAdminCatalogBatch_(payload) {
  payload = payload || {};
  const sourceSubjects = Array.isArray(payload.subjects) ? payload.subjects : [];
  const sourceClasses = Array.isArray(payload.classes) ? payload.classes : [];
  if (!sourceSubjects.length && !sourceClasses.length) {
    throw new Error('Add at least one subject or class.');
  }
  if (sourceSubjects.length > 100 || sourceClasses.length > 200) {
    throw new Error('Submit no more than 100 subjects and 200 classes at a time.');
  }
  const activeSubjects = activeRows_('Subjects');
  const subjectByName = activeSubjects.reduce((map, row) => {
    map[normalizeCatalogName_(row.Name)] = row;
    return map;
  }, {});
  const staffByEmail = activeRows_('Staff').reduce((map, row) => {
    map[normalizeEmail_(row.Email)] = row;
    return map;
  }, {});
  const periodIds = new Set(
    rows_('SchedulePeriods').map(row => String(row.PeriodId || '').trim()).filter(Boolean)
  );
  const existingByTeacherPeriod = activeRows_('Classes').reduce((map, row) => {
    map[normalizeEmail_(row.TeacherEmail) + '|' + String(row.PeriodId)] = row;
    return map;
  }, {});
  const errors = [];
  const subjects = [];
  const batchSubjects = {};
  sourceSubjects.forEach((item, index) => {
    const name = sanitizeText_(
      typeof item === 'string' ? item : item && item.name,
      200
    );
    if (!name) {
      errors.push({ section: 'Subject', row: index + 1, message: 'Name is required.' });
      return;
    }
    const key = normalizeCatalogName_(name);
    if (batchSubjects[key]) {
      errors.push({ section: 'Subject', row: index + 1, message: 'Duplicate subject name in this batch.' });
      return;
    }
    batchSubjects[key] = true;
    subjects.push({ name: name, exists: Boolean(subjectByName[key]) });
  });
  const availableSubjectNames = Object.assign({}, subjectByName);
  subjects.forEach(item => {
    availableSubjectNames[normalizeCatalogName_(item.name)] =
      availableSubjectNames[normalizeCatalogName_(item.name)] || item;
  });
  const classes = [];
  const batchTeacherPeriods = {};
  sourceClasses.forEach((item, index) => {
    item = item || {};
    const name = sanitizeText_(item.name, 200);
    const subjectName = sanitizeText_(item.subjectName, 200);
    const teacherEmail = normalizeEmail_(item.teacherEmail);
    const periodId = sanitizeText_(item.periodId, 100);
    if (!name || !subjectName || !teacherEmail || !periodId) {
      errors.push({
        section: 'Class',
        row: index + 1,
        message: 'ClassName, Subject, TeacherEmail, and PeriodId are required.'
      });
      return;
    }
    const teacher = staffByEmail[teacherEmail];
    if (!teacher ||
        ![VOICES.ROLES.TEACHER, VOICES.ROLES.CASE_MANAGER].includes(teacher.Role) &&
        !toBoolean_(teacher.IsAdmin)) {
      errors.push({ section: 'Class', row: index + 1, message: 'TeacherEmail must match active instructional staff.' });
      return;
    }
    if (!periodIds.has(periodId)) {
      errors.push({ section: 'Class', row: index + 1, message: 'PeriodId must match a configured schedule period.' });
      return;
    }
    const subject = availableSubjectNames[normalizeCatalogName_(subjectName)];
    if (!subject) {
      errors.push({ section: 'Class', row: index + 1, message: 'Subject must match an existing or batched subject name.' });
      return;
    }
    const key = teacherEmail + '|' + periodId;
    if (batchTeacherPeriods[key]) {
      errors.push({ section: 'Class', row: index + 1, message: 'A teacher can only have one class per period in a batch.' });
      return;
    }
    batchTeacherPeriods[key] = true;
    const existing = existingByTeacherPeriod[key];
    if (existing) {
      const existingSubject = subjectByName[normalizeCatalogName_(subjectName)];
      if (String(existing.Name) !== name ||
          !existingSubject ||
          String(existing.SubjectId) !== String(existingSubject.Id)) {
        errors.push({
          section: 'Class',
          row: index + 1,
          message: 'This teacher and period already belong to a different active class.'
        });
        return;
      }
    }
    classes.push({
      name: name,
      subjectName: subjectName,
      teacherEmail: teacherEmail,
      periodId: periodId,
      exists: Boolean(existing)
    });
  });
  return {
    ok: !errors.length,
    errors: errors,
    subjects: subjects,
    classes: classes,
    subjectCount: subjects.length,
    classCount: classes.length
  };
}

function normalizeCatalogName_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function setDailyMessageActive(payload) {
  requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['id']);
  const existing = findOne_('Messages', row => String(row.Id) === String(payload.id));
  if (!existing) throw new Error('Message was not found.');
  updateRow_('Messages', existing._row, { Active: toBoolean_(payload.active) });
  invalidateAppDataCache_();
  return { ok: true };
}

function staffByEmail_() {
  return rows_('Staff').reduce((map, row) => {
    map[normalizeEmail_(row.Email)] = row;
    return map;
  }, {});
}

function publicMessage_(row, staffIndex) {
  const creator = staffIndex[normalizeEmail_(row.CreatedBy)];
  const fallback = String(row.CreatedBy || '').split('@')[0];
  const lastName = creator
    ? String(creator.LastName || creator.FirstName || '').trim()
    : fallback;
  return {
    id: row.Id,
    message: row.Message,
    startDate: formatDate_(row.StartDate),
    endDate: formatDate_(row.EndDate),
    active: toBoolean_(row.Active),
    createdBy: row.CreatedBy,
    creatorLastName: lastName,
    createdAt: row.CreatedAt
  };
}

function saveBrandingLogo(payload) {
  requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['dataUrl', 'fileName']);
  const match = String(payload.dataUrl).match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) throw new Error('Upload a PNG, JPEG, or WebP image.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 2 * 1024 * 1024) throw new Error('Logo must be smaller than 2 MB.');

  const folder = getOrCreateAppFolder_();
  const blob = Utilities.newBlob(bytes, match[1], sanitizeText_(payload.fileName, 120));
  const file = folder.createFile(blob);
  const staffEmails = activeRows_('Staff').map(row => normalizeEmail_(row.Email)).filter(Boolean);
  if (staffEmails.length) {
    try {
      file.addViewers(staffEmails);
    } catch (error) {
      console.warn('Logo sharing could not be updated: ' + error.message);
    }
  }
  const previousId = PropertiesService.getScriptProperties().getProperty(VOICES.LOGO_FILE_PROPERTY);
  PropertiesService.getScriptProperties().setProperty(VOICES.LOGO_FILE_PROPERTY, file.getId());
  if (previousId) {
    try {
      DriveApp.getFileById(previousId).setTrashed(true);
    } catch (error) {
      console.warn('Previous logo could not be removed: ' + error.message);
    }
  }
  invalidateAppDataCache_();
  return { ok: true, logo: dataUriFromFile_(file) };
}

function getBrandingLogo_(useDefault) {
  const fileId = PropertiesService.getScriptProperties().getProperty(VOICES.LOGO_FILE_PROPERTY);
  if (!fileId) return useDefault === false ? '' : getDefaultLogoDataUri();
  try {
    return dataUriFromFile_(DriveApp.getFileById(fileId));
  } catch (error) {
    return useDefault === false ? '' : getDefaultLogoDataUri();
  }
}

function dataUriFromFile_(file) {
  const blob = file.getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

function getOrCreateAppFolder_() {
  const name = 'VOICES 2.2 App Files';
  const folders = DriveApp.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(name);
}

function getStaffRequestData_() {
  const staff = activeRows_('Staff').reduce((map, row) => {
    map[normalizeEmail_(row.Email)] = row;
    return map;
  }, {});
  const timeOff = rows_('TimeOffRequests')
    .map(row => ({
      id: row.Id,
      requestType: 'TIME_OFF',
      aideEmail: row.AideEmail,
      aideName: staff[normalizeEmail_(row.AideEmail)]
        ? publicStaff_(staff[normalizeEmail_(row.AideEmail)]).displayName
        : row.AideEmail,
      summary: row.StartDate + ' to ' + row.EndDate + ' · ' + row.Type,
      startDate: formatDate_(row.StartDate),
      endDate: formatDate_(row.EndDate),
      type: row.Type,
      hasHours: toBoolean_(row.HasHours),
      reason: row.Reason,
      status: row.Status,
      reviewedBy: row.ReviewedBy,
      reviewedAt: row.ReviewedAt,
      createdAt: row.CreatedAt
    }))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const availability = rows_('Availability')
    .map(row => ({
      id: row.Id,
      requestType: 'AVAILABILITY',
      aideEmail: row.AideEmail,
      aideName: staff[normalizeEmail_(row.AideEmail)]
        ? publicStaff_(staff[normalizeEmail_(row.AideEmail)]).displayName
        : row.AideEmail,
      summary: row.DayOfWeek + ' · ' + (toBoolean_(row.Available)
        ? row.StartTime + '–' + row.EndTime
        : 'Not available'),
      dayOfWeek: String(row.DayOfWeek).toUpperCase(),
      available: toBoolean_(row.Available),
      startTime: normalizeTime_(row.StartTime),
      endTime: normalizeTime_(row.EndTime),
      reason: '',
      status: row.Status,
      reviewedBy: row.ReviewedBy,
      reviewedAt: row.ReviewedAt,
      createdAt: row.SubmittedAt
    }))
    .sort((a, b) =>
      a.aideName.localeCompare(b.aideName) ||
      availabilityDayOrder_(a.dayOfWeek) - availabilityDayOrder_(b.dayOfWeek)
    );
  return {
    pending: timeOff.concat(availability)
      .filter(row => row.status === 'PENDING')
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
    timeOffHistory: timeOff,
    currentAvailability: availability.filter(row => row.status === 'APPROVED')
  };
}

function getStaffRequestData() {
  return withRowsCache_(() => {
    requireCaseManager_();
    return getStaffRequestData_();
  });
}

function availabilityDayOrder_(day) {
  return ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].indexOf(day);
}

function reviewStaffRequest(payload) {
  const reviewer = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['requestType', 'id', 'decision']);
  const decision = String(payload.decision).toUpperCase();
  const requestType = String(payload.requestType).toUpperCase();
  if (!['APPROVED', 'DENIED'].includes(decision)) throw new Error('Decision must be APPROVED or DENIED.');
  if (!['TIME_OFF', 'AVAILABILITY'].includes(requestType)) throw new Error('Invalid request type.');
  const sheetName = requestType === 'TIME_OFF' ? 'TimeOffRequests' : 'Availability';
  const request = findOne_(sheetName, row => String(row.Id) === String(payload.id));
  if (!request) throw new Error('Request was not found.');
  if (request.Status !== 'PENDING') throw new Error('This request has already been reviewed.');
  if (sheetName === 'Availability' && decision === 'APPROVED') {
    rows_('Availability')
      .filter(row =>
        row.Status === 'APPROVED' &&
        normalizeEmail_(row.AideEmail) === normalizeEmail_(request.AideEmail) &&
        row.DayOfWeek === request.DayOfWeek
      )
      .forEach(row => updateRow_('Availability', row._row, { Status: 'SUPERSEDED' }));
  }
  updateRow_(sheetName, request._row, {
    Status: decision,
    ReviewedBy: reviewer.Email,
    ReviewedAt: new Date()
  });
  sendEmail_(
    request.AideEmail,
    'V.O.I.C.E.S request ' + decision.toLowerCase(),
    'Your ' + requestType.toLowerCase().replace('_', ' ') + ' request was ' + decision.toLowerCase() + '.'
  );
  invalidateScheduleCache_();
  return { ok: true };
}

function upsertStaff(payload) {
  const actor = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['email', 'firstName', 'role']);
  const email = normalizeEmail_(payload.email);
  if (!['AIDE', 'TEACHER', 'CASE_MANAGER'].includes(payload.role)) throw new Error('Invalid role.');
  const existing = findOne_('Staff', row => normalizeEmail_(row.Email) === email);
  const isAdmin = toBoolean_(payload.isAdmin);
  const isActive = payload.active === undefined ? true : toBoolean_(payload.active);
  const weeklyHours = payload.weeklyHours === '' || payload.weeklyHours === undefined
    ? ''
    : Number(payload.weeklyHours);
  if (weeklyHours !== '' && (!Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > 80)) {
    throw new Error('Weekly hours must be between 0 and 80.');
  }
  if (payload.role === VOICES.ROLES.AIDE && weeklyHours === '') {
    throw new Error('Weekly hours are required for aides.');
  }
  const isSelf = email === normalizeEmail_(actor.Email);
  if (isSelf && (payload.role !== VOICES.ROLES.CASE_MANAGER || !isActive)) {
    throw new Error('You cannot remove your own case-manager access.');
  }
  if (isSelf && toBoolean_(actor.IsAdmin) && !isAdmin) {
    throw new Error('You cannot remove your own administrator access.');
  }
  if (!toBoolean_(actor.IsAdmin) && isAdmin) {
    throw new Error('Only an administrator can grant administrator access.');
  }
  if (existing && toBoolean_(existing.IsAdmin) && !toBoolean_(actor.IsAdmin)) {
    throw new Error('Only an administrator can edit another administrator.');
  }
  const record = {
    Email: email,
    FirstName: sanitizeText_(payload.firstName, 100),
    LastName: sanitizeText_(payload.lastName, 100),
    Role: payload.role,
    IsAdmin: isAdmin,
    Active: isActive,
    WeeklyHours: payload.role === VOICES.ROLES.AIDE ? weeklyHours : ''
  };
  if (existing) {
    updateRow_('Staff', existing._row, record);
    invalidateScheduleCache_();
    return { ok: true, id: existing.Id };
  }
  record.Id = uuid_();
  appendRow_('Staff', record);
  invalidateScheduleCache_();
  return { ok: true, id: record.Id };
}

function deleteStaff(email) {
  const actor = requireCaseManager_();
  const normalizedEmail = normalizeEmail_(email);
  if (normalizedEmail === normalizeEmail_(actor.Email)) {
    throw new Error('You cannot remove your own access.');
  }
  const existing = findOne_('Staff', row => normalizeEmail_(row.Email) === normalizedEmail);
  if (!existing) throw new Error('Staff member was not found.');
  if (toBoolean_(existing.IsAdmin) && !toBoolean_(actor.IsAdmin)) {
    throw new Error('Only an administrator can remove another administrator.');
  }
  updateRow_('Staff', existing._row, { Active: false });
  invalidateScheduleCache_();
  return { ok: true };
}

function upsertStudent(payload) {
  const staff = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['name', 'caseManagerEmail']);
  const record = {
    Name: sanitizeText_(payload.name, 200),
    CaseManagerEmail: normalizeEmail_(payload.caseManagerEmail),
    IsOneToOne: toBoolean_(payload.isOneToOne),
    Active: payload.active === undefined ? true : toBoolean_(payload.active)
  };
  const assignedManager = findOne_('Staff', row =>
    normalizeEmail_(row.Email) === record.CaseManagerEmail &&
    (row.Role === VOICES.ROLES.CASE_MANAGER || toBoolean_(row.IsAdmin)) &&
    toBoolean_(row.Active)
  );
  if (!assignedManager) throw new Error('Choose an active case manager.');
  if (!toBoolean_(staff.IsAdmin) &&
      normalizeEmail_(record.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only create or update your own assigned students.');
  }
  if (payload.id) {
    const existing = findOne_('Students', row => String(row.Id) === String(payload.id));
    if (!existing) throw new Error('Student was not found.');
    if (!toBoolean_(staff.IsAdmin) &&
        normalizeEmail_(existing.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
      throw new Error('You can only update your own assigned students.');
    }
    updateRow_('Students', existing._row, record);
    invalidateScheduleCache_();
    return { ok: true, id: existing.Id };
  }
  record.Id = uuid_();
  appendRow_('Students', record);
  invalidateScheduleCache_();
  return { ok: true, id: record.Id };
}

function deleteStudent(studentId) {
  const staff = requireCaseManager_();
  const student = findOne_('Students', row => String(row.Id) === String(studentId));
  if (!student) throw new Error('Student was not found.');
  if (!toBoolean_(staff.IsAdmin) &&
      normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only remove your own assigned students.');
  }
  updateRow_('Students', student._row, { Active: false });
  invalidateScheduleCache_();
  return { ok: true };
}

function sendEmail_(to, subject, body) {
  const recipients = String(to || '').split(',').map(normalizeEmail_).filter(Boolean);
  if (!recipients.length) return;
  MailApp.sendEmail({
    to: recipients.join(','),
    subject: subject,
    body: body,
    name: VOICES.APP_NAME
  });
}

function caseManagerEmails_() {
  const configured = String(settingsMap_().CaseManagerAlertEmails || '')
    .split(',')
    .map(normalizeEmail_)
    .filter(Boolean);
  const staffEmails = activeRows_('Staff')
    .filter(row => row.Role === VOICES.ROLES.CASE_MANAGER)
    .map(row => normalizeEmail_(row.Email));
  return Array.from(new Set(configured.concat(staffEmails))).filter(Boolean);
}
