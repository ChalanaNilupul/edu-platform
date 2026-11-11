# Edu Platform

A planned multi-tenant SaaS education platform for independent tuition teachers and educational institutes, launching Sri Lanka-first.

## Product direction

Edu Platform combines an **LMS (Learning Management System)** and an **IMS (Institute Management System)** in one modular product.

### Business and service models

1. **Shared SaaS — first delivery model:** customers create workspaces on one centrally managed application. Tenant data and files are isolated; the platform operator manages infrastructure and storage.
2. **White-label SaaS — architecture planned:** customers can later use their own branding and custom domains while using the same core application and shared infrastructure.
3. **Dedicated enterprise — future:** separate application, database and storage for customers requiring dedicated infrastructure.

A custom domain does not automatically require a separate deployment.

### Target customers and onboarding

- Independent tuition teachers can create a workspace and manage classes without creating an institute.
- Institutes can create an organization, configure branches and invite staff.
- Both use the same underlying multi-tenant platform with role-based permissions.

### Initial market

- Sri Lanka-first.
- Initial currency: LKR.
- Initial languages: English, Sinhala and Tamil.
- International expansion is a later goal.

## Approved MVP scope

The approved first release includes all six core modules plus parent portal, announcements/notifications and basic reports:

1. Student and teacher management, guardian details, enrollment and validated CSV import.
2. Class and batch management, subjects, teacher assignments and schedules.
3. Manual attendance and finance, monthly fees, cash/bank payment records, balances and receipts.
4. Learning management, lessons, PDF/video resources, assignments, submissions and teacher feedback.
5. Examinations, question bank, MCQ/true-false, timed exams, automatic marking, results and rankings.
6. Student portal for classes, resources, assignments, exams, attendance and results.
7. Parent portal for linked children, attendance, results, fee status and announcements.
8. Targeted announcements and in-app notifications.
9. Basic student, attendance, examination and financial reports.

See [REQUIREMENTS.md](REQUIREMENTS.md) for the approved product requirements and [ROADMAP.md](ROADMAP.md) for release priorities.

## Security and operating principles

- Enforce tenant isolation and role/resource permissions on the server.
- Students see only their own records; parents see only explicitly linked children.
- Teachers and branch managers are restricted to assigned scopes.
- Platform administrator access to private tenant records is **not available by default**. Support access must be temporary, explicitly approved, scoped and audited.
- Track tenant storage usage and enforce plan entitlements.
- Never commit secrets, credentials, private student data or production exports.

## Current project status

- **Current phase:** Phase 0 — Product discovery and planning.
- **Current task:** 0.5 — Architecture and technology decisions.
- **Completed:** 0.1 product vision and target customers; 0.3 MVP scope; 0.4 requirements and user journeys (approved and documented).
- **In progress:** 0.2 customer and competitor research using desk research, public product information and realistic workflow scenarios. Teacher interviews are not a dependency.
- **Next action:** confirm the architecture, tenant model, deployment assumptions, storage design, subscription/entitlement boundaries and integrations.

## Proposed technical direction (not yet finalized)

- Web: Next.js, TypeScript and Tailwind CSS.
- API: NestJS and TypeScript.
- Database: PostgreSQL with Prisma.
- Realtime: Socket.IO when required.
- Cache/background jobs: Redis.
- File storage: S3-compatible object storage.
- Development/deployment: Docker.
- Mobile: Flutter in a later phase.

Start with a modular monolith. Confirm architecture decisions before generating application code or installing dependencies.

## Working principles

1. Build one product with multiple isolated workspaces.
2. Keep shared SaaS first; prepare for white-label and dedicated deployments without building them prematurely.
3. Enforce tenant isolation and role permissions server-side.
4. Build the approved MVP end-to-end before expanding into later-release features.
5. Verify implementation with relevant tests before marking implementation tasks complete.
6. Keep project status synchronized across `README.md`, `ROADMAP.md` and `AI_HANDOFF.md`.
7. Use `[ ]` not started, `[~]` in progress, `[x]` completed and reviewed, and `[!]` blocked.
