# CookMitra Android — Release Runbook

Operational instructions for producing, verifying, and shipping the CookMitra Android app.

**All paths are absolute on the build machine used for this audit.**

| Item | Value |
|---|---|
| Android workspace | `C:\Users\bhave\OneDrive\Desktop\CookMitra` |
| React Native project | `C:\Users\bhave\OneDrive\Desktop\CookMitra\frontend` |
| Gradle project | `...\frontend\android` |
| Application ID | `com.cookmitra` |
| Backend (read-only here) | `H:\Festive_Cook` |
| Production API | `https://cookmitra.org/api` |
| Production web origin | `https://cookmitra.org` |
| Reset path | `/reset-password?token=<64 lowercase hex>` |

**Rule:** never commit a keystore, password, service-account JSON, or `.env` containing secrets. Never paste secret values into build logs, tickets, or this document.

---

## 1. Preconditions

From `...\frontend`:

```powershell
node --version
npm --version
cd android
.\gradlew.bat --version
```

Required: JDK 17+, Android SDK with build-tools 37.0.0, `adb` on `PATH`, and a device or emulator (`adb devices`).

Sanity gate before any release work:

```powershell
cd C:\Users\bhave\OneDrive\Desktop\CookMitra\frontend
npm run lint
npm test -- --runInBand
```

Both must pass (currently 14 suites / 64 tests).

---

## 2. Configure production API URLs

The app reads `.env` through `react-native-config` **at build time**. Editing `.env` after a build changes nothing; rebuild.

```powershell
cd C:\Users\bhave\OneDrive\Desktop\CookMitra\frontend
notepad .env
```

Required values:

```text
API_BASE_URL=https://cookmitra.org/api
WEB_ORIGIN=https://cookmitra.org
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxxxxxxxxx
```

Rules enforced by `:app:validateReleaseConfig`:

- `API_BASE_URL` must be exactly `https://cookmitra.org/api`. `WEB_ORIGIN` must start with `https://`, be longer than 8 characters, contain no spaces, and must not match localhost, `127.0.0.1`, `10.x`, `192.168.x`, `172.16–31.x`, `example.com`, or `.invalid`.
- `RAZORPAY_KEY_ID` must start with `rzp_live_`.

Verify what actually got baked in:

```powershell
Get-Content .\android\app\build\generated\source\buildConfig\release\com\cookmitra\BuildConfig.java -ErrorAction SilentlyContinue
Get-Content .\android\app\build\generated\res\resValues\release\gradleResValues.xml -ErrorAction SilentlyContinue
```

Use `ENVFILE` only if you keep a separate release env file — and confirm the file exists; a missing file must never be allowed to fall back silently.

---

## 3. Production signing

### 3.1 The four values

`android/app/build.gradle` reads exactly these names (Gradle property **or** environment variable):

```text
COOKMITRA_RELEASE_STORE_FILE       absolute path to the .jks/.keystore
COOKMITRA_RELEASE_STORE_PASSWORD   keystore password
COOKMITRA_RELEASE_KEY_ALIAS        key alias
COOKMITRA_RELEASE_KEY_PASSWORD     key password
```

Behaviour:

- None set → release build is **unsigned** (no debug fallback).
- Some but not all set → Gradle fails with *“Incomplete release signing config”*.
- Store file missing → Gradle fails before packaging.
- All four set → `signingConfigs.release` is created and used.

### 3.2 Upload key vs Play App Signing

If the app is distributed through Google Play with **Play App Signing**:

- The `.jks` you hold is the **upload key**. Google re-signs the distributed APK with the **app-signing key** held by Play.
- `assetlinks.json` (see §5) must contain the **app-signing certificate** SHA-256 from *Play Console → Release → Setup → App signing*, **not** the upload key.
- If you also sideload or use internal app sharing, register the upload certificate as a second entry in `assetlinks.json` (the file accepts multiple fingerprints).

