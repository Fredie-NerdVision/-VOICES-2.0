function parseGoalObjectives_(value) {
  const text = sanitizeText_(value, 20000);
  const marker = /short\s*[-–—]?\s*term\s+objective\b\s*[:\-–—]?\s*/gi;
  const matches = [];
  let match;
  while ((match = marker.exec(text)) !== null) {
    matches.push({ index: match.index, end: marker.lastIndex });
  }
  if (!matches.length) {
    throw new Error('Add three “Short-Term Objective” headings.');
  }
  if (matches.length !== 3) {
    throw new Error('Each goal must contain exactly three short-term objectives.');
  }
  const objectives = matches.map((item, index) => {
    const end = matches[index + 1] ? matches[index + 1].index : text.length;
    const objective = text.slice(item.end, end)
      .replace(/^[\s:;#\d.)\]-]+/, '')
      .trim();
    return parseObjectiveRecord_(objective, index);
  });
  return objectives;
}

function parseObjectiveRecord_(objective, index) {
  if (!objective) {
    throw new Error('Short-Term Objective ' + (index + 1) + ' has no text.');
  }
  const ratios = extractObjectiveRatios_(objective);
  if (!ratios.length) {
    throw new Error(
      'Short-Term Objective ' + (index + 1) +
      ' needs a metric such as 4/5 or 4 out of 5.'
    );
  }
  const correctness = ratios[0];
  const trials = ratios[1] || ratios[0];
  return {
    index: index,
    text: objective,
    targetCorrect: correctness.numerator,
    targetAttempts: correctness.denominator,
    requiredTrials: trials.numerator,
    totalTrials: trials.denominator,
    metric: correctness.numerator + '/' + correctness.denominator +
      (ratios[1] ? ' in ' + trials.numerator + '/' + trials.denominator + ' trials' : '')
  };
}

function extractObjectiveRatios_(text) {
  const regex = /(\d+)\s*(?:\/|out\s+of)\s*(\d+)/gi;
  const ratios = [];
  let match;
  while ((match = regex.exec(String(text || ''))) !== null) {
    const numerator = Number(match[1]);
    const denominator = Number(match[2]);
    if (denominator <= 0 || numerator < 0 || numerator > denominator) {
      throw new Error('Objective metrics must be between 0 and the total opportunities.');
    }
    ratios.push({ numerator: numerator, denominator: denominator });
  }
  return ratios;
}

function createGoal(payload) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    payload = payload || {};
    assertRequired_(payload, ['studentId', 'goal', 'objectivesText']);
    const student = requireManagedStudent_(staff, payload.studentId);
    let objectives = parseGoalObjectives_(payload.objectivesText);
    const overrides = Array.isArray(payload.objectiveOverrides)
      ? payload.objectiveOverrides
      : [];
    objectives = objectives.map(objective => {
      const override = overrides.find(item => Number(item.index) === objective.index);
      return override && String(override.text || '').trim()
        ? parseObjectiveRecord_(
          sanitizeText_(override.text, 5000),
          objective.index
        )
        : objective;
    });
    const subjects = indexBy_(activeRows_('Subjects'), 'Id');
    const subjectIds = Array.from(new Set(
      (Array.isArray(payload.subjectIds) ? payload.subjectIds : [])
        .map(String)
        .filter(id => subjects[id])
    ));
    if (!subjectIds.length) {
      throw new Error('Choose at least one relevant class or subject for the goal.');
    }
    const startDate = payload.startDate || formatDate_(new Date());
    const dueDate = payload.dueDate || formatDate_(
      new Date(parseDate_(startDate).getTime() + 365 * 86400000)
    );
    if (parseDate_(dueDate) < parseDate_(startDate)) {
      throw new Error('The goal due date must be on or after its start date.');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    const goalId = uuid_();
    const benchmarkIds = [];
    try {
      appendRow_('Goals', {
        Id: goalId,
        StudentId: student.Id,
        Goal: sanitizeText_(payload.goal, 4000),
        StartDate: startDate,
        DueDate: dueDate,
        Active: true,
        CreatedBy: staff.Email,
        CreatedAt: new Date(),
        UpdatedAt: new Date()
      });
      objectives.forEach((objective, index) => {
        const benchmarkId = uuid_();
        benchmarkIds.push(benchmarkId);
        appendRow_('Benchmarks', {
          Id: benchmarkId,
          GoalId: goalId,
          StudentId: student.Id,
          SubjectId: subjectIds[0],
          Category: 'Short-Term Objective ' + (index + 1),
          Skill: objective.text,
          TargetCorrect: objective.targetCorrect,
          TargetAttempts: objective.targetAttempts,
          RequiredTrials: objective.requiredTrials,
          TotalTrials: objective.totalTrials,
          StartDate: startDate,
          DueDate: dueDate,
          Critical: false,
          Active: index === 0,
          Description: objective.text
        });
        subjectIds.forEach(subjectId => appendRow_('BenchmarkSubjects', {
          BenchmarkId: benchmarkId,
          SubjectId: subjectId
        }));
      });
    } catch (error) {
      rollbackGoalCreation_(goalId, benchmarkIds);
      throw error;
    } finally {
      lock.releaseLock();
    }
    return {
      ok: true,
      id: goalId,
      benchmarkCount: benchmarkIds.length,
      message: 'Goal and three benchmarks created.'
    };
  });
}

