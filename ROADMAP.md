# EduPlatform Development Roadmap

Last updated: November 13, 2026

## Project Status

**Current Phase: Phase 3 — Student Management (batches 1–2 delivered)**

EduPlatform is a modular, multi-tenant SaaS platform combining Learning Management System (LMS) and Institute Management System (IMS) capabilities.

The initial target market is Sri Lanka, with support planned for independent tuition teachers and educational institutes.

---

# Phase 0 — Product Planning and Architecture

**Status: Complete**

- [x] 0.1 Define product vision and target users.
- [x] 0.2 Define LMS and IMS MVP scope.
- [x] 0.3 Define SaaS service models.
- [x] 0.4 Document requirements and user journeys.
- [x] 0.5 Approve technical architecture and security decisions.
- [x] 0.6 Complete implementation readiness.

# Phase 1 — Technical Foundation

**Status: Complete**

- [x] Set up monorepo using pnpm.
- [x] Set up Next.js frontend with TypeScript.
- [x] Set up NestJS backend with TypeScript.
- [x] Configure PostgreSQL.
- [x] Configure Prisma ORM.
- [x] Configure Docker development environment.
- [x] Establish API structure.
- [x] Implement API health endpoint.
- [x] Establish Swagger/OpenAPI foundation.
- [x] Configure environment variables.
- [x] Establish ESLint and Prettier.
- [x] Establish automated testing infrastructure.
- [x] Configure GitHub Actions CI workflow.
- [x] Establish development, typecheck, lint, test and build commands.

# Phase 2 — Identity and Workspace Foundation

**Status: In Progress**

## 2.1 Identity Database Foundation

- [x] Create User model.
- [x] Create Workspace model.
- [x] Create Membership model.
- [x] Create Session model.
- [x] Establish workspace types.
- [x] Establish membership statuses.
- [x] Apply database migrations.
- [x] Generate Prisma Client.

## 2.2 Authentication Implementation

- [x] Implement user registration.
- [x] Implement user login.
- [x] Implement Argon2id password hashing.
- [x] Implement database-backed sessions.
- [x] Store hashed session tokens.
- [x] Implement HTTP-only authentication cookies.
- [x] Implement current-user endpoint.
- [x] Implement logout.
- [x] Implement session invalidation.
- [x] Implement protected dashboard.
- [x] Implement frontend registration page.
- [x] Implement frontend login page.
- [x] Implement initial request validation.
- [x] Implement initial authentication rate limiting.
- [x] Implement initial Origin checking.

## 2.3 Authentication Testing and Security

- [x] Authentication service unit tests.
- [x] Authentication controller HTTP tests.
- [x] Initial authentication E2E test coverage.
- [ ] Verify rate limiting at runtime.
- [ ] Verify Origin checking at runtime.
- [x] Implement stronger CSRF protection (Origin/Referer enforced for unsafe methods).
- [x] Implement email verification.
- [x] Implement password reset.
- [x] Complete authentication security review.

## 2.4 Workspace Management

### Backend

- [x] Implement teacher workspace creation.
- [x] Implement institute workspace creation.
- [x] Automatically create initial workspace membership as `OWNER`.
- [x] Implement workspace listing for authenticated users.
- [x] Implement active workspace switching.
- [x] Store active workspace ID in the session.
- [x] Verify membership before switching workspaces.
- [x] Use database transactions for workspace creation and switching.
- [x] Implement workspace detail endpoint with membership role.

### Frontend

- [x] Create workspace manager component.
- [x] Implement workspace listing interface.
- [x] Implement workspace creation form.
- [x] Implement workspace creation modal.
- [x] Implement workspace switching interface.
- [x] Create dedicated `/workspaces` page.
- [x] Add workspace navigation to the sidebar.
- [x] Restore active workspace selection after page refresh.
- [ ] Complete manual browser verification (requires a running database).

## 2.5 Invitations and Membership Management

- [x] Implement workspace invitations.
- [x] Implement invitation acceptance.
- [x] Require a verified email address before accepting an invitation.
- [x] Implement invitation expiration (7-day TTL, `EXPIRED` status).
- [x] Implement membership management.
- [x] Implement member removal.
- [ ] Implement member suspension.
- [x] Implement membership authorization.
- [x] Add invitation and member management UI.

## 2.6 Tenant Isolation and Authorization

