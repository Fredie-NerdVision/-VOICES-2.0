function getScheduleTypes_() {
  const periods = rows_('SchedulePeriods');
  const assignments = rows_('Assignments');
  return activeRows_('ScheduleTypes').map(type => ({
    id: type.Id,
    name: type.Name,
    isDefault: toBoolean_(type.IsDefault),
    periods: periods
      .filter(row => String(row.ScheduleTypeId) === String(type.Id))
      .sort((a, b) => toNumber_(a.SortOrder) - toNumber_(b.SortOrder))
      .map(publicPeriod_),
    assignments: assignments
      .filter(row => String(row.DayScheduleId) === String(type.Id) && !row.Date)
      .map(publicAssignment_)
  }));
}

function publicPeriod_(row) {
  return {
    periodId: row.PeriodId,
    label: row.Label,
    startTime: normalizeTime_(row.StartTime),
    endTime: normalizeTime_(row.EndTime),
    sortOrder: toNumber_(row.SortOrder)
  };
}

function getScheduleBuilderData(dateText) {
  return withRowsCache_(() => {
    requireCaseManager_();
    const date = dateText || formatDate_(new Date());
    return {
      date: date,
      schedule: getDaySchedule_(date),
      scheduleTypes: getScheduleTypes_(),
      aides: activeRows_('Staff')
        .filter(row => row.Role === VOICES.ROLES.AIDE)
        .map(publicStaff_),
      classes: getAllClasses_(),
      oneToOneStudents: activeRows_('Students')
        .filter(row => toBoolean_(row.IsOneToOne))
        .map(publicStudent_),
      training: rows_('AideTraining').map(row => ({
        aideEmail: normalizeEmail_(row.AideEmail),
        studentId: row.StudentId
      })),
      staffingStatus: getScheduleStaffingStatus_(date),
      dailyHours: getDailyHoursForDate_(date),
      unavailable: getUnavailableAidesForDate_(date),
      unassignedOneToOnes: getUnassignedOneToOnes_(date),
      week: getWeeklyScheduleData_(date)
    };
  });
}

function getScheduleStaffingStatus_(dateText) {
  const dayName = dayName_(dateText);
  const timeOff = rows_('TimeOffRequests');
  const availability = rows_('Availability');
  return activeRows_('Staff')
    .filter(row => row.Role === VOICES.ROLES.AIDE)
    .map(aide => {
      const email = normalizeEmail_(aide.Email);
      const approvedTimeOff = timeOff.find(row =>
        normalizeEmail_(row.AideEmail) === email &&
        String(row.Status).toUpperCase() === 'APPROVED' &&
        dateInRange_(dateText, row.StartDate, row.EndDate)
      );
      const pendingTimeOff = timeOff.find(row =>
        normalizeEmail_(row.AideEmail) === email &&
        String(row.Status).toUpperCase() === 'PENDING' &&
        dateInRange_(dateText, row.StartDate, row.EndDate)
      );
      const approvedAvailability = availability.find(row =>
        normalizeEmail_(row.AideEmail) === email &&
        String(row.Status).toUpperCase() === 'APPROVED' &&
        String(row.DayOfWeek).toUpperCase() === dayName
      );
      const pendingAvailability = availability.find(row =>
        normalizeEmail_(row.AideEmail) === email &&
        String(row.Status).toUpperCase() === 'PENDING' &&
        String(row.DayOfWeek).toUpperCase() === dayName
      );
      return {
        email: email,
        effectiveHours: getEffectiveDailyHours_(dateText, email),
        approvedTimeOff: approvedTimeOff ? {
          type: approvedTimeOff.Type,
          startDate: formatDate_(approvedTimeOff.StartDate),
          endDate: formatDate_(approvedTimeOff.EndDate),
          reason: approvedTimeOff.Reason
        } : null,
        pendingTimeOff: pendingTimeOff ? {
          type: pendingTimeOff.Type,
          startDate: formatDate_(pendingTimeOff.StartDate),
          endDate: formatDate_(pendingTimeOff.EndDate),
          reason: pendingTimeOff.Reason
        } : null,
        approvedAvailability: approvedAvailability ? {
          available: toBoolean_(approvedAvailability.Available),
          startTime: normalizeTime_(approvedAvailability.StartTime),
          endTime: normalizeTime_(approvedAvailability.EndTime)
        } : null,
        pendingAvailability: pendingAvailability ? {
          available: toBoolean_(pendingAvailability.Available),
          startTime: normalizeTime_(pendingAvailability.StartTime),
          endTime: normalizeTime_(pendingAvailability.EndTime)
        } : null
      };
    });
}

function getFullSchedule(dateText) {
  return withRowsCache_(() => {
    requireAuthorizedStaff_(getCurrentUserEmail_());
    const date = dateText || formatDate_(new Date());
    const schedule = getDaySchedule_(date);
    const staff = activeRows_('Staff').reduce((map, row) => {
      map[normalizeEmail_(row.Email)] = publicStaff_(row);
      return map;
    }, {});
    return {
      date: date,
      name: schedule.name,
      periods: schedule.periods,
      assignments: schedule.assignments.map(item => Object.assign({}, item, {
        aideName: staff[normalizeEmail_(item.aideEmail)]
          ? staff[normalizeEmail_(item.aideEmail)].displayName
          : item.aideEmail
      }))
    };
  });
}

function getWeeklyScheduleData(dateText) {
  return withRowsCache_(() => {
    requireCaseManager_();
    return getWeeklyScheduleData_(dateText || formatDate_(new Date()));
  });
}

function getAideWeek(dateText) {
  return withRowsCache_(() => {
    const email = getCurrentUserEmail_();
    const staff = requireAuthorizedStaff_(email);
    const week = getWeeklyScheduleData_(dateText || formatDate_(new Date()));
    const aide = week.aides.find(item => normalizeEmail_(item.email) === email) || publicStaff_(staff);
    const summary = week.summary.aides.find(item => normalizeEmail_(item.email) === email) || {
      email: email,
      displayName: aide.displayName,
      capacityHours: aide.weeklyHours,
      assignedHours: 0,
      deltaHours: aide.weeklyHours == null ? null : -aide.weeklyHours,
      status: aide.weeklyHours == null ? 'UNSET' : 'UNDER',
      byDay: []
    };
    return {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      aide: aide,
      assignedHours: summary.assignedHours,
      capacityHours: summary.capacityHours,
      deltaHours: summary.deltaHours,
      status: summary.status,
      days: week.days.map(day => {
        const daySummary = summary.byDay.find(item => item.date === day.date) || {};
        return {
          date: day.date,
          dayName: day.dayName,
          name: day.name,
          source: day.source,
          hours: daySummary.hours || 0,
          conflicts: day.conflicts.filter(item => normalizeEmail_(item.email) === email),
          periods: day.periods.map(period => ({
            periodId: period.periodId,
            label: period.label,
            startTime: period.startTime,
            endTime: period.endTime,
            assignment: day.assignments.find(item =>
              normalizeEmail_(item.aideEmail) === email &&
              String(item.periodId) === String(period.periodId)
            ) || null
          }))
        };
      })
    };
  });
}

