# V.O.I.C.E.S 2.3 Project Guide

## 1. Project identity

V.O.I.C.E.S is a school-support application for students with severe handicaps. Its central workflow is filtered lookup and collection of benchmark data, supported by annual-goal management, staffing schedules, aide availability, time-off workflows, 1:1 coverage, progress reporting, and IEP document generation.

The user-facing application name remains:

```text
V.O.I.C.E.S 2.0
```

The current source and database release is:

```text
V.O.I.C.E.S 2.3
```

## 2. Platform boundary

The application operates entirely inside Google Workspace:

- Google Apps Script V8 hosts the application and server functions.
- Google Sheets stores relational application data.
- Google Drive stores logo assets and generated IEP documents.
- Google Docs is used to create IEP documents.
- MailApp sends request and coverage notifications.
- Google Workspace identity supplies the signed-in user's email.
- The active `Staff` table is the application authorization whitelist.
- Vanilla HTML, CSS, and JavaScript provide the browser interface.
- `google.script.run` connects the browser interface to Apps Script functions.

The application does not use Firebase, an external database, a CDN, an external API, or a conventional application server.

## 3. Current resources

### Source project

- Apps Script project ID: `1YQtWgCdN4bYYiyDxAIbQnR-Fd_6nfexXF0_yRBOcB-HQ_4GE1x71yF_U`
- Editor: `https://script.google.com/d/1YQtWgCdN4bYYiyDxAIbQnR-Fd_6nfexXF0_yRBOcB-HQ_4GE1x71yF_U/edit`

### Production

- Database name: `V.O.I.C.E.S 2.2 Database`
- Database ID: `1Po6KwwyYKFbGS2rXdDId8PFdlgHQMhiZcZuvOjXbKC0`
- Database URL: `https://docs.google.com/spreadsheets/d/1Po6KwwyYKFbGS2rXdDId8PFdlgHQMhiZcZuvOjXbKC0/edit`
- Script property: `VOICES_DATABASE_ID`
- Deployment ID: `AKfycbxdJBJ3-W33wfTOlav2jA2kaNIK9RIUQxJXpCuJINsP36ZcrdCh5n4OhmWtafrEN4iOWA`
- Web app: `https://script.google.com/macros/s/AKfycbxdJBJ3-W33wfTOlav2jA2kaNIK9RIUQxJXpCuJINsP36ZcrdCh5n4OhmWtafrEN4iOWA/exec`

### Training

- Database name: `V.O.I.C.E.S 2.2 Training Database`
- Database ID: `1D9-kbV_TBIT518hvcnsN13Y4aegoXiVFV2eivNRH2XQ`
- Database URL: `https://docs.google.com/spreadsheets/d/1D9-kbV_TBIT518hvcnsN13Y4aegoXiVFV2eivNRH2XQ/edit`
- Training property: `VOICES_DEMO_DATABASE_ID`
- Deployment ID: `AKfycbwX3zENE3KdATr-d4v1hYd-JgDFyGP49E7fBNbRurkBqINC8d2x00bhApRdkwWNmR9khQ`
- Web app: `https://script.google.com/macros/s/AKfycbwX3zENE3KdATr-d4v1hYd-JgDFyGP49E7fBNbRurkBqINC8d2x00bhApRdkwWNmR9khQ/exec`

The training deployment is a versioned source snapshot routed to the training property. Editable source must remain routed to `VOICES_DATABASE_ID`.

The listed production and training resources remain on their existing deployed 2.2 snapshots until the 2.3 migration and deployment are separately reviewed and approved.

### Original 2.0 resources

The original 2.0 project, database, and deployment are historical resources and must not be modified:

- Script ID: `1Kypi6xThxWn68j3gJcO43rHi4ttI75hMBOsi28Xxo1BFRuxHXBD4Y1ioB`
- Spreadsheet ID: `1ELZsTRujqywLNYMs_z-u762mE97dDNNVsJisrfIPdRA`
- Deployment ID: `AKfycbwpxCm5vsoLAhmXEw2F7QXVm2xbqEb4ZTkdl32p9x2e1imKp2w_vNxCVnogUDVD-5db`

