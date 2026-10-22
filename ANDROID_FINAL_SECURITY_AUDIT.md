# CookMitra Android — Final Security Audit

**Audit date:** 2026-10-22 (release-closure pass)
**Android workspace:** `C:\Users\bhave\OneDrive\Desktop\CookMitra`
**Reference backend/website:** `H:\Festive_Cook` (read-only, `master` @ `1319a59`)
**Audit type:** Source/config audit, contract tracing against the live backend, packaged-artifact inspection, and **physical-device** verification
**Production-ready:** **No** — code hardening is complete for the reviewed scope; release gates remain blocked on credentials, server configuration, and one provider integration set (see §7).

---

## 1. Scope and repository boundaries

| Repository | Access | State recorded before and after this pass |
|---|---|---|
| `C:\Users\bhave\OneDrive\Desktop\CookMitra` | writable | **Not a Git repository.** `git rev-parse --is-inside-work-tree` fails at the root and at `frontend/`. There is therefore no branch, commit, or `git status` baseline to preserve; scope was controlled by editing only the files listed in §6. |
| `H:\Festive_Cook` | **read-only** | Git repo, `master` @ `1319a59`. Pre-existing user changes (10 modified `frontend/src/**` files + 2 untracked files) were present before this pass and are **unchanged after it** (verified in §9). |

Nothing in `H:\Festive_Cook` was edited, formatted, generated into, or committed. No backend change was required for any Android-side fix; the one server-side prerequisite (reset e-mail base URL) is documented as an external action, not implemented.

---

## 2. Method and evidence levels

Every claim below is labelled with how it was established:

| Level | Meaning |
|---|---|
| **Source** | Read in the repository. |
| **Test** | Executed by the Jest/ESLint suite in this pass. |
| **Artifact** | Read back from the built APK/AAB, not from source. |
| **Device** | Executed on a connected physical device (`SM-M127G`, Android 13 / API 33, serial `RZ8RA15MNCT`). |
| **Live API** | Called `https://cookmitra.org/api` directly. |
| **Not tested** | Outside the available environment. Explicitly not a pass. |

No test result is inferred. Where a check could not run, it is marked **BLOCKED** or **NOT TESTED** with the reason.

---

## 3. Audited security controls

