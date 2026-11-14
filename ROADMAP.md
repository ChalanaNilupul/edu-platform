# EduPlatform Development Roadmap

Last updated: November 14, 2026

## Project Status

**Current Phase: Phase 7 — Finance and Fee Management (batch 1 delivered)**

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
- [x] Require a verified email address before creating a workspace and inviting members.
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

### Runtime security verification and email-verification enforcement (November 13, 2026)

Closed the remaining Phase 2 verification items and finding M1.

- Rate limiting verified at runtime: the global 30 req/60s cap trips with 429, and the tighter auth limits (5/min login and register, 3/min resend/forgot/reset) trip independently. With `TRUST_PROXY=false` a spoofed `X-Forwarded-For` does not reset the limit.
- Origin/CSRF checks verified at runtime: unsafe methods with a foreign or missing Origin/Referer and a session cookie return 403 ("Forbidden origin" / "Missing request origin"). A foreign preflight returns 204 with the configured allow-origin header, so the browser blocks the real request; note the preflight header is static, not an echo of the caller's origin.
- Email-verification enforcement: workspace creation and invitation creation now require a verified email (`ForbiddenException`, 403) in `WorkspacesService.create` and `InvitationsService.create`. Login, workspace switching and the student/guardian/class/enrollment routes remain open to unverified users by design.
- Web: unverified sessions get an amber dashboard banner explaining the restriction with a session-authenticated "Resend email" action (existing `POST /auth/email/resend`); the banner disappears after verification.
- Tests updated/added across unit, mocked HTTP and real-database integration suites, using a new `registerVerifiedUser` integration helper. Also corrected `UpdateEnrollmentDto.notes` to `string | null` to match the runtime clear behavior.

Verified: 180 unit tests, 75 mocked HTTP E2E tests, 56 real-database integration tests, typecheck, lint, format, API build, `next build`, and a browser walkthrough (unverified login → banner → resend → blocked workspace creation → verify → banner gone → workspace created).

# Phase 3 — Student Management

**Status: In progress — batches 1–4 (profiles/directory core, guardians, CSV import, classes/enrollment) delivered**

### Student profiles and directory notes (November 13, 2026)

Students are workspace records with no login of their own; guardian links and CSV import were delivered in later batches.

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

### CSV student import notes (November 13, 2026)

Import is a two-step, preview-first flow: validate the file, review every row, then create the accepted rows in one transaction.

- Hand-written RFC 4180 parser (`apps/api/src/students/csv.ts`): quoted fields, doubled quotes, embedded newlines, CRLF, a UTF-8 BOM, blank-line skipping and per-row line numbers for error reports.
- REST routes: `POST /workspaces/:workspaceId/students/import/validate` and `POST /workspaces/:workspaceId/students/import`, both accepting `{ "csv": "..." }` and returning 200. Access: OWNER (override), ADMIN, BRANCH_MANAGER only; teachers are refused.
- Limits: 1,000,000 characters and 2,000 data rows per file. Headers must be snake_case; `first_name` is required and unknown columns are rejected with the supported list. Blank optional cells become null.
- Validation reuses `CreateStudentDto` (so names, email, phone, date and enums match single-student create) plus an optional `status`. Invalid rows are reported with their spreadsheet line and block the import entirely; duplicates are reported and skipped.
- Duplicate detection is exact `student_code` matching, both inside the file (first occurrence wins) and against the workspace. Existing students are never updated; `createMany` also uses `ON CONFLICT DO NOTHING` to survive a concurrent insert.
- One `STUDENTS_IMPORTED` audit event per import with `{ imported, skipped }` — no row contents or student PII. New enum value migration: `20261113120000_add_student_import_audit`.
- Web UI: `/workspaces/[workspaceId]/students/import` with file picker, template download, preview table (counts, per-row problems, first 200 rows), an import button that stays disabled while invalid rows exist, and a result summary that lists skipped duplicates. The directory has an "Import CSV" action for managers.
- The CSV is read in the browser with `File.text()` and posted as JSON, so no multipart/upload dependency was added.

Verified: 143 unit tests, 61 mocked HTTP E2E tests, 46 real-database integration tests, typecheck, lint, format, API build, `next build` and a browser walkthrough of an invalid file, a mixed file and a repeat upload.

### Classes and enrollment notes (November 13, 2026)

