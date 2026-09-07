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
  const staff = requireAuthorizedStaff_(getCurrentUserEmail_());
  const classRow = findOne_('Classes', row => String(row.Id) === String(classId) && toBoolean_(row.Active));
  if (!classRow) throw new Error('Class was not found.');
  assertObservationClassAccess_(staff, classRow);
  const ids = new Set(
    rows_('ClassStudents')
      .filter(row => String(row.ClassId) === String(classId))
      .map(row => String(row.StudentId))
  );
  return activeRows_('Students')
    .filter(row => ids.has(String(row.Id)))
    .map(publicStudent_);
}

function getBenchmarkLookupContext_(staffMember, currentAssignment) {
  const staffRows = activeRows_('Staff');
  const staff = staffRows.reduce((map, row) => {
    map[normalizeEmail_(row.Email)] = publicStaff_(row);
    return map;
  }, {});
  const subjects = indexBy_(activeRows_('Subjects'), 'Id');
  const students = indexBy_(activeRows_('Students'), 'Id');
  const enrollment = rows_('ClassStudents');
  const lookupClasses = canUseAnyObservationClass_(staffMember)
    ? activeRows_('Classes')
    : activeRows_('Classes').filter(row => {
        try {
          assertObservationClassAccess_(staffMember, row);
          return true;
        } catch (error) {
          return false;
        }
      });
  const classes = lookupClasses
    .map(row => ({
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
    grade: row.Grade,
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

function getCurrentActiveBenchmarks_() {
  const goals = rows_('Goals').filter(isActiveGoal_);
  return effectiveBenchmarkRows_(goals, rows_('Benchmarks'), new Date())
    .filter(benchmark => toBoolean_(benchmark.Active));
}

function lookupBenchmarks(filters, force) {
  return withRowsCache_(() => {
    filters = filters || {};
    const staff = requireAuthorizedStaff_(getCurrentUserEmail_());
    assertRequired_(filters, ['classId', 'studentIds']);
    const studentIds = Array.isArray(filters.studentIds)
      ? filters.studentIds.map(String)
      : [String(filters.studentIds)];
    const classRow = findOne_('Classes', row =>
      String(row.Id) === String(filters.classId) && toBoolean_(row.Active)
    );
    if (!classRow) throw new Error('Class was not found.');
    assertObservationClassAccess_(staff, classRow);

    const enrolled = new Set(
      rows_('ClassStudents')
        .filter(row => String(row.ClassId) === String(classRow.Id))
        .map(row => String(row.StudentId))
    );
    const selected = studentIds.filter(id => enrolled.has(id));
    if (!selected.length) throw new Error('Select at least one student enrolled in this class.');

    const producer = () => {
      const students = indexBy_(activeRows_('Students'), 'Id');
      const subjectId = String(classRow.SubjectId);
      const activeGoalIds = new Set(
        rows_('Goals').filter(isActiveGoal_).map(row => String(row.Id))
      );
      const entries = rows_('BenchmarkEntries')
        .filter(row => String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE');
      return getCurrentActiveBenchmarks_()
        .filter(row =>
          selected.includes(String(row.StudentId)) &&
          (!row.GoalId || activeGoalIds.has(String(row.GoalId))) &&
          benchmarkMatchesSubject_(row, subjectId)
        )
        .map(row => {
          const benchmarkEntries = entries.filter(entry =>
            String(entry.BenchmarkId) === String(row.Id)
          );
          const last = benchmarkEntries.sort((a, b) =>
            String(b.Timestamp).localeCompare(String(a.Timestamp))
          )[0];
          return publicBenchmark_(
            row,
            students[row.StudentId],
            last,
            benchmarkEntries.length,
            benchmarkEntries
          );
        })
        .sort((a, b) =>
          Number(b.critical) - Number(a.critical) ||
          a.studentName.localeCompare(b.studentName)
        );
    };
    return cachedResponse_(
      'benchmark-lookup',
      [
        normalizeEmail_(staff.Email),
        classRow.Id,
        selected.slice().sort().join('.')
      ],
      producer,
      null,
      Boolean(force)
    );
  });
}

function saveBenchmarkEntry(payload) {
  payload = payload || {};
  const result = saveBenchmarkEntriesBatch({
    submissionBatchId: payload.submissionBatchId || uuid_(),
    entries: [payload]
  });
  if (!result.ok) return result;
  return {
    ok: true,
    entryId: result.entryIds[0],
    percent: result.entries[0].percent,
    submissionBatchId: result.submissionBatchId,
    message: 'Benchmark input saved.'
  };
}

function saveBenchmarkEntriesBatch(payload) {
  payload = payload || {};
  const email = getCurrentUserEmail_();
  const staff = requireAuthorizedStaff_(email);
  const batchId = sanitizeText_(payload.submissionBatchId, 100);
  if (!batchId) throw new Error('A submission batch ID is required.');
  if (!Array.isArray(payload.entries) || !payload.entries.length) {
    throw new Error('At least one observation is required.');
  }
  if (payload.entries.length > 200) {
    throw new Error('Submit no more than 200 observations in one batch.');
  }
  const fingerprint = observationBatchFingerprint_(payload.entries);

  const existing = getCompletedObservationBatch_(batchId);
  if (existing.length) {
    return completedObservationBatchResult_(
      batchId,
      existing,
      payload.entries.length,
      fingerprint
    );
  }

  const initial = validateObservationBatch_(payload.entries, staff, batchId, fingerprint);
  if (!initial.ok) return initial;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return {
      ok: false,
      code: 'WRITE_BUSY',
      retryable: true,
      submissionBatchId: batchId,
      message: 'Observation saving is busy. Your queue is still intact; retry shortly.'
    };
  }
  try {
    [
      'BenchmarkEntries',
      'Benchmarks',
      'BenchmarkSubjects',
      'Classes',
      'GoalPhaseHistory',
      'Goals'
    ].forEach(invalidateRowsCache_);
    const completed = getCompletedObservationBatch_(batchId);
    if (completed.length) {
      return completedObservationBatchResult_(
        batchId,
        completed,
        payload.entries.length,
        fingerprint
      );
    }
    const validated = validateObservationBatch_(payload.entries, staff, batchId, fingerprint);
    if (!validated.ok) return validated;
    appendRows_('BenchmarkEntries', validated.records);
    invalidateAppDataCache_('student');
    return completedObservationBatchResult_(batchId, validated.records);
  } finally {
    lock.releaseLock();
  }
}

function previewBenchmarkEntriesBatch(payload) {
  payload = payload || {};
  const staff = requireAuthorizedStaff_(getCurrentUserEmail_());
  if (!Array.isArray(payload.entries) || !payload.entries.length) {
    throw new Error('Paste at least one observation row.');
  }
  if (payload.entries.length > 200) {
    throw new Error('Preview no more than 200 observations at a time.');
  }
  const result = validateObservationBatch_(
    payload.entries,
    staff,
    sanitizeText_(payload.submissionBatchId || 'preview', 100)
  );
  if (!result.ok) return result;
  return {
    ok: true,
    count: result.records.length,
    rows: result.records.map((row, index) => ({
      row: index + 1,
      benchmarkId: row.BenchmarkId,
      studentId: row.StudentId,
      observationDate: row.ObservationDate,
      score: row.Correct + '/' + row.Attempts,
      prompt: row.ActualPromptLevel + ' · ' + row.ActualPromptCount
    }))
  };
}

function validateObservationBatch_(items, staff, batchId, fingerprint) {
  const errors = [];
  const conflicts = [];
  const records = [];
  const benchmarks = indexBy_(rows_('Benchmarks'), 'Id');
  const goals = indexBy_(rows_('Goals'), 'Id');
  const classes = indexBy_(activeRows_('Classes'), 'Id');
  const today = formatDate_(new Date());
  items.forEach((item, index) => {
    try {
      item = item || {};
      assertRequired_(item, [
        'benchmarkId', 'classId', 'correct', 'attempts',
        'observationDate', 'actualPromptLevel', 'actualPromptCount'
      ]);
      let benchmark = benchmarks[String(item.benchmarkId)];
      if (!benchmark) throw new Error('Benchmark was not found.');
      const observationDate = formatDate_(item.observationDate);
      if (!observationDate || observationDate > today) {
        throw new Error('Observation date must be today or earlier.');
      }
      if (benchmark.GoalId) {
        const originalBenchmark = benchmark;
        const goal = goals[String(benchmark.GoalId)];
        if (!goal || String(goal.StudentId) !== String(benchmark.StudentId)) {
          throw new Error('The benchmark goal relationship is invalid.');
        }
        const datedPhase = getPhaseForObservationDate_(benchmark.GoalId, observationDate);
        if (datedPhase && String(datedPhase.BenchmarkId) !== String(benchmark.Id)) {
          if (item.phaseDateResolution === 'USE_HISTORICAL_PHASE') {
            benchmark = benchmarks[String(datedPhase.BenchmarkId)];
            if (!benchmark) throw new Error('The historical benchmark is no longer available.');
            if (String(benchmark.GoalId) !== String(originalBenchmark.GoalId) ||
                String(benchmark.StudentId) !== String(originalBenchmark.StudentId)) {
              throw new Error('The historical benchmark does not belong to this student and goal.');
            }
          } else {
            conflicts.push({
              row: index + 1,
              code: 'PHASE_DATE_CONFLICT',
              observationDate: observationDate,
              selectedBenchmarkId: item.benchmarkId,
              suggestedBenchmarkId: datedPhase.BenchmarkId,
              message: 'A different benchmark was active on this observation date.'
            });
            return;
          }
        } else if (datedPhase) {
          const resolved = benchmarks[String(datedPhase.BenchmarkId)];
          if (!resolved ||
              String(resolved.GoalId) !== String(originalBenchmark.GoalId) ||
              String(resolved.StudentId) !== String(originalBenchmark.StudentId)) {
            throw new Error('The benchmark history does not belong to this student and goal.');
          }
        } else if (!isActiveGoal_(goal) || !toBoolean_(benchmark.Active) ||
            rows_('GoalPhaseHistory').some(row =>
              String(row.GoalId) === String(goal.Id)
            )) {
          throw new Error('This benchmark was not active on the observation date.');
        }
      } else if (!toBoolean_(benchmark.Active)) {
        throw new Error('Benchmark was not found or is inactive.');
      }
      const classRow = classes[String(item.classId)];
      if (!classRow) throw new Error('Class was not found.');
      assertObservationClassAccess_(staff, classRow);
      if (!benchmarkMatchesSubject_(benchmark, classRow.SubjectId)) {
        throw new Error('This benchmark is not relevant to the selected class subject.');
      }
      const correct = optionalInteger_(item.correct);
      const attempts = optionalInteger_(item.attempts);
      if (correct === null || attempts === null ||
          correct < 0 || attempts <= 0 || correct > attempts) {
        throw new Error('Successes must be between 0 and the total raw trials.');
      }
      const actualPromptLevel = normalizePromptLevel_(item.actualPromptLevel);
      const actualPromptCount = optionalInteger_(item.actualPromptCount);
      if (!actualPromptLevel || actualPromptCount === null || actualPromptCount < 0) {
        throw new Error('Prompt level and prompt count are required.');
      }
      if (actualPromptLevel === 'Independent' && actualPromptCount !== 0) {
        throw new Error('Independent observations must use a prompt count of 0.');
      }
      records.push({
        Id: uuid_(),
        Timestamp: new Date(),
        BenchmarkId: benchmark.Id,
        StudentId: benchmark.StudentId,
        StaffEmail: staff.Email,
        ClassId: classRow.Id,
        Correct: correct,
        Attempts: attempts,
        Percent: Math.round(correct / attempts * 1000) / 10,
        Notes: sanitizeText_(item.notes, 1000),
        ObservationDate: observationDate,
        ActualPromptLevel: actualPromptLevel,
        ActualPromptCount: actualPromptCount,
        SubmissionBatchId: batchId,
        SubmissionFingerprint: fingerprint || observationBatchFingerprint_(items),
        Status: 'ACTIVE',
        CorrectionOfEntryId: '',
        CorrectionReason: '',
        CorrectedBy: '',
        CorrectedAt: ''
      });
    } catch (error) {
      errors.push({ row: index + 1, message: error.message });
    }
  });
  if (conflicts.length) {
    return {
      ok: false,
      code: 'PHASE_DATE_CONFLICT',
      retryable: false,
      conflicts: conflicts,
      message: 'Resolve benchmark/date conflicts before saving.'
    };
  }
  if (errors.length) {
    return {
      ok: false,
      code: 'VALIDATION_FAILED',
      retryable: false,
      errors: errors,
      message: 'Fix the listed observations before saving.'
    };
  }
  return { ok: true, records: records };
}

function getCompletedObservationBatch_(batchId) {
  return rows_('BenchmarkEntries')
    .filter(row => String(row.SubmissionBatchId) === String(batchId))
    .sort((a, b) => a._row - b._row);
}

function completedObservationBatchResult_(batchId, entries, expectedCount, fingerprint) {
  const savedFingerprints = Array.from(new Set(
    entries.map(entry => String(entry.SubmissionFingerprint || '')).filter(Boolean)
  ));
  if ((expectedCount !== undefined && entries.length !== expectedCount) ||
      (fingerprint && savedFingerprints.length &&
        (savedFingerprints.length !== 1 || savedFingerprints[0] !== fingerprint))) {
    return {
      ok: false,
      code: 'BATCH_MISMATCH',
      retryable: false,
      submissionBatchId: batchId,
      message: 'This batch ID was already used for a different observation set.'
    };
  }
  return {
    ok: true,
    idempotent: entries.some(entry => entry._row),
    submissionBatchId: batchId,
    entryIds: entries.map(entry => entry.Id),
    entries: entries.map(entry => ({
      id: entry.Id,
      benchmarkId: entry.BenchmarkId,
      percent: toNumber_(entry.Percent)
    })),
    message: entries.length + ' observation' + (entries.length === 1 ? '' : 's') + ' saved.'
  };
}

function observationBatchFingerprint_(items) {
  const normalized = (items || []).map(item => ({
    benchmarkId: String(item && item.benchmarkId || ''),
    classId: String(item && item.classId || ''),
    observationDate: formatDate_(item && item.observationDate),
    correct: optionalInteger_(item && item.correct),
    attempts: optionalInteger_(item && item.attempts),
    actualPromptLevel: String(item && item.actualPromptLevel || ''),
    actualPromptCount: optionalInteger_(item && item.actualPromptCount),
    notes: String(item && item.notes || ''),
    phaseDateResolution: String(item && item.phaseDateResolution || '')
  }));
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(normalized)
  ).map(value => ((value + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function correctBenchmarkEntry(payload) {
  payload = payload || {};
  const staff = requireCaseManager_();
  assertRequired_(payload, ['entryId', 'replacement']);
  const correctionReason = sanitizeText_(payload.reason, 1000);
  if (!correctionReason) throw new Error('A correction reason is required.');
  const original = findOne_('BenchmarkEntries', row =>
    String(row.Id) === String(payload.entryId)
  );
  if (!original) throw new Error('Observation was not found.');
  if (String(original.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
    throw new Error('This observation has already been corrected.');
  }
  requireManagedStudent_(staff, original.StudentId);
  const replacementPayload = Object.assign({}, payload.replacement, {
    benchmarkId: payload.replacement.benchmarkId || original.BenchmarkId,
    classId: payload.replacement.classId || original.ClassId
  });
  const batchId = sanitizeText_(payload.submissionBatchId || uuid_(), 100);
  const fingerprint = observationBatchFingerprint_([replacementPayload]);
  let validated = validateObservationBatch_(
    [replacementPayload],
    staff,
    batchId,
    fingerprint
  );
  if (!validated.ok) return validated;

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) {
    return {
      ok: false,
      code: 'WRITE_BUSY',
      retryable: true,
      message: 'Observation saving is busy. Retry the correction shortly.'
    };
  }
  try {
    [
      'BenchmarkEntries',
      'Benchmarks',
      'BenchmarkSubjects',
      'Classes',
      'GoalPhaseHistory',
      'Goals'
    ].forEach(invalidateRowsCache_);
    validated = validateObservationBatch_(
      [replacementPayload],
      staff,
      batchId,
      fingerprint
    );
    if (!validated.ok) return validated;
    const current = findOne_('BenchmarkEntries', row =>
      String(row.Id) === String(payload.entryId)
    );
    if (!current || String(current.Status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      throw new Error('This observation was changed before your correction could be saved.');
    }
    const now = new Date();
    const replacement = validated.records[0];
    replacement.CorrectionOfEntryId = current.Id;
    replacement.CorrectionReason = correctionReason;
    appendRow_('BenchmarkEntries', replacement);
    updateRow_('BenchmarkEntries', current._row, {
      Status: 'CORRECTED',
      CorrectedBy: staff.Email,
      CorrectedAt: now
    });
    invalidateAppDataCache_('student');
    return {
      ok: true,
      originalEntryId: current.Id,
      replacementEntryId: replacement.Id,
      message: 'Observation correction saved with its audit history.'
    };
  } finally {
    lock.releaseLock();
  }
}

function saveBenchmark(payload) {
  const staff = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['studentId', 'subjectId']);
  if (!String(payload.taskDemandDescription || payload.skill || payload.description || '').trim()) {
    throw new Error('A task demand description is required.');
  }
  const student = findOne_('Students', row => String(row.Id) === String(payload.studentId));
  if (!student) throw new Error('Student was not found.');
  const subject = findOne_('Subjects', row =>
    String(row.Id) === String(payload.subjectId) && toBoolean_(row.Active)
  );
  if (!subject) throw new Error('Subject was not found.');
  if (!toBoolean_(staff.IsAdmin) && normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only manage benchmarks for your assigned students.');
  }

  const targetAccuracy = optionalNumber_(payload.targetAccuracyPct);
  const targetPromptLevel = normalizePromptLevel_(payload.targetPromptLevel);
  const targetPromptCeiling = optionalInteger_(
    payload.targetPromptCeiling === undefined
      ? payload.targetPromptCount
      : payload.targetPromptCeiling
  );
  const targetConsecutive = optionalInteger_(payload.targetConsecutiveSessions);
  const targetCorrect = optionalNumber_(payload.targetCorrect);
  const targetAttempts = optionalNumber_(payload.targetAttempts);
  const consistencyPassed = optionalInteger_(
    payload.consistencyTrialsPassed === undefined
      ? payload.requiredTrials
      : payload.consistencyTrialsPassed
  );
  const consistencyWindow = optionalInteger_(
    payload.consistencyTrialsWindow === undefined
      ? payload.totalTrials
      : payload.consistencyTrialsWindow
  );
  if (targetAccuracy !== null && (targetAccuracy < 0 || targetAccuracy > 100)) {
    throw new Error('Target accuracy must be from 0 to 100.');
  }
  if (targetPromptCeiling !== null && targetPromptCeiling < 0) {
    throw new Error('Target prompt ceiling cannot be negative.');
  }
  if (targetConsecutive !== null && targetConsecutive <= 0) {
    throw new Error('Target consecutive sessions must be positive.');
  }
  if ((targetCorrect === null) !== (targetAttempts === null) ||
      (targetAttempts !== null &&
        (targetCorrect < 0 || targetAttempts <= 0 || targetCorrect > targetAttempts))) {
    throw new Error('The correctness metric is invalid.');
  }
  if ((consistencyPassed === null) !== (consistencyWindow === null) ||
      (consistencyWindow !== null &&
        (consistencyPassed <= 0 || consistencyWindow <= 0 ||
         consistencyPassed > consistencyWindow))) {
    throw new Error('The consistency window is invalid.');
  }
  const taskDemand = sanitizeText_(
    payload.taskDemandDescription || payload.skill || payload.description,
    5000
  );
  if (payload.goalArchetype && !normalizeGoalArchetype_(payload.goalArchetype)) {
    throw new Error('Goal archetype is invalid.');
  }
  if (payload.evaluationWindowUnit &&
      !normalizeEvaluationWindowUnit_(payload.evaluationWindowUnit)) {
    throw new Error('Evaluation window is invalid.');
  }
  const goalArchetype = normalizeGoalArchetype_(payload.goalArchetype) ||
    inferBenchmarkArchetype_(payload.description || taskDemand);
  const evaluationWindowUnit = normalizeEvaluationWindowUnit_(payload.evaluationWindowUnit) ||
    inferEvaluationWindowUnit_(payload.description || taskDemand, goalArchetype);
  const record = {
    StudentId: student.Id,
    SubjectId: sanitizeText_(payload.subjectId, 100),
    GoalId: sanitizeText_(payload.goalId, 100),
    Category: sanitizeText_(payload.category || 'Benchmark', 120),
    Skill: taskDemand,
    TargetCorrect: targetCorrect === null ? '' : targetCorrect,
    TargetAttempts: targetAttempts === null ? '' : targetAttempts,
    RequiredTrials: consistencyPassed === null ? '' : consistencyPassed,
    TotalTrials: consistencyWindow === null ? '' : consistencyWindow,
    StartDate: payload.startDate || '',
    DueDate: payload.dueDate || '',
    Critical: Boolean(payload.critical),
    Active: payload.active === undefined ? true : Boolean(payload.active),
    Description: sanitizeText_(payload.description || taskDemand, 5000),
    OrderIndex: optionalInteger_(payload.orderIndex) || 1,
    TaskDemandDescription: taskDemand,
    TargetPromptLevel: targetPromptLevel,
    TargetPromptCount: targetPromptCeiling === null ? '' : targetPromptCeiling,
    TargetAccuracyPct: targetAccuracy === null ? '' : targetAccuracy,
    TargetConsecutiveSessions: targetConsecutive === null ? '' : targetConsecutive,
    GoalArchetype: goalArchetype,
    TargetPromptCeiling: targetPromptCeiling === null ? '' : targetPromptCeiling,
    ConsistencyTrialsPassed: consistencyPassed === null ? '' : consistencyPassed,
    ConsistencyTrialsWindow: consistencyWindow === null ? '' : consistencyWindow,
    EvaluationWindowUnit: evaluationWindowUnit
  };

  if (payload.id) {
    const existing = findOne_('Benchmarks', row => String(row.Id) === String(payload.id));
    if (!existing) throw new Error('Benchmark was not found.');
    if (payload.goalId === undefined) delete record.GoalId;
    updateRow_('Benchmarks', existing._row, record);
    invalidateAppDataCache_('student');
    return { ok: true, id: existing.Id, message: 'Benchmark updated.' };
  }
  record.Id = uuid_();
  appendRow_('Benchmarks', record);
  invalidateAppDataCache_('student');
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
  invalidateAppDataCache_('student');
  return { ok: true };
}

function getBenchmarkProgress(benchmarkId, force) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    const benchmark = findOne_('Benchmarks', row => String(row.Id) === String(benchmarkId));
    if (!benchmark) throw new Error('Benchmark was not found.');
    const student = findOne_('Students', row => String(row.Id) === String(benchmark.StudentId));
    if (!toBoolean_(staff.IsAdmin) && student &&
        normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
      throw new Error('You can only view progress for your assigned students.');
    }
    const producer = () => {
      const entries = rows_('BenchmarkEntries')
        .filter(row => String(row.BenchmarkId) === String(benchmarkId))
        .filter(row => String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE')
        .sort(compareObservationEntries_);
      const frequencyChartValues = buildFrequencyChartValueIndex_(benchmark, entries);
      return {
        benchmark: publicBenchmark_(
          benchmark,
          student,
          entries[entries.length - 1],
          entries.length,
          entries
        ),
        points: entries.map(row => ({
          timestamp: row.Timestamp,
          observationDate: formatDate_(row.ObservationDate || row.Timestamp),
          percent: toNumber_(row.Percent),
          correct: toNumber_(row.Correct),
          attempts: toNumber_(row.Attempts),
          actualPromptLevel: row.ActualPromptLevel || '',
          actualPromptCount: optionalInteger_(row.ActualPromptCount),
          frequencyQuotaProgress: frequencyChartValues[row.Id] === undefined
            ? null
            : frequencyChartValues[row.Id],
          notes: row.Notes,
          staffEmail: row.StaffEmail
        }))
      };
    };
    return cachedResponse_(
      'benchmark-progress',
      [normalizeEmail_(staff.Email), benchmark.Id],
      producer,
      null,
      Boolean(force)
    );
  });
}

function getCriticalBenchmarks_(staff) {
  const students = indexBy_(activeRows_('Students'), 'Id');
  return getCurrentActiveBenchmarks_()
    .filter(row => toBoolean_(row.Critical))
    .filter(row => staff.Role !== VOICES.ROLES.CASE_MANAGER ||
      toBoolean_(staff.IsAdmin) ||
      (students[row.StudentId] &&
        normalizeEmail_(students[row.StudentId].CaseManagerEmail) === normalizeEmail_(staff.Email)))
    .map(row => publicBenchmark_(row, students[row.StudentId]))
    .slice(0, 12);
}

function publicBenchmark_(row, student, lastEntry, entryCount, entries) {
  const subjects = getSubjectIndex_();
  const subjectIds = Array.from(new Set(
    getBenchmarkSubjectIds_(row.Id).concat(row.SubjectId ? [String(row.SubjectId)] : [])
  )).filter(id => subjects[id]);
  const subjectNames = subjectIds.map(id => subjects[id].Name);
  const targetAccuracy = optionalNumber_(row.TargetAccuracyPct);
  const targetCorrect = optionalNumber_(row.TargetCorrect);
  const targetAttempts = optionalNumber_(row.TargetAttempts);
  const consistencyPassed = optionalInteger_(
    row.ConsistencyTrialsPassed === '' || row.ConsistencyTrialsPassed === undefined
      ? row.RequiredTrials
      : row.ConsistencyTrialsPassed
  );
  const consistencyWindow = optionalInteger_(
    row.ConsistencyTrialsWindow === '' || row.ConsistencyTrialsWindow === undefined
      ? row.TotalTrials
      : row.ConsistencyTrialsWindow
  );
  const targetPromptCeiling = optionalInteger_(
    row.TargetPromptCeiling === '' || row.TargetPromptCeiling === undefined
      ? row.TargetPromptCount
      : row.TargetPromptCeiling
  );
  const targetConsecutiveSessions = optionalInteger_(row.TargetConsecutiveSessions);
  const orderIndex = optionalInteger_(row.OrderIndex) || 1;
  const label = 'Benchmark ' + orderIndex;
  const taskDemand = applicationBenchmarkText_(
    row.TaskDemandDescription || row.Skill || row.Description || '',
    orderIndex
  );
  const category = /^(?:Phase|Short-Term Objective)\s+\d+$/i.test(
    String(row.Category || '').trim()
  ) ? label : row.Category;
  const description = applicationBenchmarkText_(row.Description, orderIndex);
  const targetParts = [
    targetAccuracy === null ? '' : targetAccuracy + '% accuracy',
    row.TargetPromptLevel
      ? row.TargetPromptLevel + (targetPromptCeiling === null ? '' : ' · ' + targetPromptCeiling + ' prompt' +
        (targetPromptCeiling === 1 ? '' : 's'))
      : '',
    consistencyPassed === null
      ? ''
      : consistencyPassed + ' of ' + consistencyWindow + ' consistency',
    targetConsecutiveSessions === null
      ? ''
      : targetConsecutiveSessions + ' consecutive session' +
        (targetConsecutiveSessions === 1 ? '' : 's')
  ].filter(Boolean);
  return {
    id: row.Id,
    goalId: row.GoalId,
    studentId: row.StudentId,
    studentName: student ? student.Name : '',
    subjectId: row.SubjectId,
    subjectName: subjectNames[0] || '',
    subjectIds: subjectIds,
    subjectNames: subjectNames,
    label: label,
    category: category,
    skill: row.Skill,
    orderIndex: orderIndex,
    taskDemandDescription: taskDemand,
    targetCorrect: targetCorrect,
    targetAttempts: targetAttempts,
    requiredTrials: consistencyPassed,
    totalTrials: consistencyWindow,
    goalArchetype: normalizeGoalArchetype_(row.GoalArchetype) ||
      inferBenchmarkArchetype_(row.Description || taskDemand),
    targetAccuracyPct: targetAccuracy,
    targetPromptLevel: row.TargetPromptLevel || '',
    targetPromptCount: targetPromptCeiling,
    targetPromptCeiling: targetPromptCeiling,
    consistencyTrialsPassed: consistencyPassed,
    consistencyTrialsWindow: consistencyWindow,
    targetConsecutiveSessions: targetConsecutiveSessions,
    evaluationWindowUnit: normalizeEvaluationWindowUnit_(row.EvaluationWindowUnit) ||
      inferEvaluationWindowUnit_(row.Description || taskDemand, row.GoalArchetype),
    startDate: row.StartDate,
    dueDate: row.DueDate,
    critical: toBoolean_(row.Critical),
    active: toBoolean_(row.Active),
    description: description,
    display: [
      label,
      category === label ? '' : category,
      taskDemand,
      targetParts.join(' · ')
    ].filter(Boolean).join(' — '),
    mastery: Array.isArray(entries) ? summarizeBenchmarkMastery_(row, entries) : null,
    lastEntry: lastEntry ? {
      timestamp: lastEntry.Timestamp,
      observationDate: formatDate_(lastEntry.ObservationDate || lastEntry.Timestamp),
      percent: toNumber_(lastEntry.Percent),
      actualPromptLevel: lastEntry.ActualPromptLevel || '',
      actualPromptCount: optionalInteger_(lastEntry.ActualPromptCount)
    } : null,
    entryCount: entryCount || 0
  };
}

function applicationBenchmarkText_(value, orderIndex) {
  return String(value || '').replace(
    /^\s*(?:STO|Short\s*[-–—]?\s*Term\s+Objective|Objective|Phase|Benchmark)\s*#?\s*\d+\s*[:\-–—.]?\s*/i,
    ''
  );
}

function canUseAnyObservationClass_(staff) {
  return staff.Role === VOICES.ROLES.AIDE ||
    staff.Role === VOICES.ROLES.CASE_MANAGER ||
    toBoolean_(staff.IsAdmin);
}

function assertObservationClassAccess_(staff, classRow) {
  if (canUseAnyObservationClass_(staff)) return;
  const email = normalizeEmail_(staff.Email);
  if (normalizeEmail_(classRow.TeacherEmail) === email) return;
  const assigned = findOne_('ClassAides', row =>
    String(row.ClassId) === String(classRow.Id) && normalizeEmail_(row.AideEmail) === email
  );
  if (!assigned) throw new Error('You are not assigned to this class.');
}

function getCaseManagerDashboard_(staff, options) {
  options = options || {};
  const goalData = options.includeGoalCatalog === false
    ? {
        students: managedStudents_(staff).map(publicStudent_),
        goals: [],
        benchmarks: []
      }
    : getGoalManagerData_(staff, '', true);
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
  rows_('Notifications')
    .filter(row =>
      row.Status === 'OPEN' &&
      row.Type === 'BENCHMARK_ENDED' &&
      (isAdmin || String(row.Recipients || '').split(',')
        .map(normalizeEmail_)
        .includes(email))
    )
    .forEach(row => todos.push({
      type: 'BENCHMARK',
      urgent: true,
      title: 'Benchmark dates need review',
      detail: row.Message
    }));
  rows_('Notifications')
    .filter(row =>
      row.Status === 'OPEN' &&
      String(row.Type || '').startsWith('MISSING_BENCHMARK_ENTRY|') &&
      (isAdmin || String(row.Recipients || '').split(',')
        .map(normalizeEmail_)
        .includes(email))
    )
    .forEach(row => todos.push({
      type: 'BENCHMARK',
      urgent: true,
      title: 'Benchmark observation overdue',
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
