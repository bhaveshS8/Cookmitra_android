# CookMitra Android — Feature Parity Audit

**Audit date:** 2026-10-22  
**Android project:** `C:\Users\bhave\OneDrive\Desktop\CookMitra`  
**Reference website/backend:** `H:\Festive_Cook` (read-only; reference commit `1319a59`)  
**Scope:** React Native Android app, JavaScript only. Website and backend were traced for contracts; no reference files were edited.

## 1. Method and status legend

The audit compared the Android screens and API wrappers against the website pages and backend routes/controllers, then verified the result with lint, Jest, a production JS bundle, and Android Gradle builds.

| Status | Meaning |
|---|---|
| **Complete** | Equivalent user outcome, same endpoint/contract, both success and relevant failure paths handled. |
| **Partial** | Core flow works; a secondary website capability is intentionally simplified or still missing. |
| **Blocked** | Cannot be completed safely from this workspace without credentials, external configuration, or a backend/website change. |
| **N/A** | Intentionally not part of the Android product. |

No mock production data, invented endpoint, weakened authorization, fake payment result, or client-side trust decision was introduced.

## 2. Final parity matrix

| Area | Website/backend reference | Initial Android gap | Final status | Evidence / notes |
|---|---|---|---|---|
| Email/password login | `Login.jsx`, `authSlice`, backend `/auth/login` | Basic login existed | **Complete** | Same validation, payload, role routing, remembered session, and 401/403 handling. |
| Registration | `Register.jsx`, `/auth/register` | Role and password rules incomplete in places | **Complete** | Customer/cook registration, validation and post-auth resume aligned. |
| Session restore / logout | `SessionBootstrap`, axios interceptors | Expiry could discard an unfinished booking; 401 cleared storage without dropping Redux auth | **Complete (hardened)** | Keychain/AsyncStorage restore; expiry preserves draft/post-auth target/payment proof and dispatches logout; explicit logout clears all data, with a revocation tombstone if Keystore reset fails. |
| Change password | `POST /auth/change-password` | Backend rotated JWT but app kept the old token, immediately breaking the local session; Keystore write failure was swallowed | **Complete** | Rotated token is persisted and written to Redux; a failed secure write ends the session instead of keeping a revoked token. Wrong-current-password 401 remains a form error. |
| Forgot/reset password | `/auth/forgot-password`, `/auth/reset-password` | App reset screen existed but deep-link path was misconfigured and unavailable when signed in | **Partial** | Manual `cookmitra://reset-password?token=...` is now a root screen available in both auth states, with 64-hex validation and session clearing on success. Backend emails a website URL, not an app link — external blocker. |
| Google Sign-In | Website Google OAuth | Not configured natively | **Blocked** | Requires Android OAuth client ID, native Google SDK configuration, and backend `GOOGLE_CLIENT_ID`; no fake fallback or button added. |
| Home discovery | `Home.jsx`, coupons/cooks APIs | Missing coupons/featured parity earlier | **Complete** | Coupon cards, cook cards, location/address entry points, refresh and role-aware header present. |
| Cook discovery/profile | `CookProfile.jsx`, `/cooks/:id`, reviews | Partial screens earlier | **Complete** | Cook profile, availability, reviews, and booking CTA are wired to real APIs. |
| Booking wizard | `CookBooking.jsx`, `POST /bookings` | No draft resume, duplicate risk on retry, weaker selected-cook handling | **Complete (hardened)** | Draft persisted owner-scoped, coupon state resumed, selected cook preserved, stable per-attempt `clientKey`, `womanPresenceConfirmed` enforced, 403/409 handled. The key and its field signature are now stored in the draft, so a process restart cannot silently create a duplicate. |
| Availability and slot search | `/cooks/availability`, booking slot engine | Basic search only | **Complete** | Date/duration search, suggested cooks, preferred-cook filtering, and slot conflict messages. |
| Online payment | `/payments/order`, `/payments/verify`, Razorpay RN SDK | Wiring incomplete earlier; lost verification response could send the user back to pay | **Partial (hardened)** | Order creation, native checkout, signature verification, success/failure UI, and pay-later gating are implemented. Razorpay proof is persisted before verification and retried on focus/resume; a pending proof blocks a blind second payment. **Live/sandbox proof is blocked:** needs test keys and a device/emulator run. |
| Booking waiting | `BookingWaiting.jsx` | No equivalent waiting state | **Complete** | Polling status, cancel request, replacement/expiry messaging, and payment transition. |
| Booking detail (customer) | `BookingDetails.jsx` | Missing OTP, refund, complaint, reschedule, cancellation reasons, contact links | **Complete** | Start OTP, pay/wait gating, cancellation preview/refund, reschedule history, refund request/status, complaint, review and contact actions. |
| Booking detail (cook) | `BookingDetails.jsx`, cook job view | “Mark arrived” path was broken by backend `410`; missing customer contact/maps | **Complete** | Arrival is now OTP start-service; call/maps links; cancellation reasons; customer no-show; reschedule/complaint where allowed. Explicit completion is not exposed because the backend transitions completed sessions automatically. |
| Cancellation and refund preview | `/bookings/:id/cancellation-preview`, reason codes | Wrong field read, cook hit customer-only endpoint | **Complete** | Customer reads `finalRefund`; cooks skip preview. Backend reason codes used; `OTHER` requires a note. |
| Refund request | `/bookings/:id/refund-request` | Amount used wrong source | **Complete** | Uses `refundableAmount` / `refundAmount` / `paidAmount` fallbacks and displays backend status. Approval/gateway execution remains an admin/backend action. |
| Complaints | `/complaints`, category enums | Missing mobile flow | **Complete** | Customer and cook complaint categories and validated messages submitted to the real endpoint. |
| No-show handling | `/bookings/:id/no-show` | Missing | **Complete** | Cook can record an unavailable customer with reason; unpaid deletion response is handled. |
| Reschedule | `/bookings/:id/reschedule`, options | Missing mobile flow | **Complete** | Customer/cook modal, slot options, reason/note, history display. |
| Reviews | `/reviews`, `/reviews/my`, cook review lists | Basic only | **Complete** | Customer can review completed bookings; cook/public review lists and ratings are populated from APIs. |
| My bookings | `/bookings/my` | No OTP/pay/rate inline actions, weak refresh | **Complete** | Start OTP, pay/wait/rate/details, status grouping, periodic/focus refresh. |
| Cook jobs/dashboard | `/bookings/cook/requests`, `/bookings/cook` | No contact/maps, noisy vibration, weak refresh | **Complete** | Request/assigned/history tabs, accept/decline, OTP guidance, call/maps, refresh, vibration only when request count grows. |
| Cook profile setup | `/cooks`, `/cooks/:id`, availability, docs | Could not create/edit profile or payouts | **Complete** | Create/edit bio, weekly availability, UPI/bank payout details, availability toggle, Aadhaar/PAN/photo upload using real multipart fields. |
| Earnings/payouts | `/cook/earnings`, `/cook/payouts` | Basic overview only | **Complete** | Overview cards, weekly cycles, recent sessions, payout statuses and week navigation. |
| Notifications | `/notifications`, read/read-all | No unread persistence, badge or deep links | **Complete** | List, mark one/all read, unread badge, type-aware booking/payout/profile/review navigation. |
| Realtime events | `/realtime/stream` | `eventsource@5` requires fetch streaming, which RN's fetch polyfill does not provide | **Complete (code); device validation pending** | Replaced with XHR-based SSE parser that sends JWT in `Authorization`, reconnects with backoff, and falls back to screen polling. |
| Profile/activity/stats | `/auth/me`, `/auth/me/stats`, bookings/reviews | Static or missing | **Complete** | Real customer stats, recent bookings/reviews, edit profile, saved addresses, security. |
| Legal | Website legal sections | Terms/privacy links missing before auth; no back control | **Complete** | Auth stack route, visible Back, terms/privacy/refunds/cancellation/contact with working contact links. |
| Admin | Web admin console | Admin could land in customer/cook tabs | **N/A / handled** | Admin gets a web-console notice and link; mobile does not attempt to reproduce desktop admin tooling. |
| Saved address reuse in booking | Website address book | Address book exists separately; booking does not offer one-tap selection | **Partial (P2)** | Manual address entry works. A booking-time picker is cosmetic convenience, not a blocked transaction. |
| Hours-complete banner | `BookingDetails.jsx` live remaining-time/WhatsApp banner | Not reproduced | **Partial (P2)** | Backend performs automatic hours completion and notifications; this is presentation polish only. |
| Release transport security | HTTPS-only production | Main manifest had a cleartext placeholder | **Complete** | Main manifest now hardcodes `usesCleartextTraffic="false"`; merged release manifest verified. `allowBackup=false`, `fullBackupContent=false`, and data-extraction exclusions added. Debug overlay keeps cleartext only for local development. |
| Production signing | Release APK/AAB | Release used the debug keystore | **Blocked** | No production keystore/credentials in the workspace. Debug fallback removed; release remains unsigned unless all four signing values are supplied. |
| Release configuration | Store artifact | `.env` contains a LAN HTTP API and no Razorpay key | **Blocked (guard added)** | `validateReleaseConfig` fails release builds until real HTTPS API/web origins and a live Razorpay public key are supplied. |
| Push notifications | FCM | None | **Blocked** | Requires FCM project credentials and backend device-token registration. In-app SSE/polling and unread badge work. |
| Native embedded map | Website map | Deep links only | **N/A / intentional** | Maps/contact deep links avoid adding a heavy native map SDK. GPS pinning and maps search links are present. |