| Area | Control | Result | Evidence |
|---|---|---|---|
| Token storage | Persistent JWT in Android Keystore, never in plaintext prefs | PASS | **Source** `src/services/session.js` (`react-native-keychain`, service `com.cookmitra.session`); user profile/drafts in AsyncStorage with no token |
| Token in logs | No token/password written to logcat or stored | PASS | **Device** searched 6,000 logcat lines and app-private storage for the reset token and the entered password — zero matches outside `adbd` command echo; **Source** no `console.*` in `src/` |
| Session revocation | Logout is durable even if Keystore reset fails | PASS | **Source** `session-revoked` tombstone written before the reset, removed only after success |
| Session expiry | 401/403 clears storage **and** Redux so protected routes unmount | PASS | **Source** `src/api/client.js` interceptor + `Root.js` `setAuthResetter`; wrong-current-password 401 exempted |
| Refresh tokens | Contract matches backend | PASS | **Source** backend has **no** refresh-token endpoint (`refreshToken|refresh_token|/auth/refresh` → 0 matches); client does not invent one |
| Identity normalization | Backend `id` and app `_id` agree everywhere | **PASS (fixed earlier, re-verified)** | **Source** `normalizeUser` mirrors `id → _id`; **Test** `authStore.test.js` |
| Booking draft isolation | Draft cannot cross accounts | PASS | **Source** draft always written with `ownerId`; restore clears on mismatch; **Test** owner id normalization |
| Booking idempotency | Retry cannot duplicate a booking | PASS | **Source** client key persisted before the network call; backend enforces unique `(clientKey, customer)`; **Test** `bookingAttempt.test.js` |
| Payment authority | Only the server marks a booking paid | PASS | **Source** HMAC-SHA256 signature, order-amount re-check, captured-payment re-check, atomic `findOneAndUpdate`; client never sets `payment.status` |
| Payment recovery | Interrupted checkout is recoverable without a second charge | PASS | **Source** proof persisted before verification; `alreadyPaid`/409 handled as success; **Test** `session.test.js` pending-payment lifecycle |
| OTP service start | No client bypass; cook never sees the OTP | PASS | **Source** `PATCH /bookings/:id/start-service` requires cook ownership + 4-digit OTP + lockout; `stripServiceOtp` for non-customers |
| Booking authorization | Route access ≠ data access | PASS | **Source** authenticated routes only registered when `token && user`; backend re-checks ownership (`getBookingById`, `cancelBooking`, `startService`) |
| Refund/cancellation codes | Client enums match backend enums | PASS | **Source** `bookingActions.js` vs `utils/cancellationPolicy.js` and `refundController.js` |
| Cleartext transport | Release blocks HTTP | PASS | **Artifact** `android:usesCleartextTraffic="false"` in the packaged release APK |
| Backup / transfer | No app data in cloud backup or device transfer | PASS | **Artifact** `allowBackup="false"`, `fullBackupContent="false"`, `dataExtractionRules` present |
| Debuggability | Release is not debuggable | PASS | **Artifact** no `debuggable` attribute; `SYSTEM_ALERT_WINDOW` absent from the release permission set |
| Export surface | Only the launcher activity is exported | PASS | **Test** manifest guard asserts exactly one `android:exported="true"`; **Artifact** review |
| Deep-link scoping | Only the intended host/path opens the app | **PASS (hardened this pass)** | **Device** `cmd package query-activities` results in §5 |
| Reset-token validation | 64-hex only; malformed rejected before any network call | PASS | **Test** `passwordReset.test.js`; **Device** malformed link shows an error and **no password fields** |
| Asset integrity | Bundled image bytes match their extension | **PASS (new gate)** | **Test** `releaseGuards.test.js` + `src/utils/assetIntegrity.js`; **Artifact** `assets_logo.jpg` in generated release resources |
| Build-time secrets | No signing/backend secrets in the APK | PASS | **Artifact** permission/manifest review; signing values are read from Gradle properties/env only |
| Release guard | Dev/LAN/placeholder endpoints cannot ship | PASS (fails closed) | **Build** `validateReleaseConfig` rejects the current empty Razorpay key; API/web origin pass |
| WebView | No unrestricted WebView | PASS | **Source** zero `WebView` usage in `src/` |

---

## 4. Findings in this pass

### D-06 (MEDIUM) — the reset App Link claimed look-alike paths

**Defect.** The intent filter used `android:pathPrefix="/reset-password"`. `pathPrefix` matches by prefix, so `https://cookmitra.org/reset-password-help`, `/reset-password-admin`, and similar URLs also resolved to the app. React Navigation would ignore the unknown route, but the app would still be launched for unrelated URLs and the exposure surface was wider than necessary.

**Fix.** Changed to `android:path="/reset-password"` (exact). Query strings do not affect `path` matching, so `?token=…` still resolves.

**Evidence.** **Device:** `cmd package query-activities` confirms the app resolves `https://cookmitra.org/reset-password?token=…` and does **not** resolve `/reset-password-help` or `/bookings/abc123`.

**Files:** `android/app/src/main/AndroidManifest.xml`
**Regression test:** `__tests__/releaseGuards.test.js` (asserts `android:path=` and the absence of `android:pathPrefix=`).

### D-07 (PROCESS GAP) — asset/extension mismatch had no automated check

**Gap.** The earlier release build failed only at AAPT2 packaging time because a `.png` contained JPEG bytes. Debug builds never compile bundled images into resources, so neither lint nor Jest could catch it.