### 3.3 Create a keystore (only if one does not already exist)

```powershell
keytool -genkeypair -v `
  -keystore C:\secure\cookmitra-upload.jks `
  -alias cookmitra-upload `
  -keyalg RSA -keysize 4096 -validity 10000
```

Store it outside the repository, back it up in a secrets manager, and record the passwords there — not here.

### 3.4 Supply the values for one build session

```powershell
$env:COOKMITRA_RELEASE_STORE_FILE     = "C:\secure\cookmitra-upload.jks"
$env:COOKMITRA_RELEASE_STORE_PASSWORD = "<from secret store>"
$env:COOKMITRA_RELEASE_KEY_ALIAS      = "cookmitra-upload"
$env:COOKMITRA_RELEASE_KEY_PASSWORD   = "<from secret store>"
```

CI: define them as masked secret variables with the same names. Never echo them.

### 3.5 Validate, build, verify

```powershell
cd C:\Users\bhave\OneDrive\Desktop\CookMitra\frontend\android
.\gradlew.bat :app:validateReleaseConfig
.\gradlew.bat :app:assembleRelease
.\gradlew.bat :app:bundleRelease
```

Run APK and AAB packaging as **separate** invocations (a combined run has produced a transient file-contention failure).

Verify:

```powershell
$apk = "app\build\outputs\apk\release\app-release.apk"
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\apksigner.bat" verify --print-certs $apk
& "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\20.0\bin\apkanalyzer.bat" manifest application-id $apk
& "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\20.0\bin\apkanalyzer.bat" manifest version-name $apk
```

Expected: `Verified using v1/v2/v3` (as applicable), certificate DN = your release key, package `com.cookmitra`.

If `apksigner` prints `DOES NOT VERIFY`, the build is unsigned: **stop**, do not distribute.

Increment `versionCode` in `android/app/build.gradle` before every Play upload.

---

## 4. Password-reset e-mail URLs (backend configuration — do not edit here)

The backend builds the link as:

```text
${resolveFrontendBaseUrl()}/reset-password?token=${token}
```

`resolveFrontendBaseUrl()` checks, in order, `FRONTEND_BASE_URL`, `FRONTEND_URL`, `CLIENT_URL`; trims, strips a trailing slash, takes the first comma-separated entry, and prefers any non-localhost candidate. If all are empty it returns `""`.

### 4.1 Current production state (as inspected)

```text
NODE_ENV=production
FRONTEND_BASE_URL  ABSENT
FRONTEND_URL       ABSENT
CLIENT_URL         empty
SMTP_HOST / SMTP_USER  SET
```

Result: the base falls back to `http://localhost:3000`, and `sendResetEmail` refuses to send in production (`reset-base-not-configured`). **Reset e-mail delivery is broken until this is fixed.**

### 4.2 Fix

On the deployed backend environment:

```text
FRONTEND_BASE_URL=https://cookmitra.org
```

Then restart/redeploy the service. `CLIENT_URL` does not need to change, but do not set it to a value that could shadow the correct one.

### 4.3 Verify

1. `POST /api/auth/forgot-password` with a real test mailbox.
2. Open the received e-mail; the link must be exactly `https://cookmitra.org/reset-password?token=<64 hex>`.
3. Tap it on the device and complete a reset.
4. Re-use the same link — it must be rejected (single use, 1-hour expiry).
5. Check backend logs for `CONFIG ERROR: reset-email link would point at localhost` — must be absent.

**Do not mark the gate passed until a real e-mail arrives and a real token succeeds.**

---

## 5. Android App Links (`assetlinks.json`)

Current manifest filter (unverified — no `autoVerify`):

```xml
<data android:scheme="https" android:host="cookmitra.org" android:path="/reset-password" />
```

Publish `https://cookmitra.org/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.cookmitra",
      "sha256_cert_fingerprints": [
        "<PLAY_APP_SIGNING_SHA256>",
        "<UPLOAD_KEY_SHA256>"
      ]
    }
  }
]
```

