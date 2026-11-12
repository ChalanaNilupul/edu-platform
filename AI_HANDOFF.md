# EduPlatform — AI Development Handoff

Last updated: November 12, 2026

This document is the current development handoff and implementation reference for AI-assisted development.

It records the actual project direction, technical architecture, implementation progress, outstanding work and development priorities.

## Current state at a glance

- Phase 2 Batch 1 is implemented: workspace roles, memberships, invitations, email verification, password reset, CSRF/security headers, rate limiting and the matching frontend.
- Verified by 74 unit tests and 33 mocked HTTP E2E tests, plus typecheck, lint, format and a successful `next build`.
- Not verified: real database integration, PostgreSQL RLS, browser walkthrough, runtime rate-limit and Origin behavior.
- Nothing has been committed, pushed or merged as part of this work.

---

# 1. Project Overview

EduPlatform is a modular SaaS platform combining:

- Learning Management System (LMS).
- Institute Management System (IMS).

Initial target market: Sri Lanka.

Target customers:

1. Independent tuition teachers.
2. Educational institutes.
3. Multi-branch educational organizations.

The platform must support multiple workspaces, with strict data isolation between tenants.

The product should be developed as a practical, production-oriented MVP rather than a collection of disconnected demonstrations.

# 2. Repository Information

Repository:

https://github.com/ChalanaNilupul/edu-platform

Current development branch:

`feat/phase-2-identity`

Current development phase:

**Phase 2 — Identity and Workspace Foundation**

Do not assume that Phase 2 has been merged into `main`.

The actual local Git state must be checked before proposing commits, pushes or merges.

# 3. Technology Stack

## Frontend

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.

## Backend

- Node.js.
- NestJS.
- TypeScript.
- REST JSON API.

## Database

- PostgreSQL.
- Prisma ORM.

## Infrastructure

- pnpm monorepo.
- Docker development environment.
- GitHub Actions CI.
- Cloudflare R2 planned for file storage.

## API

- API prefix: `/api/v1`.
- Swagger/OpenAPI foundation.
- Request validation.
- Cookie-based authentication.

# 4. Repository Structure

```text
edu-platform/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── workspaces/
│   │   │   ├── mail/
│   │   │   ├── common/
│   │   │   ├── health/
│   │   │   ├── prisma/
│   │   │   └── generated/
│   │   └── test/
│   └── web/
│       └── src/
│           ├── app/
│           ├── components/
│           └── lib/
├── infra/
│   └── docker/
├── .github/
│   └── workflows/
├── ROADMAP.md
├── README.md
├── AI_HANDOFF.md
└── package.json
```

# 5. Completed Technical Foundation

The following foundation has been implemented:

- pnpm monorepo.
- Next.js frontend.
- NestJS backend.
- TypeScript.
- PostgreSQL.
- Prisma ORM.
- Docker development database.
- API health endpoint.
- Swagger/OpenAPI foundation.
- Environment configuration.
- ESLint and Prettier.
- Automated test infrastructure.
- GitHub Actions CI workflow.

Phase 1 is considered complete.

# 6. Database and Identity Implementation

Current identity-related models include:

## User

Represents a global user identity.

Users can belong to multiple workspaces.

## Workspace

Represents an independent teacher workspace or institute workspace.

Workspace types:

- `TEACHER`
- `INSTITUTE`

## Membership

Connects users with workspaces.

Membership statuses currently include:

- `ACTIVE`
- `SUSPENDED`

A membership is required for workspace access.

Each membership carries a predefined `WorkspaceRole`:

- `OWNER`
- `ADMIN`
- `BRANCH_MANAGER`
- `TEACHER`
- `STUDENT`
- `PARENT`

A `(userId, workspaceId)` unique constraint allows a single membership per user per workspace. `OWNER` bypasses role checks; every other role is matched against the roles required by a route.

## Session

Stores database-backed authentication sessions.

Session tokens are hashed before storage.

The session model also contains a nullable `activeWorkspaceId` field.

The active workspace must be validated against the authenticated user's membership.

## WorkspaceInvitation

Stores pending workspace invitations.

