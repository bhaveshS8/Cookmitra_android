# CookMitra Android — Implementation Report

**Date:** 2026-10-21 (implementation) / **current verification:** 2026-10-22  
**Project:** `C:\Users\bhave\OneDrive\Desktop\CookMitra`  
**Reference:** `H:\Festive_Cook` (read-only, commit `1319a59`)  
**Stack preserved:** React Native CLI, JavaScript, Android, existing navigation/theme.

> **Current status:** this implementation report is retained as a change log. For the authoritative security/release verdict and current test counts, use `ANDROID_FINAL_SECURITY_AUDIT.md`, `ANDROID_RELEASE_READINESS.md`, and `ANDROID_RELEASE_RUNBOOK.md`. The release is not production-ready; see the blocker list there.

## 1. Summary

This implementation brings the Android app to functional parity with the reference website for the customer and cook booking workflows, while keeping the website/backend untouched.

The work covered:

- Authentication/session correctness, including rotated JWTs and resumable interrupted flows.
- Customer discovery, booking, payment, waiting, cancellation, refund, reschedule, complaint, no-show, review, and support flows.
- Cook onboarding, availability, payouts, job acceptance, OTP service start, earnings, and customer contact.
- Notifications, unread state, deep links, profile stats/activity, legal content, and realtime events.
- Release-build transport safety and honest handling of external blockers.

No mock production data, invented endpoints, client-side authorization shortcuts, or fake payment success paths were added.

## 2. Defects fixed and root causes

| Defect | Root cause | Fix |
|---|---|---|
| Password change immediately logged the user out | Backend rotates `tokenVersion` and returns a new JWT; app ignored it | Persist the returned token with `replaceSessionToken` and update Redux with `setToken` |
| Booking flow lost after session expiry | 401/403 handling cleared all session state, including the unfinished draft | Added `clearSession({ preserveResume: true })`; explicit logout still clears everything |
| Booking retries could duplicate a request | A new key was generated on each submit | Stable per-attempt `clientKey` reused until booking-defining fields change; includes user ID |
| Draft could be shown to another account | Draft was global to the device | Drafts are owner-scoped and discarded on user mismatch |
| Cancellation preview showed ₹0 / wrong refund | UI read the wrong response field | Customer reads `preview.finalRefund`; cooks skip the customer-only endpoint |
| Refund modal showed the wrong limit | Amount fallback used unrelated fields | Uses `refundableAmount`, `refundAmount`, then `paidAmount` |
| Cook “Mark arrived” always failed | Endpoint is intentionally `410` | Replaced with OTP-based `PATCH /bookings/:id/start-service` |
| Cook could not create/edit profile or upload documents | Setup was read-only/partial | Real create/edit, schedule, payouts, availability, and multipart document upload |
| My bookings lacked OTP/payment/review actions | List only linked to details | Inline Start OTP, pay/wait/rate/details and refresh |
| Cook dashboard missed customer contact and maps | Screen only showed address | Call/maps/details actions, periodic refresh, vibration only when request count grows |
| Notifications never became read / no badge | No read mutation or unread query | Mark one/all read, deep links, AppHeader unread badge |
| Legal could not be opened before sign-in | Route only existed in the authenticated tree | Added to `AuthStack` and added a visible Back control |
| Reset-password deep link did not resolve | Path pointed at a route unavailable in both auth states | Root-level route available signed-in/signed-out; 64-hex token validation and session clearing on success |
| Realtime events never arrived | `eventsource@5` needs Fetch streaming; RN's fetch polyfill buffers responses | XHR-based SSE client with `Authorization` header, incremental parsing, reconnect/backoff |
| Release build could allow cleartext | Unresolved `${usesCleartextTraffic}` placeholder | Main manifest hardcodes `false`; debug manifest overrides to `true`; merged release manifest verified |
| A 401 kept the protected UI mounted | Storage was cleared but Redux still held the user/token | Navigator resetter dispatches `logout()`; draft/payment proof preserved for re-login |
| Password change could keep a revoked token | Keystore write failure was swallowed | Persist failure ends the session and requires sign-in |
| Logout could resurrect after a Keystore reset failure | Session clear silently ignored the failure | Revocation tombstone blocks restore until a successful new login |
| Admin landed in customer/cook tabs | Role routing had no admin branch | Admin notice screen with web-console link |
| Profile activity was static | No stats/bookings/reviews wiring | Real `/auth/me/stats`, recent bookings and reviews |
| Toast timer leaked after unmount | No cleanup | Clear timer on provider unmount |
| Cancellation `OTHER` note was optional in UI | UI did not require a description | Note is required for `OTHER`, matching backend validation |
| Paid/confirmed booking could re-enter checkout | Waiting screen redirected every accepted/confirmed booking to payment | Route guard sends paid/confirmed to details; payment screen also refuses already-paid/non-payable bookings |

