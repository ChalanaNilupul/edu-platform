# Edu Platform — Product Requirements

**Status:** Approved product requirements baseline  
**Approval:** User approved the requirements on 2026-11-11  
**Initial market:** Sri Lanka  
**Product:** Multi-tenant Education SaaS (LMS + IMS)

## 1. Product vision

Build one comprehensive education management platform for independent tuition teachers and educational institutions. The product combines a Learning Management System (LMS) and an Institute Management System (IMS).

The platform will be one modular product with multiple customer workspaces, configurable subscription plans, future white-label capabilities and a path to dedicated enterprise deployments.

## 2. Business and service models

### 2.1 Shared SaaS — first delivery model

- Anyone can register and create a workspace, subject to platform policies.
- Customers use the centrally managed application.
- The platform operator manages application infrastructure, database operations and object storage.
- Tenant-owned records and files are isolated by workspace.
- Plans control feature entitlements and usage limits.
- Standard workspaces use a platform-provided domain.

### 2.2 White-label SaaS — architecture planned; full feature set later

- A customer can have their own logo, product name, colors and branded login experience.
- A customer can connect a custom domain, for example `portal.school.lk`.
- White-label customers use the same core application and shared infrastructure unless a separate deployment is contracted.
- Branding, domain mapping, feature access and usage limits are configured per workspace.
- Custom domains require ownership verification, secure routing and HTTPS.
- Full white-label tooling is not part of the initial MVP implementation.

### 2.3 Dedicated enterprise deployment — future

- Separate application deployment.
- Dedicated database and storage.
- Custom domain and branding.
- Custom infrastructure, availability, backup and support arrangements.
- Commercial terms agreed individually.
- This is a later service model, not an initial MVP requirement.

**Product principle:** A custom domain or brand does not automatically require a separate application or database. White-label SaaS should normally remain a tenant configuration of the shared platform.

## 3. Target customers and onboarding

Target customers:
1. Independent tuition teachers.
2. Small educational institutes.
3. Medium and large educational institutes.
4. Multi-branch educational organizations.

Two onboarding paths use the same underlying platform:

- **Independent teacher:** register → create workspace → configure profile → create classes → add students.
- **Institute:** register → create organization → configure branches → invite staff → create classes → enroll students.

An independent teacher must not be forced to create an institute.

## 4. Initial market configuration

- Initial country: Sri Lanka.
- Initial currency: LKR.
- Initial languages: English, Sinhala and Tamil.
- Architecture should avoid assumptions that prevent future currencies, locales, time zones and country-specific integrations.
- International market launch, foreign payment providers and country-specific compliance are deferred.

## 5. Approved MVP functional requirements

### Module 1 — Student and teacher management

- Create and manage student profiles.
- Store parent/guardian details and student-to-guardian relationships.
- Create and manage teacher and staff profiles.
- Manage student enrollment.
- Import relevant records using validated CSV files.
- Search, filter and view records according to role permissions.

### Module 2 — Classes and batches

- Create subjects, classes and batches.
- Assign teachers.
- Manage schedules and timetables.
- Enroll students into classes and batches.
- Support branches for institutes.

### Module 3 — Attendance and finance

- Record attendance manually and maintain attendance history.
- Configure monthly fee structures.
- Record cash and bank payments.
- Track outstanding balances and payment history.
- Generate receipts or downloadable payment records.

### Module 4 — Learning management

- Create courses/class sections and lessons.
- Provide PDF and video learning resources. Video upload versus external links is a technical design decision.
- Create assignments and accept student submissions.
- Provide teacher feedback and marking.

### Module 5 — Examinations

- Manage question banks and categories.
- Support MCQ and true/false questions.
- Create timed examinations and basic attempt rules.
- Automatically mark supported objective question types.
- Publish results and class/batch rankings.

### Module 6 — Student portal

Students can securely:
- View enrolled classes and schedules.
- Access permitted learning resources.
- View and submit assignments.
- Participate in examinations.
- View attendance, results and relevant progress.

