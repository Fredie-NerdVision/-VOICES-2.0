const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(projectRoot, name), 'utf8');

const encodeWebSafe = buffer => Buffer.from(buffer).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_');
const decodeWebSafe = value => Array.from(
  Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
);

const scriptProperties = new Map([
  ['VOICES_OAUTH_CLIENT_ID', 'client-123.apps.googleusercontent.com'],
  ['VOICES_OAUTH_CLIENT_SECRET', 'secret-abc'],
  ['VOICES_LOGIN_DOMAINS', 'school.edu']
]);

const staffRows = [
  { Email: 'aide@school.edu', Name: 'Active Aide', Active: true },
  { Email: 'left@school.edu', Name: 'Former Aide', Active: false }
];

let tokenResponse = null;
const calls = [];
const cache = new Map();

const context = {
  console,
  JSON,
  Date,
  Math,
  Number,
  String,
  Boolean,
  Object,
  Array,
  RegExp,
  Error,
  VOICES: { APP_NAME: 'V.O.I.C.E.S 2.0' },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: key => (scriptProperties.has(key) ? scriptProperties.get(key) : null),
      setProperty: (key, value) => scriptProperties.set(key, value)
    })
  },
  Utilities: {
    base64EncodeWebSafe: value => encodeWebSafe(
      typeof value === 'string' ? Buffer.from(value, 'utf8') : Buffer.from(value)
    ),
    base64DecodeWebSafe: decodeWebSafe,
    newBlob: bytes => ({
      getDataAsString: () => Buffer.from(bytes).toString('utf8')
    }),
    computeHmacSha256Signature: (value, key) => Array.from(
      crypto.createHmac('sha256', key).update(String(value), 'utf8').digest()
    ),
    getUuid: () => 'uuid-' + scriptProperties.size
  },
  ScriptApp: {
    getScriptId: () => 'SCRIPT-ID',
    getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/app/exec' }),
    newStateToken: () => ({
      withMethod() { return this; },
      withTimeout() { return this; },
      createToken: () => 'state-token'
    })
  },
  UrlFetchApp: {
    fetch: (url, options) => {
      calls.push({ url, options });
      return tokenResponse;
    }
  },
  CacheService: {
    getScriptCache: () => ({
      put: (key, value) => cache.set(key, value),
      get: key => (cache.has(key) ? cache.get(key) : null),
      remove: key => cache.delete(key)
    })
  },
  HtmlService: {
    XFrameOptionsMode: { DEFAULT: 'DEFAULT' },
    createTemplate: markup => ({
      markup,
      evaluate() {
        return {
          markup: this.markup,
          values: this,
          setTitle() { return this; },
          setXFrameOptionsMode() { return this; }
        };
      }
    })
  },
  sanitizeText_: (value, max) => String(value === undefined || value === null ? '' : value).slice(0, max),
  normalizeEmail_: value => String(value || '').trim().toLowerCase(),
  toBoolean_: value => value === true || String(value).toLowerCase() === 'true',
  requireAuthorizedStaff_(email) {
    const staff = staffRows.find(row =>
      context.normalizeEmail_(row.Email) === context.normalizeEmail_(email) &&
      context.toBoolean_(row.Active)
    );
    if (!staff) throw new Error('Access denied. Your Google Workspace account is not on the active V.O.I.C.E.S staff whitelist.');
    return staff;
  },
  whoAmI() { return context.getCurrentUserEmail_(); },
  Session: { getActiveUser: () => ({ getEmail: () => 'kiosk@school.edu' }) },
  upgradeVoices23Database() { return 'migrated'; },
  privateHelper_() { return 'private'; }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(read('AuthService.gs'), context);
vm.runInContext("VOICES_AUTH.CALLABLE_FUNCTIONS.push('whoAmI')", context);

const codeSource = read('Code.gs');
const identityFunction = codeSource.match(/function getCurrentUserEmail_\(\) \{[\s\S]*?\n\}/);
if (!identityFunction) throw new Error('getCurrentUserEmail_ could not be located in Code.gs.');
vm.runInContext(identityFunction[0], context);

const run = source => vm.runInContext(source, context);
const expectError = (source, pattern, label) => {
  try {
    run(source);
  } catch (error) {
    if (!pattern.test(error.message)) {
      throw new Error(`${label} failed with an unexpected message: ${error.message}`);
    }
    return;
  }
  throw new Error(`${label} was allowed.`);
};

