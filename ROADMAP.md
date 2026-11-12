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

- [~] Desk research into Sri Lankan education workflows and competing products — **deferred; not a development blocker**.
- [ ] Summarize findings, assumptions, opportunities and risks.
- [ ] Review research findings and record implications for MVP.
- **Reason for deferral:** Development can begin using the approved requirements, architecture and realistic user scenarios. Teacher interviews are not feasible at this stage and are not a prerequisite. Public research, competitor analysis and prototype-based validation can be revisited after an initial working prototype.
- **Acceptance criteria when resumed:** A reviewed desk-research summary with sources, competitor comparison, common workflows, assumptions and product implications. Do not mark complete until reviewed.

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
- [x] Prepare and review `ARCHITECTURE.md`.
- **Acceptance criteria:** Eight decisions and their safeguards are documented; cross-decision review is approved; open detailed-design questions are recorded.

### 0.6 Implementation readiness and planning close-out

- [x] Review approved requirements and architecture as the baseline for implementation.
- [x] Agree to begin development without waiting for teacher interviews or completion of desk research.
- [x] Agree an incremental implementation sequence, starting with repository and development foundations.
- [x] Record research as deferred and identify when it will be revisited.
- **Acceptance criteria:** Approved product and architecture baselines exist; deferred research is transparent; the first implementation phase and its initial tasks are defined. Detailed technical choices remain open until the task that needs them.

## Phase 1 — Repository and development foundation

**Status:** Completed  
**Goal:** Establish a reproducible local development environment and a maintainable foundation for the approved Next.js + NestJS modular-monolith product.

### 1.1 Repository tooling and workspace conventions

- [x] Confirm supported Node.js LTS version and record it in the repository.
- [x] Select the package manager and commit its lockfile.
- [x] Establish the initial workspace layout for `apps/web`, `apps/api` and shared packages.
- [x] Configure root scripts and consistent TypeScript conventions.
- [x] Configure formatting and linting for the repository.
- [x] Update `PROJECT_STRUCTURE.md` to match the actual structure.
- **Acceptance criteria:** A clean clone can install dependencies using the documented command; workspace scripts run; tooling and conventions are documented; no secrets are committed.

### 1.2 Frontend foundation

- [x] Create the Next.js + TypeScript application in `apps/web`.
- [x] Configure Tailwind CSS.
- [x] Add a minimal accessible application shell and initial placeholder page.
- [x] Add frontend development, build, lint and type-check scripts.
- **Acceptance criteria:** The frontend starts locally and produces a successful production build; lint and type checks pass.

### 1.3 Backend foundation

- [x] Create the NestJS + TypeScript application in `apps/api`.
- [x] Establish modular folder conventions and configuration validation.
- [x] Add a basic health endpoint.
- [x] Set the API global prefix to `/api/v1`.
- [x] Add initial OpenAPI/Swagger setup.
- [x] Add backend development, build, lint, type-check and test scripts.
- **Acceptance criteria:** The API starts locally; the health endpoint responds; Swagger is available in development; checks pass.

### 1.4 Local database and Prisma foundation

- [x] Add Docker Compose configuration for local PostgreSQL.
- [x] Configure environment-variable examples without real credentials.
- [x] Add Prisma and connect it to local PostgreSQL.
- [x] Create and verify the initial database migration.
- [x] Document database start, migration and reset workflows.
- **Acceptance criteria:** A developer can start the local database, apply migrations and connect the API using documented commands; secrets remain outside version control.

### 1.5 Continuous integration and developer documentation

- [x] Add GitHub Actions checks for install, formatting/lint, type checks, tests and builds as applicable.
- [x] Document local setup, required tools, environment configuration and common commands.
- [x] Verify the workflow on the Phase 1 branch and review its results.
- **Acceptance criteria:** CI runs successfully for a pull request; a fresh local setup can follow the documentation without undocumented steps.

### Phase 1 exit criteria

