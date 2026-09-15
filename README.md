# V.O.I.C.E.S

This repository contains the V.O.I.C.E.S Google Apps Script application. The visible product name is **V.O.I.C.E.S 2.0** and the current source/database release is **2.3**.

Release 2.3 adds flexible goal phases, raw-trial and prompt-condition observations, phase-aware analytics and printable progress summaries, fingerprinted bulk/queued writes with browser and server draft recovery, in-app roster and goal-relevance editing, a Workspace entry screen with a 30-minute idle lock, date-specific aide shifts/lunches, schedule revision protection, and accessible branded dialogs.

Use [OWNER_WORKFLOW.md](OWNER_WORKFLOW.md) for the simple update, testing, and
deployment checklist. Read [PROJECT_GUIDE.md](PROJECT_GUIDE.md) for the
complete architecture, data model, workflows, resource map, setup, testing,
and deployment procedures.

## Identity and entry

V.O.I.C.E.S uses the Google Workspace account already active in the browser. The server reads that account with `Session.getActiveUser().getEmail()` and then requires an active matching row in the `Staff` sheet.

The branded entry screen is not a separate username/password system. **Choose another Google account** opens Google's normal account chooser, but Google may reuse an account that is already signed in. The 30-minute idle lock covers private information and rechecks access; it does not sign the browser out of Google.

The web app should remain domain-restricted and deployed to execute as the owner. No kiosk enrollment, OAuth client, V.O.I.C.E.S password, or signed app session is required.

## Local validation

```bash
npm test
```

The test suite uses Node's built-in runtime and requires no package installation.

## Apps Script checkout

Install and authenticate the official Apps Script CLI:

```bash
npm install -g @google/clasp
clasp login
```

Create a local `.clasp.json` beside `appsscript.json` using the intended Apps Script project ID. `.clasp.json` is deliberately excluded from Git because production, training, and owner-controlled copies can use different projects.

Push only after local validation and after confirming the target project:

```bash
clasp status
clasp push
```

Never run a production database setup, reset, or demo seed as part of a code deployment.