const idToken = claims => [
  encodeWebSafe(Buffer.from(JSON.stringify({ alg: 'RS256' }))),
  encodeWebSafe(Buffer.from(JSON.stringify(claims))),
  'signature'
].join('.');

const validClaims = overrides => Object.assign({
  iss: 'https://accounts.google.com',
  aud: 'client-123.apps.googleusercontent.com',
  exp: Math.floor(Date.now() / 1000) + 600,
  email: 'aide@school.edu',
  email_verified: true,
  name: 'Active Aide'
}, overrides || {});

const loginUrl = run('getKioskLoginUrl()');
if (!loginUrl.includes('prompt=select_account') ||
    !loginUrl.includes('state=state-token') ||
    !loginUrl.includes('hd=school.edu') ||
    !loginUrl.includes(encodeURIComponent('https://script.google.com/macros/d/SCRIPT-ID/usercallback'))) {
  throw new Error('The kiosk login URL is missing account selection, state, or the script redirect URI.');
}

context.verifyGoogleIdToken_ = context.verifyGoogleIdToken_;
const clientId = 'client-123.apps.googleusercontent.com';
const verified = context.verifyGoogleIdToken_(idToken(validClaims()), clientId);
if (verified.email !== 'aide@school.edu') throw new Error('A valid Google identity was not accepted.');

[
  [{ iss: 'https://evil.example' }, /issued by Google/, 'A forged issuer'],
  [{ aud: 'other-client' }, /different application/, 'A mismatched audience'],
  [{ exp: Math.floor(Date.now() / 1000) - 10 }, /expired/, 'An expired identity token'],
  [{ email_verified: false }, /verified email/, 'An unverified email'],
  [{ email: 'person@gmail.com' }, /school Google account/, 'An out-of-domain account']
].forEach(([overrides, pattern, label]) => {
  try {
    context.verifyGoogleIdToken_(idToken(validClaims(overrides)), clientId);
  } catch (error) {
    if (!pattern.test(error.message)) {
      throw new Error(`${label} failed with an unexpected message: ${error.message}`);
    }
    return;
  }
  throw new Error(`${label} was accepted.`);
});

tokenResponse = {
  getResponseCode: () => 200,
  getContentText: () => JSON.stringify({ id_token: idToken(validClaims()) })
};
const handoff = run('voicesAuthCallback({ parameter: { code: "auth-code" } })');
const handoffId = JSON.parse(handoff.values.handoffJson);
const completedHandoff = context.consumeKioskAuthHandoff_(handoffId);
if (!handoff.markup.includes('voicesAuth=') ||
    !completedHandoff.token.includes('.') ||
    calls[0].options.payload.client_secret !== 'secret-abc' ||
    calls[0].options.payload.grant_type !== 'authorization_code') {
  throw new Error('The kiosk callback did not exchange the code server side and hand off a session.');
}
const sessionToken = completedHandoff.token;
if (context.consumeKioskAuthHandoff_(handoffId).token) {
  throw new Error('A kiosk sign-in handoff could be consumed more than once.');
}

tokenResponse = {
  getResponseCode: () => 200,
  getContentText: () => JSON.stringify({ id_token: idToken(validClaims({ email: 'left@school.edu' })) })
};
const deniedHandoff = run('voicesAuthCallback({ parameter: { code: "auth-code" } })');
const denied = context.consumeKioskAuthHandoff_(JSON.parse(deniedHandoff.values.handoffJson));
if (denied.token !== '' || !/staff whitelist/.test(denied.error)) {
  throw new Error('An inactive staff account received a kiosk session.');
}

if (context.getCurrentUserEmail_() !== 'kiosk@school.edu') {
  throw new Error('Without a kiosk session the gateway Google account should be used.');
}
const dispatched = context.voicesAuthedCall(sessionToken, 'whoAmI', []);
if (dispatched !== 'aide@school.edu') {
  throw new Error('A dispatched call did not run as the signed-in staff member.');
}
if (context.getCurrentUserEmail_() !== 'kiosk@school.edu') {
  throw new Error('The session identity leaked beyond the dispatched call.');
}

