# EduPlatform — AI Development Handoff

Last updated: November 13, 2026

This document is the current development handoff and implementation reference for AI-assisted development.

It records the actual project direction, technical architecture, implementation progress, outstanding work and development priorities.

## Current state at a glance

- Phase 2 Batch 1 is implemented: workspace roles, memberships, invitations, email verification, password reset, CSRF/security headers, rate limiting and the matching frontend.
- Phase 2 Batch 2 adds PostgreSQL RLS on `memberships` and `workspace_invitations`, transaction-scoped tenant context, and a real-database integration suite.
- Phase 2 Batch 3 applies the security review fixes: a restricted runtime database role with a production startup check, required `NODE_ENV`, `TRUST_PROXY` support, a stricter login redirect and a fail-closed roles guard.
- Invitation onboarding is hardened: acceptance requires a verified email address, and the acceptance page guides unverified invitees through verification. Registration now preserves the invitation `next` target.
- Security-event audit logging (finding M4) is implemented as an append-only `audit_events` table written through a best-effort `AuditService`.
- Phase 3 Batch 1 is implemented: workspace-scoped student profiles with RLS, a students REST module, audit events, and a web directory with detail/create/edit pages.
- Phase 3 Batch 2 is implemented: workspace-scoped guardians with `StudentGuardian` links, a guardians REST module, primary-contact handling, audit events, and a Guardians card with add/edit/remove pages on the student detail screen.
- Phase 3 Batch 3 is implemented: preview-first CSV student import with a hand-written RFC 4180 parser, validate/import endpoints, duplicate skipping, a `STUDENTS_IMPORTED` audit event, and a role-aware import page.
- Verified by 143 unit tests, 61 mocked HTTP E2E tests, 46 real-database integration tests, typecheck, lint, format, API build, `next build` and a browser walkthrough of the student directory, guardian links and CSV import.
- Still open: runtime rate-limit/Origin verification, email-verification enforcement for workspace actions (M1, intentionally deferred), guardian reuse across students, enrollment (3.3), and the remaining Low-severity review items.
- Commits `cfcaa1f` (Batch 2), `8e7bab6` (CI/env fixes), `23ce94e` (Batch 3 security fixes), `90b552b` (hydration fix), `18b8bbd` (invitation onboarding), `6b4b29e` (audit logging), `e9ceb42` (students), `e1e35a4` (db:sync) and `c4331d1` (guardians) were pushed on `feat/phase-3-student-profiles`; the CSV import batch on the same branch is not committed yet.

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

`feat/phase-3-student-profiles`

Current development phase:

**Phase 3 — Student Management (batches 1–2 delivered)**

Do not assume that Phase 2 or Phase 3 has been merged into `main`.

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
- Acceptance requires the signed-in user's email to match the invited email and the user's email address to be verified.
- The acceptance page shows an unverified warning, disables acceptance, and offers resend/check-again actions.

## EmailVerificationToken and PasswordResetToken

Single-use, hashed tokens attached to a user with an expiry.

- Raw tokens are never persisted.
- Verification/reset tokens are marked as used (or deleted) after consumption.
- Password reset revokes the user's existing sessions.

## Student

Workspace-owned student record; students do not have logins in this batch.

- Fields: `studentCode` (optional, unique per workspace), `firstName` (required), `lastName`, `dateOfBirth`, `gender`, `email`, `phone`, address parts, `school`, `grade`.
- Status values: `ACTIVE`, `INACTIVE`, `GRADUATED`, `WITHDRAWN`. Gender values: `MALE`, `FEMALE`, `OTHER`.
- `(workspaceId, studentCode)` is unique; indexes cover `(workspaceId, status)` and `(workspaceId, firstName, lastName)`.
- `ON DELETE CASCADE` from `Workspace`; RLS is enabled and forced with the same tenant policy as the other tenant tables.
- Enrollment is intentionally deferred to a later batch. Bulk CSV creation is handled by the import service (see 9C) rather than by this model.

## Guardian

Workspace-owned parent/guardian record; linked to students through `StudentGuardian`.

- Fields: `firstName` (required), `lastName`, `relationship` (required), `email`, `phone`, `occupation` and address parts.
- Relationship values: `FATHER`, `MOTHER`, `GUARDIAN`, `OTHER`. The relationship lives on the guardian, so a guardian record currently belongs to one student context.
- Index covers `(workspaceId, lastName, firstName)`.
- `ON DELETE CASCADE` from `Workspace`; RLS is enabled and forced with the same tenant policy as the other tenant tables.

