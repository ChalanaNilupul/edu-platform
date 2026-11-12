# Architecture Baseline

**Project:** Education SaaS Platform (LMS + IMS)  
**Baseline:** Phase 0.5 — Architecture and Technology Decisions  
**Status:** Approved  
**Approval date:** 2026-11-11  
**Market focus:** Sri Lanka first

## 1. Purpose

This document records the approved architecture baseline for the education SaaS platform. It is the reference for detailed design and implementation. It does not mean every future capability is part of the MVP; implementation must follow the approved MVP scope and roadmap.

## 2. Product and service model

The platform supports independent teachers and educational institutes through the same core product.

Approved service models:

1. **Shared SaaS — initial delivery:** Customers register and create workspaces on the platform domain. Application infrastructure, database and storage are centrally managed. Workspace data and files are isolated.
2. **White-label SaaS — later:** The same core platform supports customer branding and custom domains on shared infrastructure.
3. **Dedicated enterprise — later:** Selected customers can receive separate application deployments, databases and storage, with customer-specific domains and support arrangements.

The initial market is Sri Lanka. Initial language support is English, Sinhala and Tamil, with LKR as the initial currency. International expansion is a future consideration.

## 3. Approved technology stack

| Layer                      | Approved choice                                                              |
| -------------------------- | ---------------------------------------------------------------------------- |
| Web frontend               | Next.js + TypeScript                                                         |
| Backend runtime            | Node.js                                                                      |
| Backend language/framework | TypeScript + NestJS                                                          |
| Application architecture   | Modular monolith                                                             |
| API                        | REST + JSON                                                                  |
| API documentation          | OpenAPI / Swagger                                                            |
| Database                   | PostgreSQL                                                                   |
| ORM                        | Prisma                                                                       |
| Styling                    | Tailwind CSS                                                                 |
| File storage               | Cloudflare R2, behind a provider-independent S3-compatible storage interface |
| Containers                 | Docker from the beginning                                                    |
| CI/CD                      | GitHub Actions                                                               |
| Future cache/queue         | Redis + BullMQ, when justified                                               |
| Future real-time           | Socket.IO, when required                                                     |

Node.js is the backend runtime; NestJS is the backend framework; TypeScript is the programming language.

## 4. Application architecture

Start with one deployable backend application organized as a modular monolith. Modules have clear responsibilities and interfaces. A module should not reach into another module's private implementation details.

Initial module boundaries:

- Authentication
- Tenants / workspaces
- Users and memberships
- Roles and permissions
- Students
- Teachers and staff
- Classes and batches
- Attendance
- Finance
- Learning
- Examinations
- Notifications
- Subscriptions and entitlements
- Storage

Each module owns its business rules and exposes explicit application interfaces. Shared infrastructure concerns (configuration, logging, database access, authorization context and error handling) should be consistent. Database migrations are centrally managed initially.

Keep boundaries clear enough that a module can be extracted into a separate service later if a demonstrated scaling or ownership need justifies it. Do not start with microservices.

## 5. Multi-tenant database strategy — approved

Use one shared PostgreSQL database initially.

- Every workspace-owned record must be associated with a `tenant_id` / workspace identifier.
- Tenant membership and access are resolved and validated on the server.
- Never trust a tenant ID supplied by the browser as proof of access.
- PostgreSQL Row-Level Security (RLS) provides an additional isolation layer.
- Application queries and database policies must enforce compatible tenant rules.
- Use transaction-scoped tenant context with pooled connections; reset context safely so one request cannot inherit another request's tenant context.
- Prisma access patterns must preserve tenant filtering and authorization requirements.

Design for a future hybrid model: a tenant registry maps a workspace to its database/infrastructure location, and the backend routes requests using authenticated tenant context. Maintain compatible schemas and migration practices, and plan tooling to move a tenant from the shared database to a dedicated database.

A dedicated database isolates database workload; it does not by itself prevent an application outage. Application scaling and recovery are separate concerns.

## 6. Identity, authentication and memberships — approved direction

Use one global user identity that can belong to multiple workspaces.

Keep users, workspaces, workspace memberships, roles, permissions and invitations as distinct concepts. Roles and permissions are scoped to a workspace.

Onboarding patterns:

- Independent teacher creates a workspace and receives workspace-owner capabilities with teaching permissions.
- Institute owner creates an organization and can establish branches.
- Authorized institute members invite teachers and staff.
- Students are created or invited by authorized staff.
- Parents are invited or linked through a verified process.

Initial authentication supports email/password, email verification, password reset and secure sessions. Google login and phone OTP may be considered later. Do not use phone number as the unique global account identifier because family members may share a phone.