function previewWeeklyHours(payload) {
  return withRowsCache_(() => {
    requireCaseManager_();
    payload = payload || {};
    assertRequired_(payload, ['date', 'periods', 'assignments']);
    if (!Array.isArray(payload.periods) || !Array.isArray(payload.assignments)) {
      throw new Error('Schedule periods and assignments must be lists.');
    }
    const week = buildWeeklyScheduleData_(payload.date);
    const draftDay = publicDraftScheduleDay_(
      payload.date,
      payload.periods,
      payload.assignments,
      payload.dailyHours || []
    );
    week.days = week.days.map(day => day.date === payload.date ? draftDay : day);
    week.summary = summarizeWeeklySchedule_(week.days, week.aides);
    return week.summary;
  });
}

function getWeeklyScheduleData_(dateText) {
  const weekStart = weekStart_(dateText);
  const cache = CacheService.getScriptCache();
  const cacheKey = 'voices-week-' + weekStart + '-v' + getScheduleCacheVersion_();
  try {
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.warn('Weekly schedule cache read failed: ' + error.message);
  }
  const result = buildWeeklyScheduleData_(dateText);
  const serialized = JSON.stringify(result);
  if (serialized.length < 90000) {
    try {
      cache.put(cacheKey, serialized, 300);
    } catch (error) {
      console.warn('Weekly schedule cache write failed: ' + error.message);
    }
  }
  return result;
}

function buildWeeklyScheduleData_(dateText) {
  const weekStart = weekStart_(dateText);
  const dates = weekDates_(weekStart);
  const indexes = buildWeeklyScheduleIndexes_();
  const days = dates.map(date => resolveWeeklyScheduleDay_(date, indexes));
  const aides = indexes.aides.map(publicStaff_);
  return {
    weekStart: weekStart,
    weekEnd: dates[dates.length - 1],
    days: days,
    aides: aides,
    summary: summarizeWeeklySchedule_(days, aides)
  };
}

function buildWeeklyScheduleIndexes_() {
  const scheduleTypes = activeRows_('ScheduleTypes');
  const defaultType = scheduleTypes.find(row => toBoolean_(row.IsDefault)) || scheduleTypes[0] || null;
  const periodsBySchedule = rows_('SchedulePeriods').reduce((map, row) => {
    const id = String(row.ScheduleTypeId);
    if (!map[id]) map[id] = [];
    map[id].push(row);
    return map;
  }, {});
  Object.keys(periodsBySchedule).forEach(id => periodsBySchedule[id]
    .sort((a, b) => toNumber_(a.SortOrder) - toNumber_(b.SortOrder)));
  const assignmentsBySchedule = rows_('Assignments').reduce((map, row) => {
    const id = String(row.DayScheduleId);
    if (!map[id]) map[id] = [];
    map[id].push(row);
    return map;
  }, {});
  const daySchedulesByDate = rows_('DaySchedules')
    .filter(row => row.Status === 'ACTIVE')
    .sort((a, b) => String(a.Id).localeCompare(String(b.Id)))
    .reduce((map, row) => {
      map[formatDate_(row.Date)] = row;
      return map;
    }, {});
  return {
    defaultType: defaultType,
    periodsBySchedule: periodsBySchedule,
    assignmentsBySchedule: assignmentsBySchedule,
    daySchedulesByDate: daySchedulesByDate,
    classes: indexBy_(activeRows_('Classes'), 'Id'),
    students: indexBy_(activeRows_('Students'), 'Id'),
    aides: activeRows_('Staff').filter(row => row.Role === VOICES.ROLES.AIDE),
    timeOff: rows_('TimeOffRequests'),
    availability: rows_('Availability'),
    dailyHours: rows_('AideDailyHours'),
    scheduleWeekdays: scheduleWeekdays_()
  };
}

function resolveWeeklyScheduleDay_(dateText, indexes) {
  const daySchedule = indexes.daySchedulesByDate[dateText] || null;
  const dayName = dayName_(dateText);
  const useTemplate = !daySchedule &&
    indexes.defaultType &&
    indexes.scheduleWeekdays.includes(dayName);
  const scheduleId = daySchedule
    ? String(daySchedule.Id)
    : (useTemplate ? String(indexes.defaultType.Id) : '');
  const periodRows = scheduleId ? (indexes.periodsBySchedule[scheduleId] || []) : [];
  const assignmentRows = scheduleId ? (indexes.assignmentsBySchedule[scheduleId] || []) : [];
  const periods = periodRows.map(publicPeriod_);
  const assignments = assignmentRows
    .filter(row => daySchedule || !row.Date)
    .map(row => publicAssignmentWithIndexes_(row, indexes));
  const conflicts = [];
  assignments.forEach(assignment => {
    if (!countsAsScheduledAssignment_(assignment)) return;
    const period = periods.find(item => String(item.periodId) === String(assignment.periodId));
    const conflict = getAideConflictFromIndexes_(assignment.aideEmail, dateText, period, indexes);
    if (conflict) {
      conflicts.push({
        email: assignment.aideEmail,
        periodId: assignment.periodId,
        reason: conflict
      });
    }
  });
  return {
    date: dateText,
    dayName: dayName,
    scheduleId: daySchedule ? daySchedule.Id : '',
    name: daySchedule
      ? daySchedule.Name
      : (useTemplate ? indexes.defaultType.Name : 'No schedule'),
    source: daySchedule ? 'DAY' : (useTemplate ? 'TEMPLATE' : 'NONE'),
    periods: periods,
    assignments: assignments,
    dailyHours: indexes.aides.map(aide =>
      getEffectiveDailyHoursFromIndexes_(dateText, aide.Email, indexes)
    ).filter(Boolean),
    conflicts: conflicts
  };
}