## StudentGuardian

Join row linking a student to a guardian inside one workspace.

- Fields: `workspaceId`, `studentId`, `guardianId`, `isPrimary` (default false).
- `(studentId, guardianId)` is unique; indexes cover `(workspaceId)` and `(guardianId)`.
- Cascades from `Workspace`, `Student` and `Guardian`. RLS is enabled and forced with the same tenant policy.
- At most one primary contact per student is enforced in the service (not by a partial unique index).

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

- Registration page (preserves a `next` destination through verification and login).
- Login page.
- Protected dashboard.
- HTTP-only `edu_session` cookie usage.
- Logout interface.
- Email verification page.
- Forgot-password and reset-password pages.
- Invitation acceptance page with email-verification guidance for invited users.

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
    ├── /workspaces/[workspaceId]/members
    └── /workspaces/[workspaceId]/students
        ├── /workspaces/[workspaceId]/students/new
        ├── /workspaces/[workspaceId]/students/import
        └── /workspaces/[workspaceId]/students/[studentId]
            ├── /workspaces/[workspaceId]/students/[studentId]/edit
            └── /workspaces/[workspaceId]/students/[studentId]/guardians
                ├── /workspaces/[workspaceId]/students/[studentId]/guardians/new
                └── /workspaces/[workspaceId]/students/[studentId]/guardians/[guardianId]/edit
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

The students directory, detail, create and edit pages were walked through in a browser against the dev API: owner create → detail → edit (including status change) and teacher read-only access (no Add button, restricted edit page). The same walkthrough confirmed `STUDENT_CREATED`, `STUDENT_UPDATED` and `STUDENT_STATUS_CHANGED` rows in `audit_events`.

The guardian card was walked through the same way: add guardian (first one became primary), add a second guardian as primary (the first was demoted), edit the occupation, and remove a guardian (unlink then delete). `GUARDIAN_CREATED`, `GUARDIAN_UPDATED`, `GUARDIAN_UNLINKED` and `GUARDIAN_DELETED` rows matched the actions.

The CSV import page was walked through with three files: an invalid email row (import blocked, error line shown), a mixed file with an in-file duplicate (2 ready, 1 duplicate; importing created 2 students and skipped 1), and the same mixed file again (both codes reported as existing, import button disabled). The directory then showed the imported records with the lower-cased email, the quoted comma in a last name and the `GRADUATED` status intact.

# 9A. Phase 3 — Student Implementation

Delivered in batch 1 (profiles + directory core):

- API: `apps/api/src/students/` (controller, service, DTOs, module). Routes: `GET/POST /workspaces/:workspaceId/students`, `GET/PATCH /workspaces/:workspaceId/students/:studentId`.
- Access: reads for OWNER/ADMIN/BRANCH_MANAGER/TEACHER, writes for OWNER/ADMIN/BRANCH_MANAGER, enforced twice (guard plus `WorkspaceAccessService.requireRoles`).
- List: case-insensitive search over first name, last name, code, email and phone; optional status filter; `page`/`pageSize` capped at 100 (default 20); alphabetical order.
- Create/update accept blank optional values as `null`; a duplicate `studentCode` returns 409. Update diffs the submitted fields against the stored row, so a form save with no changes writes neither a database update nor an audit event.
- Audit: `STUDENT_CREATED`, `STUDENT_UPDATED` (changed field names) and `STUDENT_STATUS_CHANGED` (`from`/`to`). No student PII is stored in metadata.
- Web: `apps/web/src/lib/workspace-session.ts` (shared session fetch and role helpers), `apps/web/src/components/student-form.tsx`, and the directory/detail/create/edit routes. The sidebar "Students" entry points at the active workspace.
- Known gap: when the session has no `activeWorkspaceId`, the Students entry is shown as disabled until the user switches workspace once.

# 9B. Phase 3 — Guardian Implementation

Delivered in batch 2 (guardian records + student links):

