# Education SaaS Platform (LMS + IMS)

A Sri Lanka-first, multi-tenant education SaaS platform for independent teachers and educational institutes.

## Project status

- **Current phase:** Phase 0 — Product discovery and planning
- **Current task:** Phase 0.6 — Architecture documentation review and planning close-out / next planning decisions
- **Completed:** MVP scope and requirements approved (Phase 0.4); architecture baseline approved (Phase 0.5, decisions 0.5.1–0.5.8).
- **Still in progress:** Phase 0.2 customer/competitor desk research.
- **Implementation:** Not started unless separately recorded in the roadmap.

## Product direction

One modular LMS + IMS platform serving independent teachers and institutes, with shared SaaS first, white-label SaaS and dedicated enterprise infrastructure planned for later.

## Documentation

- `REQUIREMENTS.md` — approved product requirements and MVP scope.
- `ARCHITECTURE.md` — approved Phase 0.5 architecture baseline.
- `ROADMAP.md` — phases, tasks and acceptance criteria.
- `AI_HANDOFF.md` — context and collaboration instructions for future work.
- `PROJECT_STRUCTURE.md` — proposed repository structure (preserve the existing project file; this documentation update does not replace it).

## Current architecture baseline

Next.js + TypeScript frontend; Node.js + NestJS + TypeScript modular-monolith backend; REST/JSON API; PostgreSQL + Prisma; Cloudflare R2; Docker; managed cloud hosting; GitHub Actions. Redis/BullMQ and Socket.IO are deferred until justified.

## Working agreement

1. Before working on a computer, run `git pull`.
2. Work on one computer at a time.
3. Use task branches where practical.
4. Run relevant checks and review changes before merging.
5. Update documentation when decisions or implementation status changes.
6. Never commit secrets, credentials, student personal data or production exports.
7. Mark planning tasks complete only after their documented acceptance criteria are reviewed. Mark implementation tasks complete only after implementation, checks and review.
8. Do not claim a change is pushed or merged unless Git confirms it.

## Next step

Review the Phase 0.5 architecture baseline and updated documentation in the repository, then continue remaining Phase 0 planning tasks. Do not begin implementation merely because the architecture is approved.
