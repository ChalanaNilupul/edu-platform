# AI Handoff — Edu Platform

Read this file, `README.md` and `ROADMAP.md` before making project changes. Treat the repository as the source of truth; do not assume that a feature is complete because it was discussed.

## Product context

Edu Platform is planned as a multi-tenant SaaS LMS + IMS for independent tuition teachers and larger educational institutes. Initial market focus is Sri Lanka. Sinhala, Tamil and English are planned.

- LMS: courses, lessons, resources, assignments, exams, marking and progress.
- IMS: students, teachers, staff, classes, batches, attendance, fees and administration.
- Additional planned areas: live learning, communication, parent portal, AI assistance and SaaS subscriptions.

## Current state

- Current phase: **Phase 0 — Product discovery and planning**
- Current task: **0.1 — Define product vision and target customers**
- Repository state: starter documentation and proposed structure only.
- No application implementation should be assumed to exist.
- Technology choices are proposals, not finalized decisions.

## Proposed stack — confirm before implementation

Potential direction:
- Next.js + TypeScript + Tailwind for web
- NestJS + TypeScript for API
- PostgreSQL + Prisma for persistence
- Socket.IO for realtime features
- Redis for caching and background jobs
- S3-compatible object storage
- Flutter mobile applications in a later phase
- Docker for local development and deployment

Do not scaffold all of this until the user confirms the stack and Phase 0 decisions.

## Working rules

1. Work in small, verifiable tasks. State the current phase, task ID and next action when guiding the user.
2. Before changing code, inspect the existing repository and its conventions.
3. Do not overwrite existing work without checking it first.
4. Keep tenant identity explicit in authorization and data access. Never trust a tenant ID supplied by a client without validating membership and permissions.
5. Design authorization tests that attempt cross-tenant access.
6. Validate inputs at API boundaries and avoid exposing private student information in logs.
7. Never commit `.env` files, credentials, API keys, real student data or production exports.
8. Update `ROADMAP.md`, `README.md` and this file when project status materially changes.
9. Mark a task `[x]` only after implementation, relevant checks and review are complete.
10. Give Windows PowerShell-friendly commands when providing local setup instructions.

## Git workflow

- Before starting on a computer: `git pull`
- Work on one computer at a time; avoid simultaneous edits from office and personal computers.
- Use a task branch, for example `task/0.1-product-vision`.
- Run relevant checks, update progress documents, commit and push.
- Merge the completed task branch before switching computers.
- Never claim a push, commit or deployment succeeded unless the command/tool confirms it.

## Next task

Complete Phase 0.1 by reviewing the product vision and target customer groups with the user. Then proceed to 0.2 customer and competitor research. Do not begin feature implementation until the MVP and architecture decisions are sufficiently clear.
