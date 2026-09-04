function parseGoalObjectives_(value) {
  const text = sanitizeText_(value, 20000);
  if (!text) return [];
  const marker = /(?:^|\n)\s*(?:short\s*[-–—]?\s*term\s+objective|benchmark|phase|objective)\b\s*(?:#?\s*\d+)?\s*[:\-–—]?\s*/gim;
  const matches = [];
  let match;
  while ((match = marker.exec(text)) !== null) {
    matches.push({ index: match.index, end: marker.lastIndex });
  }
  if (!matches.length) {
    return [parseObjectiveRecord_(text, 0)];
  }
  return matches.map((item, index) => {
    const end = matches[index + 1] ? matches[index + 1].index : text.length;
    const objective = text.slice(item.end, end)
      .replace(/^[\s:;#\d.)\]-]+/, '')
      .trim();
    return parseObjectiveRecord_(objective, index);
  });
}

function parseObjectiveRecord_(objective, index) {
  if (!objective) {
    throw new Error('Phase ' + (index + 1) + ' has no task description.');
  }
  const ratios = extractObjectiveRatios_(objective);
  const percentageMatch = String(objective).match(/(\d+(?:\.\d+)?)\s*%/);
  const promptLevel = parsePromptLevel_(objective);
  const promptCount = parsePromptCount_(objective, promptLevel);
  const consecutiveMatch = String(objective).match(
    /(\d+)\s+consecutive\s+(?:sessions?|observations?)\b/i
  ) || String(objective).match(
    /(?:for|across|in)\s+(\d+)\s+(?:sessions?|observations?)\b/i
  );
  const correctness = ratios[0] || null;
  const trials = ratios[1] || null;
  const targetAccuracy = percentageMatch
    ? Number(percentageMatch[1])
    : (correctness ? Math.round(correctness.numerator / correctness.denominator * 1000) / 10 : null);
  return {
    index: index,
    orderIndex: index + 1,
    text: objective,
    taskDemandDescription: objective,
    targetCorrect: correctness ? correctness.numerator : null,
    targetAttempts: correctness ? correctness.denominator : null,
    requiredTrials: trials ? trials.numerator : null,
    totalTrials: trials ? trials.denominator : null,
    targetAccuracyPct: targetAccuracy,
    targetPromptLevel: promptLevel,
    targetPromptCount: promptCount,
    targetConsecutiveSessions: consecutiveMatch ? Number(consecutiveMatch[1]) : null,
    metric: targetAccuracy === null ? '' : targetAccuracy + '%'
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

function parsePromptLevel_(text) {
  const value = String(text || '');
  if (/\bindependent(?:ly)?\b/i.test(value)) return 'Independent';
  if (/\bverbal\b/i.test(value)) return 'Verbal';
  if (/\b(?:gestural|visual)\b/i.test(value)) return 'Gestural/Visual';
  if (/\bmodel(?:ing|led)?\b/i.test(value)) return 'Model';
  if (/\bphysical\b/i.test(value)) return 'Physical';
  return '';
}

function parsePromptCount_(text, promptLevel) {
  if (promptLevel === 'Independent') return 0;
  const matches = Array.from(String(text || '').matchAll(
    /(?:no\s+more\s+than|maximum\s+of|up\s+to|with|using)?\s*(\d+)\s+(?:\w+\s+)?prompts?\b/gi
  ));
  return matches.length ? Number(matches[matches.length - 1][1]) : null;
}

function previewGoalPhases(payload) {
  requireCaseManager_();
  payload = payload || {};
  return {
    ok: true,
    phases: parseGoalObjectives_(payload.objectivesText || '')
  };
}

function createGoal(payload) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    payload = payload || {};
    assertRequired_(payload, ['studentId', 'goal']);
    const student = requireManagedStudent_(staff, payload.studentId);
    const sourcePhases = Array.isArray(payload.phases)
      ? payload.phases
      : parseGoalObjectives_(payload.objectivesText || '');
    const phases = sourcePhases.map((phase, index) =>
      normalizeGoalPhase_(phase, index, payload.startDate, payload.dueDate)
    );
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
    const status = normalizeGoalStatus_(payload.status, phases.length);
    const activeIndex = phases.length && status === 'ACTIVE'
      ? Math.max(0, phases.findIndex(phase => phase.active))
      : -1;
    const importBatchId = sanitizeText_(payload.importBatchId || '', 100);
    const importGoalKey = sanitizeText_(payload.importGoalKey || '', 100);
    if (Boolean(importBatchId) !== Boolean(importGoalKey)) {
      throw new Error('Bulk goal imports require both an import batch ID and goal key.');
    }
    const importFingerprint = importBatchId
      ? goalImportFingerprint_({
          studentId: student.Id,
          goal: sanitizeText_(payload.goal, 4000),
          domain: sanitizeText_(payload.domain || '', 100),
          status: status,
          startDate: startDate,
          dueDate: dueDate,
          subjectIds: subjectIds.slice().sort(),
          phases: phases
        })
      : '';

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) {
      return { ok: false, code: 'WRITE_BUSY', retryable: true };
    }
    let goalId = '';
    const benchmarkIds = [];
    try {
      invalidateRowsCache_('Goals');
      invalidateRowsCache_('Benchmarks');
      if (importBatchId) {
        const existing = findOne_('Goals', row =>
          String(row.ImportBatchId || '') === importBatchId &&
          String(row.ImportGoalKey || '') === importGoalKey
        );
        if (existing) {
          if (String(existing.ImportFingerprint || '') !== importFingerprint) {
            return {
              ok: false,
              code: 'IMPORT_MISMATCH',
              retryable: false,
              message: 'This import goal key was already used with different content.'
            };
          }
          const existingBenchmarkCount = rows_('Benchmarks')
            .filter(row => String(row.GoalId) === String(existing.Id))
            .length;
          if (existingBenchmarkCount !== phases.length) {
            return {
              ok: false,
              code: 'IMPORT_INCOMPLETE',
              retryable: false,
              message: 'A prior attempt left this goal incomplete; review it before retrying.'
            };
          }
          return {
            ok: true,
            id: existing.Id,
            benchmarkCount: existingBenchmarkCount,
            alreadyCreated: true,
            message: 'Goal was already created by this import.'
          };
        }
      }
      goalId = uuid_();
      appendRow_('Goals', {
        Id: goalId,
        StudentId: student.Id,
        Goal: sanitizeText_(payload.goal, 4000),
        StartDate: startDate,
        DueDate: dueDate,
        Active: status === 'ACTIVE',
        CreatedBy: staff.Email,
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
        Domain: sanitizeText_(payload.domain || '', 100),
        Status: status,
        ImportBatchId: importBatchId,
        ImportGoalKey: importGoalKey,
        ImportFingerprint: importFingerprint
      });
      const benchmarkRows = phases.map((phase, index) => {
        const benchmarkId = uuid_();
        benchmarkIds.push(benchmarkId);
        return {
          Id: benchmarkId,
          GoalId: goalId,
          StudentId: student.Id,
          SubjectId: subjectIds[0],
          Category: 'Phase ' + (index + 1),
          Skill: phase.taskDemandDescription,
          TargetCorrect: phase.targetCorrect,
          TargetAttempts: phase.targetAttempts,
          RequiredTrials: phase.requiredTrials,
          TotalTrials: phase.totalTrials,
          StartDate: phase.startDate || startDate,
          DueDate: phase.dueDate || dueDate,
          Critical: false,
          Active: index === activeIndex,
          Description: phase.text || phase.taskDemandDescription,
          OrderIndex: phase.orderIndex,
          TaskDemandDescription: phase.taskDemandDescription,
          TargetPromptLevel: phase.targetPromptLevel,
          TargetPromptCount: phase.targetPromptCount,
          TargetAccuracyPct: phase.targetAccuracyPct,
          TargetConsecutiveSessions: phase.targetConsecutiveSessions
        };
      });
      appendRows_('Benchmarks', benchmarkRows);
      const subjectRows = benchmarkRows.reduce((rows, benchmark) =>
        rows.concat(subjectIds.map(subjectId => ({
          BenchmarkId: benchmark.Id,
          SubjectId: subjectId
        }))), []);
      appendRows_('BenchmarkSubjects', subjectRows);
      if (activeIndex >= 0) {
        appendRow_('GoalPhaseHistory', {
          Id: uuid_(),
          GoalId: goalId,
          BenchmarkId: benchmarkRows[activeIndex].Id,
          ActivatedAt: startDate,
          EndedAt: '',
          ChangedBy: staff.Email,
          ChangeReason: 'Initial active phase',
          Source: 'APPLICATION'
        });
      }
    } catch (error) {
      if (goalId) rollbackGoalCreation_(goalId, benchmarkIds);
      throw error;
    } finally {
      lock.releaseLock();
    }
    return {
      ok: true,
      id: goalId,
      benchmarkCount: benchmarkIds.length,
      message: 'Goal and ' + benchmarkIds.length + ' phase' +
        (benchmarkIds.length === 1 ? '' : 's') + ' created.'
    };
  });
}

function previewBulkGoals(payload) {
  const staff = requireCaseManager_();
  payload = payload || {};
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!rows.length) throw new Error('Paste at least one goal or phase row.');
  if (rows.length > 500) throw new Error('Preview no more than 500 phase rows at a time.');
  const students = indexBy_(activeRows_('Students'), 'Id');
  const subjects = indexBy_(activeRows_('Subjects'), 'Id');
  const errors = [];
  const groups = {};
  rows.forEach((row, index) => {
    try {
      row = row || {};
      const key = sanitizeText_(row.goalKey, 100);
      if (!key) throw new Error('GoalKey is required.');
      if (!row.studentId || !students[String(row.studentId)]) {
        throw new Error('StudentId must exactly match an active student.');
      }
      requireManagedStudent_(staff, row.studentId);
      if (!sanitizeText_(row.goal, 4000)) throw new Error('Goal description is required.');
      const subjectIds = String(row.subjectIds || '').split(/[;,]/)
        .map(item => item.trim())
        .filter(Boolean);
      if (!subjectIds.length || subjectIds.some(id => !subjects[id])) {
        throw new Error('SubjectIds must exactly match active subject IDs.');
      }
      if (!groups[key]) {
        groups[key] = {
          goalKey: key,
          studentId: String(row.studentId),
          goal: sanitizeText_(row.goal, 4000),
          domain: sanitizeText_(row.domain, 100),
          status: row.status || '',
          startDate: row.startDate || '',
          dueDate: row.dueDate || '',
          subjectIds: subjectIds,
          phases: []
        };
      } else {
        const group = groups[key];
        const sameSubjects = group.subjectIds.slice().sort().join('|') ===
          subjectIds.slice().sort().join('|');
        if (group.studentId !== String(row.studentId) ||
            group.goal !== sanitizeText_(row.goal, 4000) ||
            group.domain !== sanitizeText_(row.domain, 100) ||
            String(group.status || '') !== String(row.status || '') ||
            String(group.startDate || '') !== String(row.startDate || '') ||
            String(group.dueDate || '') !== String(row.dueDate || '') ||
            !sameSubjects) {
          throw new Error(
            'Rows sharing a GoalKey must use identical goal, student, subject, status, and date fields.'
          );
        }
      }
      if (row.taskDemandDescription || row.phaseOrder || row.targetAccuracyPct ||
          row.targetPromptLevel || row.targetPromptCount || row.targetConsecutiveSessions) {
        groups[key].phases.push(normalizeGoalPhase_({
          orderIndex: row.phaseOrder,
          taskDemandDescription: row.taskDemandDescription,
          targetAccuracyPct: row.targetAccuracyPct,
          targetPromptLevel: row.targetPromptLevel,
          targetPromptCount: row.targetPromptCount,
          targetConsecutiveSessions: row.targetConsecutiveSessions,
          active: toBoolean_(row.active)
        }, groups[key].phases.length, row.startDate, row.dueDate));
      }
    } catch (error) {
      errors.push({ row: index + 1, message: error.message });
    }
  });
  const goals = Object.keys(groups).map(key => groups[key]);
  goals.forEach(goal => {
    const orders = goal.phases.map(phase => phase.orderIndex);
    if (orders.some(order => order <= 0) || new Set(orders).size !== orders.length) {
      errors.push({
        row: 0,
        message: goal.goalKey + ' must use unique positive PhaseOrder values.'
      });
    }
    goal.phases.sort((a, b) => a.orderIndex - b.orderIndex);
  });
  if (goals.length > 50) errors.push({ row: 0, message: 'Import no more than 50 goals at a time.' });
  return {
    ok: !errors.length,
    goals: goals,
    errors: errors,
    goalCount: goals.length,
    phaseCount: goals.reduce((total, goal) => total + goal.phases.length, 0)
  };
}