- API: `apps/api/src/guardians/` (controller, service, create/update DTOs, module). Routes: `GET/POST /workspaces/:workspaceId/students/:studentId/guardians`, `GET/PATCH/DELETE /workspaces/:workspaceId/guardians/:guardianId`, `DELETE /workspaces/:workspaceId/students/:studentId/guardians/:guardianId`.
- Access: reads for OWNER/ADMIN/BRANCH_MANAGER/TEACHER, writes for OWNER/ADMIN/BRANCH_MANAGER, enforced twice (guard plus `WorkspaceAccessService.requireRoles`). The student must belong to the workspace before its guardian list is readable.
- Creation always creates a new guardian record and links it in one transaction; there is no attach-existing-guardian flow. The first link for a student defaults to primary; an explicit primary link demotes the previous primary.
- Delete is refused with 409 while the guardian is still linked; the web Remove action unlinks first and then deletes the record.
- Audit: `GUARDIAN_CREATED` (student id and primary flag), `GUARDIAN_UPDATED` (changed field names), `GUARDIAN_UNLINKED` (student id) and `GUARDIAN_DELETED`. Updates are diffed, so a no-op save writes nothing.
- Web: `apps/web/src/lib/guardian.ts`, `guardian-form.tsx`, `guardian-actions.tsx`, the Guardians card on the student detail page, and `students/[studentId]/guardians/new` plus `students/[studentId]/guardians/[guardianId]/edit`. Managers see the actions; teachers see a read-only card.
- Migration `20261113090000_add_guardians` adds the enum, tables, indexes, foreign keys and RLS policies for both new tables.

# 9C. Phase 3 — CSV Import Implementation

Delivered in batch 3 (preview-first bulk student creation):

- Parser: `apps/api/src/students/csv.ts` implements the RFC 4180 subset the import needs — quoted fields, doubled quotes, embedded newlines, CRLF/CR line endings, a UTF-8 BOM, blank-line skipping and line numbers for every record. It returns headers (trimmed, lower-cased) and records, and throws `CsvParseError` for unclosed quotes, stray quotes, empty or duplicate headers. `MAX_IMPORT_CSV_CHARS` (1,000,000) and `MAX_IMPORT_ROWS` (2,000) live there too.
- API: `apps/api/src/students/students-import.service.ts` and `dto/import-students.dto.ts`. Routes: `POST /workspaces/:workspaceId/students/import/validate` and `POST /workspaces/:workspaceId/students/import`, both returning 200. Access is OWNER (override), ADMIN, BRANCH_MANAGER; the service calls `requireRoles` inside the tenant transaction like the other student writes.
- Request body is `{ "csv": "..." }`. The browser reads the file with `File.text()` and posts JSON, so no multipart or upload dependency exists.
- Headers are snake_case. `first_name` is required; unknown columns are rejected with the supported list; blank optional cells become `null`. Values are validated with `ImportStudentRowDto extends CreateStudentDto` plus an optional `status`, so a CSV row follows exactly the same rules as the single-student form.
- Report: `{ totalRows, validRows, invalidRows, duplicateRows, rows[] }` where each row carries `line`, `studentCode`, `firstName`, `status` (`VALID`/`INVALID`/`DUPLICATE`) and error messages. Line numbers match the spreadsheet.
- Import behaviour: any invalid row fails the whole request (400 with `invalidRows`) so a partial surprise import cannot happen. Duplicate `student_code`s — repeated in the file or already in the workspace — are skipped, never updated. Valid rows are written with one `createMany({ skipDuplicates: true })` inside the tenant transaction, which also tolerates a concurrent insert. Result: `{ imported, skipped, duplicates[{ line, studentCode, reason }] }`.
- Audit: one `STUDENTS_IMPORTED` event per import with `{ imported, skipped }`; no names, codes or row contents. The enum value was added by the additive migration `20261113120000_add_student_import_audit`.
- Web: `apps/web/src/lib/student-import.ts` (types and limits), `student-import.tsx` (client file picker, template download, preview table with counts and per-row errors, import/result panels) and `students/import/page.tsx` (role-aware server page). Managers get an "Import CSV" action on the directory next to "Add student".
- Import does not check for duplicate people, only duplicate codes: rows without a `student_code` are always created. Tell users to fill the code column when they need repeat-safe files.

# 10. Testing Status

Current verified results after Phase 3 batch 3:

## Unit Tests

143 tests passed across 14 files:

- Authentication service.
- Workspace service.
- Workspace access service.
- Memberships service.
- Invitations service.
- Students service.
- Students import service (17 tests covering report shape, per-row errors, in-file and existing duplicates, import counts, blocked invalid files, limits and role rejection).
- CSV parser (9 tests covering quoting, escapes, embedded newlines, BOM, CRLF, line numbers and malformed input).
- Guardians service.
- Session guard.
- Workspace roles guard.
- App setup (`TRUST_PROXY` parsing).
- Database role startup check.
- Health controller.

## E2E HTTP Tests

