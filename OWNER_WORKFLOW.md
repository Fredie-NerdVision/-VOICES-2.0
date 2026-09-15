# My Simple V.O.I.C.E.S Workflow

I use this checklist whenever I change, test, or release V.O.I.C.E.S. The main
rule is simple: I test one complete version in the school test app before I
change the production app.

## Quick version

1. Confirm whether I am changing test, training, or production.
2. Use every Apps Script file from the same GitHub commit.
3. Run `npm test`.
4. Copy and save the complete source in the school test Apps Script project.
5. Run a database upgrade only when the release instructions require one.
6. Update the existing test deployment using **New version**.
7. Test sign-in, observations, roster editing, relevance tags, and schedules.
8. Back up production if a database upgrade is required.
9. Copy the same tested source to production and update its existing
   deployment.
10. Record the GitHub commit, Apps Script version, database, and web app URL.

## 1. Know what each part does

- **GitHub** holds the official code and its history.
- **Apps Script** runs the web app.
- **The Google Sheet database** holds staff, students, goals, observations,
  schedules, requests, and settings.
- Copying or deploying code does not automatically change the database.
- Running a setup, upgrade, reset, or demo function can change the database.

## 2. Before I change anything

1. I decide whether I am working on the school test app, Personal Training, or
   production.
2. I confirm the Apps Script project name and its current `/exec` URL.
3. I confirm which database ID that project uses.
4. I make a database backup before any database upgrade.
5. I do not experiment in production.

## 3. Keep every source file on the same version

I never mix files from different GitHub commits. A newer file may call a
function that does not exist in an older file.

When I manually copy a release, I replace the complete contents of every
matching Apps Script source file:

- `AdminService.gs`
- `BenchmarkService.gs`
- `Code.gs`
- `Database.gs`
- `DefaultLogo.gs`
- `DemoData.gs`
- `GoalService.gs`
- `IEPService.gs`
- `ScheduleService.gs`
- `TimeService.gs`
- `Index.html`
- `appsscript.json`

I click **Raw** on GitHub before copying a file. I save every Apps Script file
before I deploy.

I do not copy GitHub-only files such as tests, guides, images, `package.json`,
or `.clasp.json` into Apps Script.

## 4. Check the code before Apps Script

From the repository folder, I run:

```bash
npm test
```

I continue only when every check passes. These tests do not change Google
Sheets, Drive, Docs, Mail, or any deployment.

## 5. Decide whether the database needs an upgrade

Most code updates do **not** need a database function.

| Type of update | What I do |
| --- | --- |
| Comments, wording, colors, identity flow, calculations, or browser fixes | Deploy code only |
| A release says a new sheet or column is required | Back up the database, then run only the named upgrade function |
| A current 2.3 database already has the required structure | Do not run the upgrade again unless the release instructions say to |
| I am unsure | Stop and confirm before running any function |

I never run these as a normal deployment step:

- `setupVoicesDatabase()`
- `setupVoicesDemoDatabase()`
- `resetVoicesDemoDatabase()`

I never run a setup, reset, or demo function against production.

## 6. Update the school test app first

1. I open the correct school test Apps Script project.
2. I confirm the project is connected to the school test database.
3. I replace all source files from the same GitHub version.
4. I save all files.
5. I run `getAppBootstrap()` from the Apps Script editor.
6. If it completes, I choose **Deploy → Manage deployments**.
7. I edit the existing web app deployment.
8. I choose **New version**.
9. I deploy and keep the existing `/exec` URL.

I create a completely new deployment only when I intentionally want a new
URL. For a routine update, I update the existing deployment.

## 7. Test the important school workflows

I test with accounts that represent each role I changed.

### Entry and privacy

1. Open the clean `/exec` URL.
2. Confirm the signed-in Google Workspace account is checked against the
   active `Staff` list.
3. Confirm a non-whitelisted account is denied.
4. Use **Lock** and confirm the private workspace is covered.

The 30-minute lock protects the V.O.I.C.E.S screen. It does not sign the user
out of Google.

### Observation entry

1. Open **Benchmark entry**.
2. Select a teacher, class, and student.
3. Find the relevant benchmarks.
4. Add an observation to the queue.
5. Edit the queued observation.
6. Reload the page and confirm the queue returns.
7. Submit the queue once and confirm it clears after success.

### Roster and goal relevance

1. Open **People → Class enrollment**.
2. Edit one test roster and save it.
3. Reload and confirm the roster stayed correct.
4. Open a student's goal.
5. Edit the relevant classes or subjects.
6. Reload and confirm the tags stayed correct.

### Schedules and management

1. Load a schedule date and template.
2. Confirm teacher-room choices are not duplicated.
3. Save a test schedule and reload it.
4. Check any changed call-off, availability, message, goal, report, or IEP
   workflow.

I use test records that I can safely restore. I do not use a real student
record just to prove a new feature works.

## 8. Release to production

I release to production only after the school test app passes.

1. I confirm the approved GitHub commit.
2. I back up production if a database upgrade is required.
3. I open the production Apps Script project and verify its database ID.
4. I copy the same complete source version that passed testing.
5. I save all files.
6. I run only the approved database upgrade, if one is required.
7. I edit the existing production deployment.
8. I choose **New version** and deploy.
9. I open the existing production `/exec` URL.
10. I perform a short entry, observation lookup, roster, and schedule check.

## 9. If something goes wrong

1. I stop making additional changes.
2. I write down the exact error and which deployment URL showed it.
3. I confirm all Apps Script files came from the same GitHub commit.
4. I confirm I updated the intended deployment to **New version**.
5. I confirm I am opening the current deployment's exact `/exec` URL.
6. I check Apps Script **Executions** for the failed function and version.
7. If needed, I edit the deployment and select the last known working version.

Changing the deployment back to an older code version does not reverse a
database migration. That is why I always back up the database before an
approved migration.

## 10. My final release note

For every release, I record:

```text
GitHub commit:
Apps Script project:
Database:
Deployment version:
Web app URL:
Database upgrade run:
Tested roles:
Important results:
```

This gives me one simple record of exactly what code, database, and deployment
are in use.