## 3. Implemented flows and API contracts

### Authentication and session

- `POST /auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`
- `GET /auth/me`, `GET /auth/me/stats`, `PUT /auth/me`
- `POST /auth/change-password` → persists `{ message, token }`
- `GET/POST/PUT/DELETE /auth/me/addresses`, default address mutation
- Session restore from secure storage/keychain; 401/403 resets navigation while optionally preserving an unfinished booking.

### Customer booking

- `POST /bookings` with service, date, time, duration, guests, address, coordinates, woman-presence confirmation, coupon and stable `clientKey`.
- `GET /bookings/my`, `GET /bookings/:id`
- `GET /bookings/:id/cancellation-preview`
- `PATCH /bookings/:id/cancel` with backend reason codes.
- `GET /bookings/:id/refund-eligibility`, `POST /bookings/:id/refund-request`
- `GET /bookings/:id/reschedule-options`, `PATCH /bookings/:id/reschedule`
- `POST /complaints`, `POST /reviews`
- `PATCH /bookings/:id/pay` remains backend-driven; card/UPI payment uses `/payments/order` + `/payments/verify`.

### Cook

- `GET /bookings/cook/requests`, `GET /bookings/cook`
- `PATCH /bookings/:id/accept`, `/reject`, `/cancel`, `/start-service` (`{ otp }`)
- `PATCH /bookings/:id/no-show`
- `GET/POST/PUT /cooks`, `/cooks/me`, `/cooks/:id`
- `PATCH /cooks/me/availability`
- `POST /cooks/upload-docs` with multipart fields `aadhar`, `pan`, `photo`
- `GET /cook/earnings`, `/cook/payouts`
- `GET /reviews/cook-me`

### Shared

- `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- Realtime `GET /realtime/stream` with `Accept: text/event-stream` and `Authorization: Bearer <jwt>`.
- `GET /auth/me/stats` for profile activity.
- Existing legal copy is local content; contact/maps actions use platform deep links.

## 4. Security review

| Control | Result |
|---|---|
| Production cleartext traffic | **Blocked/disabled**: merged release manifest has `android:usesCleartextTraffic="false"`. Debug allows cleartext only for local development. |
| Backups | `android:allowBackup="false"`, `android:fullBackupContent="false"`, and explicit `dataExtractionRules` exclusions in the merged release manifest. |
| JWT storage | Existing keychain/AsyncStorage abstraction retained; no token logging introduced; failed logout reset is tombstoned. |
| Realtime token exposure | Token moved from query string to the `Authorization` header. |
| Authorization decisions | All accept/cancel/refund/start/no-show decisions remain server-side; UI only mirrors backend eligibility. |
| Payment trust | Razorpay signature verification remains a backend call; app never marks a booking paid locally. Unconfirmed proof is persisted and retried, not treated as success. |
| Idempotency | Booking `clientKey` and its field signature are scoped to the authenticated user and persisted with the draft. |
| Draft privacy | Drafts are owner-scoped; explicit logout clears them; session expiry preserves them for the same owner after sign-in. |
| Release signing | **External blocker**: no production keystore/credentials. Debug signing fallback was removed; release is unsigned unless all four values are supplied. |
| Admin | Mobile admin console intentionally not implemented; web-only notice. |

## 5. Changed/new files

Core flow files:

- `frontend/src/features/bookings/BookingDetailScreen.js`
- `frontend/src/features/bookings/BookCookScreen.js`
- `frontend/src/features/bookings/MyBookingsScreen.js`
- `frontend/src/features/bookings/BookingWaitScreen.js`
- `frontend/src/features/payments/BookingPaymentScreen.js`
- `frontend/src/features/cook/CookSetupScreen.js`
- `frontend/src/features/cook/CookDashboardScreen.js`
- `frontend/src/features/payouts/CookEarningsScreen.js`
- `frontend/src/features/profile/SecurityScreen.js`
- `frontend/src/features/profile/LegalScreen.js`
- `frontend/src/features/profile/ProfileScreen.js`
- `frontend/src/features/profile/ActivityScreen.js`
- `frontend/src/features/notifications/NotificationsScreen.js`
- `frontend/src/features/admin/AdminNoticeScreen.js`

Shared services/navigation/components:

- `frontend/src/api/client.js`
- `frontend/src/api/bookings.js`
- `frontend/src/api/services.js`
- `frontend/src/services/session.js`
- `frontend/src/services/realtime.js`
- `frontend/src/utils/sse.js` (new)
- `frontend/src/utils/bookingActions.js`
- `frontend/src/store/store.js`
- `frontend/src/store/toast.js`
- `frontend/src/navigation/Root.js`
- `frontend/src/navigation/AuthStack.js`
- `frontend/src/components/AppHeader.js`
- `frontend/src/components/Field.js`
- `frontend/android/app/build.gradle`
- `frontend/WEBSITE_REFERENCE_MAP.md`

Tests:

- `frontend/__tests__/SecurityScreen.test.js`
- `frontend/__tests__/session.test.js`
- `frontend/__tests__/sse.test.js`
- `frontend/__tests__/bookingActions.test.js`
- `frontend/__tests__/passwordReset.test.js` (new, current pass)
- `frontend/__tests__/bookingAttempt.test.js` (new, current pass)
- `frontend/__tests__/linking.test.js` (new, current pass)
- Existing auth validation/store, login/register, format and config tests retained.

## 6. Verification commands and actual results

Run from `C:\Users\bhave\OneDrive\Desktop\CookMitra\frontend` unless noted.

### Lint

```powershell
npm run lint
```

**Result:** pass, no diagnostics.

### Jest

```powershell
npm test -- --runInBand
```

**Result:**

```text
Test Suites: 13 passed, 13 total
Tests:       51 passed, 51 total
Snapshots:   0 total
Time:        32.785 s
```

### Production JS bundle

```powershell
npx react-native bundle --platform android --dev false --entry-file index.js `
  --bundle-output "$env:TEMP\cookmitra-android-bundle\index.android.bundle" `
  --assets-dest "$env:TEMP\cookmitra-android-bundle\res" --reset-cache