function publicDraftScheduleDay_(dateText, periods, assignments, dailyHours) {
  const normalizedPeriods = periods.map((period, index) => ({
    periodId: sanitizeText_(period.periodId || ('CUSTOM_' + (index + 1)), 100),
    label: sanitizeText_(period.label || ('Period ' + (index + 1)), 100),
    startTime: normalizeTime_(period.startTime),
    endTime: normalizeTime_(period.endTime),
    sortOrder: index + 1
  }));
  validatePeriods_(normalizedPeriods.map(period => ({
    Label: period.label,
    StartTime: period.startTime,
    EndTime: period.endTime
  })));
  const normalizedAssignments = assignments.map(item => {
    const type = String(item.duty || '').trim().toUpperCase() === 'OFF'
      ? 'OFF'
      : sanitizeText_(item.type || (item.studentId ? 'ONE_TO_ONE' : 'STANDARD'), 50);
    return {
      id: item.id || '',
      dayScheduleId: '',
      date: dateText,
      periodId: sanitizeText_(item.periodId, 100),
      aideEmail: normalizeEmail_(item.aideEmail),
      classId: item.classId || '',
      className: '',
      studentId: item.studentId || '',
      studentName: '',
      duty: type === 'OFF' ? 'OFF' : sanitizeText_(item.duty, 300),
      note: sanitizeText_(item.note, 1000),
      type: type
    };
  });
  return {
    date: dateText,
    dayName: dayName_(dateText),
    scheduleId: '',
    name: 'Unsaved schedule',
    source: 'DRAFT',
    periods: normalizedPeriods,
    assignments: normalizedAssignments,
    dailyHours: (dailyHours || []).map(item => normalizeDailyHours_(dateText, item)),
    conflicts: []
  };
}

function summarizeWeeklySchedule_(days, aides) {
  const summaries = aides.map(aide => {
    const byDay = days.map(day => ({
      date: day.date,
      dayName: day.dayName,
      source: day.source,
      hours: scheduledHoursForAide_(day, aide.email)
    }));
    const assignedHours = roundHours_(byDay.reduce((total, item) => total + item.hours, 0));
    const capacityHours = aide.weeklyHours == null ? null : toNumber_(aide.weeklyHours);
    const deltaHours = capacityHours == null ? null : roundHours_(assignedHours - capacityHours);
    return {
      email: aide.email,
      displayName: aide.displayName,
      capacityHours: capacityHours,
      assignedHours: assignedHours,
      deltaHours: deltaHours,
      status: capacityHours == null
        ? 'UNSET'
        : (assignedHours > capacityHours ? 'OVER' : (assignedHours === capacityHours ? 'AT' : 'UNDER')),
      byDay: byDay
    };
  });
  return {
    weekStart: days.length ? days[0].date : '',
    weekEnd: days.length ? days[days.length - 1].date : '',
    aides: summaries,
    overCapacity: summaries.filter(item => item.status === 'OVER'),
    totals: {
      assignedHours: roundHours_(summaries.reduce((total, item) => total + item.assignedHours, 0)),
      capacityHours: roundHours_(summaries.reduce((total, item) =>
        total + (item.capacityHours == null ? 0 : item.capacityHours), 0)),
      overCount: summaries.filter(item => item.status === 'OVER').length
    }
  };
}

function scheduledHoursForAide_(day, email) {
  const hours = (day.dailyHours || []).find(item =>
    normalizeEmail_(item.aideEmail) === normalizeEmail_(email)
  );
  if (!hours) return 0;
  const start = timeToMinutes_(hours.startTime);
  const end = timeToMinutes_(hours.endTime);
  if (start < 0 || end <= start) return 0;
  return roundHours_((end - start - (toNumber_(hours.lunchMinutes) || 0)) / 60);
}

function getDailyHoursForDate_(dateText) {
  return activeRows_('Staff')
    .filter(row => row.Role === VOICES.ROLES.AIDE)
    .map(row => getEffectiveDailyHours_(dateText, row.Email))
    .filter(Boolean);
}

function getEffectiveDailyHours_(dateText, email) {
  return getEffectiveDailyHoursFromIndexes_(dateText, email, {
    dailyHours: rows_('AideDailyHours'),
    availability: rows_('Availability')
  });
}

function getEffectiveDailyHoursFromIndexes_(dateText, email, indexes) {
  const normalizedEmail = normalizeEmail_(email);
  const override = (indexes.dailyHours || []).find(row =>
    formatDate_(row.Date) === dateText &&
    normalizeEmail_(row.AideEmail) === normalizedEmail
  );
  if (override) {
    return normalizeDailyHours_(dateText, {
      aideEmail: normalizedEmail,
      startTime: override.StartTime,
      endTime: override.EndTime,
      lunchStartTime: override.LunchStartTime,
      lunchMinutes: override.LunchMinutes,
      source: 'DATE'
    });
  }
  const availability = (indexes.availability || []).find(row =>
    normalizeEmail_(row.AideEmail) === normalizedEmail &&
    String(row.Status).toUpperCase() === 'APPROVED' &&
    String(row.DayOfWeek).toUpperCase() === dayName_(dateText)
  );
  if (!availability || !toBoolean_(availability.Available)) return null;
  return normalizeDailyHours_(dateText, {
    aideEmail: normalizedEmail,
    startTime: availability.StartTime,
    endTime: availability.EndTime,
    lunchStartTime: '',
    lunchMinutes: 0,
    source: 'AVAILABILITY'
  });
}

function normalizeDailyHours_(dateText, item) {
  return {
    date: dateText,
    aideEmail: normalizeEmail_(item.aideEmail || item.AideEmail),
    startTime: normalizeTime_(item.startTime || item.StartTime),
    endTime: normalizeTime_(item.endTime || item.EndTime),
    lunchStartTime: normalizeTime_(item.lunchStartTime || item.LunchStartTime),
    lunchMinutes: toNumber_(item.lunchMinutes === undefined ? item.LunchMinutes : item.lunchMinutes),
    source: item.source || 'DATE'
  };
}

function shiftOverlapLabel_(hours, period) {
  if (!hours || !period) return '';
  const start = Math.max(timeToMinutes_(hours.startTime), timeToMinutes_(period.startTime || period.StartTime));
  const end = Math.min(timeToMinutes_(hours.endTime), timeToMinutes_(period.endTime || period.EndTime));
  if (start < 0 || end <= start) return '';
  return minutesToTime_(start) + '–' + minutesToTime_(end);
}

function minutesToTime_(minutes) {
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' +
    String(minutes % 60).padStart(2, '0');
}

function countsAsScheduledAssignment_(assignment) {
  if (!assignment) return false;
  const type = assignment.type === undefined ? assignment.Type : assignment.type;
  const duty = assignment.duty === undefined ? assignment.Duty : assignment.duty;
  const classId = assignment.classId === undefined ? assignment.ClassId : assignment.classId;
  const studentId = assignment.studentId === undefined ? assignment.StudentId : assignment.studentId;
  const note = assignment.note === undefined ? assignment.Note : assignment.note;
  if (String(type || '').toUpperCase() === 'OFF') return false;
  if (String(duty || '').trim().toUpperCase() === 'OFF') return false;
  return Boolean(classId || studentId || String(duty || '').trim() || String(note || '').trim());
}