function rollbackGoalCreation_(goalId, benchmarkIds) {
  const ids = new Set(benchmarkIds.map(String));
  rows_('BenchmarkSubjects')
    .filter(row => ids.has(String(row.BenchmarkId)))
    .sort((a, b) => b._row - a._row)
    .forEach(row => deleteRow_('BenchmarkSubjects', row._row));
  rows_('Benchmarks')
    .filter(row => ids.has(String(row.Id)))
    .sort((a, b) => b._row - a._row)
    .forEach(row => deleteRow_('Benchmarks', row._row));
  rows_('Goals')
    .filter(row => String(row.Id) === String(goalId))
    .sort((a, b) => b._row - a._row)
    .forEach(row => deleteRow_('Goals', row._row));
}

function getGoalManagerData() {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    return getGoalManagerData_(staff);
  });
}

function getGoalManagerData_(staff) {
  const students = managedStudents_(staff);
  const studentIds = new Set(students.map(row => String(row.Id)));
  const studentIndex = indexBy_(students, 'Id');
  const goals = activeRows_('Goals')
    .filter(row => studentIds.has(String(row.StudentId)));
  const goalIds = new Set(goals.map(row => String(row.Id)));
  const benchmarks = rows_('Benchmarks')
    .filter(row => goalIds.has(String(row.GoalId)));
  return {
    students: students.map(publicStudent_),
    goals: goals.map(row => publicGoal_(
      row,
      studentIndex[row.StudentId],
      benchmarks.filter(benchmark => String(benchmark.GoalId) === String(row.Id))
    )),
    benchmarks: benchmarks.map(row => publicBenchmark_(row, studentIndex[row.StudentId]))
  };
}

