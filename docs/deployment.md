# Build & Deployment

## Backend (apps/api)

Any Node 20+ host works (Fly.io, Railway, Render, a plain VM, ECS, etc.).

```bash
pnpm install
pnpm db:generate
pnpm db:migrate:deploy   # prisma migrate deploy — safe for production
pnpm --filter @kryptonix/api start
```

There's no separate compiled `dist/` output — `start` runs the TypeScript
source directly via Node 22's built-in type-stripping
(`node --experimental-strip-types`), the same way `dev` runs it through
`tsx`. This was a deliberate choice once the whole repo's relative imports
used explicit `.ts` extensions (needed for `node --experimental-strip-types`
and for running `packages/shared`'s tests with zero dependencies — see
`PROGRESS.md`): emitting real `.js` via `tsc` while keeping `.ts` extensions
in the source needs TypeScript 5.7's `rewriteRelativeImportExtensions`,
which added more moving parts than it was worth versus just running the
source directly on a Node version that supports it natively. `pnpm --filter
@kryptonix/api build` still exists as a type-check-only sanity command
(`tsc --noEmit`), it just doesn't produce an artifact.

Required env vars: everything in `.env.example` with no default — at
minimum `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
Generate the two JWT secrets with `openssl rand -base64 48` — never reuse
the same value for both.

Point Razorpay's webhook configuration at
`https://<your-api-host>/api/v1/webhooks/razorpay` and copy the webhook
secret it gives you into `RAZORPAY_WEBHOOK_SECRET`.

## Mobile (apps/mobile)

This repo is built for **Expo + EAS Build**, which builds both platforms
in the cloud — a Mac is not required even for iOS.

```bash
npm install -g eas-cli
cd apps/mobile
eas login
eas build:configure
```

### Android

```bash
eas build --platform android --profile development   # installable dev client
eas build --platform android --profile preview        # internal-testing APK/AAB
eas build --platform android --profile production      # signed AAB for Play Console
```

Android Studio is only needed locally if you want a local emulator
(`apps/mobile && npx expo run:android`) instead of `expo start` with a
physical device/Expo Go-equivalent dev client. EAS Build does not need it.

### iOS

```bash
eas build --platform ios --profile development
eas build --platform ios --profile preview     # TestFlight
eas build --platform ios --profile production   # App Store Connect submission
```

An Apple Developer account ($99/yr) is required before a `production`
build can be code-signed; `eas build:configure` walks through connecting
it. Xcode itself is not required on the machine running `eas build` — EAS's
cloud builders handle signing — but is useful locally for simulator testing
(`npx expo run:ios`, macOS only).

### Store submission checklist

Do not mark store-ready until all of these are true (per the project's own
rule 1195 in the original spec — repeated here so it isn't missed):

- [ ] Real app icon, splash screen and adaptive icon assets (placeholders
      currently referenced in `app.json` — see `PROGRESS.md`)
- [ ] Privacy policy + terms of service URLs (KryptonIX's site already has
      these — link them in `app.json`'s store listing metadata)
- [ ] iOS privacy "nutrition label" (App Store Connect) and Android Data
      Safety form filled out accurately for what this app actually collects
- [ ] Production Razorpay keys (not test-mode) and a verified Razorpay
      business account
- [ ] `apple-app-site-association` / Android App Links configured if deep
      links (invitation/verification emails) should open the installed app
- [ ] Crash reporting wired up (Sentry DSN is reserved in `.env.example`)

## CI

`.github/workflows/ci.yml` runs `pnpm install`, Prisma generate, typecheck,
and `pnpm test` (the shared-package unit tests, which need no external
services) on every push/PR. **This could not be run inside the sandbox
this project was built in** — that environment has no access to the npm
registry — so CI running green on GitHub is the first real confirmation
that `pnpm install` resolves cleanly. See `PROGRESS.md` for the full
explanation.