### Additional MVP capability — Parent portal

- Parent login and secure child linking.
- View linked children's classes and announcements.
- View attendance, examination results and fee status.
- A parent can only access children explicitly linked and authorized to that parent account.

### Additional MVP capability — Announcements and notifications

- Create and publish announcements.
- Target an organization, branch, class, batch or permitted user audience.
- Provide relevant in-app notifications.

### Additional MVP capability — Basic reports

- Student and enrollment summaries.
- Attendance summaries.
- Examination and performance summaries.
- Fee collection and outstanding-balance summaries.
- Reports must respect tenant and role permissions.

## 6. Roles and permission requirements

Permissions must be enforced by the backend. The matrix below defines the baseline; individual permissions may be further configured by the organization owner where appropriate.

| Capability | Platform admin | Institute owner | Branch manager | Teacher | Independent teacher | Student | Parent |
|---|---|---|---|---|---|---|---|
| Manage SaaS tenants and platform plans | Yes | No | No | No | No | No | No |
| Manage organization settings | Support access only when authorized | Yes | Limited to assigned branch | No | Own workspace | No | No |
| Manage branches | No | Yes | Assigned branch only | No | Not applicable | No | No |
| Invite/manage staff | Platform operations only | Yes | If delegated | No | Own workspace collaborators if supported | No | No |
| Create/manage student records | No default access; approved support only | Yes | Assigned branch | Assigned classes, limited fields | Own workspace | Own profile only | No |
| Manage classes and enrollments | No default access | Yes | Assigned branch | Assigned classes, limited scope | Own workspace | View enrolled classes | View linked child's permitted classes |
| Mark attendance | No default access | Yes | Assigned branch | Assigned classes | Own workspace | View own attendance | View linked child's attendance |
| Manage fees and record payments | No default access | Yes | If delegated | No by default | Own workspace | View own permitted fee status | View linked child's fee status |
| Create lessons and assignments | No default access | Yes | If delegated | Assigned classes | Own workspace | No | No |
| Submit assignments / take exams | No | No | No | Review/manage assigned classes | Own workspace as teacher | Own account | No |
| View results | No default access | Yes | Assigned branch | Assigned classes | Own workspace | Own results | Linked children only |
| View reports | Platform-level operational metrics; tenant records only via approved support access | Organization-wide | Assigned branch | Assigned classes, limited reports | Own workspace | Own progress | Linked children, permitted summaries |
| Manage parent-child links | No default access | Yes | If delegated | No, unless explicitly delegated | Own workspace | No | Request/verify own link as workflow permits |
| Configure workspace subscription | Platform operations | View/manage according to billing role | No | No | Own workspace | No | No |

Role notes:
- **Platform administrator:** operates the SaaS platform. No unrestricted default access to private tenant records.
- **Institute owner:** has organization-wide authority, subject to platform policy and audit requirements.
- **Branch manager:** is scoped to assigned branches; cross-branch access is denied unless separately granted.
- **Teacher:** sees only assigned classes and the minimum student information needed for teaching.
- **Independent teacher:** is the owner/operator of an independent-teacher workspace and receives the relevant teacher and workspace-management permissions.
- **Student:** sees only their own personal learning and account information.
- **Parent/guardian:** sees only information for explicitly linked children.

## 7. Platform administrator support access

Platform administrators must not browse private student or institute records by default.

Support access requires:
1. A documented support reason or ticket.
2. Explicit authorization from an authorized customer representative.
3. A defined scope (tenant, records and permitted actions).
4. A limited start and expiry time.
5. Automatic expiration and a revocation mechanism.
6. Audit logging of approval, access, actions and termination.
7. No use of support access for unrelated browsing or routine analytics.

Platform-level operational metrics should be designed to avoid exposing private student records wherever possible.

## 8. Multi-tenancy and data isolation

