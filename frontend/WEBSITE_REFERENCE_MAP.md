# CookMitra Website → Mobile Reference Map

Source of truth: `H:\Festive_Cook` (branch `master`, HEAD `1319a59`,
committed — read-only for this project). All routes, endpoints, labels,
and rules below were read from that source. Mobile project lives in
`C:\Users\bhave\OneDrive\Desktop\CookMitra\frontend` (React Native CLI, JS-only, Android-focused) and
must not change the website.

## 1. Brand & design tokens

| Website source | Value | Mobile use |
|---|---|---|
| `frontend/src/styles/base.css :root` | `--primary #e8590c`, `primary-700 #c2410c`, gradient `linear-gradient(135deg,#ffb020,#f76707 45%,#e8590c)` | `src/theme/colors.js` — primary CTA, headers, active states |
| same | slate scale `#f8fafc…#0f172a`; accents amber/blue/emerald/rose/purple | text, borders, status badges (same semantic mapping) |
| same | radii 10/14/20/28; brand shadow `rgba(232,89,12,.55)` | cards, buttons, bottom sheets |
| `frontend/src/assets/logo.png` (170 KB), `public/logo.png`, `hero.png`, `carousel-2/3.png` | PNG, in-repo | copied to `frontend/assets/`; logo is stored as **`assets/logo.jpg`** because the upstream bytes are JPEG (a `.png` name broke the Android release resource compile), used in header/auth |
| `frontend/src/utils/constants.js` | `formatCurrency` (en-IN INR, 0 decimals), `formatTime12`, `formatDate`, `normalizeIndianMobile`, `mapsNavigateUrl`, booking `wa.me` builders, `SERVICE_DETAILS` (4 services + badge colors) | ported verbatim to `frontend/src/utils/` (pure JS, no DOM); `wa.me` links via `Linking`, maps links via `Linking` |
| Icons | `lucide-react` (web SVG) | `lucide-react-native` + `react-native-svg` (same icon names) |
| Fonts | system stack on web | Android system `sans-serif` / `sans-serif-medium` (no custom font ships on web) |

Typography: web uses relative sizes and system fonts — mobile uses
`PixelRatio`-independent `sp`-style scale in `src/theme/typography.js`
(16 base, 13 small, 20/24 headings), weights 400/600/800.

## 2. API foundation

- Base URL: website `axios` uses `REACT_APP_API_URL` else same-origin
  `/api` (`frontend/src/api/axios.js`). Mobile: `API_BASE_URL` from
  build config — production `https://cookmitra.org/api` (same nginx-served
  origin as the website), or `http://10.0.2.2:5000/api` for a local
  emulator backend. Never hardcode hosts in screens.
- Auth: `Authorization: Bearer <JWT>` per request, 15 s timeout.
  Website persists token+user in `localStorage`/`sessionStorage`
  (`rememberMe` switch). Mobile: token in `react-native-keychain`
  (secure), profile in AsyncStorage.
- Session: `GET /auth/me` on launch; 401 (non-auth-form) clears session
  and routes to Login; 403 "blocked by an administrator" also logs out.
- Roles (lowercased client-side): `customer`, `cook`, `admin`.
  Post-login routing: cook → cook bookings, admin → admin, customer →
  `next` or home. Admin tabs exist on web but are **out of mobile MVP**
  (desktop ops UI) — documented gap.

## 3. Route → screen map (roles enforced by backend + `ProtectedRoute` equivalents)

