/**
 * I keep aide time and availability requests in this file.
 *
 * Aides can clock in or out, review a pay-period summary, submit time off, and
 * share recurring availability. The server always uses the signed-in account
 * for personal actions so one aide cannot submit time under another name.
 */
// I start a time entry for the signed-in aide only when no open entry already exists.
function clockIn(note) {
  const email = getCurrentUserEmail_();
  const staff = requireAuthorizedStaff_(email);
  if (staff.Role !== VOICES.ROLES.AIDE && !toBoolean_(staff.IsAdmin)) {
    throw new Error('Time tracking is available to aides.');
  }
  if (getOpenTimeEntry_(email)) throw new Error('You are already clocked in.');
  const entry = {
    Id: uuid_(),
    AideEmail: email,
    ClockIn: new Date(),
    ClockOut: '',
    Hours: '',
    Note: sanitizeText_(note, 500),
    Verified: false
  };
  appendRow_('TimeEntries', entry);
  invalidateAppDataCache_('general');
  return { ok: true, entry: publicTimeEntry_(entry) };
}

// I close the signed-in aide’s open time entry and calculate the worked duration.
function clockOut(note) {
  const email = getCurrentUserEmail_();
  requireAuthorizedStaff_(email);
  const entry = findOne_('TimeEntries', row =>
    normalizeEmail_(row.AideEmail) === email && !row.ClockOut
  );
  if (!entry) throw new Error('No open time entry was found.');
  const clockIn = new Date(entry.ClockIn);
  const clockOut = new Date();
  const hours = Math.round(((clockOut.getTime() - clockIn.getTime()) / 3600000) * 100) / 100;
  updateRow_('TimeEntries', entry._row, {
    ClockOut: clockOut,
    Hours: hours,
    Note: sanitizeText_(note || entry.Note, 500)
  });
  invalidateAppDataCache_('general');
  return { ok: true, hours: hours };
}

// I collect and return open time entry.
function getOpenTimeEntry_(email) {
  const row = findOne_('TimeEntries', item =>
    normalizeEmail_(item.AideEmail) === normalizeEmail_(email) && !item.ClockOut
  );
  return row ? publicTimeEntry_(row) : null;
}

// I return a browser-safe copy of time entry.
function publicTimeEntry_(row) {
  return {
    id: row.Id,
    aideEmail: normalizeEmail_(row.AideEmail),
    clockIn: row.ClockIn,
    clockOut: row.ClockOut,
    hours: row.Hours === '' ? null : toNumber_(row.Hours),
    note: row.Note,
    verified: toBoolean_(row.Verified)
  };
}

// I collect and return pay period summary.
function getPayPeriodSummary(email, anchorDate) {
  const currentEmail = getCurrentUserEmail_();
  const staff = requireAuthorizedStaff_(currentEmail);
  const targetEmail = normalizeEmail_(email || currentEmail);
  if (targetEmail !== currentEmail &&
      staff.Role !== VOICES.ROLES.CASE_MANAGER &&
      !toBoolean_(staff.IsAdmin)) {
    throw new Error('You cannot view another staff member’s hours.');
  }
  return getPayPeriodSummary_(targetEmail, anchorDate ? new Date(anchorDate) : new Date());
}

// I collect and return pay period summary.
function getPayPeriodSummary_(email, anchorDate) {
  const range = payPeriodRange_(anchorDate);
  const entries = rows_('TimeEntries')
    .filter(row => normalizeEmail_(row.AideEmail) === normalizeEmail_(email))
    .filter(row => {
      const clockIn = new Date(row.ClockIn);
      return clockIn >= range.start && clockIn <= range.end;
    })
    .sort((a, b) => String(a.ClockIn).localeCompare(String(b.ClockIn)));
  const daysOff = rows_('TimeOffRequests')
    .filter(row => normalizeEmail_(row.AideEmail) === normalizeEmail_(email) && row.Status === 'APPROVED')
    .filter(row => parseDate_(formatDate_(row.EndDate)) >= range.start &&
      parseDate_(formatDate_(row.StartDate)) <= range.end)
    .map(row => ({
      startDate: formatDate_(row.StartDate),
      endDate: formatDate_(row.EndDate),
      type: row.Type,
      reason: row.Reason
    }));
  return {
    startDate: formatDate_(range.start),
    endDate: formatDate_(range.end),
    totalHours: Math.round(entries.reduce((total, row) => total + toNumber_(row.Hours), 0) * 100) / 100,
    entries: entries.map(publicTimeEntry_),
    daysOff: daysOff,
    notice: settingsMap_().TimeClockNotice,
    instructions: settingsMap_().HoursInstructions
  };
}

// I keep the pay period range rule in one place so it is used consistently.
function payPeriodRange_(anchorDate) {
  const day = toNumber_(settingsMap_().PayPeriodStartDay, 10);
  const anchor = new Date(anchorDate);
  let start;
  let end;
  if (anchor.getDate() >= day) {
    start = new Date(anchor.getFullYear(), anchor.getMonth(), day, 0, 0, 0);
    end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, day, 23, 59, 59);
  } else {
    start = new Date(anchor.getFullYear(), anchor.getMonth() - 1, day, 0, 0, 0);
    end = new Date(anchor.getFullYear(), anchor.getMonth(), day, 23, 59, 59);
  }
  return { start: start, end: end };
}

// I validate and submit time off request.
function submitTimeOffRequest(payload) {
  payload = payload || {};
  const email = getCurrentUserEmail_();
  requireAuthorizedStaff_(email);
  assertRequired_(payload, ['startDate', 'endDate', 'type', 'reason']);
  const record = {
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
  appendRow_('TimeOffRequests', record);
  sendEmail_(
    caseManagerEmails_().join(','),
    'V.O.I.C.E.S time-off request',
    email + ' requested ' + payload.startDate + ' through ' + payload.endDate +
      ' (' + payload.type + ').\n\nReason: ' + record.Reason
  );
  invalidateScheduleCache_();
  return { ok: true, id: record.Id };
}

// I validate and submit availability.
function submitAvailability(payload) {
  payload = payload || {};
  const email = getCurrentUserEmail_();
  requireAuthorizedStaff_(email);
  assertRequired_(payload, ['days']);
  if (!Array.isArray(payload.days) || payload.days.length !== 5) {
    throw new Error('Availability must include Monday through Friday.');
  }
  const submittedAt = new Date();
  payload.days.forEach(day => {
    assertRequired_(day, ['dayOfWeek', 'available']);
    if (day.available && (!day.startTime || !day.endTime || day.startTime >= day.endTime)) {
      throw new Error(day.dayOfWeek + ' has invalid availability hours.');
    }
    appendRow_('Availability', {
      Id: uuid_(),
      AideEmail: email,
      DayOfWeek: String(day.dayOfWeek).toUpperCase(),
      Available: Boolean(day.available),
      StartTime: day.available ? normalizeTime_(day.startTime) : '',
      EndTime: day.available ? normalizeTime_(day.endTime) : '',
      Status: 'PENDING',
      ReviewedBy: '',
      ReviewedAt: '',
      SubmittedAt: submittedAt
    });
  });
  sendEmail_(
    caseManagerEmails_().join(','),
    'V.O.I.C.E.S availability update',
    email + ' submitted a new weekly availability request.'
  );
  invalidateScheduleCache_();
  return { ok: true };
}
