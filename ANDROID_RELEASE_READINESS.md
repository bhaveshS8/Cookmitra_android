# CookMitra Android — Release Readiness

**Assessment date:** 2026-10-22
**App:** `com.cookmitra` — version `1.0` (`versionCode 1`), minSdk 24, targetSdk 36
**Artifacts inspected:** debug APK, **unsigned** release APK, **unsigned** release AAB
**Device used:** Samsung SM-M127G, Android 13 (API 33), serial `RZ8RA15MNCT`
**Verdict:** ## **NO-GO**

> An unsigned APK is not a release candidate. The build, manifest, and Android-side reset handling are verified; production signing, a live Razorpay key, reset-email server configuration, verified App Links, Google Sign-In, FCM, and the full device E2E suite are not.

---

## 1. Gate table

Status values are exactly `PASS`, `FAIL`, `BLOCKED`, `NOT TESTED`.

| Gate | Status | Evidence | Remaining action | Responsible dependency |
|---|---|---|---|---|
| **Lint** | **PASS** | `npm run lint` → no diagnostics (2026-10-22) | — | — |
| **Unit/integration tests** | **PASS** | `npm test -- --runInBand` → **14 suites / 64 tests passed**, no snapshots | Keep green on every change | — |
| **JavaScript release bundle** | **PASS** | Metro emitted `index.android.bundle` + sourcemap and copied the bundled asset set; AAB contains `base/assets/index.android.bundle` (3,476,744 B) | — | — |
| **Debug build** | **PASS** | `:app:assembleDebug` → `app-debug.apk` 177,268,183 B (12:42); installed on device | — | — |
| **Release build — unsigned diagnostic** | **PASS** | `:app:assembleRelease -x :app:validateReleaseConfig` → `app-release-unsigned.apk` 85,733,057 B (13:04); `:app:bundleRelease -x …` → `app-release.aab` 61,795,402 B (12:56) | Produce signed artifacts once credentials exist | — |
| **Release build — official (guard enabled)** | **FAIL** | `:app:validateReleaseConfig` fails: *“Release RAZORPAY_KEY_ID must be a live Razorpay public key (rzp_live_...)”*. API and web origin checks pass. | Set `RAZORPAY_KEY_ID` to the same live public key the backend uses | Product owner / Razorpay account |
| **Production signing** | **BLOCKED** | All four `COOKMITRA_RELEASE_*` env vars are **UNSET**; only `android/app/debug.keystore` exists; `apksigner verify` → **DOES NOT VERIFY / Missing META-INF/MANIFEST.MF** | Create/obtain the upload keystore, supply the four values, rebuild, verify the certificate | Owner + Play Console (App Signing) |
| **Packaged manifest security** | **PASS** | From the **release APK**: `usesCleartextTraffic="false"`, `allowBackup="false"`, `fullBackupContent="false"`, `dataExtractionRules` present, no `debuggable`, `android:path="/reset-password"` (no `pathPrefix`), no `SYSTEM_ALERT_WINDOW`; 12 permissions reviewed | Re-verify after signing (same manifest expected) | — |
| **Authentication & booking ownership** | **PASS** | Code/test evidence: `normalizeUser` mirrors `id → _id`; drafts scoped by `ownerId`; `clientKey` idempotency; server re-checks ownership on every mutation; 64 tests pass. Device account-switch flow not executed. | Device-level account-switch test in E2E-03 | — |
| **Password-reset — Android link handling** | **PASS** | **Device:** cold start from `cookmitra://…` and from `https://cookmitra.org/reset-password?token=bad-token` both open the reset screen; malformed token → safe message with **no** password fields; unknown 64-hex token → live API 400 → “This reset link is invalid or has expired.”; token absent from logcat/app storage | Re-run with a real token after the server fix | — |
| **Password-reset — e-mail delivery** | **FAIL** | Production env has `NODE_ENV=production`, `FRONTEND_BASE_URL`/`FRONTEND_URL` **absent**, `CLIENT_URL` empty → `resolveFrontendBaseUrl()` returns `""` → `appBase` = `http://localhost:3000` → `sendResetEmail` **refuses** (`reset-base-not-configured`). SMTP *is* configured, so one variable is the gap. | Set `FRONTEND_BASE_URL=https://cookmitra.org` on the deployed backend and restart; send a real reset e-mail and tap it | Backend deployment owner |
| **Verified Android App Links** | **BLOCKED** | No `autoVerify`; `https://cookmitra.org/.well-known/assetlinks.json` is not published. Intent resolution on device works (chooser), but linking is **not verified**. | Publish `assetlinks.json` with the real signing SHA-256, then verify with `adb shell pm get-app-links com.cookmitra` | Hosting/DNS owner + signing certificate |
| **Razorpay — client/server contract** | **PASS** | Server creates the order and returns `orderId`/`amount`/`currency`/`keyId`; client opens checkout with the server order and **never** marks the booking paid; HMAC signature, amount and captured-payment re-checks, atomic paid-claim, `alreadyPaid`/409 recovery, persisted proof | — | — |
| **Razorpay — device validation** | **BLOCKED** | No test-mode key in the app env; no approved test merchant/account on the device. No charge may be made with the live account. | Create a Razorpay **test** account/key, run E2E-07 on a device, then repeat one low-value live check before launch | Product owner + Razorpay |
| **Google Sign-In** | **BLOCKED** | Backend `/auth/google` is live and validating (invalid ID token → **401 “Invalid Google token”**, verified this pass). No Android OAuth client, no SHA-1 registration, no SDK, no UI. | Runbook §8: Android OAuth client + SHA-1, add the SDK, wire the ID token, test | Google Cloud project owner |
| **FCM / push** | **BLOCKED** | No Firebase dependency, no `google-services.json`, **no backend device-token endpoint** (`fcm|firebase|push|apns|deviceToken|pushToken|web-push` → 0 matches). In-app notifications + SSE are the working path. | Implement the backend token contract (runbook §9), then the Android integration | Backend owner + Firebase project owner |
| **Physical-device end-to-end (11 scenarios)** | **NOT TESTED** | Only E2E-01 (startup) and E2E-08 (reset link handling) were executed on device; E2E-02…07 and 09–11 were not. | Execute runbook §11 with test accounts and a signed build | QA + test accounts |
| **API health** | **PASS** | `GET https://cookmitra.org/api/health` → **200** `{"status":"ok","db":"connected"}`; `POST /auth/forgot-password` → 200 generic (no enumeration); `POST /auth/google` (bad token) → 401 | — | — |
| **Production configuration (reset base URL)** | **FAIL** | `FRONTEND_BASE_URL`/`FRONTEND_URL` absent and `CLIENT_URL` empty while `NODE_ENV=production` → reset e-mails are refused | Set `FRONTEND_BASE_URL=https://cookmitra.org` and restart | Backend deployment owner |