## 4. Security and authorization

`Session.getActiveUser().getEmail()` identifies the signed-in Workspace account. Access is granted only when the normalized email matches an active row in `Staff`.

Roles are:

- `AIDE`
- `TEACHER`
- `CASE_MANAGER`

Administrative authority is stored independently in `Staff.IsAdmin`. An administrator can have any supported role, although the normal administrative record is a case manager.

Case managers can manage assigned students, goals, schedules, staff requests, messages, and IEPs. Administrators can view all students, assign case managers, and manage administrator access.

Deactivating a staff or student row revokes active access without deleting historical records.

The app should be deployed:

- from the intended owner account;
- with **Execute as: Me**;
- with access limited to the school Workspace domain;
- with the database shared to the deployment owner;
- without publishing the database publicly.

Emails are sent from the deployment owner's account under the display name `V.O.I.C.E.S 2.0`. Request messages identify the signed-in aide by email.

## 5. Source map

| File | Responsibility |
| --- | --- |
| `Code.gs` | Application constants, web entry point, bootstrap response, identity helpers, public staff projection |
| `Database.gs` | Sheet schemas, setup, migration, default data, data access helpers, caching |
| `BenchmarkService.gs` | Assignment-aware lookup, raw-trial entry, idempotent batch writes, correction audit, dashboard support |
| `GoalService.gs` | Flexible goal/phase parsing, phase chronology, mastery, analytics, progress reports |
| `ScheduleService.gs` | Schedule types, date-specific shifts/lunches, revisions, weekly calculations, conflicts, replacement matching, call-offs |
| `TimeService.gs` | Clock in/out, pay-period summaries, time-off and availability submissions |
| `AdminService.gs` | Staff/student CRUD, request review, message management, notifications |
| `IEPService.gs` | Google Docs IEP generation and Drive sharing |
| `DemoData.gs` | Isolated deterministic training database generation and validation |
| `DefaultLogo.gs` | Embedded default Westminster mascot |
| `Index.html` | Role-aware browser interface, client state, RPC calls, charts, dialogs, schedule grid |
| `appsscript.json` | V8 runtime, Workspace scopes, domain web-app configuration |

## 6. Sheet data model

### Identity and roster

- `Staff`: email identity, name, role, admin flag, active flag, weekly capacity.
- `Students`: student name, assigned case manager, 1:1 requirement, active flag.
- `Subjects`: available goal/class subject tags.
- `Classes`: class, subject, teacher email, and period relationship.
- `ClassStudents`: many-to-many class enrollment.
- `ClassAides`: aide assignment to classes.
- `AideTraining`: aide-to-student training relationships used for 1:1 replacement suggestions.

### Goals and data collection

- `Goals`: annual goal, student, domain, status, plan dates, creator, and active state.
- `Benchmarks`: zero or more ordered phases with separate task, accuracy, prompt, and consecutive-session targets.
- `BenchmarkSubjects`: many-to-many subject relevance inherited from the goal.
- `BenchmarkEntries`: raw successes/trials, calculated percentage, observation date, actual prompt condition, notes, class, evaluator, batch ID, and correction audit.
- `GoalPhaseHistory`: auditable activation boundaries used for backdated-entry validation and charts.

### Scheduling

- `ScheduleTypes`: named reusable templates.
- `SchedulePeriods`: period labels and times belonging to a template or saved day.
- `DaySchedules`: a saved date-specific schedule with revision and update attribution.
- `Assignments`: aide, period, class, student, duty, note, and assignment type.
- `AideDailyHours`: date-specific shift start/end and optional fixed 30-minute lunch.

### Requests and records

- `TimeEntries`: aide personal clock-in/out records.
- `TimeOffRequests`: pending, approved, or denied requests.
- `Availability`: Monday-Friday availability submissions and review state.
- `Messages`: date-ranged global messages with creator attribution and active state.
- `Notifications`: persistent operational alerts, including unresolved 1:1 coverage.
- `IEPs`: generated document metadata and Drive URL.
- `Settings`: school/application settings and schedule weekdays.

