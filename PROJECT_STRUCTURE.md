# Proposed Project Structure

This is a proposed monorepo layout for the platform. It is intentionally a scaffold, not a claim that the technology stack has been finalized. Keep only directories that the team actually uses as implementation begins.

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
