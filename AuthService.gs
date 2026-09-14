/**
 * Shared-device (kiosk) authentication.
 *
 * A dedicated kiosk Google account passes the Apps Script gateway, then each
 * staff member signs in to V.O.I.C.E.S itself with their own school Google
 * account. The OAuth code exchange happens server side, so staff never grant
 * Sheets, Drive, Docs, or Mail permissions; those keep running as the deploying
 * owner.
 */
const VOICES_AUTH = {
  SESSION_TTL_MS: 30 * 60 * 1000,
  SESSION_VERSION: 1,
  STATE_TIMEOUT_SECONDS: 900,
  HANDOFF_TTL_SECONDS: 120,
  HANDOFF_CACHE_PREFIX: 'voices-auth-handoff:',
  CLIENT_ID_PROPERTY: 'VOICES_OAUTH_CLIENT_ID',
  CLIENT_SECRET_PROPERTY: 'VOICES_OAUTH_CLIENT_SECRET',
  SESSION_SECRET_PROPERTY: 'VOICES_SESSION_SECRET',
  LOGIN_DOMAINS_PROPERTY: 'VOICES_LOGIN_DOMAINS',
  AUTH_ENDPOINT: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
  ISSUERS: ['https://accounts.google.com', 'accounts.google.com'],
  CALLABLE_FUNCTIONS: [
    'callOff',
    'clearObservationDraft',
    'clockIn',
    'clockOut',
    'createGoal',
    'deactivateGoal',
    'deleteStaff',
    'deleteStudent',
    'generateIep',
    'getAideWeek',
    'getAppBootstrap',
    'getBenchmarkEntryDetails',
    'getCaseManagerEntryData',
    'getCaseManagerOverviewData',
    'getCaseManagerPeopleData',
    'getCaseManagerWorkspaceData',
    'getFullSchedule',
    'getGoalManagerData',
    'getIepsForCurrentCaseManager',
    'getMessageManagementData',
    'getObservationDraft',
    'getScheduleBuilderData',
    'getScheduleTypeSummaries',
    'getStaffRequestData',
    'getStudentGoalWorkspace',
    'lookupBenchmarks',
    'previewAdminCatalogBatch',
    'previewBenchmarkEntriesBatch',
    'previewBulkGoals',
    'previewWeeklyHours',
    'reviewStaffRequest',
    'saveAdminCatalogBatch',
    'saveBenchmarkEntriesBatch',
    'saveBrandingLogo',
    'saveBulkGoals',
    'saveClassRoster',
    'saveDailyMessage',
    'saveObservationDraft',
    'saveSchedule',
    'saveScheduleType',
    'saveSchoolQuarterBoundaries',
    'setActiveGoalBenchmark',
    'setDailyMessageActive',
    'setGoalCritical',
    'submitAvailability',
    'submitTimeOffRequest',
    'updateGoalSubjects',
    'upsertStaff',
    'upsertStudent'
  ]
};

let voicesSessionEmail_ = '';

function voicesAuthProperties_() {
  return PropertiesService.getScriptProperties();
}

function isKioskLoginConfigured_() {
  const properties = voicesAuthProperties_();
  return Boolean(
    String(properties.getProperty(VOICES_AUTH.CLIENT_ID_PROPERTY) || '').trim() &&
    String(properties.getProperty(VOICES_AUTH.CLIENT_SECRET_PROPERTY) || '').trim()
  );
}

function kioskRedirectUri_() {
  return 'https://script.google.com/macros/d/' + ScriptApp.getScriptId() + '/usercallback';
}

/**
 * Returns the Google sign-in URL for a shared device, or an empty string when
 * kiosk login has not been configured for this project.
 */
function getKioskLoginUrl() {
  if (!isKioskLoginConfigured_()) return '';
  const clientId = String(
    voicesAuthProperties_().getProperty(VOICES_AUTH.CLIENT_ID_PROPERTY) || ''
  ).trim();
  const state = ScriptApp.newStateToken()
    .withMethod('voicesAuthCallback')
    .withTimeout(VOICES_AUTH.STATE_TIMEOUT_SECONDS)
    .createToken();
  const parameters = {
    client_id: clientId,
    redirect_uri: kioskRedirectUri_(),
    response_type: 'code',
    scope: 'openid email profile',
    state: state,
    prompt: 'select_account',
    include_granted_scopes: 'false',
    access_type: 'online'
  };
  const loginDomains = kioskLoginDomains_();
  if (loginDomains.length === 1) parameters.hd = loginDomains[0];
  const query = Object.keys(parameters)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]))
    .join('&');
  return VOICES_AUTH.AUTH_ENDPOINT + '?' + query;
}

