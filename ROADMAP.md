# Roadmap

Status notation:
- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed and verified/reviewed

A planning task is complete only after its acceptance criteria are met and reviewed. An implementation task is complete only after implementation, checks and review.

## Phase 0 — Product discovery and planning

### 0.1 Product vision and direction
- [x] Define LMS + IMS product direction.
- [x] Define Sri Lanka-first launch focus.
- [x] Define independent teacher and institute customer types.
- [x] Agree shared SaaS first, white-label later and dedicated enterprise later.

### 0.2 Customer and competitor desk research
- [~] Desk research into Sri Lankan education workflows and competing products.
- [ ] Summarize findings, assumptions, opportunities and risks.
- [ ] Review research findings and record implications for MVP.
- **Acceptance criteria:** A documented desk-research summary with sources, competitor comparison, common workflows, assumptions and product implications. Do not mark complete until reviewed.

### 0.3 MVP definition
- [x] Agree the full six-module MVP.
- [x] Include basic parent portal, announcements and basic reports.
- [x] Record explicit exclusions and later-phase capabilities.
- **Acceptance criteria:** MVP scope and exclusions documented and approved.

### 0.4 Requirements and user journeys
- [x] Define roles and key user journeys.
- [x] Define tenant, parent, student, teacher and branch access rules.
- [x] Define platform administrator temporary support-access policy.
- [x] Approve and document `REQUIREMENTS.md` (approved 2026-11-11).
- **Acceptance criteria:** Requirements and user journeys reviewed and approved.

### 0.5 Architecture and technology decisions
- [x] 0.5.1 Multi-tenant database strategy — shared PostgreSQL initially; future dedicated database option.
- [x] 0.5.2 Authentication and membership architecture — global identity, workspace-scoped memberships.
- [x] 0.5.3 Authorization — configurable permissions, predefined roles, resource and branch restrictions.
- [x] 0.5.4 File storage — Cloudflare R2 initially, private signed access.
- [x] 0.5.5 Subscription and entitlement architecture — configurable plans, manual initial billing.
- [x] 0.5.6 Application architecture and technology stack — gradual infrastructure, modular monolith, Next.js/NestJS/TypeScript, PostgreSQL/Prisma, Docker.
- [x] 0.5.7 Deployment, scaling and reliability — managed cloud hosting, low initial cost, future scaling and dedicated customer infrastructure.
- [x] 0.5.8 API design — REST/JSON, versioned endpoints, OpenAPI, consistent responses/errors and future integration support.
- [x] Consolidated architecture baseline approved (2026-11-11).
- [x] Prepare `ARCHITECTURE.md` and update project tracking documentation.
- **Acceptance criteria:** Eight decisions and their safeguards are documented; cross-decision review is approved; open detailed-design questions are recorded. Architecture approval does not imply implementation completion.

### 0.6 Remaining planning and implementation readiness
- [ ] Review Phase 0 planning deliverables and confirm any remaining product, research, UX and operational decisions.
- [ ] Resolve detailed design decisions before the relevant implementation tasks (hosting provider/region, session mechanism, API conventions, recovery objectives, CI/CD release strategy).
- [ ] Prepare an implementation plan with milestones, dependencies and test strategy.
- **Acceptance criteria:** Planning gaps and assumptions are recorded; implementation sequence and acceptance criteria are reviewed; no unresolved blocker is hidden.

## Later phases — implementation

Detailed implementation phases and task breakdowns should be created after Phase 0 planning close-out. Build the approved MVP incrementally, preserving the approved architecture and security requirements.

Potential implementation order:
1. Repository foundation, environments, Docker and CI checks.
2. Database schema, tenant context and identity/membership foundations.
3. Authorization and workspace/branch controls.
4. Core student, teacher, class and batch workflows.
5. Attendance and finance.
6. Learning resources and assignments.
7. Examinations and results.
8. Student and parent portals.
9. Announcements, notifications and reports.
10. Subscription administration, monitoring, backup/restore verification and production readiness.

Do not treat this indicative sequence as an approved detailed sprint plan until task dependencies and acceptance criteria are reviewed.