## 7. Application startup

`doGet()` renders `Index.html`. The browser calls `getAppBootstrap()`, which:

1. reads the signed-in email;
2. requires an active matching staff record;
3. determines the role-aware initial view;
4. returns branding, messages, critical goals, subjects, classes, students, and current assignment;
5. adds either case-manager management data or the aide's schedule, training, time entry, and pay-period data.

Data is cached only for the current server invocation to reduce repeated Sheet reads without creating stale cross-request state.

The browser displays an operation overlay and prevents competing clicks while an RPC request is running. Targeted refresh actions reload only the necessary dashboard data.

## 8. Goal creation

The case manager selects a student, enters the annual goal, chooses relevant subjects, and may provide zero or any number of objectives/phases. Goals without phases are saved as drafts.

The parser:

- matches `Short-Term Objective`, `Benchmark`, `Objective`, and `Phase` without case sensitivity;
- accepts common hyphen variants;
- takes the text after each heading until the next heading or end of text;
- finds metrics written as `4/5` or `4 out of 5`;
- recognizes percentages, prompt level/count, and consecutive-session conditions;
- preserves source text when structured values are absent;
- requires an editable preview before save.

Creation is protected by a script lock. It creates one annual `Goals` row, its ordered phase rows, subject relationships, and initial phase-history boundary. The first phase starts active for an active goal.

The bulk-paste dialog accepts tab-separated rows copied from the documented Google Sheets template. IDs must match exactly; the server returns row-level errors and requires a preview before saving.

The case-manager Overview controls which benchmark is active and whether the goal is critical. Deactivating a goal preserves its history.

## 9. Benchmark lookup and entry

The lookup sequence is:

```text
Teacher → Period/Class → Student → Relevant active benchmarks
```

The current aide/teacher assignment is used as the initial selection when possible. Staff may manually select another teacher and class. The selected class determines its subject; only active benchmarks relevant to that subject are returned.

Multiple students may be selected. Each saved entry records:

- benchmark;
- student;
- class;
- raw successes;
- raw trials;
- calculated percentage;
- observation date;
- actual prompt level and prompt count;
- notes;
- timestamp;
- entering staff email.

Staff may queue individual entries or paste up to 200 tab-separated rows. One submission batch ID and normalized fingerprint are reused across retries; reusing an ID with different data is rejected. Validation runs before and after a 25-second script lock; `WRITE_BUSY` and validation responses leave the browser queue intact. Staff can download a tab-separated backup before retrying or navigating away. Backdated phase conflicts require an explicit historical-phase choice.

Case-manager analytics preserve raw counts, calculate latest-three current-phase accuracy from combined successes/trials, and evaluate mastery only when accuracy and prompt targets are complete. Charts support local goal visibility, prompt-colored points, monotonic phase dividers, and phase target lines. Printable progress summaries provide standardized IEP statements.

## 10. Schedule builder

The schedule builder edits one date at a time. Rows represent periods and columns represent aides.

Each cell can contain:

- class;
- optional 1:1 student;
- duty;
- note;
- `OFF`.

The grid provides:

- sticky aide headers;
- a sticky period column;
- a top horizontal scrollbar;
- Earlier aides and Later aides controls;
- date-specific shift start/end controls in each aide header;
- one lunch marker/start time per aide and date;
- covered-time labels for partial-period overlaps;
- live daily and projected weekly hours;
- approved conflict indicators;
- pending request warnings;
- trained replacement suggestions;
- unresolved 1:1 coverage indicators;
- a header-level Mark off action.

### Draft lifecycle

The client distinguishes five actions:

1. **Load a date** — display the saved daily schedule or a chosen/default template.
2. **Edit locally** — update the browser draft and header hours without a server save.
3. **Submit changes to recalculate** — request new weekly warnings without saving.
4. **Save temporary schedule** — persist the selected date.
5. **Save as schedule type** — persist a reusable template without overwriting the saved date.