| # | Website route | Website source | API endpoints | Roles | Mobile screen | Mobile changes |
|---|---|---|---|---|---|---|
| 1 | `/login` | `pages/Login.jsx`, `store/authSlice.loginUser`, `utils/authValidation` | `POST /auth/login {email,password,rememberMe}` → `{token,user}` | public; `next` resume supported | `LoginScreen` | one-column card; `secureTextEntry` + show/hide; keyboard-aware scroll; Google button → native Google SDK (gap until integrated: email login first) |
| 2 | `/register` (+`?role=cook`) | `pages/Register.jsx` (role tiles customer/cook; fields name/email/phone/password/confirm + strength meter) | `POST /auth/register {name,email,phone,role}` → `{token,user}` | public | `RegisterScreen` | role selector (Customer "For households & hosts" / Cook "Offer cooking services"); same validation strings (`authValidation.js` ported) |
| 3 | `/forgot-password`, `/reset-password` | `pages/ForgotPassword.jsx`, `ResetPassword.jsx` | `POST /auth/forgot-password`, `POST /auth/reset-password` | public | `ForgotPasswordScreen`, deep-link `cookmitra://reset-password` | native deep link instead of email URL path |
| 4 | `/` Home | `pages/Home.jsx` + `DishCarousel`, `HomeCoupons`, `FestiveOfferBillboard`, `LocationPicker` | `GET /availability/search`, `GET /cooks` (featured), coupons list | public | `HomeScreen` (bottom-tab root) | vertical scroll sections; hero image banner; location via GPS permission + manual entry |
| 5 | `/cook-on-demand` | `pages/CookBooking.jsx` (~1000 lines), `components/BookingForm.jsx`, `utils/bookingDraft`, `useWomanPresence` | `GET /availability/search`, `GET /cooks`, `GET /cooks?slots`, `POST /bookings` (payload §4), `POST /bookings/verification/decline`, coupon validate | customer only; woman-presence YES required (backend-enforced) | `BookCookScreen` (4-step wizard: service → slot → venue → confirm) | step wizard replaces long page; native date/time pickers; venue via text + GPS pin; coupon deep-link/tab params applied; draft persists every address/venue/presence field and resumes after login |
| 6 | `/cooks/:id` | `pages/CookProfile.jsx`, `CookAvatar`, `CookReviewsBlock` | `GET /cooks/:id`, `GET /reviews?cook=` | public | `CookProfileScreen` | profile header + reviews list; "Book" CTA deep-links wizard with cook preselected |
| 7 | `/bookings/:id/wait` | `pages/BookingWaiting.jsx` | `GET /bookings/:id` (poll), `PATCH /bookings/:id/cancel` | customer | `BookingWaitScreen` | polling + realtime (see §5); cancel with 30-min lock rule (`isCancelLocked`) |
| 8 | `/bookings/:id/pay` | `pages/BookingPayment.jsx` (Razorpay checkout.js) | `POST /payments/order`, Razorpay checkout, `PATCH /bookings/:id/pay {method,payment}` | customer | `BookingPaymentScreen` | `react-native-razorpay` native SDK; same order→checkout→verify sequence; UPI/card methods |
| 9 | `/bookings/:id` | `pages/BookingDetails.jsx` (+Reschedule/Cancel/Refund/Review/Complaint modals) | `GET /bookings/:id`, `PATCH …/start-service {otp}`, `…/cancel {reason,reasonNote}`, `…/refund-eligibility`, `…/refund-request {reason,note}`, `…/cancellation-preview`, `GET/PATCH …/reschedule`, `POST …/no-show`, `POST /complaints`, review `POST /reviews` | customer/cook/admin scoped | `BookingDetailScreen` | customer: OTP, pay/cancel-with-reason/reschedule/reason-aware refund/review; cook: accept/decline, start with OTP, cancel-with-reason, no-show, complaint; both roles see counterparty call/WhatsApp, selected items, cancellation/refund state and reschedule history |
| 10 | `/dashboard/my-bookings` | `pages/CustomerDashboard.jsx` | `GET /bookings/my`, `GET …/refund-eligibility` | customer | `MyBookingsScreen` (tab) | status filter chips; `getBookingDisplayState` (UPCOMING/TODAY/…) ported; Start OTP visible on active bookings; inline pay/wait/rate/detail actions; 30 s refresh |
| 11 | `/dashboard/profile*` | `pages/CustomerProfile.jsx`, `ProfileSectionPages.jsx` | `GET/PUT /auth/me`, addresses CRUD, `POST /auth/change-password`, `GET /auth/me/stats`, `GET /bookings/my`, `GET /reviews/my` | customer | `ProfileScreen` + `EditProfile`, `Addresses`, `Activity`, `Security` screens | sections become stacked screens; same field rules; stats grid (upcoming/completed/total/reviews); activity lists bookings and written reviews |
| 12 | `/dashboard/cook-bookings` | `pages/CookDashboard.jsx` | `GET /bookings/cook`, `GET /bookings/cook/requests`, `PATCH /bookings/:id/{accept,reject}` | cook | `CookDashboardScreen` (tab): Requests / Assigned / History | push-style list w/ accept–decline actions; customer phone + call/maps actions; 20 s refresh; vibration only when the request count grows |
| 13 | `/dashboard/cook-profile` | `pages/CookSetup.jsx`, `CookProfileForm`, `CookDocUploads`, `CookScheduleEditor`, `CookAvailabilityToggle` | `GET/POST/PUT /cooks`, `PATCH /cooks/me/availability`, doc uploads (multipart `aadhar`/`pan`/`photo`) | cook | `CookSetupScreen` | self-service profile creation (404 → create form), bio/services/experience/specialties, 7-day schedule editor, UPI/bank payout details, availability toggle, document upload with returned URL persisted to the profile |
| 14 | `/cook/earnings` | `pages/CookEarnings.jsx` (+`.css`) | `GET /cook/earnings` (overview + per-booking rows), `GET /cook/payouts` | cook | `CookEarningsScreen` (tab) | summary cards (today/thisWeek/pending/paid/lifetime) + rows; IST week labels via ported `weeklyPayout.js` |
| 15 | `/dashboard/cook-reviews` | `pages/CookReviews.jsx` | `GET /reviews?cook=me` (via cook API) | cook | `CookReviewsScreen` | list + rating summary |
| 16 | `/dashboard/notifications` | `pages/Notifications.jsx` | `GET /notifications`, `PATCH …/read-all`, `PATCH …/:id/read` | all roles | `NotificationsScreen` (stack) | pull-to-refresh; mark-all-read; row taps open the related booking, payout, profile or reviews; AppHeader unread badge polls every 60 s |
| 17 | `/admin*` (dashboard, payouts, refunds, cooks, complaints) | `pages/AdminDashboard.jsx`, `AdminPayoutsPanel`, `AdminWeeklyPayouts`, etc. | `/api/admin/*`, `/api/payouts/*` | admin | **OUT OF MVP** | desktop ops UI; mobile shows an admin-only notice with a web-console link instead of dropping admins into customer tabs |
| 18 | `/terms /privacy /refunds /customer-cancellation-refund-policy /contact` | `pages/Legal.jsx` | none | public | `LegalScreen` (per-doc viewer) | all five docs switch in-place; contact card opens mail, phone, WhatsApp and Instagram |