function publicAssignmentWithIndexes_(row, indexes) {
  const classRow = row.ClassId ? indexes.classes[row.ClassId] : null;
  const student = row.StudentId ? indexes.students[row.StudentId] : null;
  return {
    id: row.Id,
    dayScheduleId: row.DayScheduleId,
    date: formatDate_(row.Date),
    periodId: row.PeriodId,
    aideEmail: normalizeEmail_(row.AideEmail),
    classId: row.ClassId,
    className: classRow ? classRow.Name : '',
    studentId: row.StudentId,
    studentName: student ? student.Name : '',
    duty: row.Duty,
    note: row.Note,
    type: row.Type
  };
}

function getAideConflictFromIndexes_(email, dateText, period, indexes) {
  const approvedTimeOff = indexes.timeOff.find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'APPROVED' &&
    dateInRange_(dateText, row.StartDate, row.EndDate)
  );
  if (approvedTimeOff) return 'Approved time off: ' + approvedTimeOff.Type;
  const pendingTimeOff = indexes.timeOff.find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'PENDING' &&
    dateInRange_(dateText, row.StartDate, row.EndDate)
  );
  if (pendingTimeOff) return 'Pending time off request: ' + pendingTimeOff.Type;
  const availability = indexes.availability.find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'APPROVED' &&
    String(row.DayOfWeek).toUpperCase() === dayName_(dateText)
  );
  const hours = getEffectiveDailyHoursFromIndexes_(dateText, email, indexes);
  if (availability && !toBoolean_(availability.Available) && !hours) return 'Not available';
  if (!hours) return 'Shift hours are not configured for this date';
  if (period && !shiftOverlapLabel_(hours, period)) return 'Outside shift hours';
  const pendingAvailability = indexes.availability.find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'PENDING' &&
    String(row.DayOfWeek).toUpperCase() === dayName_(dateText)
  );
  return pendingAvailability ? 'Pending availability request' : '';
}

function weekStart_(dateText) {
  const date = parseDate_(dateText || formatDate_(new Date()));
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return formatDate_(date);
}

function weekDates_(weekStart) {
  const start = parseDate_(weekStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatDate_(date);
  });
}

function scheduleWeekdays_() {
  const configured = String(settingsMap_().ScheduleWeekdays ||
    'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY');
  return configured.split(',').map(item => item.trim().toUpperCase()).filter(Boolean);
}