Classes are deliberately minimal for now: a name, optional grade/description/capacity and an active/archived status, owned by the workspace. Enrollment is append-only history rather than a mutable link.

- `classes` and `enrollments` tables (migrations `20261113150000_add_classes_and_enrollments` and `20261113151000_add_class_deleted_audit`) with tenant RLS, `(workspace_id, name)` uniqueness and a Postgres partial unique index `(student_id, class_id) WHERE status = 'ACTIVE'`, which the Prisma schema cannot express.
- REST routes: `GET/POST /workspaces/:workspaceId/classes`, `GET/PATCH/DELETE /workspaces/:workspaceId/classes/:classId`, `GET/POST /workspaces/:workspaceId/classes/:classId/enrollments`, `PATCH /workspaces/:workspaceId/enrollments/:enrollmentId`, and `GET /workspaces/:workspaceId/students/:studentId/enrollments`.
- Read access: OWNER (override), ADMIN, BRANCH_MANAGER, TEACHER. Write access: OWNER (override), ADMIN, BRANCH_MANAGER.
- Capacity is optional (1–1000) and checked when enrolling or reactivating; completed/withdrawn rows do not count. Enrolling in an archived class is refused. Classes with any enrollment rows cannot be deleted (409) and should be archived instead.
- Status values: class `ACTIVE/ARCHIVED`; enrollment `ACTIVE/COMPLETED/WITHDRAWN`. Moving away from `ACTIVE` sets `endedAt`; reactivating clears it. Re-enrollment after completion keeps the old row.
- Audit events `CLASS_CREATED`, `CLASS_UPDATED`, `CLASS_DELETED`, `STUDENT_ENROLLED` and `ENROLLMENT_UPDATED` store IDs, changed field names and status transitions only — no student names or notes.
- Web UI: `/workspaces/[workspaceId]/classes` (search, status filter, pagination), create/edit pages, a class detail page with the enroll picker plus roster actions, and a Classes card on the student detail page. Sidebar gains a "Classes" entry, now reachable from the dashboard, Workspaces and student pages (the shell derives it from the students href, commit `fa7f0cd`).
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply both migrations and refresh the client.

Verified: 178 unit tests, 75 mocked HTTP E2E tests, 54 real-database integration tests, typecheck, lint, format, API build, `next build` and a browser walkthrough of class creation, enrollment, capacity refusal, completion/reactivation, archiving, deletion protection and student-side history.

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

- [x] Implement student enrollment.
- [x] Associate students with workspaces.
- [x] Support enrollment into multiple classes.
- [x] Implement enrollment history.
- [x] Implement enrollment status management.

## 3.4 Student Directory

- [x] Implement student listing.
- [x] Implement search.
- [x] Implement filtering.
- [x] Implement pagination.
- [x] Implement student detail pages.

## 3.5 Student Import

- [x] Implement CSV upload.
- [x] Validate imported records.
- [x] Detect duplicate records.
- [x] Provide import error reports.
- [x] Support validated bulk import.

# Phase 4 — Teacher Management

**Status: In progress — batches 1 (profiles and directory) and 2 (class-teacher assignments) delivered; weekly availability remains**

### Teacher profiles and directory notes (November 14, 2026)

Teachers are existing workspace members. Batch 1 adds a profile that hangs off the membership, so invitations, roles and permissions continue to use the Phase 2 membership model — no second teacher record was introduced.

- `teacher_profiles` table (migration `20261113191154_add_teacher_profiles`) with optional phone, qualifications, `specializations` text array, bio, `joined_at` date and internal notes; one profile per membership (`membership_id` unique) with cascade deletes and tenant RLS matching the other workspace tables.
- REST routes under `/workspaces/:workspaceId/teachers`: list (search across name/email/qualifications/specializations, status filter, pagination), detail by membership id, and `PATCH /:membershipId/profile` which creates the profile on first save.
- Directory eligibility: members with role TEACHER plus any member (owner, admin, branch manager) who has a profile, so managers who also teach can appear. Read access: OWNER (override), ADMIN, BRANCH_MANAGER, TEACHER. Managers (OWNER/ADMIN/BRANCH_MANAGER) edit any profile; a teacher may edit only their own membership.
- Saving an entirely empty profile is rejected; blank text is stored as null and specializations are trimmed, capped at 10 entries of 50 characters.
- Audit events `TEACHER_PROFILE_CREATED` and `TEACHER_PROFILE_UPDATED` record the profile id and changed field names only — no free-text content.
- Web UI: `/workspaces/[workspaceId]/teachers` directory with search/status filter/pagination, a teacher detail page (contact, qualifications, specialization chips, bio, notes) and add/edit profile pages. The sidebar gains a "Teachers" entry derived from the students href, and students/parents get a restricted-access notice.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to create the table, apply RLS and refresh the role grants.

