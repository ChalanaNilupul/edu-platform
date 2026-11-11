# Edu Platform

A planned multi-tenant SaaS education platform for independent tuition teachers and larger educational institutes, launching Sri Lanka-first.

## Product direction

Edu Platform combines an **LMS (Learning Management System)** and an **IMS (Institute Management System)**. It is intended to support both independent tuition teachers and institutes, including organizations with multiple branches.

The initial market is Sri Lanka. The first release is planned around LKR and English, Sinhala and Tamil language readiness. International expansion is a later roadmap goal; the initial architecture should avoid unnecessary country-specific assumptions without delaying the Sri Lankan MVP.

### Product workspaces

- **Platform administrator:** manages the SaaS platform, tenants and subscription operations.
- **Institute owner/admin:** manages an organization, branches, staff, classes, students and institute operations.
- **Independent teacher:** can create and manage classes and students without first creating an institute.
- **Teacher/staff:** manages assigned classes, learning activities, attendance and student progress.
- **Student:** accesses enrolled classes, resources, assignments, exams and results.
- **Parent/guardian:** views information for linked children, including attendance, results, fee status and announcements.

## Approved MVP scope — Phase 0.3

The approved first release includes all six core modules and three additional capabilities:

1. **Student and teacher management:** student profiles, teacher profiles, parent/guardian details, enrollment and validated CSV import.
2. **Class and batch management:** subjects, classes, batches, teacher assignments and timetables/schedules.
3. **Attendance and finance:** manual attendance, monthly fee structures, cash/bank payment recording, outstanding balances, receipts and payment history.
4. **Learning management:** lessons, PDF/video learning resources, assignments, student submissions and teacher feedback/marking.
5. **Examinations:** question bank, MCQ and true/false questions, timed exams, automatic marking, results and rankings.
6. **Student portal:** secure login, enrolled classes, learning resources, assignments, exams, attendance and results.
7. **Basic parent portal:** parent login, linked-child view, attendance, results, fee status and announcements.
8. **Announcements and notifications:** announcements targeted to relevant classes, batches or users, with in-app notifications.
9. **Basic reports:** student/enrollment, attendance, examination/performance and financial summaries.

### Two onboarding paths

- **Independent teacher:** creates an account/workspace, sets up classes and adds students without needing an institute.
- **Institute:** creates an organization, can configure branches, invite staff and manage multiple teachers.

Both paths use the same underlying multi-tenant platform with appropriate role and permission boundaries.

### MVP boundaries

The following are not required for the first release unless separately approved:

- Live classroom video, live quiz competitions, real-time leaderboards, polls and interactive whiteboards.
- AI question generation, AI marking assistance, material summarization and predictive weakness analysis.
- Online payment gateway integration; the MVP records and tracks cash/bank payments.
- QR attendance; manual attendance is the first-release requirement.
- Native Flutter mobile applications; the first release is web-first and responsive.
- Advanced accounting, payroll, tax automation and complex financial reconciliation.
- Full white-label/custom-domain tooling and international country/payment/compliance support.

The architecture should remain extensible for later localization, currencies, time zones, country-specific providers and compliance, but these are not MVP implementation requirements.

## Current project status

- **Current phase:** Phase 0 — Product discovery and planning
- **Current task:** 0.4 — Requirements and user journeys
- **Completed:** 0.1 product vision and target customers; 0.3 MVP scope approved and documented.
- **In progress:** 0.2 customer and competitor research using desk research, public product information and realistic workflow scenarios. Teacher interviews are not a dependency.
- **Next action:** Define role permissions and end-to-end user journeys for the approved MVP.

See [ROADMAP.md](ROADMAP.md), [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) and [AI_HANDOFF.md](AI_HANDOFF.md).

## Proposed technical direction (not yet finalized)

A possible starting architecture is a modular monolith:

- Web: Next.js, TypeScript and Tailwind CSS
- API: NestJS and TypeScript
- Database: PostgreSQL with Prisma
- Realtime: Socket.IO, when required by later live features
- Cache and background jobs: Redis
- File storage: S3-compatible object storage
- Mobile: Flutter, in a later phase
- Local development and deployment: Docker

These are proposals only. Confirm the stack and architecture before generating application code or installing dependencies.

## Working principles

1. Build for multiple independent tenants from the beginning.
2. Enforce tenant isolation on the server and in database access.
3. Use role-based permissions and audit important administrative actions.
4. Build the approved MVP end-to-end before expanding into later-release features.
5. Verify changes with relevant tests before marking implementation tasks complete.
6. Never commit secrets, API keys, credentials, private student data or production data.

## Progress status

Use `[ ]` not started, `[~]` in progress, `[x]` completed and verified, and `[!]` blocked. A planning task may be marked complete once its documented acceptance criteria are met and reviewed. Implementation tasks require implementation, checks and review before they can be marked complete.