function timeToMinutes_(value) {
  const match = normalizeTime_(value).match(/^(\d{2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
}

function roundHours_(value) {
  return Math.round(toNumber_(value) * 100) / 100;
}

function getScheduleCacheVersion_() {
  return PropertiesService.getScriptProperties().getProperty('VOICES_SCHEDULE_CACHE_VERSION') || '1';
}

function invalidateScheduleCache_() {
  const properties = PropertiesService.getScriptProperties();
  const next = toNumber_(properties.getProperty('VOICES_SCHEDULE_CACHE_VERSION'), 1) + 1;
  properties.setProperty('VOICES_SCHEDULE_CACHE_VERSION', String(next));
}

function getAllClasses_() {
  const subjects = indexBy_(activeRows_('Subjects'), 'Id');
  return activeRows_('Classes').map(row => ({
    id: row.Id,
    name: row.Name,
    subjectId: row.SubjectId,
    subjectName: subjects[row.SubjectId] ? subjects[row.SubjectId].Name : '',
    teacherEmail: row.TeacherEmail,
    periodId: row.PeriodId
  }));
}

function saveSchedule(payload) {
  const staff = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['date', 'name', 'periods', 'assignments', 'dailyHours']);
  if (!Array.isArray(payload.periods) || !payload.periods.length) throw new Error('At least one period is required.');
  if (!Array.isArray(payload.assignments)) throw new Error('Assignments must be a list.');
  if (!Array.isArray(payload.dailyHours)) throw new Error('Daily shift hours must be a list.');
  const periods = payload.periods.map((period, index) => ({
    ScheduleTypeId: '',
    PeriodId: sanitizeText_(period.periodId || ('CUSTOM_' + (index + 1)), 100),
    Label: sanitizeText_(period.label || ('Period ' + (index + 1)), 100),
    StartTime: normalizeTime_(period.startTime),
    EndTime: normalizeTime_(period.endTime),
    SortOrder: index + 1
  }));
  validatePeriods_(periods);
  const periodIds = new Set(periods.map(period => String(period.PeriodId)));
  const aideEmails = new Set(activeRows_('Staff')
    .filter(row => row.Role === VOICES.ROLES.AIDE)
    .map(row => normalizeEmail_(row.Email)));
  const classIds = new Set(activeRows_('Classes').map(row => String(row.Id)));
  const studentIds = new Set(activeRows_('Students').map(row => String(row.Id)));
  const assignments = payload.assignments.map(item => {
    assertRequired_(item, ['periodId', 'aideEmail']);
    const aideEmail = normalizeEmail_(item.aideEmail);
    if (!periodIds.has(String(item.periodId))) {
      throw new Error('An assignment references an unavailable period.');
    }
    if (!aideEmails.has(aideEmail)) {
      throw new Error('An assignment references an inactive or unknown aide.');
    }
    const type = String(item.duty || '').trim().toUpperCase() === 'OFF'
      ? 'OFF'
      : sanitizeText_(item.type || (item.studentId ? 'ONE_TO_ONE' : 'STANDARD'), 50);
    if (type !== 'OFF' && item.classId && !classIds.has(String(item.classId))) {
      throw new Error('An assignment references an inactive or unknown class.');
    }
    if (type !== 'OFF' && item.studentId && !studentIds.has(String(item.studentId))) {
      throw new Error('An assignment references an inactive or unknown student.');
    }
    return {
      Id: item.id || uuid_(),
      DayScheduleId: '',
      Date: payload.date,
      PeriodId: sanitizeText_(item.periodId, 100),
      AideEmail: aideEmail,
      ClassId: type === 'OFF' ? '' : (item.classId || ''),
      StudentId: type === 'OFF' ? '' : (item.studentId || ''),
      Duty: type === 'OFF' ? 'OFF' : sanitizeText_(item.duty, 300),
      Note: sanitizeText_(item.note, 1000),
      Type: type
    };
  });
  validateUniqueAssignments_(assignments);
  const dailyHours = payload.dailyHours
    .filter(item => item && (item.startTime || item.endTime))
    .map(item => {
      assertRequired_(item, ['aideEmail', 'startTime', 'endTime']);
      const normalized = normalizeDailyHours_(payload.date, item);
      if (!aideEmails.has(normalized.aideEmail)) {
        throw new Error('Shift hours reference an inactive or unknown aide.');
      }
      const start = timeToMinutes_(normalized.startTime);
      const end = timeToMinutes_(normalized.endTime);
      if (start < 0 || end <= start) {
        throw new Error(normalized.aideEmail + ' has invalid shift hours.');
      }
      if (normalized.lunchStartTime) {
        const lunch = timeToMinutes_(normalized.lunchStartTime);
        if (lunch < start || lunch + 30 > end) {
          throw new Error(normalized.aideEmail + ' has a lunch outside the shift.');
        }
        normalized.lunchMinutes = 30;
      } else {
        normalized.lunchMinutes = 0;
      }
      return normalized;
    });
  validateScheduleAssignmentsForHours_(payload.date, assignments, periods, dailyHours);

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return { ok: false, code: 'WRITE_BUSY', message: 'The schedule is being updated. Retry without reloading.' };
  }
  let dayScheduleId = '';
  let nextRevision = 1;
  try {
    const existing = findOne_('DaySchedules', row =>
      String(row.Id) === String(payload.id) ||
      (formatDate_(row.Date) === payload.date && row.Status === 'ACTIVE')
    );
    const currentRevision = existing ? Math.max(1, toNumber_(existing.Revision, 1)) : 0;
    if (currentRevision !== toNumber_(payload.revision, 0)) {
      return {
        ok: false,
        code: 'STALE_SCHEDULE',
        message: 'This schedule changed after it was opened. Reload before saving.',
        currentRevision: currentRevision
      };
    }
    validateScheduleAssignmentsForHours_(payload.date, assignments, periods, dailyHours);
    dayScheduleId = existing ? existing.Id : uuid_();
    nextRevision = currentRevision + 1;
    const scheduleRecord = {
      Date: payload.date,
      Name: sanitizeText_(payload.name, 150),
      BaseScheduleTypeId: payload.baseScheduleTypeId || '',
      Temporary: payload.temporary === undefined ? true : Boolean(payload.temporary),
      Status: 'ACTIVE',
      CreatedBy: existing ? existing.CreatedBy : staff.Email,
      Revision: nextRevision,
      UpdatedBy: staff.Email,
      UpdatedAt: new Date()
    };
    if (existing) updateRow_('DaySchedules', existing._row, scheduleRecord);
    else appendRow_('DaySchedules', Object.assign({ Id: dayScheduleId }, scheduleRecord));
    periods.forEach(period => { period.ScheduleTypeId = dayScheduleId; });
    assignments.forEach(item => { item.DayScheduleId = dayScheduleId; });
    replaceRowsUnlocked_(
      'SchedulePeriods',
      row => String(row.ScheduleTypeId) === String(dayScheduleId),
      periods
    );
    replaceRowsUnlocked_(
      'Assignments',
      row => String(row.DayScheduleId) === String(dayScheduleId),
      assignments
    );
    replaceRowsUnlocked_('AideDailyHours', row => formatDate_(row.Date) === payload.date, dailyHours.map(item => ({
      Id: uuid_(),
      Date: payload.date,
      AideEmail: item.aideEmail,
      StartTime: item.startTime,
      EndTime: item.endTime,
      LunchStartTime: item.lunchStartTime,
      LunchMinutes: item.lunchMinutes,
      UpdatedBy: staff.Email,
      UpdatedAt: new Date()
    })));
    invalidateScheduleCache_();
  } finally {
    lock.releaseLock();
  }
  const unassigned = getUnassignedOneToOnes_(payload.date);
  if (!unassigned.length) {
    rows_('Notifications')
      .filter(row =>
        row.Type === 'UNRESOLVED_1TO1' &&
        row.Status === 'OPEN' &&
        String(row.Message).includes(payload.date)
      )
      .forEach(row => updateRow_('Notifications', row._row, { Status: 'CLOSED' }));
  }
  return {
    ok: true,
    id: dayScheduleId,
    revision: nextRevision,
    warnings: [],
    unassignedOneToOnes: unassigned,
    weeklyHours: getWeeklyScheduleData_(payload.date).summary
  };
}

function saveScheduleType(payload) {
  requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['name', 'periods']);
  const id = payload.id || uuid_();
  if (payload.isDefault) {
    rows_('ScheduleTypes').forEach(row => updateRow_('ScheduleTypes', row._row, { IsDefault: false }));
  }
  const existing = findOne_('ScheduleTypes', row => String(row.Id) === String(id));
  const record = {
    Name: sanitizeText_(payload.name, 150),
    IsDefault: Boolean(payload.isDefault),
    Active: true
  };
  if (existing) updateRow_('ScheduleTypes', existing._row, record);
  else appendRow_('ScheduleTypes', Object.assign({ Id: id }, record));
  const periods = payload.periods.map((period, index) => ({
    ScheduleTypeId: id,
    PeriodId: sanitizeText_(period.periodId || ('P' + (index + 1)), 100),
    Label: sanitizeText_(period.label || ('Period ' + (index + 1)), 100),
    StartTime: normalizeTime_(period.startTime),
    EndTime: normalizeTime_(period.endTime),
    SortOrder: index + 1
  }));
  validatePeriods_(periods);
  replaceRows_('SchedulePeriods', row => String(row.ScheduleTypeId) === String(id), periods);
  if (Array.isArray(payload.assignments)) {
    const assignments = payload.assignments.map(item => ({
      Id: item.id || uuid_(),
      DayScheduleId: id,
      Date: '',
      PeriodId: sanitizeText_(item.periodId, 100),
      AideEmail: normalizeEmail_(item.aideEmail),
      ClassId: item.type === 'OFF' ? '' : (item.classId || ''),
      StudentId: item.type === 'OFF' ? '' : (item.studentId || ''),
      Duty: item.type === 'OFF' ? 'OFF' : sanitizeText_(item.duty, 300),
      Note: sanitizeText_(item.note, 1000),
      Type: sanitizeText_(item.type || (item.studentId ? 'ONE_TO_ONE' : 'STANDARD'), 50)
    }));
    validateUniqueAssignments_(assignments);
    replaceRows_('Assignments', row => String(row.DayScheduleId) === String(id) && !row.Date, assignments);
  }
  invalidateScheduleCache_();
  return { ok: true, id: id };
}

