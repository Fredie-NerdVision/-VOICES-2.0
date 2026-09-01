function getClassesForStaff_(staff) {
  const email = normalizeEmail_(staff.Email);
  const allClasses = activeRows_('Classes');
  const aideClassIds = new Set(
    rows_('ClassAides')
      .filter(row => normalizeEmail_(row.AideEmail) === email)
      .map(row => String(row.ClassId))
  );
  const classes = staff.Role === VOICES.ROLES.CASE_MANAGER || toBoolean_(staff.IsAdmin)
    ? allClasses
    : allClasses.filter(row =>
        normalizeEmail_(row.TeacherEmail) === email || aideClassIds.has(String(row.Id))
      );
  const subjects = indexBy_(activeRows_('Subjects'), 'Id');
  return classes.map(row => ({
    id: row.Id,
    name: row.Name,
    subjectId: row.SubjectId,
    subjectName: subjects[row.SubjectId] ? subjects[row.SubjectId].Name : '',
    teacherEmail: row.TeacherEmail,
    periodId: row.PeriodId,
    label: [row.Name, row.PeriodId, subjects[row.SubjectId] && subjects[row.SubjectId].Name]
      .filter(Boolean)
      .join(' · ')
  }));
}

function getStudentsForStaff_(staff) {
  const email = normalizeEmail_(staff.Email);
  const isCaseManager = staff.Role === VOICES.ROLES.CASE_MANAGER || toBoolean_(staff.IsAdmin);
  let students = activeRows_('Students');
  if (isCaseManager && !toBoolean_(staff.IsAdmin)) {
    students = students.filter(row => normalizeEmail_(row.CaseManagerEmail) === email);
  } else if (!isCaseManager) {
    const classIds = new Set(getClassesForStaff_(staff).map(row => String(row.id)));
    const allowedStudentIds = new Set(
      rows_('ClassStudents')
        .filter(row => classIds.has(String(row.ClassId)))
        .map(row => String(row.StudentId))
        .concat(rows_('AideTraining')
          .filter(row => normalizeEmail_(row.AideEmail) === email)
          .map(row => String(row.StudentId)))
    );
    students = students.filter(row => allowedStudentIds.has(String(row.Id)));
  }
  return students.map(publicStudent_);
}

function getStudentsForClass(classId) {
  requireAuthorizedStaff_(getCurrentUserEmail_());
  const classRow = findOne_('Classes', row => String(row.Id) === String(classId) && toBoolean_(row.Active));
  if (!classRow) throw new Error('Class was not found.');
  const ids = new Set(
    rows_('ClassStudents')
      .filter(row => String(row.ClassId) === String(classId))
      .map(row => String(row.StudentId))
  );
  return activeRows_('Students')
    .filter(row => ids.has(String(row.Id)))
    .map(publicStudent_);
}

function getBenchmarkLookupContext_(currentAssignment) {
  const staffRows = activeRows_('Staff');
  const staff = staffRows.reduce((map, row) => {
    map[normalizeEmail_(row.Email)] = publicStaff_(row);
    return map;
  }, {});
  const subjects = indexBy_(activeRows_('Subjects'), 'Id');
  const students = indexBy_(activeRows_('Students'), 'Id');
  const enrollment = rows_('ClassStudents');
  const classes = activeRows_('Classes').map(row => ({
    id: row.Id,
    name: row.Name,
    teacherEmail: normalizeEmail_(row.TeacherEmail),
    periodId: row.PeriodId,
    subjectId: row.SubjectId,
    subjectName: subjects[row.SubjectId] ? subjects[row.SubjectId].Name : '',
    students: enrollment
      .filter(item => String(item.ClassId) === String(row.Id) && students[item.StudentId])
      .map(item => publicStudent_(students[item.StudentId]))
      .sort((a, b) => a.name.localeCompare(b.name))
  })).sort((a, b) =>
    a.teacherEmail.localeCompare(b.teacherEmail) ||
    String(a.periodId).localeCompare(String(b.periodId), undefined, { numeric: true })
  );
  const teacherEmails = Array.from(new Set(classes.map(row => row.teacherEmail).filter(Boolean)));
  const assignment = currentAssignment && currentAssignment.assignment;
  return {
    currentClassId: assignment && assignment.classId ? assignment.classId : '',
    currentStudentId: assignment && assignment.studentId ? assignment.studentId : '',
    teachers: teacherEmails.map(email => ({
      email: email,
      displayName: staff[email] ? staff[email].displayName : email
    })).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    classes: classes
  };
}

