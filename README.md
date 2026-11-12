# EduPlatform

**A unified Learning Management System (LMS) and Institute Management System (IMS).**

EduPlatform is a modular, multi-tenant SaaS platform designed for independent tuition teachers and educational institutes.

The initial focus is the Sri Lankan education market, with support for multiple workspaces, institute management, student administration, teaching workflows and educational operations.

## Project Status

**Current Development Phase: Phase 2 — Identity and Workspace Foundation**

EduPlatform is under active development. The technical foundation and core authentication functionality have been implemented. Workspace management is currently being developed.

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

### Workspace Management

Backend functionality:

- Teacher workspace creation.
- Institute workspace creation.
- Initial workspace membership creation.
- Workspace listing.
- Active workspace switching.
- Session-based active workspace storage.
- Membership verification during workspace switching.

Frontend functionality:

- Login and registration pages.
- Dashboard interface.
- Workspace manager component.
- Workspace listing.
- Workspace creation modal.
- Workspace switching interface.

## Partially Implemented

- Dedicated workspace management page.
- Active workspace restoration in the frontend.
- Complete workspace navigation.
- Authentication security hardening.
- Workspace invitations.
- Tenant isolation.

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
├── infra/
│   └── docker/       # Docker infrastructure
├── .github/
│   └── workflows/    # GitHub Actions
├── ROADMAP.md
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
pnpm build
pnpm format:check
```

These commands serve different purposes:

- Lint: coding rules and potential issues.
- Typecheck: TypeScript validation.
- Test: automated test execution.
- Build: production compilation.
- Format check: Prettier formatting validation.

A passing automated check does not automatically mean a feature has been manually verified in the browser or secured for production.

## Development Roadmap

See [ROADMAP.md](./ROADMAP.md) for the complete development plan and implementation status.

## Current Development Priorities

1. Finish workspace management.
2. Complete authentication security.
3. Implement invitations and membership management.
4. Implement tenant authorization and isolation.
5. Build Student Management.
6. Continue with the remaining LMS and IMS modules.

## Security Principles

- Every workspace-owned record must be tenant-scoped.
- Backend authorization is mandatory.
- Workspace membership determines access.
- PostgreSQL Row-Level Security will provide an additional isolation layer.
- Private files must be accessed through backend-authorized short-lived signed URLs.
- Platform administrator access to private tenant records must be explicitly approved, purpose-limited, time-limited and audited.

## License

License and distribution terms are to be defined.