function saveBulkGoals(payload) {
  payload = payload || {};
  const preview = previewBulkGoals(payload);
  if (!preview.ok) return preview;
  const importBatchId = sanitizeText_(payload.importBatchId, 100);
  if (!importBatchId) {
    return {
      ok: false,
      code: 'IMPORT_BATCH_REQUIRED',
      message: 'Preview the import again to create a retry-safe import batch.'
    };
  }
  const results = [];
  for (let index = 0; index < preview.goals.length; index += 1) {
    const goal = preview.goals[index];
    const result = createGoal(Object.assign({}, goal, {
      importBatchId: importBatchId,
      importGoalKey: goal.goalKey
    }));
    if (!result.ok) {
      return {
        ok: false,
        code: result.code || 'IMPORT_FAILED',
        completed: results.length,
        retryable: result.retryable !== false,
        message: result.message || 'Bulk goal import stopped before all goals were saved.'
      };
    }
    results.push(result);
  }
  return {
    ok: true,
    goalCount: results.length,
    phaseCount: results.reduce((total, item) => total + item.benchmarkCount, 0)
  };
}

function goalImportFingerprint_(goal) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON.stringify(goal)
  ).map(value => ((value + 256) % 256).toString(16).padStart(2, '0')).join('');
}

function normalizeGoalPhase_(phase, index, defaultStartDate, defaultDueDate) {
  phase = phase || {};
  const taskDemand = sanitizeText_(
    phase.taskDemandDescription || phase.text || phase.skill || phase.description,
    5000
  );
  if (!taskDemand) throw new Error('Phase ' + (index + 1) + ' needs a task description.');
  const targetAccuracy = optionalNumber_(phase.targetAccuracyPct);
  if (targetAccuracy !== null && (targetAccuracy < 0 || targetAccuracy > 100)) {
    throw new Error('Phase ' + (index + 1) + ' target accuracy must be from 0 to 100.');
  }
  const targetPromptLevel = normalizePromptLevel_(phase.targetPromptLevel);
  const targetPromptCount = optionalInteger_(phase.targetPromptCount);
  if (targetPromptCount !== null && targetPromptCount < 0) {
    throw new Error('Phase ' + (index + 1) + ' prompt count cannot be negative.');
  }
  const consecutive = optionalInteger_(phase.targetConsecutiveSessions);
  if (consecutive !== null && consecutive <= 0) {
    throw new Error('Phase ' + (index + 1) + ' consecutive sessions must be positive.');
  }
  const targetCorrect = optionalNumber_(phase.targetCorrect);
  const targetAttempts = optionalNumber_(phase.targetAttempts);
  if ((targetCorrect === null) !== (targetAttempts === null) ||
      (targetAttempts !== null &&
        (targetCorrect < 0 || targetAttempts <= 0 || targetCorrect > targetAttempts))) {
    throw new Error('Phase ' + (index + 1) + ' correctness ratio is invalid.');
  }
  const requiredTrials = optionalNumber_(phase.requiredTrials);
  const totalTrials = optionalNumber_(phase.totalTrials);
  if ((requiredTrials === null) !== (totalTrials === null) ||
      (totalTrials !== null &&
        (requiredTrials <= 0 || totalTrials <= 0 || requiredTrials > totalTrials))) {
    throw new Error('Phase ' + (index + 1) + ' legacy trial ratio is invalid.');
  }
  return {
    orderIndex: optionalInteger_(phase.orderIndex) || index + 1,
    text: sanitizeText_(phase.text || taskDemand, 5000),
    taskDemandDescription: taskDemand,
    targetCorrect: targetCorrect === null ? '' : targetCorrect,
    targetAttempts: targetAttempts === null ? '' : targetAttempts,
    requiredTrials: requiredTrials === null ? '' : requiredTrials,
    totalTrials: totalTrials === null ? '' : totalTrials,
    targetAccuracyPct: targetAccuracy === null ? '' : targetAccuracy,
    targetPromptLevel: targetPromptLevel,
    targetPromptCount: targetPromptCount === null ? '' : targetPromptCount,
    targetConsecutiveSessions: consecutive === null ? '' : consecutive,
    startDate: phase.startDate || defaultStartDate || '',
    dueDate: phase.dueDate || defaultDueDate || '',
    active: toBoolean_(phase.active)
  };
}