function publicStudent_(row) {
  return {
    id: row.Id,
    name: row.Name,
    caseManagerEmail: row.CaseManagerEmail,
    isOneToOne: toBoolean_(row.IsOneToOne),
    active: toBoolean_(row.Active)
  };
}

function getTrainedStudents_(email) {
  const ids = new Set(
    rows_('AideTraining')
      .filter(row => normalizeEmail_(row.AideEmail) === normalizeEmail_(email))
      .map(row => String(row.StudentId))
  );
  return activeRows_('Students')
    .filter(row => ids.has(String(row.Id)))
    .map(publicStudent_);
}

function lookupBenchmarks(filters) {
  filters = filters || {};
  requireAuthorizedStaff_(getCurrentUserEmail_());
  assertRequired_(filters, ['classId', 'studentIds']);
  const studentIds = Array.isArray(filters.studentIds) ? filters.studentIds.map(String) : [String(filters.studentIds)];
  const classRow = findOne_('Classes', row => String(row.Id) === String(filters.classId) && toBoolean_(row.Active));
  if (!classRow) throw new Error('Class was not found.');

  const enrolled = new Set(
    rows_('ClassStudents')
      .filter(row => String(row.ClassId) === String(classRow.Id))
      .map(row => String(row.StudentId))
  );
  const selected = studentIds.filter(id => enrolled.has(id));
  if (!selected.length) throw new Error('Select at least one student enrolled in this class.');

  const students = indexBy_(activeRows_('Students'), 'Id');
  const subjectId = String(classRow.SubjectId);
  const entries = rows_('BenchmarkEntries');
  return activeRows_('Benchmarks')
    .filter(row =>
      selected.includes(String(row.StudentId)) &&
      benchmarkMatchesSubject_(row, subjectId)
    )
    .map(row => {
      const benchmarkEntries = entries.filter(entry => String(entry.BenchmarkId) === String(row.Id));
      const last = benchmarkEntries.sort((a, b) => String(b.Timestamp).localeCompare(String(a.Timestamp)))[0];
      return publicBenchmark_(row, students[row.StudentId], last, benchmarkEntries.length);
    })
    .sort((a, b) => Number(b.critical) - Number(a.critical) || a.studentName.localeCompare(b.studentName));
}

function saveBenchmarkEntry(payload) {
  payload = payload || {};
  const email = getCurrentUserEmail_();
  requireAuthorizedStaff_(email);
  assertRequired_(payload, ['benchmarkId', 'classId', 'correct', 'attempts']);

  const benchmark = findOne_('Benchmarks', row =>
    String(row.Id) === String(payload.benchmarkId) && toBoolean_(row.Active)
  );
  if (!benchmark) throw new Error('Benchmark was not found or is inactive.');

  const classRow = findOne_('Classes', row => String(row.Id) === String(payload.classId));
  if (!classRow) throw new Error('Class was not found.');
  if (!benchmarkMatchesSubject_(benchmark, classRow.SubjectId)) {
    throw new Error('This benchmark is not relevant to the selected class subject.');
  }

  const correct = toNumber_(payload.correct, -1);
  const attempts = toNumber_(payload.attempts, -1);
  if (correct < 0 || attempts <= 0 || correct > attempts) {
    throw new Error('Correct answers must be between 0 and the total attempts.');
  }

  const entry = {
    Id: uuid_(),
    Timestamp: new Date(),
    BenchmarkId: benchmark.Id,
    StudentId: benchmark.StudentId,
    StaffEmail: email,
    ClassId: classRow.Id,
    Correct: correct,
    Attempts: attempts,
    Percent: Math.round((correct / attempts) * 1000) / 10,
    Notes: sanitizeText_(payload.notes, 1000)
  };
  appendRow_('BenchmarkEntries', entry);
  return {
    ok: true,
    entryId: entry.Id,
    percent: entry.Percent,
    message: 'Benchmark input saved.'
  };
}