---

## 2. Why the verdict is NO-GO

1. **No signed artifact.** The only release outputs are unsigned. `apksigner` confirms no signature. Nothing here can be published or upgraded.
2. **No live Razorpay key in the app**, so the official release path fails its own guard before packaging.
3. **No payment proof on a device.** A green build is not payment correctness.
4. **Password-reset e-mail is currently undeliverable in production** (missing `FRONTEND_BASE_URL`), and the App Link is unverified.
5. **Two integrations requested for the release are absent** (Google Sign-In, FCM), and FCM additionally lacks a backend token endpoint.
6. **The 11-scenario device suite is not complete.** Only startup and reset-link handling were executed.

None of these is a source-level defect in this repository's control. They are credentials, server configuration, provider setup, and test execution.

---

## 3. What is actually proven

| Proven | How |
|---|---|
| The app compiles, packages, and runs | Debug build installed and launched 20+ times; release APK/AAB produced |
| The release manifest is locked down | Read from the packaged release APK, not from source |
| The release bundle is present and complete | AAB contains `base/assets/index.android.bundle` (3,476,744 B) plus the compiled drawables (`assets_logo.jpg`, hero, carousels, navigation icons) |
| Deep links are parsed correctly on a **cold** start | Real `am start` intents on a physical device |
| The reset screen fails safely | Malformed token, unknown token, live 400 response |
| The intent filter is scoped | `query-activities` positive and negative cases |
| Reset secrets are not persisted or logged | logcat + app-private storage search |
| The backend auth contract is live | health 200, google 401, forgot-password 200 |
| Identity/ownership/idempotency logic | 63 passing tests including the D-01 regression |

---

## 4. Shortest path to GO

Do these in order; each item maps to a gate above.

