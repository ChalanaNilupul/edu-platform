# AI Handoff — Edu Platform

Read this file, `README.md`, `ROADMAP.md` and `PROJECT_STRUCTURE.md` before making project changes. Treat the repository as the source of truth; do not assume a feature is implemented because it was discussed or included in the approved scope.

## Product context

Edu Platform is a Sri Lanka-first, multi-tenant SaaS LMS + IMS for independent tuition teachers and larger educational institutes.

- Initial market: Sri Lanka.
- Initial currency: LKR.
- Planned initial languages: English, Sinhala and Tamil.
- Future international expansion is planned, but is not part of the MVP launch.
- Customer types: independent tuition teachers and institutes, including multi-branch organizations.

### Approved MVP

The user approved the **full six-module MVP**, with three additional first-release capabilities:

1. Student and teacher management: profiles, guardian details, enrollment and CSV import.
2. Class and batch management: subjects, classes, batches, teacher assignments and schedules.
3. Attendance and finance: manual attendance, monthly fees, cash/bank payment records, outstanding balances, receipts and payment history.
4. LMS: lessons, PDF/video resources, assignments, submissions and teacher feedback.
5. Examinations: question bank, MCQ/true-false, timed exams, automatic marking, results and rankings.
6. Student portal: enrolled classes, resources, assignments, exams, attendance and results.
7. Basic parent portal: linked children, attendance, results, fee status and announcements.
8. Announcements and in-app notifications with audience targeting.
9. Basic student, attendance, examination and financial reports.

### Onboarding models

- Independent teacher: create account/workspace, create classes and add students without an institute.
- Institute: create organization, configure branches, invite staff and manage multiple teachers.

Both are supported by the same platform. Tenant boundaries and role permissions must be enforced server-side.

### Explicit MVP exclusions

Do not silently add these to MVP: live video classrooms, live quiz competitions/leaderboards, polls and interactive whiteboards; AI generation/summarization/predictive analysis; online payment gateway; QR attendance; native Flutter apps; advanced accounting/payroll/tax automation; full white-label/custom domains; international market/payment/compliance support.

Keep the architecture extensible, but avoid implementing future-market complexity before it is needed.

## Current state and next task

- Current phase: **Phase 0 — Product discovery and planning**
- Current task: **0.4 — Requirements and user journeys**
- Completed planning decisions: product vision/target customers (0.1) and approved MVP scope (0.3).
- In progress: 0.2 desk research and competitor analysis. The user cannot conduct teacher interviews; do not make interviews a blocker. Use public competitor information, public reviews/documentation, common workflows and realistic teacher/institute/student/parent scenarios.
- Next action: create the role-permission matrix and map the main end-to-end journeys for all MVP roles.
- Do not begin application implementation until requirements and architecture decisions are sufficiently clear.

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

Confirm the stack, tenant model, deployment assumptions and integrations during Phase 0.5. Do not scaffold the entire stack before that decision.

## Working rules

1. Work in small, verifiable tasks. State the current phase, task ID and next action when guiding the user.
2. Before changing code, inspect the existing repository and its conventions.
3. Do not overwrite existing work without checking it first.
4. Keep tenant identity explicit in authorization and data access. Never trust a tenant ID supplied by a client without validating membership and permissions.
5. Design authorization tests that attempt cross-tenant access.
6. Validate inputs at API boundaries and avoid exposing private student information in logs.
7. Never commit `.env` files, credentials, API keys, real student data or production exports.
8. Update `ROADMAP.md`, `README.md` and this file when project status materially changes.
9. Mark a planning task complete only when its documented acceptance criteria are met and reviewed. Mark implementation tasks complete only after implementation, relevant checks and review.
10. Give Windows PowerShell-friendly commands when providing local setup instructions.
11. Do not assume the user can interview teachers; use the agreed desk-research approach.

## Git workflow

- Before starting on a computer: `git pull`.
- Work on one computer at a time; avoid simultaneous edits from office and personal computers.
- Use a task branch, for example `docs/finalize-mvp-scope` or `task/0.4-user-journeys`.
- Run relevant checks, update progress documents, commit and push.
- Merge the completed task branch before switching computers.
- Never claim a push, commit or deployment succeeded unless the command/tool confirms it.
- Do not overwrite remote or local changes without reviewing them first.

## Suggested next work

1. Complete desk research using public sources and record findings with source links.
2. Define roles and permissions for platform admin, independent teacher, institute owner/admin, teacher/staff, student and parent/guardian.
3. Map onboarding, student enrollment, class setup, attendance, fee payment, learning resource, assignment, exam, parent-view and reporting journeys.
4. Record key business rules, edge cases and privacy/security requirements.
5. Proceed to Phase 0.5 architecture decisions only after requirements are reviewed.