function saveBenchmark(payload) {
  const staff = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, [
    'studentId', 'subjectId', 'category', 'skill',
    'targetCorrect', 'targetAttempts', 'requiredTrials', 'totalTrials'
  ]);
  const student = findOne_('Students', row => String(row.Id) === String(payload.studentId));
  if (!student) throw new Error('Student was not found.');
  if (!toBoolean_(staff.IsAdmin) && normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only manage benchmarks for your assigned students.');
  }

  const record = {
    StudentId: student.Id,
    SubjectId: sanitizeText_(payload.subjectId, 100),
    Category: sanitizeText_(payload.category, 120),
    Skill: sanitizeText_(payload.skill, 500),
    TargetCorrect: toNumber_(payload.targetCorrect),
    TargetAttempts: toNumber_(payload.targetAttempts),
    RequiredTrials: toNumber_(payload.requiredTrials),
    TotalTrials: toNumber_(payload.totalTrials),
    StartDate: payload.startDate || '',
    DueDate: payload.dueDate || '',
    Critical: Boolean(payload.critical),
    Active: payload.active === undefined ? true : Boolean(payload.active),
    Description: sanitizeText_(payload.description, 1500)
  };

  if (record.TargetCorrect < 0 || record.TargetAttempts <= 0 || record.TargetCorrect > record.TargetAttempts) {
    throw new Error('The correctness metric is invalid.');
  }
  if (record.RequiredTrials <= 0 || record.TotalTrials <= 0 || record.RequiredTrials > record.TotalTrials) {
    throw new Error('The trial metric is invalid.');
  }

  if (payload.id) {
    const existing = findOne_('Benchmarks', row => String(row.Id) === String(payload.id));
    if (!existing) throw new Error('Benchmark was not found.');
    updateRow_('Benchmarks', existing._row, record);
    return { ok: true, id: existing.Id, message: 'Benchmark updated.' };
  }
  record.Id = uuid_();
  appendRow_('Benchmarks', record);
  return { ok: true, id: record.Id, message: 'Benchmark created.' };
}

function deleteBenchmark(benchmarkId) {
  const staff = requireCaseManager_();
  const benchmark = findOne_('Benchmarks', row => String(row.Id) === String(benchmarkId));
  if (!benchmark) throw new Error('Benchmark was not found.');
  const student = findOne_('Students', row => String(row.Id) === String(benchmark.StudentId));
  if (!toBoolean_(staff.IsAdmin) && student &&
      normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only manage benchmarks for your assigned students.');
  }
  updateRow_('Benchmarks', benchmark._row, { Active: false });
  return { ok: true };
}

function getBenchmarkProgress(benchmarkId) {
  const staff = requireCaseManager_();
  const benchmark = findOne_('Benchmarks', row => String(row.Id) === String(benchmarkId));
  if (!benchmark) throw new Error('Benchmark was not found.');
  const student = findOne_('Students', row => String(row.Id) === String(benchmark.StudentId));
  if (!toBoolean_(staff.IsAdmin) && student &&
      normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only view progress for your assigned students.');
  }
  const entries = rows_('BenchmarkEntries')
    .filter(row => String(row.BenchmarkId) === String(benchmarkId))
    .sort((a, b) => String(a.Timestamp).localeCompare(String(b.Timestamp)));
  return {
    benchmark: publicBenchmark_(benchmark, student),
    points: entries.map(row => ({
      timestamp: row.Timestamp,
      percent: toNumber_(row.Percent),
      correct: toNumber_(row.Correct),
      attempts: toNumber_(row.Attempts),
      notes: row.Notes,
      staffEmail: row.StaffEmail
    }))
  };
}

function getCriticalBenchmarks_(staff) {
  const students = indexBy_(activeRows_('Students'), 'Id');
  return activeRows_('Benchmarks')
    .filter(row => toBoolean_(row.Critical))
    .filter(row => staff.Role !== VOICES.ROLES.CASE_MANAGER ||
      toBoolean_(staff.IsAdmin) ||
      (students[row.StudentId] &&
        normalizeEmail_(students[row.StudentId].CaseManagerEmail) === normalizeEmail_(staff.Email)))
    .map(row => publicBenchmark_(row, students[row.StudentId]))
    .slice(0, 12);
}