- Each workspace/tenant has a unique identity.
- Every tenant-owned record must be associated with the correct tenant.
- Every protected backend operation validates tenant membership, role and resource scope.
- A tenant ID supplied by a client is never trusted without server-side validation.
- Tenant isolation applies to database queries, file access, search, exports, reports, background jobs, notifications and realtime events.
- Students can access only their own records.
- Parents can access only explicitly linked children.
- Teachers can access only assigned classes and permitted student fields.
- Branch managers are restricted to assigned branches.
- Cross-tenant access attempts must be denied and covered by automated tests.

## 9. Subscription, pricing and usage requirements

The product will support configurable plans. Proposed commercial tiers:

- Free / Starter.
- Teacher Pro.
- Institute.
- Business / White-label.
- Enterprise.

Potential entitlements and limits:
- Active student count.
- Teacher and staff count.
- Branch count.
- Storage allowance.
- File bandwidth or transfer allowance.
- Enabled modules and advanced capabilities.
- Branding and custom-domain availability.
- Reporting capabilities.
- Support level.

Requirements:
- Plans, entitlements and usage limits must be configurable, not hardcoded into individual screens or features.
- Workspace usage must be measurable and attributable to the correct tenant.
- Subscription status and entitlements must be checked by backend services.
- The model should support monthly and annual billing.
- Billing history, invoices, trials, renewals, grace periods and suspension rules need detailed policy/design before implementation.
- Automated payment collection and payment gateway integration can be delivered later.
- Enterprise pricing and dedicated deployment terms may be negotiated separately.

## 10. Storage requirements

- Shared SaaS and white-label files use centrally managed object storage.
- Files must be logically isolated by tenant.
- Track storage consumption per workspace.
- Enforce plan-based quotas and upload limits.
- Authorize file upload, download, preview and deletion on the server.
- Avoid public file URLs for private student records and learning materials unless explicitly intended.
- Plan backup, retention, deletion and recovery policies.
- Allow a future dedicated storage configuration for enterprise deployments.

## 11. Branding and custom domains

Future white-label requirements:
- Workspace-specific logo, product name and brand colors.
- Branded login and customer-facing experience.
- Custom domain ownership verification.
- Secure domain-to-workspace mapping.
- HTTPS certificate provisioning/renewal.
- Prevention of duplicate, unverified or unauthorized domain mappings.
- Safe fallback when a domain is misconfigured or disconnected.

## 12. Primary user journeys

1. **Independent teacher onboarding:** register → create workspace → configure profile → create subject/class → add students → publish resources.
2. **Institute onboarding:** register → create organization → configure branches → invite staff → create classes → enroll students.
3. **Student enrollment:** create student → assign class/batch → link parent/guardian → activate student account.
4. **Teaching:** open assigned class → mark attendance → publish lesson → create assignment → review submissions → publish results.
5. **Finance:** configure fees → record cash/bank payment → generate receipt → update balance → view reports.
6. **Parent:** register/login → securely link child → view permitted attendance, fees, results and announcements.
7. **Subscription lifecycle:** create workspace → select plan/trial if offered → enforce entitlements → track usage → handle renewal, upgrade, downgrade or expiry according to policy.
8. **Support access:** customer requests/approves support → platform records scope and expiry → administrator accesses only approved scope → actions are audited → access expires or is revoked.

## 13. Business rules and edge cases