**Fix.** Added a format sniffer (`src/utils/assetIntegrity.js`) and a Jest gate that reads every file in `assets/`, compares its real magic bytes with its extension, and fails on a mismatch. The manifest security attributes are asserted by the same test file, so a merge regression in `usesCleartextTraffic`, backup policy, exported components, or the reset path fails the normal test run.

**Files:** `src/utils/assetIntegrity.js` (new), `__tests__/releaseGuards.test.js` (new)
**Evidence.** **Test:** 14 suites / 64 tests pass; **Artifact:** generated release resources contain `assets_logo.jpg` and no `assets_logo.png`.

### D-08 (ACKNOWLEDGED RISK) — reset tokens appear in shell/adb logs during deep-link testing

**Observation.** `adb shell am start -d "…token=…"` causes `adbd` to log the command line. This is an artifact of the test harness, not the application: the app itself does not log the token, and no system service logged it once `adbd` lines were excluded.

**Residual risk.** On a production (non-debuggable) build, `logcat` is not readable by other apps without root. Accepted; no code change. The UI test confirmed the token is absent from app-private storage.

### Previously fixed, re-verified in this pass

| ID | Fix | Re-verification |
|---|---|---|
| D-01 | `normalizeUser` mirrors `id → _id` | `authStore.test.js` passes; source re-read |
| D-02 | HTTPS reset intent filter + linking prefix | **Device:** cold start from `https://cookmitra.org/reset-password?token=bad-token` renders the reset screen with the correct malformed-token message |
| D-03 | `VIBRATE` permission | Manifest guard test + merged release manifest |
| D-04 | `assets/logo.png` (JPEG bytes) → `logo.jpg` | Release build succeeds; generated resource is `assets_logo.jpg` |
| D-05 | Corrected false assurance claims | This document and the readiness report |

---

## 5. Device verification (physical device)

Device: **Samsung SM-M127G**, Android **13** (API **33**), serial `RZ8RA15MNCT`.
Build: debug APK (`app-debug.apk`, 177,268,183 bytes) installed with `adb install -r`.
Note: the device already had an authenticated session from prior use. **No user data was cleared, no account was created, no booking or payment was made, and no real user's data was inspected beyond what the app rendered to its owner.**

| # | Scenario | Method | Result |
|---|---|---|---|
| 1 | Cold start, custom scheme reset link | `am force-stop` → `am start -a VIEW -d "cookmitra://reset-password?token=<64 hex>"` | **PASS** — reset screen rendered ("Set a new password") on a cold start |
| 2 | Cold start, **https** reset link | `am start -a VIEW -d "https://cookmitra.org/reset-password?token=bad-token"` | **PASS** — app opened and parsed the URL; showed "This reset link is invalid or incomplete." |
| 3 | Warm start (app running) | `am start -a VIEW -d "cookmitra://reset-password?token=<64 hex>"` | **PASS** — intent delivered to the running instance; form shown |
| 4 | Malformed token | link with `token=not-a-valid-token` | **PASS** — safe message; **no password fields**; no network call |
| 5 | Well-formed but unknown token → live API | entered a password twice and tapped Save | **PASS** — app called `POST /api/auth/reset-password`; backend returned 400; UI showed **"This reset link is invalid or has expired."** No data changed |
| 6 | Intent scoping: reset link | `cmd package query-activities` | **PASS** — resolves to `com.cookmitra/.MainActivity` |
| 7 | Intent scoping: look-alike path | `https://cookmitra.org/reset-password-help` | **PASS** — app does **not** resolve |
| 8 | Intent scoping: unrelated path | `https://cookmitra.org/bookings/abc123` | **PASS** — app does **not** resolve |
| 9 | Custom scheme resolution | `cookmitra://reset-password?token=abc` | **PASS** — resolves to the app |
| 10 | Log/storage hygiene | searched logcat and `/data/data/com.cookmitra` | **PASS** — token and password absent (only the `adbd` command echo matched, see D-08) |
| 11 | Startup with no Google/FCM configuration | 20+ cold/warm launches | **PASS** — no crash, no redbox; both integrations are absent by design |