## 4. Booking payload contract (verified)

`POST /bookings` (`CookBooking.jsx:957-993`, backend `routes/bookings.js`
+ controller validation):
`{serviceType, date: YYYY-MM-DD, startTime/endTime: HH:MM,
guests: 1..500, durationHours: 1..4, notes, selectedItems[],
couponCode, womanPresenceConfirmed: true (strictly required),
address, addressDetails{flatNo,society,landmark,city},
location{lat,lng}? (only GPS-bound pins), clientKey}`.
Response: booking doc → navigate wait screen. Errors: 403 woman-block
(`blockedUntil` countdown), 409 slot conflict ("pick another time").
Status machine: `requested→accepted→confirmed→in_progress→completed`
(+`rejected/cancelled/expired`); cook actions `PATCH
/bookings/:id/{accept,reject,start-service}`; OTP start
`PATCH …/start-service {otp}`; pay `PATCH …/pay`; cancel `PATCH
…/cancel`; reschedule ≤2, ≥30 min lead (`MAX_RESCHEDULES`,
`canRescheduleBooking`); cancel locked ≤30 min before start.
Pricing: slabs `{1:199,2:349,3:499,4:649}` (`LAUNCH_SLAB_PRICES`),
15% commission (`COMMISSION_RATE`) — display only; backend computes.

