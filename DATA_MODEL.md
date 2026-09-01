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

The case-manager Goals workspace requires exactly three `Short-Term Objective` sections in one combined text input and creates three rows in `Benchmarks`.

### Benchmarks

Each benchmark row is a short-term objective associated with a goal through `GoalId`. The metric:

> Math - Money Math: student will get 3 out of 5 correct in 4 / 5 trials

is represented by:

- `Category`: Math - Money Math
- `Skill`: the individual goal text
- `TargetCorrect`: 3
- `TargetAttempts`: 5
- `RequiredTrials`: 4
- `TotalTrials`: 5

`StudentId`, `GoalId`, `SubjectId`, `StartDate`, `DueDate`, `Critical`, `Active`, and `Description` complete the record. `SubjectId` is the compatibility/primary subject. Within each active annual goal, one objective is marked `Active` for lookup and data entry.

### BenchmarkSubjects

Each goal has one set of relevance tags shared by its three benchmarks. For lookup compatibility, each `BenchmarkId`, `SubjectId` junction row repeats a goal tag for one benchmark. A benchmark is returned when the selected class subject matches either its primary `Benchmarks.SubjectId` or any junction row.

### BenchmarkEntries

Written by the app. Each row stores the benchmark/student/class, signed-in staff email, correct and attempted counts, calculated percent, timestamp, and notes.

### IEPs

Written by the IEP generator. Each row links one student and case manager to plan dates, status, and a restricted Google Doc URL. Generated documents group every objective under its annual goal and include all relevance tags.

## Scheduling

### ScheduleTypes / SchedulePeriods

`ScheduleTypes` stores reusable schedule names and the default flag. `SchedulePeriods` stores any number of period rows with editable start/end times.

Reusable template assignments are stored in `Assignments` with a blank `Date` and the schedule type ID in `DayScheduleId`.

### DaySchedules / Assignments

`DaySchedules` represents a one-day temporary schedule. `Assignments` contains one aide assignment per period:

- `ClassId` for class coverage
- `StudentId` for 1:1 coverage
- `Duty` and `Note` for free-text responsibilities
- `Type`: `STANDARD`, `ONE_TO_ONE`, or `OFF`

`OFF` clears and overrides class/student fields for that aide and period.

The weekly scheduler reads Monday-Sunday. Explicit saved weekend schedules count toward weekly hours. Template fallback is limited to weekdays listed in the comma-separated `Settings.ScheduleWeekdays` value. Overlapping assignments are merged before hours are totaled, and weekly capacity is advisory rather than a hard limit.

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
```

Do not place student medical details or unnecessary sensitive information in free-text notes. Follow district retention and access-control policy for all IEP and benchmark data.
