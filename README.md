# KryptonIX Client

Cross-platform mobile app (Android + iOS, React Native/Expo) connecting
**KryptonIX Digital & AI Solutions** ([kryptonix.digital](https://kryptonix.digital/))
with its clients across the full lifecycle: service discovery, quotations,
agreements, **payments**, project tracking, communication, deliverable
approval, and support.

See **[`PROGRESS.md`](./PROGRESS.md)** for exactly what's implemented vs.
planned, and why — read that before anything else in this repo.

## Monorepo layout

```
apps/mobile/     Expo + React Native + TypeScript + Expo Router
apps/api/        Fastify + TypeScript + Prisma REST API
packages/shared/ Shared types, zod DTOs, RBAC, money math, auth crypto
prisma/          Database schema, migrations, seed script
docs/            Architecture, database design, API contracts, security, deployment
```

## Quick start

```bash
pnpm install
cp .env.example apps/api/.env     # fill in DATABASE_URL at minimum; see docs/PAYMENTS.md for Razorpay test keys
pnpm db:migrate
pnpm db:seed
pnpm dev:api        # http://localhost:4000
pnpm dev:mobile      # scan the QR with Expo Go, or press i / a
```

## Docs

- [`docs/architecture.md`](./docs/architecture.md) — system design & why these choices
- [`docs/database-design.md`](./docs/database-design.md) — schema rationale, ownership, deletion rules
- [`docs/api-contracts.md`](./docs/api-contracts.md) — every endpoint, implemented or planned
- [`docs/PAYMENTS.md`](./docs/PAYMENTS.md) — the full payment/webhook sequence
- [`docs/security.md`](./docs/security.md) — auth, RBAC, secrets, known gaps
- [`docs/deployment.md`](./docs/deployment.md) — API hosting + EAS Build for both app stores

## License

Proprietary — KryptonIX Digital & AI Solutions. Not for redistribution.