function normalizeGoalStatus_(value, phaseCount) {
  let status = String(value || (phaseCount ? 'ACTIVE' : 'DRAFT')).toUpperCase();
  if (!['DRAFT', 'ACTIVE', 'COMPLETED', 'INACTIVE'].includes(status)) {
    throw new Error('Goal status is invalid.');
  }
  if (!phaseCount && status === 'ACTIVE') status = 'DRAFT';
  return status;
}

function goalStatus_(row) {
  return String(row.Status || (toBoolean_(row.Active) ? 'ACTIVE' : 'INACTIVE')).toUpperCase();
}

function isActiveGoal_(row) {
  return goalStatus_(row) === 'ACTIVE' && toBoolean_(row.Active);
}

function normalizePromptLevel_(value) {
  if (!value) return '';
  const matched = VOICES.PROMPT_LEVELS.find(level =>
    level.toLowerCase() === String(value).trim().toLowerCase()
  );
  if (!matched) throw new Error('Prompt level is invalid.');
  return matched;
}

function optionalInteger_(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    throw new Error('Use a whole number for prompt counts, phase order, and session targets.');
  }
  return number;
}

function rollbackGoalCreation_(goalId, benchmarkIds) {
  const ids = new Set(benchmarkIds.map(String));
  rows_('GoalPhaseHistory')
    .filter(row => String(row.GoalId) === String(goalId))
    .sort((a, b) => b._row - a._row)
    .forEach(row => deleteRow_('GoalPhaseHistory', row._row));
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
  const goals = rows_('Goals')
    .filter(row => ['ACTIVE', 'DRAFT', 'COMPLETED'].includes(goalStatus_(row)))
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

function getStudentGoalWorkspace(studentId, options) {
  return withRowsCache_(() => {
    options = options || {};
    const staff = requireCaseManager_();
    const student = requireManagedStudent_(staff, studentId);
    const goals = rows_('Goals')
      .filter(isActiveGoal_)
      .filter(row => String(row.StudentId) === String(student.Id));
    const goalIds = new Set(goals.map(row => String(row.Id)));
    const benchmarks = rows_('Benchmarks')
      .filter(row => goalIds.has(String(row.GoalId)));
    const benchmarkIds = new Set(benchmarks.map(row => String(row.Id)));
    const entries = rows_('BenchmarkEntries')
      .filter(row => benchmarkIds.has(String(row.BenchmarkId)))
      .filter(row => String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE')
      .filter(row => !options.startDate ||
        formatDate_(row.ObservationDate || row.Timestamp) >= options.startDate
      )
      .filter(row => !options.endDate ||
        formatDate_(row.ObservationDate || row.Timestamp) <= options.endDate
      )
      .sort(compareObservationEntries_);
    const benchmarkIndex = indexBy_(benchmarks, 'Id');
    const history = rows_('GoalPhaseHistory')
      .filter(row => goalIds.has(String(row.GoalId)));
    const entryLimit = Math.min(Math.max(toNumber_(options.entryLimit, 500), 50), 2000);
    return {
      student: publicStudent_(student),
      goals: goals.map(goal => {
        const goalBenchmarks = benchmarks
          .filter(row => String(row.GoalId) === String(goal.Id))
          .sort((a, b) =>
            (optionalInteger_(a.OrderIndex) || a._row) -
            (optionalInteger_(b.OrderIndex) || b._row)
          );
        const ids = new Set(goalBenchmarks.map(row => String(row.Id)));
        const goalEntries = entries.filter(row => ids.has(String(row.BenchmarkId)));
        const displayedEntries = goalEntries.slice(-entryLimit);
        const phaseHistory = history
          .filter(row => String(row.GoalId) === String(goal.Id))
          .sort((a, b) =>
            String(a.ActivatedAt).localeCompare(String(b.ActivatedAt)) ||
            String(a.Id).localeCompare(String(b.Id))
          );
        return Object.assign({}, publicGoal_(goal, student, goalBenchmarks), {
          benchmarks: goalBenchmarks.map(row => publicBenchmark_(
            row,
            student,
            null,
            goalEntries.filter(entry => String(entry.BenchmarkId) === String(row.Id)).length,
            goalEntries.filter(entry => String(entry.BenchmarkId) === String(row.Id))
          )),
          metrics: summarizeGoalEntries_(goalEntries, goalBenchmarks),
          phaseHistory: phaseHistory.map(row => ({
            id: row.Id,
            benchmarkId: row.BenchmarkId,
            activatedAt: formatDate_(row.ActivatedAt),
            endedAt: formatDate_(row.EndedAt),
            changedBy: row.ChangedBy,
            changeReason: row.ChangeReason,
            orderIndex: benchmarkIndex[row.BenchmarkId]
              ? optionalInteger_(benchmarkIndex[row.BenchmarkId].OrderIndex) || 1
              : 1
          })),
          progressStatements: buildGoalProgressStatements_(
            student,
            goalEntries,
            benchmarkIndex
          ),
          totalEntryCount: goalEntries.length,
          hasMoreEntries: goalEntries.length > displayedEntries.length,
          points: displayedEntries.map(row => ({
            timestamp: row.Timestamp,
            observationDate: formatDate_(row.ObservationDate || row.Timestamp),
            percent: toNumber_(row.Percent),
            correct: toNumber_(row.Correct),
            attempts: toNumber_(row.Attempts),
            actualPromptLevel: row.ActualPromptLevel || '',
            actualPromptCount: optionalInteger_(row.ActualPromptCount),
            staffEmail: row.StaffEmail,
            classId: row.ClassId,
            notes: row.Notes,
            benchmarkId: row.BenchmarkId,
            phaseOrder: benchmarkIndex[row.BenchmarkId]
              ? optionalInteger_(benchmarkIndex[row.BenchmarkId].OrderIndex) || 1
              : 1,
            benchmark: benchmarkIndex[row.BenchmarkId]
              ? benchmarkIndex[row.BenchmarkId].TaskDemandDescription ||
                benchmarkIndex[row.BenchmarkId].Skill
              : ''
          }))
        });
      })
    };
  });
}

function summarizeGoalEntries_(entries, benchmarks) {
  if (!entries.length) {
    return {
      entryCount: 0,
      latestPercent: null,
      averagePercent: null,
      trend: null,
      currentPhaseId: '',
      currentPhase: '',
      currentPhaseLastThreeAccuracy: null,
      currentPhaseTrialCount: 0,
      highestIndependence: null
    };
  }
  const values = entries.map(row => toNumber_(row.Percent));
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;
  const current = (benchmarks || []).find(row => toBoolean_(row.Active));
  const currentEntries = current
    ? entries.filter(row => String(row.BenchmarkId) === String(current.Id))
    : [];
  const lastThree = currentEntries.slice(-3);
  const lastThreeTrials = lastThree.reduce((sum, row) => sum + toNumber_(row.Attempts), 0);
  const lastThreeSuccesses = lastThree.reduce((sum, row) => sum + toNumber_(row.Correct), 0);
  const benchmarkIndex = (benchmarks || []).reduce((map, benchmark) => {
    map[benchmark.Id] = benchmark;
    return map;
  }, {});
  const qualifyingIndependence = entries
    .filter(row => {
      const benchmark = benchmarkIndex[row.BenchmarkId];
      const targetAccuracy = benchmark
        ? optionalNumber_(benchmark.TargetAccuracyPct)
        : null;
      return targetAccuracy !== null &&
        toNumber_(row.Percent) >= targetAccuracy &&
        row.ActualPromptLevel &&
        optionalInteger_(row.ActualPromptCount) !== null;
    })
    .sort((a, b) =>
      promptLevelRank_(a.ActualPromptLevel) - promptLevelRank_(b.ActualPromptLevel) ||
      optionalInteger_(a.ActualPromptCount) - optionalInteger_(b.ActualPromptCount)
    )[0];
  return {
    entryCount: values.length,
    latestPercent: latest,
    averagePercent: Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length * 10
    ) / 10,
    trend: previous === null ? null : Math.round((latest - previous) * 10) / 10,
    currentPhaseId: current ? current.Id : '',
    currentPhase: current
      ? current.TaskDemandDescription || current.Skill || current.Description
      : '',
    currentPhaseLastThreeAccuracy: lastThreeTrials
      ? Math.round(lastThreeSuccesses / lastThreeTrials * 1000) / 10
      : null,
    currentPhaseTrialCount: currentEntries.reduce(
      (sum, row) => sum + toNumber_(row.Attempts),
      0
    ),
    highestIndependence: qualifyingIndependence ? {
      promptLevel: qualifyingIndependence.ActualPromptLevel,
      promptCount: optionalInteger_(qualifyingIndependence.ActualPromptCount),
      accuracy: toNumber_(qualifyingIndependence.Percent)
    } : null
  };
}

function buildGoalProgressStatements_(student, entries, benchmarkIndex) {
  const groups = entries.reduce((map, entry) => {
    const benchmark = benchmarkIndex[entry.BenchmarkId];
    if (!benchmark) return map;
    const promptLevel = entry.ActualPromptLevel || 'Not recorded';
    const promptCount = optionalInteger_(entry.ActualPromptCount);
    const key = [
      entry.BenchmarkId,
      promptLevel,
      promptCount === null ? '' : promptCount
    ].join('|');
    if (!map[key]) {
      map[key] = {
        benchmark: benchmark,
        promptLevel: promptLevel,
        promptCount: promptCount,
        entries: []
      };
    }
    map[key].entries.push(entry);
    return map;
  }, {});
  return Object.keys(groups).map(key => {
    const group = groups[key];
    const ordered = group.entries.slice().sort(compareObservationEntries_);
    const trials = ordered.reduce((sum, row) => sum + toNumber_(row.Attempts), 0);
    const successes = ordered.reduce((sum, row) => sum + toNumber_(row.Correct), 0);
    const accuracy = trials ? Math.round(successes / trials * 1000) / 10 : 0;
    const promptText = group.promptLevel === 'Not recorded'
      ? 'prompt conditions were not recorded'
      : group.promptLevel + (
        group.promptCount === null
          ? ''
          : ' (' + group.promptCount + ' prompt' + (group.promptCount === 1 ? '' : 's') + ')'
      ) + ' conditions';
    return {
      benchmarkId: group.benchmark.Id,
      trials: trials,
      successes: successes,
      accuracy: accuracy,
      startDate: formatDate_(ordered[0].ObservationDate || ordered[0].Timestamp),
      endDate: formatDate_(
        ordered[ordered.length - 1].ObservationDate ||
        ordered[ordered.length - 1].Timestamp
      ),
      promptLevel: group.promptLevel,
      promptCount: group.promptCount,
      statement: 'Across ' + trials + ' trials between ' +
        formatDate_(ordered[0].ObservationDate || ordered[0].Timestamp) + ' and ' +
        formatDate_(
          ordered[ordered.length - 1].ObservationDate ||
          ordered[ordered.length - 1].Timestamp
        ) + ', ' + student.Name + ' demonstrated ' +
        (group.benchmark.TaskDemandDescription || group.benchmark.Skill) +
        ' at ' + accuracy + '% accuracy under ' + promptText + '.'
    };
  });
}

function getGoalProgressReport(payload) {
  payload = payload || {};
  assertRequired_(payload, ['studentId']);
  const workspace = getStudentGoalWorkspace(payload.studentId, {
    entryLimit: payload.entryLimit || 2000,
    startDate: payload.startDate || '',
    endDate: payload.endDate || ''
  });
  return {
    generatedAt: new Date(),
    dateRange: {
      startDate: payload.startDate || '',
      endDate: payload.endDate || ''
    },
    student: workspace.student,
    goals: workspace.goals
  };
}

function setActiveGoalBenchmark(payload) {
  return withRowsCache_(() => {
    const staff = requireCaseManager_();
    payload = payload || {};
    assertRequired_(payload, ['goalId', 'benchmarkId']);
    const goal = findOne_('Goals', row =>
      String(row.Id) === String(payload.goalId) && isActiveGoal_(row)
    );
    if (!goal) throw new Error('Goal was not found.');
    requireManagedStudent_(staff, goal.StudentId);
    const benchmarks = rows_('Benchmarks')
      .filter(row => String(row.GoalId) === String(goal.Id));
    const selected = benchmarks.find(row =>
      String(row.Id) === String(payload.benchmarkId)
    );
    if (!selected) throw new Error('Benchmark was not found in this goal.');
    const activationDate = formatDate_(payload.activationDate || new Date());
    if (!activationDate || activationDate > formatDate_(new Date())) {
      throw new Error('Phase activation date must be today or earlier.');
    }
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(25000)) {
      return { ok: false, code: 'WRITE_BUSY', retryable: true };
    }
    try {
      invalidateRowsCache_('Benchmarks');
      invalidateRowsCache_('GoalPhaseHistory');
      const currentBenchmarks = rows_('Benchmarks')
        .filter(row => String(row.GoalId) === String(goal.Id));
      const selectedCurrent = currentBenchmarks.find(row =>
        String(row.Id) === String(selected.Id)
      );
      if (!selectedCurrent) throw new Error('The selected phase is no longer available.');
      const current = currentBenchmarks.find(row => toBoolean_(row.Active));
      if (current && String(current.Id) === String(selectedCurrent.Id)) {
        return {
          ok: true,
          goalId: goal.Id,
          benchmarkId: selectedCurrent.Id,
          activationDate: activationDate
        };
      }
      if (current &&
          (optionalInteger_(selectedCurrent.OrderIndex) || selectedCurrent._row) <=
          (optionalInteger_(current.OrderIndex) || current._row)) {
        throw new Error('Activate a later phase in the goal progression order.');
      }
      const openHistory = rows_('GoalPhaseHistory')
        .filter(row =>
          String(row.GoalId) === String(goal.Id) &&
          !row.EndedAt
        );
      if (openHistory.some(row => formatDate_(row.ActivatedAt) > activationDate)) {
        throw new Error('Phase activation cannot precede the current phase.');
      }
      currentBenchmarks.forEach(row => updateRow_('Benchmarks', row._row, {
        Active: String(row.Id) === String(selectedCurrent.Id)
      }));
      openHistory.forEach(row => updateRow_('GoalPhaseHistory', row._row, {
        EndedAt: activationDate,
        EndedBy: staff.Email,
        EndReason: 'Later phase activated'
      }));
      appendRow_('GoalPhaseHistory', {
        Id: uuid_(),
        GoalId: goal.Id,
        BenchmarkId: selectedCurrent.Id,
        ActivatedAt: activationDate,
        EndedAt: '',
        ChangedBy: staff.Email,
        ChangeReason: sanitizeText_(payload.reason || 'Phase activated', 500),
        Source: 'APPLICATION'
      });
      updateRow_('Goals', goal._row, {
        UpdatedAt: new Date(),
        Status: 'ACTIVE',
        Active: true
      });
      return {
        ok: true,
        goalId: goal.Id,
        benchmarkId: selectedCurrent.Id,
        activationDate: activationDate
      };
    } finally {
      lock.releaseLock();
    }
  });
}

