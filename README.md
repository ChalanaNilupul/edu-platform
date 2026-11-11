# Edu Platform

A planned multi-tenant SaaS education platform for independent tuition teachers and larger educational institutes, starting with the Sri Lankan market.

## Product direction

The platform is intended to combine:

- **LMS (Learning Management System):** courses, lessons, learning materials, assignments, exams, marking and progress.
- **IMS (Institute Management System):** students, teachers, staff, classes, batches, attendance, fees and administration.
- **Live learning:** real-time quizzes, competitions, polls and interactive classroom tools.
- **SaaS administration:** tenant workspaces, subscription plans, usage limits and platform operations.

The product should support individual teachers as well as multi-branch institutes. Sinhala, Tamil and English are planned.

## Current project status

- **Current phase:** Phase 0 — Product discovery and planning
- **Current task:** 0.1 — Define product vision and target customers
- **Status:** Planning; no application stack or production architecture has been finalized.
- **Next action:** Validate the main problems and workflows with teachers, institute owners, students and parents.

See [ROADMAP.md](ROADMAP.md), [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) and [AI_HANDOFF.md](AI_HANDOFF.md).

## Proposed technical direction (not yet finalized)

A possible starting architecture is a modular monolith:

- Web: Next.js, TypeScript and Tailwind CSS
- API: NestJS and TypeScript
- Database: PostgreSQL with Prisma
- Realtime: Socket.IO
- Cache and background jobs: Redis
- File storage: S3-compatible object storage
- Mobile: Flutter, in a later phase
- Local development and deployment: Docker

These are proposals only. Confirm the stack and architecture before generating application code or installing dependencies.

## Working principles

1. Build for multiple independent tenants from the beginning.
2. Enforce tenant isolation on the server and in database access.
3. Use role-based permissions and audit important administrative actions.
4. Keep the first release focused; add advanced AI and live features incrementally.
5. Verify changes with relevant tests before marking roadmap tasks complete.
6. Never commit secrets, API keys, credentials, private student data or production data.

## Progress status

Use `[ ]` not started, `[~]` in progress, `[x]` completed and verified, and `[!]` blocked. A task is only `[x]` after implementation, checks and review are complete.