## 5. Web-only functionality → native adaptation

| Web | Native equivalent |
|---|---|
| `localStorage/sessionStorage` | Keychain (token) + AsyncStorage (profile/draft) |
| react-router + `ProtectedRoute` + `NonAdminRoute` | React Navigation stacks + tabs + auth-gated navigators |
| `EventSource` SSE (`useRealtime`: booking_request/assigned/replacement_needed/expired) | `eventsource` polyfill for RN (uses XHR) + polling fallback; push notifications future work |
| Razorpay `checkout.js` script | `react-native-razorpay` SDK (public key id only) |
| `@react-oauth/google` button | `@react-native-google-signin/google-signin` (gap until configured; email auth first) |
| OSM iframe embed, `window.open` maps | `Linking.openURL` maps/`wa.me` links |
| `AudioContext` alarm (`playAlarmSound`) | `Vibration` API for request alerts |
| File input uploads | `react-native-image-picker` (receipts/cook docs) |
| CSS (28 stylesheets) | `StyleSheet` + theme tokens (no CSS import) |
| `window.location.origin` review links | deep-link builder with configured web origin |

## 6. Reusable platform-independent modules (copied logic, not imports)

`utils/authValidation.js` (email/phone/name/password rules + server
error mapping), `utils/constants.js` **minus** `playAlarmSound` and the
`window` branch of `bookingReviewWhatsAppUrl`, `utils/weeklyPayout.js`
(IST week math), `utils/venuePin.js` + `utils/geolocation.js` pure
parts (haversine, pin binding), booking state helpers
(`getBookingDisplayState`, `canRescheduleBooking`, `isCancelLocked`,
`isReviewable`, `withoutUnpaidCancelled`). All covered by mobile unit
tests.

## 8. Parity validation record (traced, not visual)

Verified by reading both sides; equivalent actions produce identical
request shapes. All covered by `frontend/__tests__` + backend suites.