- Frontend and backend applications build and run locally.
- Local PostgreSQL and Prisma migrations work reproducibly.
- Repository quality checks and CI pass.
- Actual repository structure and setup instructions are documented.
- Production cloud deployment, real customer data, Redis/BullMQ and Socket.IO are not required for this phase.

## Phase 2 — Identity, workspaces and tenant security

**Status:** In progress

**Goal:** Implement secure user authentication, workspace management, memberships, invitations, and tenant isolation.

### 2.1 Identity database foundation

- [x] Create User, Workspace and Membership Prisma models.
- [x] Create Session model for database-backed authentication.
- [x] Create and apply database migrations.
- [x] Generate Prisma Client and verify TypeScript checks.

### 2.2 Authentication implementation

- [x] Implement user registration with password hashing.
- [x] Implement login with email and password.
- [x] Implement secure random session tokens.
- [x] Store hashed session tokens in PostgreSQL.
- [x] Configure HTTP-only session cookies.
- [x] Implement `/auth/me` for session verification.
- [x] Implement logout and session invalidation.
- [x] Add DTO validation and cookie parsing.
- [x] Add initial login rate limiting and Origin checking.
- [x] Verify lint, typecheck, build and GitHub Actions.
- [x] Build frontend registration and login pages and connect them to the API.
- [x] Protect the dashboard with server-side session verification.
- [x] Display authenticated user details in the dashboard.
- [x] Implement frontend logout with a confirmation dialog.
- [x] Manually verify registration, login, session persistence, logout and protected-route redirection in the browser.

### 2.3 Authentication security and remaining features

- [x] Add AuthService unit tests covering registration, login, logout and session validation (11 tests).
- [x] Add authentication controller HTTP tests covering registration, login, current-user retrieval and logout (7 tests).
- [ ] Complete runtime testing of rate limiting and Origin checking.
- [ ] Implement and verify stronger CSRF protection.
- [ ] Implement email verification.
- [ ] Implement password reset.
- [ ] Complete authentication security review.

### 2.4 Workspace management

- [ ] Implement teacher workspace creation.
- [ ] Implement institute workspace creation.
- [ ] Implement workspace memberships.
- [ ] Implement workspace listing and switching.

### 2.5 Invitations and tenant isolation

- [ ] Implement workspace invitations.
- [ ] Implement tenant context resolution.
- [ ] Enforce tenant-scoped database access.
- [ ] Test cross-workspace access restrictions.

### Phase 2 exit criteria

- [ ] Authentication and security tests pass.
- [ ] Workspace and membership functionality is verified.
- [ ] Tenant isolation is implemented and tested.
- [ ] Phase 2 is reviewed and ready to merge into main.

## Later implementation phases

Detailed task breakdowns and acceptance criteria will be refined when the foundation is ready.

2. **Phase 3 — Authorization and organization structure:** roles, permissions, branches and resource-level access controls.
3. **Phase 4 — Core academic management:** students, teachers, subjects, classes, batches and enrollment.
4. **Phase 5 — Attendance and finance:** attendance, fee structures, payment records, receipts and balances.
5. **Phase 6 — Learning management:** lessons, resources, assignments, submissions and feedback.
6. **Phase 7 — Examinations and results:** question bank, exams, marking and results.
7. **Phase 8 — Student and parent portals:** secure role-specific experiences and linked-child access.
8. **Phase 9 — Announcements, notifications and reports:** audience targeting, in-app notifications and MVP reports.
9. **Phase 10 — Subscription administration and production readiness:** plans, entitlements, monitoring, backup/restore verification and deployment readiness.

## Deferred capabilities

Live video classrooms, AI features, online payment gateway, QR attendance, native mobile applications, advanced accounting/payroll, full white-label implementation, dedicated enterprise deployments, international market/payment/compliance support, Redis/BullMQ and Socket.IO are intentionally outside the initial foundation work or deferred until justified.
