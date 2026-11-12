# EduPlatform — AI Development Handoff

Last updated: November 12, 2026

This document is the current development handoff and implementation reference for AI-assisted development.

It records the actual project direction, technical architecture, implementation progress, outstanding work and development priorities.

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
│   │   │   └── generated/
│   │   └── test/
│   └── web/
│       └── src/
│           ├── app/
│           └── components/
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

## Session

Stores database-backed authentication sessions.

Session tokens are hashed before storage.

The session model also contains a nullable `activeWorkspaceId` field.

The active workspace must be validated against the authenticated user's membership.

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

Implemented frontend functionality:

- Registration page.
- Login page.
- Protected dashboard.
- HTTP-only `edu_session` cookie usage.
- Logout interface.

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

Workspace creation associates the new workspace with the authenticated user.

The creation operation also updates the active workspace on the current session.

## Frontend

Implemented:

- Workspace manager component.
- Workspace listing.
- Workspace creation form.
- Workspace creation modal.
- Workspace switching interface.
- Loading and error states.

Remaining:

- Dedicated `/workspaces` page.
- Sidebar navigation.
- Active workspace restoration after refresh.
- Complete browser verification.
- Better workspace overview and settings.

# 9. Current Frontend State

Current application routes include:

```text
/
├── /login
└── /register
```

The dashboard currently contains:

- Sidebar navigation.
- Welcome section.
- Summary statistic cards.
- Workspace overview.
- Upcoming classes section.
- Workspace management interface.

Important:

Several dashboard statistics and upcoming classes are demonstration data.

They must not be represented as real student, attendance, finance or timetable records.

The final dashboard must retrieve workspace-scoped information from the relevant backend modules.

The workspace management interface is not yet fully integrated into a dedicated route and shared navigation structure.

# 10. Testing Status

Previously reported test results include:

## Workspace E2E HTTP Tests

9 tests passed.

## Authentication E2E HTTP Tests

7 tests passed.

## Application E2E HTTP Tests

1 test passed.

## Combined E2E Result

17 tests passed across 3 test files.

Authentication service unit tests and controller HTTP tests have also been implemented.

Additional reported checks:

- API typecheck passed.
- API lint passed.
- Frontend and backend lint passed after import, JSX and React effect fixes.
- Three non-blocking Next.js navigation warnings were reported.
- Prettier formatting was being corrected.

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
- Implement stronger CSRF protection.
- Implement email verification.
- Implement password reset.
- Complete authentication security review.

## Workspace Management

- Create dedicated `/workspaces` route.
- Add workspace navigation to the sidebar.
- Restore active workspace after refresh.
- Verify creation and switching manually.
- Implement workspace invitations.
- Implement invitation acceptance.
- Implement invitation expiration.
- Implement membership management.

## Tenant Isolation

- Implement tenant context resolution.
- Enforce active workspace membership.
- Ensure backend queries are workspace-scoped.
- Ensure every workspace-owned record has a tenant identifier.
- Implement PostgreSQL RLS.
- Set tenant context transaction-safely.
- Verify pooled connection safety.
- Implement cross-tenant access tests.
- Complete tenant security review.

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

1. Finish workspace management.
2. Implement dedicated workspace page.
3. Add workspace sidebar navigation.
4. Restore active workspace after refresh.
5. Implement invitations and membership management.
6. Complete authentication security work.
7. Implement tenant authorization.
8. Implement PostgreSQL RLS.
9. Verify tenant isolation.
10. Start Student Management.

Do not jump into student, attendance or finance modules before the workspace authorization foundation is ready.

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