function getStudentGoalWorkspace(studentId) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    const student = requireManagedStudent_(staff, studentId);
    const goals = activeRows_('Goals')
      .filter(row => String(row.StudentId) === String(student.Id));
    const goalIds = new Set(goals.map(row => String(row.Id)));
    const benchmarks = rows_('Benchmarks')
      .filter(row => goalIds.has(String(row.GoalId)));
    const benchmarkIds = new Set(benchmarks.map(row => String(row.Id)));
    const entries = rows_('BenchmarkEntries')
      .filter(row => benchmarkIds.has(String(row.BenchmarkId)))
      .sort((a, b) => String(a.Timestamp).localeCompare(String(b.Timestamp)));
    const benchmarkIndex = indexBy_(benchmarks, 'Id');
    return {
      student: publicStudent_(student),
      goals: goals.map(goal => {
        const goalBenchmarks = benchmarks.filter(row =>
          String(row.GoalId) === String(goal.Id)
        );
        const ids = new Set(goalBenchmarks.map(row => String(row.Id)));
        const goalEntries = entries.filter(row => ids.has(String(row.BenchmarkId)));
        return Object.assign({}, publicGoal_(goal, student, goalBenchmarks), {
          benchmarks: goalBenchmarks.map(row => publicBenchmark_(row, student)),
          metrics: summarizeGoalEntries_(goalEntries),
          points: goalEntries.map(row => ({
            timestamp: row.Timestamp,
            percent: toNumber_(row.Percent),
            correct: toNumber_(row.Correct),
            attempts: toNumber_(row.Attempts),
            benchmarkId: row.BenchmarkId,
            benchmark: benchmarkIndex[row.BenchmarkId]
              ? benchmarkIndex[row.BenchmarkId].Skill
              : ''
          }))
        });
      })
    };
  });
}

function summarizeGoalEntries_(entries) {
  if (!entries.length) {
    return { entryCount: 0, latestPercent: null, averagePercent: null, trend: null };
  }
  const values = entries.map(row => toNumber_(row.Percent));
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;
  return {
    entryCount: values.length,
    latestPercent: latest,
    averagePercent: Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length * 10
    ) / 10,
    trend: previous === null ? null : Math.round((latest - previous) * 10) / 10
  };
}

function setActiveGoalBenchmark(payload) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    payload = payload || {};
    assertRequired_(payload, ['goalId', 'benchmarkId']);
    const goal = findOne_('Goals', row =>
      String(row.Id) === String(payload.goalId) && toBoolean_(row.Active)
    );
    if (!goal) throw new Error('Goal was not found.');
    requireManagedStudent_(staff, goal.StudentId);
    const benchmarks = rows_('Benchmarks')
      .filter(row => String(row.GoalId) === String(goal.Id));
    const selected = benchmarks.find(row =>
      String(row.Id) === String(payload.benchmarkId)
    );
    if (!selected) throw new Error('Benchmark was not found in this goal.');
    benchmarks.forEach(row => updateRow_('Benchmarks', row._row, {
      Active: String(row.Id) === String(selected.Id)
    }));
    updateRow_('Goals', goal._row, { UpdatedAt: new Date() });
    return { ok: true, goalId: goal.Id, benchmarkId: selected.Id };
  });
}

function setGoalCritical(payload) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    payload = payload || {};
    assertRequired_(payload, ['goalId']);
    const goal = findOne_('Goals', row =>
      String(row.Id) === String(payload.goalId) && toBoolean_(row.Active)
    );
    if (!goal) throw new Error('Goal was not found.');
    requireManagedStudent_(staff, goal.StudentId);
    const critical = toBoolean_(payload.critical);
    rows_('Benchmarks')
      .filter(row => String(row.GoalId) === String(goal.Id))
      .forEach(row => updateRow_('Benchmarks', row._row, { Critical: critical }));
    updateRow_('Goals', goal._row, { UpdatedAt: new Date() });
    return { ok: true, goalId: goal.Id, critical: critical };
  });
}

function deactivateGoal(goalId) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    const goal = findOne_('Goals', row => String(row.Id) === String(goalId));
    if (!goal) throw new Error('Goal was not found.');
    requireManagedStudent_(staff, goal.StudentId);
    updateRow_('Goals', goal._row, { Active: false, UpdatedAt: new Date() });
    rows_('Benchmarks')
      .filter(row => String(row.GoalId) === String(goal.Id))
      .forEach(row => updateRow_('Benchmarks', row._row, { Active: false }));
    return { ok: true };
  });
}