- Unique `(workspaceId, email)` so re-inviting refreshes rather than duplicates.
- Invitation tokens are hashed (SHA-256) before storage; the raw token only exists in the emailed link.
- Status values: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`.
- Seven-day expiry by default.
- Acceptance requires the signed-in user's email to match the invited email.

## EmailVerificationToken and PasswordResetToken

Single-use, hashed tokens attached to a user with an expiry.

- Raw tokens are never persisted.
- Verification/reset tokens are marked as used (or deleted) after consumption.
- Password reset revokes the user's existing sessions.

# 7. Authentication Implementation

Implemented backend functionality:

- User registration.
- Email normalization.
- Argon2id password hashing.
- User login.
- Password verification.
- Database-backed sessions.
- Cryptographically random session tokens.
- SHA-256 token hashing.
- Seven-day session expiry.
- Logout.
- Session invalidation.
- Current-user/session retrieval.
- Email verification (token issue, verify, resend).
- Password reset (token issue, reset, session revocation).
- Origin/Referer CSRF enforcement for unsafe HTTP methods.
- Global rate limiting via `ThrottlerGuard` plus tighter per-route limits on auth endpoints.
- Security headers.
- Provider-agnostic `MailService` with a console driver (`MAIL_DRIVER=console`) used outside production.

Implemented frontend functionality:

- Registration page.
- Login page.
- Protected dashboard.
- HTTP-only `edu_session` cookie usage.
- Logout interface.
- Email verification page.
- Forgot-password and reset-password pages.
- Invitation acceptance page.

Authentication cookie configuration includes:

- HTTP-only.
- Secure in production.
- SameSite Lax.
- Path `/`.
- Expiration based on session expiry.

The backend uses a session authentication guard for protected routes.

# 8. Workspace Implementation

## Backend

Implemented:

- Teacher workspace creation.
- Institute workspace creation.
- Initial active membership creation.
- Workspace listing for authenticated users.
- Active workspace switching.
- Session active workspace persistence.
- Membership validation during workspace switching.
- Database transactions for workspace creation and switching.
- Workspace detail retrieval limited to members.
- Membership listing, role changes and member removal.
- Role-aware authorization through `WorkspaceAccessService` and a roles guard.
- Workspace invitations (create, list, revoke, accept) with email-bound acceptance.

Workspace creation associates the new workspace with the authenticated user as `OWNER`.

The creation operation also updates the active workspace on the current session.

Role rules currently enforced:

- Owner can change roles of non-owner members and remove non-owner members.
- Admins can invite and manage `TEACHER`, `STUDENT` and `PARENT`, but cannot invite or manage `ADMIN` members.
- Nobody can change or remove the owner, and users cannot change their own role or remove themselves.

## Frontend

Implemented:

- Workspace manager component.
- Workspace listing.
- Workspace creation form.
- Workspace creation modal.
- Workspace switching interface.
- Dedicated `/workspaces` page.
- Sidebar navigation entry for workspaces.
- Active workspace restoration from the session.
- Member management page (`/workspaces/[workspaceId]/members`) with invitations, role changes and removal.
- Invitation acceptance page.
- Loading and error states.

Remaining:

- Complete manual browser verification of the new flows.
- Better workspace overview and settings.
- Member suspension (distinct from removal).

# 9. Current Frontend State

Current application routes include:

```text
/
├── /login
├── /register
├── /forgot-password
├── /reset-password
├── /verify-email
├── /invitations/accept
└── /workspaces
    └── /workspaces/[workspaceId]/members