function getDaySchedule_(dateText) {
  const daySchedule = rows_('DaySchedules')
    .filter(row => formatDate_(row.Date) === dateText && row.Status === 'ACTIVE')
    .sort((a, b) => String(b.Id).localeCompare(String(a.Id)))[0];
  const defaultType = activeRows_('ScheduleTypes').find(row => toBoolean_(row.IsDefault)) ||
    activeRows_('ScheduleTypes')[0];
  const useTemplate = !daySchedule && defaultType && scheduleWeekdays_().includes(dayName_(dateText));
  const scheduleId = daySchedule ? daySchedule.Id : (useTemplate ? defaultType.Id : '');
  const periods = rows_('SchedulePeriods')
    .filter(row => String(row.ScheduleTypeId) === String(scheduleId))
    .sort((a, b) => toNumber_(a.SortOrder) - toNumber_(b.SortOrder))
    .map(publicPeriod_);
  const assignments = rows_('Assignments')
    .filter(row => daySchedule
      ? String(row.DayScheduleId) === String(daySchedule.Id)
      : String(row.DayScheduleId) === String(scheduleId) && !row.Date)
    .map(publicAssignment_);
  return {
    id: daySchedule ? daySchedule.Id : '',
    revision: daySchedule ? Math.max(1, toNumber_(daySchedule.Revision, 1)) : 0,
    date: dateText,
    name: daySchedule ? daySchedule.Name : (useTemplate ? defaultType.Name : 'No schedule'),
    baseScheduleTypeId: daySchedule ? daySchedule.BaseScheduleTypeId : (useTemplate ? defaultType.Id : ''),
    temporary: daySchedule ? toBoolean_(daySchedule.Temporary) : false,
    isDefaultFallback: useTemplate,
    periods: periods,
    assignments: assignments
  };
}

function getStaffSchedule_(email, dateText) {
  const schedule = getDaySchedule_(dateText);
  const teacherClasses = activeRows_('Classes')
    .filter(row => normalizeEmail_(row.TeacherEmail) === normalizeEmail_(email));
  return {
    date: dateText,
    name: schedule.name,
    periods: schedule.periods.map(period => {
      let assignment = schedule.assignments.find(item =>
        normalizeEmail_(item.aideEmail) === normalizeEmail_(email) &&
        String(item.periodId) === String(period.periodId)
      );
      if (!assignment) {
        const classRow = teacherClasses.find(item => String(item.PeriodId) === String(period.periodId));
        if (classRow) {
          assignment = {
            id: '',
            date: dateText,
            periodId: period.periodId,
            aideEmail: normalizeEmail_(email),
            classId: classRow.Id,
            className: classRow.Name,
            studentId: '',
            studentName: '',
            duty: 'Teach ' + classRow.Name,
            note: '',
            type: 'TEACHING'
          };
        }
      }
      return Object.assign({}, period, { assignment: assignment || null });
    })
  };
}

function getCurrentAssignment_(email, date) {
  const dateText = formatDate_(date);
  const timeText = Utilities.formatDate(date, VOICES.TIME_ZONE, 'HH:mm');
  const schedule = getStaffSchedule_(email, dateText);
  const period = schedule.periods.find(item => timeText >= item.startTime && timeText < item.endTime);
  if (!period) return null;
  return {
    periodId: period.periodId,
    periodLabel: period.label,
    startTime: period.startTime,
    endTime: period.endTime,
    assignment: period.assignment
  };
}

function publicAssignment_(row) {
  const classRow = row.ClassId ? findOne_('Classes', item => String(item.Id) === String(row.ClassId)) : null;
  const student = row.StudentId ? findOne_('Students', item => String(item.Id) === String(row.StudentId)) : null;
  return {
    id: row.Id,
    dayScheduleId: row.DayScheduleId,
    date: formatDate_(row.Date),
    periodId: row.PeriodId,
    aideEmail: normalizeEmail_(row.AideEmail),
    classId: row.ClassId,
    className: classRow ? classRow.Name : '',
    studentId: row.StudentId,
    studentName: student ? student.Name : '',
    duty: row.Duty,
    note: row.Note,
    type: row.Type
  };
}

function callOff(payload) {
  payload = payload || {};
  const email = getCurrentUserEmail_();
  const staff = requireAuthorizedStaff_(email);
  assertRequired_(payload, ['startDate', 'endDate', 'type', 'hasHours', 'reason']);
  if (staff.Role !== VOICES.ROLES.AIDE && !toBoolean_(staff.IsAdmin)) {
    throw new Error('Call-off requests are available to aides.');
  }
  const request = {
    Id: uuid_(),
    AideEmail: email,
    StartDate: payload.startDate,
    EndDate: payload.endDate,
    Type: sanitizeText_(payload.type, 100),
    HasHours: Boolean(payload.hasHours),
    Reason: sanitizeText_(payload.reason, 1500),
    Status: 'PENDING',
    ReviewedBy: '',
    ReviewedAt: '',
    CreatedAt: new Date()
  };
  appendRow_('TimeOffRequests', request);

  const results = [];
  enumerateDates_(payload.startDate, payload.endDate).forEach(dateText => {
    results.push(reconcileCallOffDay_(email, dateText));
  });
  invalidateScheduleCache_();
  const teachers = activeRows_('Staff')
    .filter(row => row.Role === VOICES.ROLES.TEACHER)
    .map(row => normalizeEmail_(row.Email));
  const recipients = Array.from(new Set(caseManagerEmails_().concat(teachers)));
  sendEmail_(
    recipients.join(','),
    'V.O.I.C.E.S call-off: ' + publicStaff_(staff).displayName,
    publicStaff_(staff).displayName + ' called off from ' + payload.startDate + ' through ' +
      payload.endDate + '. Type: ' + payload.type + '.\n\nCoverage result:\n' +
      results.map(item => item.date + ': ' + item.message).join('\n')
  );
  return { ok: true, requestId: request.Id, reconciliation: results };
}