What device testing did **not** cover: authenticated booking/payment flows (would require creating real bookings on the live account), FCM (not integrated), Google Sign-In (not integrated), SSE events (requires two authenticated sessions), and the signed release artifact (unavailable). These remain **NOT TESTED**.

---

## 6. Files changed in this pass

| File | Change |
|---|---|
| `frontend/android/app/src/main/AndroidManifest.xml` | `pathPrefix` → `path` for the reset App Link (D-06) |
| `frontend/src/utils/assetIntegrity.js` | **new** — image-format sniffer (D-07) |
| `frontend/__tests__/releaseGuards.test.js` | **new** — asset + manifest regression gates (D-07) |
| `ANDROID_FINAL_SECURITY_AUDIT.md` | this pass |
| `ANDROID_RELEASE_READINESS.md` | this pass |
| `ANDROID_RELEASE_RUNBOOK.md` | this pass |

Carried over from the previous pass and still present: `src/store/store.js` (`id`/`_id`), `src/navigation/linking.js` (https prefix), `assets/logo.jpg` + `src/components/BrandHeader.js`, `android/app/src/debug/AndroidManifest.xml` (cleartext for local dev only), `.env` / `.env.example` / `src/config.js`, and the two regression tests for D-01/D-02.

No dependency was added, removed, or upgraded. React Native CLI, JavaScript-only, and the existing navigation architecture are preserved.

**External change observed during this pass (preserved, not authored here).** At 12:52 a complete adaptive-launcher-icon set appeared in the working tree while the release build was running: `assets/app-icon-512.png` (valid PNG, 125,745 B), `res/mipmap-*/ic_launcher*.png`, `res/drawable-*/ic_launcher_foreground.png`, `res/mipmap-anydpi-v26/ic_launcher{,_round}.xml`, and `res/values/colors.xml` (white `ic_launcher_background`). It is coherent, valid, and not reverted. Because the first APK had already been packaged at 12:52:01, both release artifacts were rebuilt afterwards from the new source state: APK at 13:04 (85,733,057 B, +156,897 B, consistent with the added icon set) and the AAB, which was already produced at 12:56 after the icons landed, was confirmed up-to-date by Gradle. The debug APK on the device (12:42) predates the icon and is used only for functional testing, not for icon verification.

---

## 7. Open risks and external dependencies