function getBenchmarkEntryDetails(benchmarkId) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    const benchmark = findOne_('Benchmarks', row =>
      String(row.Id) === String(benchmarkId)
    );
    if (!benchmark) throw new Error('Benchmark was not found.');
    const student = requireManagedStudent_(staff, benchmark.StudentId);
    const staffIndex = rows_('Staff').reduce((map, row) => {
      map[normalizeEmail_(row.Email)] = publicStaff_(row);
      return map;
    }, {});
    return {
      benchmark: publicBenchmark_(benchmark, student),
      entries: rows_('BenchmarkEntries')
        .filter(row => String(row.BenchmarkId) === String(benchmark.Id))
        .sort((a, b) => String(b.Timestamp).localeCompare(String(a.Timestamp)))
        .map(row => {
          const enteredBy = staffIndex[normalizeEmail_(row.StaffEmail)];
          return {
            id: row.Id,
            timestamp: row.Timestamp,
            correct: toNumber_(row.Correct),
            attempts: toNumber_(row.Attempts),
            percent: toNumber_(row.Percent),
            notes: row.Notes,
            staffEmail: row.StaffEmail,
            staffName: enteredBy ? enteredBy.displayName : row.StaffEmail
          };
        })
    };
  });
}

function publicGoal_(row, student, benchmarks) {
  const goalBenchmarks = Array.isArray(benchmarks) ? benchmarks : [];
  const subjects = getSubjectIndex_();
  const subjectIds = Array.from(new Set(goalBenchmarks.reduce((ids, benchmark) =>
    ids.concat(
      getBenchmarkSubjectIds_(benchmark.Id),
      benchmark.SubjectId ? [String(benchmark.SubjectId)] : []
    ), []
  ))).filter(id => subjects[id]);
  return {
    id: row.Id,
    studentId: row.StudentId,
    studentName: student ? student.Name : '',
    goal: row.Goal,
    startDate: formatDate_(row.StartDate),
    dueDate: formatDate_(row.DueDate),
    active: toBoolean_(row.Active),
    critical: goalBenchmarks.some(benchmark => toBoolean_(benchmark.Critical)),
    subjectIds: subjectIds,
    subjectNames: subjectIds.map(id => subjects[id].Name),
    createdBy: row.CreatedBy,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt
  };
}

function managedStudents_(staff) {
  const email = normalizeEmail_(staff.Email);
  const students = activeRows_('Students');
  return toBoolean_(staff.IsAdmin)
    ? students
    : students.filter(row =>
      normalizeEmail_(row.CaseManagerEmail) === email
    );
}

function requireManagedStudent_(staff, studentId) {
  const student = findOne_('Students', row =>
    String(row.Id) === String(studentId) && toBoolean_(row.Active)
  );
  if (!student) throw new Error('Student was not found.');
  if (!toBoolean_(staff.IsAdmin) &&
      normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only manage goals for your assigned students.');
  }
  return student;
}

function getBenchmarkSubjectIds_(benchmarkId) {
  if (VOICES_INDEX_CACHE && !VOICES_INDEX_CACHE.benchmarkSubjects) {
    VOICES_INDEX_CACHE.benchmarkSubjects = rows_('BenchmarkSubjects').reduce((map, row) => {
      const id = String(row.BenchmarkId);
      if (!map[id]) map[id] = [];
      map[id].push(String(row.SubjectId));
      return map;
    }, {});
  }
  if (VOICES_INDEX_CACHE) {
    return (VOICES_INDEX_CACHE.benchmarkSubjects[String(benchmarkId)] || []).slice();
  }
  return rows_('BenchmarkSubjects')
    .filter(row => String(row.BenchmarkId) === String(benchmarkId))
    .map(row => String(row.SubjectId));
}

function getSubjectIndex_() {
  if (VOICES_INDEX_CACHE && !VOICES_INDEX_CACHE.subjects) {
    VOICES_INDEX_CACHE.subjects = indexBy_(activeRows_('Subjects'), 'Id');
  }
  return VOICES_INDEX_CACHE
    ? VOICES_INDEX_CACHE.subjects
    : indexBy_(activeRows_('Subjects'), 'Id');
}
