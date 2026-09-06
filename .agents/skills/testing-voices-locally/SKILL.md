---
name: testing-voices-locally
description: How to run and adversarially test the V.O.I.C.E.S Google Apps Script app end-to-end on a local machine without touching Google Sheets, Drive, or deployments.
---

# Testing V.O.I.C.E.S locally (no Google resources)

This repo is a Google Apps Script web app (`.gs` server files + a single `Index.html` client that
talks to the server only through a `server()` → `google.script.run` wrapper). There is no in-repo
dev server, so end-to-end UI testing requires a local Apps Script emulator. Never test against
production/training Sheets or `clasp push`/deploy.

## Local harness (build once, reuse)

A working harness lives at `/home/ubuntu/harness/` (not committed):

- `emulator.js` — in-memory stubs for `SpreadsheetApp`, `Session`, `PropertiesService`,
  `LockService`, `CacheService`, `Utilities`, plus `DriveApp`/`MailApp` no-ops. It loads every `.gs`
  file into one shared global scope (Apps Script semantics), calls `setupVoicesDemoDatabase()`,
  points `VOICES_DATABASE_ID` at the in-memory spreadsheet, then runs any `upgradeVoices2X...()`
  migration for the branch under test.
- `server.js` — serves `Index.html` on `http://localhost:8123` and exposes:
  - `POST /call` with body `{"fn":"<globalFunctionName>","args":[...],"user":"<email>"}`
    (field is `fn`, not `functionName`). Private `foo_` helpers are callable too, which is the only
    way to reach code paths with no UI entry point (e.g. `isAideAvailableForPeriod_`, `appendRow_`).
  - `POST /admin/lock` with `{"busy":true|false}` or `{"busyAfter":N}` to force `WRITE_BUSY`
    on the Nth lock acquisition — this is how you test queue retention, mid-batch bulk failures,
    and retry/idempotency without racing.
  - `GET /admin/rows?sheet=<SheetName>` to dump raw rows (verify persistence, batch ids,
    `GoalPhaseHistory` closure attribution, `AideDailyHours`).
  - `?user=<email>` on the app URL to switch the signed-in identity.

Start it with `node /home/ubuntu/harness/server.js > /tmp/harness.log 2>&1 &` and confirm seeding
finished in the log before opening the browser. Restart the process to get a clean DB (state is
purely in memory); confirm cleanliness by grepping `/admin/rows` for your fixture prefix. The server
re-reads `Index.html` on each request, so reload the browser without restarting when testing a client
change against an in-memory fixture you need to preserve.

## Identities and fixtures in the demo DB

- Case manager / admin: `owner@westminster.edu`; aide: `liane@westminster.edu`;
  non-whitelisted: `intruder@westminster.edu` (expect
  `Access denied. Your Google Workspace account is not on the active V.O.I.C.E.S staff whitelist.`).
- In-app "today" is fixed by the seeded demo data (e.g. `2026-09-04`); observation dates in the
  future are rejected, and an objective must have been active on the observation date, so backdated
  fixtures need an explicit goal `startDate` plus an activation on a later date.
- Useful students/classes: `STU-001` Isabel Serrano in `CLASS-001` (Math, P1); `STU-044` has five
  goals with history, which is the best fixture for chart/report tests.
- Aide `david@westminster.edu` is the schedule fixture; part-timers (`yvette`, `caroline`, …) have
  `07:45–11:45` default hours, which is handy for shift-overlap assertions.

## Gotchas worth knowing

- Native `<input type="date">`/`type="time"` fields need locale-formatted typing (`09/04/2026`,
  `12:15`); verify what actually persisted with `/admin/rows?sheet=AideDailyHours` rather than
  trusting the rendered value. Typing slashes/colons can produce malformed values (e.g.
  `09/04/92026`); type compact digits instead (`09042026`, `0820AM`, `0300PM`) and click the first
  segment of the field (a `triple_click` often selects neighbouring text instead), then zoom on the
  field to confirm before saving.
- Saving the schedule builder pops a `Weekly capacity exceeded` confirm listing per-aide hours;
  click `Save anyway` to proceed. A date-specific shift is confirmed persisted when the aide column
  header reads `Shift 08:20–15:00` and cells show `Covered <start>–<end>` for partially overlapped
  periods, while other aides' out-of-range periods read `Outside shift hours (07:45–11:45)`.
- Shrinking an aide's shift while assignments exist is rejected server-side
  (`... cannot be assigned to P1 outside shift hours.`) — clear or Mark-off the cells first.