Mark off clears an aide's class, student, duty, and note values and sets every displayed period to `OFF`. It remains local until **Save temporary schedule** is selected.

Every loaded schedule includes a revision token. A stale save is rejected instead of overwriting a newer edit. Saves use a 25-second script lock and return a catchable busy result.

### Hour calculations

Weekly capacity covers Monday through Sunday. Calculations:

- use each date's shift start/end, with date-specific overrides before recurring approved availability;
- deduct exactly 0.5 hour when a lunch start is selected;
- allow an assignment when any part of its period overlaps the shift;
- block assignments when hours are missing or the whole period is outside the shift;
- compare the weekly total with `Staff.WeeklyHours`;
- warn above capacity while allowing an authorized save after confirmation.

## 11. Availability, time off, and call-offs

Aides can submit Monday-Friday availability and date-ranged time-off requests. Requests begin as `PENDING`.

Case managers can approve or deny requests. Approval records the reviewer and date and sends an email response to the aide.

Scheduling behavior:

- approved time off is a blocking conflict;
- date-specific shift hours override recurring approved availability;
- partial-period overlap is valid and may include an optional handoff note;
- missing effective hours and fully out-of-shift periods are blocking conflicts;
- pending requests are warnings, not automatic blocks;
- replacement candidates must be active, trained when 1:1 coverage is involved, available, and not already assigned in the same period;
- candidates without pending warnings and with more weekly capacity are preferred.

A call-off is separate from manual Mark off. It creates the request, identifies affected assignments, attempts complete 1:1 reconciliation for each date, and notifies case managers and teachers. Reconciliation is atomic: if complete coverage cannot be found, no partial 1:1 replacement set is saved and case managers receive an urgent unresolved-coverage notification.

## 12. Aide time records

Aides can clock in, clock out, and review personal pay-period summaries. These records are explicitly a personal tracking tool and are not represented as official payroll or a replacement for required timecards.

## 13. Messages and branding

Case managers can create, edit, deactivate, and reactivate multiple global messages. Messages have start/end dates and identify the creator by last name in the interface.

A custom logo can be uploaded to Drive. When no custom logo is configured, the embedded Westminster mascot is used.

## 14. IEP generation

Case managers can generate a Google Doc for an assigned student. The document includes:

- student and case-manager information;
- plan dates;
- active annual goals;
- each goal's available ordered phases;
- subject relevance;
- available accuracy/prompt/mastery conditions;
- date-ranged standardized progress statements.

The generated document is moved into the application's IEP Drive folder, its URL is recorded in `IEPs`, and viewing access is limited to appropriate active case managers and administrators.

## 15. Database lifecycle

### New blank database

`setupVoicesDatabase(options)` is an installation function. If called without `options.spreadsheetId`, it creates a new spreadsheet and immediately changes `VOICES_DATABASE_ID` to that spreadsheet.

For a deliberately prepared blank spreadsheet, use:

```javascript
setupVoicesDatabase({ spreadsheetId: 'EXPECTED_SPREADSHEET_ID' })
```

It creates required sheets, aligns headers, adds the executing owner as an administrator when absent, adds defaults, runs legacy migration, and formats the workbook.

Do not run this function against current production as part of code deployment.

### Existing pre-2.3 database

`upgradeVoices23Database()` opens the database already configured in `VOICES_DATABASE_ID`. It makes additive schema changes, derives safe legacy values, seeds phase history, normalizes historical observation dates/status, adds schedule revision metadata, validates relationships, and records schema version 2.3. `upgradeVoices22Database()` delegates to this migration.

Use it only against a backed-up or copied database first. Production and training must not be upgraded or deployed until separately approved.

### Training data

`setupVoicesDemoDatabase()` creates or refreshes the isolated training database and refuses to target the live production database. `resetVoicesDemoDatabase({ confirm: 'RESET DEMO' })` is the only intentional erase/rebuild path and requires explicit confirmation.

Never run demo setup or reset against production.

## 16. Local development

Prerequisites:

- Git;
- Node.js;
- the official `@google/clasp` CLI for remote Apps Script synchronization.

