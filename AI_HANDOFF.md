# EduPlatform — AI Development Handoff

Last updated: November 14, 2026

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
- Phase 3 Batch 4 is implemented: workspace-scoped classes and append-only enrollment history, with capacity/archive rules, roster and student-class views, audit events, and a role-aware classes UI.
- Email-verification enforcement (security review finding M1) is implemented: workspace creation and invitation creation require `emailVerifiedAt` and return a 403 with a clear message otherwise; login and workspace switching stay open. Unverified users see a dashboard banner offering a resend.
- Phase 4 Batch 1 is implemented: workspace-scoped teacher profiles attached to memberships (RLS included), a teachers directory/detail/profile API, audit events, and a role-aware web directory with add/edit profile pages.
- Phase 4 Batch 2 is implemented: append-only class-teacher assignments with one active primary teacher per class, partial unique indexes, tenant RLS, manager-only assignment changes, audit events, and a Teachers card on the class page plus an Assigned classes card on the teacher page.
- Phase 5 Batch 1 is implemented: a workspace-level subject catalogue with optional unique codes, a `class_subjects` link table, tenant RLS on both, manager-only CRUD and class-link routes, audit events, a subjects directory with create/edit pages, and a subject picker on the class detail page.
- Phase 5 Batch 2 is implemented: recurring weekly timetable slots per class with an optional teacher and room, `btree_gist` exclusion constraints for class and teacher overlap, manager-only writes, audit events, and a Weekly timetable card with an add/edit form on the class detail page.
- Phase 6 Batch 1 is implemented: per-class daily attendance registers (one session per class per day, one record per student), `PRESENT/ABSENT/LATE/EXCUSED` statuses, tenant RLS on both tables, manager plus assigned-class-teacher writes, audit events only on real changes, and an Attendance card with day navigation on the class detail page.
- Phase 6 Batch 2 is implemented: read-time class and student attendance summaries over a date range (present + late attended, excused excluded from the rate), range validation capped at 366 days, an Attendance summary card on the class and student detail pages with 7/30/90-day presets, and no schema change.
- The attendance hub is implemented: a live `GET /workspaces/:workspaceId/attendance/overview?date=` route and a workspace Attendance page that lists active classes with their register status, author and mark counts, with deep links into each class register for the selected day. The sidebar Attendance item now points at the hub; the class-page register is unchanged apart from honouring `?date=` and the `#attendance` anchor.
- Phase 7 Batch 1 is implemented: manager-only fee plans (monthly, class-scoped or workspace-wide) with monthly generation for actively enrolled students, manual one-off fee records, cash and bank payments that update a cached paid amount/balance in the same transaction, payment deletion, voiding, and a finance page with a month summary plus filterable plan and fee tables.
- Phase 7 Batch 2 is implemented: sequential per-workspace receipt numbers drawn from a `workspace_counters` row inside the payment transaction, a receipt API and a standalone printable receipt page, and a monthly finance report (per-class billed/collected/outstanding plus the month's receipt ledger) with client-side CSV exports.
- Runtime verification of rate limiting and Origin/CSRF checking is complete (November 13, 2026): the global 30 req/60s cap and the auth-route 5/min and 3/min limits return 429; unsafe requests with a foreign or missing Origin are rejected with 403; spoofed `X-Forwarded-For` does not reset the limit while `TRUST_PROXY=false`.
- Verified by 320 unit tests, 144 mocked HTTP E2E tests, 110 real-database integration tests, typecheck, lint, format, API build, `next build` and browser walkthroughs of the student directory, guardian links, CSV import, classes/enrollment, teacher profiles, class-teacher assignments, the subject catalogue and class linking, the weekly timetable (overlap rejection, adjacent slots, edit and remove), the daily attendance register (save, correct, day navigation, read-only teacher view), the attendance summaries (class totals and rates, presets and custom ranges, student view), the attendance hub (saved and unsaved classes, date switching, the deep link into a day's register, invalid/future date fallback), the unverified-email banner plus blocked workspace creation, the finance flow (create a plan, generate a month, partial cash payment, bank settlement, payment deletion, manual fee, void, archive/reactivate, amount edit and filters), and the finance report and receipt flow (report totals, per-class table, receipt ledger, both CSV downloads, printable receipts, and a new payment receiving the next number with an "Open receipt" link while a deleted number stays unissued).
- Still open: manual browser confirmation of invitation creation/acceptance, role changes, workspace switching and password reset; guardian reuse across students; Phase 4 weekly availability; attendance reports; the remaining Low-severity review items.
- Commits `cfcaa1f` (Batch 2), `8e7bab6` (CI/env fixes), `23ce94e` (Batch 3 security fixes), `90b552b` (hydration fix), `18b8bbd` (invitation onboarding), `6b4b29e` (audit logging), `e9ceb42` (students), `e1e35a4` (db:sync), `c4331d1` (guardians), `7b29ca0` (CSV import API), `2ede95d` (CSV import page), `d1cadab` (classes/enrollment), `fa7f0cd` (sidebar Classes/Students nav), `c45a009` (nav docs), `11f3783` (email-verification enforcement), `f72f091` (Phase 4 batch 1) and `9ba01fb` (Phase 4 batch 2) were pushed on `feat/phase-3-student-profiles`. Phase 5 batches 1–2 were pushed in `495b820` and `5eacb0b`, and Phase 6 batch 1 in `5500370` on `feat/phase-6-attendance`. Phase 6 batch 2 and Phase 7 batch 1 were pushed in `018a902` on `feat/phase-7-finance`. The attendance hub was pushed in `1f820cb` on `feat/phase-6-attendance-hub`, and Phase 7 batch 2 in `9660e1f` on `feat/phase-7-finance`.

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

`feat/phase-7-finance` — Phase 7 batch 2 on top of Phase 7 batch 1 (`018a902`) and the attendance hub commit (`1f820cb`).

Current development phase:

**Phase 7 — Finance and Fee Management (batches 1–2 delivered)**

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
- Enrollment history lives in `Enrollment` rows (see below). Bulk CSV creation is handled by the import service (see 9C) rather than by this model.

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

## Class

Workspace-owned teaching group that students are enrolled into; teacher assignment is handled by `ClassTeacher` and subject coverage by `ClassSubject`, while schedules and timetables are still pending.

- Fields: `name` (required), `grade`, `description`, `capacity` (optional, 1–1000), `status` (`ACTIVE`/`ARCHIVED`).
- `(workspaceId, name)` is unique; indexes cover `(workspaceId, status)`.
- `ON DELETE CASCADE` from `Workspace`; RLS is enabled and forced with the same tenant policy.
- A class with any enrollment or teacher-assignment row cannot be deleted (409); archive it instead. Capacity is checked when enrolling or reactivating (completed/withdrawn rows do not count).

## Enrollment

One row per enrollment period, so history survives re-enrollment.

- Fields: `workspaceId`, `studentId`, `classId`, `status` (`ACTIVE`/`COMPLETED`/`WITHDRAWN`), `enrolledAt` (date), `endedAt` (date, nullable), `notes`.
- A partial unique index on `(student_id, class_id) WHERE status = 'ACTIVE'` allows at most one active enrollment per student per class while keeping past rows; a unique violation maps to a 409.
- Moving away from `ACTIVE` sets `endedAt`; reactivating clears it and re-checks capacity. Enrolled students are excluded from the class's enroll picker.
- Cascades from `Workspace`, `Student` and `Class`. RLS is enabled and forced with the same tenant policy.
- Indexes cover `(workspaceId, classId, status)` and `(workspaceId, studentId)`.

## TeacherProfile

Optional teaching profile for an existing workspace membership; it does not create a second user or membership record.

- Fields: `workspaceId`, `membershipId` (unique), `phone`, `qualifications`, `specializations` (text array, default empty), `bio`, `joinedAt` (date), `notes`.
- Cascades from `Workspace` and `Membership`; RLS is enabled and forced with the same tenant policy.
- Indexes cover `(workspaceId)`.
- Managers (OWNER/ADMIN/BRANCH_MANAGER) may edit any profile; a teacher may edit only their own membership's profile. The directory lists role TEACHER members plus any member who has a profile.

## ClassTeacher

One row per teaching-assignment period between a class and a membership; removing a teacher ends the row rather than deleting it.

- Fields: `workspaceId`, `classId`, `membershipId`, `isPrimary` (default false), `assignedAt` (date, defaults to today), `endedAt` (date, nullable).
- A partial unique index on `(class_id, membership_id) WHERE ended_at IS NULL` allows at most one active assignment per teacher per class; a second partial unique index on `(class_id) WHERE ended_at IS NULL AND is_primary = true` enforces one active primary teacher per class. Unique violations map to 409.
- Ending an assignment sets `endedAt`; reassignment inserts a new row, so history survives. Removed rows cannot be edited again (409).
- Cascades from `Workspace`, `Class` and `Membership`. RLS is enabled and forced with the same tenant policy.
- Indexes cover `(workspaceId, classId)` and `(workspaceId, membershipId)`.
- Current assignments are readable by OWNER/ADMIN/BRANCH_MANAGER/TEACHER; past assignments are returned only to managers. Assignment changes are limited to OWNER/ADMIN/BRANCH_MANAGER, and archived classes reject new assignments.

## Subject

Workspace-level catalogue entry shared by every class in that workspace.

- Fields: `name` (required), `code` (optional, stored upper case), `description` (optional), `status` (`ACTIVE`/`ARCHIVED`).
- `(workspaceId, name)` is unique; `(workspaceId, code)` is unique when a code is present, because Postgres treats NULL codes as distinct.
- Cascades from `Workspace`; RLS is enabled and forced with the same tenant policy. Indexes cover `(workspaceId, status)`.
- A subject with any class link cannot be deleted (409); archive it instead. Archived subjects keep existing class links but are hidden from pickers, and only newly added archived ids are refused when a class selection is saved.

## ClassSubject

Join row for the many-to-many relationship between classes and subjects; a class can cover several subjects.

- Fields: `workspaceId`, `classId`, `subjectId`.
- `(classId, subjectId)` is unique; indexes cover `(workspaceId, subjectId)`.
- Cascades from `Workspace`, `Class` and `Subject`; RLS is enabled and forced with the same tenant policy.
- Reads follow the class reader roles (OWNER/ADMIN/BRANCH_MANAGER/TEACHER); the class subject list is replaced by managers only, and archived classes cannot change their subjects.

## ClassScheduleSlot

Recurring weekly timetable period for a class. Slots store a weekday and minutes from midnight rather than dated lessons.

- Fields: `workspaceId`, `classId`, `subjectId`, optional `membershipId` (teacher), `dayOfWeek` (`MONDAY`–`SUNDAY`), `startMinutes` (0–1439), `endMinutes` (1–1440) and optional `room`. A check constraint keeps `start < end`.
- The `btree_gist` extension backs two exclusion constraints over `int4range(startMinutes, endMinutes, '[)')`: `class_schedule_slots_no_class_overlap` and the partial `class_schedule_slots_no_teacher_overlap` (only when a teacher is set). Adjacent half-open ranges are allowed.
- Cascades from `Workspace`, `Class`, `Subject` and `Membership`; RLS is enabled and forced with the same tenant policy. Indexes cover `(workspaceId, classId, dayOfWeek, startMinutes)` and `(workspaceId, membershipId, dayOfWeek, startMinutes)`.
- Reads follow the class reader roles; writes are manager-only. Archived classes reject writes, the subject must be linked to the class and active, and the optional teacher must be directory-eligible.
- Prisma reports exclusion violations as `P2039` with a Postgres `23P01` cause; the service maps that to the same 409 conflict message as its pre-check.

## AttendanceSession and AttendanceRecord

Daily register for a class: one session row per class per day, one record row per student on that day.

- `AttendanceSession`: `workspaceId`, `classId`, `sessionDate` (`DATE`), optional `recordedByMembershipId` (the membership that last saved the register, `ON DELETE SET NULL` so history survives member removal). `(classId, sessionDate)` is unique; index covers `(workspaceId, sessionDate)`.
- `AttendanceRecord`: `workspaceId`, `sessionId`, `studentId`, `status` (`PRESENT`/`ABSENT`/`LATE`/`EXCUSED`) and optional `note`. `(sessionId, studentId)` is unique; index covers `(workspaceId, studentId)`.
- Cascades from `Workspace`, `Class`, `Session` and `Student`; RLS is enabled and forced with the same tenant policy on both tables.
- Records are never deleted when a student leaves a class, so a saved day still lists the students who were enrolled then. Registers only show currently active enrollments when marking.
- Reads follow the class reader roles. Writes allow OWNER/ADMIN/BRANCH_MANAGER plus TEACHER members with an active `ClassTeacher` assignment for that class; other teachers get 403. Archived classes reject writes (409) but stay readable.

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
    ├── /workspaces/[workspaceId]/classes
    │   ├── /workspaces/[workspaceId]/classes/new
    │   └── /workspaces/[workspaceId]/classes/[classId]
    │       └── /workspaces/[workspaceId]/classes/[classId]/edit
    ├── /workspaces/[workspaceId]/teachers
    │   └── /workspaces/[workspaceId]/teachers/[membershipId]
    │       └── /workspaces/[workspaceId]/teachers/[membershipId]/edit
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

The classes and enrollment flow was walked through in a browser: empty classes list → create a class with capacity 2 → enroll two students from the search picker (roster and `2 / 2 enrolled` count updated) → a third student was refused with "Class has reached its enrollment capacity" → complete an enrollment (ended date set, capacity freed) → reactivate it (ended date cleared) → archive the class (enroll form replaced by a notice, delete refused while enrollment rows exist) → reactivate → delete a separate empty class successfully. The student detail page showed the enrolled class, status and dates. `CLASS_CREATED`, `CLASS_UPDATED`, `STUDENT_ENROLLED`, `ENROLLMENT_UPDATED` and `CLASS_DELETED` rows in `audit_events` carried IDs and field names only.

The teacher profiles flow was walked through in a browser: owner opens the Teachers directory (seeded TEACHER membership shown with "No profile yet") → detail → "Add profile" form (phone, teaching-since date, qualifications, comma-separated specializations, bio, notes) → save → detail shows the fields with duplicate specializations removed → the teacher signs in, opens their own profile, edits the bio and saves → a STUDENT membership opening the directory sees the "Teachers are restricted" notice. `TEACHER_PROFILE_CREATED` and `TEACHER_PROFILE_UPDATED` rows appeared in `audit_events`; the walkthrough workspace, memberships and users were deleted afterwards.

The attendance register was walked through in a browser: mark three students (Present, Late with a note, Absent) → live counts and "Unsaved changes" → "Save register" shows "Register saved by …" and "Last saved … by …" → change the late student to Excused and save again (counts update) → "Previous day" shows an empty register for 2026-11-13 → "Next day" restores the saved marks and note → a teacher who is not assigned to the class sees the same register read-only (status badges, no status buttons or save controls) with the "Only managers and this class's teachers can change the register." banner. The walkthrough workspace, users, students and attendance rows were deleted afterwards.

The finance flow was walked through in a browser: create a class plan (LKR 3,500, due day 5) → generate November (2 created, 0 skipped; summary cards and two unpaid rows) → open a fee and record a LKR 1,500 cash payment (status Partial, balance LKR 2,000, history row with recorder) → settle by bank transfer (Paid, balance LKR 0.00, form replaced by the fully-paid notice) → delete the bank payment (back to Partial) → create a manual Grade 9 fee (listed as "One-time", billed total rose) → void it (Void badge, payments disabled, billed total excluded it) → archive and reactivate the plan → edit the plan amount to LKR 4,000 (existing fee records kept LKR 3,500) → combine the plan/status filters and open a month with no records (empty state). The Finance sidebar entry links and marks itself active. The walkthrough workspace, users, classes, students, plans, fees and payments are still in the dev database because the cleanup deletion needs explicit approval.

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

# 9D. Phase 3 — Classes and Enrollment Implementation

Delivered in batch 4 (classes + enrollment history):

- API: `apps/api/src/classes/` (classes and enrollments controllers/services, DTOs, module), registered in `AppModule`. Routes:
  - `GET/POST /workspaces/:workspaceId/classes`, `GET/PATCH/DELETE /workspaces/:workspaceId/classes/:classId`.
  - `GET/POST /workspaces/:workspaceId/classes/:classId/enrollments`, `PATCH /workspaces/:workspaceId/enrollments/:enrollmentId`.
  - `GET /workspaces/:workspaceId/students/:studentId/enrollments`.
- Access: reads for OWNER/ADMIN/BRANCH_MANAGER/TEACHER, writes for OWNER/ADMIN/BRANCH_MANAGER, enforced twice (guard plus `WorkspaceAccessService.requireRoles`). Every lookup is workspace-scoped, so another workspace's class or student returns 404.
- List: search over name/grade/description, optional status filter, `page`/`pageSize` capped at 100 (default 20), newest first, with an active-enrollment count per class.
- Create/update: duplicate class names return 409; updates are diffed, so a no-op save writes nothing. Capacity is optional; the update DTO accepts `null` to clear it. Deleting a class with enrollment rows returns 409 with an archive hint.
- Enrollment: capacity and archived-class checks run inside the tenant transaction; the partial unique index plus a 409 handle concurrent duplicates; moving away from `ACTIVE` sets `endedAt`, reactivating clears it and re-checks capacity. Re-enrollment after completion is supported and keeps the old row.
- Audit: `CLASS_CREATED`, `CLASS_UPDATED` (changed field names), `CLASS_DELETED`, `STUDENT_ENROLLED` (`classId`, `studentId`) and `ENROLLMENT_UPDATED` (`classId`, `studentId`, changed fields, `from`/`to` when status changed). No student names or notes are stored.
- Migrations: `20261113150000_add_classes_and_enrollments` (enums, tables, indexes, foreign keys, RLS) and `20261113151000_add_class_deleted_audit` (additive `CLASS_DELETED` enum value).
- Web: `apps/web/src/lib/classes.ts`, `class-form.tsx`, `class-actions.tsx`, `enroll-student-form.tsx`, `enrollment-actions.tsx`; routes `classes`, `classes/new`, `classes/[classId]` (roster, enroll picker, archive/delete) and `classes/[classId]/edit`; a Classes card on the student detail page; a "Classes" sidebar entry with active-page state.
- Sidebar links originally depended on each page passing its workspace hrefs, so Classes was disabled everywhere except the classes pages and Students was disabled on the dashboard. `DashboardShell` now derives the Classes href from `studentsHref`, and the dashboard and Workspaces page pass both hrefs from `activeWorkspaceId` (commit `fa7f0cd`).
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply both migrations and refresh the client.

# 9E. Phase 4 — Teacher Profiles and Directory Implementation

Delivered in batch 1 (profiles + directory); batch 2 covers class-teacher assignments (§9F) and weekly availability (batch 3) remains:

- API: `apps/api/src/teachers/` (controller, service, DTOs, module), registered in `AppModule`. Routes under `/workspaces/:workspaceId/teachers`:
  - `GET /` — search across first name, last name, email, qualifications and specializations, optional membership status filter, `page`/`pageSize` (default 20, max 100), ordered by role then first name.
  - `GET /:membershipId` — membership plus user and profile.
  - `PATCH /:membershipId/profile` — creates the profile on first save, updates it afterwards; an all-empty payload returns 400.
- Directory eligibility is `role = TEACHER` OR a profile exists (`OR` in the service), so an owner/admin/branch manager who also teaches can appear without changing their role. Every lookup is workspace-scoped; another workspace's membership returns 404.
- Access: reads for OWNER (override)/ADMIN/BRANCH_MANAGER/TEACHER; `PATCH` for OWNER (override)/ADMIN/BRANCH_MANAGER, plus a TEACHER whose membership id matches. The service checks this again with `getActiveMembership` inside the tenant transaction, so self-edit cannot be widened by URL guessing.
- Validation: phone 30, qualifications 200, bio/notes 2000, up to 10 specializations of 50 characters (trimmed, service-side dedupe is left to the UI), `joinedAt` ISO date, all nullable. Blank text is stored as null.
- Audit: `TEACHER_PROFILE_CREATED` and `TEACHER_PROFILE_UPDATED` with the profile id and changed field names only; no profile text.
- Migration: `20261113191154_add_teacher_profiles` (table, unique membership index, FKs, RLS enabled/forced with the tenant policy).
- Web: `apps/web/src/lib/teachers.ts` (types, labels, name/initial helpers), `components/teacher-profile-form.tsx`; routes `teachers`, `teachers/[membershipId]` and `teachers/[membershipId]/edit`; a "Teachers" sidebar entry derived from `studentsHref`. Students and parents get a restricted notice; teachers get "Edit profile" only on their own record.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to create the table, apply RLS and refresh role grants.

# 9F. Phase 4 — Class-Teacher Assignments Implementation

Delivered in batch 2. Assignments keep their history; weekly availability (batch 3) remains:

- API: `apps/api/src/classes/class-teachers.controller.ts` and `class-teachers.service.ts`, registered in `ClassesModule` alongside the classes/enrollments controllers. Routes under `/workspaces/:workspaceId`:
  - `GET /classes/:classId/teachers` — current assignments ordered primary-first; optional `includeEnded=true` adds past rows, but only for managers.
  - `POST /classes/:classId/teachers` — assigns an active, directory-eligible membership; 201.
  - `PATCH /classes/:classId/teachers/:assignmentId` — sets `isPrimary`; promoting clears any other active primary in the same class.
  - `DELETE /classes/:classId/teachers/:assignmentId` — soft-ends the row via `endedAt`; the response includes the ended row.
  - `GET /teachers/:membershipId/classes` — current classes for any staff viewer; past classes only for OWNER/ADMIN/BRANCH_MANAGER.
- Business rules: class must exist in the workspace and be `ACTIVE` (409 otherwise); the target membership must be `ACTIVE` and either role TEACHER or profile-holder (404 otherwise); duplicate active assignment returns 409; ended assignments cannot be changed (409); deleting a class with assignments returns 409 and suggests archiving.
- Audit: `CLASS_TEACHER_ASSIGNED`, `CLASS_TEACHER_PRIMARY_CHANGED` and `CLASS_TEACHER_REMOVED`, each recording `classId`, `membershipId` and the primary flag or end date after commit.
- Migration: `20261114122833_add_class_teachers` (enum values, table, FKs, two partial unique indexes, RLS enabled/forced with the tenant policy).
- Web: types in `apps/web/src/lib/classes.ts`; `components/assign-teacher-form.tsx` and `components/class-teacher-actions.tsx`; the class detail page fetches the assignment list (with history for managers) and the teacher directory for the picker; the teacher detail page fetches `/teachers/:membershipId/classes`.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration and refresh role grants.

# 9G. Phase 5 — Subject Catalogue Implementation

Delivered in batch 1. Subjects are workspace-shared and linked to any number of classes; teacher assignment remains class-level in this batch:

- API: `apps/api/src/subjects/` (controller, service, DTOs, module), registered in `AppModule`. Routes under `/workspaces/:workspaceId`:
  - `GET /subjects` — search across name/code/description, status filter, `page`/`pageSize` (default 20, max 100); rows include `classCount`.
  - `GET /subjects/:subjectId` — detail.
  - `POST /subjects` — create; 201.
  - `PATCH /subjects/:subjectId` — diffed update including `status`; an empty payload returns 400 and a no-op writes no audit row.
  - `DELETE /subjects/:subjectId` — hard delete only when no class is linked; otherwise 409 with an archive hint.
  - `GET /classes/:classId/subjects` — linked subjects for the class.
  - `PUT /classes/:classId/subjects` — replaces the class selection with `{ subjectIds }`.
- Access: reads for OWNER (override)/ADMIN/BRANCH_MANAGER/TEACHER; writes for OWNER (override)/ADMIN/BRANCH_MANAGER.
- Rules: names and codes are unique per workspace (409); codes are trimmed and upper-cased; archived classes reject subject changes (409); unknown subject ids return 404; archived subjects cannot be newly linked but existing links survive a later archive.
- Audit: `SUBJECT_CREATED`, `SUBJECT_UPDATED`, `SUBJECT_ARCHIVED`, `SUBJECT_DELETED` and `CLASS_SUBJECTS_CHANGED`, recording ids, changed field names and added/removed subject ids only.
- Migration: `20261114154500_add_subjects` (enum value, `subjects` and `class_subjects` tables, unique indexes, FKs, RLS enabled/forced with the tenant policy).
- Web: `apps/web/src/lib/subjects.ts` (types, labels), `components/subject-form.tsx` and `components/class-subject-form.tsx`; routes `subjects`, `subjects/new` and `subjects/[subjectId]/edit`; a "Subjects" sidebar entry derived from `studentsHref`; a Subjects card on the class detail page with the multi-select picker for managers.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration and refresh role grants.

# 9H. Phase 5 — Weekly Timetable Implementation

Delivered in batch 2. Slots are recurring weekly periods (weekday plus minute range) rather than dated lessons:

- API: `apps/api/src/classes/class-schedule.service.ts` and `class-schedule.controller.ts` (registered in `ClassesModule`). Routes under `/workspaces/:workspaceId`:
  - `GET /classes/:classId/schedule` — slots ordered by day then start minute, with the subject (id/name/code) and optional teacher (id/first name/last name).
  - `POST /classes/:classId/schedule` — create; 201.
  - `PATCH /classes/:classId/schedule/:slotId` — diffed update; a no-op writes no audit row.
  - `DELETE /classes/:classId/schedule/:slotId` — hard delete with audit.
- Access: reads for OWNER (override)/ADMIN/BRANCH_MANAGER/TEACHER; writes for OWNER (override)/ADMIN/BRANCH_MANAGER.
- Validation: `startMinutes` 0–1439 and `endMinutes` 1–1440 with `start < end` (any minute is accepted; the UI steps by 15 minutes), the subject must be linked to the class and active, the optional teacher must be directory-eligible, and archived classes reject writes. Overlaps return 409 with a class or teacher specific message.
- Database backstop: `btree_gist` plus `class_schedule_slots_no_class_overlap` and the partial `class_schedule_slots_no_teacher_overlap` exclusion constraints. Prisma surfaces the violation as `P2039` with a `23P01` cause, which the service maps to the same friendly 409.
- Audit: `CLASS_SCHEDULE_SLOT_CREATED`, `CLASS_SCHEDULE_SLOT_UPDATED` and `CLASS_SCHEDULE_SLOT_DELETED` record class, subject, teacher, day and minute range (updated rows also list changed field names).
- Migration: `20261114170000_add_class_schedule_slots` (DayOfWeek enum, audit values, `btree_gist`, table with check constraint, indexes, exclusion constraints, FKs, RLS enabled/forced with the tenant policy).
- Web: `apps/web/src/lib/schedule.ts` (day labels, time conversion, slot typing), `components/class-schedule-manager.tsx` and a Weekly timetable card on the class detail page — add/edit form with day, start/end, subject, optional teacher and room; slots grouped by day with manager-only edit/remove; read-only for other staff.
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration, install `btree_gist` and refresh role grants.

# 9I. Phase 6 — Daily Attendance Implementation

Delivered in batch 1. Attendance is recorded per class per day:

- API: `apps/api/src/classes/attendance.controller.ts`, `attendance.service.ts` and DTOs (`get-attendance.query.ts`, `save-attendance.dto.ts`), registered in `ClassesModule`. Routes under `/workspaces/:workspaceId`:
  - `GET /classes/:classId/attendance?date=YYYY-MM-DD` — the register for one calendar day: session metadata, the class's active students with their status (or null) and note, and counts by status.
  - `PUT /classes/:classId/attendance` — body `{ date, records: [{ studentId, status, note? }] }`; creates the session on first save and upserts only changed records afterwards. 200 with the saved register.
- Access: reads for OWNER (override)/ADMIN/BRANCH_MANAGER/TEACHER; writes for OWNER (override)/ADMIN/BRANCH_MANAGER plus a TEACHER with an active assignment on that class. Another teacher receives 403 "Only this class's teachers can record attendance"; students and outsiders are refused by the guard.
- Rules: dates must be real `YYYY-MM-DD` calendar days; saves more than one day ahead are refused (one day of slack covers workspaces ahead of UTC). Every student in a save must be actively enrolled in the class (400), archived classes reject writes (409) but remain readable, and duplicate student ids in one payload are rejected. Partial registers are valid — unmarked students are simply absent from `records`.
- Diffed writes: unchanged marks are not rewritten, records for students who have since left the class are kept, and audit rows are written only when something changed — `ATTENDANCE_RECORDED` on the first save of a day, `ATTENDANCE_UPDATED` on later real changes, with counts and student ids but no names or note text.
- Web: `apps/web/src/lib/attendance.ts` (statuses, labels, colors, `todayInColombo()` and count helpers), `components/attendance-manager.tsx` and an Attendance card on the class detail page. The card has previous/next day controls (next stops at today), status buttons, per-student notes, "Mark remaining present", live counts, a "Last saved … by …" line and an unsaved-changes marker. Non-writers see read-only status badges with a reason banner ("Only managers and this class's teachers can change the register." / archived notice). The card keeps its own client state, so saving does not reset the selected date.
- Migration: `20261114190000_add_attendance` (AttendanceStatus enum, two audit values, both tables, unique indexes, FKs, RLS enabled/forced with the tenant policy).
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migration and refresh role grants.

# 9J. Phase 6 — Attendance Summaries Implementation

Delivered in batch 2 with no schema change; summaries are aggregated on read from the stored sessions and records. Routes under `/workspaces/:workspaceId`, registered on the same `AttendanceController`:

- `GET /classes/:classId/attendance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` — `{ classId, from, to, sessions, counts, attended, rate, students }`. `students` holds one row per student enrolled during the range: `{ studentId, studentCode, firstName, lastName, active, sessions, counts, attended, rate }`. Active enrollments seed the rows (zero counts, null rate) and students who have since left are added from their records with `active: false`. Rows are sorted by last name then first name.
- `GET /students/:studentId/attendance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` — `{ studentId, from, to, sessions, counts, attended, rate, classes }` where each class row adds `classId`, `className` and `classStatus`; sorted by class name. A student outside the workspace returns 404.
- Rate rule: `attended = present + late` and `rate = round(attended / (present + absent + late) * 1000) / 10`. Excused marks are excluded from the denominator so approved leave never lowers a rate, and unmarked days have no record so they never count. `rate` is `null` when nothing in range counts.
- Range rules: `from` and `to` are required, real `YYYY-MM-DD` calendar days (DTO `@IsDateString({ strict: true })` plus the service's own parse), inclusive, `from <= to`, and at most 366 days; violations are 400 and are rejected before any tenant query. The API has no default range — the web UI supplies the last 30 days.
- Access: reads follow the register reader roles (OWNER override/ADMIN/BRANCH_MANAGER/TEACHER); other roles are refused by the guard, and a class or student from another workspace returns 404.
- Web: `apps/web/src/lib/attendance.ts` adds the summary response types, `shiftCalendarDate`, `lastNDays(today, days)`, `formatAttendanceRate` and `attendanceRateClasses`. `components/attendance-summary-shared.tsx` holds the range controls (from/to dates, 7/30/90-day presets, Apply) plus count chips and the rate badge. `components/class-attendance-summary.tsx` renders totals, class rate and the per-student table with a "Left class" marker, and `components/student-attendance-summary.tsx` renders totals, attendance rate and the per-class table. The class and student detail pages fetch the default range server-side and pass it as `initial`; both cards then refetch client-side through `apiFetch` when the range changes.
- No new audit events: summaries are read-only and do not write.

# 9J-2. Phase 6 — Attendance Hub Implementation

Delivered with no schema change; the hub aggregates the existing registers on read. Route under `/workspaces/:workspaceId`, registered on the same `AttendanceController`:

- `GET /attendance/overview?date=YYYY-MM-DD` (OWNER override/ADMIN/BRANCH_MANAGER/TEACHER) returns `{ date, totals: { classes, saved, missing }, classes }`. Each class row is `{ classId, name, grade, enrolledCount, session, counts }`, where `session` is `{ id, recordedBy: { membershipId, name } | null, updatedAt }` or `null`, and `counts` is the register's `present/absent/late/excused/unmarked` or `null` when the day has no register.
- Only `ACTIVE` classes are listed, ordered by name, with `enrolledCount` from active enrollments. Three bounded queries are used (classes, sessions for the date, `groupBy` over record statuses). Because a saved register keeps records for students who have since left, `unmarked` is clamped at zero.
- The date follows the register rules (real `YYYY-MM-DD`, validated by the shared DTO); an invalid date is 400. The endpoint writes nothing and records no audit events.
- Web: `apps/web/src/app/workspaces/[workspaceId]/attendance/page.tsx` (gated by `canViewStudents`) shows three totals cards (active classes, registers saved, not started), a date picker capped at today with a "Jump to today" link on past days, and a per-class table (class and grade, enrolled count, saved-by/last-saved time or "Not started", mark chips, and an "Open register" / "Mark register" link). The link carries `?date=` and `#attendance`; the class page now uses a valid past `?date=` for its attendance card (today otherwise) and the Attendance card carries `id="attendance"` with scroll margin. An invalid or future date on the hub falls back to today.
- `lib/attendance.ts` adds `AttendanceOverviewRow`/`AttendanceOverviewResponse` and `isCalendarDate`. `dashboard-shell.tsx` gains an `Attendance` active page, an `attendanceHref` prop and a resolved fallback from the students route, so the sidebar item is no longer disabled.

# 9K. Phase 7 — Finance Implementation

Delivered in batches 1–2 (core fee flow, receipts and monthly report). Every finance route is manager-only (OWNER override/ADMIN/BRANCH_MANAGER) and runs inside the tenant transaction context:

- API: `apps/api/src/finance/` — `finance.module.ts`, `fee-plans.controller/service`, `student-fees.controller/service`, `payments.controller/service`, `finance-overview.controller/service`, `finance-report.controller/service`, `finance.shared.ts` and DTOs. Routes under `/workspaces/:workspaceId/finance`:
  - `GET /overview?month=YYYY-MM` — billed and collected totals for the month, all-time outstanding, overdue count and all-time status counts.
  - `GET/POST /plans`, `GET/PATCH /plans/:planId`, `POST /plans/:planId/generate` (201).
  - `GET/POST /fees`, `GET/PATCH /fees/:feeId`, `POST /fees/:feeId/payments` (201), `DELETE /fees/:feeId/payments/:paymentId` (204).
  - `GET /payments/:paymentId/receipt` — receipt payload for the printable page.
  - `GET /reports/monthly?month=YYYY-MM` — month totals, per-class breakdown and the month's payment ledger.
- Plans are `MONTHLY` or `ONE_TIME`, target one class or every active class, have a due day 1–28 and are archived rather than deleted (`ACTIVE`/`ARCHIVED`). Generation only works for active monthly plans on active classes: it seeds one fee per actively enrolled active student for the month, skips duplicates through the `(student_id, fee_plan_id, period_month)` unique key and reports `{ totalStudents, created, skipped }`.
- `student_fees` cache `paid_amount` and a derived `UNPAID/PARTIAL/PAID/VOID` status next to the billed `amount`. Payments (`CASH` or `BANK`, with paid date, optional reference and note) update the cache in the same transaction; deleting a payment restores the balance and status. Voided records reject further payments. Amounts are `Decimal(12,2)` and serialize as fixed two-decimal strings.
- Receipt numbers are drawn from a per-workspace `payment_receipt` counter row (`workspace_counters`) with a single `upsert` + `{ value: { increment: 1 } }` inside the payment transaction. A rolled-back payment also rolls back the increment; a deleted payment never releases its number. Existing payments were backfilled by `ROW_NUMBER()` ordered by `created_at`, `id`, and each workspace counter starts at the highest number already in use. Numbers render as `RCPT-000001`.
- The receipt payload carries workspace name/currency, receipt number, amount, method, paid date, reference, note, recorded timestamp and author name, student name/code, class name and the fee's description, period, total, paid-to-date, balance and status. A payment outside the workspace returns 404 and teachers are refused by the guard.
- The monthly report treats billed as the month's fee records (`period_month`, falling back to the creation month for one-off fees), collected as payments with `paid_at` in the month, outstanding as the current all-time balance, and overdue as past-due fees with a balance (the same query as the overview). Classes are alphabetical with an unassigned "No class" bucket last. An invalid `month` is rejected before any tenant query.
- Audit events `FEE_PLAN_CREATED`, `FEE_PLAN_UPDATED` (including archival), `FEE_PLAN_ARCHIVED`, `STUDENT_FEE_CREATED`, `STUDENT_FEE_UPDATED`, `STUDENT_FEES_GENERATED`, `PAYMENT_RECORDED` and `PAYMENT_DELETED` carry ids, field lists and amounts only; payment events also carry `receiptNo`.
- Web: `apps/web/src/lib/finance.ts` (types, labels, colors, money/month helpers), `components/fee-plan-form.tsx`, `fee-plan-actions.tsx` (inline month picker + generate, archive/reactivate), `student-fee-form.tsx`, `record-payment-form.tsx`, `fee-actions.tsx`, `payment-actions.tsx`, plus the finance page (summary cards with a month picker, status chips, plan table, filterable fee table and pagination), plan create/edit pages, manual fee page and fee detail page. The fee detail payment history has a Receipt column and the record-payment success message links to the new receipt. `components/print-receipt-button.tsx` and the standalone receipt page at `/finance/receipts/:paymentId` render a printable document without app chrome. `components/report-export-buttons.tsx` and the report page at `/finance/reports` render the summary cards, per-class table with totals, receipt ledger and two client-side CSV downloads; the finance hub header links to it. `canManageFinance` in `lib/workspace-session.ts` gates the pages, and the `Finance` item in `dashboard-shell.tsx` resolves to the workspace finance route.
- Migrations: `20261114200000_add_finance` (BillingPeriod, FeePlanStatus, FeeStatus and PaymentMethod enums, eight audit values, three tables, unique/indexes, FKs and tenant RLS on `fee_plans`, `student_fees` and `payments`) and `20261114210000_add_payment_receipts` (`payments.receipt_number` plus its unique index, `workspace_counters` with RLS, the backfill and the counter seed).
- Run `pnpm --filter @edu-platform/api db:sync` after pulling to apply the migrations and refresh role grants; `pnpm --filter @edu-platform/api prisma generate` if the client was not regenerated.

# 10. Testing Status

Current verified results after Phase 7 batch 2:

## Unit Tests

320 tests passed across 26 files:

- Authentication service.
- Workspace service.
- Workspace access service.
- Memberships service.
- Invitations service.
- Students service.
- Students import service (17 tests covering report shape, per-row errors, in-file and existing duplicates, import counts, blocked invalid files, limits and role rejection).
- CSV parser (9 tests covering quoting, escapes, embedded newlines, BOM, CRLF, line numbers and malformed input).
- Guardians service.
- Classes service (17 tests covering list/search/pagination, duplicate names, diffed updates, delete guard including teacher assignments and role checks).
- Class-teachers service (20 tests covering class and teacher views, manager-only history, assignment validation, primary moves, soft-end history and role checks).
- Subjects service (25 tests covering list filters/pagination, create/update/delete rules, duplicate names and codes, P2002 mapping, archive audit transitions, class subject views, selection replacement, archived-class and archived-subject rules, and role checks).
- Class schedule service (23 tests covering list ordering, create variants and adjacent times, archived-class/minutes/subject/teacher rules, class and teacher overlap conflicts including the P2039 mapping, diffed updates, deletes and role checks).
- Attendance service (30 tests covering the unmarked roster, merged saved statuses, invalid dates, missing classes, first save and audit metadata, no-op saves, corrections, duplicate students, future dates, non-enrolled students, archived classes, assigned vs unassigned teachers, manager access, leaver history, class summary rate maths with excused excluded, sort order, leaver rows, empty summaries, range rejection, student summary grouping/404, the day overview with saved and unsaved classes, unmarked clamping, empty workspaces, invalid dates and role propagation).
- Fee plans service (8 tests covering creation with parsed amounts and defaults, unknown classes and duplicate names, list filters/pagination, diffed update auditing, the archive event, generation per active enrollment with duplicate skipping, one-time/archived/archived-class rejection and cross-workspace 404s).
- Student fees service (7 tests covering status/month/student filters, manual creation, unknown student or class rejection, status recalculation when the amount rises above the paid total, blocking amounts below the paid total and voiding with payments, voiding with audit, and cross-workspace 404s).
- Payments service (10 tests covering recording with cached totals and audit, overpayment and voided-fee rejection, future-date rejection before any query, locked-fee 404s, deletion with recalculation and audit, payments that do not belong to the fee, receipt allocation through the workspace counter, sequence continuation, no allocation for rejected payments, and the receipt lookup with its 404s).
- Finance overview service (2 tests covering month totals/balances and the LKR fallback when the workspace row is missing).
- Finance report service (3 tests covering the per-class breakdown, totals and payment view with the unassigned bucket last, the LKR fallback, and month rejection before any tenant query).
- Enrollments service (19 tests covering capacity, archived classes, history, status transitions, `endedAt` handling, duplicate 409 and role checks).
- Teachers service (11 tests covering directory eligibility, search/status/pagination, detail 404s, profile creation and update, empty-payload rejection, and manager vs teacher-self authorization).
- Session guard.
- Workspace roles guard.
- App setup (`TRUST_PROXY` parsing).
- Database role startup check.
- Health controller.

## E2E HTTP Tests

144 tests passed across 12 files:

- Authentication E2E (13).
- Workspace and invitation E2E (19).
- Students E2E (16, including import routing, role refusal and payload validation).
- Guardians E2E (12).
- Classes and enrollment E2E (14).
- Teachers E2E (6: unauthenticated refusal, directory query parameters, detail, manager profile update, invalid payload, student refusal).
- Class teachers E2E (9: unauthenticated refusal, list history flag, assign, missing membership id, primary patch, remove, teacher history, malformed id, student refusal).
- Subjects E2E (10: unauthenticated refusal, directory query parameters, create with code normalisation, empty name rejection, patch, delete, class subject read/replace, duplicate and malformed ids, student refusal).
- Class schedule E2E (10: unauthenticated refusal, list, create, invalid payloads, unequal minutes rejection, patch, delete, malformed ids, student refusal).
- Attendance E2E (19: unauthenticated refusals, register read with date forwarding, missing/malformed/impossible dates and extra query rejection, malformed class id, save payload shaping with trimmed note, invalid payload matrix, teacher access, student refusal, class/student summary forwarding, missing or malformed ranges and extra query rejection, service 400 surfacing, malformed ids, teacher summary access with student refusal, overview date forwarding, overview query validation and overview teacher/student access).
- Finance E2E (15: unauthenticated refusal, plan list query forwarding, plan creation with numeric amounts coerced to decimal strings, invalid plan payloads, malformed ids and queries, generation with conflicts, fee list/create, invalid fee filters and payloads, update/void, payment recording and validation, payment deletion with an empty body, overview month validation, receipt reads with 404 and malformed id, monthly report forwarding and month validation, and branch-manager access with teacher/student refusal).
- Application E2E (1).

## Database Integration Tests

110 tests passed against a real PostgreSQL 17 database:

- 20 auth/workspace/invitation tests through the real HTTP pipeline, middleware and Prisma (session persistence, Argon2 hashing, CSRF rejection, workspace switching, cross-tenant 403s, invitation lifecycle, unverified invitation rejection).
- 6 student tests: create/search/filter/pagination/detail, duplicate and invalid input, teacher read-only access, cross-workspace isolation, update with status change and audit metadata, unauthenticated access.
- 7 guardian tests: create with primary defaulting and demotion, detail with linked students, diffed updates with audit metadata, unlink-then-delete with the 409 guard, teacher read-only access, cross-workspace isolation, invalid input and unauthenticated access.
- 6 import tests: validate/import with in-file and existing duplicates (including that a repeat import never overwrites), rejected invalid files with no writes, per-workspace code scoping, malformed CSV messages, teacher refusal and outsider/unauthenticated access.
- 8 classes/enrollment tests: class lifecycle with audit metadata, capacity and archived-class rules, enrollment history including re-enrollment ordering, teacher read-only access, cross-workspace isolation, invalid data, duplicate active enrollment and unauthenticated access.
- 5 teacher tests: directory + profile create/detail with audit metadata, teacher self-edit but not another member, manager profiling a non-teaching member, student/non-member refusal, and cross-workspace directory isolation.
- 9 class-teacher tests: primary assignment visible from both the class and teacher views with audit metadata, primary movement, soft-end/history/reassign, manager-only history (teacher list and class page with `includeEnded=true`), duplicate/archived/ineligible/missing teacher rules, teacher read-only access with student/outsider refusal, cross-workspace isolation, class delete guard and invalid payloads.
- 10 subject tests: create with audit metadata and class counts, search/filter/pagination, duplicate name/code and invalid payloads, diffed update with archive events, delete guard and `SUBJECT_DELETED`, class subject replacement with audit counts, archived subject/class/unknown-id rules, existing archived links surviving a later archive, teacher read-only with student/outsider refusal, and cross-workspace isolation.
- 8 class schedule tests: ordered list with audit counts, create variants with audit metadata, class overlap rejection and adjacent slots, teacher double-booking rejection, validation (range, unlinked subject, ineligible teacher), update/delete with cross-class 404s and audit, archived-class blocking with role access, and a direct DB assertion that the exclusion constraint reports `P2039`/`23P01`.
- 13 attendance tests: recording a register with audit metadata, corrections with only-changed audit rows and leaver history retained, validation (future date, impossible date, duplicates, withdrawn student, unknown id, zero writes), archived-class blocking with history readable, assigned-teacher writes with other-teacher/student/outsider refusal, cross-workspace 404s, class summary counts/rates with excused excluded and narrow/out-of-range windows, inactive leaver rows, student summaries across two classes, range validation, summary role/workspace scoping, and the day overview across active classes (saved vs unsaved, archived excluded, totals, other-day switch, invalid dates, role and workspace scoping).
- 7 RLS policy tests run as a restricted non-superuser role: no-context visibility, tenant visibility, user context, cross-tenant insert rejection (memberships, students, guardians, links, classes, enrollments, teacher profiles, class-teacher assignments, subjects, class subjects, schedule slots, attendance sessions, attendance records, fee plans, student fees, payments and workspace counters), cross-tenant update/delete, class visibility/update/delete, system bypass and no leakage between transactions.
- 9 finance tests: plan creation with per-workspace unique names, generation once per student/period/plan, payment recording and balance reversal with audit counts and continuing receipt numbers, fee edit/future-payment/void validation, overview totals, manager-only access with cross-workspace scoping, payload/date validation, per-workspace receipt numbering with a printable receipt (cross-workspace 404, new workspace starting at 1, teacher refusal), and the monthly report (totals, class row, ledger, empty month and invalid month validation).

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

- ~~Verify rate limiting at runtime (configure `TRUST_PROXY` for the deployment topology first).~~ Done November 13, 2026: the global 30 req/60s cap and the per-route 5/min (login, register) and 3/min (resend, forgot, reset) limits return 429. A spoofed `X-Forwarded-For` is ignored while `TRUST_PROXY=false`, so it cannot reset the counter.
- ~~Verify Origin checking at runtime.~~ Done November 13, 2026: unsafe methods with a foreign or missing Origin/Referer and a session cookie return 403 "Forbidden origin"/"Missing request origin"; a foreign preflight receives 204 carrying the configured allow-origin header, so the browser still blocks the real request.
- Email verification enforcement (M1): workspace creation and invitation creation now require a verified email. Login, workspace switching, and the student/guardian/class/enrollment routes still allow unverified users; revisit only if the product decides to gate more actions.
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

### Email verification enforcement (M1)

- Enforcement points (`November 13, 2026`): `WorkspacesService.create` and `InvitationsService.create` throw `ForbiddenException` with "Verify your email address before creating a workspace" / "…before inviting members" when `emailVerifiedAt` is null. `SessionAuthGuard` already loads `emailVerifiedAt` through `AuthService.getCurrentSession`, so no extra query was added.
- Deliberately not gated: login, workspace switching, and all student/guardian/class/enrollment routes. Invitation acceptance was already gated in Phase 2.
- API contract change: `POST /workspaces` and `POST /workspaces/:workspaceId/invitations` now return 403 for unverified sessions. Unit, mocked E2E and real-database integration tests cover both directions (blocked before verification, allowed after).
- Web: `DashboardShell` renders `EmailVerificationBanner` for sessions without `emailVerifiedAt`. The banner explains the restriction and posts to the existing session-authenticated `POST /auth/email/resend`, with "Sending…"/"Email sent" states. It disappears once the session reports a verified email.
- A stale `UpdateEnrollmentDto.notes` type (`string` instead of `string | null`) was corrected so the API typecheck matched the runtime clearing behavior.

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

- Student profiles and directory (3.1, 3.4), guardians (3.2), CSV import (3.5) and enrollment (3.3) are delivered. Classes here are deliberately minimal; teacher assignment, subjects, schedules and timetables belong to Phase 5.
- Reusing one guardian record across several students (for siblings) is not implemented; every guardian is created for one student context.
- `STUDENT` and `PARENT` memberships still have no student-directory read access by design; revisit when the student portal phase starts.
- Users without an active workspace must switch workspace once before the Students sidebar entry becomes a link.

## Phase 4 Remaining Work

- Batch 1 (profiles + directory) and batch 2 (class-teacher assignments) are delivered. Weekly availability is the remaining Phase 4 batch; it needs a weekly grid with overlap checks.
- Teacher invitations reuse the Phase 2 invitation flow, so no teacher-specific invite screen exists.
- The Teachers sidebar entry follows the same rule as Students and Classes: it needs an active workspace before it becomes a link.

## Phase 5 Remaining Work

- Batch 1 (subject catalogue + class links) and batch 2 (weekly timetable) are delivered; batches/sections, class history beyond enrollment periods and room/resource management remain.
- Timetable slots are weekly patterns only; there is no dated lesson, cancellation or substitution model yet, and teacher-absence handling is not implemented.
- Teacher-to-subject specialization is not modeled yet; class-teacher assignments stay class-level until a `class_subject_teachers` design is agreed.
- The subject delete route is API-only: the UI deliberately offers archive instead, and deletion is blocked while any class is linked.
- The Subjects sidebar entry follows the same rule as Students, Classes and Teachers: it needs an active workspace before it becomes a link.

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

Delivered: student profiles (create, edit, status), student directory with search, filtering and pagination, detail pages, guardian records and student links, preview-first CSV import with duplicate skipping, classes with capacity/archive rules, enrollment history with status management, and workspace-scoped RLS plus audit events.

Still open:

- Bulk class/section management and enrollment import (not requested yet).

## Phase 4 — Teacher Management

Delivered: teacher profiles attached to memberships (batch 1), the teacher directory and detail/edit pages, role-aware self-editing, and class-teacher assignments with a primary flag (batch 2).

Still open:

- Weekly availability slots with overlap checks (batch 3).

## Phase 5 — Classes and Batches

Partially started: class records, capacity and student enrollment were delivered with Phase 3 batch 4, and the subject catalogue with class links is delivered in batch 1. Remaining:

- Batch/section management.
- Teacher-to-subject specialization.
- Timetables and schedules.
- Class history beyond enrollment periods.

## Phase 6 — Attendance

Batch 1 delivered: per-class daily registers with `PRESENT/ABSENT/LATE/EXCUSED` statuses, manager and assigned-teacher writes, editing at any time with audit events, day-by-day history on the class page, and read-only access for other staff.

Batch 2 delivered: class and student attendance summaries over a selectable range, rate = attended / (present + absent + late) with present and late attended and excused excluded, and summary cards on the class and student detail pages.

Attendance hub delivered: the sidebar Attendance tab opens a workspace page listing active classes with the selected day's register status, author, last-saved time and mark counts, linking straight into each class register for that date.

Still open:

- Attendance reports and exports.
- Attendance visibility for students and parents (Phase 10 portals).

## Phase 7 — Finance

Batch 1 delivered: fee plans (monthly, class-scoped or workspace-wide) with monthly generation for actively enrolled students, manual one-off fee records, cash and bank payments with a cached paid amount/balance/status updated in the same transaction, payment deletion, voiding, and a manager-only finance page with a month summary and a filterable fee table.

Batch 2 delivered: sequential per-workspace receipt numbers that survive deletion, a receipt API and printable receipt page, and a monthly finance report with a per-class breakdown, receipt ledger and CSV exports.

Still open:

- Finance exports beyond the two client-side CSVs (for example PDF or date-range reports).
- Payment edit/correction beyond delete-and-re-record.

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

1. Finish manual browser confirmation of invitation creation/acceptance, role changes, workspace switching and password reset.
2. ~~Verify rate limiting and Origin checking at runtime.~~ Done November 13, 2026 — see §11.
3. ~~Decide whether to extend email-verification enforcement beyond invitation acceptance.~~ Done November 13, 2026 — enforced for workspace creation and invitations; login and workspace switching stay open.
4. Phase 4 batch 1 and batch 2 are delivered and pushed; Phase 5 batches 1–2, Phase 6 batch 1 and Phase 7 batch 1 are pushed. The attendance hub (`1f820cb`) and Phase 7 batch 2 (receipts and the monthly finance report, both verified) were pushed in `9660e1f`. Next: pick between Phase 4 batch 3 weekly availability, Phase 6 attendance reports and the remaining Phase 7 polish.

The Phase 2 runtime security checks, the M1 scope decision and Phase 4 batches 1–2 are closed. Phase 5 batches 1–2, Phase 6 batch 1, Phase 7 batch 1, the attendance hub and Phase 7 batch 2 are pushed. Remaining before further batches is browser confirmation of the invitation, role-change and password-reset flows, plus the deferred guardian reuse polish.

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
