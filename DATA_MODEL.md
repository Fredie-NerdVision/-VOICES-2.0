# Google Sheets data model

The first row of every sheet is managed by `setupVoicesDatabase()`. Boolean columns accept `TRUE` or `FALSE`. Dates use `YYYY-MM-DD`; times use 24-hour `HH:MM`.

## Core roster

### Staff

| Column | Purpose |
|---|---|
| Id | Stable unique ID |
| Email | Exact Google Workspace email; whitelist key |
| FirstName / LastName | Welcome message and labels |
| Role | `AIDE`, `TEACHER`, or `CASE_MANAGER` |
| IsAdmin | Grants case-manager dashboard rights |
| Active | Controls access |
| WeeklyHours | Aide weekly warning threshold; blank for non-aides |

Case managers are also teachers operationally, but use `CASE_MANAGER` as their app role. An aide may receive admin rights by setting `IsAdmin` to `TRUE`.

### Students

`Id`, `Name`, `CaseManagerEmail`, `IsOneToOne`, `Active`.

### Subjects

`Id`, `Name`, `Active`. Classes use one subject. Objectives may be relevant to several subjects through `BenchmarkSubjects`.

### Classes

`Id`, `Name`, `SubjectId`, `TeacherEmail`, `PeriodId`, `Active`.

Use `ClassStudents` (`ClassId`, `StudentId`) and `ClassAides` (`ClassId`, `AideEmail`) for many-to-many enrollment and aide assignments.

### AideTraining

Each row is one trained pairing: `AideEmail`, `StudentId`. The call-off reconciler will only place an aide with a 1:1 student listed here.

## Goals, benchmarks, and IEPs

### Goals

Each row is one annual IEP goal:

- `Id`
- `StudentId`
- `Goal`
- `StartDate`
- `DueDate`
- `Active`
- `CreatedBy`
- `CreatedAt`
- `UpdatedAt`
- `Domain`
- `Status`: `DRAFT`, `ACTIVE`, `COMPLETED`, or `INACTIVE`
- `ImportBatchId`, `ImportGoalKey`, and `ImportFingerprint` for retry-safe bulk imports
- `BenchmarkActivationMode`: `DATE` for date-selected benchmarks or `LEGACY` for migrated progression-only goals

Goals may contain zero or any number of ordered benchmarks. The parser accepts IEP labels such as “STO” and “Short-Term Objective,” while the application uses “Benchmark” in normal workflows. Draft goals may omit structured targets. Only `ACTIVE` lifecycle goals participate in lookup, analytics, and IEP export; drafts and completed goals remain available to case managers without being treated as active.

### Benchmarks

Each benchmark row is an ordered task/condition phase associated with a goal through `GoalId`. Legacy ratios remain available, while 2.3 adds:

- `OrderIndex`
- `TaskDemandDescription`
- `GoalArchetype`: `DISCRETE_TRIAL`, `PROMPT_FADE`, `TASK_EXPANSION`, or `FREQUENCY_QUOTA`
- `TargetPromptLevel`
- `TargetPromptCeiling` (`TargetPromptCount` remains a compatibility alias)
- `TargetAccuracyPct`
- `ConsistencyTrialsPassed`
- `ConsistencyTrialsWindow`
- `TargetConsecutiveSessions`
- `EvaluationWindowUnit`: `SESSION`, `DATA_DAY`, `TWO_WEEK`, or `GRADING_PERIOD`
- benchmark-specific `StartDate` and `DueDate`

`TargetCorrect`, `TargetAttempts`, `RequiredTrials`, and `TotalTrials` are retained for compatibility. Ratios such as “3 of 4 opportunities” populate consistency fields and do not imply a 75% accuracy target. Date-mode goals select the eligible benchmark with the nearest due date, fall forward to the next upcoming benchmark when no date window is currently open, and select none after all date ranges end.

### GoalPhaseHistory