## 3. Priority findings and resolution

### P0 / release-blocking

1. **Password change destroyed the local session.**  
   The backend increments `tokenVersion` and returns a new JWT. The app ignored it and kept the old token, so the very next request was unauthorized. Fixed by persisting the rotated token and updating Redux.

2. **Release manifest contained an unresolved `usesCleartextTraffic` placeholder.**  
   The main manifest now hardcodes `false`; the debug overlay still opts in to cleartext for local development. The merged release manifest was inspected and also has backup/data-transfer exclusions.

3. **Booking retries could create duplicates or lose the flow after sign-in.**  
   Now uses a stable per-attempt `clientKey`, saves the draft before submit, resumes it after authentication, and preserves it across session expiry without leaking it to a different account. The key **and** its field signature are persisted, so a process restart no longer loses the key.

4. **A 401 cleared storage but left the protected UI mounted.**  
   The interceptor now triggers a Redux `logout()` through the navigator resetter, so expired sessions return to Auth instead of continuing with a stale user object. Explicit logout, drafts, and pending payment proof follow separate preserve/clear rules.

### P1 / workflow defects

5. **Cook “Mark arrived” always failed.**  
   `PATCH /bookings/:id/arrived` is intentionally `410` in the backend. Replaced with `PATCH /bookings/:id/start-service` using the customer OTP.