| Workflow | Website behavior | Mobile behavior | Verdict |
|---|---|---|---|
| Login validation + payload + role routing | `Login.jsx` + `authSlice.loginUser` + `authValidation` | identical strings/rules/payload/role branches | parity |
| Register roles + payload + strength meter | `Register.jsx` role tiles, `{name,email,phone,password,role}` | identical, incl. "Welcome to Cook Mitra" toast | parity |
| Session restore/logout/401 handling | `SessionBootstrap`, axios interceptors | Keychain/AsyncStorage restore, same 401/403 rules, nav reset; expired sessions preserve the unfinished booking draft for re-login | parity |
| Booking payload + idempotency + 403/409 | `CookBooking.jsx:957-1014` | same fields + a stable per-attempt `clientKey` reused on retries, same error branches | parity |
| Woman-presence gate + restriction sync | `useWomanPresence.js` + `BOOKING_TEMPORARILY_BLOCKED` | status restore, decline, 403 sync, countdown, submit gate | parity |
| Slot search + slabs + pricing display | `/availability/search`, `LAUNCH_SLAB_PRICES` | same params, same slabs (display only; backend computes) | parity |
| Payment order→checkout→verify + 410/409 | `BookingPayment.jsx:205-324`, methods+hide-lists | same body/options/handler branches via native SDK | parity (native SDK pending build proof) |
| Cook accept/decline/OTP-start | `PATCH …/{accept,reject,start-service}` | same endpoints + OTP input; completion left to the server's hours-complete job | parity |
| Cancel lock (30 min), reschedule rules (≤2, 30 min) | `constants.js` locks | ported verbatim + unit-tested | parity |
| Earnings overview + IST week tabs | `CookEarnings.jsx`, `weeklyPayout.js` | same API shapes, same week math, week pager | parity |
| Reviews list/create | `GET /reviews/cook/:id`, `POST /reviews` | same (endpoint corrected from `?cook=` during audit) | parity |
| Notifications read/read-all + navigation | `Notifications.jsx` | same endpoints; AppHeader badge; row taps deep-link to bookings/payouts/profile/reviews | parity |
| Profile/addresses/password/activity | `CustomerProfile.jsx`, `ProfileSectionPages.jsx` | same CRUD + validation; stats grid; Activity screen lists bookings + written reviews | parity |
| Availability toggle | `PATCH /cooks/me/availability` | same payload, native Switch | parity |
| Cancellation/refund reasons | `CancelBookingModal`, `CookCancelModal`, `RefundRequestModal` | same reason codes/labels, note required for OTHER, preview amount shown | parity |
| Reschedule | `RescheduleModal` (date/slots/replacement cook/reason) | native modal with date pager, slots, replacement cooks, reason chips | parity |
| Complaints + no-show | `ComplaintForm`, `NoShowModal` | role-specific categories, 10–2000 char message, cook no-show reason | parity |
| Cook profile create/edit | `CookSetup.jsx`, `CookScheduleEditor`, `CookPayoutPanel`, `CookDocUploads` | 404 → create; 7-day schedule; UPI/bank; upload `aadhar`/`pan`/`photo` and persist returned URLs | parity |
| Legal/contact | `Legal.jsx` five routes | in-place doc switcher + mail/phone/WhatsApp/Instagram actions | parity |
| Receipt/cook-doc upload | multipart document fields | `FormData` with backend field names (`aadhar`, `pan`, `photo`, receipts) | parity (needs device proof) |

Deliberate mobile differences: booking requires sign-in before
opening the Book tab (website lets guests fill the form then log in;
mobile keeps the draft save/resume machinery for session-expiry edge
cases); login `next` resumes via saved draft when opening Book; failure
toasts replace some inline banners; lists use pull-to-refresh instead
of SSE-only updates (SSE kept as a supplement); alarm sound →
Vibration.

Cannot yet match: Google Sign-In (no Android client IDs), push
notifications (no FCM), native map view (Maps links), admin console
(website remains ops UI), Razorpay stamp of approval (needs a live
emulator/device run + test keys).

1. Google Sign-In backend client IDs for Android — **still open**: web
   uses `REACT_APP_GOOGLE_CLIENT_ID`; no Android client registered in
   repo. Email auth implemented; native Google deferred.
2. Cook availability write payload — **resolved**:
   `PATCH /cooks/me/availability {status: "available"|"unavailable"}`
   (`backend/controllers/cookController.js toggleAvailability`).
   Mobile `CookSetupScreen` switch + `toggleAvailability()` match.
3. `POST /payments/order` fields — **resolved**:
   `{cook, date, startTime, endTime, durationHours, bookingId}` →
   `{orderId, amount, amountPaise, currency, keyId}` (201 new / 200
   reused). Mobile `BookingPaymentScreen` sends the full body and opens
   the native SDK with `order_id` + `key`, then
   `PATCH /bookings/:id/pay {method, payment:{razorpayOrderId,
   razorpayPaymentId, razorpaySignature}}` — same as
   `BookingPayment.jsx:205-277`, including 410-expired and
   409-alreadyPaid handling and the UPI/card/netbanking/wallet method
   filter.
4. `GET /cooks` item shape — **resolved**: `CookProfile` docs with
   populated `user{name,status}` (+email/phone for admin),
   `serviceArea`, `experienceYears`, `rating{average,count}`.
   Mobile cards read exactly these fields.
5. Admin mobile needs — explicitly out of MVP (website remains the
   ops console). *(accepted gap)*