const tampered = sessionToken.split('.')[0] + '.' + encodeWebSafe(Buffer.from('forged'));
expectError(`voicesAuthedCall(${JSON.stringify(tampered)}, 'whoAmI', [])`, /could not be verified/, 'A forged session signature');
const forgedPayload = encodeWebSafe(Buffer.from(JSON.stringify({
  v: 1, email: 'admin@school.edu', exp: Date.now() + 60000
})));
expectError(`voicesAuthedCall(${JSON.stringify(forgedPayload + '.' + sessionToken.split('.')[1])}, 'whoAmI', [])`, /could not be verified/, 'A swapped session payload');
expectError("voicesAuthedCall('', 'whoAmI', [])", /Sign in with your school Google account/, 'A missing session');

const expiredPayload = encodeWebSafe(Buffer.from(JSON.stringify({
  v: 1, email: 'aide@school.edu', exp: Date.now() - 1000
})));
const expiredToken = expiredPayload + '.' + context.signVoicesSessionPayload_(expiredPayload);
expectError(`voicesAuthedCall(${JSON.stringify(expiredToken)}, 'whoAmI', [])`, /expired/, 'An expired session');

const inactivePayload = encodeWebSafe(Buffer.from(JSON.stringify({
  v: 1, email: 'left@school.edu', exp: Date.now() + 60000
})));
const inactiveToken = inactivePayload + '.' + context.signVoicesSessionPayload_(inactivePayload);
expectError(`voicesAuthedCall(${JSON.stringify(inactiveToken)}, 'whoAmI', [])`, /staff whitelist/, 'A deactivated staff session');

[
  ['privateHelper_', /not available/, 'A private helper'],
  ['upgradeVoices23Database', /not available/, 'A migration function'],
  ['voicesAuthedCall', /not available/, 'The dispatcher itself'],
  ['getKioskLoginUrl', /not available/, 'The login URL builder'],
  ['missingFunction', /not available/, 'An unknown function']
].forEach(([name, pattern, label]) => {
  expectError(`voicesAuthedCall(${JSON.stringify(sessionToken)}, ${JSON.stringify(name)}, [])`, pattern, label);
});

const refreshed = context.refreshVoicesSession(sessionToken);
if (!refreshed.token || refreshed.token === sessionToken ||
    context.voicesAuthedCall(refreshed.token, 'whoAmI', []) !== 'aide@school.edu') {
  throw new Error('An active session could not be extended without a new Google sign-in.');
}

scriptProperties.delete('VOICES_OAUTH_CLIENT_SECRET');
if (run('getKioskLoginUrl()') !== '') {
  throw new Error('Kiosk login should stay disabled until the OAuth client is configured.');
}

const html = read('Index.html');
[
  "data-kiosk-login-url=\"<?= kioskLoginUrl ?>\"",
  'function isKioskDevice_()',
  'function startKioskLogin_()',
  'function consumeKioskSessionHandoff_()',
  'runner.voicesAuthedCall(session, functionName, args)',
  '.refreshVoicesSession(session)',
  'Sign in with your school Google account',
  'if (isKioskDevice_()) clearKioskSession_();'
].forEach(value => {
  if (!html.includes(value)) throw new Error('Missing kiosk client behavior: ' + value);
});
if (/google\.script\.run[\s\S]{0,120}\[functionName\]\(\.\.\.args\)/.test(
  html.replace(/function callServer_[\s\S]*?\n    \}/, '')
)) {
  throw new Error('A client call bypasses the authenticated dispatcher.');
}
if (!codeSource.includes('template.kioskLoginUrl = getKioskLoginUrl();') ||
    !codeSource.includes('template.kioskSessionToken = kioskHandoff.token;') ||
    !codeSource.includes('voicesSessionEmail_')) {
  throw new Error('The server entry point does not expose or honor kiosk sessions.');
}
const authSource = read('AuthService.gs');
if (!authSource.includes('CALLABLE_FUNCTIONS') ||
    !authSource.includes('secureStringsEqual_') ||
    !authSource.includes('CacheService.getScriptCache()')) {
  throw new Error('Kiosk sessions are missing explicit RPC, signature, or one-time handoff safeguards.');
}

console.log('Kiosk authentication behavior passed: ' + JSON.stringify({
  dispatchedAs: dispatched,
  sessionRefreshed: refreshed.expiresInMs / 60000 + ' minutes'
}));