The exact session mechanism (cookie session versus access/refresh token implementation) remains a detailed design decision. **Resolved during Phase 2:** database-backed opaque session tokens delivered in an HTTP-only cookie; see section 15.

## 7. Authorization and privacy — approved

Use a combination of role-based access control (RBAC), resource-level authorization and branch-level restrictions.

Predefined roles:

- Platform administrator
- Workspace owner
- Institute administrator
- Branch manager
- Teacher
- Student
- Parent / guardian

Authorized workspace administrators may create custom roles and grant or revoke individual permissions. Role definitions remain separate from permission definitions.

Enforce authorization on the backend:

- Teachers access assigned classes and permitted student information.
- Branch managers are restricted to assigned branches.
- Students access only their own permitted records.
- Parents access only explicitly linked children.
- Finance and administrative actions with sensitive impact are audited.
- Tenant isolation cannot be bypassed by a role assignment.

Platform administrator access to private customer/student records is not unrestricted. It must be temporary, explicitly approved by an authorized customer representative, purpose-limited, scoped, time-limited, automatically revoked and fully audited.

## 8. File storage — approved

Use Cloudflare R2 initially, behind a provider-independent S3-compatible storage abstraction so the provider can be changed or dedicated storage added later.

Private by default. Store file bytes in object storage and metadata in PostgreSQL.

Metadata should include, as applicable: file ID, tenant/workspace ID, filename, storage key, MIME type, size, uploader, related entity, upload date and access classification.

Access flow:

1. The client requests an upload or download.
2. The backend authenticates the user and checks workspace membership, resource permissions and quota.
3. The backend issues a short-lived signed URL or authorizes a controlled transfer.
4. Uploads are verified/finalized; downloads remain private and time-limited.

Validate file type, size and upload permissions. Plan malware scanning. Track storage use against subscription entitlements. Use logical tenant-specific prefixes. Plan for large uploads, recovery, file migration and dedicated enterprise storage.

## 9. Subscription and entitlement architecture — approved

Keep plans, subscriptions and entitlements separate.

- Support public plans, custom enterprise plans and add-ons.
- Make plans and limits configurable without code changes.
- Initial billing/activation is manual and managed by platform administrators.
- Record subscription start/end dates, billing period, payment references/history, upgrades, downgrades and cancellations.
- Enforce entitlements in the backend and track usage per workspace.
- Example entitlements: `max_students`, `max_teachers`, `max_branches`, `storage_limit_bytes`, `examinations_enabled`, `custom_branding_enabled`, `custom_domain_enabled`.
- Exceeding a limit blocks new restricted operations; it must not delete existing data.
- Grace periods are configurable. Preserve customer data after expiry or downgrade.
- Enterprise plans can have custom overrides.

SaaS subscription billing is separate from the institute's own student-fee/finance module. Automated payment gateway integration is later work.

## 10. Deployment, scaling and reliability — approved

Use managed cloud hosting initially, prioritizing low operating costs while preserving a path to scale and dedicated customer infrastructure.

Initial direction:

- Deploy the Next.js frontend and NestJS backend as separate services.
- Package backend services and future workers with Docker.
- Use managed PostgreSQL.
- Use Cloudflare R2 for object storage.
- Start in one suitable cloud region; select the actual provider and region during detailed deployment planning.
- Introduce Redis and BullMQ only when caching or background-job requirements justify them.
- Avoid premature multi-region deployment and always-on infrastructure that is not needed.

Reliability foundations:

- Separate development, staging and production environments.
- GitHub Actions for automated checks and deployment.
- Automated database backups and point-in-time recovery where supported.
- Health checks, structured logs, error tracking, monitoring and alerts.
- Stateless backend instances so they can be replicated behind a load balancer.
- Connection pooling, rate limits, request limits/timeouts and graceful shutdown.
- Document recovery procedures and test database restoration.
- Add capacity based on observed usage.

Future dedicated customer infrastructure may include separate application deployments, databases and storage. Dedicated customer infrastructure is not part of the initial MVP.

## 11. API architecture — approved

Use REST with JSON for normal frontend/backend communication.

- Version endpoints from the beginning, starting at `/api/v1`.
- Maintain OpenAPI / Swagger documentation alongside implementation.
- Validate requests on the server.
- Use consistent success and error response conventions and stable error codes.
- Standardize pagination, filtering and sorting conventions.
- Enforce authentication, workspace membership, tenant isolation and permissions on every protected operation.
- Use authorized short-lived signed upload/download flows for private files.
- Breaking API changes require a planned versioning strategy.

