# AI Handoff — Education SaaS Platform

## Project identity

- Product: Sri Lanka-first Education SaaS platform combining LMS + IMS.
- Repository: `https://github.com/ChalanaNilupul/edu-platform.git`
- Primary market: Sri Lanka.
- Initial languages: English, Sinhala and Tamil.
- Initial currency: LKR.
- Product serves independent teachers and educational institutes, including multi-branch organizations.

## Current status

- **Current phase:** Phase 1 — Repository and development foundation.
- **Current task:** Phase 1.1 — Establish repository tooling and workspace conventions.
- Phase 0.4 requirements and user journeys approved and documented.
- Phase 0.5 architecture decisions 0.5.1–0.5.8 approved; consolidated architecture baseline approved on 2026-11-11.
- Phase 0.6 implementation readiness reviewed. Development is authorized to proceed.
- Phase 0.2 customer/competitor desk research is deferred, not completed. Teacher interviews are not a prerequisite. Revisit desk research and prototype validation after an initial working prototype.
- Current working branch: `feat/phase-1-foundation`. Confirm the actual local branch and Git status before making changes.
- The branch was published to `origin`; do not assume later commits have been pushed or merged without checking.

## Immediate next task

Complete Phase 1.1 before generating application projects:

1. Confirm a supported Node.js LTS version.
2. Select the package manager and lockfile strategy.
3. Agree the initial workspace/monorepo layout.
4. Establish shared TypeScript, linting and formatting conventions.
5. Update `PROJECT_STRUCTURE.md` to reflect the actual agreed layout.

Make one technical decision at a time when user approval is needed. Explain the recommendation and trade-offs. Do not silently introduce additional infrastructure or tooling.

## Approved MVP

1. Student and teacher management.
2. Class and batch management.
3. Attendance and finance.
4. Learning management.
5. Examinations.
6. Student portal.
7. Basic parent portal.
8. Announcements and in-app notifications.
9. Basic reports.

Explicit MVP exclusions include live classrooms, AI features, online payment gateway, QR attendance, native mobile apps, advanced accounting/payroll, full white-label implementation, dedicated enterprise deployments and international market/payment/compliance support.

## Approved service models

1. Shared SaaS first: centrally managed app, shared PostgreSQL and storage with strict tenant isolation.
2. White-label SaaS later: same core platform, custom branding/domain, shared infrastructure.
3. Dedicated enterprise later: separate application deployment, database and storage as required.

## Approved architecture decisions

- **Database:** Shared PostgreSQL initially; workspace-owned records have tenant association; server-side membership validation; PostgreSQL RLS as additional protection; future tenant registry and database routing for dedicated customers.
- **Identity:** One global user identity across workspaces; separate users, workspaces, memberships, roles, permissions and invitations.
- **Authorization:** Hybrid RBAC plus resource-level and branch-level restrictions; predefined roles and configurable permissions; backend enforcement.
- **Support access:** Platform admin access to private customer/student data must be temporary, explicitly approved, purpose-limited, scoped, time-limited and audited. No unrestricted default access.
- **Storage:** Cloudflare R2 initially; provider-independent S3-compatible abstraction; private files; short-lived signed access; quota tracking and metadata in PostgreSQL.
- **Subscriptions:** Configurable plans, subscriptions and entitlements; manual initial billing; backend enforcement; no deletion of existing data due to limits/expiry.
- **Application:** Modular monolith; Next.js + TypeScript frontend; Node.js + NestJS + TypeScript backend; PostgreSQL + Prisma; Tailwind; Docker from beginning. Redis/BullMQ deferred until justified; Socket.IO later when required.
- **Deployment:** Managed cloud hosting, low initial cost, separate frontend/backend services, managed database, one suitable region initially, backups, monitoring, stateless services and future horizontal scaling/dedicated customer infrastructure.
- **API:** REST + JSON, `/api/v1`, OpenAPI/Swagger, consistent responses/errors, server validation, future scoped external API and webhook support.

See `ARCHITECTURE.md` for the full baseline and safeguards.

## Open detailed-design questions

Do not invent answers. Resolve them before the relevant implementation:

- Exact managed cloud provider, region and service plans.
- Exact managed PostgreSQL provider and backup/PITR/recovery objectives.
- Cookie-based session versus access/refresh token implementation.
- Exact API response envelope, pagination, filtering and sorting conventions.
- CI/CD release approval and rollback process.
- External API key lifecycle and webhook event catalogue.
- File scanning and retention implementation.
- Monitoring provider and alert thresholds.

## Collaboration and implementation rules

1. Before working on any computer, run `git pull`.
2. Work on one computer at a time.
3. Use task branches; do not develop directly on `main`.
4. Review diffs and run relevant formatting, lint, type-check, test and build commands before merge.
5. Update docs whenever approved decisions or verified implementation status changes.
6. Never commit secrets, credentials, student personal data or production exports.
7. Do not mark implementation complete until implemented, checked and reviewed.
8. Be transparent about GitHub access; never claim a push/merge without confirmation.
9. Preserve existing project files and inspect them before replacing or restructuring.
10. Prefer the simplest solution consistent with the approved architecture; do not add Redis, BullMQ, microservices or cloud infrastructure prematurely.

## Phase 1 sequence

1. Repository tooling and workspace conventions.
2. Next.js frontend foundation.
3. NestJS backend foundation.
4. Docker-based local PostgreSQL and Prisma setup.
5. Initial API health check, validation and OpenAPI setup.
6. GitHub Actions checks and documented local development workflow.

See `ROADMAP.md` for task breakdowns and acceptance criteria.