function kioskLoginDomains_() {
  return String(voicesAuthProperties_().getProperty(VOICES_AUTH.LOGIN_DOMAINS_PROPERTY) || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Handles Google's redirect back to the script, verifies the identity, and
 * hands a signed V.O.I.C.E.S session to the shared-device browser.
 */
function voicesAuthCallback(request) {
  let handoff;
  try {
    const code = request && request.parameter ? request.parameter.code : '';
    if (!code) throw new Error('Google sign-in was cancelled.');
    const identity = exchangeKioskAuthorizationCode_(code);
    requireAuthorizedStaff_(identity.email);
    handoff = { token: createVoicesSession_(identity), error: '' };
  } catch (error) {
    handoff = { token: '', error: error && error.message ? error.message : String(error) };
  }
  return renderKioskSessionHandoff_(storeKioskAuthHandoff_(handoff));
}

function exchangeKioskAuthorizationCode_(code) {
  const properties = voicesAuthProperties_();
  const clientId = String(properties.getProperty(VOICES_AUTH.CLIENT_ID_PROPERTY) || '').trim();
  const clientSecret = String(
    properties.getProperty(VOICES_AUTH.CLIENT_SECRET_PROPERTY) || ''
  ).trim();
  if (!clientId || !clientSecret) {
    throw new Error('Shared-device sign-in is not configured for this V.O.I.C.E.S project.');
  }
  const response = UrlFetchApp.fetch(VOICES_AUTH.TOKEN_ENDPOINT, {
    method: 'post',
    muteHttpExceptions: true,
    payload: {
      code: code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: kioskRedirectUri_(),
      grant_type: 'authorization_code'
    }
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('Google rejected the sign-in attempt. Try again.');
  }
  const payload = JSON.parse(response.getContentText());
  if (!payload || !payload.id_token) {
    throw new Error('Google did not return an identity for this sign-in.');
  }
  return verifyGoogleIdToken_(payload.id_token, clientId);
}

/**
 * Validates the claims of an ID token received directly from Google's token
 * endpoint over HTTPS.
 */
function verifyGoogleIdToken_(idToken, clientId) {
  const segments = String(idToken || '').split('.');
  if (segments.length !== 3) throw new Error('The Google identity token was malformed.');
  const claims = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(segments[1])).getDataAsString()
  );
  if (VOICES_AUTH.ISSUERS.indexOf(String(claims.iss)) === -1) {
    throw new Error('The Google identity token was not issued by Google.');
  }
  const audiences = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud)];
  if (audiences.indexOf(String(clientId)) === -1 ||
      (audiences.length > 1 && String(claims.azp || '') !== String(clientId))) {
    throw new Error('The Google identity token was issued for a different application.');
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!claims.exp || Number(claims.exp) <= nowSeconds) {
    throw new Error('The Google identity token has expired. Sign in again.');
  }
  if (claims.email_verified === false) {
    throw new Error('This Google account does not have a verified email address.');
  }
  const email = normalizeEmail_(claims.email);
  if (!email) throw new Error('Google did not share an email address for this account.');
  const loginDomains = kioskLoginDomains_();
  if (loginDomains.length && loginDomains.indexOf(email.split('@')[1] || '') === -1) {
    throw new Error('Sign in with your school Google account.');
  }
  return { email: email, name: sanitizeText_(claims.name, 120) };
}

function voicesSessionSecret_() {
  const properties = voicesAuthProperties_();
  let secret = String(properties.getProperty(VOICES_AUTH.SESSION_SECRET_PROPERTY) || '').trim();
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty(VOICES_AUTH.SESSION_SECRET_PROPERTY, secret);
  }
  return secret;
}

function storeKioskAuthHandoff_(handoff) {
  const id = Utilities.getUuid();
  CacheService.getScriptCache().put(
    VOICES_AUTH.HANDOFF_CACHE_PREFIX + id,
    JSON.stringify(handoff),
    VOICES_AUTH.HANDOFF_TTL_SECONDS
  );
  return id;
}