Records benchmark activation boundaries with `ActivatedAt`, `EndedAt`, actor, reason, and source. `MANUAL_OVERRIDE` rows end at the next configured school-quarter boundary; date selection resumes at expiration. Closed intervals also retain `EndedBy` and `EndReason`. Backdated observations in date mode are resolved from benchmark dates and applicable overrides, while legacy goals continue to use persisted history.

### BenchmarkSubjects

Each goal has subject relevance tags shared by all of its phases. A benchmark is returned when the selected class subject matches either its primary `Benchmarks.SubjectId` or a junction row.

### BenchmarkEntries

Each active row preserves raw successes/trials, calculated accuracy, observation date, actual prompt level/count, class, evaluator, notes, an idempotent submission batch ID, and a normalized batch fingerprint. The fingerprint rejects accidental batch-ID reuse with different data. Correction fields retain the original entry and a required correction reason rather than overwriting history; superseded rows are excluded from current lookup and analytics.

### Settings and Notifications

`Settings.SchoolQuarterBoundaries` stores five chronological dates: Q1, Q2, Q3, Q4, and the next school-year start. Notifications record all-ended benchmark warnings and retry-safe missing-observation alerts. Missing-observation keys include the benchmark, reset date, and 14/21/28-day alert interval so the daily monitor sends once at 14 days and then weekly until a new valid entry resets the cycle.

### IEPs

Written by the IEP generator. Each row links one student and case manager to plan dates, status, and a restricted Google Doc URL. Generated documents group every objective under its annual goal and include all relevance tags.

## Scheduling

### ScheduleTypes / SchedulePeriods

`ScheduleTypes` stores reusable schedule names and the default flag. `SchedulePeriods` stores any number of period rows with editable start/end times.

Reusable template assignments are stored in `Assignments` with a blank `Date` and the schedule type ID in `DayScheduleId`.

### DaySchedules / Assignments

`DaySchedules` represents a one-day temporary schedule and carries a `Revision` plus update attribution to reject stale saves. `Assignments` contains one aide assignment per period:

- `ClassId` for class coverage
- `StudentId` for 1:1 coverage
- `Duty` and `Note` for free-text responsibilities
- `Type`: `STANDARD`, `ONE_TO_ONE`, or `OFF`

`OFF` clears and overrides class/student fields for that aide and period.

### AideDailyHours

Stores each aide's date-specific shift start/end and optional lunch start. A selected lunch deducts exactly 30 minutes. Date-specific rows override approved recurring availability; approved time off still blocks scheduling.

Weekly hours are calculated from effective shift times, not assignment cells. Partial-period overlap is allowed, periods entirely outside a shift are blocked, and weekly capacity remains advisory.

## Staff records and communication

- `Messages`: date-ranged dashboard broadcasts with creator email/time, editable content, and retained inactive history
- `TimeEntries`: personal clock-in/out records and computed hours
- `TimeOffRequests`: call-offs and planned time-off requests
- `Availability`: weekly Monday-Friday submissions and approvals
- `Notifications`: unresolved 1:1 coverage alerts
- `Settings`: school name, pay-period day, notices, instructions, optional comma-separated case-manager alert emails, and `ScheduleWeekdays`

## Example relationships

```text
Staff.Email        -> Students.CaseManagerEmail
Staff.Email        -> Classes.TeacherEmail
Students.Id        -> ClassStudents.StudentId
Classes.Id         -> ClassStudents.ClassId
Classes.SubjectId  -> Subjects.Id
Benchmarks.StudentId -> Students.Id
Benchmarks.SubjectId -> Subjects.Id
Benchmarks.GoalId    -> Goals.Id
Goals.StudentId      -> Students.Id
BenchmarkSubjects.BenchmarkId -> Benchmarks.Id
BenchmarkSubjects.SubjectId   -> Subjects.Id
GoalPhaseHistory.GoalId       -> Goals.Id
GoalPhaseHistory.BenchmarkId  -> Benchmarks.Id
AideDailyHours.AideEmail      -> Staff.Email
```

Do not place student medical details or unnecessary sensitive information in free-text notes. Follow district retention and access-control policy for all IEP and benchmark data.