Get fingerprints:

```powershell
keytool -list -v -keystore C:\secure\cookmitra-upload.jks -alias cookmitra-upload
# or, from the built APK:
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\apksigner.bat" verify --print-certs app\build\outputs\apk\release\app-release.apk
```

Format: uppercase hex **with** colons, e.g. `AA:BB:…` exactly as printed.

Requirements:

- Served over HTTPS, HTTP 200, `Content-Type: application/json`, **no redirect**, no authentication.
- Valid JSON, correct package name, fingerprint of the **distributed** certificate.
- After publishing, add `android:autoVerify="true"` to the intent filter, rebuild, and verify:

```powershell
adb shell pm verify-app-links --re-verify com.cookmitra
adb shell pm get-app-links com.cookmitra
```

`get-app-links` must show `verified` for `cookmitra.org`. Until then the link opens a chooser (still functional, just not verified).

---

## 6. Razorpay sandbox tests

The backend creates the order and returns `orderId`, `amount` (paise), `currency`, `keyId`. The client must pass the server order to checkout and must never set payment state itself.

1. Use a **test** account: backend `RAZORPAY_KEY_ID=rzp_test_…`, app `.env` `RAZORPAY_KEY_ID=rzp_test_…` (debug build only).
2. Build and install the debug APK.
3. Run the cases in E2E-07 below.
4. Confirm the server, not the client, flips the booking to `confirmed`; confirm `payment.razorpayPaymentId`/`signature` persisted.

**Never** run these cases against the live key with real money. A final live check, if required, is one low-value real payment performed by the owner with a refund.

`validateReleaseConfig` rejects `rzp_test_` for release builds — that is intentional; use debug for test keys.

---

## 7. Install and validate a release artifact

```powershell
adb devices
adb install -r app\build\outputs\apk\release\app-release.apk
adb shell am start -n com.cookmitra/.MainActivity
adb logcat -c
adb logcat | Select-String "FATAL|AndroidRuntime|ReactNativeJS"
```

Checks:

```powershell
$apk = "app\build\outputs\apk\release\app-release.apk"
$aa  = "$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\20.0\bin\apkanalyzer.bat"
& $aa manifest print $apk | Select-String "usesCleartextTraffic|allowBackup|dataExtractionRules|debuggable|/reset-password"
& $aa manifest permissions $apk
& "$env:LOCALAPPDATA\Android\Sdk\build-tools\37.0.0\apksigner.bat" verify --print-certs $apk
```

Must show: cleartext `false`, backup `false`, no `debuggable`, reset path present, expected certificate, no `SYSTEM_ALERT_WINDOW`.

A release build cannot be installed if unsigned. If you need an installable diagnostic build before signing exists, sign the unsigned APK with the **debug** key **for local smoke only** and label it clearly as such — never distribute it and never treat it as release evidence.

---

## 8. Google Sign-In

### 8.1 Backend contract (already implemented, verified live)

- Endpoint: `POST /api/auth/google`
- Body: `{ "idToken": "<Google ID token>", "role": "CUSTOMER" | "COOK" }` (role handling per existing controller)
- Audience expected: `GOOGLE_CLIENT_ID` — the **web** client ID.
- Invalid token → `401 {"message":"Invalid Google token. Please try again."}` (verified 2026-10-22).
- Missing server config → `500 "Google sign-in is not configured on the server"`.

So the app must send an **ID token**, not an access token or auth code.

### 8.2 Google Cloud setup

1. Project → APIs & Services → Credentials → **Create OAuth client ID → Android**.
2. Package name: `com.cookmitra`.
3. SHA-1: from the **release** keystore (and a second client for the debug keystore if developers need it).
   ```powershell
   keytool -list -v -keystore C:\secure\cookmitra-upload.jks -alias cookmitra-upload | Select-String "SHA1"
   ```