| ID | Severity | Finding | Status |
|---|---|---|---|
| S-01 | **P0** | No production keystore; `apksigner` reports the release APK **DOES NOT VERIFY** (`Missing META-INF/MANIFEST.MF`). | **BLOCKED** — supply the four `COOKMITRA_RELEASE_*` values. |
| S-02 | **P0** | `RAZORPAY_KEY_ID` is empty in the app env; `validateReleaseConfig` fails. The backend *does* hold a live key and returns `keyId` with the order, so checkout could initialise at runtime, but the release guard intentionally requires the explicit app-side value. | **BLOCKED** — set the same live public key the backend uses. |
| S-03 | **P0** | No Razorpay device proof. | **NOT TESTED** — no test-mode key was available and no charge may be made on the live account. |
| S-04 | **P0** | Password-reset e-mail cannot be delivered correctly from the current production env: `FRONTEND_BASE_URL`/`FRONTEND_URL` are absent and `CLIENT_URL` is empty, so `resolveFrontendBaseUrl()` returns `""`, `appBase` falls back to `http://localhost:3000`, and `sendResetEmail` **refuses to send** in production (`reset-base-not-configured`). SMTP itself *is* configured, so this is a single missing variable. `assetlinks.json` is also absent, so the App Link is unverified. | **BLOCKED (server config + hosting)** — set `FRONTEND_BASE_URL=https://cookmitra.org`; publish `assetlinks.json`. |
| S-05 | **P0** | Google Sign-In: backend is live and validating (`POST /auth/google` with an invalid token → **401 "Invalid Google token"**, verified this pass), but there is no Android OAuth client, no SHA-1 registration, and no SDK/UI. | **BLOCKED (credential)** — runbook §8. |
| S-06 | **P0** | FCM: no Firebase dependency, no `google-services.json`, **and no backend device-token endpoint** (0 matches for `fcm|firebase|push|apns|deviceToken|pushToken|web-push`). | **BLOCKED (provider + backend)** — in-app notifications + SSE remain the working path. |
| S-07 | P1 | Reset App Link is unverified (no `autoVerify`, no `assetlinks.json`), so the chooser may not offer the app. | **ACCEPTED** — token is single-use, 1-hour, server-validated. |
| S-08 | P1 | Payment proof can be lost if the process dies between checkout returning and the AsyncStorage write. | **RESIDUAL** — webhook reconciliation; local proof is never final. |
| S-09 | P1 | Reset tokens transit `logcat` as part of the deep-link intent during adb testing (D-08). | **ACCEPTED** — not readable on a non-debuggable production build without root. |
| S-10 | P1 | R8/ProGuard disabled (`enableProguardInReleaseBuilds = false`), so release bytecode is neither shrunk nor obfuscated. | **OPEN** — post-launch hardening with a device smoke run. |
| S-11 | P2 | `versionCode 1` / `versionName "1.0"`. | **OPEN** — increment per upload. |
| S-12 | P2 | Library-derived permissions appear in release: `NFC`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, `ACCESS_WIFI_STATE`, `READ_BASIC_PHONE_STATE` (Razorpay/keychain/NetInfo). No `SYSTEM_ALERT_WINDOW`. | **ACCEPTED** — documented; verify against SDK requirements before store submission. |

---

## 8. Commands actually executed

From `C:\Users\bhave\OneDrive\Desktop\CookMitra\frontend`:

```text
npm run lint                                   PASS  (no diagnostics)
npm test -- --runInBand                        PASS  14 suites / 64 tests
```

From `frontend\android`:

```text
.\gradlew.bat :app:assembleDebug --console=plain
    PASS   app-debug.apk  177,268,183 bytes  2026-10-22 12:42
.\gradlew.bat :app:validateReleaseConfig --console=plain
    FAILS AS DESIGNED:
      "Release RAZORPAY_KEY_ID must be a live Razorpay public key (rzp_live_...)"
.\gradlew.bat :app:assembleRelease -x :app:validateReleaseConfig --console=plain
    PASS   app-release-unsigned.apk  85,733,057 bytes  2026-10-22 13:04
           (rebuilt after the launcher-icon refresh noted in §6)
.\gradlew.bat :app:bundleRelease -x :app:validateReleaseConfig --console=plain
    first attempt FAILED (tail not captured); isolated re-run PASS
           app-release.aab  61,795,402 bytes  2026-10-22 12:56
```

Artifact inspection:

```text
apkanalyzer manifest application-id   -> com.cookmitra
apkanalyzer manifest version-name     -> 1.0 (versionCode 1)
apkanalyzer manifest min-sdk/target-sdk -> 24 / 36
apkanalyzer manifest print            -> cleartext false, allowBackup false,
                                         fullBackupContent false, dataExtractionRules,
                                         android:path="/reset-password", no pathPrefix,
                                         no debuggable, no SYSTEM_ALERT_WINDOW
apkanalyzer manifest permissions      -> 12 permissions (see S-12)
apksigner verify --print-certs        -> DOES NOT VERIFY / Missing META-INF/MANIFEST.MF
AAB zip                               -> 1,240 entries; base/manifest present;
                                         base/assets/index.android.bundle 3,476,744 bytes;
                                         base/res/drawable-mdpi-v4/assets_logo.jpg 174,328 bytes
                                         (JPEG bytes, proving the D-04 fix reached the bundle)
```

Live API (read-only / no state change):