```

**Result:** bundle written successfully; 23 asset files copied.

### Android debug build

```powershell
cd android
.\gradlew.bat :app:assembleDebug --console=plain
```

**Result:** `BUILD SUCCESSFUL in 2m 6s`.  
APK: `frontend/android/app/build/outputs/apk/debug/app-debug.apk`  
Size: 177,268,195 bytes.

Gradle emitted non-fatal deprecation warnings (`applicationVariants`/`newDsl`/`builtInKotlin` and a KSP/Kotlin version notice from dependencies). They did not fail the build and are pre-existing toolchain warnings.

### Android release guard and manifest

```powershell
.\gradlew.bat :app:validateReleaseConfig
```

**Result:** expected failure for the current `.env` (`API_BASE_URL` is a LAN HTTP endpoint). The release path is intentionally blocked until production configuration is supplied.

For manifest inspection only:

```powershell
.\gradlew.bat :app:processReleaseMainManifest -x :app:validateReleaseConfig
```

**Result:** `BUILD SUCCESSFUL`.

Verified in:

`frontend/android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml`

```xml
android:allowBackup="false"
android:dataExtractionRules="@xml/data_extraction_rules"
android:fullBackupContent="false"
android:usesCleartextTraffic="false"
```

### Reference integrity

```powershell
cd H:\Festive_Cook
git status --short
```

The tree shows only pre-existing user changes (App/home styles/components and untracked mobile tab-bar files). No audit/implementation command wrote to this tree.

## 7. What was not proven here

These are intentionally not claimed as verified:

1. A physical Android device or emulator run.
2. A live Razorpay payment with test/live keys.
3. Google Sign-In.
4. FCM push delivery.
5. A live SSE session against the deployed backend (the parser and reconnect logic are unit-tested; polling remains as fallback).
6. Production-signed APK/AAB output.
7. Backend suite re-execution in this pass; the reference backend was kept read-only, and its tests were not rerun.
8. An email-delivered reset link opening the Android app; the current backend emails a website URL.
9. Backup/device-transfer behavior on real hardware.

## 8. Required external inputs

| Input | Needed for |
|---|---|
| Android OAuth client ID + Google native configuration | Google Sign-In |
| FCM project credentials + backend device-token registration | Push notifications |
| Razorpay test keys + device/emulator | End-to-end payment proof |
| Production keystore, alias, and passwords supplied outside source control | Release signing |
| Backend/website template change to use `cookmitra://reset-password?token=...` | Password-reset email deep link |
| Live backend URL + test accounts | Device E2E and realtime validation |
| HTTPS `API_BASE_URL` and `WEB_ORIGIN` in the release `.env` | Release networking; release builds forbid cleartext |

## 9. Release checklist

1. Provide the production keystore through a secure Gradle property/environment mechanism; do not commit it.
2. Build a release APK/AAB and confirm it is signed with the production certificate.
3. Run the booking/payment/OTP/cancellation/refund flows on a device against staging.
4. Confirm the realtime stream connects and that screen polling remains a safe fallback.
5. Configure Google Sign-In and FCM if those features are in launch scope.
6. Update the backend reset-email template if app deep links are expected from email.
7. Keep `H:\Festive_Cook` untouched; deploy backend changes through its own reviewed repository process.
