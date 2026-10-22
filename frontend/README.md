# CookMitra — Android App (React Native CLI, JavaScript)

Native Android client for CookMitra (festive home-cook bookings),
built against the existing website + backend in `H:\Festive_Cook`
(branch `master`). JavaScript/JSX only, Android only, no Expo, no
TypeScript. See `WEBSITE_REFERENCE_MAP.md` for the website-to-mobile
mapping that governs every screen and API call.

## Stack

- React Native 0.87.1 + React 19.2.3 (official Community CLI template)
- React Navigation 7 (native-stack + bottom-tabs), lucide-react-native
  icons (same names as the website's `lucide-react`), axios,
  Redux Toolkit (auth state mirrors the website slice)
- Keychain (JWT) + AsyncStorage (profile, booking draft),
  react-native-config (`.env` → BuildConfig), SSE via `eventsource`
- react-native-razorpay (native checkout), datetimepicker,
  community geolocation, image-picker, netinfo

## Prerequisites

| Tool | Required | This machine |
|---|---|---|
| Node.js | ≥ 22.11 | `node --version` |
| npm | bundled | `npm --version` |
| JDK | 17 | `java -version` |
| Android SDK | platforms 34–37, build-tools | `%ANDROID_HOME%` (`$ANDROID_HOME`) |
| Android emulator or device | for install/launch | `adb devices` |

Backend: production is live behind nginx at `https://cookmitra.org/api`.
For local work the CookMitra backend runs on the dev machine
(`H:\Festive_Cook\backend`, `node server.js`). Emulator → host mapping
is `http://10.0.2.2:5000`; physical devices need the machine's LAN IP
over HTTP (dev) or an HTTPS URL (staging/production).

## Configure

```bat
cd frontend
copy .env.example .env
```

Edit `.env` (gitignored, placeholders only in `.env.example`):

- `API_BASE_URL` — production `https://cookmitra.org/api` (the default in
  `.env.example`); emulator `http://10.0.2.2:5000/api`;
  device `http://<laptop-LAN-IP>:5000/api`
- `WEB_ORIGIN` — public web origin used for shared review links
  (`https://cookmitra.org`)
- `RAZORPAY_KEY_ID` — **public key id only** (`rzp_test_*` for
  staging). Never put secrets here; the secret stays on the server.

Values are baked into the native build, so re-run `run-android` (or at
least `generateDebugResValues`) after changing `.env`; a Metro reload
alone will not pick them up.

## Install & run

```bat
npm ci
npx react-native start        :: Metro, separate shell
npx react-native run-android  :: debug build + install + launch
```

Release APK (signed with the debug key in this template — replace with
a private release keystore per `android/app/build.gradle` comments
before any store/distribution build; never commit `*.keystore`):

```bat
cd android && gradlew assembleRelease
:: output: android/app/build/outputs/apk/release/app-release.apk
```

## Tests

```bat
npx jest            :: 21 checks: validation, formatters, IST weeks,
                     :: role/config, Login screen states
npx eslint .        :: lint (template config)
```

## Project layout

`App.js` (providers + session bootstrap) · `src/theme` (brand tokens
from website `base.css`) · `src/utils` (ported validation/formatters/IST
weeks) · `src/api` (axios client + endpoint modules — same backend
contracts as the website) · `src/store` (auth slice + toast) ·
`src/navigation` (auth stack, customer tabs, cook tabs, role gating) ·
`src/features/{auth,customer,cooks,bookings,payments,payouts,profile,notifications,cook}`
· `src/services` (session, realtime SSE) · `assets/` (website logo/hero
images, copied verbatim).

## Role model (backend is the source of truth)

- customer → Home / Book / My Bookings / Alerts / Profile
- cook → Jobs / Earnings / Reviews / Setup / Alerts
- admin → website only (ops console; intentionally not in the app)

## Known gaps (see final report)

Google Sign-In (needs Android client IDs + SHA-1), push notifications
(in-app alerts + SSE only), native map view (Maps links instead),
admin console (website), Razorpay live keys (test keys only here).
