# Education SaaS Platform (LMS + IMS)

A Sri Lanka-first, multi-tenant education SaaS platform for independent teachers and educational institutes.

## Project status

- **Current phase:** Phase 1 — Repository and development foundation
- **Current task:** Phase 1.1 — Establish repository tooling and workspace conventions.
- **Completed:** MVP scope and requirements (Phase 0.4), architecture baseline (Phase 0.5, decisions 0.5.1–0.5.8), and implementation readiness (Phase 0.6).
- **Deferred:** Phase 0.2 customer/competitor desk research. Teacher interviews are not a prerequisite for development. Desk research and prototype-based validation will be revisited after an initial working prototype.
- **Implementation:** Foundation work is beginning on `feat/phase-1-foundation`; it is not yet complete.

## Product direction

One modular LMS + IMS platform serving independent teachers and institutes, with shared SaaS first, white-label SaaS and dedicated enterprise infrastructure planned for later. The initial market is Sri Lanka, with English, Sinhala and Tamil language support planned and LKR as the initial currency.

## Approved architecture baseline

- Frontend: Next.js + TypeScript.
- Backend: Node.js + NestJS + TypeScript modular monolith.
- API: versioned REST/JSON under `/api/v1`, documented with OpenAPI.
- Database: PostgreSQL with Prisma.
- File storage: Cloudflare R2 behind a provider-independent storage interface.
- Containers: Docker from the beginning.
- Hosting: managed services initially, keeping costs low and allowing future scaling and dedicated customer infrastructure.
- Deferred infrastructure: Redis/BullMQ and Socket.IO until justified by a concrete requirement.

See `ARCHITECTURE.md` for the approved decisions, safeguards and detailed-design questions.

## Documentation

- `REQUIREMENTS.md` — approved product requirements and MVP scope.
- `ARCHITECTURE.md` — approved Phase 0.5 architecture baseline.
- `ROADMAP.md` — phases, tasks, status and acceptance criteria.
- `AI_HANDOFF.md` — project context and collaboration instructions.
- `PROJECT_STRUCTURE.md` — repository structure reference; preserve it and update it when the actual implementation structure is established.

## Working agreement

1. Before working on a computer, run `git pull`.
2. Work on one computer at a time.
3. Use task branches; do not develop directly on `main`.
4. Keep changes focused and review the diff before committing.
5. Run relevant formatting, linting, type checks and tests before merging.
6. Update documentation when decisions or verified implementation status changes.
7. Mark planning tasks complete only after their acceptance criteria are reviewed. Mark implementation tasks complete only after implementation, checks and review.
8. Never commit secrets, credentials, student personal data or production exports.
9. Do not claim a change is pushed or merged unless Git confirms it.

## Current development sequence

1. Repository tooling and workspace conventions.
2. Next.js frontend foundation.
3. NestJS backend foundation.
4. Docker-based local PostgreSQL and Prisma setup.
5. Initial API health check, validation and OpenAPI setup.
6. GitHub Actions checks and documented local development workflow.

## Next step

Complete Phase 1.1: agree and document the Node.js version, package manager, workspace layout and shared TypeScript conventions before generating application projects.