4. Ensure a **Web application** OAuth client exists; its client ID is the backend `GOOGLE_CLIENT_ID`.
5. OAuth consent screen: app name, support e-mail, scopes `openid`, `email`, `profile`; add test users if the app is in testing.

### 8.3 Android integration checklist

1. Add a single SDK dependency compatible with RN 0.87 / Gradle 9.4.1 (e.g. `@react-native-google-signin/google-signin` at a version that supports the new architecture).
2. `GoogleSignin.configure({ webClientId: "<WEB_CLIENT_ID>", offlineAccess: false })`.
3. On button press: `signIn()` → `GoogleSignin.getTokens()` → send `idToken` to `/auth/google`.
4. Normalize the response with the existing `normalizeUser` + `saveSession` path so the session behaves exactly like password login.
5. Handle: cancellation (no error toast), missing config (hide/disable the button), network error, 401 from backend, role mismatch.
6. Ensure logout clears the Google session (`GoogleSignin.signOut()`).

**Do not** ship a Google button that cannot work. Until the Android client and SHA-1 exist, the button must stay hidden/disabled.

Acceptance: sign-in succeeds on device, backend validates the token, the app lands in the correct role home, cancellation is silent, and a tampered token is rejected.

---

## 9. FCM and the missing backend contract

### 9.1 Current state

No Firebase dependency, no `google-services.json`, no notification permission handling beyond what RN provides, and **no backend device-token registration endpoint**. In-app notifications and SSE are the working path and must not be replaced by a half-configured FCM integration.

### 9.2 Required backend contract (to be implemented by the backend owner)

| Endpoint | Method | Auth | Body | Behaviour |
|---|---|---|---|---|
| `/api/notifications/devices` | POST | Bearer JWT | `{ token, platform: "android", appVersion }` | Upsert by `(token)`; bind to `req.user._id`; return 204 |
| `/api/notifications/devices` | DELETE | Bearer JWT | `{ token }` | Remove the token **only if it belongs to the caller**; 204 |
| `/api/notifications/devices` | DELETE | Bearer JWT | — | Remove all tokens for the caller (logout) |

Rules:

- A token may be bound to exactly one user; re-registering it for another user must reassign it only after authenticating as that user.
- Idempotent upsert; duplicate registration is a no-op.
- On send, FCM error `messaging/registration-token-not-registered` or `invalid-argument` → delete the token.
- Tokens are secrets: never returned in API responses, never logged.
- Tests: 401 without auth, cross-user deletion rejected, upsert idempotent, logout revokes, invalid-token cleanup.

### 9.3 Android steps (after the backend exists)

1. Add `google-services.json` for `com.cookmitra` (never commit if policy forbids; use CI secret).
2. Add the Firebase Gradle plugin and messaging dependency matching RN 0.87.
3. Create channels (e.g. `bookings`, `payouts`, `account`) at startup.
4. Request `POST_NOTIFICATIONS` on Android 13+ (minSdk 24) **in context**, after login.
5. Register the token after login; re-register on `onTokenRefresh`; delete on logout.
6. Foreground: show an in-app banner or a local notification — do **not** duplicate the SSE event.
7. Background/terminated: notification tap → deep link to the target screen.
8. Never put OTPs, prices, addresses, or names in the notification payload; use IDs and fetch details after auth.

Acceptance: foreground, background, and terminated delivery each verified; tap lands on the right screen; logout stops delivery to that device.

---

## 10. Capturing redacted evidence

For every scenario record:

- Date/time, app version, `versionCode`, commit/build hash.
- Device model, Android version, API level, serial (or "emulator").
- Build type (debug/unsigned/signed) and **certificate fingerprint** (safe to disclose).
- Commands run and their actual output.
- Screenshots with tokens, e-mails, phone numbers, and payment IDs masked.
- Log excerpts with `Bearer`, `token=`, `razorpay_signature`, e-mail addresses, and phone numbers removed.

