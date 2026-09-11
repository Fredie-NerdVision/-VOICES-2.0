function getIepsForCurrentCaseManager() {
  const staff = requireCaseManager_();
  return getIepsForCurrentCaseManager_(staff);
}

function getIepsForCurrentCaseManager_(staff) {
  const email = normalizeEmail_(staff.Email);
  const students = indexBy_(activeRows_('Students'), 'Id');
  return rows_('IEPs')
    .filter(row => toBoolean_(staff.IsAdmin) || normalizeEmail_(row.CaseManagerEmail) === email)
    .sort((a, b) => String(b.EndDate).localeCompare(String(a.EndDate)))
    .map(row => ({
      id: row.Id,
      studentId: row.StudentId,
      studentName: students[row.StudentId] ? students[row.StudentId].Name : '',
      caseManagerEmail: row.CaseManagerEmail,
      startDate: formatDate_(row.StartDate),
      endDate: formatDate_(row.EndDate),
      status: row.Status,
      fileUrl: row.FileUrl
    }));
}

function generateIep(payload) {
  const staff = requireCaseManager_();
  payload = payload || {};
  assertRequired_(payload, ['studentId', 'startDate', 'endDate']);
  const student = findOne_('Students', row => String(row.Id) === String(payload.studentId) && toBoolean_(row.Active));
  if (!student) throw new Error('Student was not found.');
  if (!toBoolean_(staff.IsAdmin) &&
      normalizeEmail_(student.CaseManagerEmail) !== normalizeEmail_(staff.Email)) {
    throw new Error('You can only generate IEPs for your assigned students.');
  }
  if (parseDate_(payload.endDate) < parseDate_(payload.startDate)) {
    throw new Error('IEP end date must be on or after the start date.');
  }

  const goals = rows_('Goals')
    .filter(isActiveGoal_)
    .filter(row => String(row.StudentId) === String(student.Id));
  const goalIds = new Set(goals.map(row => String(row.Id)));
  const benchmarks = rows_('Benchmarks')
    .filter(row => goalIds.has(String(row.GoalId)));
  const subjects = indexBy_(activeRows_('Subjects'), 'Id');
  const progress = getStudentGoalWorkspace(student.Id, {
    entryLimit: 2000,
    startDate: payload.startDate,
    endDate: payload.endDate
  });
  const progressByGoal = indexBy_(progress.goals || [], 'id');
  const title = 'IEP - ' + student.Name + ' - ' + payload.startDate;
  const document = DocumentApp.create(title);
  const body = document.getBody();
  body.appendParagraph('V.O.I.C.E.S 2.0').setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph('Individual Education Plan').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Student: ' + student.Name);
  body.appendParagraph('Case manager: ' + student.CaseManagerEmail);
  body.appendParagraph('Plan dates: ' + payload.startDate + ' through ' + payload.endDate);
  body.appendHorizontalRule();
  body.appendParagraph('Annual goals and benchmarks')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  if (!goals.length) {
    body.appendParagraph('No active annual goals were assigned when this document was generated.');
  } else {
    goals.forEach(goal => {
      body.appendParagraph(String(goal.Goal || 'Goal description not recorded'))
        .setHeading(DocumentApp.ParagraphHeading.HEADING3);
      benchmarks
        .filter(benchmark => String(benchmark.GoalId) === String(goal.Id))
        .forEach(benchmark => {
          const subjectNames = getBenchmarkSubjectIds_(benchmark.Id)
            .map(id => subjects[id] ? subjects[id].Name : '')
            .filter(Boolean);
          body.appendParagraph(
            String(benchmark.Category || 'Benchmark') +
            (subjectNames.length ? ' — ' + subjectNames.join(', ') : '')
          ).setHeading(DocumentApp.ParagraphHeading.HEADING4);
          body.appendParagraph(String(
            benchmark.TaskDemandDescription || benchmark.Skill || benchmark.Description ||
            'Task demand not recorded'
          ));
          const conditions = [];
          if (benchmark.TargetAccuracyPct !== '' && benchmark.TargetAccuracyPct != null) {
            conditions.push('target accuracy ' + benchmark.TargetAccuracyPct + '%');
          } else if (benchmark.TargetCorrect !== '' && benchmark.TargetCorrect != null &&
              benchmark.TargetAttempts !== '' && benchmark.TargetAttempts != null) {
            conditions.push(
              'target accuracy ' + benchmark.TargetCorrect + '/' + benchmark.TargetAttempts
            );
          }
          if (benchmark.TargetPromptLevel) {
            const promptCeiling = benchmark.TargetPromptCeiling === '' ||
                benchmark.TargetPromptCeiling == null
              ? benchmark.TargetPromptCount
              : benchmark.TargetPromptCeiling;
            conditions.push(
              'prompt target ' + benchmark.TargetPromptLevel +
              (promptCeiling === '' || promptCeiling == null
                ? ''
                : ' (' + promptCeiling + ')')
            );
          }
          const consistencyPassed = benchmark.ConsistencyTrialsPassed === '' ||
              benchmark.ConsistencyTrialsPassed == null
            ? benchmark.RequiredTrials
            : benchmark.ConsistencyTrialsPassed;
          const consistencyWindow = benchmark.ConsistencyTrialsWindow === '' ||
              benchmark.ConsistencyTrialsWindow == null
            ? benchmark.TotalTrials
            : benchmark.ConsistencyTrialsWindow;
          if (consistencyPassed !== '' && consistencyPassed != null &&
              consistencyWindow !== '' && consistencyWindow != null) {
            conditions.push(
              consistencyPassed + ' of ' + consistencyWindow + ' consistency window'
            );
          }
          if (benchmark.TargetConsecutiveSessions !== '' &&
              benchmark.TargetConsecutiveSessions != null) {
            conditions.push(
              benchmark.TargetConsecutiveSessions + ' consecutive qualifying sessions'
            );
          }
          body.appendParagraph(
            conditions.length ? 'Conditions: ' + conditions.join('; ') + '.' :
              'Conditions: mastery targets not fully recorded.'
          );
        });
      const goalProgress = progressByGoal[String(goal.Id)];
      const statements = goalProgress && Array.isArray(goalProgress.progressStatements)
        ? goalProgress.progressStatements
        : [];
      statements.forEach(statement => body.appendParagraph(
        String(statement.statement || '')
      ));
    });
  }
  body.appendHorizontalRule();
  body.appendParagraph('Generated by ' + VOICES.APP_NAME + ' on ' + formatDate_(new Date()) + '.')
    .setForegroundColor('#666666');
  document.saveAndClose();

  const file = DriveApp.getFileById(document.getId());
  const viewers = activeRows_('Staff')
    .filter(row =>
      toBoolean_(row.IsAdmin) ||
      normalizeEmail_(row.Email) === normalizeEmail_(student.CaseManagerEmail)
    )
    .map(row => normalizeEmail_(row.Email))
    .filter(email => email && email !== normalizeEmail_(staff.Email));
  if (viewers.length) file.addViewers(viewers);
  const folder = getOrCreateIepFolder_();
  file.moveTo(folder);

  const record = {
    Id: uuid_(),
    StudentId: student.Id,
    CaseManagerEmail: student.CaseManagerEmail,
    StartDate: payload.startDate,
    EndDate: payload.endDate,
    Status: sanitizeText_(payload.status || 'ACTIVE', 50),
    FileUrl: document.getUrl()
  };
  appendRow_('IEPs', record);
  invalidateAppDataCache_('general');
  return { ok: true, id: record.Id, fileUrl: record.FileUrl };
}

function getOrCreateIepFolder_() {
  const parent = getOrCreateAppFolder_();
  const folders = parent.getFoldersByName('IEPs');
  return folders.hasNext() ? folders.next() : parent.createFolder('IEPs');
}