Verified: 191 unit tests, 81 mocked HTTP E2E tests, 61 real-database integration tests (including RLS on `teacher_profiles`), typecheck, lint, format, API build, `next build` and a browser walkthrough (owner adds a profile, teacher edits their own, student sees the restricted notice).

### Class-teacher assignment notes (November 14, 2026)

Assignments are append-only history: removing a teacher sets `ended_at` instead of deleting the row, so re-assignment creates a new period and the past stays visible to managers.

- `class_teachers` table (migration `20261114122833_add_class_teachers`) with `class_id`, `membership_id`, `is_primary`, `assigned_at`, nullable `ended_at`, cascade foreign keys, tenant RLS, a partial unique index for one active row per class and teacher, and a second partial unique index for one active primary teacher per class.
- Routes under `/workspaces/:workspaceId`: `GET`/`POST /classes/:classId/teachers`, `PATCH`/`DELETE /classes/:classId/teachers/:assignmentId` and `GET /teachers/:membershipId/classes`. Reads allow OWNER/ADMIN/BRANCH_MANAGER/TEACHER; assignment changes are manager-only.
- Any active directory-eligible member (role TEACHER or holding a profile) can be assigned. Archived classes reject new assignments with 409, duplicate active assignments return 409, and memberships from another workspace return 404.
- History visibility: current assignments are visible to every staff viewer, while past assignments are returned only to managers, even when `includeEnded=true` is requested.
- Audit events `CLASS_TEACHER_ASSIGNED`, `CLASS_TEACHER_PRIMARY_CHANGED` and `CLASS_TEACHER_REMOVED` store the class id, membership id, primary flag and end date — no names.
- Deleting a class with teacher-assignment rows now returns 409 with the archive hint, matching the existing enrollment rule.
- Web UI: a Teachers card on the class detail page (active rows with a Primary badge, assign picker, make-primary/remove actions for managers, collapsed past teachers) and an Assigned classes card on the teacher detail page (current for all viewers, past for managers).
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration and refresh role grants.

Verified: 212 unit tests, 90 mocked HTTP E2E tests, 70 real-database integration tests (including RLS on `class_teachers`), typecheck, lint, format, API build, `next build` and a browser walkthrough (owner assigns, promotes and removes a teacher; the teacher sees the class read-only and no past history).

- [x] Implement teacher profiles.
- [x] Implement teacher invitations (delivered with the Phase 2 invitation flow).
- [x] Associate teachers with workspaces (Phase 2 memberships).
- [x] Implement teacher membership and permissions (Phase 2 roles and guards).
- [x] Implement teacher assignments.
- [ ] Implement teacher availability.
- [x] Implement teacher directory.

# Phase 5 — Classes and Batches

**Status: In progress — class records, capacity and enrollment were delivered with Phase 3 batch 4; batch 1 (subject catalogue and class links) and batch 2 (weekly timetable) are delivered**

### Subject catalogue notes (November 14, 2026)

Subjects are a workspace-level catalogue; classes link to subjects rather than owning them, so renaming or archiving a subject never duplicates data across classes.

- `subjects` table (migration `20261114154500_add_subjects`) with `name`, optional `code`, optional `description` and `status` (`ACTIVE`/`ARCHIVED`). `(workspace_id, name)` is unique and `(workspace_id, code)` is unique when a code is present (Postgres treats NULL codes as distinct).
- `class_subjects` join table (`class_id`, `subject_id`, unique pair) with cascade foreign keys and tenant RLS on both tables, matching the other workspace tables.
- REST routes under `/workspaces/:workspaceId`: `GET`/`POST /subjects`, `GET`/`PATCH`/`DELETE /subjects/:subjectId`, plus `GET` and `PUT /classes/:classId/subjects`. Reads allow OWNER/ADMIN/BRANCH_MANAGER/TEACHER; writes are manager-only (OWNER/ADMIN/BRANCH_MANAGER).
- Codes are trimmed and stored in upper case. Duplicate names or codes return 409. Deleting a subject that is linked to a class returns 409 with an archive hint; archiving keeps existing class links but hides the subject from pickers, and archived classes cannot change their subject list.
- Audit events `SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_ARCHIVED`, `SUBJECT_DELETED` and `CLASS_SUBJECTS_CHANGED` store ids, field names and added/removed subject ids only — no free text.
- Web UI: `/workspaces/[workspaceId]/subjects` directory (search, status filter, pagination, class counts), create/edit pages, a Subjects sidebar entry, and a Subjects card on the class detail page with a multi-select picker for managers.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration and refresh role grants.