Clone the repository and run:

```bash
npm test
```

The local tests:

- parse every `.gs` file;
- extract and parse the browser JavaScript from `Index.html`;
- validate deterministic demo relationships and counts;
- validate 2.3 migration/schema safeguards, flexible parsing, prompts, mastery, phase chronology, batch locking, accessible dialogs, bulk tools, and IEP null handling;
- validate Monday-Sunday weekly calculations;
- validate shift-based hours, fixed lunch deductions, and partial-period overlap;
- validate availability/time-off scheduling signals;
- validate local Mark off behavior.

These tests do not emulate Google services. Integration behavior involving Sheets, Drive, Docs, Mail, Session, or Script Properties must be verified in a non-production Apps Script project/database.

## 17. Clasp configuration

`.clasp.json` is intentionally excluded from Git. It identifies the remote Apps Script project and must be created locally beside `appsscript.json`.

Confirm the target before every push:

```bash
clasp status
clasp open
```

Then push:

```bash
clasp push
```

Do not use a parent-directory `.clasp.json`; clasp may scan unrelated files. Do not commit tokens, `.env` files, or account credentials.

## 18. Release workflow

1. Gather a complete, coherent release batch.
2. Create a Git feature branch.
3. Implement focused source changes.
4. Update `VERSION`, `package.json`, and this guide when behavior or operations change.
5. Run `npm test`.
6. Review the diff and scan for local bindings or credentials.
7. Open and review a pull request.
8. Push the approved revision to the training target.
9. Test the affected user workflows against the training database.
10. Create a new Apps Script version and update the existing production deployment only after approval.

Updating the existing deployment preserves its `/exec` URL. Creating a new deployment produces a new URL and should be avoided for routine production releases.

## 19. Operational safeguards

- Keep editable source routed to `VOICES_DATABASE_ID`.
- Keep production and training databases independent.
- Do not create duplicate projects, databases, or deployments without explicit authorization.
- Do not reset or seed production.
- Do not run `setupVoicesDatabase()` without an explicit, verified target.
- Do not modify the original 2.0 resources.
- Do not hardcode personal email addresses.
- Do not commit `.clasp.json`, OAuth tokens, or credentials.
- Keep Fredie the aide separate from any owner/admin identity.
- Treat Kaitlin's weekly capacity as 29 hours.
- Do not reintroduce the canceled first-login walkthrough unless it is requested again.
- Keep critical status and subject relevance at the goal level.
- Preserve existing IDs/history and allow zero or any number of phases per goal.
- Never infer missing historical prompt metadata.
- Keep unsaved observation queues intact after contention or validation failures.
- Use the account-choice guidance for Google multi-login; Apps Script cannot force an account.

## 20. Release history

### 2.0

Initial Workspace-only application with role-aware access, benchmark lookup and entry, schedules, requests, messages, and IEP generation.

### 2.1

Introduced annual goals with three parsed short-term objectives, multi-subject relevance, scalable case-manager analytics, message lifecycle management, staff/student management, and bootstrap performance work.

### 2.2

Added a realistic isolated training database, weekly aide capacities, Monday-Sunday schedule summaries, reusable schedule types, aide Weekly View, full daily coverage, availability/time-off scheduling assistance, replacement suggestions, sticky schedule navigation, manual recalculation, live hours with lunch deductions, and quick Mark off behavior.

### 2.3

Added flexible goal phases, separate task/prompt/accuracy conditions, raw-trial observations, prompt-aware mastery, phase chronology, idempotent queued and bulk writes, visibility-controlled phase charts, printable progress summaries, correction audit fields, date-specific aide shifts and lunches, partial-period coverage, schedule revision protection, accessible branded dialogs, and Google multi-account guidance.

## 21. Current status

The current repository release is V.O.I.C.E.S 2.3. Production and training remain on separate, unchanged deployment snapshots pending reviewed migration and rollout approval. The visible application name remains V.O.I.C.E.S 2.0. The repository is the canonical source location; Google Apps Script remains the runtime and deployment host.