function activateGoalPhase(payload) {
  return setActiveGoalBenchmark(payload);
}

function getGoalPhaseHistory_(goalId) {
  return rows_('GoalPhaseHistory')
    .filter(row => String(row.GoalId) === String(goalId))
    .sort((a, b) =>
      String(a.ActivatedAt).localeCompare(String(b.ActivatedAt)) ||
      String(a.Id).localeCompare(String(b.Id))
    );
}

function getPhaseForObservationDate_(goalId, observationDate) {
  const date = formatDate_(observationDate);
  return getGoalPhaseHistory_(goalId)
    .filter(row => formatDate_(row.ActivatedAt) <= date)
    .filter(row =>
      !row.EndedAt ||
      date < formatDate_(row.EndedAt) ||
      (String(row.EndReason || '') === 'Goal deactivated' &&
        date === formatDate_(row.EndedAt))
    )
    .sort((a, b) =>
      String(b.ActivatedAt).localeCompare(String(a.ActivatedAt)) ||
      String(b.Id).localeCompare(String(a.Id))
    )[0] || null;
}

function promptLevelRank_(value) {
  return VOICES.PROMPT_LEVELS.indexOf(normalizePromptLevel_(value));
}

function entryMeetsBenchmarkTarget_(entry, benchmark) {
  const targetAccuracy = optionalNumber_(benchmark.TargetAccuracyPct);
  const targetPromptLevel = normalizePromptLevel_(benchmark.TargetPromptLevel);
  const targetPromptCount = optionalInteger_(benchmark.TargetPromptCount);
  const actualPromptLevel = normalizePromptLevel_(entry.ActualPromptLevel);
  const actualPromptCount = optionalInteger_(entry.ActualPromptCount);
  if (targetAccuracy === null || !targetPromptLevel || targetPromptCount === null ||
      !actualPromptLevel || actualPromptCount === null) {
    return null;
  }
  return toNumber_(entry.Percent) >= targetAccuracy &&
    promptLevelRank_(actualPromptLevel) <= promptLevelRank_(targetPromptLevel) &&
    actualPromptCount <= targetPromptCount;
}