Verified: 237 unit tests, 100 mocked HTTP E2E tests, 80 real-database integration tests (including RLS on `subjects` and `class_subjects`), typecheck, lint, format, API build, `next build` and a browser walkthrough of subject creation (trim/uppercase), search, archiving, class linking, count updates and the read-only teacher view.

### Weekly timetable notes (November 14, 2026)

The timetable stores recurring weekly periods (day plus start/end minutes) rather than dated lessons, and overlap rules are enforced twice: a friendly service check and a PostgreSQL exclusion constraint as the race backstop.

- `class_schedule_slots` table (migration `20261114170000_add_class_schedule_slots`) with `class_id`, `subject_id`, optional `membership_id` (teacher), `day_of_week` enum (`MONDAY`–`SUNDAY`), `start_minutes`/`end_minutes`, optional `room`, cascade foreign keys and tenant RLS. A table check keeps `0 <= start < end <= 1440`.
- `btree_gist` extension plus two exclusion constraints over `int4range(start_minutes, end_minutes, '[)')`: `class_schedule_slots_no_class_overlap` blocks overlapping slots in one class, and the partial `class_schedule_slots_no_teacher_overlap` blocks one teacher being scheduled twice at the same time. Half-open ranges let adjacent periods (09:00–10:00 then 10:00–11:00) coexist.
- Routes under `/workspaces/:workspaceId`: `GET`/`POST /classes/:classId/schedule` and `PATCH`/`DELETE /classes/:classId/schedule/:slotId`. Reads allow OWNER/ADMIN/BRANCH_MANAGER/TEACHER; writes are manager-only.
- The API accepts any minute (0–1439/1440) while the web form steps in 15-minute increments. Archived classes reject writes with 409; subjects must be linked to the class and active; the optional teacher must be a directory-eligible membership.
- Overlaps surface as 409 with a class-specific or teacher-specific message. Prisma reports the database exclusion violation as `P2039` (`23P01`), which the service maps to the same friendly conflict response.
- Audit events `CLASS_SCHEDULE_SLOT_CREATED`, `CLASS_SCHEDULE_SLOT_UPDATED` and `CLASS_SCHEDULE_SLOT_DELETED` store ids, day and minute range — no free text beyond the room is recorded.
- Web UI: a Weekly timetable card on the class detail page with an add/edit form (day, start/end time, subject, optional teacher, optional room), slots grouped by day with time badges, and manager-only edit/remove actions. Staff without management rights see the timetable read-only.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration, install `btree_gist` and refresh the role grants.

Verified: 260 unit tests, 110 mocked HTTP E2E tests, 88 real-database integration tests (including RLS on `class_schedule_slots` and a direct DB assertion of the exclusion backstop), typecheck, lint, format, API build, `next build` and a browser walkthrough (link a subject, add slots, reject an overlap, accept an adjacent slot, edit and remove a slot).

- [ ] Implement class and batch creation.
- [x] Implement subject management.
- [x] Assign teachers to classes.
- [x] Enroll students into classes.
- [x] Implement class capacity.
- [x] Implement timetable management.
- [x] Implement class schedules.
- [ ] Implement class history.

# Phase 6 — Attendance Management

**Status: In progress — batch 1 (daily register API and class-page UI), batch 2 (class and student summaries) and the cross-class attendance hub delivered**

### Daily register notes (November 14, 2026)

Attendance is stored per class per day: one `attendance_sessions` row per `(class_id, session_date)` holding the author, and one `attendance_records` row per student with a status and optional note. Records are never deleted when a student leaves the class, so saved history keeps the students who were enrolled on that day.