- [x] Implement tenant context resolution via active membership lookups.
- [x] Enforce workspace membership checks.
- [x] Implement server-side tenant authorization.
- [x] Ensure workspace-owned records are tenant-scoped.
- [x] Implement PostgreSQL Row-Level Security on `memberships` and `workspace_invitations`.
- [x] Implement transaction-scoped tenant context (`set_config(..., true)`).
- [x] Test cross-tenant access prevention (service, HTTP and real-database tests).
- [x] Complete tenant isolation security review.
- [x] Provision a dedicated non-superuser application database role (`pnpm db:setup-app-role` plus a production startup check).

## 2.7 Phase 2 Exit Criteria

- [ ] Authentication security requirements completed.
- [ ] Workspace creation and switching manually verified.
- [x] Workspace invitations implemented.
- [x] Membership management implemented.
- [x] Tenant authorization implemented.
- [x] PostgreSQL RLS implemented and verified against a restricted database role.
- [x] Cross-tenant isolation tests passing (application layer and real database).
- [x] Phase 2 security review completed.

### Batch 1 completion notes (November 12, 2026)

Implemented and covered by automated tests:

- Predefined `WorkspaceRole` enum on memberships (`OWNER`, `ADMIN`, `BRANCH_MANAGER`, `TEACHER`, `STUDENT`, `PARENT`).
- Workspace invitations with hashed tokens, TTL, revocation and acceptance.
- Membership listing, role changes and removal with role-aware rules.
- Email verification and password reset tokens with hashed storage.
- Origin/Referer CSRF enforcement and security headers.
- Global and per-route rate limiting.
- Provider-agnostic mail service using a console driver outside production.
- Frontend for members, invitations, email verification and password recovery.

Verified with unit tests and mocked HTTP end-to-end tests. Not yet verified:

- Browser walkthrough of the new flows.
- Runtime verification of rate limiting and Origin checking.

### Batch 2 completion notes (November 12, 2026)

Implemented and verified:

- Real PostgreSQL integration suite that creates and migrates a dedicated `edu_platform_test` database, disables throttling for tests, captures mail tokens in memory, and exercises the full HTTP pipeline.
- 19 database-backed auth/workspace/invitation tests and 7 RLS tests (26 total).
- PostgreSQL RLS with `ENABLE` + `FORCE ROW LEVEL SECURITY` on `memberships` and `workspace_invitations`.
- `TenantContextService` with transaction-scoped `app.workspace_id`, `app.user_id` and `app.bypass_rls` settings; the only bypass usage is the token-authenticated invitation lookup.
- CI job `Database Integration Tests` with a `postgres:17` service container.

Known constraint: the development/CI database user `edu_admin` is a superuser, so PostgreSQL bypasses RLS for it. The policies are proven with a restricted role in the RLS integration spec, but a production deployment must connect as a non-superuser, non-owner role for RLS to take effect. Application-layer tenant filtering remains in place regardless.

Verified: 75 unit tests, 33 mocked HTTP E2E tests, 26 real-database integration tests, typecheck, lint, format and `next build`.

### Security hardening notes (November 12, 2026)

Implemented after the Phase 2 security review:

- Runtime database role separated from the migration role: the API uses `DATABASE_APP_URL` when set, and `pnpm db:setup-app-role` provisions a `NOSUPERUSER`, `NOBYPASSRLS` role with DML-only grants.
- Startup check rejects a superuser or `BYPASSRLS` runtime connection in production (warning in development), so RLS cannot be silently bypassed.
- `NODE_ENV` is required; a missing value no longer falls back to development behaviour (non-Secure cookies, console token links, Swagger).
- `TRUST_PROXY` configuration added (default `false`) so rate limiting can see real client addresses behind a reverse proxy.
- Login redirect rejects backslash-based open redirects such as `/\host`.
- `WorkspaceRolesGuard` fails closed when a route has no `workspaceId` parameter.

Verified: 82 unit tests, 33 mocked HTTP E2E tests, 26 real-database integration tests, typecheck, lint, format and builds.

### Invitation onboarding notes (November 12, 2026)

Implemented and covered by automated tests:

- Invitation acceptance now requires a verified email address; the email binding is meaningless otherwise.
- The acceptance page detects an unverified session, disables the accept button, explains why, offers a session-authenticated "resend verification email" action and a "check again" action.
- `next` is preserved through the whole unregistered-invitee journey: invite link → login → register → verify → login → accept. Shared `safeInternalPath`/`withNext` helpers keep the redirect internal.
- Integration test asserts a 403 and an untouched `PENDING` invitation before verification, then a successful acceptance afterwards.

Verified: 83 unit tests, 33 mocked HTTP E2E tests, 27 real-database integration tests, typecheck, lint, format and a successful `next build`.

### Audit logging notes (November 12, 2026)

Implemented finding M4 as a database-backed security trail:

- New append-only `audit_events` table (migration `20261112182057_add_audit_events`) with an `AuditEventType` enum, a JSONB `metadata` column and indexes on workspace, actor and event type by time.
- Deliberately no foreign keys or relations, so entries survive user and workspace deletion; actor, workspace and target IDs are nullable context.
- `AuditService.record()` is a global provider that writes the event and swallows/logs failures, so auditing can never break the action it describes.
- Events recorded after the primary transaction succeeds: registration, login success/failure, email verification and resend, password reset request/completion, workspace creation/switching, member role change/removal, and invitation creation/revocation/acceptance.
- Unit tests assert each wiring point; integration tests assert persisted rows (including failed-login actor, workspace creation, invitation acceptance, role change and member removal).
- Runtime role needs the new table: run `pnpm db:setup-app-role` after `pnpm exec prisma migrate deploy`.

Verified: 85 unit tests, 33 mocked HTTP E2E tests, 27 real-database integration tests, typecheck, lint, format and builds.

# Phase 3 — Student Management

**Status: In progress — batches 1–2 (profiles/directory core, guardians) delivered**

### Student profiles and directory notes (November 13, 2026)

Students are workspace records with no login of their own; guardian links and CSV import are deferred.

- `students` table (migration `20261112184452_add_students`) with `ACTIVE/INACTIVE/GRADUATED/WITHDRAWN` status, optional personal, contact and academic fields, a per-workspace unique `student_code`, and RLS policies matching the other tenant tables.
- REST routes under `/workspaces/:workspaceId/students`: list (search, status filter, pagination), detail, create and partial update.
- Read access: OWNER (override), ADMIN, BRANCH_MANAGER, TEACHER. Write access: OWNER (override), ADMIN, BRANCH_MANAGER.
- Audit events `STUDENT_CREATED`, `STUDENT_UPDATED` and `STUDENT_STATUS_CHANGED` store IDs and changed field names only; updates are diffed against the stored row so a save with no changes writes no event.
- Web UI: directory with search/filter/pagination, student detail, create and edit forms, plus role-aware navigation. Users with no active workspace see the Students nav item disabled until they switch workspace.
- Runtime role needs the new table: run `pnpm --filter @edu-platform/api db:sync` after pulling (it generates the client, applies migrations and refreshes the role grants).

Verified: 98 unit tests, 44 mocked HTTP E2E tests, 33 real-database integration tests, typecheck, lint, format, API build, `next build` and a manual owner/teacher walkthrough of the directory.

### Guardian records and links notes (November 13, 2026)

Guardians are workspace-owned records linked to one or more students through a join table. Relationship lives on the guardian, so the same record is not shared across students yet.

- `guardians` and `student_guardians` tables (migration `20261113090000_add_guardians`) with `FATHER/MOTHER/GUARDIAN/OTHER` relationships, optional contact and address fields, `(student_id, guardian_id)` uniqueness, and the same tenant RLS policies as the other workspace tables.
- REST routes: `GET/POST /workspaces/:workspaceId/students/:studentId/guardians`, `GET/PATCH/DELETE /workspaces/:workspaceId/guardians/:guardianId`, and `DELETE /workspaces/:workspaceId/students/:studentId/guardians/:guardianId` to unlink.
- Read access: OWNER (override), ADMIN, BRANCH_MANAGER, TEACHER. Write access: OWNER (override), ADMIN, BRANCH_MANAGER.
- A student keeps at most one primary contact: the first guardian is primary by default, and adding a new primary demotes the previous one.
- Guardians are created together with the student link; there is no "attach an existing guardian to another student" flow yet. Deleting a guardian is refused with 409 while any student link remains, so the UI unlinks first and then deletes.
- Audit events `GUARDIAN_CREATED`, `GUARDIAN_UPDATED`, `GUARDIAN_UNLINKED` and `GUARDIAN_DELETED` store IDs, the student link and changed field names only. Updates are diffed like students.
- Web UI: Guardians card on the student detail page with primary badge and contact summary, add/edit guardian pages and a remove action, all role-aware.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to create the new tables and refresh the client.

Verified: 117 unit tests, 56 mocked HTTP E2E tests, 40 real-database integration tests, typecheck, lint, format and a manual owner walkthrough of adding, promoting, editing and removing guardians.

## 3.1 Student Profiles

- [x] Implement student registration.
- [x] Implement student profile management.
- [x] Store student contact information.
- [x] Store student academic information.
- [x] Implement student profile editing.
- [x] Implement student status management.

## 3.2 Parent and Guardian Management

- [x] Implement parent/guardian records.
- [x] Associate guardians with students.
- [x] Support multiple guardians where appropriate.
- [x] Store guardian contact information.