6. **Cancellation preview and refund amounts used the wrong fields.**  
   Customer preview now reads `finalRefund`; cooks no longer call the customer-only endpoint; refund UI uses `refundableAmount` / `refundAmount` / `paidAmount`.

7. **Cook setup could not create a profile or upload documents.**  
   Added real create/edit, weekly availability, payout details, availability toggle, and multipart upload with `aadhar`, `pan`, `photo`.

8. **Realtime events never reached the app.**  
   `eventsource@5` is Fetch-stream based; React Native's `whatwg-fetch` polyfill does not expose a readable stream. Replaced with an XHR SSE client and kept polling as fallback.

9. **Password-reset deep link handling was incomplete.**  
   The screen is now a root-level route available in both auth states, validates the backend’s 64-hex token format, and clears the session on success. The backend email still points at the website, so email-to-app delivery remains an external blocker.

10. **Paid/auto-confirmed bookings could be sent back to checkout.**  
    The waiting screen now sends paid/confirmed bookings to details and only opens payment for an accepted booking with money due; the payment screen also refuses to render checkout for already-paid or non-payable bookings.

11. **A lost payment-verification response could invite a second charge.**  
    Razorpay proof is now persisted before verification, retried on focus/resume, and blocks a blind second payment when the backend has not confirmed it.

### P2 / polish

- Saved-address one-tap selection during booking.
- Hours-remaining / cooking-complete banner.
- Richer admin-only tooling (intentionally web-only).

## 4. Verification evidence

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` (frontend) | **Pass**, no output/errors. |
| Unit/component tests | `npm test -- --runInBand` (frontend) | **Pass**: 13 suites, 51 tests. |
| Android JS bundle | `npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output %TEMP%\cookmitra-android-bundle\index.android.bundle ...` | **Pass**, 23 asset files copied. |
| Debug Android build | `.\gradlew.bat :app:assembleDebug` | **Pass**; APK produced at `frontend/android/app/build/outputs/apk/debug/app-debug.apk` (177,268,195 bytes). |
| Release config guard | `.\gradlew.bat :app:validateReleaseConfig` | **Expected fail** for the current LAN/HTTP/non-live env; release is intentionally blocked. |
| Release manifest | `.\gradlew.bat :app:processReleaseMainManifest -x :app:validateReleaseConfig` | **Pass** for manifest-only inspection. Contains `usesCleartextTraffic="false"`, `allowBackup="false"`, `fullBackupContent="false"`, and `dataExtractionRules`. |
| Release signing | Release build without signing values | **No debug fallback**; artifact is unsigned/build-only. Production signing remains blocked. |
| Reference tree integrity | `git status --short` in `H:\Festive_Cook` | Only pre-existing user changes (`App.css`, `App.js`, home components/styles, untracked mobile tab bar files). No file was written by this audit. |

Backend behavior was verified by reading the reference routes/controllers and matching request shapes; the reference backend test suite was not rerun in this pass so that `H:\Festive_Cook` remained untouched.

## 5. Remaining blockers and operational risks

1. **Google Sign-In** — Android OAuth client ID + native Google SDK configuration required.
2. **Push notifications** — FCM credentials and backend device-token registration required.
3. **Razorpay live proof** — needs test keys and a device/emulator; build-level wiring is present but has not been proven against the gateway in this environment.
4. **Production signing** — the debug fallback was removed; a real keystore and credentials must be supplied outside source control. Release remains blocked until then.
5. **Password-reset email links** — backend email links point to the website. Changing them to a verified HTTPS App Link or `cookmitra://` is a backend/website change and was intentionally not made.
6. **Release environment** — `.env` still points at a LAN HTTP API with a placeholder website and an empty Razorpay key; `validateReleaseConfig` blocks release builds until these are real.
7. **Realtime** — code path is fixed and unit-tested at the framing level; an actual device run against a live SSE endpoint is still recommended.
8. **No physical-device E2E run** — all verification here is static tracing, Jest, Metro bundling, and Gradle compilation.

## 6. Audit conclusion

The Android app now covers the customer booking lifecycle, cook job lifecycle, authentication, payment UI, cancellations/refunds, complaints, notifications, profile, legal, and earnings flows with real backend contracts. Remaining gaps are either deliberate product simplifications or external-credential blockers; none were replaced with mock data or unsafe client-side shortcuts.