- `attendance_sessions` and `attendance_records` tables (migration `20261114190000_add_attendance`) with `PRESENT/ABSENT/LATE/EXCUSED` statuses, `(class_id, session_date)` and `(session_id, student_id)` uniqueness, cascade foreign keys, a `SET NULL` author link to the membership that last saved the register, and tenant RLS on both tables.
- Routes under `/workspaces/:workspaceId`: `GET /classes/:classId/attendance?date=YYYY-MM-DD` and `PUT /classes/:classId/attendance` (`{ date, records: [{ studentId, status, note }] }`). Reads allow OWNER/ADMIN/BRANCH_MANAGER/TEACHER.
- Writes: managers (OWNER/ADMIN/BRANCH_MANAGER) and the class's own assigned teachers. Any other teacher gets 403 ("Only this class's teachers can record attendance"); students and outsiders are refused by the role guard.
- A register only shows the class's currently active enrollments, and a save rejects students who are not actively enrolled (400). Unmarked students are simply absent from `records`, so a partial register is valid. Archived classes reject writes with 409 but stay readable.
- Dates are calendar days (`YYYY-MM-DD`) validated as real dates, and a save more than one day in the future is refused (a one-day slack covers workspaces ahead of UTC).
- Edits are allowed at any time. Saving diffs against the stored register: only changed records are written, and `ATTENDANCE_RECORDED` is logged the first time a day is saved, `ATTENDANCE_UPDATED` only when a later save actually changes a mark or note. Metadata carries counts and student ids — no names or note text.
- Web UI: an Attendance card on the class detail page with previous/next day navigation (next stops at today), status buttons, per-student notes, a "Mark remaining present" shortcut, live counts and a "Last saved ... by ..." line. Non-writers see the same register as read-only status badges with an explanation.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration and refresh the role grants.

Verified: 276 unit tests, 118 mocked HTTP E2E tests, 94 real-database integration tests (including RLS on `attendance_sessions` and `attendance_records`), typecheck, lint, format, API build, `next build` and a browser walkthrough (mark and save a register, correct an excusal, confirm an earlier day is empty, restore the saved day, and confirm the read-only view for a teacher who is not assigned to the class).

### Class and student summaries notes (November 14, 2026)

Summaries are computed on read from the stored registers — no new tables or migration. Two routes under `/workspaces/:workspaceId`, readable by OWNER/ADMIN/BRANCH_MANAGER/TEACHER:

- `GET /classes/:classId/attendance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` — sessions and status counts for the class in the range, plus one row per student who was enrolled in that period: session count, status counts, attended count and rate. Active enrollments seed the rows (so a student with no marks shows zeroes and a null rate), and students who have since left keep their history as `active: false` rows. Rows are sorted by name.
- `GET /students/:studentId/attendance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` — the same totals grouped by class, with class name and status; returns 404 when the student is not in the workspace.

Rate rule: present and late marks count as attended; excused marks are excluded from the denominator, so approved leave never lowers a rate. `rate = (present + late) / (present + absent + late)`, rounded to one decimal and `null` when no mark in the range counts (for example, only excused marks). Unmarked days have no record, so they are never counted either way.

The range is inclusive `from`/`to`, must be real `YYYY-MM-DD` calendar days, must not be inverted and is capped at 366 days (400 otherwise). The API has no default range; the web UI defaults to the last 30 days and offers 7/30/90-day presets plus explicit dates.

Web UI: an Attendance summary card on the class detail page (totals, class rate, per-student table with a "Left class" marker for leavers) and on the student detail page (totals, attendance rate, per-class table). Both use the shared range picker and refetch client-side without reloading the page.

Verified: 284 unit tests, 125 mocked HTTP E2E tests, 99 real-database integration tests, typecheck, lint, format, API build, `next build` and a browser walkthrough (three saved registers across two students, class summary totals and rates, a 7-day preset, a narrow custom range and the student summary across the same class).

### Attendance hub notes (November 14, 2026)

The Attendance tab is now a live landing page instead of a disabled menu item; the register itself stays on the class page.