```text
GET  /api/health                             200 {"status":"ok","db":"connected"}
POST /api/auth/forgot-password (unknown addr) 200 generic message (no account enumeration)
POST /api/auth/google (invalid idToken)       401 {"message":"Invalid Google token..."}
POST /api/auth/reset-password (unknown token) 400 (also exercised through the device UI)
```

Device (serial `RZ8RA15MNCT`):

```text
adb install -r app-debug.apk                  Success
am start -a VIEW -d "cookmitra://reset-password?token=<64hex>"   reset screen on cold start
am start -a VIEW -d "https://cookmitra.org/reset-password?token=bad-token"   parsed + safe error
cmd package query-activities -d "https://cookmitra.org/reset-password?token=abc"   app resolves
cmd package query-activities -d "https://cookmitra.org/reset-password-help"        app does not resolve
cmd package query-activities -d "https://cookmitra.org/bookings/abc123"            app does not resolve
uiautomator dump                              reset form / malformed-token message verified
logcat + /data/data/com.cookmitra             no token/password outside adbd echo
```

### Note on the first `bundleRelease` failure

The AAB task failed immediately after `assembleRelease` in the same shell invocation; the failure tail was lost by output truncation. Re-running `:app:bundleRelease` on its own produced a valid AAB. This is consistent with a transient incremental-build/file-contention issue between consecutive packaging tasks (the same class of race produced an AAPT failure in an earlier pass when two packaging tasks overlapped), **not** a source defect: the same inputs produced a successful artifact on the isolated re-run. The runbook therefore runs APK and AAB packaging as separate invocations.

---

## 9. Repository integrity

Final reference-repository state:

```text
git -C H:\Festive_Cook rev-parse --short HEAD   -> 1319a59
git -C H:\Festive_Cook status --porcelain        -> the same 10 modified + 2 untracked
                                                    files that pre-dated this pass
```

No writes, no formatting, no dependency installation, no commit/reset/stash in `H:\Festive_Cook`.

Android workspace: **not a Git repository**, so there is no commit/branch state to report. Changes are limited to §6.

**Environmental caveat (observed, not caused here).** The workspace is a OneDrive-synced folder and received concurrent external writes during this pass: the launcher-icon set appeared at 12:52, and `app-debug.apk` was rebuilt at 12:57:16 (177,269,570 B) without a corresponding command from this session (the debug build produced here finished at 12:42:48 at 177,268,183 B). Device evidence therefore refers to the build installed at 12:44, and it was **not** re-installed. The release artifacts were rebuilt after the last observed external change and re-verified at 13:04 (APK) and 12:56 (AAB). Anyone reusing this evidence should re-hash the artifacts against a known-good source snapshot.

---

## 10. Audit limitations

- No production-signed APK/AAB exists, so runtime behaviour of the **signed release** was not exercised. The release APK was inspected statically only.
- No Razorpay test key was available; payment paths are contract-reviewed, not device-executed this pass.
- No Firebase or Google OAuth configuration exists, so those flows cannot be tested.
- Reset e-mail delivery could not be tested end-to-end because the server has no public base URL configured (S-04). The Android-side link handling was tested directly with real links and a real API call.
- The device already held an authenticated session. Testing the **signed-out** reset path would have required destroying that session; it was not done. The `ResetPassword` route is registered in both navigator branches (`Root.js`), and the cold-start https test proves URL parsing works before authentication state is relevant.
- This is not a formal certification. It is a targeted review of the Android client and its integration contracts, with the evidence above.

---

## 11. Conclusion

**Code-level security: complete for the reviewed scope.**
**Production security sign-off: not granted.**

The client does not trust itself for identity, money, OTP, refunds, or authorization; each of those is re-derived by the backend, and the Android controls that matter (Keystore, revocation tombstone, 401 teardown, deep-link scoping, release manifest, immutable build-time configuration) are verified in source, tests, the packaged artifact, or on a real device.

The remaining risk is configuration and credentials — plus one missing backend variable that currently prevents reset e-mails from being sent at all.