- Clipboard-driven bulk paste needs `xclip` installed; the X display is `:0`.
- `DocumentApp` is not stubbed, so `generateIep` cannot be exercised locally (it throws
  `DocumentApp is not available in the local harness.`); only the goal-filtering half of IEP
  behaviour can be checked via `getStudentGoalWorkspace`.
- Real Google identity/account-chooser, multi-login guidance, Drive logo/doc generation, and Mail
  notifications are all stubbed and untestable locally — report them as such.
- Client submit handlers in `Index.html` that read `event.currentTarget` *after* an `await` blow up
  with `Cannot read properties of null (reading 'reset')` even though the server write succeeded.
  This bug class has appeared in more than one form (goal form, call-off, time-off) — grep for
  `currentTarget` after `await` and test every dialog form's happy path, not just the failure path.
- Call-off reconciliation may pick candidate aides purely from shift overlap and approved time-off;
  an aide who called off the same day (request status `PENDING` in `TimeOffRequests`) might still be
  assigned coverage. Always re-open the called-off aide's own view after another aide calls off.
- Call-off reconciliation has two outcomes, both of which now persist rows: `Assignments were
  reconciled.` (every 1:1 student rematched) and `Aide marked OFF; unresolved 1:1 coverage was sent
  to case managers.` (the absent aide is still switched to `OFF` and an `UNRESOLVED_1TO1` notification
  is written). In the demo DB most aides hit the unresolved branch (P6/P7 pool is thin), while some
  (e.g. `angelina@westminster.edu`, whose day is P1–P4 only) reconcile cleanly — pick the aide to
  match the branch you want. Older builds aborted the whole day instead, leaving the caller looking
  like she is still working; if you see that, it is a regression. Check
  `/admin/rows?sheet=Notifications` to tell UNRESOLVED apart from a genuine failure, and
  `/admin/rows?sheet=Assignments` for rows noted `Automatically reconciled after call-off`.
- Never trust the UNRESOLVED message's student list on its own. Snapshot
  `/admin/rows?sheet=Assignments` before the call-off, then for each period diff the set of
  `Type=ONE_TO_ONE` `StudentId`s before vs after: the students that disappear are the genuinely
  uncovered ones, and they must equal the ids in the notification / case-manager Action center and
  the `No aide assigned` entries in the Schedule builder's Staffing assistant. A build that reports
  the matcher's unmatched candidate instead of the absent aide's own student will name a child who is
  still covered.
- When a match moves a 1:1 student to another aide, the losing row becomes `Type=STANDARD` with an
  empty `StudentId`; its `Duty` must also be emptied so the aide's card falls back to the class name.
  Watch for stale `One-to-one support for <name>.` duty text with no student named (a past defect) —
  assert zero rows matching `STANDARD` + empty `StudentId` + `/One-to-one/` duty, and confirm in the
  affected aide's own UI (`david@westminster.edu` P1/P2 is the usual case).
- To prove the "never re-assign a called-off aide" fix, pick an aide who is *already* `OFF` as A
  (verify via `/admin/rows?sheet=Assignments`), then call off B and check A's rows/view again;
  corroborate with `/call` on `isAideAvailableForPeriod_` (excluded aides → `false`, an eligible aide
  such as `katie@westminster.edu` → `true`) so the assertion is not vacuous.

- Date-driven benchmarks: after a clean start `Settings.SchoolQuarterBoundaries` is `[]`, so any
  `Override until next quarter` click fails with `An administrator must configure a future
  school-quarter boundary before overriding a benchmark.` — test that refusal first, then configure the
  five dates on **Messages & branding** (admin only) and re-try. Choose boundaries that straddle the
  in-app date so you can prove the override expires at the *next* one (e.g. `2026-08-17, 2026-10-19,
  2027-01-05, 2027-03-15, 2027-08-16` → toast `Benchmark override saved through 2026-10-19.`). An
  already-expired override can only be created through `/call setActiveGoalBenchmark` with a back-dated
  `activationDate` (no UI path).