61 tests passed across 5 files:

- Authentication E2E (13).
- Workspace and invitation E2E (19).
- Students E2E (16, including import routing, role refusal and payload validation).
- Guardians E2E (12).
- Application E2E (1).

## Database Integration Tests

46 tests passed against a real PostgreSQL 17 database:

- 20 auth/workspace/invitation tests through the real HTTP pipeline, middleware and Prisma (session persistence, Argon2 hashing, CSRF rejection, workspace switching, cross-tenant 403s, invitation lifecycle, unverified invitation rejection).
- 6 student tests: create/search/filter/pagination/detail, duplicate and invalid input, teacher read-only access, cross-workspace isolation, update with status change and audit metadata, unauthenticated access.
- 7 guardian tests: create with primary defaulting and demotion, detail with linked students, diffed updates with audit metadata, unlink-then-delete with the 409 guard, teacher read-only access, cross-workspace isolation, invalid input and unauthenticated access.
- 6 import tests: validate/import with in-file and existing duplicates (including that a repeat import never overwrites), rejected invalid files with no writes, per-workspace code scoping, malformed CSV messages, teacher refusal and outsider/unauthenticated access.
- 7 RLS policy tests run as a restricted non-superuser role: no-context visibility, tenant visibility, user context, cross-tenant insert rejection (memberships, students, guardians and links), cross-tenant update/delete, system bypass and no leakage between transactions.

The suite creates and migrates its own `edu_platform_test` database. Run it with `pnpm --filter @edu-platform/api test:integration` (requires PostgreSQL). CI runs it in the `Database Integration Tests` job with a `postgres:17` service container.

## Static Checks

- API typecheck passed.
- API lint passed.
- API build passed.
- Web lint passed.
- Prettier format check passed.
- `next build` compiled successfully for all routes.

## What the mocked tests do not prove

- Layout quality of the pages (the student flow was walked through, but visual polish was not reviewed).
- Runtime behavior of rate limiting and Origin checking.

Real database behavior is now covered by the integration suite; mocked tests still do not prove it by themselves.

Important testing distinctions:

1. Unit tests validate isolated business logic.
2. Mock-based HTTP tests validate controller behavior.
3. Database integration tests validate real database interactions and RLS.
4. Manual browser tests validate real frontend workflows.
5. Security testing validates authorization and isolation.

Passing mocked tests does not prove full database integration or tenant security. Passing RLS tests does not prove the deployment is protected: a superuser or `BYPASSRLS` role ignores policies, and the current local/CI role `edu_admin` is both.

Do not claim unverified checks are complete.

# 11. Remaining Phase 2 Work

## Authentication Security

- Verify rate limiting at runtime (configure `TRUST_PROXY` for the deployment topology first).
- Verify Origin checking at runtime.
- Enforce email verification before workspace actions (security review finding M1). Invitation acceptance now requires a verified email; workspace creation and other actions still allow unverified users.
- ~~Add structured audit logging for security events such as failed logins, role changes and invitation changes (finding M4).~~ Implemented — see "Audit logging (M4)" below.
- M4 follow-ups if needed: an admin-facing read/view of `audit_events`, retention policy, and auditing other sensitive actions as they are added.
- Longer-term: stronger CSRF token scheme if the app adds cross-site embedding.
- Longer-term: production mail delivery driver (the console driver only logs links).

Implemented already: email verification, password reset, Origin/Referer enforcement, rate limiting, security headers.

### Audit logging (M4)