function summarizeBenchmarkMastery_(benchmark, entries) {
  const required = optionalInteger_(benchmark.TargetConsecutiveSessions);
  const targetConfigured = optionalNumber_(benchmark.TargetAccuracyPct) !== null &&
    Boolean(normalizePromptLevel_(benchmark.TargetPromptLevel)) &&
    optionalInteger_(benchmark.TargetPromptCount) !== null &&
    required !== null;
  if (!targetConfigured) {
    return {
      available: false,
      requiredConsecutiveSessions: required,
      consecutiveSessionsMet: 0,
      mastered: false
    };
  }
  const datedResults = entries
    .filter(row => String(row.Status || 'ACTIVE').toUpperCase() === 'ACTIVE')
    .sort(compareObservationEntries_)
    .reduce((map, row) => {
      const date = formatDate_(row.ObservationDate || row.Timestamp);
      if (!date) return map;
      if (!map[date]) map[date] = [];
      map[date].push(entryMeetsBenchmarkTarget_(row, benchmark));
      return map;
    }, {});
  const results = Object.keys(datedResults).sort().map(date => {
    const observations = datedResults[date];
    if (!observations.some(result => result !== null)) return null;
    return observations.every(result => result === true);
  });
  let consecutive = 0;
  for (let index = results.length - 1; index >= 0 && results[index] === true; index -= 1) {
    consecutive += 1;
  }
  return {
    available: true,
    requiredConsecutiveSessions: required,
    consecutiveSessionsMet: consecutive,
    mastered: consecutive >= required,
    recordedSessions: results.filter(result => result !== null).length
  };
}