## 3.3 Student Enrollment

- [ ] Implement student enrollment.
- [ ] Associate students with workspaces.
- [ ] Support enrollment into multiple classes.
- [ ] Implement enrollment history.
- [ ] Implement enrollment status management.

## 3.4 Student Directory

- [x] Implement student listing.
- [x] Implement search.
- [x] Implement filtering.
- [x] Implement pagination.
- [x] Implement student detail pages.

## 3.5 Student Import

- [ ] Implement CSV upload.
- [ ] Validate imported records.
- [ ] Detect duplicate records.
- [ ] Provide import error reports.
- [ ] Support validated bulk import.

# Phase 4 — Teacher Management

**Status: Not Started**

- [ ] Implement teacher profiles.
- [ ] Implement teacher invitations.
- [ ] Associate teachers with workspaces.
- [ ] Implement teacher membership and permissions.
- [ ] Implement teacher assignments.
- [ ] Implement teacher availability.
- [ ] Implement teacher directory.

# Phase 5 — Classes and Batches

**Status: Not Started**

- [ ] Implement class and batch creation.
- [ ] Implement subject management.
- [ ] Assign teachers to classes.
- [ ] Enroll students into classes.
- [ ] Implement class capacity.
- [ ] Implement timetable management.
- [ ] Implement class schedules.
- [ ] Implement class history.

# Phase 6 — Attendance Management

**Status: Not Started**

- [ ] Implement daily attendance.
- [ ] Implement manual attendance recording.
- [ ] Implement attendance editing.
- [ ] Implement attendance history.
- [ ] Implement student attendance summaries.
- [ ] Implement class attendance summaries.
- [ ] Implement attendance reports.

# Phase 7 — Finance and Fee Management

**Status: Not Started**

- [ ] Implement fee structures.
- [ ] Implement student fee records.
- [ ] Implement monthly fee management.
- [ ] Implement cash payment recording.
- [ ] Implement bank payment recording.
- [ ] Implement payment history.
- [ ] Implement outstanding balance calculations.
- [ ] Implement receipts.
- [ ] Implement finance reports.

# Phase 8 — Learning Management

**Status: Not Started**

- [ ] Implement lesson management.
- [ ] Implement learning materials.
- [ ] Support PDF resources.
- [ ] Support video resources.
- [ ] Implement assignments.
- [ ] Implement student submissions.
- [ ] Implement teacher feedback.
- [ ] Implement assignment history.

# Phase 9 — Examinations and Results

**Status: Not Started**

- [ ] Implement question bank.
- [ ] Support multiple-choice questions.
- [ ] Support true/false questions.
- [ ] Implement examination creation.
- [ ] Implement timed examinations.
- [ ] Implement automatic marking.
- [ ] Implement examination results.
- [ ] Implement student rankings.
- [ ] Implement examination history.

# Phase 10 — Student and Parent Portals

**Status: Not Started**

- [ ] Implement student dashboard.
- [ ] Display enrolled classes.
- [ ] Display learning materials.
- [ ] Display assignments and submissions.
- [ ] Display examination results.
- [ ] Display attendance records.
- [ ] Display fee information.
- [ ] Implement parent/guardian portal.
- [ ] Allow parents to view linked student information.

# Phase 11 — Communication and Reports

**Status: Not Started**

- [ ] Implement announcements.
- [ ] Implement in-app notifications.
- [ ] Implement notification preferences.
- [ ] Implement basic student reports.
- [ ] Implement attendance reports.
- [ ] Implement finance reports.
- [ ] Implement class reports.
- [ ] Implement workspace overview reports.

# Post-MVP — Advanced Features

**Status: Planned**

- [ ] Live classrooms.
- [ ] Real-time quizzes.
- [ ] Interactive whiteboards.
- [ ] Live polls and Q&A.
- [ ] AI-powered features.
- [ ] Payment gateway integrations.
- [ ] QR-based attendance.
- [ ] Advanced accounting.
- [ ] Payroll and tax management.
- [ ] Full white-label custom domains.
- [ ] Dedicated enterprise deployments.
- [ ] Native Flutter mobile applications.
- [ ] International expansion.

---

# Development Principles

1. Build a secure foundation before implementing business modules.
2. Enforce tenant isolation on the backend.
3. Never trust frontend workspace identifiers for authorization.
4. Keep business logic inside the appropriate backend modules.
5. Build reusable and responsive frontend components.
6. Prioritize functional MVP features over premature complexity.
7. Update this roadmap after every major milestone.
8. Distinguish implemented features from tested and manually verified features.