- Storage: one append-only `audit_events` table (`AuditEvent` model, migration `20261112182057_add_audit_events`) with an `AuditEventType` enum, nullable `actorUserId` / `workspaceId` / `targetId`, JSONB `metadata`, and time indexes per workspace, actor and type.
- No foreign keys or relations: entries must survive user and workspace deletion. Treat rows as immutable; there is no update or delete path.
- Writer: global `AuditService.record()` in `apps/api/src/audit/`. Failures are logged and swallowed, so a broken audit write never rolls back or fails the audited action.
- Placement: events are recorded after the primary business transaction commits, so only successful state changes are audited (plus `LOGIN_FAILED`, which is the point of that event).
- Covered events: `USER_REGISTERED`, `LOGIN_SUCCEEDED`, `LOGIN_FAILED`, `EMAIL_VERIFIED`, `EMAIL_VERIFICATION_RESENT`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`, `WORKSPACE_CREATED`, `WORKSPACE_SWITCHED`, `MEMBER_ROLE_CHANGED`, `MEMBER_REMOVED`, `INVITATION_CREATED`, `INVITATION_REVOKED`, `INVITATION_ACCEPTED`.
- No read API yet. Query the table directly until an admin-facing viewer exists.
- Database role: the setup script grants on all current tables and also sets `ALTER DEFAULT PRIVILEGES`, so tables created later by the migration role inherit the grants automatically. Re-run `pnpm db:setup-app-role` only when the role is missing, `DATABASE_APP_URL` changes, or migrations are applied by a different database user.
- `pnpm --filter @edu-platform/api db:sync` runs `prisma generate`, `prisma migrate deploy` and the role setup in one idempotent step, skipping the role step when `DATABASE_APP_URL` is unset.

## Workspace Management

- Verify creation and switching manually in a browser.
- Implement member suspension (removal is done, suspension is not).
- Longer-term: better workspace overview and settings.

Implemented already: dedicated `/workspaces` route, sidebar navigation, active workspace restoration, invitations, invitation acceptance, invitation expiry and revocation, membership listing, role changes and removal.

## Tenant Isolation

- Verify pooled connection safety under load (the tenant context is transaction-scoped, but production load testing is still open).
- Set `DATABASE_APP_URL` in every production environment; the API refuses to start there if the runtime role is a superuser or has `BYPASSRLS`.
- Review the remaining Low-severity findings before a public launch: web security headers, token-in-query Referrer policy, registration email enumeration, session idle timeout and MFA.

Implemented already: tenant context resolution through the session's active workspace, active membership enforcement, server-side workspace authorization, workspace-scoped queries, mocked cross-tenant access tests, PostgreSQL RLS on `memberships` and `workspace_invitations` with `FORCE ROW LEVEL SECURITY`, a provisioned restricted runtime role, a production startup check, and the Phase 2 security review.

### How RLS is wired

- `prisma/migrations/20261112160000_tenant_row_level_security` enables and forces RLS on both tables.
- Policies allow a row when `app.bypass_rls = 'on'`, when `workspace_id` matches `app.workspace_id`, or (memberships only) when `user_id` matches `app.user_id`.
- `TenantContextService` runs every tenant query inside `prisma.$transaction` and sets the context with `set_config(..., true)`, so a pooled connection cannot inherit another request's workspace after commit.
- All workspace services use `runAsTenant`; the memberships list uses `runAsUser`; the token-authenticated invitation lookup in `InvitationsService.accept` uses `runAsSystem`.
- `apps/api/test/integration/rls.integration-spec.ts` switches to a restricted role (`edu_rls_test`) because the development role is a superuser and would otherwise bypass every policy.
- `pnpm db:setup-app-role` creates or updates the runtime role from `DATABASE_APP_URL` with `NOSUPERUSER`, `NOBYPASSRLS` and DML-only grants. Runtime uses `DATABASE_APP_URL` when set, otherwise `DATABASE_URL`. `pnpm db:sync` chains it after generate and migrate.
- `main.ts` calls `assertRestrictedDatabaseRole` at startup: production refuses a superuser or `BYPASSRLS` connection; other environments log a warning.

## Phase 3 Remaining Work

- Student profiles and directory (3.1, 3.4), guardians (3.2) and CSV import (3.5) are delivered; enrollment (3.3) remains.
- Reusing one guardian record across several students (for siblings) is not implemented; every guardian is created for one student context.
- `STUDENT` and `PARENT` memberships still have no student-directory read access by design; revisit when the student portal phase starts.
- Users without an active workspace must switch workspace once before the Students sidebar entry becomes a link.

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
- Email verification uses single-use hashed tokens. Unverified users can still sign in, but accepting a workspace invitation requires a verified address.
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

Delivered: student profiles (create, edit, status), student directory with search, filtering and pagination, detail pages, guardian records and student links, preview-first CSV import with duplicate skipping, and workspace-scoped RLS plus audit events.

Still open:

- Student enrollment.

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

1. Manually walk through registration, verification, login, workspace creation/switching, invitations, role changes and password reset in a browser.
2. Verify rate limiting and Origin checking at runtime.
3. Decide whether to extend email-verification enforcement beyond invitation acceptance.
4. Continue Phase 3 — Student Management (enrollment).

Do not add student, attendance or finance modules before steps 1–3 are done. Application-layer authorization, database integration tests, RLS, the restricted runtime role, audit logging and the Phase 2 security review are in place; browser verification, runtime security checks and the email-verification scope decision remain open.

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