```

The dashboard currently contains:

- Sidebar navigation.
- Welcome section.
- Summary statistic cards.
- Workspace overview.
- Upcoming classes section.

Important:

Several dashboard statistics and upcoming classes are demonstration data.

They must not be represented as real student, attendance, finance or timetable records.

The final dashboard must retrieve workspace-scoped information from the relevant backend modules.

All new pages were compiled and built successfully. They have not been walked through in a browser yet because a local PostgreSQL instance was unavailable during development.

# 10. Testing Status

Current verified results after the Batch 1 (Phase 2) work:

## Unit Tests

74 tests passed across 7 files:

- Authentication service.
- Workspace service.
- Workspace access service.
- Memberships service.
- Invitations service.
- Session guard.
- Workspace roles guard.

## E2E HTTP Tests

33 tests passed across 3 files:

- Authentication E2E (13).
- Workspace and invitation E2E (19).
- Application E2E (1).

## Static Checks

- API typecheck passed.
- API lint passed.
- Web lint passed.
- Prettier format check passed.
- `next build` compiled successfully for all routes.

## What the mocked tests do not prove

- Database integration (no real PostgreSQL was available locally).
- PostgreSQL RLS enforcement.
- Browser behavior and layout of the new pages.
- Runtime behavior of rate limiting and Origin checking.

Important testing distinctions:

1. Unit tests validate isolated business logic.
2. Mock-based HTTP tests validate controller behavior.
3. Database integration tests validate real database interactions.
4. Manual browser tests validate real frontend workflows.
5. Security testing validates authorization and isolation.

Passing mocked tests does not prove full database integration or tenant security.

Do not claim unverified checks are complete.

# 11. Remaining Phase 2 Work

## Authentication Security

- Verify rate limiting at runtime.
- Verify Origin checking at runtime.
- Complete authentication security review.
- Longer-term: stronger CSRF token scheme if the app adds cross-site embedding.
- Longer-term: production mail delivery driver (the console driver only logs links).

Implemented already: email verification, password reset, Origin/Referer enforcement, rate limiting, security headers.

## Workspace Management

- Verify creation and switching manually in a browser.
- Implement member suspension (removal is done, suspension is not).
- Longer-term: better workspace overview and settings.

Implemented already: dedicated `/workspaces` route, sidebar navigation, active workspace restoration, invitations, invitation acceptance, invitation expiry and revocation, membership listing, role changes and removal.

## Tenant Isolation

- Implement PostgreSQL RLS.
- Set tenant context transaction-safely.
- Verify pooled connection safety.
- Add database-backed cross-tenant integration tests.

Implemented already: tenant context resolution through the session's active workspace, active membership enforcement, server-side workspace authorization, workspace-scoped queries, and mocked cross-tenant access tests (403 on cross-tenant resources, 403 on insufficient roles, email-bound invitation acceptance).

The application-layer isolation is complete for the models that exist today. PostgreSQL RLS is deliberately deferred: it requires a connection-pool-safe transaction-scoped `SET LOCAL` strategy that is a structural change, and it should be implemented together with database-backed integration tests rather than mocked tests.

# 12. Approved Architecture Decisions

These are approved design constraints and should not be changed casually.

## Multi-Tenancy

Initial model:

- Shared PostgreSQL database.
- Shared application infrastructure.
- Tenant-scoped workspace records.
- Server-side membership validation.
- PostgreSQL RLS as an additional security layer.

Future model:

- Hybrid database registry.
- Dedicated database option for enterprise tenants.
- Migration path from shared to dedicated infrastructure.

## Identity

- One global user identity.
- Multiple workspace memberships.
- Separate User, Workspace, Membership, Session, Role and Permission concepts.
- Workspace membership determines access.

## Authorization

- Hybrid RBAC.
- Resource restrictions.
- Branch-level restrictions.
- Predefined roles.
- Custom roles where appropriate.
- Backend authorization is mandatory.

Tenant isolation must never be bypassed by platform roles.

Implemented decisions from the Batch 1 work:

- Roles are a predefined `WorkspaceRole` enum on `Membership`, not free-form strings. Custom roles, if added later, should be additive rather than replacing the enum's fast path.
- Authorization is centralized in `WorkspaceAccessService.getActiveMembership` and `requireRoles`, plus a `WorkspaceRolesGuard`. Controllers stay thin.
- The owner role implicitly satisfies every role requirement, but ownership itself cannot be transferred or revoked through the member endpoints.
- An admin cannot promote anyone to `ADMIN` or manage another admin, which prevents admin-chain escalation.

## Authentication

- Sessions are database-backed opaque tokens in an HTTP-only `edu_session` cookie. No JWT. This allows immediate revocation on logout, role change or password reset.
- Session tokens and all email/reset/invitation tokens are stored only as SHA-256 hashes.
- Email verification uses single-use hashed tokens. Unverified users can still sign in for now; enforcement should be introduced when email-dependent features appear.
- Password reset revokes all existing sessions for the user.
- CSRF is mitigated with Origin/Referer validation on unsafe methods combined with SameSite=Lax cookies. A dedicated CSRF token scheme is a later hardening step, not a current blocker.
- Rate limiting uses NestJS Throttler with a global guard plus tighter per-route overrides on auth endpoints.
- Mail is sent through a provider-agnostic `MailService`; in development the console driver logs the link. No SMTP or vendor credentials are committed.

## Multi-Tenancy — Deferred Decision

- Application-layer tenant isolation is implemented and tested.
- PostgreSQL Row-Level Security is intentionally deferred until it can be implemented with transaction-scoped `SET LOCAL` tenant context and verified against a real database. It must not be faked with a session-variable approach that is unsafe under connection pooling.

## Storage

Planned Cloudflare R2 integration.

Requirements:

- Private by default.
- Backend-authorized uploads.
- Short-lived signed URLs.
- File metadata stored in PostgreSQL.
- Storage quotas.
- Provider-independent S3 abstraction.

## Billing

- Entitlement-based subscriptions.
- Manual billing initially.
- Backend enforcement.
- Downgrades must not delete customer data.

## Backend Architecture

- Modular monolith.
- Modules own business logic.
- Clear module interfaces.
- REST JSON API under `/api/v1`.

## Infrastructure

- Docker development environment.
- Separate frontend and API deployments.
- Managed PostgreSQL.
- Managed file storage.
- Staging and production environments.
- GitHub Actions CI/CD.
- Backups and point-in-time recovery.
- Health checks.
- Logging and monitoring.
- Connection pooling.
- Rate limiting.

Avoid premature multi-region infrastructure.

# 13. Platform Administrator Security

Platform administrators must not have unrestricted access to private tenant or student records.

Exceptional access must be:

- Explicitly approved.
- Purpose-limited.
- Resource-scoped.
- Time-limited.
- Fully audited.
- Automatically revoked.

This requirement is a core security constraint.

# 14. Product MVP Development Order

After Phase 2, development should follow this sequence.

## Phase 3 — Student Management

- Student profiles.
- Parent and guardian information.
- Student enrollment.
- Student directory.
- Search and filtering.
- Pagination.
- Student editing.
- CSV import with validation.

## Phase 4 — Teacher Management

- Teacher profiles.
- Teacher invitations.
- Teacher assignments.
- Teacher availability.

## Phase 5 — Classes and Batches

- Class creation.
- Batch management.
- Subjects.
- Teacher assignments.
- Student enrollment.
- Timetables.

## Phase 6 — Attendance

- Manual attendance.
- Attendance history.
- Attendance summaries.
- Reports.

## Phase 7 — Finance

- Fee structures.
- Monthly fees.
- Cash and bank payments.
- Outstanding balances.
- Receipts.
- Payment history.
- Finance reports.

## Phase 8 — Learning

- Lessons.
- PDF and video resources.
- Assignments.
- Student submissions.
- Teacher feedback.

## Phase 9 — Examinations

- Question bank.
- MCQ.
- True/false.
- Timed examinations.
- Automatic marking.
- Results.
- Rankings.

## Phase 10 — Portals

- Student portal.
- Parent/guardian portal.
- Learning progress.
- Attendance visibility.
- Fee visibility.

## Phase 11 — Communication and Reporting

- Announcements.
- In-app notifications.
- Basic operational reports.

# 15. Features Outside the Initial MVP

Do not prioritize these before the core product is working:

- Live classrooms.
- Live quizzes.
- Whiteboards.
- Real-time collaboration.
- AI-powered features.
- Payment gateways.
- QR attendance.
- Advanced accounting.
- Payroll and tax.
- Native Flutter applications.
- Full white-label custom domains.
- Dedicated enterprise deployments.

# 16. Immediate Development Priorities

Follow this order:

1. Start PostgreSQL locally and run database integration tests (migrations + Prisma against a real database).
2. Manually walk through registration, verification, login, workspace creation/switching, invitations, role changes and password reset in a browser.
3. Verify rate limiting and Origin checking at runtime.
4. Implement PostgreSQL RLS with transaction-scoped tenant context and add cross-tenant integration tests.
5. Complete the Phase 2 security review.
6. Start Phase 3 — Student Management.

Do not add student, attendance or finance modules before steps 1–5 are done. The application-layer authorization is in place, but the RLS layer and real-database verification are still open.

# 17. Development Rules for AI Assistance

The developer prefers:

- Direct and practical implementation.
- One task at a time.
- Clear explanations of unfamiliar commands.
- Exact file paths and code changes.
- Small, focused modifications.
- No unnecessary full-file dumps.
- No repeated testing without a concrete reason.
- No claiming changes were made unless verified.
- No claiming GitHub pushes or merges without confirmation.
- No unnecessary architecture rewrites.
- Prioritize functional MVP features over endless testing.

When a task is completed:

1. Explain what was implemented.
2. State exactly what was tested.
3. Distinguish mocked tests from real integration tests.
4. Update ROADMAP.md.
5. Update this handoff if architecture or implementation status changed.
6. Identify the next practical development task.

If the user explicitly asks to commit and push, provide exact Git commands without adding unnecessary review gates.

**The goal is to build a working education-management product, not merely a technically impressive foundation.**