- `GET /workspaces/:workspaceId/attendance/overview?date=YYYY-MM-DD` (OWNER/ADMIN/BRANCH_MANAGER/TEACHER) lists every active class with its active-enrollment count, the saved session's author and last-saved time, and present/absent/late/excused/unmarked counts for that day. Classes without a register return `session: null` and `counts: null`; archived classes are excluded. No new tables or migration.
- Three bounded queries (active classes, sessions for the date, a `groupBy` of record counts). `unmarked` is clamped at zero because a saved register keeps records for students who have since left the class.
- Web: `apps/web/src/app/workspaces/[workspaceId]/attendance/page.tsx` shows the totals (active classes, saved, not started), a date picker capped at today, a per-class table and an "Open register" / "Mark register" link that deep-links to `…/classes/:classId?date=…#attendance`. An invalid or future `date` falls back to today. The class page now honours `?date=` for the attendance card and exposes the `#attendance` anchor; the sidebar Attendance entry points at the hub.

Verified: 313 unit tests, 142 mocked HTTP E2E tests, 108 real-database integration tests, typecheck, lint, format, API build, `next build` and a browser walkthrough (a hub with one unsaved and one saved class, the saved-by line and mark counts, date switching, the deep link into that day's register and the fallback for invalid and future dates).

- [x] Implement daily attendance.
- [x] Implement manual attendance recording.
- [x] Implement attendance editing.
- [x] Implement attendance history (day-by-day register viewing).
- [x] Implement student attendance summaries.
- [x] Implement class attendance summaries.
- [ ] Implement attendance reports.

# Phase 7 — Finance and Fee Management

**Status: In progress — batch 1 (fee plans, student fee records, monthly generation, payments) delivered**

### Fee plans and student fee notes (November 14, 2026)

Finance is manager-only: every route requires OWNER/ADMIN/BRANCH_MANAGER. Amounts are `Decimal(12,2)` in the workspace currency and are serialized as fixed two-decimal strings.

- `fee_plans`, `student_fees` and `payments` tables (migration `20261114200000_add_finance`) with tenant RLS on all three. `student_fees` caches `paid_amount` and `status` next to the billed `amount`, and both fee and payment rows record the membership id that created them (`SET NULL` on deletion).
- Fee plans are monthly by default (due day 1–28) and can target one class or every active class. A plan is archived with a status change rather than deleted, so existing fee records keep their link.
- `POST /finance/plans/:planId/generate` creates one record per actively enrolled student for a month, skipping duplicates via the `(student_id, fee_plan_id, period_month)` unique key, and reports created/skipped counts. Archived plans, archived classes and non-monthly plans are refused.
- Manual fee records (`POST /finance/fees`) cover one-off charges that do not belong to a plan. A `PATCH` can edit the description, amount, due date and note, or void the record; voided records keep their history and refuse payments.
- Payments (`POST /finance/fees/:feeId/payments`) support `CASH` and `BANK` with a paid date, optional reference and note. The fee's paid amount, balance and derived `UNPAID/PARTIAL/PAID` status update in the same transaction. Deleting a payment restores the previous balance.
- `GET /finance/overview?month=YYYY-MM` returns billed and collected totals for the month, all-time outstanding, overdue count and status counts.
- Audit events: `FEE_PLAN_CREATED`, `FEE_PLAN_UPDATED`, `FEE_PLAN_ARCHIVED`, `STUDENT_FEE_CREATED`, `STUDENT_FEE_UPDATED`, `STUDENT_FEES_GENERATED`, `PAYMENT_RECORDED`, `PAYMENT_DELETED`. Metadata carries ids and amounts only — no student names or free text.
- Web UI: a Finance page with month summary cards, status chips, the plan table (edit, generate for a month, archive/reactivate, view fees) and a filterable fee-record table. Plan create/edit pages, a manual fee form, and a fee detail page with the payment history and a record-payment panel.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration and refresh the role grants.

Verified: 307 unit tests, 138 mocked HTTP E2E tests, 106 real-database integration tests (including RLS on `fee_plans`, `student_fees` and `payments`), typecheck, lint, format, API build, `next build` and a browser walkthrough (create a class plan, generate a month, record a partial cash payment, settle by bank transfer, delete a payment, create and void a manual fee, archive/reactivate the plan and edit its amount).

- [x] Implement fee structures.
- [x] Implement student fee records.
- [x] Implement monthly fee management.
- [x] Implement cash payment recording.
- [x] Implement bank payment recording.
- [x] Implement payment history.
- [x] Implement outstanding balance calculations.
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
