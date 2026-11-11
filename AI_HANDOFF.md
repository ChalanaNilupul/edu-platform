# AI Handoff — Edu Platform

Read this file, `README.md`, `ROADMAP.md`, `REQUIREMENTS.md` and `PROJECT_STRUCTURE.md` before making project changes. Treat the repository as the source of truth; do not assume a feature is implemented because it was discussed or included in the approved scope.

## Product context

Edu Platform is a Sri Lanka-first, multi-tenant SaaS LMS + IMS for independent tuition teachers and educational institutes.

- Initial market: Sri Lanka.
- Initial currency: LKR.
- Planned initial languages: English, Sinhala and Tamil.
- Customer types: independent tuition teachers and institutes, including multi-branch organizations.
- The product is one modular platform with multiple customer workspaces.

## Approved business model

1. **Shared SaaS first:** customers create workspaces on a centrally managed application and storage infrastructure. Tenant data and files must be isolated.
2. **White-label SaaS later:** customer branding and custom domains on the same core application and shared infrastructure.
3. **Dedicated enterprise in the future:** separate application deployment, database and storage for customers who require dedicated infrastructure.

A custom domain does not itself require a separate application or database.

Pricing must support configurable plans and entitlements, including possible limits for students, staff, branches, storage, bandwidth, modules, branding/domain features and support. Plan/entitlement foundations should be considered in architecture; automated billing can be implemented later.

## Approved MVP

The user approved the full six-module MVP plus parent portal, announcements/notifications and basic reports. The complete requirements baseline is in `REQUIREMENTS.md`.

1. Student and teacher management: profiles, guardian details, enrollment and CSV import.
2. Class and batch management: subjects, classes, batches, teacher assignments and schedules.
3. Attendance and finance: manual attendance, monthly fees, cash/bank payment records, outstanding balances, receipts and payment history.
4. LMS: lessons, PDF/video resources, assignments, submissions and teacher feedback.
5. Examinations: question bank, MCQ/true-false, timed exams, automatic marking, results and rankings.
6. Student portal: enrolled classes, resources, assignments, exams, attendance and results.
7. Parent portal: linked children, attendance, results, fee status and announcements.
8. Announcements and in-app notifications with audience targeting.
9. Basic student, attendance, examination and financial reports.

### Onboarding models

- Independent teacher: create account/workspace, create classes and add students without an institute.
- Institute: create organization, configure branches, invite staff and manage multiple teachers.

Both use the same platform. Tenant boundaries and role permissions must be enforced server-side.

## Security and support-access decisions

- Platform administrator access to private tenant records is **not available by default**.
- Support access requires explicit customer approval, a documented reason, defined scope, a limited duration, automatic expiration, revocation and audit logging.
- Students can access only their own records.
- Parents can access only explicitly linked children.
- Teachers can access only assigned classes and permitted student information.
- Branch managers are restricted to assigned branches.
- Apply tenant/role checks to APIs, database queries, file access, reports, exports, background jobs, notifications and realtime events.
- Do not expose private student information in application logs.

## Explicit MVP exclusions

Do not silently add live video classrooms, live quiz competitions/leaderboards, polls, Q&A, interactive whiteboards, AI generation/summarization/predictive analysis, online payment gateways, QR attendance, native Flutter apps, advanced accounting/payroll/tax automation, full white-label/custom-domain tooling, dedicated enterprise deployments or international market/payment/compliance implementation to the MVP.

Keep architecture extensible but avoid implementing future-market complexity prematurely.

## Current state and next task

- Current phase: **Phase 0 — Product discovery and planning**
- Current task: **0.5 — Architecture and technology decisions**
- Completed: 0.1 product vision; 0.3 MVP scope; 0.4 requirements and user journeys (approved and documented).
- In progress: 0.2 desk research and competitor analysis. The user cannot conduct teacher interviews; do not make interviews a blocker. Use public competitor information, public reviews/documentation and realistic teacher/institute/student/parent scenarios.
- Next action: define and compare architecture options for tenant isolation, database strategy, storage, domain routing, subscription entitlements, deployment topology, authentication, notifications and integrations.
- Do not begin application implementation until Phase 0.5 architecture decisions are sufficiently clear.

## Proposed stack — not finalized

Potential direction:
- Next.js + TypeScript + Tailwind for web.
- NestJS + TypeScript for API.
- PostgreSQL + Prisma for persistence.
- Socket.IO for realtime features when required.
- Redis for caching/background jobs.
- S3-compatible object storage.
- Flutter mobile applications in a later release.
- Docker for local development and deployment.

Confirm the stack, tenant model, deployment assumptions, storage design and integrations during Phase 0.5. Start with a modular monolith, not microservices.

## Working rules

1. Work in small, verifiable tasks. State the current phase, task ID and next action when guiding the user.
2. Before changing code, inspect the existing repository and its conventions.
3. Do not overwrite existing work without checking it first.
4. Keep tenant identity explicit in authorization and data access. Never trust a tenant ID supplied by a client without validating membership and permissions.
5. Design authorization tests that attempt cross-tenant access.
6. Validate inputs at API boundaries and avoid exposing private student information in logs.
7. Never commit `.env` files, credentials, API keys, real student data or production exports.
8. Update `ROADMAP.md`, `README.md` and this file when project status materially changes.
9. Mark planning tasks complete only when documented acceptance criteria are met and reviewed. Mark implementation tasks complete only after implementation, relevant checks and review.
10. Give Windows PowerShell-friendly commands when providing local setup instructions.
11. Do not assume the user can interview teachers; use the agreed desk-research approach.

## Git workflow

- Before starting on a computer: `git pull`.
- Work on one computer at a time; avoid simultaneous edits from office and personal computers.
- Use a task branch, for example `docs/requirements-baseline` or `task/0.5-architecture-decisions`.
- Run relevant checks, update progress documents, commit and push.
- Merge the completed task branch before switching computers.
- Never claim a push, commit or deployment succeeded unless the command/tool confirms it.
- Do not overwrite remote or local changes without reviewing them first.

## Suggested next work

1. Continue desk research using public sources and record findings with source links.
2. Start Phase 0.5 with architecture decision records.
3. Compare shared-database tenant isolation strategies and their security/testing trade-offs.
4. Define file storage, tenant quotas, custom-domain routing and future dedicated deployment boundaries.
5. Define plan/entitlement modeling and usage metering, while deferring automated billing.
6. Confirm the technology stack and architecture before scaffolding application code.
