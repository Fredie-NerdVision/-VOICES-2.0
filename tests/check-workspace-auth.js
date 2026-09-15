/*
 * I keep this check to prevent the removed kiosk login from returning later.
 * It also confirms that account identity, roster editing, durable drafts, and
 * persistent caching remain connected after an authentication change.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function rejectText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

const code = read('Code.gs');
const index = read('Index.html');
const database = read('Database.gs');
const benchmarks = read('BenchmarkService.gs');
const admin = read('AdminService.gs');
const manifest = read('appsscript.json');
const packageJson = read('package.json');

requireText(
  code,
  'Session.getActiveUser().getEmail()',
  'Code.gs must identify the active Google Workspace account.'
);
requireText(
  code,
  'requireAuthorizedStaff_(email)',
  'Workspace identity must still pass through the active Staff whitelist.'
);
requireText(
  index,
  'accountChooserUrl_',
  'Index.html must keep the normal Google account chooser.'
);
requireText(
  index,
  'const IDLE_LOCK_MS = 30 * 60 * 1000',
  'Index.html must keep the 30-minute privacy lock.'
);
requireText(
  database,
  'ObservationDrafts:',
  'Database.gs must keep the durable observation-draft table.'
);
requireText(
  database,
  'function readPersistentResponse_',
  'Database.gs must keep persistent response caching.'
);
requireText(
  benchmarks,
  'function saveObservationDraft(payload)',
  'BenchmarkService.gs must keep server-side draft saving.'
);
requireText(
  admin,
  'function saveClassRoster(payload)',
  'AdminService.gs must keep in-app roster editing.'
);

[
  [code, 'voicesAuthedCall', 'Code.gs must not route calls through a kiosk session.'],
  [index, 'voicesKiosk', 'Index.html must not enroll or identify kiosk devices.'],
  [index, 'VOICES_KIOSK_SESSION', 'Index.html must not store kiosk sessions.'],
  [manifest, 'script.external_request', 'The manifest must not request the kiosk token-exchange scope.'],
  [packageJson, 'check-kiosk-auth.js', 'The removed kiosk regression test must not run.']
].forEach(([source, text, message]) => rejectText(source, text, message));

['AuthService.gs', 'SHARED_DEVICE_LOGIN.md', path.join('tests', 'check-kiosk-auth.js')]
  .forEach(file => {
    if (fs.existsSync(path.join(root, file))) {
      throw new Error(`${file} must remain removed with the kiosk authentication layer.`);
    }
  });

console.log('Workspace identity rollback and retained-feature checks passed.');