- A user may belong to more than one workspace; each workspace membership and role is evaluated independently.
- A user switching workspaces must not retain access from the previous workspace.
- A student changing classes must retain appropriate historical attendance, assignment and exam records while current access follows current enrollment.
- A teacher removed from a class must lose access to that class's current protected data, subject to authorized historical/audit workflows.
- A parent-child link must be verified and revocable; removing a link immediately removes that parent's access to the child's protected information.
- Multiple guardians may be linked to a student only under the institute's configured and verified process.
- Branch transfers must update current branch scope without corrupting historical records.
- CSV imports must validate rows, detect duplicates and report errors without silently creating partial or incorrect records.
- Duplicate payment submissions must not create duplicate financial entries; corrections/refunds require traceable adjustments rather than silent deletion.
- Exam attempts must respect configured opening/closing times, attempt limits and submission rules.
- Expired or suspended subscriptions must follow a defined grace/read-only/suspension policy; data must not be silently deleted because of non-payment.
- Storage quota exhaustion must produce a clear error and must not corrupt existing files or records.
- Custom domains must not resolve to a tenant until ownership and configuration checks pass.
- Support access must stop at expiry even if an administrator session remains open.
- Background jobs, exports, notifications and realtime messages must apply the same tenant and role checks as ordinary API requests.

## 14. Non-functional requirements

### Security and privacy
- Secure authentication and session management.
- Server-side role, tenant and resource authorization.
- Tenant-isolation testing.
- Secure private file access.
- Audit logs for sensitive financial, administrative and support operations.
- Avoid exposing student personal information in application logs.
- Define retention, deletion, backup and incident-response policies before production.

### Reliability and operations
- Automated database backups and tested recovery procedures.
- Error and performance monitoring.
- Reliable object storage and upload handling.
- Operational visibility without unnecessary access to private tenant content.

### Performance and usability
- Pagination and filtering for large student, transaction and result lists.
- Responsive web experience for desktop and mobile browsers.
- Clear role-specific workflows.
- English, Sinhala and Tamil language readiness.

## 15. Explicitly outside the MVP

- Live video classrooms.
- Live quiz competitions, real-time leaderboards, polls, Q&A and interactive whiteboards.
- AI question generation, AI marking assistance, material summarization and predictive weakness analysis.
- Online payment gateway integration.
- QR attendance.
- Native Flutter applications; MVP is web-first and responsive.
- Advanced accounting, payroll and tax automation.
- Full white-label/custom-domain tooling.
- Dedicated enterprise deployments.
- International market launch and country-specific payment/compliance implementation.

The architecture should be extensible for later releases without implementing these features prematurely.

## 16. Architecture direction (proposed, not yet finalized)

- Web: Next.js, TypeScript and Tailwind CSS.
- API: NestJS and TypeScript.
- Database: PostgreSQL with Prisma.
- Realtime: Socket.IO when required.
- Cache/background jobs: Redis.
- File storage: S3-compatible object storage.
- Development/deployment: Docker.
- Mobile apps: Flutter in a later phase.

Start with a modular monolith, not microservices.

Architecture must account for tenant isolation, role-based authorization, configurable plan entitlements, usage metering, centralized storage, workspace branding/domain mapping and future dedicated deployments. Confirm the exact tenant model, database strategy, storage design, billing boundaries and deployment topology during Phase 0.5.

## 17. MVP acceptance criteria

The MVP is ready for release only when:
- Independent teachers can onboard and manage workspaces without an institute.
- Institutes can create organizations, configure branches and invite staff.
- Students can be enrolled and use the student portal.
- Parents can securely access only linked children's permitted information.
- Teachers can manage learning resources, assignments and examinations for assigned classes.
- Attendance and finance workflows operate correctly.
- Announcements and basic reports work within tenant and role boundaries.
- Plan entitlements and agreed usage limits are enforced for the features included in the release.
- Tenant isolation is tested across APIs, files, reports, exports, notifications and background jobs.
- Sensitive administrative and support actions are audited.
- Responsive web experience and release checks pass.

## 18. Later development direction

1. Online payments and automated subscription billing.
2. Full white-label branding and custom-domain management.
3. Advanced analytics and reporting.
4. Live classroom and interactive learning.
5. AI-powered teacher tools.
6. Native mobile applications.
7. Dedicated enterprise deployments.
8. International expansion.

---
This document is the approved product requirements baseline. Technical decisions and detailed implementation designs remain subject to Phase 0.5 architecture review.
