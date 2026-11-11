# Product Roadmap

This roadmap is the working plan for Edu Platform: a Sri Lanka-first, multi-tenant SaaS LMS + IMS for independent tuition teachers and educational institutes.

Status: `[ ]` not started · `[~]` in progress · `[x]` completed and reviewed · `[!]` blocked

**MVP labels:** `[MVP]` required for the approved first release; `[Later]` planned after the first release; `[Future]` optional/future exploration. A task is not complete merely because it is included in the MVP scope.

## Phase 0 — Product discovery and planning

- [x] **0.1 Product vision and target customers**
  - Define the product as a SaaS LMS + IMS for independent tuition teachers and institutes.
  - Initial market: Sri Lanka; planned languages: English, Sinhala and Tamil; initial currency: LKR.
  - Acceptance: vision, customer groups and initial market direction are documented and approved.
- [~] **0.2 Customer and competitor research**
  - Use desk research: competitor product pages, public documentation, public reviews and common tuition/institute workflows.
  - Build realistic teacher, institute, student and parent scenarios. Teacher interviews are not a dependency.
  - Acceptance: findings, recurring pain points, competitor comparison and assumptions are recorded with sources.
- [x] **0.3 MVP scope and release priorities**
  - Approved full six-module MVP plus parent portal, announcements/notifications and basic reports.
  - Acceptance: prioritized MVP scope, onboarding paths and explicit first-release exclusions are documented.
- [x] **0.4 Requirements and user journeys**
  - Approved `REQUIREMENTS.md` defines the service models, roles and baseline permissions, tenant/security rules, subscription and usage requirements, storage and domain requirements, primary user journeys, business rules, edge cases and MVP acceptance criteria.
  - Platform administrator access to private tenant records is temporary, explicitly approved, scoped, time-limited and audited; there is no unrestricted default access.
  - Acceptance: requirements baseline reviewed and approved by the user on 2026-11-11.
- [ ] **0.5 Architecture and technology decisions**
  - Confirm stack, tenant model, deployment assumptions, file storage, subscription/entitlement boundaries, notification strategy and integrations.
  - Architecture must support shared SaaS first, white-label readiness and a future dedicated deployment option.
  - Acceptance: decisions and trade-offs are recorded in architecture decision records.

## Approved service model

1. **Shared SaaS — first delivery model:** customer-created workspaces on centrally managed application, database and storage infrastructure, with strict tenant isolation.
2. **White-label SaaS — later feature delivery:** customer branding and custom domains on the same core application and shared infrastructure.
3. **Dedicated enterprise — future:** separate application deployment, database and storage where contracted.

Pricing will use configurable tiers and entitlements. Potential limits include students, staff, branches, storage, bandwidth, enabled modules, branding/domain capabilities and support level. Plan configuration and entitlement foundations must be considered in architecture; automated billing can follow later.

## Approved first-release scope

### Onboarding and access foundation
- [MVP] Independent teacher onboarding without requiring an institute.
- [MVP] Institute onboarding with organization setup, branch support and staff invitations.
- [MVP] Secure authentication, tenant/workspace isolation and role-based permissions.
- [MVP] Platform administrator capabilities needed to operate and support the SaaS.
- [MVP] Tenant-scoped authorization for APIs, files, reports, exports, background jobs and notifications.

### Module 1 — Student and teacher management
- [MVP] Student profiles and enrollment.
- [MVP] Teacher and staff profiles.
- [MVP] Parent/guardian details and student-to-guardian relationships.
- [MVP] Validated CSV import.
- [MVP] Search, filtering and role-appropriate record history.

### Module 2 — Class and batch management
- [MVP] Subjects and class/course catalog.
- [MVP] Classes and batches.
- [MVP] Teacher assignments and student enrollments.
- [MVP] Timetables and schedules.
- [MVP] Branch-aware visibility.

### Module 3 — Attendance and finance
- [MVP] Manual attendance marking and history.
- [MVP] Monthly fee structures and student fee balances.
- [MVP] Cash and bank payment recording.
- [MVP] Outstanding balance tracking and payment history.
- [MVP] Receipts or downloadable payment records.
- [Later] QR attendance.
- [Later] Online payment gateway integration.
- [Later] Advanced accounting, payroll and reconciliation.

### Module 4 — Learning management
- [MVP] Course/class sections and lessons.
- [MVP] PDF and video learning resources.
- [MVP] Assignments and student submissions.
- [MVP] Teacher feedback and marking.
- [MVP] Basic learning progress visibility.

### Module 5 — Examinations
- [MVP] Question bank with categories.
- [MVP] MCQ and true/false question types.
- [MVP] Timed exams and basic attempt rules.
- [MVP] Automatic marking for supported objective questions.
- [MVP] Results and class/batch rankings.

### Module 6 — Student portal
- [MVP] Secure student login.
- [MVP] Enrolled classes and schedules.
- [MVP] Permitted learning resources.
- [MVP] Assignment instructions and submissions.
- [MVP] Exam participation, results and rankings.
- [MVP] Attendance and relevant progress.