function reconcileCallOffDay_(absentEmail, dateText) {
  ensureDayScheduleMaterialized_(dateText, absentEmail);
  const originalAssignments = rows_('Assignments').filter(row => formatDate_(row.Date) === dateText);
  const absentAssignments = originalAssignments.filter(row => normalizeEmail_(row.AideEmail) === absentEmail);
  if (!absentAssignments.length) {
    return { date: dateText, status: 'NO_ASSIGNMENTS', message: 'No assignments were scheduled.' };
  }

  const periods = Array.from(new Set(absentAssignments.map(row => String(row.PeriodId))));
  const proposed = originalAssignments.map(row => Object.assign({}, row));
  const failures = [];

  periods.forEach(periodId => {
    const periodAssignments = proposed.filter(row => String(row.PeriodId) === periodId);
    const requirements = periodAssignments
      .filter(row => row.StudentId && isOneToOneStudent_(row.StudentId))
      .map(row => ({ studentId: String(row.StudentId), assignment: row }));
    const uniqueRequirements = uniqueBy_(requirements, item => item.studentId);
    const absentStudentIds = uniqueRequirements
      .filter(item => normalizeEmail_(item.assignment.AideEmail) === absentEmail)
      .map(item => item.studentId);
    periodAssignments
      .filter(row => normalizeEmail_(row.AideEmail) === absentEmail)
      .forEach(assignment => {
        assignment.ClassId = '';
        assignment.StudentId = '';
        assignment.Duty = 'OFF';
        assignment.Note = 'Call-off';
        assignment.Type = 'OFF';
      });
    const candidateAides = activeRows_('Staff')
      .filter(row => row.Role === VOICES.ROLES.AIDE)
      .map(row => normalizeEmail_(row.Email))
      .filter(email => email !== absentEmail)
      .filter(email => isAideAvailableForPeriod_(email, dateText, periodId));
    const match = matchOneToOneCoverage_(uniqueRequirements, candidateAides);
    if (!match.ok) {
      failures.push(
        periodId + ': ' + (absentStudentIds.length
          ? absentStudentIds
          : match.unmatchedStudentIds
        ).join(', ')
      );
      return;
    }

    periodAssignments.forEach(assignment => {
      if (normalizeEmail_(assignment.AideEmail) === absentEmail) {
        assignment.ClassId = '';
        assignment.StudentId = '';
        assignment.Duty = 'OFF';
        assignment.Note = 'Call-off';
        assignment.Type = 'OFF';
      } else if (assignment.StudentId && isOneToOneStudent_(assignment.StudentId)) {
        assignment.StudentId = '';
        assignment.Duty = '';
        assignment.Type = 'STANDARD';
      }
    });
    Object.keys(match.byStudent).forEach(studentId => {
      const aideEmail = match.byStudent[studentId];
      let assignment = periodAssignments.find(row => normalizeEmail_(row.AideEmail) === aideEmail);
      if (!assignment) {
        assignment = {
          Id: uuid_(),
          DayScheduleId: absentAssignments[0].DayScheduleId,
          Date: dateText,
          PeriodId: periodId,
          AideEmail: aideEmail,
          ClassId: '',
          StudentId: '',
          Duty: '',
          Note: '',
          Type: 'STANDARD'
        };
        proposed.push(assignment);
      }
      assignment.StudentId = studentId;
      assignment.Duty = '1:1 Support';
      assignment.Type = 'ONE_TO_ONE';
      assignment.Note = 'Automatically reconciled after call-off';
    });
  });

  if (failures.length) {
    replaceRows_('Assignments', row => formatDate_(row.Date) === dateText, proposed);
    const message = dateText + ' could not reconcile 1:1 coverage (' + failures.join('; ') + ').';
    appendRow_('Notifications', {
      Id: uuid_(),
      Type: 'UNRESOLVED_1TO1',
      Message: message,
      Recipients: caseManagerEmails_().join(','),
      Status: 'OPEN',
      CreatedAt: new Date()
    });
    sendEmail_(caseManagerEmails_().join(','), 'Urgent: unresolved V.O.I.C.E.S 1:1 coverage', message);
    return {
      date: dateText,
      status: 'UNRESOLVED',
      message: 'Aide marked OFF; unresolved 1:1 coverage was sent to case managers.'
    };
  }

  replaceRows_('Assignments', row => formatDate_(row.Date) === dateText, proposed);
  return { date: dateText, status: 'RECONCILED', message: 'Assignments were reconciled.' };
}

function ensureDayScheduleMaterialized_(dateText, createdBy) {
  const existing = rows_('DaySchedules').find(row =>
    formatDate_(row.Date) === dateText && row.Status === 'ACTIVE'
  );
  if (existing) return existing.Id;
  const defaultType = activeRows_('ScheduleTypes').find(row => toBoolean_(row.IsDefault)) ||
    activeRows_('ScheduleTypes')[0];
  if (!defaultType || !scheduleWeekdays_().includes(dayName_(dateText))) return '';
  const id = uuid_();
  appendRow_('DaySchedules', {
    Id: id,
    Date: dateText,
    Name: defaultType.Name + ' · ' + dateText,
    BaseScheduleTypeId: defaultType.Id,
    Temporary: true,
    Status: 'ACTIVE',
    CreatedBy: createdBy
  });
  const periods = rows_('SchedulePeriods')
    .filter(row => String(row.ScheduleTypeId) === String(defaultType.Id))
    .map(row => ({
      ScheduleTypeId: id,
      PeriodId: row.PeriodId,
      Label: row.Label,
      StartTime: row.StartTime,
      EndTime: row.EndTime,
      SortOrder: row.SortOrder
    }));
  replaceRows_('SchedulePeriods', row => String(row.ScheduleTypeId) === String(id), periods);
  const assignments = rows_('Assignments')
    .filter(row => String(row.DayScheduleId) === String(defaultType.Id) && !row.Date)
    .map(row => ({
      Id: uuid_(),
      DayScheduleId: id,
      Date: dateText,
      PeriodId: row.PeriodId,
      AideEmail: row.AideEmail,
      ClassId: row.ClassId,
      StudentId: row.StudentId,
      Duty: row.Duty,
      Note: row.Note,
      Type: row.Type
    }));
  replaceRows_('Assignments', row => String(row.DayScheduleId) === String(id), assignments);
  return id;
}

function matchOneToOneCoverage_(requirements, candidateAides) {
  const training = rows_('AideTraining');
  const trainedByStudent = {};
  requirements.forEach(item => {
    trainedByStudent[item.studentId] = candidateAides.filter(email =>
      training.some(row =>
        normalizeEmail_(row.AideEmail) === email && String(row.StudentId) === String(item.studentId)
      )
    );
  });
  const aideToStudent = {};
  function assign(studentId, seen) {
    const candidates = trainedByStudent[studentId] || [];
    for (let index = 0; index < candidates.length; index += 1) {
      const aide = candidates[index];
      if (seen[aide]) continue;
      seen[aide] = true;
      if (!aideToStudent[aide] || assign(aideToStudent[aide], seen)) {
        aideToStudent[aide] = studentId;
        return true;
      }
    }
    return false;
  }
  const unmatched = requirements
    .map(item => item.studentId)
    .filter(studentId => !assign(studentId, {}));
  const byStudent = {};
  Object.keys(aideToStudent).forEach(aide => {
    byStudent[aideToStudent[aide]] = aide;
  });
  return { ok: unmatched.length === 0, unmatchedStudentIds: unmatched, byStudent: byStudent };
}