6. Woman-presence restriction sync — **resolved**:
   `GET /bookings/verification/status` →
   `{blocked, blockedUntil, remainingSeconds}`; decline POST returns the
   same shape with code `BOOKING_TEMPORARILY_BLOCKED`; booking-create
   403 carries the same code. Mobile wizard restores status on the
   venue step, records declines, syncs 403 blocks, shows the countdown,
   and gates submit — matching `useWomanPresence.js` semantics.

## 9. Mobile parity batch (implemented)

- Root navigation now resolves tab-only routes through the `Customer`
  navigator (`BookingWait`, `BookingPayment`, `CookProfile`).
- Refund requests always send a non-empty reason; cancellation asks for
  the website's customer/cook reason codes and requires an explanation
  for `OTHER`.
- Cook documents use the backend's real multipart fields and the returned
  URL is persisted on the cook profile.
- Coupon codes survive Home → Book and login/resume; cook-profile
  "Book this cook" filters slots to that cook.
- Booking detail now exposes OTP, pay/wait gating, reason-aware cancel,
  reschedule, refund, complaint, no-show, contact links, cancellation
  history and review state.
- `MyBookingsScreen` shows the Start OTP and inline pay/wait/rate/detail
  actions; cook and customer lists auto-refresh.
- Cooks can create their own profile, edit weekly availability, save
  UPI/bank payout details, upload documents and toggle availability.
- Notifications open the related booking/payout/profile/reviews screen;
  the AppHeader shows an unread count.
- Legal covers terms, privacy, refunds, cancellation and contact in one
  switcher with working contact actions.
- Profile stats use `GET /auth/me/stats`; Activity lists recent bookings
  and reviews.
- Admins no longer fall into customer tabs: they get a web-console notice.
- Password changes persist the rotated JWT returned by
  `POST /auth/change-password`, so this device stays signed in while other
  devices are logged out.
- Terms/privacy are reachable before sign-in from Login/Register; the
  reset-password deep link is nested under the auth stack.
- The realtime stream uses React Native XHR (eventsource v5 cannot stream
  through RN's fetch polyfill), sends the JWT in `Authorization`, and
  reconnects with backoff; screens still poll as a fallback.
- Booking drafts are owner-scoped so an expired-session draft is never
  shown to a different account on the same device.
- Paid/confirmed bookings never return to checkout: the waiting screen
  sends them to details, and checkout refuses already-paid or non-payable
  bookings.
- Release manifests render `usesCleartextTraffic="false"`; debug keeps
  cleartext for the emulator only.

## 10. Remaining intentional blockers

1. **Google Sign-In** — requires Android OAuth client IDs and a native
   Google SDK configuration; email/password auth is complete.
2. **Push notifications** — requires FCM project credentials and a
   device token registration flow; in-app polling/SSE plus the unread
   badge are working.
3. **Native map view** — Maps deep links are used instead of embedding a
   map SDK; GPS pinning and address search links are present.
4. **Admin console** — desktop/web-only by design; mobile shows a notice
   and a link to the web console.
5. **Razorpay live proof** — the native SDK wiring is complete but still
   needs a device/emulator run with real test keys.
6. **Production signing** — no release keystore or credentials are in the
   workspace, so `release` currently falls back to the debug keystore.
   A real `CM_RELEASE_*` signing config must be supplied before shipping.
7. **Password-reset email link** — the backend emails a website URL
   (`/reset-password?token=...`), not a `cookmitra://` app link. The app
   screen works when the link is opened manually; changing outbound email
   templates is a backend/website change and was left untouched.

### Known P2 polish gaps

- Booking does not yet offer one-tap selection from saved addresses; the
  address form and the profile address book both work independently.
- The mobile booking detail does not show the website's live
  "hours remaining / cooking complete" WhatsApp banner. Service completion
  is handled by the backend's automatic hours-complete transition.