function consumeKioskAuthHandoff_(id) {
  const handoffId = sanitizeText_(id, 100);
  if (!handoffId) return { token: '', error: '' };
  const cache = CacheService.getScriptCache();
  const key = VOICES_AUTH.HANDOFF_CACHE_PREFIX + handoffId;
  const value = cache.get(key);
  cache.remove(key);
  if (!value) {
    return { token: '', error: 'This sign-in attempt expired. Sign in again.' };
  }
  try {
    const handoff = JSON.parse(value);
    return {
      token: sanitizeText_(handoff.token, 5000),
      error: sanitizeText_(handoff.error, 500)
    };
  } catch (error) {
    return { token: '', error: 'This sign-in attempt could not be completed. Sign in again.' };
  }
}

function renderKioskSessionHandoff_(handoffId) {
  const template = HtmlService.createTemplate(
    '<!DOCTYPE html><html><head><base target="_top">' +
    '<style>body{font-family:system-ui,sans-serif;background:#111418;color:#f4f6f8;' +
    'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}</style>' +
    '</head><body><div><p id="message"><?= message ?></p></div>' +
    '<script>\n' +
    'var appUrl = <?= appUrlJson ?>;\n' +
    'window.top.location.href = appUrl + "?voicesAuth=" + encodeURIComponent(<?= handoffJson ?>);\n' +
    '<\/script></body></html>'
  );
  template.message = 'Returning to V.O.I.C.E.S…';
  template.appUrlJson = JSON.stringify(ScriptApp.getService().getUrl());
  template.handoffJson = JSON.stringify(handoffId);
  return template.evaluate()
    .setTitle(VOICES.APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function createVoicesSession_(identity) {
  const payload = {
    v: VOICES_AUTH.SESSION_VERSION,
    email: identity.email,
    name: identity.name || '',
    iat: Date.now(),
    exp: Date.now() + VOICES_AUTH.SESSION_TTL_MS
  };
  const encodedPayload = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return encodedPayload + '.' + signVoicesSessionPayload_(encodedPayload);
}

function signVoicesSessionPayload_(encodedPayload) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(encodedPayload, voicesSessionSecret_())
  );
}

function secureStringsEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function verifyVoicesSession_(token) {
  const segments = String(token || '').split('.');
  if (segments.length !== 2 || !segments[0] || !segments[1]) {
    throw new Error('Sign in with your school Google account to continue.');
  }
  if (!secureStringsEqual_(signVoicesSessionPayload_(segments[0]), segments[1])) {
    throw new Error('This V.O.I.C.E.S session could not be verified. Sign in again.');
  }
  const payload = JSON.parse(
    Utilities.newBlob(Utilities.base64DecodeWebSafe(segments[0])).getDataAsString()
  );
  if (Number(payload.v) !== VOICES_AUTH.SESSION_VERSION) {
    throw new Error('This V.O.I.C.E.S session is out of date. Sign in again.');
  }
  if (!payload.exp || Number(payload.exp) <= Date.now()) {
    throw new Error('This V.O.I.C.E.S session expired. Sign in again.');
  }
  const email = normalizeEmail_(payload.email);
  if (!email) throw new Error('This V.O.I.C.E.S session has no identity. Sign in again.');
  return { email: email, name: payload.name || '', expiresAt: Number(payload.exp) };
}

/**
 * Extends an active shared-device session without a new Google sign-in.
 */
function refreshVoicesSession(token) {
  const session = verifyVoicesSession_(token);
  const staff = requireAuthorizedStaff_(session.email);
  return {
    token: createVoicesSession_({ email: normalizeEmail_(staff.Email), name: staff.Name }),
    expiresInMs: VOICES_AUTH.SESSION_TTL_MS
  };
}

function isCallableVoicesFunction_(functionName) {
  const name = String(functionName || '');
  return VOICES_AUTH.CALLABLE_FUNCTIONS.indexOf(name) !== -1 &&
    typeof globalThis[name] === 'function';
}

/**
 * Runs an application function on behalf of a signed-in shared-device user.
 * Every protected server function resolves its identity through this session
 * instead of the browser's Google account.
 */
function voicesAuthedCall(token, functionName, args) {
  const session = verifyVoicesSession_(token);
  requireAuthorizedStaff_(session.email);
  if (!isCallableVoicesFunction_(functionName)) {
    throw new Error('That V.O.I.C.E.S operation is not available.');
  }
  voicesSessionEmail_ = session.email;
  try {
    return globalThis[functionName].apply(null, Array.isArray(args) ? args : []);
  } finally {
    voicesSessionEmail_ = '';
  }
}