function isAideAvailableForPeriod_(email, dateText, periodId) {
  const normalizedEmail = normalizeEmail_(email);
  const blockingTimeOff = rows_('TimeOffRequests').some(row =>
    normalizeEmail_(row.AideEmail) === normalizedEmail &&
    ['APPROVED', 'PENDING'].includes(String(row.Status).toUpperCase()) &&
    dateInRange_(dateText, row.StartDate, row.EndDate)
  );
  if (blockingTimeOff) return false;
  const markedOff = rows_('Assignments').some(row =>
    normalizeEmail_(row.AideEmail) === normalizedEmail &&
    formatDate_(row.Date) === dateText &&
    String(row.PeriodId) === String(periodId) &&
    (String(row.Type).toUpperCase() === 'OFF' ||
      String(row.Duty).toUpperCase() === 'OFF')
  );
  if (markedOff) return false;
  const schedule = getDaySchedule_(dateText);
  const period = schedule.periods.find(item => String(item.periodId) === String(periodId));
  if (!period) return false;
  const hours = getEffectiveDailyHours_(dateText, email);
  return Boolean(hours && shiftOverlapLabel_(hours, period));
}

function getUnavailableAidesForDate_(dateText) {
  return getScheduleStaffingStatus_(dateText)
    .filter(item =>
      item.approvedTimeOff ||
      (item.approvedAvailability &&
        !item.approvedAvailability.available &&
        !item.effectiveHours)
    )
    .map(item => ({
      email: item.email,
      reason: item.approvedTimeOff
        ? 'Approved time off: ' + item.approvedTimeOff.type
        : 'Not available'
    }));
}

function getAideConflict_(email, dateText, period) {
  const approvedTimeOff = rows_('TimeOffRequests').find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'APPROVED' &&
    dateInRange_(dateText, row.StartDate, row.EndDate)
  );
  if (approvedTimeOff) return 'Approved time off: ' + approvedTimeOff.Type;
  const pendingTimeOff = rows_('TimeOffRequests').find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'PENDING' &&
    dateInRange_(dateText, row.StartDate, row.EndDate)
  );
  if (pendingTimeOff) return 'Pending time off request: ' + pendingTimeOff.Type;
  const availability = rows_('Availability').find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'APPROVED' &&
    String(row.DayOfWeek).toUpperCase() === dayName_(dateText)
  );
  const hours = getEffectiveDailyHours_(dateText, email);
  if (availability && !toBoolean_(availability.Available) && !hours) return 'Not available';
  if (!hours) return 'Shift hours are not configured for this date';
  if (period && !shiftOverlapLabel_(hours, period)) return 'Outside shift hours';
  const pendingAvailability = rows_('Availability').find(row =>
    normalizeEmail_(row.AideEmail) === normalizeEmail_(email) &&
    String(row.Status).toUpperCase() === 'PENDING' &&
    String(row.DayOfWeek).toUpperCase() === dayName_(dateText)
  );
  return pendingAvailability ? 'Pending availability request' : '';
}

function getUnassignedOneToOnes_(dateText) {
  const schedule = getDaySchedule_(dateText);
  const students = activeRows_('Students').filter(row => toBoolean_(row.IsOneToOne));
  const classes = indexBy_(activeRows_('Classes'), 'Id');
  const enrollment = rows_('ClassStudents');
  const gaps = [];
  schedule.periods.forEach(period => {
    students.forEach(student => {
      const scheduledPeriodIds = enrollment
        .filter(row => String(row.StudentId) === String(student.Id) && classes[row.ClassId])
        .map(row => String(classes[row.ClassId].PeriodId));
      if (scheduledPeriodIds.length && !scheduledPeriodIds.includes(String(period.periodId))) return;
      const assigned = schedule.assignments.some(row =>
        String(row.periodId) === String(period.periodId) &&
        String(row.studentId) === String(student.Id) &&
        row.type !== 'OFF'
      );
      if (!assigned) {
        gaps.push({
          id: student.Id + '|' + period.periodId,
          studentId: student.Id,
          periodId: period.periodId,
          name: student.Name + ' · ' + period.label,
          isOneToOne: true
        });
      }
    });
  });
  return gaps;
}

function validatePeriods_(periods) {
  periods.forEach(period => {
    if (!period.StartTime || !period.EndTime || period.StartTime >= period.EndTime) {
      throw new Error(period.Label + ' has invalid start and end times.');
    }
  });
}

function validateUniqueAssignments_(assignments) {
  const seen = new Set();
  assignments.forEach(item => {
    const key = item.PeriodId + '|' + normalizeEmail_(item.AideEmail);
    if (seen.has(key)) throw new Error('An aide can only have one assignment per period.');
    seen.add(key);
  });
}

function validateScheduleAssignmentsForHours_(dateText, assignments, periods, dailyHours) {
  const periodIndex = periods.reduce((map, period) => {
    map[String(period.PeriodId)] = period;
    return map;
  }, {});
  const hourIndex = {};
  dailyHours.forEach(item => {
    const email = normalizeEmail_(item.aideEmail);
    if (hourIndex[email]) throw new Error('Only one shift can be configured per aide and date.');
    hourIndex[email] = item;
  });
  const timeOff = rows_('TimeOffRequests');
  assignments.filter(countsAsScheduledAssignment_).forEach(item => {
    const email = normalizeEmail_(item.AideEmail);
    const approvedTimeOff = timeOff.find(row =>
      normalizeEmail_(row.AideEmail) === email &&
      String(row.Status).toUpperCase() === 'APPROVED' &&
      dateInRange_(dateText, row.StartDate, row.EndDate)
    );
    if (approvedTimeOff) {
      throw new Error(email + ' has approved time off and cannot be assigned.');
    }
    const hours = hourIndex[email];
    if (!hours) {
      throw new Error('Set ' + email + ' shift hours before assigning coverage.');
    }
    const period = periodIndex[String(item.PeriodId)];
    if (!period || !shiftOverlapLabel_(hours, period)) {
      throw new Error(email + ' cannot be assigned to ' + item.PeriodId + ' outside shift hours.');
    }
  });
}

function isOneToOneStudent_(studentId) {
  const student = findOne_('Students', row => String(row.Id) === String(studentId));
  return Boolean(student && toBoolean_(student.IsOneToOne));
}

function normalizeTime_(value) {
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, VOICES.TIME_ZONE, 'HH:mm');
  const text = String(value);
  const match = text.match(/(\d{1,2}):(\d{2})/);
  return match ? String(match[1]).padStart(2, '0') + ':' + match[2] : text;
}

function dayName_(dateText) {
  return Utilities.formatDate(parseDate_(dateText), VOICES.TIME_ZONE, 'EEEE').toUpperCase();
}

function enumerateDates_(startText, endText) {
  const dates = [];
  const current = parseDate_(startText);
  const end = parseDate_(endText);
  if (end < current) throw new Error('End date must be on or after start date.');
  while (current <= end) {
    dates.push(formatDate_(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function uniqueBy_(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
