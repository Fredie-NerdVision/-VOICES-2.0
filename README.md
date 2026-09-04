# V.O.I.C.E.S

This repository contains the V.O.I.C.E.S Google Apps Script application. The visible product name is **V.O.I.C.E.S 2.0** and the current source/database release is **2.3**.

Release 2.3 adds flexible goal phases, raw-trial and prompt-condition observations, phase-aware analytics and printable progress summaries, fingerprinted bulk/queued writes with downloadable unsaved-queue backups, date-specific aide shifts/lunches, schedule revision protection, and accessible branded dialogs.

Read [PROJECT_GUIDE.md](PROJECT_GUIDE.md) for the complete architecture, data model, workflows, resource map, setup, testing, and deployment procedures.

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
