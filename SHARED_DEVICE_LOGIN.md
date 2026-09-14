# Shared-device (tablet) sign-in setup

On a shared tablet, one dedicated Google account passes the Apps Script gateway and
V.O.I.C.E.S then asks each staff member to sign in with their own school Google
account. Google service calls (Sheets, Drive, Docs, Mail) keep running as the
deploying owner, so staff never grant data permissions. Phones are unaffected and
are never signed out of Google.

## 1. Create the OAuth client

1. Open the Apps Script project, then **Project Settings → Google Cloud Platform (GCP) project**
   and note the project number; open that project in the Google Cloud console.
2. **APIs & Services → OAuth consent screen**: internal (Workspace) user type, add the
   `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile` scopes only.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Add this authorized redirect URI, using the script ID from **Project Settings**:

   ```
   https://script.google.com/macros/d/SCRIPT_ID/usercallback
   ```

5. Copy the client ID and client secret.

## 2. Configure script properties

In **Project Settings → Script properties** add:

| Property | Value |
| --- | --- |
| `VOICES_OAUTH_CLIENT_ID` | the OAuth client ID |
| `VOICES_OAUTH_CLIENT_SECRET` | the OAuth client secret (never commit it) |
| `VOICES_LOGIN_DOMAINS` | `hbuhsd.edu` |

`VOICES_SESSION_SECRET` is generated automatically on first sign-in. Leaving the
client ID or secret unset simply keeps shared-device sign-in disabled; the app keeps
working normally on phones.

## 3. Deploy and enroll the tablet

1. Deploy a **new version** of the web app, keeping **Execute as: me** and
   **Who has access: anyone within the domain**.
2. Sign the tablet's browser in to the dedicated kiosk Google account (a normal
   domain account used only for this device).
3. Open the web app URL once with `?voicesKiosk=1`, then create the home-screen
   shortcut from the V.O.I.C.E.S sign-in screen. The device stays in kiosk mode
   afterwards; `?voicesKiosk=0` turns it off.

## 4. What happens on the tablet

- Each launch shows the V.O.I.C.E.S sign-in screen, not an automatic entry.
- Signing in opens Google's account chooser; the code is exchanged server side and
  the returned identity is checked against the active `Staff` list.
- A signed session lasting 30 minutes is stored for the browser tab only, and every
  server call runs under that verified identity.
- **Lock**, the 30-minute idle lock, and closing the tab all clear the session
  without signing the device out of Google.

Google asks for a password only when the chosen account is not already signed in to
that browser, so keep the kiosk account as the only account signed in on the tablet.
