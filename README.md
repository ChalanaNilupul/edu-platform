# EduPlatform

**A unified Learning Management System (LMS) and Institute Management System (IMS).**

EduPlatform is a modular, multi-tenant SaaS platform designed for independent tuition teachers and educational institutes.

The initial focus is the Sri Lankan education market, with support for multiple workspaces, institute management, student administration, teaching workflows and educational operations.

## Project Status

**Current Development Phase: Phase 2 — Identity and Workspace Foundation**

EduPlatform is under active development. The technical foundation, authentication flows, workspace management, membership roles, invitations and password recovery are implemented. Tenant authorization is enforced in the application layer; PostgreSQL Row-Level Security is the remaining Phase 2 security task.

The full LMS and IMS business modules are planned for subsequent development phases.

## Implemented Features

### Technical Foundation

- Monorepo architecture using pnpm.
- Next.js frontend.
- NestJS backend.
- TypeScript.
- PostgreSQL database.
- Prisma ORM.
- Docker development environment.
- REST API with `/api/v1` prefix.
- Swagger/OpenAPI foundation.
- GitHub Actions CI workflow.
- ESLint and Prettier.
- Automated testing infrastructure.

### Authentication

- User registration.
- User login.
- Argon2id password hashing.
- Database-backed sessions.
- SHA-256 hashed session tokens.
- HTTP-only authentication cookies.
- Current-user endpoint.
- Logout and session invalidation.
- Protected dashboard.
- Email verification with hashed single-use tokens.
- Password reset with session revocation.
- Origin/Referer CSRF enforcement and security headers.
- Global and per-route rate limiting.
- Provider-agnostic mail service (console driver in development).

### Workspace Management

Backend functionality:

- Teacher workspace creation.
- Institute workspace creation.
- Initial workspace membership creation as owner.
- Workspace listing.
- Active workspace switching.
- Session-based active workspace storage.
- Membership verification during workspace switching.
- Predefined workspace roles (owner, admin, branch manager, teacher, student, parent).
- Workspace invitations with hashed tokens, expiry and revocation.
- Membership listing, role changes and member removal with role-aware rules.
- PostgreSQL Row-Level Security on tenant tables with transaction-scoped tenant context.
- Real-database integration tests (auth, workspace, invitation and RLS coverage) and a CI PostgreSQL job.

Frontend functionality:

- Login, registration, email verification, forgot-password and reset-password pages.
- Dashboard interface.
- Workspace manager component.
- Dedicated workspaces page.
- Workspace creation modal.
- Workspace switching interface.
- Workspace member management page.
- Invitation acceptance page.

## Partially Implemented

- Production RLS enforcement (policies are verified, but the local/CI database role is a superuser, so a non-superuser production role is still required).
- Manual browser verification of the new flows.
- Runtime verification of rate limiting and Origin checking.
- Member suspension (removal is implemented).
- Workspace overview and settings.

## Planned Features

### Student Management

- Student profiles.
- Parent and guardian records.
- Student enrollment.
- Student directory.
- CSV import.

### Teacher Management

- Teacher profiles.
- Teacher assignments.
- Teacher availability.
- Teacher membership management.

### Classes and Batches

- Class management.
- Subject management.
- Teacher assignments.
- Student enrollment.
- Timetables.

### Attendance

- Manual attendance.
- Attendance history.
- Attendance summaries.
- Attendance reports.

### Finance

- Fee structures.
- Monthly fee records.
- Cash and bank payments.
- Outstanding balances.
- Receipts.
- Finance reports.

### Learning Management

- Lessons.
- PDF and video resources.
- Assignments.
- Student submissions.
- Teacher feedback.

### Examinations

- Question bank.
- MCQ and true/false questions.
- Timed examinations.
- Automatic marking.
- Results and rankings.

### Portals and Communication

- Student portal.
- Parent/guardian portal.
- Announcements.
- In-app notifications.
- Basic reports.

## Product Direction

EduPlatform is designed to support three service models.

### 1. Shared Multi-Tenant SaaS

- Multiple independent teachers and institutes.
- Shared application infrastructure.
- Centralized infrastructure and storage.
- Strict workspace data isolation.
- Self-service workspace creation.

### 2. White-Label SaaS

- Same core platform.
- Custom branding.
- Custom domains.
- Shared infrastructure.

### 3. Dedicated Enterprise Deployment

- Separate application deployment.
- Dedicated database and storage.
- Custom branding and domain.
- Enterprise support.

The initial implementation prioritizes shared multi-tenant SaaS.

## Technology Stack

| Layer                   | Technology              |
| ----------------------- | ----------------------- |
| Frontend                | Next.js                 |
| UI                      | React and Tailwind CSS  |
| Language                | TypeScript              |
| Backend                 | Node.js and NestJS      |
| Database                | PostgreSQL              |
| ORM                     | Prisma                  |
| API                     | REST JSON               |
| Package Manager         | pnpm                    |
| Development Environment | Docker                  |
| File Storage            | Cloudflare R2 (planned) |

## Repository Structure

```text
edu-platform/
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # Next.js frontend
├── packages/         # Shared packages
├── infra/
│   └── docker/       # Docker infrastructure
├── docs/             # Project documentation
├── scripts/          # Repo tooling scripts
├── .github/
│   └── workflows/    # GitHub Actions
├── ROADMAP.md
├── ARCHITECTURE.md
├── PROJECT_STRUCTURE.md
├── REQUIREMENTS.md
├── README.md
├── AI_HANDOFF.md
└── package.json
```

## Development Setup

### Requirements

- Node.js
- pnpm
- Docker Desktop
- Git

### Install Dependencies

```powershell
pnpm install
```

### Configure Environment

Create the required environment files using the project's existing environment configuration and examples.

Do not commit secrets or production credentials.

### Start Development Database

Use the Docker Compose configuration under:

```text
infra/docker/
```

Start the configured services using the appropriate Docker Compose command for that directory.

### Run Development Servers

API:

```powershell
pnpm --filter @edu-platform/api dev
```

Frontend:

```powershell
pnpm --filter @edu-platform/web dev
```

Check the package scripts in the relevant `package.json` files for the exact available commands.

## Quality Checks

From the repository root:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @edu-platform/api test:e2e
pnpm --filter @edu-platform/api test:integration
pnpm build
pnpm format:check
```

These commands serve different purposes:

- Lint: coding rules and potential issues.
- Typecheck: TypeScript validation.
- Test: unit test execution.
- E2E: mocked HTTP flow tests.
- Integration: real PostgreSQL tests (creates and migrates a dedicated `edu_platform_test` database; requires a running database).
- Build: production compilation.
- Format check: Prettier formatting validation.

A passing automated check does not automatically mean a feature has been manually verified in the browser or secured for production.

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for the complete development plan and implementation status.

## Current Development Priorities

1. Manually verify the new flows in a browser.
2. Verify rate limiting and Origin checking at runtime.
3. Decide on and provision a non-superuser production database role so RLS is enforced.
4. Complete the Phase 2 security review.
5. Build Student Management.
6. Continue with the remaining LMS and IMS modules.

## Security Principles

- Every workspace-owned record must be tenant-scoped.
- Backend authorization is mandatory.
- Workspace membership determines access.
- PostgreSQL Row-Level Security provides an additional isolation layer on tenant tables; the application-facing database role must not be a superuser.
- Private files must be accessed through backend-authorized short-lived signed URLs.
- Platform administrator access to private tenant records must be explicitly approved, purpose-limited, time-limited and audited.

## License

License and distribution terms are to be defined.