- Goal archetypes / mastery / annual charts (as of `8c7b372`): the migrated demo DB holds only
  `DISCRETE_TRIAL` (all 1000 entries) and `PROMPT_FADE` (zero entries) benchmarks — there are **no**
  `FREQUENCY_QUOTA`/`TASK_EXPANSION` rows, so those archetypes and the prompt-count / occurrence chart
  panels can only be exercised by creating goals through the Goals-tab `Annual goal` parse/review flow
  and entering observations. Paste blank-line-separated objectives; the review cards expose editable
  archetype, accuracy, prompt level/ceiling, consistency numerator/denominator, consecutive sessions,
  evaluation window, dates and task demand. Useful probes: `... at 80% accuracy across 3 sessions.` →
  DISCRETE_TRIAL/SESSION; `... no more than 2 verbal prompts in 3 of 4 opportunities for 2 consecutive
  sessions.` → PROMPT_FADE with ceiling 2 and consistency 3/4 and **empty** accuracy (a regression would
  store `75`); `... (a, b, and c) at 90% accuracy over 2 data days.` → TASK_EXPANSION/DATA_DAY with the
  parenthetical stored as `TaskDemandDescription`; `... on 4 of 5 school days.` → FREQUENCY_QUOTA/DATA_DAY.
  Only one benchmark per goal is date-active, so create one single-objective goal per archetype you want
  to record observations against. Goal creation fails unless the overall due date is set (it propagates
  per-benchmark due dates).
- Mastery appears as a chip on active and inactive benchmark rows (`Mastered`,
  `<met>/<required> qualifying <unit> windows`, or `Mastery unavailable`). Corroborate it via
  `POST /call {fn:'getStudentGoalWorkspace', args:['STU-001'], user:'guillen@westminster.edu'}` and
  read `benchmark.mastery`
  (`archetype`, `evaluationWindowUnit`, `consistencyTrialsPassed/Window`, `requiredConsecutiveSessions`,
  `consecutiveSessionsMet`, `mastered`, `recordedSessions`, `recordedWindows`). Prompt-fade is judged by
  prompt **count vs ceiling** (accuracy can stay 75% and still master); frequency-quota counts qualifying
  **data days** in a rolling window, so its `recordedWindows` exceeds `recordedSessions`. To exercise
  the unavailable state, clear `Consecutive sessions` in a review card before creating the goal.
- The Overview `Progress over time` card renders three inline `<svg aria-label="... annual goal progress
  chart">` panels (Accuracy with `0/25/50/75/100%` ticks, `Prompt count (lower is better)`, `Recorded
  occurrences / quota progress`, both with integer ticks and no `%`). Fast non-visual check:
  enumerate `document.querySelectorAll('svg[aria-label]')` and dump `text` contents + `circle` counts to
  prove no prompt/occurrence value lands on the percent axis. Legend `Only`/`Show Goal N` toggles add and
  remove whole panels, so a metric with no visible goal disappears entirely. Point tooltips are native
  SVG `<title>` elements — they hold ratio/percent/prompt level/count/benchmark/staff email but are hard
  to capture in a screenshot; read the `<title>` text and report visual tooltip capture as inconclusive.
- Neutral labelling history: **before `4d17e32`** it applied to the benchmark **Category** only
  (`BenchmarkService.gs` rewrites categories matching `^(Phase|Short-Term Objective) \d+$`). In the demo
  DB categories are strand names (`Communication - Requesting`), so that normalization is vacuous, while
  `DemoData.gs` seeds the benchmark *Description* as `Short-Term Objective N: ...`. Result: aide
  Benchmark-lookup cards and goal cards can still visibly read "Short-Term Objective 3" even on builds
  that "removed" the wording. Check labels separately in Goals cards/chart (neutral) and in the aide
  lookup result cards (description text) before claiming the wording is gone.
- The aide lookup's schedule default (`Using your current assignment.` / preselected teacher+period+
  1:1 student) only appears when a **saved assignment exists for the real wall-clock date** and the
  wall-clock time falls inside a period window. Demo assignments exist only for `2026-08-31`…
  `2026-09-04`, so on a weekend or outside 08:00–15:00 the card shows
  `There is no active period right now.` / `No current assignment was found; choose a class manually.`
  and the default cannot be observed. Work around it by testing during a seeded weekday inside school
  hours, or by building/saving a day schedule for today in Schedule builder with a period whose times
  span the current clock (loading a schedule *type* template alone creates only an empty draft and
  persists nothing).
- Admin-only surfaces (`Administrator data`, `School-year quarter boundaries`, `Bulk create`) render on
  Messages & branding only for `owner@westminster.edu`; corroborate the boundary with a non-admin CM
  (`guillen@`) both in the UI and via `/call` (`saveSchoolQuarterBoundaries`,
  `previewAdminCatalogBatch` → `Administrator access is required.`).
- Bulk catalog validation is per-row; a batch with a bad teacher, bad period, unknown subject, duplicate
  subject and a teacher/period collision surfaces all five messages at once and keeps
  `Save previewed records` disabled. Confirm nothing was written by comparing the `Administrator data`
  chips (`8 active subjects` / `25 active classes` in a clean DB) with raw `Subjects`/`Classes` counts.

## Devin Secrets Needed

None — the harness is fully local and requires no credentials.