### Parent portal
- [MVP] Parent/guardian login and secure child linking.
- [MVP] View linked child's classes and announcements.
- [MVP] View attendance, examination results and fee status.
- [MVP] Strict linked-child authorization.

### Announcements and notifications
- [MVP] Targeted announcements by organization, branch, class, batch or permitted audience.
- [MVP] In-app notifications.
- [Later] Email, push and SMS integrations.

### Basic reports
- [MVP] Student/enrollment summaries.
- [MVP] Attendance summaries.
- [MVP] Examination and performance summaries.
- [MVP] Fee collection and outstanding-balance summaries.
- [MVP] Tenant- and role-scoped reporting.
- [Later] Advanced analytics and AI-generated reports.

## Explicitly outside the first release

- Live video classroom, real-time quiz competitions, leaderboards, polls, Q&A and interactive whiteboard.
- AI question generation, AI marking assistance, material summarization and predictive student weakness analysis.
- Native Flutter apps; first release is responsive web.
- QR attendance.
- Online payment gateway integration.
- Advanced accounting, payroll and tax automation.
- Full white-label branding/custom-domain tooling.
- Dedicated enterprise deployments.
- International market launch and country-specific payment/compliance implementation.

Architecture readiness for future white-label, dedicated deployment and international expansion is required, but those capabilities are not to be prematurely implemented in the MVP.

## Later product releases

### Release 2 — Engagement, subscriptions and white-label expansion
- [Later] Online payment integration and automated subscription billing.
- [Later] Full white-label branding and custom-domain management.
- [Later] Live quiz sessions, join codes, real-time answers and leaderboards.
- [Later] Polls, Q&A and interactive classroom features.
- [Later] AI-assisted question generation, summarization and teacher workflows, with human review.
- [Later] Advanced student performance analysis.
- [Later] Expanded communication channels and reminders.

### Release 3 — Mobile applications
- [Later] Flutter student app.
- [Later] Flutter parent app.
- [Later] Flutter teacher app.
- [Later] Push notifications and offline access to permitted resources.

### Future — Enterprise and international expansion
- [Future] Dedicated enterprise application, database and storage deployments.
- [Future] Additional currencies, locales, time zones and country settings.
- [Future] Country-specific payment providers, tax and compliance support.
- [Future] International rollout after validating the Sri Lankan product.

## Remaining engineering phases

- [ ] **Phase 1 — Repository and engineering foundation**
  - Monorepo structure, formatting/linting/type-checking, environment configuration, Docker and CI.
- [ ] **Phase 2 — Authentication and multi-tenancy**
  - Authentication, tenant onboarding, tenant isolation tests, RBAC, invitations and audit logs.
- [ ] **Phase 3 — Dashboards and core navigation**
  - Role-specific dashboards and responsive navigation.
- [ ] **Phase 4 — People and organization management**
  - Student, teacher, staff, guardian, branch and import workflows.
- [ ] **Phase 5 — Classes, batches and courses**
  - Subjects, classes, batches, assignments, enrollments and schedules.
- [ ] **Phase 6 — Learning management system**
  - Lessons, resources, assignments, submissions, feedback and progress.
- [ ] **Phase 7 — Exams and question bank**
  - Question authoring, exam attempts, marking and results.
- [ ] **Phase 8 — Attendance and institute operations**
  - Manual attendance, history and operational workflows.
- [ ] **Phase 9 — Finance**
  - Fees, payments, receipts and financial summaries.
- [ ] **Phase 10 — Live classroom and competitions [Later]**
- [ ] **Phase 11 — Communication and parent portal**
  - MVP parent portal and announcements are first-release requirements; later delivery channels remain follow-on work.
- [ ] **Phase 12 — AI capabilities [Later]**
- [ ] **Phase 13 — SaaS subscriptions and platform administration**
  - Configurable plans, entitlements, usage metering, billing lifecycle and platform operations. Design foundations during architecture; deliver billing automation later.
- [ ] **Phase 14 — Branding and localization**
  - MVP language readiness for English/Sinhala/Tamil and LKR. Full white-label branding, custom domains and international localization follow later.
- [ ] **Phase 15 — Mobile applications [Later]**
- [ ] **Phase 16 — Quality, security and production**
  - Automated tests, tenant isolation, performance, backups, monitoring, support-access auditability and release readiness.

## Release acceptance principles

The MVP is ready for release only when:
1. An independent teacher can onboard and run classes without creating an institute.
2. An institute can onboard, manage branches and invite staff.
3. Tenant boundaries and role permissions are tested, including cross-tenant access attempts.
4. Student, class, learning, exam, attendance and finance workflows work end-to-end.
5. Students and parents can access only information they are authorized to see.
6. Announcements, notifications and basic reports respect tenant and role boundaries.
7. Subscription entitlements and included usage limits are enforced.
8. Relevant automated tests, security checks, backups and release checks pass.