Never attach: keystore, passwords, service-account JSON, full JWTs, full reset tokens, customer PII.

---

## 11. End-to-end scenarios

Legend: **PASS** / **FAIL** / **BLOCKED** / **NOT TESTED**. Current status from the 2026-10-22 pass is in the last column.

| ID | Scenario | Preconditions | Steps | Expected | Current |
|---|---|---|---|---|---|
| E2E-01 | Fresh install & launch | Signed APK | `adb install -r`, launch | No crash, correct API host, login/welcome renders | **PASS** (debug build installed, launched 20+ times, no crash) |
| E2E-02 | Register / login / logout / restore | Test customer account | Register, logout, log in, kill and relaunch, log out | Validation messages correct; session restored after restart; logout clears it | **NOT TESTED** (no test account authorized) |
| E2E-03 | Booking ownership | Two test accounts | Start a draft on A, expire/switch to B, open Book | B never sees A's draft; A resumes it | **NOT TESTED** (unit-tested only) |
| E2E-04 | Booking lifecycle | Test customer, available cook | Search → slot → address → confirm | Server-authoritative status; no duplicates on retry | **NOT TESTED** |
| E2E-05 | Cancellation / refund | Confirmed booking | Open cancel, choose reason, preview, confirm | Correct fee preview; backend status matches | **NOT TESTED** |
| E2E-06 | Cook assignment & OTP | Assigned cook + customer | Cook starts service with customer's OTP | Wrong OTP rejected + lockout; correct OTP starts service; no legacy arrival call | **NOT TESTED** |
| E2E-07 | Payment lifecycle | Razorpay **test** key | Success, cancel, failure, bad signature, amount mismatch, duplicate callback, network drop, app kill mid-checkout, reopen paid booking, retry | Only server-verified success marks paid; cancel/failure recoverable; no double charge | **BLOCKED** (no test key) |
| E2E-08 | Password reset | Real mailbox, `FRONTEND_BASE_URL` set | Request reset → open e-mail link on device → set password → reuse link | Link opens app reset screen; valid token succeeds; reused/expired rejected | **BLOCKED** (link handling, malformed/unknown-token rejection and the live 400 path PASS on device; no real e-mail could be delivered) |
| E2E-09 | Google Sign-In | Android OAuth client + SHA-1 | Sign in, cancel, tamper token, backend reject | Success normalizes user; cancel silent; tampered rejected | **BLOCKED** (not integrated) |
| E2E-10 | Notifications | SSE (always) + FCM (if configured) | Trigger booking event; background the app; tap notification | SSE delivered once; FCM in foreground/background/terminated; no duplicates; deep link correct | **NOT TESTED** (FCM absent, SSE needs two sessions) |
| E2E-11 | Release security & stability | Signed release APK | Inspect manifest, rotate device, kill/relaunch, background for 30 min | No debug flag, no cleartext, no crash, session intact | **NOT TESTED** (manifest verified statically on the unsigned APK; signed-build runtime unavailable) |

---

## 12. Halt / rollback

Halt the release immediately if any of these is observed:

- `apksigner` does not verify the artifact.
- `validateReleaseConfig` fails.
- Cleartext traffic, `debuggable`, or `allowBackup=true` appears in the packaged manifest.
- Any payment can be marked paid without server verification.
- A reset link opens a different account or a token can be reused.
- A crash occurs on launch of the signed build.

Actions:

1. Do not upload. If already uploaded to a testing track, **halt the rollout** in Play Console.
2. Keep the last known-good signed artifact and its certificate fingerprint.
3. If a signing key is suspected compromised: rotate the upload key via Play Console, update `assetlinks.json`, and re-verify App Links.
4. If secrets were exposed in logs: rotate the Razorpay key, SMTP credentials, JWT secret, and Google client secret (backend) before resuming.
5. Record the incident, the evidence, and the gate that failed in `ANDROID_RELEASE_READINESS.md`.