Future external integration support should include scoped credentials/API keys, rate limits, usage tracking and webhooks. Webhooks should use signature verification, retries and delivery records. A public developer platform is not an MVP requirement.

Use Socket.IO later if actual real-time requirements justify it; do not add it merely because it may be useful someday.

## 12. MVP boundary

The approved MVP includes the six core modules plus parent access, announcements and basic reports:

1. Student and teacher management.
2. Class and batch management.
3. Attendance and finance.
4. Learning management.
5. Examinations.
6. Student portal.
7. Basic parent portal.
8. Announcements and in-app notifications.
9. Basic reports.

The MVP is web-first and Sri Lanka-first. Live classrooms, AI features, online payment gateway, QR attendance, native mobile apps, advanced accounting/payroll, full white-label implementation, dedicated enterprise deployments and international market support are later work.

## 13. Detailed design decisions still open

The architecture baseline intentionally leaves implementation-level choices for later design:

- Exact managed cloud provider, region and service plans.
- Exact managed PostgreSQL provider and recovery objectives.
- ~~Cookie-based session implementation versus access/refresh token implementation.~~ Resolved — see section 15.
- Exact API response envelope, pagination and filtering contract.
- CI/CD release approvals and rollback strategy.
- API key lifecycle, webhook event catalogue and external integration onboarding.
- File malware scanning implementation and retention policy.
- Monitoring provider, alert thresholds and service-level objectives.

These are not blockers to the approved architecture direction. Resolve them before the corresponding implementation work.

## 15. Implemented decisions — Phase 2

These decisions refine, but do not replace, the approved baseline above.

### Sessions

- Database-backed opaque session tokens, not JWT.
- Tokens are 32 random bytes encoded as base64url and stored as SHA-256 hashes.
- The raw token lives only in the HTTP-only `edu_session` cookie (SameSite=Lax, Secure in production, seven-day expiry).
- Sessions can be revoked immediately on logout, password reset or administrative action.
- The session stores a nullable `activeWorkspaceId`; it is only used after the server re-validates that the user has an `ACTIVE` membership in that workspace.

### Tokens

- Email verification, password reset and invitation tokens follow the same pattern: random raw token, SHA-256 hash at rest, expiry, single use.
- Password reset also revokes the user's existing sessions.

### Authorization

- Workspace roles are a predefined enum on `Membership`: `OWNER`, `ADMIN`, `BRANCH_MANAGER`, `TEACHER`, `STUDENT`, `PARENT`.
- Authorization is centralized in a `WorkspaceAccessService` and a roles guard; controllers do not contain ad-hoc checks.
- `OWNER` implicitly satisfies every role requirement, but ownership cannot be transferred or removed through membership endpoints.
- An admin cannot invite or manage another admin, preventing admin-chain escalation.
- Invitation acceptance requires the signed-in user's email to match the invited email.

### CSRF and rate limiting

- Unsafe HTTP methods are validated against `Origin`/`Referer` and SameSite=Lax cookies.
- NestJS Throttler runs globally with tighter per-route limits on auth endpoints.
- A dedicated CSRF token scheme remains a later hardening step if cross-site embedding is ever introduced.

### Mail

- Mail goes through a provider-agnostic `MailService`. Development uses a console driver; production delivery is still open.

### Tenant isolation and RLS

- Application-layer isolation: workspace-scoped queries, active-membership enforcement, server-side role checks and cross-tenant rejection, tested with unit, mocked HTTP and real-database tests.
- PostgreSQL RLS is enabled and forced on `memberships` and `workspace_invitations`. Policies allow rows when `app.bypass_rls = 'on'`, when `workspace_id` matches `app.workspace_id`, or (memberships only) when `user_id` matches `app.user_id`.
- `TenantContextService` opens a transaction and sets the context with `set_config(..., true)` (transaction-local), so pooled connections cannot inherit another request's tenant. Every workspace service runs through `runAsTenant` or `runAsUser`; only the token-authenticated invitation lookup uses `runAsSystem`.
- Verified by `apps/api/test/integration/rls.integration-spec.ts`, which runs the policies as a restricted non-superuser role. PostgreSQL bypasses RLS for superusers and `BYPASSRLS` roles, so production must connect as a dedicated non-superuser application role.

## 14. Architecture principles

1. Secure tenant isolation by default.
2. Backend is the authority for identity, permissions and entitlements.
3. Private student and institute data is not accessible to platform staff by default.
4. Prefer managed services and low initial operating cost.
5. Keep the initial system simple; add infrastructure when evidence justifies it.
6. Preserve modular boundaries and portability for future scaling.
7. Never silently delete customer data due to plan changes or service expiry.
8. Document and audit sensitive access and administrative actions.