function compareObservationEntries_(a, b) {
  return String(a.ObservationDate || formatDate_(a.Timestamp))
    .localeCompare(String(b.ObservationDate || formatDate_(b.Timestamp))) ||
    String(a.Timestamp).localeCompare(String(b.Timestamp)) ||
    String(a.Id).localeCompare(String(b.Id));
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
    const deactivationDate = formatDate_(new Date());
    updateRow_('Goals', goal._row, {
      Active: false,
      Status: 'INACTIVE',
      UpdatedAt: new Date()
    });
    rows_('Benchmarks')
      .filter(row => String(row.GoalId) === String(goal.Id))
      .forEach(row => updateRow_('Benchmarks', row._row, { Active: false }));
    rows_('GoalPhaseHistory')
      .filter(row =>
        String(row.GoalId) === String(goal.Id) &&
        !row.EndedAt
      )
      .forEach(row => updateRow_('GoalPhaseHistory', row._row, {
        EndedAt: deactivationDate,
        EndedBy: staff.Email,
        EndReason: 'Goal deactivated'
      }));
    return { ok: true, deactivatedAt: deactivationDate };
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
            observationDate: formatDate_(row.ObservationDate || row.Timestamp),
            correct: toNumber_(row.Correct),
            attempts: toNumber_(row.Attempts),
            percent: toNumber_(row.Percent),
            actualPromptLevel: row.ActualPromptLevel || '',
            actualPromptCount: optionalInteger_(row.ActualPromptCount),
            notes: row.Notes,
            staffEmail: row.StaffEmail,
            staffName: enteredBy ? enteredBy.displayName : row.StaffEmail,
            status: row.Status || 'ACTIVE',
            correctionOfEntryId: row.CorrectionOfEntryId || '',
            correctionReason: row.CorrectionReason || '',
            correctedBy: row.CorrectedBy || '',
            correctedAt: row.CorrectedAt || ''
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
    domain: row.Domain || '',
    status: goalStatus_(row),
    startDate: formatDate_(row.StartDate),
    dueDate: formatDate_(row.DueDate),
    active: isActiveGoal_(row),
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