function publicBenchmark_(row, student, lastEntry, entryCount) {
  const subjects = getSubjectIndex_();
  const subjectIds = Array.from(new Set(
    getBenchmarkSubjectIds_(row.Id).concat(row.SubjectId ? [String(row.SubjectId)] : [])
  )).filter(id => subjects[id]);
  const subjectNames = subjectIds.map(id => subjects[id].Name);
  return {
    id: row.Id,
    goalId: row.GoalId,
    studentId: row.StudentId,
    studentName: student ? student.Name : '',
    subjectId: row.SubjectId,
    subjectName: subjectNames[0] || '',
    subjectIds: subjectIds,
    subjectNames: subjectNames,
    category: row.Category,
    skill: row.Skill,
    targetCorrect: toNumber_(row.TargetCorrect),
    targetAttempts: toNumber_(row.TargetAttempts),
    requiredTrials: toNumber_(row.RequiredTrials),
    totalTrials: toNumber_(row.TotalTrials),
    startDate: row.StartDate,
    dueDate: row.DueDate,
    critical: toBoolean_(row.Critical),
    active: toBoolean_(row.Active),
    description: row.Description,
    display: row.Category + ' – ' + row.Skill + ': student will get ' +
      row.TargetCorrect + ' out of ' + row.TargetAttempts + ' correct in ' +
      row.RequiredTrials + ' / ' + row.TotalTrials + ' trials',
    lastEntry: lastEntry ? {
      timestamp: lastEntry.Timestamp,
      percent: toNumber_(lastEntry.Percent)
    } : null,
    entryCount: entryCount || 0
  };
}

function assertClassAccess_(staff, classRow) {
  if (staff.Role === VOICES.ROLES.CASE_MANAGER || toBoolean_(staff.IsAdmin)) return;
  const email = normalizeEmail_(staff.Email);
  if (normalizeEmail_(classRow.TeacherEmail) === email) return;
  const assigned = findOne_('ClassAides', row =>
    String(row.ClassId) === String(classRow.Id) && normalizeEmail_(row.AideEmail) === email
  );
  if (!assigned) throw new Error('You are not assigned to this class.');
}

function getCaseManagerDashboard_(staff) {
  const goalData = getGoalManagerData_(staff);
  const staffRows = activeRows_('Staff');
  const isAdmin = toBoolean_(staff.IsAdmin);
  return Object.assign({}, goalData, {
    toDos: getCaseManagerTodos_(staff),
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
      .map(publicStaff_),
    scheduleTypes: getScheduleTypes_(),
    requests: getStaffRequestData_(),
    messages: getMessageManagementData_(staff)
  });
}

function benchmarkMatchesSubject_(benchmark, subjectId) {
  const selected = String(subjectId || '');
  if (!selected) return false;
  if (String(benchmark.SubjectId || '') === selected) return true;
  return getBenchmarkSubjectIds_(benchmark.Id).includes(selected);
}

function getCaseManagerTodos_(staff) {
  const email = normalizeEmail_(staff.Email);
  const isAdmin = toBoolean_(staff.IsAdmin);
  const today = new Date();
  const future = new Date(today.getTime() + 30 * 86400000);
  const todos = [];

  rows_('IEPs')
    .filter(row => isAdmin || normalizeEmail_(row.CaseManagerEmail) === email)
    .filter(row => row.EndDate && new Date(row.EndDate) <= future && new Date(row.EndDate) >= today)
    .forEach(row => {
      const student = findOne_('Students', item => String(item.Id) === String(row.StudentId));
      todos.push({
        type: 'IEP',
        urgent: false,
        title: 'IEP due: ' + (student ? student.Name : 'Student'),
        detail: formatDate_(row.EndDate)
      });
    });

  const pendingCount = rows_('TimeOffRequests').filter(row => row.Status === 'PENDING').length +
    rows_('Availability').filter(row => row.Status === 'PENDING').length;
  if (pendingCount) {
    todos.push({
      type: 'REQUEST',
      urgent: false,
      title: pendingCount + ' staff request' + (pendingCount === 1 ? '' : 's') + ' to review',
      detail: 'Availability and time-off approvals'
    });
  }

  rows_('Notifications')
    .filter(row => row.Status === 'OPEN' && row.Type === 'UNRESOLVED_1TO1')
    .forEach(row => todos.push({
      type: '1TO1',
      urgent: true,
      title: 'Unresolved 1:1 coverage',
      detail: row.Message
    }));
  return todos;
}

function indexBy_(rows, key) {
  return rows.reduce((map, row) => {
    map[String(row[key])] = row;
    return map;
  }, {});
}
