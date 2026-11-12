# Project Structure

This is the monorepo layout for the platform. The stack is confirmed (Next.js, NestJS, PostgreSQL, Prisma, Tailwind, pnpm) and the directories below marked as current exist in the repository. Directories such as `apps/mobile` remain planned.

## Current implementation

Backend modules under `apps/api/src`:

- `auth/` — registration, login, sessions, email verification, password reset, guards.
- `workspaces/` — workspaces, memberships, roles, invitations, access checks.
- `mail/` — provider-agnostic mail service with a console driver.
- `common/` — shared middleware, filters and cross-cutting concerns.
- `health/` — health endpoints.
- `prisma/` — Prisma service and adapter setup.
- `generated/` — generated Prisma client (gitignored).

Frontend under `apps/web/src`:

- `app/` — routes and server components.
- `components/` — feature components (forms, managers, cards).
- `lib/` — API client and shared helpers.

The layout below is the intended overall scaffold.

```text
edu-platform/
├── apps/
│   ├── web/                 # Next.js web application (when stack is confirmed)
│   ├── api/                 # NestJS API (when stack is confirmed)
│   └── mobile/              # Flutter app(s), later phase
├── packages/
│   ├── shared/              # Shared types, schemas and utilities
│   ├── config/              # Shared lint/format/TypeScript configuration
│   └── design-system/       # Reusable web UI components
├── docs/
│   ├── architecture/        # Architecture diagrams and decision records
│   ├── product/             # PRD, personas, user journeys and MVP scope
│   ├── security/            # Threat model and security notes
│   └── operations/          # Deployment and runbooks
├── infra/
│   ├── docker/              # Local development containers
│   └── deployment/          # Deployment configuration (later)
├── scripts/                 # Repository maintenance and development scripts
├── .github/
│   └── workflows/           # CI workflows (add when CI is configured)
├── .gitignore
├── README.md
├── ROADMAP.md
├── AI_HANDOFF.md
└── PROJECT_STRUCTURE.md
```

## Application boundaries

### `apps/web`

Role-based browser experience for platform administrators, institute owners, teachers, students and parents. Organize features by domain rather than putting the entire app into one large components folder.

### `apps/api`

Backend modules should follow business domains, for example:

- identity and access
- tenants and memberships
- people and guardians
- courses, classes and enrollments
- learning content
- assessments and results
- attendance
- finance
- notifications
- subscriptions and platform administration

### `packages/shared`

Only put genuinely shared, platform-independent types or validation schemas here. Avoid coupling the web app directly to database models.

### `apps/mobile`

Add when the mobile phase begins. Prefer separate role experiences only if product requirements justify separate apps; decide this during mobile planning.

## Important architecture rule

Tenant isolation is a foundational security requirement. Every tenant-owned record and every tenant-scoped operation must be protected by server-side authorization and tested against cross-tenant access. The folder structure alone does not provide tenant isolation.