1. **Backend:** set `FRONTEND_BASE_URL=https://cookmitra.org` in the production environment and restart. Trigger a reset for a real test mailbox; confirm the link is `https://cookmitra.org/reset-password?token=…`. → fixes the reset-delivery gate.
2. **Signing:** create or obtain the upload keystore; configure the four `COOKMITRA_RELEASE_*` values; run `:app:validateReleaseConfig` then `:app:assembleRelease`; verify with `apksigner verify --print-certs`.
3. **Razorpay:** put the **test** key in `.env` for a debug build, run E2E-07, then put the **live** public key (same account as the backend) in the release env.
4. **App Links:** publish `assetlinks.json` with the **release** signing SHA-256; add `autoVerify` once verified; run `pm get-app-links`.
5. **Google Sign-In:** create the Android OAuth client for `com.cookmitra` + release SHA-1, integrate the SDK, pass the **web** client ID as `webClientId`, test.
6. **FCM:** implement the backend token endpoints (runbook §9), add Firebase, test foreground/background/terminated.
7. **E2E:** execute all 11 scenarios on the signed build with test accounts; attach redacted evidence.
8. Flip this document to **GO** only when every row above is `PASS` with evidence.

---

## 5. Current configuration snapshot

`frontend/.env` (values are baked at build time — changing them requires a rebuild):

```text
API_BASE_URL=https://cookmitra.org/api
WEB_ORIGIN=https://cookmitra.org
RAZORPAY_KEY_ID=            # empty -> validateReleaseConfig FAIL
```

Signing environment: all four `COOKMITRA_RELEASE_*` values **UNSET**.

Backend production env (inspected, **values not disclosed**):

```text
NODE_ENV=production
FRONTEND_BASE_URL=ABSENT
FRONTEND_URL=ABSENT
CLIENT_URL=(empty)
SMTP_HOST=SET   SMTP_USER=SET
GOOGLE_CLIENT_ID=SET
RAZORPAY_KEY_ID=rzp_live_… (live key present)
```

`backend/.env` (secondary, development): `NODE_ENV=development`, `CLIENT_URL=http://localhost:3000`.

Consequence: `resolveFrontendBaseUrl()` filters out empty candidates, finds none, returns `""`; the mailer then uses `http://localhost:3000` and its production guard refuses to send. This is a **configuration** fix, not a code change.

---

## 6. Residual risks accepted for launch (after the gates above)

| Risk | Mitigation |
|---|---|
| Reset App Link may open in a browser until `assetlinks.json` is live | Token is single-use, 1-hour, server-validated; web fallback is functional |
| R8/ProGuard disabled (`enableProguardInReleaseBuilds = false`) | Post-launch hardening with a full device smoke run |
| `versionCode 1` | Increment on every upload |
| Library-provided permissions (`NFC`, biometric, Wi-Fi state, basic phone state) | Review against store policy; they come from Razorpay/keychain/NetInfo |
| Payment proof can be lost if the process dies at the wrong instant | Server webhook reconciliation; local proof is never authoritative |

---

## 7. Artifact manifest (unsigned diagnostics)

| Artifact | Path | Size | SHA-256 |
|---|---|---|---|
| Release APK (**unsigned**) | `frontend\android\app\build\outputs\apk\release\app-release-unsigned.apk` | 85,733,057 B | `22735DCF38487BA05C1FC3FD21941FD493BF8D808205D89CCE27C4633A2B0809` |
| Release AAB (**unsigned**) | `frontend\android\app\build\outputs\bundle\release\app-release.aab` | 61,795,402 B | `A1827E0D33AEB57B611A190B7645937D552713645F5EF27D8A76ED1C6D133BAA` |

Neither artifact is signed; neither is distributable. Re-hash after the signed build.

> **Post-audit change (device location):** the diagnostics above were produced before the location-detection fix (Android 12+ permission request, approximate-location fallback, services-off handling, auto-detect on entry). Their hashes no longer describe the current tree; rebuild both artifacts and re-hash before using this manifest for a release decision.

---

## 8. Sign-off block

| Role | Name | Decision | Date |
|---|---|---|---|
| Android engineering | — | Code hardening complete for reviewed scope | 2026-10-22 |
| Security | — | No P0 code defect open; deployment/config gates open | 2026-10-22 |
| Release management | — | **NO-GO** — unsigned, unverified integrations | 2026-10-22 |
